import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabaseAdmin = createServiceClient()

// POST /api/platform/register — validate invitation code + create shop account
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { code, email, password, shop_name } = body

  if (!code || !email || !password || !shop_name) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 })
  }

  // 1. Validate invitation code
  const { data: inv, error: invErr } = await supabaseAdmin
    .from('shop_invitations')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_used', false)
    .single()

  if (invErr || !inv) {
    return NextResponse.json({ error: 'Invitation Code ไม่ถูกต้องหรือถูกใช้ไปแล้ว' }, { status: 400 })
  }

  if (new Date(inv.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invitation Code หมดอายุแล้ว' }, { status: 400 })
  }

  // Check email matches (if invitation was for specific email)
  if (inv.email && inv.email.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: `Code นี้สำหรับ ${inv.email} เท่านั้น` }, { status: 400 })
  }

  // 2. Create Supabase Auth user
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: shop_name, role: 'shop_admin' }
  })

  if (authErr || !authUser.user) {
    return NextResponse.json({ error: authErr?.message || 'ไม่สามารถสร้างบัญชีได้' }, { status: 500 })
  }

  const userId = authUser.user.id

  // 3. Create staff record (shop_admin role)
  const { error: staffErr } = await supabaseAdmin.from('staff').insert({
    id: userId,
    full_name: shop_name,
    email,
    role: 'admin',
    is_active: true,
  })

  if (staffErr) {
    // Rollback auth user
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'ไม่สามารถสร้างโปรไฟล์ได้: ' + staffErr.message }, { status: 500 })
  }

  // 4. Mark invitation as used
  await supabaseAdmin
    .from('shop_invitations')
    .update({ is_used: true, used_at: new Date().toISOString(), shop_name })
    .eq('id', inv.id)

  // 5. Return session token
  const { data: session } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  return NextResponse.json({
    success: true,
    user_id: userId,
    plan: inv.plan_name,
    message: 'บัญชีสร้างเรียบร้อย กรุณาล็อกอิน'
  })
}
