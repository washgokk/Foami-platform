import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabaseAdmin = createServiceClient()

function isPlatformAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ||
    req.cookies.get('platform_token')?.value
  const secret = process.env.PLATFORM_ADMIN_SECRET || 'foami_platform_admin_2025'
  return token === secret
}

// POST /api/platform/partner-credentials
// Body: { action: 'set' | 'reset', branch_slug, email, password }
export async function POST(req: NextRequest) {
  if (!isPlatformAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { action, branch_slug, email, password } = await req.json()

  if (!branch_slug || !action) {
    return NextResponse.json({ error: 'branch_slug and action are required' }, { status: 400 })
  }

  // Get branch to validate it exists
  const { data: branch, error: branchErr } = await supabaseAdmin
    .from('branches')
    .select('id, name, slug')
    .eq('slug', branch_slug)
    .maybeSingle()

  if (branchErr || !branch) {
    return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
  }

  // Check if there's already a staff admin for this branch
  const { data: existingStaff } = await supabaseAdmin
    .from('staff')
    .select('id, user_id, email')
    .eq('branch_id', branch.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (action === 'set') {
    // Validate inputs
    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required for set action' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    if (existingStaff?.user_id) {
      // Update existing user's email/password
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        existingStaff.user_id,
        { email, password }
      )
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

      // Update staff email record
      await supabaseAdmin
        .from('staff')
        .update({ email })
        .eq('id', existingStaff.id)

      return NextResponse.json({ success: true, action: 'updated', email, user_id: existingStaff.user_id })
    } else {
      // Create new Supabase Auth user
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { branch_slug, role: 'shop_admin' }
      })

      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })

      // Create or update staff record
      if (existingStaff) {
        await supabaseAdmin.from('staff').update({
          email,
          user_id: newUser.user.id
        }).eq('id', existingStaff.id)
      } else {
        await supabaseAdmin.from('staff').insert({
          branch_id: branch.id,
          full_name: `Admin  // BUG-01 FIX — ${branch.name}`,
          email,
          role: 'admin',
          user_id: newUser.user.id,
          is_active: true
        })
      }

      return NextResponse.json({
        success: true,
        action: 'created',
        email,
        user_id: newUser.user.id
      })
    }
  }

  if (action === 'reset') {
    if (!password) {
      return NextResponse.json({ error: 'New password is required for reset action' }, { status: 400 })
    }
    if (!existingStaff?.user_id) {
      return NextResponse.json({ error: 'No existing admin account found for this branch. Use "set" to create one first.' }, { status: 404 })
    }

    const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(
      existingStaff.user_id,
      { password }
    )

    if (resetErr) return NextResponse.json({ error: resetErr.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      action: 'reset',
      email: existingStaff.email,
      user_id: existingStaff.user_id
    })
  }

  if (action === 'get') {
    return NextResponse.json({
      branch: branch.name,
      slug: branch.slug,
      has_admin: !!existingStaff,
      email: existingStaff?.email || null,
      user_id: existingStaff?.user_id || null
    })
  }

  return NextResponse.json({ error: 'Invalid action. Use: set | reset | get' }, { status: 400 })
}
