import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const { email, password } = await req.json()
    const supabase = createServiceClient()

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })

    const { data: staffData } = await supabase.from('staff').select('*').eq('id', data.user.id).single()
    if (!staffData) return NextResponse.json({ error: 'ไม่พบบัญชีพนักงาน' }, { status: 404 })

    return NextResponse.json({ token: data.session?.access_token, staff: staffData })
}
