import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push'

// Cron: Called every 30 min via Vercel Cron or external scheduler
// Purpose: Remind staff about pending jobs that haven't been picked up
export async function GET(req: NextRequest) {
    // Verify cron secret
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET || 'foami-cron-2025'}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const now = new Date()

    // 1. Find bookings that are 'pending' and have no staff assigned
    // Only remind for jobs that are in the future or very recent (within 24h)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const { data: pendingBookings } = await supabase
        .from('bookings')
        .select('id, zone_id, scheduled_date, scheduled_time')
        .eq('status', 'pending')
        .is('staff_id', null)
        .gte('scheduled_date', yesterday)

    if (!pendingBookings || pendingBookings.length === 0) {
        return NextResponse.json({ message: 'No pending bookings to remind' })
    }

    let notificationsSent = 0

    for (const booking of pendingBookings) {
        // 2. Find available staff for this zone/date/time
        const { data: schedules } = await supabase
            .from('staff_schedules')
            .select('staff_id, staff(line_user_id)')
            .eq('zone_id', booking.zone_id)
            .eq('date', booking.scheduled_date)
            .eq('time_slot', booking.scheduled_time)
            .eq('is_booked', false)

        if (!schedules || schedules.length === 0) continue

        const staffIds = schedules.map(s => s.staff_id)
        const lineUserIds = schedules.map(s => (s.staff as any)?.line_user_id).filter(Boolean)

        // 3. Send Line Notification (Bulk)
        if (lineUserIds.length > 0) {
            try {
                await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-staff`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        line_user_ids: lineUserIds,
                        booking_id: booking.id,
                        message: `📢 แจ้งเตือนย้ำ!\nยังไม่มีคนรับงานวันที่ ${booking.scheduled_date} เวลา ${booking.scheduled_time}\nรีบกดรับงานก่อนโดนแย่งนะครับ!`,
                    }),
                })
            } catch (err) {
                console.error('Line reminder error:', err)
            }
        }

        // 4. Send Web Push Notification to each available staff
        if (staffIds.length > 0) {
            await Promise.all(
                staffIds.map(sId => 
                    sendPushNotification(sId, 'staff', {
                        title: '📢 ยังไม่ได้คนรับงาน!',
                        body: `งานวันที่ ${booking.scheduled_date} เวลา ${booking.scheduled_time} รอคุณอยู่\nกดรับงานเพื่อเริ่มหารายได้เลย!`,
                        url: `/staff`
                    })
                )
            )
            notificationsSent += staffIds.length
        }
    }

    return NextResponse.json({ 
        bookingsChecked: pendingBookings.length, 
        notificationsSent 
    })
}
