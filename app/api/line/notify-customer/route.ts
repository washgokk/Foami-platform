import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const { line_user_id, message, booking_id } = await req.json()
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN

    if (!token) return NextResponse.json({ error: 'No Line token' }, { status: 500 })

    // Get before/after photos if completed
    let photosContent: any[] = []
    if (booking_id) {
        const supabase = createServiceClient()
        const { data: photos } = await supabase
            .from('job_photos')
            .select('type, photo_urls')
            .eq('booking_id', booking_id)

        const afterPhotos = photos?.find(p => p.type === 'after')
        if (afterPhotos?.photo_urls?.length > 0) {
            photosContent = [{
                type: 'image',
                url: afterPhotos.photo_urls[0],
                size: 'full',
                aspectRatio: '20:13',
                aspectMode: 'cover',
            }]
        }
    }

    await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            to: line_user_id,
            messages: [{
                type: 'flex',
                altText: message,
                contents: {
                    type: 'bubble',
                    hero: photosContent.length > 0 ? photosContent[0] : undefined,
                    header: {
                        type: 'box', layout: 'vertical',
                        backgroundColor: '#F4B8C8',
                        paddingAll: '16px',
                        contents: [{ type: 'text', text: '🫧 Foami Wash & Delivery', color: '#1A2340', weight: 'bold', size: 'lg' }]
                    },
                    body: {
                        type: 'box', layout: 'vertical', paddingAll: '16px',
                        contents: [
                            { type: 'text', text: message, wrap: true, size: 'md', color: '#1A2340' },
                            {
                                type: 'button', style: 'primary', color: '#3B5FCC',
                                margin: 'lg',
                                action: { type: 'uri', label: '📦 ดูการจองของฉัน', uri: `${process.env.NEXT_PUBLIC_APP_URL}/liff/my-bookings` }
                            }
                        ]
                    }
                }
            }]
        })
    })

    return NextResponse.json({ sent: true })
}
