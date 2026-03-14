import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const { id, full_name, phone, branch_id, role, password, email, bank_account_number, bank_name, promptpay_number } = await req.json()
    const supabase = createServiceClient()

    try {
        // 1. Update Auth User if password or email is provided
        const authUpdates: any = {}
        if (password && password.trim() !== '') authUpdates.password = password.trim()
        if (email && email.trim() !== '') authUpdates.email = email.trim()

        if (Object.keys(authUpdates).length > 0) {
            const { error: authErr } = await supabase.auth.admin.updateUserById(id, authUpdates)
            if (authErr) throw authErr
        }

        // 2. Update Staff Table
        const updateData: any = {
            full_name,
            phone,
            branch_id,
            role,
            email,
            bank_account_number,
            bank_name,
            promptpay_number
        }
        
        // Also store the "viewable" password in the staff table as requested
        if (password && password.trim() !== '') {
            updateData.password = password.trim()
        }

        const { error: staffErr } = await supabase
            .from('staff')
            .update(updateData)
            .eq('id', id)

        if (staffErr) throw staffErr

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 })
    }
}
