import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabaseAdmin = createServiceClient()

function isPlatformAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ||
    req.cookies.get('platform_token')?.value
  const secret = process.env.PLATFORM_ADMIN_SECRET || 'foami_platform_admin_2025'
  return token === secret
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return 'FOAMI-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// GET /api/platform/invitations — list all invitation codes OR verify single code
export async function GET(req: NextRequest) {
  const codeToVerify = req.nextUrl.searchParams.get('code') || req.nextUrl.searchParams.get('verify')

  // Public verification endpoint for Partner Onboarding
  if (codeToVerify) {
    const { data: inv, error } = await supabaseAdmin
      .from('shop_invitations')
      .select('id, code, email, plan_name, is_used, expires_at, shop_name')
      .eq('code', codeToVerify.toUpperCase().trim())
      .maybeSingle()

    if (error || !inv) {
      return NextResponse.json({ valid: false, error: 'ไม่พบ Invitation Code นี้ในระบบ' }, { status: 404 })
    }
    if (inv.is_used) {
      return NextResponse.json({ valid: false, error: 'Invitation Code นี้ถูกใช้งานไปแล้ว' }, { status: 400 })
    }
    if (new Date(inv.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Invitation Code นี้หมดอายุแล้ว' }, { status: 400 })
    }

    const rawPlan = inv.plan_name || 'starter'
    const [basePlan, contractPart] = rawPlan.split(':')
    const contractMonths = contractPart ? parseInt(contractPart.replace('m', '')) || 12 : 12

    return NextResponse.json({
      valid: true,
      invitation: {
        id: inv.id,
        code: inv.code,
        email: inv.email,
        shop_name: inv.shop_name,
        base_plan: basePlan,
        contract_months: contractMonths,
        expires_at: inv.expires_at
      }
    })
  }

  // Admin list
  if (!isPlatformAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('shop_invitations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = (data || []).map((inv: any) => {
    const rawPlan = inv.plan_name || 'starter'
    const [basePlan, contractPart] = rawPlan.split(':')
    const contractMonths = contractPart ? parseInt(contractPart.replace('m', '')) || 12 : 12
    return {
      ...inv,
      base_plan: basePlan,
      contract_months: contractMonths
    }
  })

  return NextResponse.json({ invitations: enriched })
}

// POST /api/platform/invitations — create new invitation code with contract duration
export async function POST(req: NextRequest) {
  if (!isPlatformAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { email, shop_name, note, plan_name = 'starter', contract_months = 12, expires_days = 7, created_by } = body

  // Encode contract duration into plan_name (e.g. "growth:12m") for backward-compatible schema
  const encodedPlan = `${plan_name}:${contract_months}m`

  // Generate unique code
  let code = generateCode()
  let tries = 0
  while (tries < 5) {
    const { data: existing } = await supabaseAdmin
      .from('shop_invitations')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (!existing) break
    code = generateCode()
    tries++
  }

  const expires_at = new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString()
  const targetEmail = email && typeof email === 'string' && email.trim() ? email.trim() : null
  const targetShop = (shop_name || note || '').trim() || null

  const { data, error } = await supabaseAdmin
    .from('shop_invitations')
    .insert({
      code,
      email: targetEmail,
      shop_name: targetShop,
      plan_name: encodedPlan,
      expires_at,
      created_by
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invitation: data })
}

// DELETE /api/platform/invitations — revoke a code
export async function DELETE(req: NextRequest) {
  if (!isPlatformAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabaseAdmin
    .from('shop_invitations')
    .delete()
    .eq('id', id)
    .eq('is_used', false) // can only delete unused codes

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
