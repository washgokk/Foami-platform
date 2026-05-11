import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push'

export async function POST(req: NextRequest) {
    const body = await req.json()
    const supabase = createServiceClient()

    const {
        customer_id, service_id, addon_ids,
        pickup_lat, pickup_lng, pickup_address,
        delivery_lat, delivery_lng, delivery_address,
        scheduled_date, scheduled_time,
        zone_id, branch_id, extra_fee, base_price, total_price,
        discount_code, discount_amount,
        payment_method, stripe_payment_intent_id, slip_url,
        vehicle_data
    } = body

    // Validate 20-minute buffer (Thai Time)
    const now = new Date()
    const bookingTimeUTC = new Date(`${scheduled_date}T${scheduled_time}:00+07:00`).getTime()
    const cutoffTimeUTC = now.getTime() + (20 * 60 * 1000)

    if (bookingTimeUTC < cutoffTimeUTC) {
        return NextResponse.json({ 
            error: 'ขออภัยครับ เวลานัดหมายต้องล่วงหน้าอย่างน้อย 20 นาที กรุณาเลือกเวลาอื่น' 
        }, { status: 400 })
    }

    const { data, error } = await supabase.from('bookings').insert({
        customer_id, service_id, addon_ids: addon_ids || [],
        pickup_lat, pickup_lng, pickup_address,
        delivery_lat, delivery_lng, delivery_address,
        scheduled_date, scheduled_time,
        zone_id, extra_fee: extra_fee || 0,
        base_price, total_price,
        discount_code: discount_code || null,
        discount_amount: discount_amount || 0,
        payment_method, payment_status: payment_method === 'stripe' ? 'paid' : 'pending',
        stripe_payment_intent_id: stripe_payment_intent_id || null,
        slip_url: slip_url || null,
        vehicle_data: vehicle_data || null,
        status: 'pending',
        auto_assigned: false,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Notify all available staff via Line/Push
    try {
        console.log(`[Booking] New booking ${data.id}. Looking for staff in zone: ${zone_id}, date: ${scheduled_date}, time: ${scheduled_time}`)
        
        // 1. Try to find staff scheduled for this exact slot
        const { data: schedules } = await supabase
            .from('staff_schedules')
            .select('staff_id, staff(full_name, line_user_id)')
            .eq('zone_id', zone_id)
            .eq('date', scheduled_date)
            .eq('time_slot', scheduled_time)
            .eq('is_booked', false)

        let staffIds = schedules?.map((s: any) => s.staff_id).filter(Boolean) || []
        
        // [Fix 3] No more all-branch fallback — if no scheduled staff found, skip notification
        // (Webhook will handle payment-confirmed bookings separately)
        if (staffIds.length === 0) {
            console.log(`[Booking] No scheduled staff found for zone ${zone_id} at ${scheduled_time} on ${scheduled_date}. Skipping notification.`)
        }

        console.log(`[Booking] Notifying staff members:`, staffIds)

        // Fetch Line IDs for these staff
        const { data: staffMembers } = await supabase
            .from('staff')
            .select('id, line_user_id')
            .in('id', staffIds)

        const lineIds = staffMembers?.map((s: any) => s.line_user_id).filter(Boolean) || []

        if (lineIds.length > 0) {
            const { NOTIFICATIONS } = await import('@/lib/notifications-config')
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-staff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    line_user_ids: lineIds,
                    booking_id: data.id,
                    message: NOTIFICATIONS.STAFF.NEW_JOB.lineMessage(scheduled_date, scheduled_time),
                }),
            })
        }

        // Notify via Web Push
        if (staffIds.length > 0) {
            const { NOTIFICATIONS } = await import('@/lib/notifications-config')
            const newJobNotif = NOTIFICATIONS.STAFF.NEW_JOB
            await Promise.all(
                staffIds.map(sId => 
                    sendPushNotification(sId, 'staff', {
                        title: newJobNotif.pushTitle,
                        body: newJobNotif.pushBody(scheduled_date, scheduled_time),
                        url: `/staff`
                    })
                )
            )
        }
    } catch (err) { 
        console.error('Staff notification error:', err)
    }

    return NextResponse.json({ booking: data }, { status: 201 })
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const customer_id = searchParams.get('customer_id')
    const supabase = createServiceClient()

    let q = supabase.from('bookings')
        .select('*, customers(full_name,phone,vehicle_brand,vehicle_model,license_plate), staff(full_name), services(name), zones(name)')
        .order('created_at', { ascending: false })

    if (customer_id) q = q.eq('customer_id', customer_id)

    const { data } = await q
    return NextResponse.json({ bookings: data || [] })
}
