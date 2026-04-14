import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push'

// ─── GET: Fetch message history ───────────────────────────────
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const bookingId = searchParams.get('bookingId')

    if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
        .from('booking_messages')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true })
        .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ messages: data })
}

// ─── POST: Send a message + notifications ─────────────────────
export async function POST(req: NextRequest) {
    const body = await req.json()
    const { booking_id, sender_type, sender_id, sender_name, message, image_url } = body

    if (!booking_id || !sender_type || !sender_id || (!message?.trim() && !image_url)) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 1. Insert message
    const { data: msg, error: insertError } = await supabase
        .from('booking_messages')
        .insert({ 
            booking_id, 
            sender_type, 
            sender_id, 
            sender_name, 
            message: message?.trim() || null,
            image_url: image_url || null
        })
        .select()
        .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    // 2. Fetch booking for notification targets
    const { data: booking } = await supabase
        .from('bookings')
        .select('customer_id, staff_id, branch_id, scheduled_date, scheduled_time, customers(full_name, line_user_id, id), staff(full_name, id), branches(slug)')
        .eq('id', booking_id)
        .single()

    if (!booking) return NextResponse.json({ message: msg })

    const { NOTIFICATIONS } = await import('@/lib/notifications-config')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const branchSlug = (booking.branches as any)?.slug || 'menu'
    
    // Notification Text Helper
    const contentPreview = image_url ? '📷 [ส่งรูปภาพ]' : message

    // ─── Notify CUSTOMER when staff or admin sends ───────────
    if (sender_type === 'staff' || sender_type === 'admin') {
        const customerId = booking.customer_id
        const customer = booking.customers as any
        const staffName = (booking.staff as any)?.full_name || sender_name || 'พนักงาน'

        const pushBody = NOTIFICATIONS.CUSTOMER.CHAT.pushBody(staffName, contentPreview)

        // Web Push to customer
        if (customerId) {
            sendPushNotification(customerId, 'customer', {
                title: NOTIFICATIONS.CUSTOMER.CHAT.pushTitle,
                body: pushBody,
                url: `/${branchSlug}/my-bookings`
            }).catch(() => { })
        }

        // LINE to customer
        if (customer?.line_user_id) {
            const lineMsg = NOTIFICATIONS.CUSTOMER.CHAT.lineMessage(staffName, contentPreview, booking_id, branchSlug)
            const bookingUrl = `${appUrl}/${branchSlug}/my-bookings`
            sendLineChat(customer.line_user_id, pushBody, bookingUrl, lineMsg).catch(() => { })
        }
    }

    // ─── Notify STAFF when customer or admin sends ────────────
    if (sender_type === 'customer' || sender_type === 'admin') {
        const staffId = booking.staff_id
        const customerName = (booking.customers as any)?.full_name || sender_name || 'ลูกค้า'

        if (staffId) {
            const pushBody = NOTIFICATIONS.STAFF.CHAT.pushBody(customerName, contentPreview)
            sendPushNotification(staffId, 'staff', {
                title: NOTIFICATIONS.STAFF.CHAT.pushTitle,
                body: pushBody,
                url: `/staff/jobs/${booking_id}`
            }).catch(() => { })
        }
    }

    return NextResponse.json({ message: msg })
}

// ─── Helper: Send LINE Flex message for chat ──────────────────
async function sendLineChat(lineUserId: string, altText: string, bookingUrl: string, message: string) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!token) return

    const flexContent = {
        type: 'bubble', size: 'mega',
        header: {
            type: 'box', layout: 'vertical', backgroundColor: '#1A2340', paddingAll: '16px',
            contents: [
                { type: 'text', text: '💬 ข้อความใหม่จากพนักงาน', color: '#FFFFFF', weight: 'bold', size: 'sm' }
            ]
        },
        body: {
            type: 'box', layout: 'vertical', paddingAll: '20px', backgroundColor: '#FFFFFF',
            contents: [
                { type: 'text', text: message, wrap: true, size: 'sm', color: '#1A2340' }
            ]
        },
        footer: {
            type: 'box', layout: 'vertical', paddingAll: '12px',
            contents: [
                {
                    type: 'button', style: 'primary', color: '#315EC3', height: 'sm',
                    action: { type: 'uri', label: '💬 ดูและตอบกลับ', uri: bookingUrl }
                }
            ]
        }
    }

    await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            to: lineUserId,
            messages: [{ type: 'flex', altText, contents: flexContent }]
        })
    })
}
