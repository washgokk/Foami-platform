import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET: Get availability for a zone and date range
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const zone_id = searchParams.get('zone_id')
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')

    if (!zone_id || !start_date || !end_date) {
        return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    }

    const supabase = createServiceClient()
    
    // 1. Fetch Zone and its Branch ID
    const { data: zoneData } = await supabase
        .from('zones')
        .select('branch_id')
        .eq('id', zone_id)
        .single()
    
    if (!zoneData) {
        return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
    }

    const branch_id = zoneData.branch_id

    // 2. Fetch Capacity (Specific to this zone)
    const { data: schedules } = await supabase
        .from('staff_schedules')
        .select('date, time_slot')
        .eq('zone_id', zone_id)
        .gte('date', start_date)
        .lte('date', end_date)

    // 3. Fetch Usage (Branch-wide to account for overflow/busy staff)
    const { data: bookings } = await supabase
        .from('bookings')
        .select('scheduled_date, scheduled_time')
        .eq('branch_id', branch_id)
        .neq('status', 'cancelled')
        .gte('scheduled_date', start_date)
        .lte('scheduled_date', end_date)

    // Current date and time in TH
    const now = new Date()
    const thTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
    const todayStr = thTime.getFullYear() + '-' + String(thTime.getMonth() + 1).padStart(2, '0') + '-' + String(thTime.getDate()).padStart(2, '0')
    const currentHourMin = String(thTime.getHours()).padStart(2, '0') + ':' + String(thTime.getMinutes()).padStart(2, '0')

    // Count capacity per slot
    const capacityCounts: Record<string, Record<string, number>> = {}
    for (const s of schedules || []) {
        // BUG-13 FIX: normalize time_slot to HH:MM before comparison
        const normalizedSlot = (s.time_slot || '').substring(0, 5) // '09:00:00' -> '09:00'
        if (s.date === todayStr && normalizedSlot <= currentHourMin) continue
        if (!capacityCounts[s.date]) capacityCounts[s.date] = {}
        const slotKey = (s.time_slot || '').substring(0, 5) // BUG-13 FIX: normalize
        capacityCounts[s.date][slotKey] = (capacityCounts[s.date][slotKey] || 0) + 1
    }

    // Count usage per slot
    const usageCounts: Record<string, Record<string, number>> = {}
    for (const b of bookings || []) {
        const date = b.scheduled_date
        const time = b.scheduled_time.slice(0, 5)
        if (!usageCounts[date]) usageCounts[date] = {}
        usageCounts[date][time] = (usageCounts[date][time] || 0) + 1
    }

    // Calculate net availability
    const grouped: Record<string, string[]> = {}
    for (const date in capacityCounts) {
        for (const time_slot in capacityCounts[date]) {
            const cap = capacityCounts[date][time_slot]
            const usage = usageCounts[date]?.[time_slot] || 0
            if (cap - usage > 0) {
                if (!grouped[date]) grouped[date] = []
                grouped[date].push(time_slot)
            }
        }
        if (grouped[date]) grouped[date].sort()
    }

    return NextResponse.json({ availability: grouped })
}
