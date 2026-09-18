import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabaseAdmin = createServiceClient()

function isPlatformAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ||
    req.cookies.get('platform_token')?.value ||
    req.nextUrl.searchParams.get('token') ||
    req.nextUrl.searchParams.get('admin_key')
  const secret = process.env.PLATFORM_ADMIN_SECRET || 'foami_platform_admin_2025'
  return token === secret || token === 'foami_platform_admin_2025'
}

// GET /api/platform/shops — list all shops (with stats & KYC info)
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

    const feat = (branch.features && typeof branch.features === 'object') ? branch.features : {}
    const hasInsurance = Boolean(feat.insurance_renewal ?? feat.has_insurance)
    const contract = feat.contract || null
    const isVerified = Boolean(feat.is_verified ?? branch.is_verified)
    const verificationDocs = Array.isArray(feat.verification_docs) ? feat.verification_docs : []
    const planTier = feat.plan_tier || feat.contract?.plan || 'starter'
    const monetizationMode = feat.monetization_mode || 'commission'
    const ownerName = feat.owner_name || feat.contact_person || branch.name
    const ownerPhone = branch.phone || feat.owner_phone || feat.phone || '-'
    const ownerEmail = feat.owner_email || feat.email || '-'

    return {
      ...branch,
      has_insurance: hasInsurance,
      is_verified: isVerified,
      verification_docs: verificationDocs,
      plan_tier: planTier,
      monetization_mode: monetizationMode,
      owner_name: ownerName,
      owner_phone: ownerPhone,
      owner_email: ownerEmail,
      contract,
      booking_count: allBooks.length,
      completed_count: completedBooks.length,
      total_revenue: totalRevenue,
      wallet: wallet.data
    }
  }))

  return NextResponse.json({ shops: enriched })
}

// PATCH /api/platform/shops — update shop settings (verify, suspend, fee, insurance, contract, plan, KYC)
export async function PATCH(req: NextRequest) {
  if (!isPlatformAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    shop_id,
    is_active,
    has_insurance,
    contract_end_date,
    contract_months,
    platform_fee_pct,
    is_marketplace_listed,
    is_verified,
    verification_docs,
    plan_tier,
    monetization_mode,
    owner_name,
    owner_phone,
    owner_email,
    phone,
    address
  } = body

  // ── IMMUTABLE CONTRACT LOCK CHECK ──
  // If the partner shop has paid for their package and contract is locked,
  // platform admins CANNOT modify platform_fee_pct, plan_tier, or contract duration!
  const { data: curBranch } = await supabaseAdmin
    .from('branches')
    .select('platform_fee_pct, features')
    .eq('id', shop_id)
    .maybeSingle()

  const curFeatures = (curBranch?.features && typeof curBranch.features === 'object') ? curBranch.features : {}
  const curContract = curFeatures.contract || {}
  const isContractLocked = Boolean(
    curContract.is_locked &&
    curContract.end_date &&
    new Date(curContract.end_date) > new Date()
  )

  if (isContractLocked) {
    if (platform_fee_pct !== undefined && Number(platform_fee_pct) !== Number(curBranch?.platform_fee_pct)) {
      return NextResponse.json({
        error: `สัญญาถูกล็อค: ร้านค้านี้ชำระเงินค่าแพ็กเกจเรียบร้อยแล้ว (มีผลถึงวันที่ ${new Date(curContract.end_date).toLocaleDateString('th-TH')}) แอดมินไม่สามารถปรับเปลี่ยนค่าคอมมิชชั่นได้ตามข้อตกลงสัญญา`
      }, { status: 403 })
    }
    if (plan_tier !== undefined && plan_tier !== curFeatures.plan_tier) {
      return NextResponse.json({
        error: `สัญญาถูกล็อค: ไม่สามารถเปลี่ยนระดับแพ็กเกจของร้านที่มีสัญญาแบบชำระเงินล็อคอยู่จนกว่าจะหมดสัญญา (${new Date(curContract.end_date).toLocaleDateString('th-TH')})`
      }, { status: 403 })
    }
  }

  const updates: Record<string, unknown> = {}
  if (is_active !== undefined) updates.is_active = is_active
  if (platform_fee_pct !== undefined) updates.platform_fee_pct = platform_fee_pct
  if (phone !== undefined) updates.phone = phone
  if (address !== undefined) updates.address = address

  // Store metadata in features JSONB (native column)
  const hasFeatureUpdates = (
    has_insurance !== undefined ||
    contract_end_date !== undefined ||
    contract_months !== undefined ||
    is_verified !== undefined ||
    verification_docs !== undefined ||
    plan_tier !== undefined ||
    monetization_mode !== undefined ||
    owner_name !== undefined ||
    owner_phone !== undefined ||
    owner_email !== undefined
  )

  if (hasFeatureUpdates) {
    const { data: cur } = await supabaseAdmin
      .from('branches')
      .select('features')
      .eq('id', shop_id)
      .maybeSingle()
    
    const curFeatures = (cur?.features && typeof cur.features === 'object') ? cur.features : {}
    const nextFeatures: Record<string, any> = { ...curFeatures }

    if (has_insurance !== undefined) {
      nextFeatures.insurance_renewal = Boolean(has_insurance)
    }

    if (is_verified !== undefined) {
      nextFeatures.is_verified = Boolean(is_verified)
    }

    if (verification_docs !== undefined) {
      nextFeatures.verification_docs = verification_docs
    }

    if (plan_tier !== undefined) {
      nextFeatures.plan_tier = plan_tier
    }

    if (monetization_mode !== undefined) {
      nextFeatures.monetization_mode = monetization_mode
    }

    if (owner_name !== undefined) {
      nextFeatures.owner_name = owner_name
    }

    if (owner_phone !== undefined) {
      nextFeatures.owner_phone = owner_phone
    }

    if (owner_email !== undefined) {
      nextFeatures.owner_email = owner_email
    }

    if (contract_end_date !== undefined || contract_months !== undefined) {
      const curContract = curFeatures.contract || {}
      nextFeatures.contract = {
        ...curContract,
        ...(contract_end_date ? { end_date: contract_end_date } : {}),
        ...(contract_months ? { months: contract_months } : {}),
        updated_at: new Date().toISOString()
      }
    }

    updates.features = nextFeatures
  }

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
