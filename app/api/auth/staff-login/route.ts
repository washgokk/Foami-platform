import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const { email, password, branch_slug } = await req.json()
    const supabase = createServiceClient()

    if (!email || !password) {
        return NextResponse.json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' }, { status: 400 })
    }

    // Single session token generation to prevent concurrent logins
    const sessionToken = 'ses_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now()

    // 1. Check legacy staff record
    let query = supabase
        .from('staff')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .eq('password', password)
        .eq('is_active', true)

    const { data: staffList, error: legacyErr } = await query

    let staffRecord = staffList?.[0]
    if (staffList && staffList.length > 1 && branch_slug) {
        const { data: b } = await supabase.from('branches').select('id').eq('slug', branch_slug).maybeSingle()
        if (b) {
            const match = staffList.find(s => s.branch_id === b.id)
            if (match) staffRecord = match
        }
    }

    if (!legacyErr && staffRecord) {
        // Enforce single active session per staff by recording in branch features
        if (staffRecord.branch_id) {
            try {
                const { data: curBranch } = await supabase
                    .from('branches')
                    .select('features')
                    .eq('id', staffRecord.branch_id)
                    .maybeSingle()
                
                const curFeat = (curBranch?.features && typeof curBranch.features === 'object') ? curBranch.features : {}
                const staffSessions = { ...(curFeat.staff_sessions || {}) }
                staffSessions[staffRecord.id] = sessionToken

                await supabase
                    .from('branches')
                    .update({ features: { ...curFeat, staff_sessions: staffSessions } })
                    .eq('id', staffRecord.branch_id)
            } catch (err) {
                console.warn('Failed to update staff session token:', err)
            }
        }

        const token = `legacy_staff_${staffRecord.id}_${Date.now()}`
        return NextResponse.json({
            token,
            session_token: sessionToken,
            staff: staffRecord,
            auth_type: 'legacy'
        })
    }

    // 2. Supabase Auth fallback
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })

    const { data: staffData } = await supabase.from('staff').select('*')
        .or(`id.eq.${data.user.id},email.eq.${email.trim().toLowerCase()}`).maybeSingle()

    if (!staffData) return NextResponse.json({ error: 'ไม่พบข้อมูลพนักงาน' }, { status: 404 })
    if (!staffData.is_active) return NextResponse.json({ error: 'บัญชีนี้ถูกระงับ' }, { status: 403 })

    if (staffData.branch_id) {
        try {
            const { data: curBranch } = await supabase
                .from('branches')
                .select('features')
                .eq('id', staffData.branch_id)
                .maybeSingle()
            
            const curFeat = (curBranch?.features && typeof curBranch.features === 'object') ? curBranch.features : {}
            const staffSessions = { ...(curFeat.staff_sessions || {}) }
            staffSessions[staffData.id] = sessionToken

            await supabase
                .from('branches')
                .update({ features: { ...curFeat, staff_sessions: staffSessions } })
                .eq('id', staffData.branch_id)
        } catch (err) {
            console.warn('Failed to update staff session token:', err)
        }
    }

    return NextResponse.json({
        token: data.session?.access_token,
        session_token: sessionToken,
        staff: staffData,
        auth_type: 'supabase'
    })
}
