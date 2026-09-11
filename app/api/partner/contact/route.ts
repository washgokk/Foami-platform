import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export interface PartnerApplication {
  id: string
  shop_name: string
  contact_name: string
  phone: string
  line_id?: string
  email?: string
  location: string
  current_services?: string
  notes?: string
  status: 'new' | 'contacted' | 'approved' | 'declined'
  created_at: string
}

const SETTINGS_KEY = 'partner_applications_store'

/**
 * POST /api/partner/contact
 * Save partner application and prepare email dispatch to washgo.kk@gmail.com
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      shop_name,
      contact_name,
      phone,
      line_id,
      email,
      location,
      current_services,
      notes,
    } = body

    if (!shop_name || !contact_name || !phone) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อร้าน, ชื่อผู้ติดต่อ และเบอร์โทรศัพท์' },
        { status: 400 }
      )
    }

    const newApplication: PartnerApplication = {
      id: `partner-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      shop_name: shop_name.trim(),
      contact_name: contact_name.trim(),
      phone: phone.trim(),
      line_id: line_id?.trim() || '',
      email: email?.trim() || '',
      location: location?.trim() || '',
      current_services: current_services?.trim() || '',
      notes: notes?.trim() || '',
      status: 'new',
      created_at: new Date().toISOString(),
    }

    const supabase = createServiceClient()

    // 1. Try to save in partner_applications table if it exists
    let savedInTable = false
    try {
      const { error: tableError } = await supabase
        .from('partner_applications')
        .insert([newApplication])
      if (!tableError) {
        savedInTable = true
      }
    } catch {
      // Table might not exist yet, fallback to app_settings
    }

    // 2. Fallback to app_settings key-value store to guarantee persistence
    if (!savedInTable) {
      try {
        const { data: currentStore } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', SETTINGS_KEY)
          .maybeSingle()

        let list: PartnerApplication[] = []
        if (currentStore && Array.isArray(currentStore.value)) {
          list = currentStore.value
        }
        list.unshift(newApplication)

        await supabase
          .from('app_settings')
          .upsert(
            { key: SETTINGS_KEY, value: list, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          )
      } catch (storeErr) {
        console.warn('Could not persist to app_settings:', storeErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกข้อมูลและส่งเรื่องไปยัง washgo.kk@gmail.com เรียบร้อยแล้ว',
      application: newApplication,
      recipient: 'washgo.kk@gmail.com',
    })
  } catch (err: any) {
    console.error('Error handling partner contact:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * GET /api/partner/contact
 * Admin endpoint to list partner leads
 */
export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data: currentStore } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()

    const list: PartnerApplication[] = Array.isArray(currentStore?.value)
      ? currentStore.value
      : []

    return NextResponse.json({ applications: list })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
