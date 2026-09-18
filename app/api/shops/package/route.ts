import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabaseAdmin = createServiceClient()

const DEFAULT_PACKAGES: any = {
  starter: {
    id: 'starter',
    name: 'Starter Plan',
    monthly_fee: 0,
    yearly_fee: 0,
    commission_pct: 15,
    features: ['พื้นที่บริการสูงสุด 2 โซน', 'ฟีเจอร์จองคิวมาตรฐาน', 'สัญญาแบบต่อเดือน ไม่มีผูกมัด'],
    durations: [1, 6, 12]
  },
  pro: {
    id: 'pro',
    name: 'Pro Partner Plan',
    monthly_fee: 350,
    yearly_fee: 3500,
    commission_pct: 10,
    features: ['สร้างพื้นที่บริการได้สูงสุด 100 ตร.กม.', 'ลดค่าคอมมิชชั่นเหลือ 10%', 'ตราสัญลักษณ์ Verified Partner', 'แนะนำบนหน้าแรก Marketplace'],
    durations: [1, 6, 12]
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise 0% Plan',
    monthly_fee: 790,
    yearly_fee: 7900,
    commission_pct: 0,
    features: ['ฟรีค่าคอมมิชชั่น 0% ตลอดอายุสัญญา', 'เก็บรายได้ค่าล้างรถเต็ม 100%', 'พื้นที่บริการเต็มพิกัด 100 ตร.กม.', 'รองรับระบบต่อ พ.ร.บ./ประกันภัย'],
    durations: [1, 6, 12]
  }
}

async function getActivePackages() {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'platform_packages_config')
      .maybeSingle()
    if (data?.value) {
      return data.value
    }
  } catch (e) {
    console.warn('Failed to load dynamic packages, using defaults', e)
  }
  return DEFAULT_PACKAGES
}

// GET /api/shops/package?branchId=xxx — fetch current contract & available packages
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const branchId = url.searchParams.get('branchId') || url.searchParams.get('branch_id')
  if (!branchId) return NextResponse.json({ error: 'branchId is required' }, { status: 400 })

  const { data: branch, error } = await supabaseAdmin
    .from('branches')
    .select('id, name, slug, platform_fee_pct, features')
    .eq('id', branchId)
    .single()

  if (error || !branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })

  const curFeatures = (branch.features && typeof branch.features === 'object') ? branch.features : {}
  const contract = curFeatures.contract || null

  const isLocked = Boolean(
    contract?.is_locked &&
    contract?.end_date &&
    new Date(contract.end_date) > new Date()
  )

  const activePackages = await getActivePackages()

  return NextResponse.json({
    success: true,
    packages: activePackages,
    current_plan: curFeatures.plan_tier || 'starter',
    current_commission_pct: branch.platform_fee_pct !== undefined && branch.platform_fee_pct !== null
      ? (Number(branch.platform_fee_pct) <= 1 ? Math.round(Number(branch.platform_fee_pct) * 100) : Number(branch.platform_fee_pct))
      : 15,
    contract,
    is_contract_locked: isLocked
  })
}

// POST /api/shops/package — subscribe, pay and lock contract
export async function POST(req: NextRequest) {
  const body = await req.json()
  const branchId = body.branchId || body.branch_id
  const packageId = body.packageId || body.plan_tier
  const durationMonths = parseInt(body.months || body.duration_months || '1', 10)
  const paymentMethod = body.paymentMethod || 'promptpay_qr'

  if (!branchId || !packageId) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
  }

  const activePackages = await getActivePackages()
  const pkg = activePackages[packageId]
  if (!pkg) return NextResponse.json({ error: 'Invalid package' }, { status: 400 })

  const { data: branch, error: bErr } = await supabaseAdmin
    .from('branches')
    .select('id, name, slug, platform_fee_pct, features')
    .eq('id', branchId)
    .single()

  if (bErr || !branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })

  const curFeatures = (branch.features && typeof branch.features === 'object') ? branch.features : {}
  const curContract = curFeatures.contract || {}

  // Check if current contract is still active and locked
  if (curContract.is_locked && curContract.end_date && new Date(curContract.end_date) > new Date()) {
    return NextResponse.json({
      error: `ร้านค้ามีสัญญาที่ยังใช้งานอยู่และถูกล็อคจนถึง ${new Date(curContract.end_date).toLocaleDateString('th-TH')} หากต้องการเปลี่ยนแปลงกรุณาติดต่อผู้ดูแลระบบ`
    }, { status: 400 })
  }

  // Calculate payment (apply yearly discount if 12 months)
  let totalAmount = 0
  if (durationMonths === 12 && pkg.yearly_fee !== undefined) {
    totalAmount = pkg.yearly_fee
  } else {
    totalAmount = (pkg.monthly_fee || 0) * durationMonths
  }

  const startDate = new Date()
  const endDate = new Date()
  endDate.setMonth(endDate.getMonth() + durationMonths)

  const paymentId = `pi_pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // Commission is stored as percentage e.g. 10 or 0.10
  const commissionPct = pkg.commission_pct !== undefined ? Number(pkg.commission_pct) : 15

  const newContract = {
    plan: pkg.id || packageId,
    package_name: pkg.name,
    commission_pct: commissionPct,
    months: durationMonths,
    amount_paid: totalAmount,
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    paid_at: new Date().toISOString(),
    payment_id: paymentId,
    payment_method: paymentMethod,
    is_locked: true, // IMMUTABLE CONTRACT LOCK
    locked_note: 'สัญญาถูกล็อคเนื่องจากชำระเงินเรียบร้อยแล้ว แอดมินไม่สามารถแก้ไขค่าคอมมิชชั่นได้จนกว่าจะสิ้นสุดสัญญา'
  }

  const nextFeatures = {
    ...curFeatures,
    plan_tier: pkg.id || packageId,
    contract: newContract
  }

  const { error: updateErr } = await supabaseAdmin
    .from('branches')
    .update({
      platform_fee_pct: commissionPct > 1 ? commissionPct / 100 : commissionPct,
      features: nextFeatures
    })
    .eq('id', branchId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `ชำระเงินและเปิดใช้งานสัญญาสำเร็จ ค่าคอมมิชชั่นถูกปรับเป็น ${commissionPct}% และล็อคสัญญาเรียบร้อยแล้ว`,
    contract: newContract
  })
}
