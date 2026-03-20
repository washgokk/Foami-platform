import { NextRequest, NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/push'

export async function POST(req: NextRequest) {
    try {
        const { staff_id, title, body, url } = await req.json()
        
        if (!staff_id || !title || !body) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 1. Send Web Push
        await sendPushNotification(staff_id, 'staff', {
            title,
            body,
            url: url || '/staff'
        })

        // 2. [NEW] Send Line Notification (Optional but recommended)
        try {
            const { createServiceClient } = await import('@/lib/supabase')
            const supabase = createServiceClient()
            const { data: staff } = await supabase.from('staff').select('line_user_id').eq('id', staff_id).single()

            if (staff?.line_user_id) {
                // Determine if there's a specific booking_id in the URL
                const bookingIdMatch = url?.match(/\/jobs\/([a-zA-Z0-9-]{36})/)
                const bookingId = bookingIdMatch ? bookingIdMatch[1] : undefined

                await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/line/notify-staff`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        line_user_ids: [staff.line_user_id],
                        message: body,
                        booking_id: bookingId || '00000000-0000-0000-0000-000000000000' // Placeholder if not provided
                    }),
                })
            }
        } catch (lineErr) {
            console.error('Line notification for staff failed:', lineErr)
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Notify staff push error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
