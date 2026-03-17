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
        confirmed: '✅ การจองของคุณได้รับการยืนยันแล้ว!\nพนักงานกำลังเตรียมตัวเพื่อไปดูแลรถของคุณครับ',
        picking_up: '🏍️ พนักงานกำลังมารับรถของคุณแล้ว!\nเตรียมกุญแจไว้ได้เลยครับ',
        washing: '🫧 รถของคุณกำลังถูกล้างอยู่\nอย่างละพิถีพิถัน เดี๋ยวเสร็จแล้วครับ!',
        delivering: '🚗 ล้างเสร็จแล้ว! พนักงานกำลังนำรถกลับ\nเตรียมรอรับรถสุดเงาได้เลยครับ',
        completed: '🎉 ส่งรถเรียบร้อยแล้ว! ขอบคุณที่ใช้บริการ Foami\nอย่าลืมให้คะแนนความพึงพอใจกับเราด้วยนะครับ',
    }

    const PUSH_TITLES: Record<string, string> = {
        confirmed: 'พนักงานรับงานแล้ว! ✅',
        picking_up: 'พนักงานกำลังเดินทาง 🏍️',
        washing: 'กำลังเปลี่ยนรถคุณให้ใหม่ 🫧',
        delivering: 'กำลังส่งคืน 🚗',
        completed: 'ขอบคุณที่ใช้บริการ! 🎉',
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
                title: PUSH_TITLES[status] || 'Foami Service Update',
                body: NOTIFY_STATUSES[status].split('\n')[0], // Use first line for push body
                url: `/${data.branches?.slug || 'menu'}/my-bookings`
            })
        } catch { /* Non-critical */ }
    }

    return NextResponse.json({ booking: data })
}
