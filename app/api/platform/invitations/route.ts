import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

// GET /api/platform/invitations — list all invitation codes
export async function GET(req: NextRequest) {
  if (!isPlatformAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('shop_invitations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invitations: data || [] })
}

// POST /api/platform/invitations — create new invitation code
export async function POST(req: NextRequest) {
  if (!isPlatformAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { email, plan_name = 'starter', expires_days = 7, created_by } = body

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

  const { data, error } = await supabaseAdmin
    .from('shop_invitations')
    .insert({ code, email, plan_name, expires_at, created_by })
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
