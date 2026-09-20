import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabaseAdmin = createServiceClient()

const DEFAULT_PACKAGES = {
  starter: {
    id: 'starter',
    name: 'Starter Plan',
    monthly_fee: 0,
    yearly_fee: 0,
    commission_pct: 15,
    features: ['พื้นที่บริการสูงสุด 2 โซน', 'ฟีเจอร์จองคิวมาตรฐาน', 'สัญญาแบบต่อเดือน ไม่มีผูกมัด']
  },
  pro: {
    id: 'pro',
    name: 'Pro Partner Plan',
    monthly_fee: 350,
    yearly_fee: 3500,
    commission_pct: 10,
    features: ['สร้างพื้นที่บริการได้สูงสุด 100 ตร.กม.', 'ลดค่าคอมมิชชั่นเหลือ 10%', 'ตราสัญลักษณ์ Verified Partner', 'แนะนำบนหน้าแรก Marketplace']
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise 0% Plan',
    monthly_fee: 790,
    yearly_fee: 7900,
    commission_pct: 0,
    features: ['ฟรีค่าคอมมิชชั่น 0% ตลอดอายุสัญญา', 'เก็บรายได้ค่าล้างรถเต็ม 100%', 'พื้นที่บริการเต็มพิกัด 100 ตร.กม.', 'รองรับระบบต่อ พ.ร.บ./ประกันภัย']
  }
}

// GET /api/platform/packages — get current platform packages configuration
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value, updated_at')
      .eq('key', 'platform_packages_config')
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.warn('Failed to load packages from app_settings:', error)
    }

    const packages = data?.value || DEFAULT_PACKAGES
    const updated_at = data?.updated_at || null
    return NextResponse.json({ success: true, packages, updated_at })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// POST /api/platform/packages — update platform packages configuration by Super Admin
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { packages } = body

    if (!packages || !packages.starter || !packages.pro || !packages.enterprise) {
      return NextResponse.json({ success: false, error: 'Invalid packages payload' }, { status: 400 })
    }

    // Sanitize and ensure numeric values
    const sanitizedPackages = {
      starter: {
        ...DEFAULT_PACKAGES.starter,
        ...packages.starter,
        monthly_fee: Number(packages.starter.monthly_fee) || 0,
        yearly_fee: Number(packages.starter.yearly_fee) || 0,
        commission_pct: Number(packages.starter.commission_pct) || 0,
      },
      pro: {
        ...DEFAULT_PACKAGES.pro,
        ...packages.pro,
        monthly_fee: Number(packages.pro.monthly_fee) || 350,
        yearly_fee: Number(packages.pro.yearly_fee) || 3500,
        commission_pct: Number(packages.pro.commission_pct) || 10,
      },
      enterprise: {
        ...DEFAULT_PACKAGES.enterprise,
        ...packages.enterprise,
        monthly_fee: Number(packages.enterprise.monthly_fee) || 790,
        yearly_fee: Number(packages.enterprise.yearly_fee) || 7900,
        commission_pct: Number(packages.enterprise.commission_pct) || 0,
      }
    }

    const { error } = await supabaseAdmin.from('app_settings').upsert({
      key: 'platform_packages_config',
      value: sanitizedPackages,
      updated_at: new Date().toISOString()
    })

    if (error) throw error

    return NextResponse.json({ success: true, packages: sanitizedPackages })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
