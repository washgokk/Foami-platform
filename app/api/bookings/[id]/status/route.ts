import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push'

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { status } = await req.json()
    const supabase = createServiceClient()

    const { data, error } = await supabase
        .from('bookings')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, customers(full_name, line_user_id), branches(slug), staff(full_name)')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Get Notification Config
    const { NOTIFICATIONS } = await import('@/lib/notifications-config')

    const CUSTOMER_NOTIFS: Record<string, any> = {
        confirmed: NOTIFICATIONS.CUSTOMER.CONFIRMED,
        picking_up: NOTIFICATIONS.CUSTOMER.PICKING_UP,
        washing: NOTIFICATIONS.CUSTOMER.WASHING,
        delivering: NOTIFICATIONS.CUSTOMER.DELIVERING,
        completed: NOTIFICATIONS.CUSTOMER.COMPLETED,
    }

    // --- SEQUENTIAL NOTIFICATION LOGIC ---
    let actualNotifyStatus = status
    let messageToSend = ''
    let pushTitle = ''
    let isPaymentPending = false

    if (status === 'delivering' && data.additional_price > 0 && !data.is_additional_paid) {
        // If unpaid additional price, send payment reminder instead of delivering message
        actualNotifyStatus = 'payment_forward'
        const paymentNotif = NOTIFICATIONS.CUSTOMER.PAYMENT_PENDING
        messageToSend = paymentNotif.lineMessage(data.additional_price, data.additional_price_note)
        pushTitle = paymentNotif.pushTitle
        isPaymentPending = true
    } else {
        const notif = CUSTOMER_NOTIFS[status]
        if (notif) {
            messageToSend = typeof notif.lineMessage === 'function' 
                ? notif.lineMessage(data.scheduled_date, data.scheduled_time)
                : notif.lineMessage
            pushTitle = typeof notif.pushTitle === 'function'
                ? notif.pushTitle(data.scheduled_date, data.scheduled_time)
                : notif.pushTitle
        }
    }

    if (messageToSend && data.customers?.line_user_id) {
        try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-customer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    line_user_id: data.customers.line_user_id,
                    message: messageToSend,
                    booking_id: id,
                    notif_type: actualNotifyStatus,
                }),
            })
        } catch { /* Non-critical */ }
    }

    // Send Web Push notification to customer
    if (messageToSend) {
        try {
            await sendPushNotification(data.customer_id, 'customer', {
                title: pushTitle || 'Foami Service Update',
                body: messageToSend.split('\n')[0],
                url: `/${data.branches?.slug || 'menu'}/my-bookings`
            })
        } catch { /* Non-critical */ }
    }

    return NextResponse.json({ booking: data })
}
