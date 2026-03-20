import { NextRequest, NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/push'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    try {
        const { targetType, userId, caseId, bookingId } = await req.json()
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN

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

        const appUrl = process.env.NEXT_PUBLIC_APP_URL

        let pushPayload = { title: '', body: '', url: '' }
        let lineMessages: any[] = []

        const { NOTIFICATIONS } = await import('@/lib/notifications-config')
        
        // Dummy Data
        const d_id = 'BK-TEST-12345'
        const d_date = '2024-03-25'
        const d_time = '10:30'
        const d_amount = 500
        const d_note = 'ล้างอัดฉีดช่วงล่างพิเศษ'

        // Define Cases Dynamically
        if (targetType === 'staff') {
            const staffNotifs = NOTIFICATIONS.STAFF as any
            const n = staffNotifs[caseId.toUpperCase()]
            if (!n) throw new Error(`Staff Case ${caseId} not found in config`)

            let body = ''
            let msgText = ''

            if (typeof n.pushBody === 'function') {
                if (caseId === 'new_job' || caseId === 'reminder' || caseId === 'auto_assigned') {
                    body = n.pushBody(d_date, d_time)
                } else if (caseId === 'cancelled' || caseId === 'rescheduled') {
                    body = n.pushBody(d_id, d_date, d_time)
                } else if (caseId === 'paid_extra') {
                    body = n.pushBody(d_id, d_amount)
                }
            } else {
                body = n.pushBody
            }

            if (typeof n.lineMessage === 'function') {
                if (caseId === 'new_job' || caseId === 'reminder' || caseId === 'auto_assigned') {
                    msgText = n.lineMessage(d_date, d_time)
                } else if (caseId === 'cancelled' || caseId === 'rescheduled') {
                    msgText = n.lineMessage(d_id, d_date, d_time)
                } else if (caseId === 'paid_extra') {
                    msgText = n.lineMessage(d_id, d_amount)
                }
            } else {
                msgText = n.lineMessage
            }

            pushPayload = {
                title: n.pushTitle,
                body,
                url: caseId === 'new_job' || caseId === 'reminder' ? '/staff' : `/staff/jobs/${d_id}`
            }

            lineMessages = [{
                type: 'flex',
                altText: n.pushTitle,
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box', layout: 'vertical', backgroundColor: '#1A2340', paddingAll: '16px',
                        contents: [{ type: 'text', text: n.pushTitle, color: '#FFFFFF', weight: 'bold', size: 'md' }]
                    },
                    body: {
                        type: 'box', layout: 'vertical', paddingAll: '16px',
                        contents: [
                            { type: 'text', text: msgText, wrap: true, size: 'sm' },
                            {
                                type: 'button', style: 'primary', color: '#315EC3', margin: 'lg',
                                action: { type: 'uri', label: '📋 ดูรายละเอียด', uri: `${appUrl}${pushPayload.url}` }
                            }
                        ]
                    }
                }
            }]
        } else {
            const custNotifs = NOTIFICATIONS.CUSTOMER as any
            const n = custNotifs[caseId.toUpperCase()]
            if (!n) throw new Error(`Customer Case ${caseId} not found in config`)

            let body = ''
            let msgText = ''

            if (typeof n.pushBody === 'function') {
                if (caseId === 'accepted' || caseId === 'auto_assigned') {
                    body = n.pushBody(d_date, d_time)
                } else if (caseId === 'payment_pending') {
                    body = n.pushBody(d_amount)
                }
            } else {
                body = n.pushBody
            }

            if (typeof n.lineMessage === 'function') {
                if (caseId === 'accepted' || caseId === 'auto_assigned') {
                    msgText = n.lineMessage(d_date, d_time)
                } else if (caseId === 'payment_pending') {
                    msgText = n.lineMessage(d_amount, d_note)
                } else {
                    msgText = n.lineMessage()
                }
            } else {
                msgText = n.lineMessage
            }

            pushPayload = {
                title: n.pushTitle,
                body,
                url: '/menu/my-bookings'
            }
            
            // Re-use the beautiful Flex structures from notify-customer logic but with centralized text
            if (caseId === 'completed') {
                lineMessages = [{
                    type: 'flex', altText: n.pushTitle,
                    contents: {
                        type: 'bubble', size: 'mega',
                        header: {
                            type: 'box', layout: 'vertical', backgroundColor: '#1A2340', paddingAll: '20px',
                            contents: [{ type: 'text', text: n.pushTitle, color: '#FFFFFF', weight: 'bold', size: 'md' }]
                        },
                        body: {
                            type: 'box', layout: 'vertical', paddingAll: '20px', backgroundColor: '#FFFFFF', spacing: 'md',
                            contents: [
                                { type: 'text', text: msgText, wrap: true, size: 'sm', color: '#1A2340' },
                                {
                                    type: 'button', style: 'primary', color: '#315EC3', margin: 'lg', height: 'sm',
                                    action: { type: 'uri', label: '⭐ ให้คะแนน & รีวิวงาน', uri: `${appUrl}/liff/my-bookings` }
                                }
                            ]
                        }
                    }
                }]
            } else if (caseId === 'payment_pending') {
                lineMessages = [{
                    type: 'flex', altText: n.pushTitle,
                    contents: {
                        type: 'bubble', size: 'mega',
                        header: {
                            type: 'box', layout: 'vertical', backgroundColor: '#315EC3', paddingAll: '20px',
                            contents: [{ type: 'text', text: n.pushTitle, color: '#FFFFFF', weight: 'bold', size: 'md' }]
                        },
                        body: {
                            type: 'box', layout: 'vertical', paddingAll: '20px', backgroundColor: '#FFFFFF',
                            contents: [
                                { type: 'text', text: msgText, wrap: true, size: 'md', color: '#1A2340', weight: 'bold' },
                                {
                                    type: 'button', style: 'primary', color: '#315EC3', margin: 'xl',
                                    action: { type: 'uri', label: '💰 ไปที่หน้าชำระเงิน', uri: `${appUrl}/liff/my-bookings` }
                                }
                            ]
                        }
                    }
                }]
            } else {
                lineMessages = [{
                    type: 'flex', altText: n.pushTitle,
                    contents: {
                        type: 'bubble', size: 'mega',
                        header: {
                            type: 'box', layout: 'vertical', backgroundColor: '#F1BFDB', paddingAll: '16px',
                            contents: [{ type: 'text', text: '🫧 Foami Update', color: '#1A2340', weight: 'bold', size: 'md', align: 'center' }]
                        },
                        body: {
                            type: 'box', layout: 'vertical', paddingAll: '20px',
                            contents: [{ type: 'text', text: msgText, wrap: true, size: 'md', color: '#1A2340', align: 'center' }]
                        },
                        footer: {
                            type: 'box', layout: 'vertical', paddingAll: 'md',
                            contents: [{
                                type: 'button', style: 'secondary', color: '#1A2340', height: 'sm',
                                action: { type: 'uri', label: 'ดูรายละเอียดการจอง', uri: `${appUrl}/liff/my-bookings` }
                            }]
                        }
                    }
                }]
            }
        }
        // Send Push
        const pushResult = await sendPushNotification(userId, targetType, pushPayload)

        // Send Line
        let lineResult = false
        if (lineUserId && token) {
            const res = await fetch('https://api.line.me/v2/bot/message/push', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: lineUserId, messages: lineMessages })
            })
            lineResult = res.ok
        }

        return NextResponse.json({ push: pushResult, line: lineResult })
    } catch (err: any) {
        console.error('[Test Noti] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
