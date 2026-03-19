import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const { line_user_ids, message, booking_id } = await req.json()
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN

    if (!token) return NextResponse.json({ error: 'No Line token' }, { status: 500 })

    const results = await Promise.allSettled(
        line_user_ids.map((userId: string) =>
            fetch('https://api.line.me/v2/bot/message/push', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: userId,
                    messages: [{
                        type: 'flex',
                        altText: message,
                        contents: {
                            type: 'bubble',
                            size: 'mega',
                            header: {
                                type: 'box', layout: 'vertical',
                                backgroundColor: '#1A2340',
                                paddingAll: '20px',
                                contents: [
                                    {
                                        type: 'box', layout: 'horizontal',
                                        contents: [
                                            { type: 'text', text: '🫧', size: 'xl', flex: 0, margin: 'none' },
                                            { type: 'text', text: 'FOAMI STAFF', color: '#FFFFFF', weight: 'bold', size: 'md', margin: 'md', gravity: 'center' }
                                        ]
                                    },
                                    { type: 'text', text: 'ได้รับงานใหม่!', color: '#F1BFDB', size: 'xs', margin: 'xs', weight: 'bold' }
                                ]
                            },
                            body: {
                                type: 'box', layout: 'vertical', paddingAll: '20px', backgroundColor: '#FFFFFF',
                                contents: [
                                    {
                                        type: 'box', layout: 'vertical', spacing: 'sm',
                                        contents: [
                                            { type: 'text', text: 'รายละเอียดการจอง', size: 'xs', color: '#5A6589', weight: 'bold' },
                                            { type: 'text', text: message, wrap: true, size: 'md', color: '#1A2340', weight: 'bold', margin: 'sm' }
                                        ]
                                    },
                                    {
                                        type: 'box', layout: 'vertical', margin: 'xl', spacing: 'sm',
                                        contents: [
                                            {
                                                type: 'button', style: 'primary', color: '#315EC3', height: 'md',
                                                action: { type: 'uri', label: '📋 ตรวจสอบและรับงาน', uri: `${process.env.NEXT_PUBLIC_APP_URL}/staff/jobs/${booking_id}` }
                                            }
                                        ]
                                    }
                                ]
                            },
                            footer: {
                                type: 'box', layout: 'vertical', backgroundColor: '#F8FAFC', paddingAll: 'xs',
                                contents: [
                                    { type: 'text', text: 'Foami Wash & Delivery Service', size: 'xxs', color: '#94A3B8', align: 'center' }
                                ]
                            }
                        }
                    }]
                })
            })
        )
    )

    return NextResponse.json({ sent: results.length })
}
