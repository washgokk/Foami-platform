import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabaseAdmin = createServiceClient()

function isPlatformAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ||
    req.cookies.get('platform_token')?.value
  const secret = process.env.PLATFORM_ADMIN_SECRET || 'foami_platform_admin_2025'
  return token === secret
}

// GET /api/platform/shops — list all shops (with stats)
export async function GET(req: NextRequest) {
  if (!isPlatformAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: branches, error } = await supabaseAdmin
    .from('branches')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with booking counts and wallet info
  const enriched = await Promise.all((branches || []).map(async (branch) => {
    const [bookings, wallet] = await Promise.all([
      supabaseAdmin
        .from('bookings')
        .select('*')
        .eq('branch_id', branch.id),
      supabaseAdmin
        .from('shop_wallets')
        .select('balance_thb, total_earned_thb')
        .eq('shop_id', branch.id)
        .maybeSingle()
    ])

    const allBooks = bookings.data || []
    const completedBooks = allBooks.filter((b: any) => b.status === 'completed')

    // Revenue calculation helper — matches shop admin formula exactly
    const calcBookingRevenue = (b: any) => {
      const isRebooking = b.discount_code && /rebook|refund/i.test(b.discount_code)
      let fallbackGross = (Number(b.base_price) || 0)
      if (Array.isArray(b.addon_ids)) {
        b.addon_ids.forEach((a: any) => {
          fallbackGross += (Number(a.price) || Number(a.selectedPrice) || Number(a.variableState?.customAmount) || 0)
        })
      }
      fallbackGross += (Number(b.travel_surcharge) || 0) + (Number(b.different_spot_fee) || 0)
      const grossTotal = b.total_price && b.total_price > 0 ? Number(b.total_price) : fallbackGross
      const additional = Number(b.additional_price) || 0
      const discount = Number(b.discount_amount) || 0
      return isRebooking ? (grossTotal + additional) : Math.max(0, grossTotal - discount + additional)
    }

    const totalRevenue = completedBooks.reduce((s: number, b: any) => s + calcBookingRevenue(b), 0)

    return {
      ...branch,
      booking_count: allBooks.length,
      completed_count: completedBooks.length,
      total_revenue: totalRevenue,
      wallet: wallet.data
    }
  }))

  return NextResponse.json({ shops: enriched })
}

// POST /api/platform/shops — update shop settings (verify, suspend, fee)
export async function PATCH(req: NextRequest) {
  if (!isPlatformAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { shop_id, is_active, platform_fee_pct, is_marketplace_listed, is_verified } = body

  const updates: Record<string, unknown> = {}
  if (is_active !== undefined) updates.is_active = is_active
  if (platform_fee_pct !== undefined) updates.platform_fee_pct = platform_fee_pct

  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin
      .from('branches')
      .update(updates)
      .eq('id', shop_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (is_marketplace_listed !== undefined || is_verified !== undefined) {
    const listingUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (is_marketplace_listed !== undefined) {
      listingUpdates.is_active = is_marketplace_listed
    }
    await supabaseAdmin
      .from('marketplace_listings')
      .upsert({ shop_slug: shop_id, ...listingUpdates })
      .eq('shop_slug', shop_id)
  }

  return NextResponse.json({ success: true })
}
