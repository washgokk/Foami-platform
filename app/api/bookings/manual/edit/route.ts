import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function PUT(req: NextRequest) {
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

        // 1. Fetch old booking to diff schedules
        const { data: oldBooking, error: oldError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', bookingId)
            .single()

        if (oldError || !oldBooking) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลการจองเดิม' }, { status: 404 })
        }

        // Build vehicle_data for storage
        const vehicle_data = {
            vehicle_brand: vehicle_brand || '',
            vehicle_model: vehicle_model || '',
            vehicle_color: vehicle_color || '',
            license_plate: license_plate || '',
            vehicle_size: vehicle_size || 'S',
        }

        const manualNote = [
            `[Manual Booking]`,
            `ลูกค้า: ${customer_name || '-'}`,
            `เบอร์: ${customer_phone || '-'}`,
            `รถ: ${vehicle_brand || ''} ${vehicle_model || ''} ${vehicle_color || ''} ทะเบียน: ${license_plate || '-'}`,
            customer_note ? `หมายเหตุ: ${customer_note}` : '',
        ].filter(Boolean).join('\n')

        // Update customer details if it's a walk-in dummy
        if (customer_id && customer_id.startsWith('WALKIN-')) {
            await supabase.from('customers').update({
                full_name: customer_name || 'Walk-in Customer',
                phone: customer_phone || null,
                vehicle_brand: vehicle_brand || '',
                vehicle_model: vehicle_model || '',
                vehicle_color: vehicle_color || '',
                license_plate: license_plate || '',
                vehicle_size: vehicle_size || 'S',
            }).eq('id', customer_id)
        }

        const todayStr = (() => {
            const tzOffset = 7 * 60 * 60 * 1000
            const localDate = new Date(Date.now() + tzOffset)
            return localDate.toISOString().split('T')[0]
        })()

        const isPastDate = scheduled_date < todayStr

        // 2. Handle staff_schedules if changed
        if (!isPastDate) {
            const scheduleChanged = 
                oldBooking.staff_id !== staff_id || 
                oldBooking.scheduled_date !== scheduled_date || 
                oldBooking.scheduled_time !== scheduled_time || 
                oldBooking.zone_id !== zone_id

            if (scheduleChanged) {
                // Free old slot
                if (oldBooking.scheduled_date >= todayStr) {
                    await supabase
                        .from('staff_schedules')
                        .update({ is_booked: false, booking_id: null })
                        .eq('staff_id', oldBooking.staff_id)
                        .eq('date', oldBooking.scheduled_date)
                        .eq('zone_id', oldBooking.zone_id)
                        .like('time_slot', `${oldBooking.scheduled_time}%`)
                }

                // Lock new slot
                const { data: slots, error: scheduleError } = await supabase
                    .from('staff_schedules')
                    .select('id')
                    .eq('staff_id', staff_id)
                    .eq('date', scheduled_date)
                    .eq('zone_id', zone_id)
                    .like('time_slot', `${scheduled_time}%`)

                if (scheduleError || !slots || slots.length === 0) {
                    return NextResponse.json({ error: 'ไม่พบตารางเวลาของพนักงาน หรือพนักงานไม่ว่างในช่วงเวลานี้' }, { status: 400 })
                }

                const slotIds = slots.map(s => s.id)
                await supabase
                    .from('staff_schedules')
                    .update({ is_booked: true, booking_id: bookingId })
                    .in('id', slotIds)
            }
        }

        // 3. Update the booking
        const updateData = {
            vehicle_data,
            service_id,
            addon_ids: addon_ids || [],
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
            customer_note: manualNote,
            updated_at: new Date().toISOString()
        }

        const { error: bookingError } = await supabase
            .from('bookings')
            .update(updateData)
            .eq('id', bookingId)

        if (bookingError) {
            console.error('[Manual Edit] Booking update error:', bookingError)
            return NextResponse.json({ error: 'ไม่สามารถอัปเดตการจองได้' }, { status: 500 })
        }

        // 4. Record Audit Log
        if (admin_id) {
            try {
                // Fetch admin info
                const { data: adminData } = await supabase.from('admins').select('full_name, role').eq('id', admin_id).single()
                const adminName = adminData?.full_name || 'System'
                const role = adminData?.role || 'admin'
                
                await supabase.from('audit_logs').insert({
                    action_type: 'UPDATE',
                    entity_type: 'booking',
                    entity_id: bookingId,
                    admin_id,
                    admin_name: adminName,
                    role,
                    old_data: oldBooking,
                    new_data: updateData,
                    description: `แก้ไขข้อมูลการจอง (Manual) ${bookingId}`,
                    ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
                    user_agent: req.headers.get('user-agent') || 'unknown'
                })
            } catch (err) {
                console.error('[Manual Edit] Audit log error:', err)
            }
        }

        return NextResponse.json({ success: true, booking: { ...oldBooking, ...updateData }, customer_id })
    } catch (e: any) {
        console.error('[Manual Edit] Unexpected error:', e)
        return NextResponse.json({ error: e.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ' }, { status: 500 })
    }
}
