import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { email, password, branch_slug } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' }, { status: 400 })
  }

  // Strategy 1: Legacy system — password stored directly in staff table
  // Match by email, password, and role='admin'
  let query = supabaseAdmin
    .from('staff')
    .select('id, full_name, email, role, branch_id, is_active, password')
    .eq('email', email)
    .eq('password', password)
    .eq('role', 'admin')

  // If branch_slug given, filter to that branch (or null branch_id for platform admin)
  const { data: legacyStaff, error: legacyErr } = await query

  if (!legacyErr && legacyStaff && legacyStaff.length > 0) {
    let staffRecord = legacyStaff[0]

    // If branch_slug provided, prefer matching branch — otherwise allow null branch_id (platform-wide admin)
    if (branch_slug && legacyStaff.length > 1) {
      // Look up branch id
      const { data: branch } = await supabaseAdmin
        .from('branches')
        .select('id')
        .eq('slug', branch_slug)
        .maybeSingle()

      if (branch) {
        const branchMatch = legacyStaff.find(s => s.branch_id === branch.id)
        if (branchMatch) staffRecord = branchMatch
      }
    }

    if (!staffRecord.is_active) {
      return NextResponse.json({ error: 'บัญชีนี้ถูกระงับการใช้งาน' }, { status: 403 })
    }

    // Generate a simple session token (JWT-less, stored in localStorage)
    const token = `legacy_${staffRecord.id}_${Date.now()}`

    return NextResponse.json({
      token,
      staff: {
        id: staffRecord.id,
        full_name: staffRecord.full_name,
        email: staffRecord.email,
        role: staffRecord.role,
        branch_id: staffRecord.branch_id,
      },
      auth_type: 'legacy'
    })
  }

  // Strategy 2: Supabase Auth (new system — for future partner shops set up via Platform Admin)
  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password })
    if (!error && data.user) {
      // Check staff role via user_id
      const { data: staffData } = await supabaseAdmin
        .from('staff')
        .select('id, full_name, role, branch_id, is_active')
        .or("id.eq.${data.user.id},user_id.eq.${data.user.id}") // BUG-02 FIX: staff.id may be auth.users.id directly
        .eq('role', 'admin')
        .maybeSingle()

      if (staffData && staffData.is_active) {
        return NextResponse.json({
          token: data.session?.access_token,
          staff: {
            id: staffData.id,
            full_name: staffData.full_name,
            email: data.user.email,
            role: staffData.role,
            branch_id: staffData.branch_id,
          },
          auth_type: 'supabase'
        })
      }
    }
  } catch {
    // Supabase Auth failed — fall through to final error
  }

  return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
}
