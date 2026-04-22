import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push'
//update
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

    // --- LINE: ส่ง 3 กรณี ---
    // 1. confirmed    → ยืนยันการจอง
    // 2. completed    → งานเสร็จแล้ว
    // 3. delivering + มียอดค้างชำระ → รอชำระส่วนต่าง (payment_pending)

    let lineMessageToSend = ''
    let actualNotifyStatus = status

    if (status === 'delivering' && data.additional_price > 0 && !data.is_additional_paid) {
        // กรณีพิเศษ: ส่ง payment_pending แทน
        actualNotifyStatus = 'payment_pending'
        lineMessageToSend = NOTIFICATIONS.CUSTOMER.PAYMENT_PENDING
            .lineMessage(data.additional_price, data.additional_price_note)
    } else if (status === 'confirmed') {
        const notif = NOTIFICATIONS.CUSTOMER.CONFIRMED
        lineMessageToSend = typeof notif.lineMessage === 'function'
            ? notif.lineMessage(data.scheduled_date, data.scheduled_time)
            : notif.lineMessage
    } else if (status === 'completed') {
        const notif = NOTIFICATIONS.CUSTOMER.COMPLETED
        lineMessageToSend = typeof notif.lineMessage === 'function'
            ? notif.lineMessage(data.scheduled_date, data.scheduled_time)
            : notif.lineMessage
    }

    if (lineMessageToSend && data.customers?.line_user_id) {
        try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-customer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    line_user_id: data.customers.line_user_id,
                    message: lineMessageToSend,
                    booking_id: id,
                    notif_type: actualNotifyStatus,
                    branch_slug: data.branches?.slug || 'menu'
                }),
            })
        } catch { /* Non-critical */ }
    }

    // --- WEB PUSH: ส่งทุก status เหมือนเดิม (ไม่กระทบ LINE limit) ---
    const PUSH_NOTIFS: Record<string, any> = {
        confirmed: NOTIFICATIONS.CUSTOMER.CONFIRMED,
        picking_up: NOTIFICATIONS.CUSTOMER.PICKING_UP,
        washing: NOTIFICATIONS.CUSTOMER.WASHING,
        delivering: NOTIFICATIONS.CUSTOMER.DELIVERING,
        completed: NOTIFICATIONS.CUSTOMER.COMPLETED,
    }

    let pushTitle = ''
    let pushMessage = ''

    if (status === 'delivering' && data.additional_price > 0 && !data.is_additional_paid) {
        const paymentNotif = NOTIFICATIONS.CUSTOMER.PAYMENT_PENDING
        pushTitle = paymentNotif.pushTitle
        pushMessage = paymentNotif.lineMessage(data.additional_price, data.additional_price_note)
    } else {
        const notif = PUSH_NOTIFS[status]
        if (notif) {
            pushMessage = typeof notif.lineMessage === 'function'
                ? notif.lineMessage(data.scheduled_date, data.scheduled_time)
                : notif.lineMessage
            pushTitle = typeof notif.pushTitle === 'function'
                ? notif.pushTitle(data.scheduled_date, data.scheduled_time)
                : notif.pushTitle
        }
    }

    // Send Web Push notification to customer (ส่งทุก status)
    if (pushMessage) {
        try {
            await sendPushNotification(data.customer_id, 'customer', {
                title: pushTitle || 'Foami Service Update',
                body: pushMessage.split('\n')[0],
                url: `/${data.branches?.slug || 'menu'}/my-bookings`
            })
        } catch { /* Non-critical */ }
    }

    return NextResponse.json({ booking: data })
}
