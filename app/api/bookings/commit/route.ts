import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push'

/**
 * POST /api/bookings/commit
 * Server-side booking creation using service client (bypasses RLS).
 * Called from book/page.tsx after Stripe payment succeeds (or for transfer payment).
 * Using service client ensures the insert never fails due to RLS policy issues.
 */
export async function POST(req: NextRequest) {
    const supabase = createServiceClient()

    try {
        const body = await req.json()

        const {
            id: bookingId,
            customer_id,
            service_id,
            addon_ids,
            pickup_lat, pickup_lng, pickup_address,
            delivery_lat, delivery_lng, delivery_address,
            scheduled_date, scheduled_time,
            branch_id,
            zone_id,
            extra_fee,
            travel_surcharge,
            different_spot_fee,
            staff_extra_payout,
            base_price,
            gross_total,      // Full price before discount (for DB record)
            discount_code,
            discount_amount,
            payment_method,
            payment_status,
            stripe_payment_id,
            vehicle_data,
            customer_note,
            package_markup_amount,
            original_base_price,
            labor_cost,
            capital_cost,
            rental_cost,
            fuel_cost,
        } = body

        // Server-side 20-minute time guard (double-check)
        const nowUTC = new Date()
        const bookingTimeUTC = new Date(`${scheduled_date}T${scheduled_time}:00+07:00`).getTime()
        const cutoffUTC = nowUTC.getTime() + (20 * 60 * 1000)
        if (bookingTimeUTC < cutoffUTC) {
            return NextResponse.json({
                error: 'ขออภัยครับ เวลานัดหมายต้องล่วงหน้าอย่างน้อย 20 นาที กรุณาเลือกเวลาอื่น'
            }, { status: 400 })
        }

        // Insert using service client → bypasses all RLS policies
        const { data: bookingData, error: insertError } = await supabase
            .from('bookings')
            .insert({
                id: bookingId,
                customer_id,
                service_id,
                addon_ids: addon_ids || [],
                pickup_lat, pickup_lng, pickup_address,
                delivery_lat, delivery_lng, delivery_address,
                scheduled_date, scheduled_time,
                branch_id,
                zone_id: zone_id || null,
                extra_fee: extra_fee || 0,
                travel_surcharge: travel_surcharge || 0,
                different_spot_fee: different_spot_fee || 0,
                staff_extra_payout: staff_extra_payout || 0,
                base_price,
                total_price: Math.max(0, gross_total - (discount_amount || 0)),       // Store NET (after discount) to prevent double deduction in CRM/Staff
                additional_price: 0,
                is_additional_paid: false,
                discount_code: discount_code || null,
                discount_amount: discount_amount || 0,
                payment_method,
                payment_status: payment_status || 'pending',
                stripe_payment_id: stripe_payment_id || null,
                vehicle_data: vehicle_data || null,
                customer_note: customer_note || null,
                status: 'pending',
                auto_assigned: false,
                package_markup_amount: package_markup_amount || 0,
                original_base_price: original_base_price || 0,
                labor_cost: labor_cost || 0,
                capital_cost: capital_cost || 0,
                rental_cost: rental_cost || 0,
                fuel_cost: fuel_cost || 0,
            })
            .select()
            .single()

        if (insertError) {
            console.error('[Booking Commit] Insert error:', insertError)
            return NextResponse.json({ error: insertError.message }, { status: 400 })
        }

        // Increment discount code usage (server-side — more reliable than client-side)
        if (discount_code && discount_amount > 0) {
            const { data: disc } = await supabase
                .from('discount_codes')
                .select('used_count')
                .eq('code', discount_code.toUpperCase())
                .single()
            if (disc) {
                await supabase
                    .from('discount_codes')
                    .update({ used_count: (disc.used_count || 0) + 1 })
                    .eq('code', discount_code.toUpperCase())
            }
        }

        // Notify zone-matched staff (non-blocking)
        if (zone_id && scheduled_date && scheduled_time) {
            try {
                const { data: schedules } = await supabase
                    .from('staff_schedules')
                    .select('staff_id, staff(line_user_id)')
                    .eq('zone_id', zone_id)
                    .eq('date', scheduled_date)
                    .eq('time_slot', scheduled_time)
                    .eq('is_booked', false)

                const lineIds = schedules?.map((s: any) => s.staff?.line_user_id).filter(Boolean) || []
                const staffIds = schedules?.map((s: any) => s.staff_id).filter(Boolean) || []

                if (lineIds.length > 0) {
                    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-staff`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            line_user_ids: lineIds,
                            booking_id: bookingData.id,
                            message: `🔔 มีงานใหม่!\nวันที่: ${scheduled_date} เวลา: ${scheduled_time?.slice(0, 5)} น.\nกรุณาเปิดแอปเพื่อรับงาน`
                        }),
                    }).catch(() => { })
                }

                if (staffIds.length > 0) {
                    await Promise.all(
                        staffIds.map((sId: string) =>
                            sendPushNotification(sId, 'staff', {
                                title: '🔔 มีงานใหม่เข้า!',
                                body: `วันที่: ${scheduled_date} เวลา: ${scheduled_time?.slice(0, 5)} น.\nกดเพื่อดูรายละเอียดและรับงาน`,
                                url: '/staff'
                            })
                        )
                    )
                }
            } catch (e) {
                console.error('[Booking Commit] Staff notification error:', e)
            }
        }

        console.log(`[Booking Commit] Successfully created booking ${bookingData.id} for customer ${customer_id}`)
        return NextResponse.json({ booking: bookingData }, { status: 201 })

    } catch (e: any) {
        console.error('[Booking Commit] Unexpected error:', e)
        return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
    }
}
