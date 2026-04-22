import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// ─── Brand Colors (hex only — no rgba for LINE) ──────────
const C = {
    navy:      '#1A2340',
    blue:      '#315EC3',
    blueLight: '#A0D9F6',
    blueBg:    '#EFF3FD',
    pink:      '#F1BFDB',
    pinkDark:  '#E6A0C8',
    white:     '#FFFFFF',
    gray:      '#F0F3FC',
    grayText:  '#5A6589',
    mutedText: '#9AA5C4',
    warning:   '#F59E0B',
    border:    '#DDE3F5',
}

export async function POST(req: NextRequest) {
    const { line_user_id, message, booking_id, notif_type, branch_slug = 'menu' } = await req.json()
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN

    if (!token) return NextResponse.json({ error: 'No Line token' }, { status: 500 })

    const baseUrl    = process.env.NEXT_PUBLIC_APP_URL || ''
    const bookingUrl = `${baseUrl}/${branch_slug}/my-bookings`
    const reviewUrl  = `${baseUrl}/${branch_slug}/my-bookings?booking_id=${booking_id}`

    // ─── Fetch Job Photos (for completed) ───────────────
    let beforePhoto = ''
    let afterPhoto  = ''
    if (booking_id && notif_type === 'completed') {
        const supabase = createServiceClient()
        const { data: photos } = await supabase
            .from('job_photos')
            .select('type, photo_urls')
            .eq('booking_id', booking_id)
        beforePhoto = photos?.find(p => p.type === 'before')?.photo_urls?.[0] || ''
        afterPhoto  = photos?.find(p => p.type === 'after')?.photo_urls?.[0]  || ''
    }

    let flexContent: any = {}

    // ════════════════════════════════════════════════════
    // 1. CONFIRMED — ยืนยันการจอง
    // ════════════════════════════════════════════════════
    if (notif_type === 'confirmed') {
        flexContent = {
            type: 'bubble',
            size: 'mega',
            header: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '20px',
                backgroundColor: C.blue,
                contents: [
                    { type: 'text', text: 'Foami Wash & Delivery', size: 'sm', weight: 'bold', color: C.blueLight, align: 'center' },
                    { type: 'separator', margin: 'md', color: '#4A72D5' },
                    { type: 'text', text: 'ยืนยันการจองเรียบร้อย! ✅', size: 'lg', weight: 'bold', color: C.white, align: 'center', margin: 'md', wrap: true },
                    { type: 'text', text: 'เราได้รับคำสั่งและพร้อมดูแลอย่างพิถีพิถัน', size: 'xs', color: C.blueLight, align: 'center', margin: 'xs', wrap: true },
                ],
            },
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '20px',
                backgroundColor: C.white,
                spacing: 'md',
                contents: [
                    {
                        type: 'box',
                        layout: 'vertical',
                        backgroundColor: C.blueBg,
                        cornerRadius: '12px',
                        paddingAll: '16px',
                        contents: [
                            { type: 'text', text: 'สถานะการจอง', size: 'xxs', color: C.mutedText, weight: 'bold' },
                            { type: 'text', text: 'ยืนยันแล้ว — รอดำเนินการ', size: 'sm', weight: 'bold', color: C.blue, margin: 'xs', wrap: true },
                            { type: 'separator', margin: 'md', color: C.border },
                            { type: 'text', text: message, size: 'sm', color: C.grayText, wrap: true, margin: 'md' },
                        ],
                    },
                    { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [{ type: 'text', text: '🏍️', size: 'sm', flex: 0 }, { type: 'text', text: 'พนักงานจะเดินทางมาตามเวลาที่กำหนด', size: 'xs', color: C.grayText, flex: 1, wrap: true }] },
                    { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [{ type: 'text', text: '📋', size: 'sm', flex: 0 }, { type: 'text', text: 'เตรียมกุญแจรถและจุดจอดไว้รอได้เลยครับ', size: 'xs', color: C.grayText, flex: 1, wrap: true }] },
                ],
            },
            footer: {
                type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: C.white,
                contents: [{ type: 'button', style: 'primary', color: C.blue, height: 'md', action: { type: 'uri', label: '📋 ดูรายละเอียดการจอง', uri: bookingUrl } }],
            },
        }

    // ════════════════════════════════════════════════════
    // 2. PAYMENT PENDING — รอชำระส่วนต่าง
    // ════════════════════════════════════════════════════
    } else if (notif_type === 'payment_pending') {
        flexContent = {
            type: 'bubble',
            size: 'mega',
            header: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '20px',
                backgroundColor: C.warning,
                contents: [
                    { type: 'text', text: 'Foami Wash & Delivery', size: 'sm', weight: 'bold', color: C.white, align: 'center' },
                    { type: 'separator', margin: 'md', color: '#E08900' },
                    { type: 'text', text: 'มียอดชำระเพิ่มเติม 💳', size: 'lg', weight: 'bold', color: C.white, align: 'center', margin: 'md' },
                    { type: 'text', text: 'กรุณาตรวจสอบและชำระก่อนรับรถคืนครับ', size: 'xs', color: C.white, align: 'center', wrap: true, margin: 'xs' },
                ],
            },
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '20px',
                backgroundColor: C.white,
                spacing: 'md',
                contents: [
                    {
                        type: 'box',
                        layout: 'vertical',
                        backgroundColor: '#FFFBEB',
                        cornerRadius: '12px',
                        paddingAll: '16px',
                        contents: [
                            { type: 'text', text: 'รายละเอียดยอดชำระ', size: 'xxs', color: C.mutedText, weight: 'bold' },
                            { type: 'separator', margin: 'sm', color: C.border },
                            { type: 'text', text: message, size: 'sm', color: C.navy, wrap: true, margin: 'sm' },
                        ],
                    },
                    { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [{ type: 'text', text: '⚡', size: 'sm', flex: 0 }, { type: 'text', text: 'ชำระแล้วพนักงานจะนำรถส่งคืนทันที', size: 'xs', color: C.grayText, flex: 1, wrap: true }] },
                ],
            },
            footer: {
                type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: C.white,
                contents: [{ type: 'button', style: 'primary', color: C.warning, height: 'md', action: { type: 'uri', label: '💰 ไปชำระเงิน', uri: bookingUrl } }],
            },
        }

    // ════════════════════════════════════════════════════
    // 3. COMPLETED — งานเสร็จแล้ว
    // ════════════════════════════════════════════════════
    } else if (notif_type === 'completed') {
        const hasPhotos = !!(beforePhoto && afterPhoto)
        const photoSection = hasPhotos ? [
            {
                type: 'box', layout: 'horizontal', spacing: 'md',
                contents: [
                    { type: 'box', layout: 'vertical', flex: 1, spacing: 'xs', contents: [{ type: 'box', layout: 'vertical', backgroundColor: C.gray, cornerRadius: '6px', paddingAll: '4px', contents: [{ type: 'text', text: 'BEFORE', size: 'xxs', color: C.mutedText, weight: 'bold', align: 'center' }] }, { type: 'image', url: beforePhoto, size: 'full', aspectRatio: '4:3', aspectMode: 'cover', cornerRadius: 'md' }] },
                    { type: 'box', layout: 'vertical', flex: 1, spacing: 'xs', contents: [{ type: 'box', layout: 'vertical', backgroundColor: C.blue, cornerRadius: '6px', paddingAll: '4px', contents: [{ type: 'text', text: 'AFTER', size: 'xxs', color: C.white, weight: 'bold', align: 'center' }] }, { type: 'image', url: afterPhoto, size: 'full', aspectRatio: '4:3', aspectMode: 'cover', cornerRadius: 'md' }] },
                ],
            },
            { type: 'separator', margin: 'md', color: C.border },
        ] : []

        flexContent = {
            type: 'bubble',
            size: 'mega',
            header: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '20px',
                backgroundColor: C.navy,
                contents: [
                    { type: 'text', text: 'Foami Wash & Delivery', size: 'sm', weight: 'bold', color: C.pink, align: 'center' },
                    { type: 'separator', margin: 'md', color: '#2A3560' },
                    { type: 'text', text: 'งานเสร็จเรียบร้อย! 🎉', size: 'lg', weight: 'bold', color: C.white, align: 'center', margin: 'md' },
                    { type: 'text', text: 'ขอบคุณที่ไว้วางใจ Foami ดูแลรถของคุณครับ', size: 'xs', color: C.pink, align: 'center', wrap: true, margin: 'xs' },
                ],
            },
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '16px',
                backgroundColor: C.white,
                spacing: 'md',
                contents: [
                    ...photoSection,
                    { type: 'text', text: message, size: 'sm', color: C.grayText, wrap: true, align: 'center' },
                    {
                        type: 'box', layout: 'vertical', backgroundColor: '#FFF5F9', cornerRadius: '12px', paddingAll: '14px', margin: 'sm',
                        contents: [
                            { type: 'text', text: '⭐⭐⭐⭐⭐', size: 'xl', align: 'center' },
                            { type: 'text', text: 'พอใจกับบริการไหมครับ? รีวิวสั้นๆ ช่วยเราได้มาก', size: 'xs', color: C.pinkDark, align: 'center', wrap: true, margin: 'xs' },
                        ],
                    },
                ],
            },
            footer: {
                type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: C.white,
                contents: [{ type: 'button', style: 'primary', color: C.navy, height: 'md', action: { type: 'uri', label: '⭐ ให้คะแนน & รีวิวงาน', uri: reviewUrl } }],
            },
        }

    // ════════════════════════════════════════════════════
    // 4. PICKING UP — พนักงานกำลังมารับรถ
    // ════════════════════════════════════════════════════
    } else if (notif_type === 'picking_up') {
        flexContent = {
            type: 'bubble',
            size: 'mega',
            header: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '20px',
                backgroundColor: C.blue,
                contents: [
                    { type: 'text', text: 'Foami Wash & Delivery', size: 'sm', weight: 'bold', color: C.blueLight, align: 'center' },
                    { type: 'separator', margin: 'md', color: '#4A72D5' },
                    { type: 'text', text: 'พนักงานกำลังเดินทาง 🏍️', size: 'lg', weight: 'bold', color: C.white, align: 'center', margin: 'md' },
                    { type: 'text', text: 'กำลังออกเดินทางมารับรถของคุณแล้วครับ', size: 'xs', color: C.blueLight, align: 'center', wrap: true, margin: 'xs' },
                ],
            },
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '20px',
                backgroundColor: C.white,
                spacing: 'md',
                contents: [
                    {
                        type: 'box',
                        layout: 'vertical',
                        backgroundColor: C.blueBg,
                        cornerRadius: '12px',
                        paddingAll: '16px',
                        contents: [
                            { type: 'text', text: 'สถานะปัจจุบัน', size: 'xxs', color: C.mutedText, weight: 'bold' },
                            { type: 'text', text: 'กำลังรับรถ — ขั้นตอนที่ 1/3', size: 'sm', weight: 'bold', color: C.blue, margin: 'xs', wrap: true },
                            { type: 'separator', margin: 'md', color: C.border },
                            { type: 'text', text: message, size: 'sm', color: C.grayText, wrap: true, margin: 'md' },
                        ],
                    },
                    // Journey visual card
                    {
                        type: 'box', layout: 'vertical', backgroundColor: C.blueBg, cornerRadius: '12px', paddingAll: '14px',
                        contents: [
                            { type: 'text', text: 'เส้นทางการให้บริการ', size: 'xxs', color: C.mutedText, weight: 'bold' },
                            { type: 'separator', margin: 'sm', color: C.border },
                            {
                                type: 'box', layout: 'horizontal', margin: 'md', contents: [
                                    { type: 'box', layout: 'vertical', flex: 1, contents: [{ type: 'text', text: '🏍️', size: 'xl', align: 'center' }, { type: 'text', text: 'พนักงาน', size: 'xxs', color: C.blue, align: 'center', weight: 'bold', margin: 'xs' }] },
                                    { type: 'box', layout: 'vertical', flex: 1, justifyContent: 'center', contents: [{ type: 'text', text: '─────→', size: 'sm', color: C.blue, align: 'center' }] },
                                    { type: 'box', layout: 'vertical', flex: 1, contents: [{ type: 'text', text: '📍', size: 'xl', align: 'center' }, { type: 'text', text: 'รถของคุณ', size: 'xxs', color: C.navy, align: 'center', weight: 'bold', margin: 'xs' }] },
                                ],
                            },
                        ],
                    },
                    { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [{ type: 'text', text: '🔑', size: 'sm', flex: 0 }, { type: 'text', text: 'กรุณาเตรียมกุญแจรถไว้ให้พร้อมนะครับ', size: 'xs', color: C.grayText, flex: 1, wrap: true }] },
                ],
            },
            footer: {
                type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: C.white,
                contents: [{ type: 'button', style: 'primary', color: C.blue, height: 'md', action: { type: 'uri', label: '📋 ดูรายละเอียดการจอง', uri: bookingUrl } }],
            },
        }

    // ════════════════════════════════════════════════════
    // 5. WASHING — กำลังล้างรถ
    // ════════════════════════════════════════════════════
    } else if (notif_type === 'washing') {
        flexContent = {
            type: 'bubble',
            size: 'mega',
            header: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '20px',
                backgroundColor: C.blue,
                contents: [
                    { type: 'text', text: 'Foami Wash & Delivery', size: 'sm', weight: 'bold', color: C.blueLight, align: 'center' },
                    { type: 'separator', margin: 'md', color: '#4A72D5' },
                    { type: 'text', text: 'กำลังดูแลรถให้คุณ 🫧', size: 'lg', weight: 'bold', color: C.white, align: 'center', margin: 'md' },
                    { type: 'text', text: 'พนักงานกำลังทำความสะอาดอย่างพิถีพิถัน', size: 'xs', color: C.blueLight, align: 'center', wrap: true, margin: 'xs' },
                ],
            },
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '20px',
                backgroundColor: C.white,
                spacing: 'md',
                contents: [
                    {
                        type: 'box',
                        layout: 'vertical',
                        backgroundColor: C.blueBg,
                        cornerRadius: '12px',
                        paddingAll: '16px',
                        contents: [
                            { type: 'text', text: 'สถานะปัจจุบัน', size: 'xxs', color: C.mutedText, weight: 'bold' },
                            { type: 'text', text: 'กำลังล้างรถ — ขั้นตอนที่ 2/3', size: 'sm', weight: 'bold', color: C.blue, margin: 'xs', wrap: true },
                            { type: 'separator', margin: 'md', color: C.border },
                            { type: 'text', text: message, size: 'sm', color: C.grayText, wrap: true, margin: 'md' },
                        ],
                    },
                    // Service checklist card (like payment_pending's detail card)
                    {
                        type: 'box', layout: 'vertical', backgroundColor: C.blueBg, cornerRadius: '12px', paddingAll: '14px',
                        contents: [
                            { type: 'text', text: 'บริการที่กำลังดำเนินการ', size: 'xxs', color: C.mutedText, weight: 'bold' },
                            { type: 'separator', margin: 'sm', color: C.border },
                            { type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm', contents: [{ type: 'text', text: '🫧', size: 'sm', flex: 0 }, { type: 'text', text: 'ล้างทำความสะอาดตัวรถ', size: 'xs', color: C.navy, flex: 1, weight: 'bold' }] },
                            { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [{ type: 'text', text: '✨', size: 'sm', flex: 0 }, { type: 'text', text: 'เช็ดทำความสะอาดและขัดเงา', size: 'xs', color: C.navy, flex: 1, weight: 'bold' }] },
                            { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [{ type: 'text', text: '🔍', size: 'sm', flex: 0 }, { type: 'text', text: 'ตรวจสอบคุณภาพก่อนส่งคืน', size: 'xs', color: C.navy, flex: 1, weight: 'bold' }] },
                        ],
                    },
                    { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [{ type: 'text', text: '⏱️', size: 'sm', flex: 0 }, { type: 'text', text: 'เสร็จแล้วจะแจ้งทันทีครับ', size: 'xs', color: C.grayText, flex: 1, wrap: true }] },
                ],
            },
            footer: {
                type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: C.white,
                contents: [{ type: 'button', style: 'primary', color: C.blue, height: 'md', action: { type: 'uri', label: '📋 ดูรายละเอียดการจอง', uri: bookingUrl } }],
            },
        }

    // ════════════════════════════════════════════════════
    // 6. DELIVERING — กำลังส่งรถคืน
    // ════════════════════════════════════════════════════
    } else if (notif_type === 'delivering') {
        flexContent = {
            type: 'bubble',
            size: 'mega',
            header: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '20px',
                backgroundColor: C.navy,
                contents: [
                    { type: 'text', text: 'Foami Wash & Delivery', size: 'sm', weight: 'bold', color: C.pink, align: 'center' },
                    { type: 'separator', margin: 'md', color: '#2A3560' },
                    { type: 'text', text: 'กำลังส่งรถคืน 🚗', size: 'lg', weight: 'bold', color: C.white, align: 'center', margin: 'md' },
                    { type: 'text', text: 'ล้างเสร็จแล้ว! กำลังเดินทางนำรถกลับคืน', size: 'xs', color: C.pink, align: 'center', wrap: true, margin: 'xs' },
                ],
            },
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '20px',
                backgroundColor: C.white,
                spacing: 'md',
                contents: [
                    {
                        type: 'box',
                        layout: 'vertical',
                        backgroundColor: C.blueBg,
                        cornerRadius: '12px',
                        paddingAll: '16px',
                        contents: [
                            { type: 'text', text: 'สถานะปัจจุบัน', size: 'xxs', color: C.mutedText, weight: 'bold' },
                            { type: 'text', text: 'กำลังนำรถคืน — ขั้นตอนที่ 3/3', size: 'md', weight: 'bold', color: C.navy, margin: 'xs' },
                            { type: 'separator', margin: 'md', color: C.border },
                            { type: 'text', text: message, size: 'sm', color: C.grayText, wrap: true, margin: 'md' },
                        ],
                    },
                    // Completion summary card (like completed's star box)  
                    {
                        type: 'box', layout: 'vertical', backgroundColor: '#F0FDF4', cornerRadius: '12px', paddingAll: '14px',
                        contents: [
                            { type: 'text', text: 'สรุปบริการที่เสร็จแล้ว ✅', size: 'xxs', color: C.mutedText, weight: 'bold' },
                            { type: 'separator', margin: 'sm', color: C.border },
                            { type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm', contents: [{ type: 'text', text: '✅', size: 'sm', flex: 0 }, { type: 'text', text: 'ล้างทำความสะอาดเรียบร้อย', size: 'xs', color: '#166534', flex: 1, weight: 'bold' }] },
                            { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [{ type: 'text', text: '✅', size: 'sm', flex: 0 }, { type: 'text', text: 'ตรวจสอบคุณภาพงานแล้ว', size: 'xs', color: '#166534', flex: 1, weight: 'bold' }] },
                            { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [{ type: 'text', text: '🚗', size: 'sm', flex: 0 }, { type: 'text', text: 'กำลังนำรถส่งคืนให้คุณ', size: 'xs', color: C.navy, flex: 1, weight: 'bold' }] },
                        ],
                    },
                    { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [{ type: 'text', text: '📍', size: 'sm', flex: 0 }, { type: 'text', text: 'กรุณาเตรียมรับรถ ณ จุดที่นัดหมายไว้ครับ', size: 'xs', color: C.grayText, flex: 1, wrap: true }] },
                ],
            },
            footer: {
                type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: C.white,
                contents: [{ type: 'button', style: 'primary', color: C.navy, height: 'md', action: { type: 'uri', label: '📋 ดูรายละเอียดการจอง', uri: bookingUrl } }],
            },
        }

    // ════════════════════════════════════════════════════
    // Fallback / Generic
    // ════════════════════════════════════════════════════
    } else {
        flexContent = {
            type: 'bubble',
            size: 'mega',
            header: {
                type: 'box', layout: 'vertical', paddingAll: '20px', backgroundColor: C.blue,
                contents: [{ type: 'text', text: 'Foami Wash & Delivery', size: 'sm', weight: 'bold', color: C.blueLight, align: 'center' }],
            },
            body: {
                type: 'box', layout: 'vertical', paddingAll: '20px', backgroundColor: C.white,
                contents: [{ type: 'text', text: message, wrap: true, size: 'md', color: C.navy, align: 'center' }],
            },
            footer: {
                type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: C.white,
                contents: [{ type: 'button', style: 'primary', color: C.blue, action: { type: 'uri', label: 'ดูรายละเอียดการจอง', uri: bookingUrl } }],
            },
        }
    }

    try {
        const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: line_user_id,
                messages: [{
                    type: 'flex',
                    altText: notif_type === 'confirmed'       ? '✅ Foami — ยืนยันการจองเรียบร้อย!'
                           : notif_type === 'completed'       ? '🎉 Foami — งานของคุณเสร็จเรียบร้อยแล้ว!'
                           : notif_type === 'payment_pending' ? '💳 Foami — มียอดชำระเพิ่มเติม'
                           : notif_type === 'picking_up'      ? '🏍️ Foami — พนักงานกำลังเดินทางมารับรถ'
                           : notif_type === 'washing'         ? '🫧 Foami — กำลังดูแลรถของคุณ'
                           : notif_type === 'delivering'      ? '🚗 Foami — กำลังส่งรถคืน'
                           : '🫧 Foami Service Update',
                    contents: flexContent,
                }],
            }),
        })

        if (!lineResponse.ok) {
            const errorText = await lineResponse.text()
            console.error('[LINE Notify] API Error:', { status: lineResponse.status, body: errorText })
            return NextResponse.json({ error: 'LINE API Error', details: errorText }, { status: lineResponse.status })
        }

        return NextResponse.json({ sent: true })
    } catch (err: any) {
        console.error('[LINE Notify] Critical Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
