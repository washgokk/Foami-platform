import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push'
import { addHours, format, parseISO, isWithinInterval, addMinutes } from 'date-fns'

// Cron: Called every 15-30 min
// Purpose: Remind staff about already accepted/confirmed jobs (Pre-job reminder)
export async function GET(req: NextRequest) {
    // Verify cron secret
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET || 'foami-cron-2025'}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const now = new Date()
    
    // We look for jobs starting in the next 60 minutes
    const oneHourLater = addHours(now, 1)
    
    // Simplistic date filtering: today and tomorrow (to handle midnight crossings)
    const today = format(now, 'yyyy-MM-dd')
    const tomorrow = format(addHours(now, 24), 'yyyy-MM-dd')
    
    const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
            id, scheduled_date, scheduled_time, staff_id, 
            status, reminder_sent, customers(full_name)
        `)
        .eq('status', 'confirmed')
        .in('scheduled_date', [today, tomorrow])
        .eq('reminder_sent', false)
        .not('staff_id', 'is', null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!bookings || bookings.length === 0) {
        return NextResponse.json({ message: 'No upcoming jobs to remind' })
    }

    let notifiedCount = 0
    const remindedIds: string[] = []

    for (const booking of bookings) {
        try {
            // Combine date and time to check if it's within the next 45-60 mins
            // scheduled_time is usually "09:00"
            const jobTime = parseISO(`${booking.scheduled_date}T${booking.scheduled_time}:00`)
            
            // If job starts between now and 60 minutes from now
            const isSoon = jobTime > now && jobTime <= oneHourLater

            if (isSoon) {
                const { NOTIFICATIONS } = await import('@/lib/notifications-config')
                const notif = NOTIFICATIONS.STAFF.UPCOMING_JOB
                
                // 1. Send Push
                await sendPushNotification(booking.staff_id!, 'staff', {
                    title: notif.pushTitle,
                    body: notif.pushBody(booking.scheduled_date, booking.scheduled_time),
                    url: `/staff/jobs/${booking.id}`
                })

                // 2. Send Line (if possible - fetch staff line_user_id)
                const { data: staff } = await supabase
                    .from('staff')
                    .select('line_user_id')
                    .eq('id', booking.staff_id)
                    .single()

                if (staff?.line_user_id) {
                    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-staff`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            line_user_ids: [staff.line_user_id],
                            booking_id: booking.id,
                            message: notif.lineMessage(booking.scheduled_date, booking.scheduled_time),
                        }),
                    }).catch(() => {})
                }

                remindedIds.push(booking.id)
                notifiedCount++
            }
        } catch (err) {
            console.error(`Failed to notify for booking ${booking.id}:`, err)
        }
    }

    // Mark as reminded to avoid duplicate if cron runs frequently
    if (remindedIds.length > 0) {
        await supabase
            .from('bookings')
            .update({ reminder_sent: true })
            .in('id', remindedIds)
    }

    return NextResponse.json({ notifiedCount, bookingsChecked: bookings.length })
}
