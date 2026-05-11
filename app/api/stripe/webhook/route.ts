import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const body = await req.text()
    const sig = req.headers.get('stripe-signature')!
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

    let event
    try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object as any
        const supabase = createServiceClient()
        const bookingId = pi.metadata.booking_id
        const paymentType = pi.metadata.type // 'additional_payment' or undefined

        if (paymentType === 'additional_payment') {
            const { data: booking } = await supabase
                .from('bookings')
                .update({ 
                    is_additional_paid: true, 
                    additional_payment_stripe_id: pi.id 
                })
                .eq('id', bookingId)
                .select('*, customers(line_user_id), branches(slug)')
                .single()

            // Trigger "Delivering" notification if it was held back
            if (booking && booking.status === 'delivering') {
                const { NOTIFICATIONS } = await import('@/lib/notifications-config')
                const message = NOTIFICATIONS.CUSTOMER.DELIVERING.lineMessage
                
                // Line
                if (booking.customers?.line_user_id) {
                    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-customer`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            line_user_id: booking.customers.line_user_id,
                            message: message,
                            booking_id: bookingId,
                            notif_type: 'delivering',
                        }),
                    }).catch(() => {})
                }

                // Web Push
                try {
                    const { sendPushNotification } = await import('@/lib/push')
                    await sendPushNotification(booking.customer_id, 'customer', {
                        title: NOTIFICATIONS.CUSTOMER.DELIVERING.pushTitle,
                        body: message,
                        url: `/${booking.branches?.slug || 'menu'}/my-bookings`
                    })
                } catch {}
            }

            // [NEW] Notify Staff that payment was received
            if (booking && booking.staff_id) {
                const { NOTIFICATIONS } = await import('@/lib/notifications-config')
                const staffNotif = NOTIFICATIONS.STAFF.PAID_EXTRA
                const staffMessage = staffNotif.lineMessage(bookingId, pi.amount / 100)
                
                try {
                    const { sendPushNotification } = await import('@/lib/push')
                    await sendPushNotification(booking.staff_id, 'staff', {
                        title: staffNotif.pushTitle,
                        body: staffNotif.pushBody(bookingId, pi.amount / 100),
                        url: `/staff/jobs/${bookingId}`
                    })
                } catch {}

                // Line notification to staff (optional but good)
                const { data: staff } = await supabase.from('staff').select('line_user_id').eq('id', booking.staff_id).single()
                if (staff?.line_user_id) {
                    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-staff`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            line_user_ids: [staff.line_user_id],
                            booking_id: bookingId,
                            message: staffMessage,
                        }),
                    }).catch(() => {})
                }
            }
        } else {
            // Initial Booking Payment Success
            const { data: booking, error } = await supabase
                .from('bookings')
                .update({ 
                    payment_status: 'paid', 
                    status: 'pending',
                    stripe_payment_id: pi.id 
                })
                .eq('id', bookingId)
                .select('*, customers(full_name), zones(id, branch_id)')
                .single()

            if (booking) {
                // [Fix 3] Notify only zone-matched staff (not all branch staff)
                try {
                    const { NOTIFICATIONS } = await import('@/lib/notifications-config')
                    const { notifyTargetStaff } = await import('@/lib/push')

                    // Re-fetch booking with zone info to get schedule details
                    const { data: fullBooking } = await supabase
                        .from('bookings')
                        .select('zone_id, scheduled_date, scheduled_time, branch_id')
                        .eq('id', bookingId)
                        .single()

                    let targetIds: string[] = []

                    if (fullBooking?.zone_id && fullBooking?.scheduled_date && fullBooking?.scheduled_time) {
                        // Primary: staff scheduled in this specific zone + time slot
                        const { data: schedules } = await supabase
                            .from('staff_schedules')
                            .select('staff_id')
                            .eq('zone_id', fullBooking.zone_id)
                            .eq('date', fullBooking.scheduled_date)
                            .eq('time_slot', fullBooking.scheduled_time)
                            .eq('is_booked', false)

                        targetIds = schedules?.map(s => s.staff_id).filter(Boolean) || []

                        // Fallback: staff with ANY schedule in branch on this day (not all-branch)
                        if (targetIds.length === 0 && fullBooking.branch_id) {
                            const { data: branchZones } = await supabase
                                .from('zones')
                                .select('id')
                                .eq('branch_id', fullBooking.branch_id)
                                .eq('is_active', true)
                            
                            const zoneIds = branchZones?.map(z => z.id) || []
                            if (zoneIds.length > 0) {
                                const { data: daySchedules } = await supabase
                                    .from('staff_schedules')
                                    .select('staff_id')
                                    .in('zone_id', zoneIds)
                                    .eq('date', fullBooking.scheduled_date)
                                    .eq('is_booked', false)
                                targetIds = [...new Set(daySchedules?.map(s => s.staff_id).filter(Boolean) || [])]
                            }
                        }
                    }

                    if (targetIds.length > 0) {
                        await notifyTargetStaff(targetIds, {
                            title: NOTIFICATIONS.STAFF.NEW_JOB.pushTitle,
                            body: NOTIFICATIONS.STAFF.NEW_JOB.pushBody(booking.scheduled_date, booking.scheduled_time),
                            url: `/staff/jobs/${bookingId}`
                        })
                        console.log(`[Webhook] Notified ${targetIds.length} zone-matched staff for booking ${bookingId}`)
                    } else {
                        console.log(`[Webhook] No matching staff found for booking ${bookingId} — skipping notification`)
                    }
                } catch (e) {
                    console.error('[Webhook] Failed to notify staff of new job:', e)
                }
            }
        }
    }

    return NextResponse.json({ received: true })
}
