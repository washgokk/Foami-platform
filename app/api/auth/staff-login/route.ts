import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const { email, password } = await req.json()
    const supabase = createServiceClient()

    // BUG-09 FIX: Strategy 1 — Legacy plain-text password (existing staff accounts)
    const { data: legacyStaff, error: legacyErr } = await supabase
        .from('staff')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .eq('is_active', true)
        .maybeSingle()

    if (!legacyErr && legacyStaff) {
        // Generate a simple token for legacy staff
        const token = `legacy_staff__`
        return NextResponse.json({ token, staff: legacyStaff, auth_type: 'legacy' })
    }

    // BUG-09 FIX: Strategy 2 — Supabase Auth (new accounts created via Platform Admin)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })

    const { data: staffData } = await supabase.from('staff').select('*')
        .or(`id.eq.,user_id.eq.`).maybeSingle()

    if (!staffData) return NextResponse.json({ error: 'ไม่พบข้อมูลพนักงาน' }, { status: 404 })
    if (!staffData.is_active) return NextResponse.json({ error: 'บัญชีนี้ถูกระงับ' }, { status: 403 })

    return NextResponse.json({ token: data.session?.access_token, staff: staffData, auth_type: 'supabase' })
}