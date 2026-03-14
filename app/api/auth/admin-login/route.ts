import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const { email, password } = await req.json()
    const supabase = createServiceClient()

    // Authenticate via Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
        return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
    }

    // Check admin role
    const { data: staffData } = await supabase.from('staff').select('role').eq('id', data.user.id).single()
    if (!staffData || staffData.role !== 'admin') {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าใช้งาน' }, { status: 403 })
    }

    return NextResponse.json({ token: data.session?.access_token, user: data.user })
}
