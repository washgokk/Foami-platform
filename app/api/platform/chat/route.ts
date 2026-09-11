import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const supabase = createServiceClient()

// GET /api/platform/chat
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const branchId = url.searchParams.get('branchId')
  const type = url.searchParams.get('type')
  const markReadBy = url.searchParams.get('markReadBy')

  try {
    // 1. Unread Summary for Platform Admin (across all shops)
    if (type === 'unread_summary') {
      const { data, error } = await supabase
        .from('booking_messages')
        .select('booking_id, is_read, sender_id')
        .like('booking_id', 'HQ_SHOP_%')
        .neq('sender_id', 'platform_hq')
        .eq('is_read', false)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const counts: Record<string, number> = {}
      let total = 0
      ;(data || []).forEach(m => {
        const bId = m.booking_id.replace('HQ_SHOP_', '')
        counts[bId] = (counts[bId] || 0) + 1
        total++
      })

      return NextResponse.json({ counts, total })
    }

    // 2. Unread count for a specific shop (from Platform HQ)
    if (type === 'shop_unread' && branchId) {
      const channelId = `HQ_SHOP_${branchId}`
      const { count, error } = await supabase
        .from('booking_messages')
        .select('*', { count: 'exact', head: true })
        .eq('booking_id', channelId)
        .eq('sender_id', 'platform_hq')
        .eq('is_read', false)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ unreadCount: count || 0 })
    }

    if (!branchId) {
      return NextResponse.json({ error: 'Missing branchId' }, { status: 400 })
    }

    const channelId = `HQ_SHOP_${branchId}`

    // 3. Fetch Messages for this shop
    const { data: messages, error } = await supabase
      .from('booking_messages')
      .select('*')
      .eq('booking_id', channelId)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 4. Mark Read if requested
    if (markReadBy === 'platform_admin') {
      await supabase
        .from('booking_messages')
        .update({ is_read: true })
        .eq('booking_id', channelId)
        .neq('sender_id', 'platform_hq')
        .eq('is_read', false)
    } else if (markReadBy === 'shop_admin') {
      await supabase
        .from('booking_messages')
        .update({ is_read: true })
        .eq('booking_id', channelId)
        .eq('sender_id', 'platform_hq')
        .eq('is_read', false)
    }

    return NextResponse.json({ messages: messages || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// POST /api/platform/chat — send message
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { branchId, senderRole, senderName, message, imageUrl } = body

    if (!branchId || !message?.trim()) {
      return NextResponse.json({ error: 'Missing branchId or message' }, { status: 400 })
    }

    const channelId = `HQ_SHOP_${branchId}`
    const isHQ = senderRole === 'platform_admin'

    const { data, error } = await supabase
      .from('booking_messages')
      .insert({
        booking_id: channelId,
        sender_type: isHQ ? 'admin' : 'staff',
        sender_id: isHQ ? 'platform_hq' : `shop_admin_${branchId}`,
        sender_name: senderName || (isHQ ? 'Platform HQ' : 'แอดมินสาขา'),
        message: message.trim(),
        image_url: imageUrl || null,
        is_read: false
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
