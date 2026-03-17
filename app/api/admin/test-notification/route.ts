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

        // Define Cases
        switch (caseId) {
            case 'new_job':
                pushPayload = {
                    title: '🔔 งานใหม่เข้าแล้ว!',
                    body: 'มีงานล้างรถใหม่ในโซนของคุณ รอให้คุณกดรับอยู่ครับ',
                    url: '/staff'
                }
                lineMessages = [{
                    type: 'flex',
                    altText: '🔔 มีงานใหม่รอคุณอยู่!',
                    contents: {
                        type: 'bubble',
                        header: {
                            type: 'box', layout: 'vertical', backgroundColor: '#3B5FCC', paddingAll: '16px',
                            contents: [{ type: 'text', text: '🔔 งานใหม่! รอรับออเดอร์', color: '#FFFFFF', weight: 'bold', size: 'md' }]
                        },
                        body: {
                            type: 'box', layout: 'vertical', paddingAll: '16px',
                            contents: [
                                { type: 'text', text: 'มีงานใหม่ในพื้นที่ของคุณ!\nรีบกดรับก่อนพนักงานคนอื่นนะครับ', wrap: true, size: 'sm' },
                                {
                                    type: 'button', style: 'primary', color: '#3B5FCC', margin: 'lg',
                                    action: { type: 'uri', label: '📋 ดูรายการงาน', uri: `${appUrl}/staff` }
                                }
                            ]
                        }
                    }
                }]
                break

            case 'auto_assign':
                pushPayload = {
                    title: '🚨 ระบบมอบหมายออโต้!',
                    body: 'คุณได้รับมอบหมายงานด่วน กรุณาตรวจสอบรายละเอียดครับ',
                    url: `/staff/jobs/${bookingId || ''}`
                }
                lineMessages = [{
                    type: 'flex',
                    altText: '🚨 มีงานถูกมอบหมายอัตโนมัติ!',
                    contents: {
                        type: 'bubble',
                        header: {
                            type: 'box', layout: 'vertical', backgroundColor: '#E11D48', paddingAll: '16px',
                            contents: [{ type: 'text', text: '🚨 งานด่วน! ระบบมอบหมายออโต้', color: '#FFFFFF', weight: 'bold', size: 'md' }]
                        },
                        body: {
                            type: 'box', layout: 'vertical', paddingAll: '16px',
                            contents: [
                                { type: 'text', text: 'คุณได้รับมอบหมายงานใหม่แบบอัตโนมัติ\nกรุณาเตรียมตัวเข้าให้บริการตามเวลาครับ', wrap: true, size: 'sm' },
                                {
                                    type: 'button', style: 'primary', color: '#E11D48', margin: 'lg',
                                    action: { type: 'uri', label: '📋 ดูรายละเอียดงาน', uri: `${appUrl}/staff/jobs/${bookingId || ''}` }
                                }
                            ]
                        }
                    }
                }]
                break

            case 'accepted':
                pushPayload = {
                    title: 'พนักงานรับงานแล้ว! ✅',
                    body: 'เตรียมตัวรอรับบริการได้เลย พนักงานกำลังเตรียมอุปกรณ์ครับ',
                    url: '/menu/my-bookings'
                }
                lineMessages = [{
                    type: 'flex',
                    altText: '✅ พนักงานรับงานของคุณแล้ว!',
                    contents: {
                        type: 'bubble',
                        header: {
                            type: 'box', layout: 'vertical', backgroundColor: '#F4B8C8', paddingAll: '16px',
                            contents: [{ type: 'text', text: '🫧 ยืนยันพนักงานรับงาน', color: '#1A2340', weight: 'bold', size: 'md' }]
                        },
                        body: {
                            type: 'box', layout: 'vertical', paddingAll: '16px',
                            contents: [
                                { type: 'text', text: 'พนักงานยืนยันการรับงานเรียบร้อยแล้ว\nเตรียมตัวรอรับบริการได้เลยครับ!', wrap: true, size: 'sm', color: '#1A2340' },
                                {
                                    type: 'button', style: 'primary', color: '#3B5FCC', margin: 'lg',
                                    action: { type: 'uri', label: '📦 ดูการจองของฉัน', uri: `${appUrl}/liff/my-bookings` }
                                }
                            ]
                        }
                    }
                }]
                break

            case 'on_the_way':
                pushPayload = {
                    title: 'พนักงานกำลังเดินทาง! 🏍️',
                    body: 'อีกไม่นานพนักงานจะไปถึงที่หมายของคุณครับ',
                    url: '/menu/my-bookings'
                }
                lineMessages = [{
                    type: 'text',
                    text: '🏍️ พนักงาน Foami กำลังเดินทางไปหาคุณแล้วครับ! เตรียมตัวรอรับบริการได้เลย'
                }]
                break

            case 'washing':
                pushPayload = {
                    title: 'เริ่มขั้นตอนการล้างรถ 🫧',
                    body: 'พนักงานกำลังดูแลรถของคุณอย่างประณีตครับ',
                    url: '/menu/my-bookings'
                }
                lineMessages = [{
                    type: 'text',
                    text: '🫧 พนักงานเริ่มขั้นตอนการล้างรถของคุณแล้วครับ! คุณสามารถตรวจสอบสถานะได้ในแอป Foami'
                }]
                break

            case 'completed':
                pushPayload = {
                    title: 'ดูแลรถของคุณเรียบร้อยแล้ว! 🎉',
                    body: 'การล้างรถเสร็จสมบูรณ์ ขอบคุณที่ใช้บริการ Foami ครับ',
                    url: '/menu/my-bookings'
                }
                lineMessages = [{
                    type: 'flex',
                    altText: '🎉 ล้างรถเสร็จเรียบร้อยแล้ว!',
                    contents: {
                        type: 'bubble',
                        header: {
                            type: 'box', layout: 'vertical', backgroundColor: '#3B5FCC', paddingAll: '16px',
                            contents: [{ type: 'text', text: '🎉 บริการเสร็จสิ้น!', color: '#FFFFFF', weight: 'bold', size: 'md' }]
                        },
                        body: {
                            type: 'box', layout: 'vertical', paddingAll: '16px',
                            contents: [
                                { type: 'text', text: 'Foami ดูแลรถของคุณเรียบร้อยแล้วครับ\nหวังว่าจะประทับใจในบริการของเรานะครับ', wrap: true, size: 'sm' },
                                {
                                    type: 'button', style: 'primary', color: '#3B5FCC', margin: 'lg',
                                    action: { type: 'uri', label: '📦 ดูรูปถ่ายและประวัติ', uri: `${appUrl}/liff/my-bookings` }
                                }
                            ]
                        }
                    }
                }]
                break

            case 'extra_fee':
                pushPayload = {
                    title: '💰 แจ้งค่าใช้จ่ายเพิ่มเติม',
                    body: 'มีการเพิ่มรายการค่าบริการเพิ่มเติม (เช่น ล้างถังปั่น) กรุณาตรวจสอบและชำระเงินครับ',
                    url: '/menu/my-bookings'
                }
                lineMessages = [{
                    type: 'text',
                    text: '💰 แจ้งอัปเดตค่าใช้จ่ายเพิ่มเติมครับ!\nเนื่องจากมีการเพิ่มบริการ (เช่น ล้างถัง/ไอเทมพิเศษ)\nรบกวนตรวจสอบรายละเอียดและชำระส่วนต่างในหน้า "การจองของฉัน" นะครับ 🙏'
                }]
                break
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
