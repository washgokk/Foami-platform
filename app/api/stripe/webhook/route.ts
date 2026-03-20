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
            // Initial Booking Payment
            await supabase
                .from('bookings')
                .update({ 
                    payment_status: 'paid', 
                    status: 'pending',
                    stripe_payment_id: pi.id 
                })
                .eq('id', bookingId)
        }
    }

    return NextResponse.json({ received: true })
}
