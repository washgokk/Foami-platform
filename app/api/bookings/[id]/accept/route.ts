import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { staff_id } = await req.json()
    const supabase = createServiceClient()

    // 1. Get booking details to verify zone and time
    const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select('*, customers(full_name, line_user_id), branches(slug)')
        .eq('id', id)
        .single()

    if (fetchError || !booking) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลการจอง' }, { status: 404 })
    }

    if (booking.staff_id) {
        return NextResponse.json({ error: 'งานนี้มีพนักงานรับไปแล้ว' }, { status: 400 })
    }

    // 2. Update booking
    const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
            staff_id, 
            status: 'confirmed',
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    // 3. Mark schedule as booked
    await supabase.from('staff_schedules')
        .update({ is_booked: true })
        .eq('staff_id', staff_id)
        .eq('zone_id', booking.zone_id)
        .eq('date', booking.scheduled_date)
        .eq('time_slot', booking.scheduled_time)

    // 4. Notify Customer via Line
    if (booking.customers?.line_user_id) {
        const { NOTIFICATIONS } = await import('@/lib/notifications-config')
        try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-customer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    line_user_id: booking.customers.line_user_id,
                    message: NOTIFICATIONS.CUSTOMER.ACCEPTED.lineMessage(
                        booking.scheduled_date,
                        booking.scheduled_time
                    ),
                    booking_id: id,
                }),
            })
        } catch { /* Non-critical */ }
    }

    // 5. Notify Customer via Web Push
    const { NOTIFICATIONS } = await import('@/lib/notifications-config')
    try {
        await sendPushNotification(booking.customer_id, 'customer', {
            title: NOTIFICATIONS.CUSTOMER.ACCEPTED.pushTitle,
            body: NOTIFICATIONS.CUSTOMER.ACCEPTED.pushBody(
                booking.scheduled_date,
                booking.scheduled_time
            ),
            url: `/${booking.branches?.slug || 'menu'}/my-bookings`
        })
    } catch { /* Non-critical */ }

    return NextResponse.json({ success: true })
}
