import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Cron: Called every 15 min via Vercel Cron or external scheduler
// Auto-assign staff to bookings that are 2 hours away with no staff
export async function GET(req: NextRequest) {
    // Verify cron secret
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET || 'foami-cron-2025'}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const now = new Date()
    const cutoff = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours from now

    // Get pending bookings happening within 2 hours
    const { data: pendingBookings } = await supabase
        .from('bookings')
        .select('id, zone_id, scheduled_date, scheduled_time, customers(full_name, line_user_id)')
        .eq('status', 'pending')
        .is('staff_id', null)

    let assigned = 0
    for (const booking of pendingBookings || []) {
        const bookingDt = new Date(`${booking.scheduled_date}T${booking.scheduled_time}`)
        if (bookingDt > cutoff) continue // More than 2 hours away, skip

        // Find available staff for this zone/date/time
        const { data: schedules } = await supabase
            .from('staff_schedules')
            .select('staff_id')
            .eq('zone_id', booking.zone_id)
            .eq('date', booking.scheduled_date)
            .eq('time_slot', booking.scheduled_time)
            .eq('is_booked', false)

        if (!schedules || schedules.length === 0) continue

        // Randomly pick one
        const picked = schedules[Math.floor(Math.random() * schedules.length)]

        await supabase.from('bookings').update({
            staff_id: picked.staff_id,
            status: 'confirmed',
            auto_assigned: true,
            updated_at: new Date().toISOString(),
        }).eq('id', booking.id)

        // Mark schedule as booked
        await supabase.from('staff_schedules')
            .update({ is_booked: true })
            .eq('staff_id', picked.staff_id)
            .eq('zone_id', booking.zone_id)
            .eq('date', booking.scheduled_date)
            .eq('time_slot', booking.scheduled_time)

        // Get staff line_user_id for urgent notification
        const { data: staffData } = await supabase
            .from('staff')
            .select('full_name, line_user_id')
            .eq('id', picked.staff_id)
            .single()

        if (staffData?.line_user_id) {
            try {
                await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-staff`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        line_user_ids: [staffData.line_user_id],
                        booking_id: booking.id,
                        message: `🚨 ระบบกำหนดงานอัตโนมัติ!\nคุณได้รับมอบหมายงาน วันที่ ${booking.scheduled_date} เวลา ${booking.scheduled_time}\nกรุณาเปิดแอปเพื่อดูรายละเอียด`,
                    }),
                })
            } catch { /* Non-critical */ }
        }

        assigned++
    }

    return NextResponse.json({ assigned, checked: pendingBookings?.length || 0 })
}
