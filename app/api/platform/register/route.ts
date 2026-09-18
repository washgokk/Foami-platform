import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabaseAdmin = createServiceClient()

// POST /api/platform/register — validate invitation code + setup partner shop + create admin account
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      code,
      email,
      password,
      full_name,
      phone,
      shop_name,
      slug,
      address,
      lat,
      lng,
      theme_color = '#315EC3',
      enable_starter_services = true
    } = body

    if (!code || !email || !password || !shop_name) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (Code, Email, รหัสผ่าน, ชื่อร้าน)' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร' }, { status: 400 })
    }

    const cleanCode = code.toUpperCase().trim()

    // 1. Validate invitation code
    const { data: inv, error: invErr } = await supabaseAdmin
      .from('shop_invitations')
      .select('*')
      .eq('code', cleanCode)
      .maybeSingle()

    if (invErr || !inv) {
      return NextResponse.json({ error: 'ไม่พบ Invitation Code นี้ในระบบ' }, { status: 400 })
    }

    if (inv.is_used) {
      return NextResponse.json({ error: 'Invitation Code นี้ถูกใช้งานไปแล้ว' }, { status: 400 })
    }

    if (new Date(inv.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation Code นี้หมดอายุแล้ว' }, { status: 400 })
    }

    // Check email restriction if invitation was bound to a specific email
    if (inv.email && inv.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return NextResponse.json({ error: `โค้ดนี้ถูกระบุสิทธิ์สำหรับ ${inv.email} เท่านั้น` }, { status: 400 })
    }

    // Parse plan and contract duration
    const rawPlan = inv.plan_name || 'pro'
    const [basePlan, contractPart] = rawPlan.split(':')
    const contractMonths = contractPart ? parseInt(contractPart.replace('m', '')) || 12 : 12

    const now = new Date()
    const startDate = now.toISOString()
    const endDate = new Date(now.getTime() + contractMonths * 30 * 24 * 60 * 60 * 1000).toISOString()

    // 2. Format & check slug uniqueness
    let shopSlug = (slug || shop_name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    if (!shopSlug) shopSlug = 'shop-' + Math.random().toString(36).substring(2, 7)

    const { data: existingSlug } = await supabaseAdmin
      .from('branches')
      .select('id')
      .eq('slug', shopSlug)
      .maybeSingle()

    if (existingSlug) {
      shopSlug = `${shopSlug}-${Math.floor(100 + Math.random() * 900)}`
    }

    // 3. Create Supabase Auth user
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || shop_name,
        shop_name,
        role: 'admin'
      }
    })

    if (authErr || !authUser.user) {
      return NextResponse.json({
        error: authErr?.message?.includes('already registered')
          ? 'อีเมลนี้ถูกใช้งานในระบบแล้ว กรุณาใช้อีเมลอื่น หรือเข้าสู่ระบบ'
          : (authErr?.message || 'ไม่สามารถสร้างบัญชีผู้ใช้ได้')
      }, { status: 400 })
    }

    const userId = authUser.user.id

    // 4. Create Branch in `branches`
    const branchLat = typeof lat === 'number' && !isNaN(lat) ? lat : 16.4722
    const branchLng = typeof lng === 'number' && !isNaN(lng) ? lng : 102.8265

    const { data: newBranch, error: branchErr } = await supabaseAdmin
      .from('branches')
      .insert({
        name: shop_name.trim(),
        slug: shopSlug,
        address: address ? address.trim() : 'จังหวัดขอนแก่น',
        phone: phone ? phone.trim() : null,
        lat: branchLat,
        lng: branchLng,
        is_active: true,
        primary_color: theme_color || '#315EC3',
        accent_color: '#A0D9F6',
        features: {
          insurance_renewal: false,
          contract: {
            plan: basePlan,
            months: contractMonths,
            start_date: startDate,
            end_date: endDate,
            created_by: inv.created_by || 'platform_admin'
          }
        }
      })
      .select()
      .single()

    if (branchErr || !newBranch) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'ไม่สามารถสร้างข้อมูลสาขาได้: ' + branchErr?.message }, { status: 500 })
    }

    // 5. Create staff record with branch_id
    const { error: staffErr } = await supabaseAdmin.from('staff').insert({
      id: userId,
      branch_id: newBranch.id,
      full_name: (full_name || shop_name).trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : null,
      password: password, // For legacy admin login strategy
      role: 'admin',
      is_active: true
    })

    if (staffErr) {
      console.error('Staff insert error:', staffErr)
      // If primary key collision, try updating
      await supabaseAdmin.from('staff').upsert({
        id: userId,
        branch_id: newBranch.id,
        full_name: (full_name || shop_name).trim(),
        email: email.toLowerCase().trim(),
        phone: phone ? phone.trim() : null,
        password: password,
        role: 'admin',
        is_active: true
      })
    }

    // 6. Enable starter services for this branch
    if (enable_starter_services) {
      try {
        const { data: allServices } = await supabaseAdmin.from('services').select('id, branch_settings')
        if (allServices && allServices.length > 0) {
          for (const svc of allServices) {
            const curSettings = (svc.branch_settings && typeof svc.branch_settings === 'object') ? { ...svc.branch_settings } : {}
            curSettings[newBranch.id] = { is_active: true, price_markup: 0 }
            await supabaseAdmin.from('services').update({ branch_settings: curSettings }).eq('id', svc.id)
          }
        }
      } catch (svcErr) {
        console.warn('Failed to auto-enable services for new branch:', svcErr)
      }
    }

    // 7. Initialize shop_wallets if table exists
    try {
      await supabaseAdmin.from('shop_wallets').insert({
        shop_id: newBranch.id,
        balance_thb: 0,
        total_earned_thb: 0
      })
    } catch {
      // Table might have different columns or triggers, continue safely
    }

    // 8. Mark invitation as used
    await supabaseAdmin
      .from('shop_invitations')
      .update({
        is_used: true,
        used_at: new Date().toISOString(),
        shop_name: shop_name.trim()
      })
      .eq('id', inv.id)

    // Generate legacy admin token for seamless auto-login
    const autoToken = `legacy_${userId}_${Date.now()}`

    return NextResponse.json({
      success: true,
      branch_id: newBranch.id,
      shop_name: newBranch.name,
      slug: newBranch.slug,
      token: autoToken,
      plan: basePlan,
      contract_months: contractMonths,
      message: 'เปิดร้านค้าพาร์ทเนอร์สำเร็จ'
    })
  } catch (err: any) {
    console.error('Register API Error:', err)
    return NextResponse.json({ error: err?.message || 'เกิดข้อผิดพลาดในการลงทะเบียน' }, { status: 500 })
  }
}
