import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''

webpush.setVapidDetails(
    'mailto:admin@foami.th',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
)

export async function POST(req: NextRequest) {
    try {
        const { subscription, title, body, url } = await req.json()

        const payload = JSON.stringify({
            title: title || 'Foami Test',
            body: body || 'นี่คือการทดสอบแจ้งเตือนจาก Foami ครับ',
            url: url || '/'
        })

        await webpush.sendNotification(subscription, payload)

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Push test error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
