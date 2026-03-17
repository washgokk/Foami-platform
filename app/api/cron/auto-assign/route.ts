import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push'

// Cron: Called every 15 min via Vercel Cron or external scheduler
// Auto-assign staff to bookings that are 2 hours away with no staff
export async function GET(req: NextRequest) {
    // Verify cron secret
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET || 'foami-cron-2025'}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const now = new Date()
    const cutoff = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours from now

    // Get pending bookings happening within 2 hours
    const { data: pendingBookings } = await supabase
        .from('bookings')
        .select('id, zone_id, customer_id, scheduled_date, scheduled_time, customers(full_name, line_user_id)')
        .eq('status', 'pending')
        .is('staff_id', null)

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN

    let assigned = 0
    for (const booking of pendingBookings || []) {
        // Robust Thai time parsing: Append :00 only if seconds are missing, then +07:00
        const timeStr = booking.scheduled_time.includes(':') && booking.scheduled_time.split(':').length === 2 
            ? `${booking.scheduled_time}:00` 
            : booking.scheduled_time
        
        const bookingDt = new Date(`${booking.scheduled_date}T${timeStr}+07:00`)
        
        if (isNaN(bookingDt.getTime())) {
            console.error(`[Auto-Assign] Invalid date for booking ${booking.id}: ${booking.scheduled_date}T${timeStr}+07:00`)
            continue
        }

        if (bookingDt > cutoff) {
            console.log(`[Auto-Assign] Booking ${booking.id} is too far away (${bookingDt.toLocaleString()}). Skipping.`)
            continue
        }

        // Find available staff for this zone/date/time
        const { data: schedules } = await supabase
            .from('staff_schedules')
            .select('staff_id')
            .eq('zone_id', booking.zone_id)
            .eq('date', booking.scheduled_date)
            .eq('time_slot', booking.scheduled_time)
            .eq('is_booked', false)

        if (!schedules || schedules.length === 0) {
            console.log(`[Auto-Assign] No available staff for booking ${booking.id} at ${booking.scheduled_date} ${booking.scheduled_time}`)
            continue
        }

        // Randomly pick one
        const picked = schedules[Math.floor(Math.random() * schedules.length)]

        console.log(`[Auto-Assign] Assigning booking ${booking.id} to staff ${picked.staff_id}`)

        const { error: updateError } = await supabase.from('bookings').update({
            staff_id: picked.staff_id,
            status: 'confirmed',
            auto_assigned: true,
            updated_at: new Date().toISOString(),
        }).eq('id', booking.id)

        if (updateError) {
            console.error(`[Auto-Assign] Failed to update booking ${booking.id}:`, updateError)
            continue
        }

        // Mark schedule as booked
        await supabase.from('staff_schedules')
            .update({ is_booked: true })
            .eq('staff_id', picked.staff_id)
            .eq('zone_id', booking.zone_id)
            .eq('date', booking.scheduled_date)
            .eq('time_slot', booking.scheduled_time)

        // Get staff & customer info for notifications
        const { data: staffData } = await supabase
            .from('staff')
            .select('full_name, line_user_id')
            .eq('id', picked.staff_id)
            .single()

        // 1. Notify STAFF (Urgent)
        if (staffData?.line_user_id) {
            const staffUrl = `${process.env.NEXT_PUBLIC_APP_URL}/staff/jobs/${booking.id}`
            fetch('https://api.line.me/v2/bot/message/push', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: staffData.line_user_id,
                    messages: [{
                        type: 'flex',
                        altText: '🚨 มีงานถูกมอบหมายอัตโนมัติ!',
                        contents: {
                            type: 'bubble',
                            header: {
                                type: 'box', layout: 'vertical', backgroundColor: '#E11D48', paddingAll: '16px',
                                contents: [{ type: 'text', text: '🚨 งานด่วน! ระบบมอบหมายออโต้', color: '#FFFFFF', weight: 'bold', size: 'md' }]
                            },
                            body: {
                                type: 'box', layout: 'vertical', paddingAll: '16px',
                                contents: [
                                    { type: 'text', text: `คุณได้รับมอบหมายงานใหม่\nวันที่: ${booking.scheduled_date}\nเวลา: ${booking.scheduled_time}`, wrap: true, size: 'sm' },
                                    {
                                        type: 'button', style: 'primary', color: '#E11D48', margin: 'lg',
                                        action: { type: 'uri', label: '📋 ดูรายละเอียดงาน', uri: staffUrl }
                                    }
                                ]
                            }
                        }
                    }]
                })
            }).catch(e => console.error('[Auto-Assign] Staff Line Error:', e))
        }

        sendPushNotification(picked.staff_id, 'staff', {
            title: '🚨 งานถูกมอบหมายอัตโนมัติ!',
            body: `วันที่: ${booking.scheduled_date} เวลา: ${booking.scheduled_time}`,
            url: `/staff/jobs/${booking.id}`
        }).catch(() => {})

        // 2. Notify CUSTOMER (Confirmation)
        const customerLineId = (booking.customers as any)?.line_user_id
        if (customerLineId) {
            const customerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/liff/my-bookings`
            fetch('https://api.line.me/v2/bot/message/push', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: customerLineId,
                    messages: [{
                        type: 'flex',
                        altText: '✅ พนักงานรับงานของคุณแล้ว!',
                        contents: {
                            type: 'bubble',
                            header: {
                                type: 'box', layout: 'vertical', backgroundColor: '#F4B8C8', paddingAll: '16px',
                                contents: [{ type: 'text', text: '🫧 ยืนยันพนักงานรับงาน', color: '#1A2340', weight: 'bold', size: 'md' }]
                            },
                            body: {
                                type: 'box', layout: 'vertical', paddingAll: '16px',
                                contents: [
                                    { type: 'text', text: `พนักงานรับงานของคุณแล้ว!\nคุณเตรียมตัวรอรับบริการได้เลยครับ`, wrap: true, size: 'sm', color: '#1A2340' },
                                    {
                                        type: 'button', style: 'primary', color: '#3B5FCC', margin: 'lg',
                                        action: { type: 'uri', label: '📦 ดูการจองของฉัน', uri: customerUrl }
                                    }
                                ]
                            }
                        }
                    }]
                })
            }).catch(e => console.error('[Auto-Assign] Customer Line Error:', e))
        }

        sendPushNotification(booking.customer_id, 'customer', {
            title: 'พนักงานรับงานแล้ว! ✅',
            body: `พนักงานกำลังเตรียมตัวเพื่อไปดูแลรถของคุณในเวลา ${booking.scheduled_time}`,
            url: `/menu/my-bookings`
        }).catch(() => {})

        assigned++
    }

    return NextResponse.json({ assigned, checked: pendingBookings?.length || 0 })
}
