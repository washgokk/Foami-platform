import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push'
import { findMatchingStaffForJob } from '@/lib/staff-matching'

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
    const cutoff = new Date(now.getTime() + 4 * 60 * 60 * 1000) // Extend to 4 hours from now

    // Get pending bookings happening soon
    const { data: pendingBookings } = await supabase
        .from('bookings')
        .select(`
            id, branch_id, zone_id, customer_id, scheduled_date, scheduled_time,
            pickup_lat, pickup_lng, delivery_lat, delivery_lng,
            customers(full_name, line_user_id)
        `)
        .eq('status', 'pending')
        .is('staff_id', null)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })


    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN

    // Caches to avoid redundant DB calls in the loop
    const cache: Record<string, { zones: any[], branch: any, schedules: any[], bookings: any[] }> = {}

    let assigned = 0
    for (const booking of pendingBookings || []) {
        // Robust Thai time parsing
        const timeStr = booking.scheduled_time.includes(':') && booking.scheduled_time.split(':').length === 2 
            ? `${booking.scheduled_time}:00` 
            : booking.scheduled_time
        
        const bookingDt = new Date(`${booking.scheduled_date}T${timeStr}+07:00`)
        if (isNaN(bookingDt.getTime()) || bookingDt > cutoff) continue

        // Load Cache for this Branch + Date
        const cacheKey = `${booking.branch_id}_${booking.scheduled_date}`
        if (!cache[cacheKey]) {
            const [zonesRes, branchRes, schedulesRes, bookingsRes] = await Promise.all([
                supabase.from('zones').select('*').eq('branch_id', booking.branch_id).eq('is_active', true),
                supabase.from('branches').select('*').eq('id', booking.branch_id).single(),
                supabase.from('staff_schedules').select('*, staff(line_user_id)').eq('date', booking.scheduled_date),
                supabase.from('bookings').select('id, scheduled_time, staff_id').eq('scheduled_date', booking.scheduled_date)
            ])
            cache[cacheKey] = {
                zones: zonesRes.data || [],
                branch: branchRes.data,
                schedules: schedulesRes.data || [],
                bookings: bookingsRes.data || []
            }
        }

        const { zones, branch, schedules, bookings } = cache[cacheKey]

        // CRITICAL: Skip if branch data is missing to avoid crashes in matching logic
        if (!branch) {
            console.log(`[Auto-Assign] Skipping booking ${booking.id}: Branch data NOT FOUND for branch_id ${booking.branch_id}`)
            continue
        }

        // Determine if there is a different delivery spot
        const showDelivery = !!(
            booking.delivery_lat && 
            booking.delivery_lng && 
            (booking.delivery_lat !== booking.pickup_lat || booking.delivery_lng !== booking.pickup_lng)
        )

        // Find available staff using SHARED logic
        const matches = findMatchingStaffForJob({
            pickupLat: Number(booking.pickup_lat),
            pickupLng: Number(booking.pickup_lng),
            deliveryLat: Number(booking.delivery_lat),
            deliveryLng: Number(booking.delivery_lng),
            showDelivery,
            zones,
            branch,
            daySchedules: schedules,
            dayBookings: bookings,
            timeSlot: booking.scheduled_time
        })

        if (!matches || matches.length === 0) {
            console.log(`[Auto-Assign] No matching staff found for booking ${booking.id} (Slot: ${booking.scheduled_time}, Zone: ${booking.zone_id})`)
            continue
        }

        // Logic: Pick the best match (lowest fee). 
        // If multiple have same fee, pick first (already sorted by fee in findMatchingStaffForJob)
        const picked = matches[0]

        console.log(`[Auto-Assign] Assigning booking ${booking.id} to staff ${picked.staff_id} (Fee: ${picked.fee})`)

        // Update Booking - Resilient to missing columns
        const updateData: any = {
            staff_id: picked.staff_id,
            status: 'confirmed',
            auto_assigned: true,
            zone_id: picked.base_zone_id,
            updated_at: new Date().toISOString(),
        }

        // Try to include extra reporting fields
        const extraData = {
            travel_surcharge: picked.fee,
            staff_extra_payout: picked.fee * 0.5,
        }

        let { error: updateError } = await supabase.from('bookings').update({ ...updateData, ...extraData }).eq('id', booking.id)

        if (updateError && (updateError as any).code === 'PGRST204') {
            console.warn(`[Auto-Assign] Missing reporting columns, falling back to core update for ${booking.id}`)
            const fallback = await supabase.from('bookings').update(updateData).eq('id', booking.id)
            updateError = fallback.error
        }

        if (updateError) {
            console.error(`[Auto-Assign] Update error for ${booking.id}:`, updateError)
            continue
        }

        // Mark schedule as booked in DB
        await supabase.from('staff_schedules')
            .update({ is_booked: true })
            .eq('staff_id', picked.staff_id)
            .eq('date', booking.scheduled_date)
            .eq('time_slot', booking.scheduled_time)

        // Update local cache to prevent assigning same staff to next booking in the loop
        cache[cacheKey].schedules = cache[cacheKey].schedules.map(s => 
            (s.staff_id === picked.staff_id && s.time_slot === booking.scheduled_time) ? { ...s, is_booked: true } : s
        )
        cache[cacheKey].bookings.push({ ...booking, staff_id: picked.staff_id })

        // --- Notifications ---
        const { data: staffData } = await supabase.from('staff').select('full_name, line_user_id').eq('id', picked.staff_id).single()
        const { NOTIFICATIONS } = await import('@/lib/notifications-config')

        // 1. Notify STAFF
        if (staffData?.line_user_id) {
            const staffUrl = `${process.env.NEXT_PUBLIC_APP_URL}/staff/jobs/${booking.id}`
            fetch('https://api.line.me/v2/bot/message/push', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: staffData.line_user_id,
                    messages: [{
                        type: 'flex', altText: '🚨 มีงานถูกมอบหมายอัตโนมัติ!',
                        contents: {
                            type: 'bubble',
                            header: { type: 'box', layout: 'vertical', backgroundColor: '#E11D48', paddingAll: '16px', contents: [{ type: 'text', text: '🚨 งานด่วน! ระบบมอบหมายออโต้', color: '#FFFFFF', weight: 'bold', size: 'md' }] },
                            body: { type: 'box', layout: 'vertical', paddingAll: '16px', contents: [
                                { type: 'text', text: NOTIFICATIONS.STAFF.AUTO_ASSIGNED.lineMessage(booking.scheduled_date, booking.scheduled_time), wrap: true, size: 'sm' },
                                { type: 'button', style: 'primary', color: '#E11D48', margin: 'lg', action: { type: 'uri', label: '📋 ดูรายละเอียดงาน', uri: staffUrl } }
                            ]}
                        }
                    }]
                })
            }).catch(e => console.error('[Auto-Assign] Line Error:', e))
        }

        sendPushNotification(picked.staff_id, 'staff', {
            title: NOTIFICATIONS.STAFF.AUTO_ASSIGNED.pushTitle,
            body: NOTIFICATIONS.STAFF.AUTO_ASSIGNED.pushBody(booking.scheduled_date, booking.scheduled_time),
            url: `/staff/jobs/${booking.id}`
        }).catch(() => {})

        // 2. Notify CUSTOMER
        const customerLineId = (booking.customers as any)?.line_user_id
        if (customerLineId) {
            try {
                await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-customer`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        line_user_id: customerLineId,
                        message: NOTIFICATIONS.CUSTOMER.AUTO_ASSIGNED.lineMessage(booking.scheduled_date, booking.scheduled_time),
                        booking_id: booking.id, notif_type: 'auto_assigned',
                    }),
                })
            } catch (err) { console.error('Line Customer Error:', err) }
        }

        sendPushNotification(booking.customer_id, 'customer', {
            title: NOTIFICATIONS.CUSTOMER.AUTO_ASSIGNED.pushTitle,
            body: NOTIFICATIONS.CUSTOMER.AUTO_ASSIGNED.pushBody(booking.scheduled_date, booking.scheduled_time),
            url: `/menu/my-bookings`
        }).catch(() => {})

        assigned++
    }

    return NextResponse.json({ assigned, checked: pendingBookings?.length || 0 })
}
