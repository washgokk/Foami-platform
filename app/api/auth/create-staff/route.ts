import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const { email, password } = await req.json()
    const supabase = createServiceClient()

    // Create Supabase auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

    // Store the email and password in the staff table as well for visibility in admin
    await supabase.from('staff').update({ email, password }).eq('id', authData.user.id)

    return NextResponse.json({ user_id: authData.user.id })
}
