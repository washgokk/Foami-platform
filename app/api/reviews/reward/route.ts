import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabaseAdmin = createServiceClient()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const bookingId = body.bookingId || body.booking_id
    const customerId = body.customerId || body.customer_id
    const rating = Number(body.rating)

    if (!bookingId || !rating) {
      return NextResponse.json({ error: 'Missing bookingId or rating' }, { status: 400 })
    }

    // 1. Fetch active review promo configuration
    const { data: setting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'platform_review_promo')
      .maybeSingle()

    const promo = setting?.value || {
      is_active: true,
      discount_type: 'fixed',
      discount_value: 50,
      min_spend: 0,
      expiry_days: 30,
      funding_type: 'platform'
    }

    if (!promo.is_active) {
      return NextResponse.json({ success: false, message: 'Review promo is currently paused' })
    }

    // 2. Check if a reward code already exists for this booking
    const rewardPrefix = `REV-${bookingId.slice(0, 4).toUpperCase()}`
    const { data: existingCodes } = await supabaseAdmin
      .from('discount_codes')
      .select('code, discount_value, expires_at')
      .ilike('code', `${rewardPrefix}%`)
      .limit(1)

    if (existingCodes && existingCodes.length > 0) {
      const ex = existingCodes[0]
      return NextResponse.json({
        success: true,
        already_issued: true,
        coupon: {
          code: ex.code,
          discount_value: ex.discount_value,
          discount_type: 'fixed',
          expires_at: ex.expires_at,
          funding_type: 'platform',
          description: `คูปองส่วนลด ฿${ex.discount_value} แทนคำขอบคุณสำหรับการรีวิว (Foami รับผิดชอบ 100%)`
        },
        reward_code: ex.code,
        discount_value: ex.discount_value,
        expires_at: ex.expires_at
      })
    }

    // 3. Generate new personalized discount code
    const uniqueSuffix = Math.random().toString(36).slice(2, 6).toUpperCase()
    const voucherCode = `${rewardPrefix}-${uniqueSuffix}`

    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + (promo.expiry_days || 30))

    const segmentPayload = {
      is_review_reward: true,
      funding_type: 'platform', // 100% Platform Funded
      target_customer_id: customerId || null,
      booking_id: bookingId
    }

    const { data: createdCode, error: insertErr } = await supabaseAdmin
      .from('discount_codes')
      .insert({
        code: voucherCode,
        discount_type: promo.discount_type || 'fixed',
        discount_value: Number(promo.discount_value) || 50,
        max_uses: 1,
        max_uses_per_customer: 1,
        target_segment: JSON.stringify(segmentPayload),
        is_active: true,
        expires_at: expiryDate.toISOString()
      })
      .select()
      .single()

    if (insertErr) {
      console.error('[Review Reward] Error inserting code:', insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    const couponObj = {
      code: voucherCode,
      discount_value: promo.discount_value,
      discount_type: promo.discount_type || 'fixed',
      expires_at: expiryDate.toISOString(),
      funding_type: 'platform',
      description: `คูปองส่วนลด ฿${promo.discount_value} แทนคำขอบคุณสำหรับการรีวิว (Foami รับผิดชอบ 100%)`
    }

    return NextResponse.json({
      success: true,
      coupon: couponObj,
      reward_code: voucherCode,
      discount_value: promo.discount_value,
      discount_type: promo.discount_type,
      expires_at: expiryDate.toISOString(),
      funding_type: 'platform'
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
