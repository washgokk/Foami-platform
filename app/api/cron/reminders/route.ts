import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push'
import { findMatchingStaffForJob } from '@/lib/staff-matching'

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
        .select(`
            id, branch_id, zone_id, scheduled_date, scheduled_time,
            pickup_lat, pickup_lng, delivery_lat, delivery_lng
        `)
        .eq('status', 'pending')
        .is('staff_id', null)
        .gte('scheduled_date', yesterday)

    if (!pendingBookings || pendingBookings.length === 0) {
        return NextResponse.json({ message: 'No pending bookings to remind' })
    }

    const cache: Record<string, { zones: any[], branch: any, schedules: any[], bookings: any[] }> = {}
    let notificationsSent = 0

    for (const booking of pendingBookings) {
        // Load Cache for this Branch + Date
        const cacheKey = `${booking.branch_id}_${booking.scheduled_date}`
        if (!cache[cacheKey]) {
            const [zonesRes, branchRes, schedulesRes, bookingsRes] = await Promise.all([
                supabase.from('zones').select('*').eq('branch_id', booking.branch_id).eq('is_active', true),
                supabase.from('branches').select('*').eq('id', booking.branch_id).single(),
                supabase.from('staff_schedules').select('*, staff(line_user_id)').eq('date', booking.scheduled_date),
                supabase.from('bookings').select('id, scheduled_time, staff_id').eq('scheduled_date', booking.scheduled_date)
            ])
            cache[cacheKey] = {
                zones: zonesRes.data || [],
                branch: branchRes.data,
                schedules: schedulesRes.data || [],
                bookings: bookingsRes.data || []
            }
        }

        const { zones, branch, schedules, bookings } = cache[cacheKey]

        // 2. Find eligible staff using SHARED logic
        const matches = findMatchingStaffForJob({
            pickupLat: Number(booking.pickup_lat),
            pickupLng: Number(booking.pickup_lng),
            deliveryLat: Number(booking.delivery_lat),
            deliveryLng: Number(booking.delivery_lng),
            showDelivery: !!(
                booking.delivery_lat &&
                booking.delivery_lng &&
                (booking.delivery_lat !== booking.pickup_lat || booking.delivery_lng !== booking.pickup_lng)
            ),
            zones,
            branch,
            daySchedules: schedules,
            dayBookings: bookings,
            timeSlot: booking.scheduled_time
        })

        if (!matches || matches.length === 0) continue

        // Subtract capacity already "spoken for" by other unassigned bookings
        const allPendingInBranch = bookings.filter(b => (b.scheduled_time === booking.scheduled_time || b.scheduled_time?.startsWith(booking.scheduled_time)) && !b.staff_id)
        const eligibleCount = Math.max(0, matches.length - allPendingInBranch.length)
        
        // If there's still actual capacity, or if we want to remind "all theoretically possible" staff:
        // For Reminders, we notify all 'matches' because they are eligible.
        const eligibleStaff = matches.slice(0, matches.length) // Take all potential matches
        
        const staffIds = eligibleStaff.map(m => m.staff_id)
        const lineUserIds = eligibleStaff.map(m => {
            const sch = schedules.find(s => s.staff_id === m.staff_id)
            return (sch?.staff as any)?.line_user_id
        }).filter(Boolean)

        // 3. Send Line Notification (Bulk)
        if (lineUserIds.length > 0) {
            const { NOTIFICATIONS } = await import('@/lib/notifications-config')
            try {
                await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-staff`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        line_user_ids: lineUserIds,
                        booking_id: booking.id,
                        message: NOTIFICATIONS.STAFF.REMINDER.lineMessage(booking.scheduled_date, booking.scheduled_time),
                    }),
                })
            } catch (err) {
                console.error('Line reminder error:', err)
            }
        }

        // 4. Send Web Push Notification to each eligible staff
        if (staffIds.length > 0) {
            const { NOTIFICATIONS } = await import('@/lib/notifications-config')
            const reminderNotif = NOTIFICATIONS.STAFF.REMINDER
            await Promise.all(
                staffIds.map(sId => 
                    sendPushNotification(sId, 'staff', {
                        title: reminderNotif.pushTitle,
                        body: reminderNotif.pushBody(booking.scheduled_date, booking.scheduled_time),
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
