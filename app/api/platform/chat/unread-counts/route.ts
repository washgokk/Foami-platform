import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const supabase = createServiceClient()

// GET /api/platform/chat/unread-counts — unread message count summary for Platform Super Admin
export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('booking_messages')
      .select('booking_id, is_read, sender_id')
      .like('booking_id', 'HQ_SHOP_%')
      .neq('sender_id', 'platform_hq')
      .eq('is_read', false)

    if (error) {
      return NextResponse.json({ counts: {}, total: 0 }, { status: 200 })
    }

    const counts: Record<string, number> = {}
    let total = 0
    ;(data || []).forEach(m => {
      const bId = m.booking_id.replace('HQ_SHOP_', '')
      counts[bId] = (counts[bId] || 0) + 1
      total++
    })

    return NextResponse.json({ counts, total })
  } catch (err: any) {
    return NextResponse.json({ counts: {}, total: 0 }, { status: 200 })
  }
}
