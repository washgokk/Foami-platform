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
                            header: {
                                type: 'box', layout: 'vertical',
                                backgroundColor: '#3B5FCC',
                                paddingAll: '16px',
                                contents: [{ type: 'text', text: '🫧 Foami — งานใหม่!', color: '#FFFFFF', weight: 'bold', size: 'lg' }]
                            },
                            body: {
                                type: 'box', layout: 'vertical', paddingAll: '16px',
                                contents: [
                                    { type: 'text', text: message, wrap: true, size: 'sm', color: '#1A2340' },
                                    {
                                        type: 'button', style: 'primary', color: '#3B5FCC',
                                        margin: 'lg',
                                        action: { type: 'uri', label: '📋 ดูรายละเอียดงาน', uri: `${process.env.NEXT_PUBLIC_APP_URL}/staff/jobs/${booking_id}` }
                                    }
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
