import { NextRequest, NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/push'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    try {
        const { targetType, userId, caseId, bookingId } = await req.json()
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
        // ใช้ localhost เมื่อ test locally เพื่อไม่ให้เรียก production
        const internalUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000'

        if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

        const supabase = createServiceClient()
        let lineUserId = ''

        if (targetType === 'staff') {
            const { data } = await supabase.from('staff').select('line_user_id').eq('id', userId).single()
            lineUserId = data?.line_user_id || ''
        } else {
            const { data } = await supabase.from('customers').select('line_user_id').eq('id', userId).single()
            lineUserId = data?.line_user_id || ''
        }

        const { NOTIFICATIONS } = await import('@/lib/notifications-config')

        // Dummy Data for preview
        const d_id     = 'BK-TEST-12345'
        const d_date   = '2024-03-25'
        const d_time   = '10:30'
        const d_amount = 500
        const d_note   = 'ล้างอัดฉีดช่วงล่างพิเศษ'

        let pushPayload = { title: '', body: '', url: '' }
        let lineResult = false

        // ─────────────────────────────────────────────
        // STAFF notifications — still build own flex
        // (staff uses notify-staff route with different templates)
        // ─────────────────────────────────────────────
        if (targetType === 'staff') {
            const staffNotifs = NOTIFICATIONS.STAFF as any
            const n = staffNotifs[caseId.toUpperCase()]
            if (!n) throw new Error(`Staff Case ${caseId} not found in config`)

            let body = ''
            let msgText = ''

            if (typeof n.pushBody === 'function') {
                if (['new_job', 'reminder', 'auto_assigned', 'upcoming_job'].includes(caseId)) {
                    body = n.pushBody(d_date, d_time)
                } else if (['cancelled', 'rescheduled'].includes(caseId)) {
                    body = n.pushBody(d_id, d_date, d_time)
                } else if (caseId === 'paid_extra') {
                    body = n.pushBody(d_id, d_amount)
                }
            } else {
                body = n.pushBody
            }

            if (typeof n.lineMessage === 'function') {
                if (['new_job', 'reminder', 'auto_assigned', 'upcoming_job'].includes(caseId)) {
                    msgText = n.lineMessage(d_date, d_time)
                } else if (['cancelled', 'rescheduled'].includes(caseId)) {
                    msgText = n.lineMessage(d_id, d_date, d_time)
                } else if (caseId === 'paid_extra') {
                    msgText = n.lineMessage(d_id, d_amount)
                }
            } else {
                msgText = n.lineMessage || ''
            }

            pushPayload = {
                title: n.pushTitle,
                body,
                url: ['new_job', 'reminder'].includes(caseId) ? '/staff' : `/staff/jobs/${d_id}`
            }

            // Staff LINE — simple branded flex
            if (lineUserId && token) {
                const res = await fetch('https://api.line.me/v2/bot/message/push', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: lineUserId,
                        messages: [{
                            type: 'flex',
                            altText: n.pushTitle,
                            contents: {
                                type: 'bubble', size: 'mega',
                                header: {
                                    type: 'box', layout: 'vertical',
                                    backgroundColor: '#1A2340', paddingAll: '20px',
                                    contents: [
                                        { type: 'text', text: '🫧', size: 'xxl', align: 'center' },
                                        { type: 'text', text: 'FOAMI', size: 'xs', weight: 'bold', color: '#A0D9F6', align: 'center', letterSpacing: '6px', margin: 'xs' },
                                        { type: 'separator', margin: 'md', color: 'rgba(160,217,246,0.3)' },
                                        { type: 'text', text: n.pushTitle, color: '#FFFFFF', weight: 'bold', size: 'lg', margin: 'md', align: 'center', wrap: true },
                                    ],
                                },
                                body: {
                                    type: 'box', layout: 'vertical', paddingAll: '20px', backgroundColor: '#FFFFFF',
                                    contents: [
                                        {
                                            type: 'box', layout: 'vertical',
                                            backgroundColor: '#EFF3FD', cornerRadius: '16px', paddingAll: '16px',
                                            contents: [
                                                { type: 'text', text: msgText, wrap: true, size: 'sm', color: '#5A6589' },
                                            ],
                                        },
                                        {
                                            type: 'button', style: 'primary', color: '#315EC3', margin: 'lg',
                                            cornerRadius: '16px',
                                            action: { type: 'uri', label: '📋 ดูรายละเอียด', uri: `${appUrl}${pushPayload.url}` }
                                        }
                                    ],
                                },
                            }
                        }]
                    })
                })
                lineResult = res.ok
            }

        // ─────────────────────────────────────────────
        // CUSTOMER notifications — delegate ไปที่
        // /api/line/notify-customer ซึ่งมี template ที่สวยครบ
        // ─────────────────────────────────────────────
        } else {
            const custNotifs = NOTIFICATIONS.CUSTOMER as any
            const n = custNotifs[caseId.toUpperCase()]
            if (!n) throw new Error(`Customer Case ${caseId} not found in config`)

            let body = ''
            let msgText = ''

            // Generate push body
            if (typeof n.pushBody === 'function') {
                if (['accepted', 'auto_assigned'].includes(caseId)) {
                    body = n.pushBody(d_date, d_time)
                } else if (caseId === 'payment_pending') {
                    body = n.pushBody(d_amount)
                } else {
                    body = n.pushBody(d_date, d_time)
                }
            } else {
                body = n.pushBody || ''
            }

            // Generate LINE message text — handle all cases
            if (typeof n.lineMessage === 'function') {
                if (['accepted', 'auto_assigned', 'confirmed', 'picking_up', 'washing', 'delivering', 'upcoming_job'].includes(caseId)) {
                    msgText = n.lineMessage(d_date, d_time)
                } else if (caseId === 'payment_pending') {
                    msgText = n.lineMessage(d_amount, d_note)
                } else {
                    msgText = n.lineMessage(d_date, d_time)
                }
            } else {
                // lineMessage is a plain string
                msgText = n.lineMessage || ''
            }

            pushPayload = {
                title: typeof n.pushTitle === 'function' ? n.pushTitle(d_date, d_time) : (n.pushTitle || ''),
                body,
                url: '/menu/my-bookings'
            }

            // Map caseId → notif_type ที่ /api/line/notify-customer รองรับ
            const notifTypeMap: Record<string, string> = {
                confirmed:       'confirmed',
                completed:       'completed',
                payment_pending: 'payment_pending',
                accepted:        'confirmed',
                auto_assigned:   'confirmed',
                picking_up:      'picking_up',
                washing:         'washing',
                delivering:      'delivering',
            }
            const notif_type = notifTypeMap[caseId] ?? 'generic'

            // ✅ เรียก LINE API โดยตรงด้วย token จาก env (ไม่ผ่าน HTTP fetch ไปหา appUrl)
            if (lineUserId && token) {
                const res = await fetch(`${internalUrl}/api/line/notify-customer`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        line_user_id: lineUserId,
                        message: msgText,
                        booking_id: bookingId || null,
                        notif_type,
                        branch_slug: 'menu',
                    }),
                })

                if (!res.ok) {
                    const errText = await res.text()
                    console.error('[Test Noti] LINE delegate failed:', errText)
                }
                lineResult = res.ok
            }
        }

        // Send Web Push
        const pushResult = await sendPushNotification(userId, targetType, pushPayload)

        return NextResponse.json({ push: pushResult, line: lineResult })
    } catch (err: any) {
        console.error('[Test Noti] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
