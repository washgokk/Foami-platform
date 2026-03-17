import { NextRequest, NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/push'

export async function POST(req: NextRequest) {
    try {
        const { customer_id, title, body, url } = await req.json()
        
        if (!customer_id || !title || !body) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        await sendPushNotification(customer_id, 'customer', {
            title,
            body,
            url: url || '/menu/my-bookings'
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Notify customer push error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
