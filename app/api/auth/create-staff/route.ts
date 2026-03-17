import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const { email, password, full_name, phone, branch_id, role, image_url } = await req.json()
    const supabase = createServiceClient()

    // Create Supabase auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

    // Store the profile data in the staff table
    const { error: staffErr } = await supabase.from('staff').insert({ 
        id: authData.user.id,
        email, 
        password, 
        full_name, 
        phone, 
        branch_id, 
        role, 
        image_url,
        is_active: true 
    })
    if (staffErr) return NextResponse.json({ error: staffErr.message }, { status: 400 })

    return NextResponse.json({ id: authData.user.id })
}
