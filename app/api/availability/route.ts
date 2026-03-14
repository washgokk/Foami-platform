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
    
    // 1. Fetch Capacity
    const { data: schedules } = await supabase
        .from('staff_schedules')
        .select('date, time_slot')
        .eq('zone_id', zone_id)
        .gte('date', start_date)
        .lte('date', end_date)

    // 2. Fetch Usage
    const { data: bookings } = await supabase
        .from('bookings')
        .select('scheduled_date, scheduled_time')
        .eq('zone_id', zone_id)
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
        if (s.date === todayStr && s.time_slot <= currentHourMin) continue
        if (!capacityCounts[s.date]) capacityCounts[s.date] = {}
        capacityCounts[s.date][s.time_slot] = (capacityCounts[s.date][s.time_slot] || 0) + 1
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
