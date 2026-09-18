import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabaseAdmin = createServiceClient()

const DEFAULT_REVIEW_PROMO = {
  is_active: true,
  discount_type: 'fixed', // 'fixed' (฿) or 'percent' (%)
  discount_value: 50,
  min_spend: 0,
  expiry_days: 30,
  funding_type: 'platform', // 100% Platform Funded
  title: 'รีวิวรับส่วนลด ฿50 (Foami สนับสนุน 100%)',
  description: 'เขียนรีวิวการใช้บริการเพื่อรับคูปองส่วนลด ฿50 ทันทีสำหรับการจองครั้งถัดไป'
}

// GET /api/platform/review-promo — get active review promo settings
export async function GET() {
  const { data: setting } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'platform_review_promo')
    .maybeSingle()

  const promo = setting?.value || DEFAULT_REVIEW_PROMO
  const enriched = {
    ...promo,
    enabled: promo.is_active !== undefined ? promo.is_active : true,
    min_booking_amount: promo.min_spend || 0,
    validity_days: promo.expiry_days || 30
  }
  return NextResponse.json({ promo: enriched })
}

// POST /api/platform/review-promo — update review promo settings (Super Admin)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    is_active,
    discount_type,
    discount_value,
    min_spend,
    expiry_days,
    title,
    description
  } = body

  const updatedPromo = {
    is_active: is_active !== undefined ? is_active : (body.enabled !== undefined ? body.enabled : true),
    discount_type: discount_type || 'fixed',
    discount_value: Number(discount_value) || 50,
    min_spend: Number(min_spend !== undefined ? min_spend : (body.min_booking_amount || 0)),
    expiry_days: Number(expiry_days !== undefined ? expiry_days : (body.validity_days || 30)),
    funding_type: 'platform', // Strictly 100% platform funded
    title: title || `รีวิวรับส่วนลด ฿${discount_value || 50} (Foami สนับสนุน 100%)`,
    description: description || 'เขียนรีวิวการใช้บริการเพื่อรับคูปองส่วนลดสำหรับการจองครั้งถัดไป',
    updated_at: new Date().toISOString()
  }

  await supabaseAdmin.from('app_settings').upsert({
    key: 'platform_review_promo',
    value: updatedPromo
  })

  return NextResponse.json({ success: true, promo: updatedPromo })
}
