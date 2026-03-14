import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const body = await req.json()
    const supabase = createServiceClient()

    const {
        customer_id, service_id, addon_ids,
        pickup_lat, pickup_lng, pickup_address,
        delivery_lat, delivery_lng, delivery_address,
        scheduled_date, scheduled_time,
        zone_id, extra_fee, base_price, total_price,
        discount_code, discount_amount,
        payment_method, stripe_payment_intent_id, slip_url,
        vehicle_data
    } = body

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

    // Notify all available staff via Line
    try {
        const { data: schedules } = await supabase
            .from('staff_schedules')
            .select('staff(full_name, line_user_id)')
            .eq('zone_id', zone_id)
            .eq('date', scheduled_date)
            .eq('time_slot', scheduled_time)
            .eq('is_booked', false)

        const lineIds = schedules?.map((s: any) => s.staff?.line_user_id).filter(Boolean) || []
        if (lineIds.length > 0) {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-staff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    line_user_ids: lineIds,
                    booking_id: data.id,
                    message: `🔔 มีงานใหม่!\nวันที่: ${scheduled_date} เวลา: ${scheduled_time}\nกรุณาเปิดแอปเพื่อรับงาน`,
                }),
            })
        }
    } catch { /* Non-critical */ }

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
