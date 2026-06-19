import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * POST /api/bookings/manual
 * Creates a manual booking from the admin panel.
 * Uses service client to bypass RLS.
 * Also locks the staff_schedule slot immediately.
 */
export async function POST(req: NextRequest) {
    const supabase = createServiceClient()

    try {
        const body = await req.json()

        const {
            id: bookingId,
            admin_id,
            customer_name,
            customer_phone,
            vehicle_brand,
            vehicle_model,
            vehicle_color,
            license_plate,
            vehicle_size,
            service_id,
            addon_ids,
            pickup_address,
            delivery_address,
            branch_id,
            zone_id,
            staff_id,
            scheduled_date,
            scheduled_time,
            base_price,
            extra_fee,
            total_price,
            payment_method,
            payment_status,
            customer_note,
            customer_id,
        } = body

        if (!bookingId || !service_id || !scheduled_date || !scheduled_time || !staff_id || !zone_id || !branch_id) {
            return NextResponse.json(
                { error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ (บริการ, วันที่, เวลา, พนักงาน, โซน, สาขา)' },
                { status: 400 }
            )
        }

        // Fetch branch costs configuration
        const { data: branchData, error: branchError } = await supabase
            .from('branches')
            .select('labor_cost_per_job, max_capital_per_job, vehicle_rental_per_job, fuel_cost_per_job')
            .eq('id', branch_id)
            .single()

        if (branchError) {
            console.error('[Manual Booking] Fetch branch error:', branchError)
        }

        const labor_cost = branchData?.labor_cost_per_job || 0
        const capital_cost = branchData?.max_capital_per_job || 0
        const rental_cost = branchData?.vehicle_rental_per_job || 0
        const fuel_cost = branchData?.fuel_cost_per_job || 0

        // Build vehicle_data for storage
        const vehicle_data = {
            vehicle_brand: vehicle_brand || '',
            vehicle_model: vehicle_model || '',
            vehicle_color: vehicle_color || '',
            license_plate: license_plate || '',
            vehicle_size: vehicle_size || 'S',
        }

        // Build a customer note that includes walk-in customer info
        const manualNote = [
            `[Manual Booking]`,
            `ลูกค้า: ${customer_name || '-'}`,
            `เบอร์: ${customer_phone || '-'}`,
            `รถ: ${vehicle_brand || ''} ${vehicle_model || ''} ${vehicle_color || ''} ทะเบียน: ${license_plate || '-'}`,
            customer_note ? `หมายเหตุ: ${customer_note}` : '',
        ].filter(Boolean).join('\n')

        const finalCustomerId = customer_id || `WALKIN-${bookingId}`

        if (!customer_id) {
            const initialVehicle = {
                id: `VH-${bookingId}`,
                vehicle_brand: vehicle_brand || '',
                vehicle_model: vehicle_model || '',
                vehicle_color: vehicle_color || '',
                license_plate: license_plate || '',
                vehicle_size: vehicle_size || 'S'
            }

            // Insert a dummy/walk-in customer record to satisfy foreign key constraint
            const { error: customerError } = await supabase
                .from('customers')
                .insert({
                    id: finalCustomerId,
                    line_user_id: `walkin_${bookingId}`,
                    full_name: customer_name || 'ลูกค้า Walk-in',
                    phone: customer_phone || '',
                    vehicle_brand: vehicle_brand || '',
                    vehicle_model: vehicle_model || '',
                    vehicle_color: vehicle_color || '',
                    license_plate: license_plate || '',
                    vehicle_size: vehicle_size || 'S',
                    saved_vehicles: [initialVehicle],
                    saved_locations: [],
                    interests: [],
                    is_profile_complete: false,
                    reward_claimed: false,
                    created_at: new Date().toISOString()
                })

            if (customerError) {
                console.error('[Manual Booking] Customer Insert error:', customerError)
                return NextResponse.json({ error: `ไม่สามารถบันทึกข้อมูลลูกค้าได้: ${customerError.message}` }, { status: 400 })
            }
        } else if (finalCustomerId.startsWith('WALKIN-')) {
            // Optional: update their details if they changed
            await supabase.from('customers').update({
                full_name: customer_name || 'ลูกค้า Walk-in',
                phone: customer_phone || null,
                vehicle_brand: vehicle_brand || '',
                vehicle_model: vehicle_model || '',
                vehicle_color: vehicle_color || '',
                license_plate: license_plate || '',
                vehicle_size: vehicle_size || 'S',
            }).eq('id', finalCustomerId)
        }

        const todayStr = (() => {
            const now = new Date()
            const thTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
            return thTime.getFullYear() + '-' + String(thTime.getMonth() + 1).padStart(2, '0') + '-' + String(thTime.getDate()).padStart(2, '0')
        })()
        const isPastDate = scheduled_date < todayStr
        const finalStatus = isPastDate ? 'completed' : 'confirmed'

        // Insert booking record
        const { data: bookingData, error: insertError } = await supabase
            .from('bookings')
            .insert({
                id: bookingId,
                customer_id: finalCustomerId,
                staff_id,
                service_id,
                addon_ids: addon_ids || [],
                pickup_lat: 0,
                pickup_lng: 0,
                pickup_address: pickup_address || '',
                delivery_lat: 0,
                delivery_lng: 0,
                delivery_address: delivery_address || pickup_address || '',
                scheduled_date,
                scheduled_time,
                branch_id,
                zone_id,
                extra_fee: extra_fee || 0,
                travel_surcharge: 0,
                different_spot_fee: 0,
                staff_extra_payout: 0,
                base_price: base_price || 0,
                total_price: total_price || 0,
                additional_price: 0,
                discount_code: null,
                discount_amount: 0,
                payment_method: payment_method || 'transfer',
                payment_status: payment_status || 'pending',
                vehicle_data,
                customer_note: manualNote,
                status: finalStatus,
                auto_assigned: false,
                labor_cost: labor_cost,
                capital_cost: capital_cost,
                rental_cost: rental_cost,
                fuel_cost: fuel_cost,
            })
            .select()
            .single()

        if (insertError) {
            console.error('[Manual Booking] Insert error:', insertError)
            return NextResponse.json({ error: insertError.message }, { status: 400 })
        }

        // Write audit log
        try {
            await supabase.from('audit_logs').insert({
                admin_id: admin_id || 'unknown',
                action_type: 'CREATE',
                entity_type: 'booking',
                entity_id: bookingId,
                old_data: null,
                new_data: bookingData,
                description: `สร้างการจองด้วยตนเอง (Manual Booking) ID: ${bookingId} สำหรับลูกค้า: ${customer_name || 'ไม่ระบุชื่อ'}`,
                created_at: new Date().toISOString()
            })
        } catch (auditErr) {
            console.error('[Manual Booking] Failed to track audit log:', auditErr)
        }

        // Lock the staff schedule slot (only if it's not a backdated booking)
        if (!isPastDate) {
            const { error: lockError } = await supabase
                .from('staff_schedules')
                .update({ is_booked: true })
                .eq('staff_id', staff_id)
                .eq('zone_id', zone_id)
                .eq('date', scheduled_date)
                .eq('time_slot', scheduled_time)

            if (lockError) {
                console.error('[Manual Booking] Schedule lock error:', lockError)
                // Non-critical — booking was still created
            }
        }

        console.log(`[Manual Booking] Created booking ${bookingData.id} | Staff: ${staff_id} | ${scheduled_date} ${scheduled_time}`)
        return NextResponse.json({ booking: bookingData }, { status: 201 })

    } catch (e: any) {
        console.error('[Manual Booking] Unexpected error:', e)
        return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
    }
}
