import { NextRequest, NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/push'

export async function POST(req: NextRequest) {
    try {
        const body_json = await req.json()
        const { staff_id, staff_ids, title, body, url, payload } = body_json
        
        // Support both nested payload and flat structure
        const finalTitle = title || payload?.title
        const finalBody = body || payload?.body
        const finalUrl = url || payload?.url || '/staff'
        
        const targetIds = staff_ids || (staff_id ? [staff_id] : [])

        if (targetIds.length === 0 || !finalTitle || !finalBody) {
            return NextResponse.json({ error: 'Missing required fields (staff_ids, title, body)' }, { status: 400 })
        }

        const { sendPushNotification } = await import('@/lib/push')
        const { createServiceClient } = await import('@/lib/supabase')
        const supabase = createServiceClient()

        const results = []
        for (const id of targetIds) {
            // 1. Send Web Push
            try {
                await sendPushNotification(id, 'staff', {
                    title: finalTitle,
                    body: finalBody,
                    url: finalUrl
                })
            } catch (err: any) {
                console.error(`Push failed for staff ${id}:`, err)
            }

            // 2. Send Line Notification
            try {
                const { data: staff } = await supabase.from('staff').select('line_user_id').eq('id', id).single()
                if (staff?.line_user_id) {
                    const bookingIdMatch = finalUrl?.match(/\/jobs\/([a-zA-Z0-9-]{36})/)
                    const bookingId = bookingIdMatch ? bookingIdMatch[1] : undefined

                    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-staff`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            line_user_ids: [staff.line_user_id],
                            message: finalBody,
                            booking_id: bookingId || '00000000-0000-0000-0000-000000000000'
                        }),
                    })
                }
            } catch (lineErr) {
                console.error(`Line notification failed for staff ${id}:`, lineErr)
            }
            results.push(id)
        }

        return NextResponse.json({ success: true, notified: results })
    } catch (error: any) {
        console.error('Notify staff push error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
