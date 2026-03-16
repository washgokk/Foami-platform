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

    // Send Line notification to customer on key status changes
    const NOTIFY_STATUSES: Record<string, string> = {
        confirmed: '✅ การจองของคุณได้รับการยืนยันแล้ว!',
        picking_up: '🏍️ พนักงานกำลังมารับรถของคุณแล้ว!',
        washing: '🫧 รถของคุณกำลังถูกล้างอยู่ เดี๋ยวเสร็จแล้วครับ!',
        delivering: '🚗 ล้างเสร็จแล้ว! พนักงานกำลังนำรถกลับ',
        completed: '🎉 ส่งรถเรียบร้อยแล้ว! ขอบคุณที่ใช้บริการ Foami',
    }

    if (NOTIFY_STATUSES[status] && data.customers?.line_user_id) {
        try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-customer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    line_user_id: data.customers.line_user_id,
                    message: NOTIFY_STATUSES[status],
                    booking_id: id,
                }),
            })
        } catch { /* Non-critical */ }
    }

    // Send Web Push notification to customer
    if (NOTIFY_STATUSES[status]) {
        try {
            await sendPushNotification(data.customer_id, 'customer', {
                title: 'Foami Service Update',
                body: NOTIFY_STATUSES[status],
                url: `/${data.branches?.slug || 'menu'}/my-bookings`
            })
        } catch { /* Non-critical */ }
    }

    return NextResponse.json({ booking: data })
}
