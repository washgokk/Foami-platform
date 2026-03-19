import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const { line_user_id, message, booking_id, notif_type } = await req.json()
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN

    if (!token) return NextResponse.json({ error: 'No Line token' }, { status: 500 })

    // Fetch Job Photos if needed (Completed or Status updates)
    let beforePhoto = ''
    let afterPhoto = ''
    if (booking_id) {
        const supabase = createServiceClient()
        const { data: photos } = await supabase
            .from('job_photos')
            .select('type, photo_urls')
            .eq('booking_id', booking_id)
        
        beforePhoto = photos?.find(p => p.type === 'before')?.photo_urls?.[0] || ''
        afterPhoto = photos?.find(p => p.type === 'after')?.photo_urls?.[0] || ''
    }

    let flexContent: any = {}

    if (notif_type === 'completed') {
        // --- 1. COMPLETED STYLE (Before/After + Review) ---
        flexContent = {
            type: 'bubble', size: 'mega',
            header: {
                type: 'box', layout: 'vertical', backgroundColor: '#1A2340', paddingAll: '20px',
                contents: [
                    { type: 'text', text: '🫧 งานของคุณเสร็จเรียบร้อยแล้ว!', color: '#FFFFFF', weight: 'bold', size: 'md' },
                    { type: 'text', text: 'ขอบคุณที่วางใจให้ Foami ดูแลรถคุณครับ', color: '#F1BFDB', size: 'xs', margin: 'xs' }
                ]
            },
            body: {
                type: 'box', layout: 'vertical', paddingAll: '20px', backgroundColor: '#FFFFFF', spacing: 'md',
                contents: [
                    {
                        type: 'box', layout: 'horizontal', spacing: 'md',
                        contents: [
                            {
                                type: 'box', layout: 'vertical', flex: 1, spacing: 'xs',
                                contents: [
                                    { type: 'text', text: 'BEFORE', size: 'xxs', color: '#94A3B8', weight: 'bold', align: 'center' },
                                    { type: 'image', url: beforePhoto || 'https://images.unsplash.com/photo-1542281286-9e0a16bb7366?auto=format&fit=crop&q=80&w=200&h=150', size: 'full', aspectRatio: '4:3', aspectMode: 'cover', cornerRadius: 'md' }
                                ]
                            },
                            {
                                type: 'box', layout: 'vertical', flex: 1, spacing: 'xs',
                                contents: [
                                    { type: 'text', text: 'AFTER', size: 'xxs', color: '#315EC3', weight: 'bold', align: 'center' },
                                    { type: 'image', url: afterPhoto || 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&q=80&w=200&h=150', size: 'full', aspectRatio: '4:3', aspectMode: 'cover', cornerRadius: 'md' }
                                ]
                            }
                        ]
                    },
                    { type: 'text', text: message, wrap: true, size: 'sm', color: '#1A2340', margin: 'md' },
                    {
                        type: 'button', style: 'primary', color: '#315EC3', margin: 'lg', height: 'sm',
                        action: { type: 'uri', label: '⭐ ให้คะแนน & รีวิวงาน', uri: `${process.env.NEXT_PUBLIC_APP_URL}/liff/my-bookings/${booking_id}/review` }
                    }
                ]
            }
        }
    } else if (notif_type === 'payment_pending' || message?.includes('ชำระเงิน')) {
        // --- 2. PAYMENT STYLE (Beautiful Pay Card) ---
        flexContent = {
            type: 'bubble', size: 'mega',
            header: {
                type: 'box', layout: 'vertical', backgroundColor: '#315EC3', paddingAll: '20px',
                contents: [
                    { type: 'text', text: '💳 รอการชำระเงิน', color: '#FFFFFF', weight: 'bold', size: 'md' },
                    { type: 'text', text: 'กรุณาชำระเงินเพื่อให้งานดำเนินต่อครับ', color: '#F1BFDB', size: 'xs', margin: 'xs' }
                ]
            },
            body: {
                type: 'box', layout: 'vertical', paddingAll: '20px', backgroundColor: '#FFFFFF',
                contents: [
                    { type: 'text', text: message, wrap: true, size: 'md', color: '#1A2340', weight: 'bold' },
                    {
                        type: 'button', style: 'primary', color: '#315EC3', margin: 'xl',
                        action: { type: 'uri', label: '💰 ไปที่หน้าชำระเงิน', uri: `${process.env.NEXT_PUBLIC_APP_URL}/liff/my-bookings/${booking_id}/payment` }
                    }
                ]
            }
        }
    } else {
        // --- 3. GENERIC STYLE (Sticker placement placeholder) ---
        flexContent = {
            type: 'bubble', size: 'mega',
            header: {
                type: 'box', layout: 'vertical', backgroundColor: '#F1BFDB', paddingAll: '16px',
                contents: [
                    { type: 'text', text: '🫧 Foami Update', color: '#1A2340', weight: 'bold', size: 'md', align: 'center' }
                ]
            },
            body: {
                type: 'box', layout: 'vertical', paddingAll: '20px',
                contents: [
                    // [PLACEHOLDER: Add Sticker here if available]
                    { type: 'text', text: message, wrap: true, size: 'md', color: '#1A2340', align: 'center' }
                ]
            },
            footer: {
                type: 'box', layout: 'vertical', paddingAll: 'md',
                contents: [
                    {
                        type: 'button', style: 'secondary', color: '#1A2340', height: 'sm',
                        action: { type: 'uri', label: 'ดูรายละเอียดการจอง', uri: `${process.env.NEXT_PUBLIC_APP_URL}/liff/my-bookings` }
                    }
                ]
            }
        }
    }

    await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            to: line_user_id,
            messages: [{
                type: 'flex',
                altText: 'Foami Notification',
                contents: flexContent
            }]
        })
    })

    return NextResponse.json({ sent: true })
}
