import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export interface IncidentReport {
  id: string
  report_number: string
  report_type: 'shop' | 'order' | 'customer_issue' | 'payment' | 'general'
  branch_id?: string | null
  shop_slug?: string | null
  shop_name?: string | null
  booking_id?: string | null
  booking_number?: string | null
  customer_id?: string | null
  customer_name: string
  customer_phone: string
  customer_email?: string | null
  customer_line_id?: string | null
  title: string
  category: string
  description: string
  evidence_photos: string[]
  severity: 'low' | 'normal' | 'high' | 'critical'
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed' | 'refunded'
  admin_notes?: string | null
  resolved_by?: string | null
  resolved_at?: string | null
  created_at: string
  updated_at: string
}

const SETTINGS_KEY = 'incident_reports_store'

// Helper to generate a unique readable report number
function generateReportNumber(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `RPT-${yy}${mm}-${rand}`
}

/**
 * GET /api/reports
 * Query incident reports with filters
 */
export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)

  const branch_id = searchParams.get('branch_id')
  const shop_slug = searchParams.get('shop_slug')
  const report_type = searchParams.get('report_type')
  const status = searchParams.get('status')
  const search = searchParams.get('search')?.toLowerCase()

  try {
    // 1. Try querying incident_reports table
    let query = supabase
      .from('incident_reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (branch_id) query = query.eq('branch_id', branch_id)
    if (shop_slug) query = query.eq('shop_slug', shop_slug)
    if (report_type) query = query.eq('report_type', report_type)
    if (status && status !== 'all') query = query.eq('status', status)

    const { data, error } = await query

    if (!error && Array.isArray(data)) {
      let results = data as IncidentReport[]
      if (search) {
        results = results.filter(r =>
          r.report_number.toLowerCase().includes(search) ||
          r.title.toLowerCase().includes(search) ||
          r.customer_name.toLowerCase().includes(search) ||
          r.customer_phone.includes(search) ||
          (r.shop_name && r.shop_name.toLowerCase().includes(search)) ||
          (r.booking_number && r.booking_number.toLowerCase().includes(search))
        )
      }
      return NextResponse.json({ reports: results, source: 'database' })
    }
  } catch (err) {
    console.warn('incident_reports table error, checking app_settings fallback:', err)
  }

  // 2. Fallback to app_settings
  try {
    const { data: settingData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()

    let reports: IncidentReport[] = Array.isArray(settingData?.value) ? settingData.value : []

    if (branch_id) reports = reports.filter(r => r.branch_id === branch_id)
    if (shop_slug) reports = reports.filter(r => r.shop_slug === shop_slug)
    if (report_type) reports = reports.filter(r => r.report_type === report_type)
    if (status && status !== 'all') reports = reports.filter(r => r.status === status)

    if (search) {
      reports = reports.filter(r =>
        r.report_number.toLowerCase().includes(search) ||
        r.title.toLowerCase().includes(search) ||
        r.customer_name.toLowerCase().includes(search) ||
        r.customer_phone.includes(search) ||
        (r.shop_name && r.shop_name.toLowerCase().includes(search)) ||
        (r.booking_number && r.booking_number.toLowerCase().includes(search))
      )
    }

    return NextResponse.json({ reports, source: 'fallback_settings' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, reports: [] }, { status: 500 })
  }
}

/**
 * POST /api/reports
 * Submit a new incident or complaint report
 */
export async function POST(req: NextRequest) {
  const supabase = createServiceClient()

  try {
    const body = await req.json()
    const {
      report_type = 'customer_issue',
      branch_id,
      shop_slug,
      shop_name,
      booking_id,
      booking_number,
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      customer_line_id,
      title,
      category,
      description,
      evidence_photos = [],
      severity = 'normal'
    } = body

    if (!customer_name || !customer_phone || !title || !description) {
      return NextResponse.json({
        error: 'กรุณากรอกข้อมูลที่จำเป็น: ชื่อผู้แจ้ง, เบอร์โทรศัพท์, หัวข้อปัญหา และรายละเอียด'
      }, { status: 400 })
    }

    // Resolve shop_name or branch_id if missing
    let resolvedShopName = shop_name
    let resolvedBranchId = branch_id
    if (shop_slug && (!resolvedShopName || !resolvedBranchId)) {
      const { data: b } = await supabase
        .from('branches')
        .select('id, name')
        .eq('slug', shop_slug)
        .maybeSingle()
      if (b) {
        resolvedBranchId = resolvedBranchId || b.id
        resolvedShopName = resolvedShopName || b.name
      }
    }

    const newReport: IncidentReport = {
      id: crypto.randomUUID(),
      report_number: generateReportNumber(),
      report_type,
      branch_id: resolvedBranchId || null,
      shop_slug: shop_slug || null,
      shop_name: resolvedShopName || null,
      booking_id: booking_id || null,
      booking_number: booking_number || null,
      customer_id: customer_id || null,
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      customer_email: customer_email?.trim() || null,
      customer_line_id: customer_line_id?.trim() || null,
      title: title.trim(),
      category: category || 'ทั่วไป',
      description: description.trim(),
      evidence_photos: Array.isArray(evidence_photos) ? evidence_photos : [],
      severity,
      status: 'pending',
      admin_notes: null,
      resolved_by: null,
      resolved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // 1. Try insert into database
    let inserted = false
    try {
      const { error } = await supabase.from('incident_reports').insert(newReport)
      if (!error) inserted = true
    } catch {
      inserted = false
    }

    // 2. Also keep synced with fallback app_settings store
    try {
      const { data: settingData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', SETTINGS_KEY)
        .maybeSingle()

      const currentList: IncidentReport[] = Array.isArray(settingData?.value) ? settingData.value : []
      const updatedList = [newReport, ...currentList.filter(r => r.id !== newReport.id)]

      await supabase.from('app_settings').upsert({
        key: SETTINGS_KEY,
        value: updatedList,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
    } catch (fallbackErr) {
      console.error('Error saving to app_settings fallback:', fallbackErr)
    }

    return NextResponse.json({
      success: true,
      report: newReport,
      message: `บันทึกรายงานปัญหาเรียบร้อย หมายเลขเคส: ${newReport.report_number}`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/reports
 * Update report status, admin notes, or resolution
 */
export async function PATCH(req: NextRequest) {
  const supabase = createServiceClient()

  try {
    const body = await req.json()
    const { id, status, admin_notes, severity, resolved_by } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing report id' }, { status: 400 })
    }

    const updates: Partial<IncidentReport> = {
      updated_at: new Date().toISOString()
    }

    if (status) updates.status = status
    if (admin_notes !== undefined) updates.admin_notes = admin_notes
    if (severity) updates.severity = severity
    if (resolved_by) updates.resolved_by = resolved_by

    if (status === 'resolved' || status === 'dismissed' || status === 'refunded') {
      updates.resolved_at = new Date().toISOString()
    }

    // 1. Try updating database table
    try {
      await supabase.from('incident_reports').update(updates).eq('id', id)
    } catch (err) {
      console.warn('DB update failed, using fallback:', err)
    }

    // 2. Update fallback store in app_settings
    const { data: settingData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()

    const currentList: IncidentReport[] = Array.isArray(settingData?.value) ? settingData.value : []
    const updatedList = currentList.map(r => (r.id === id ? { ...r, ...updates } : r))

    await supabase.from('app_settings').upsert({
      key: SETTINGS_KEY,
      value: updatedList,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })

    const updatedItem = updatedList.find(r => r.id === id)

    return NextResponse.json({
      success: true,
      report: updatedItem,
      message: 'อัปเดตรายงานเรียบร้อยแล้ว'
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
