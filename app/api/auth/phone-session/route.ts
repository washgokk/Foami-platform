import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateScalableId } from '@/lib/id-utils'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const rawPhone = body.phone || ''
        const fullName = body.fullName || ''
        const googleId = body.googleId || null

        if (!rawPhone) {
            return NextResponse.json({ error: 'กรุณาระบุหมายเลขโทรศัพท์' }, { status: 400 })
        }

        // Clean digits
        const digits = rawPhone.replace(/\D/g, '')
        let localFormat = digits
        let e164Format = digits

        if (digits.startsWith('66')) {
            localFormat = `0${digits.slice(2)}`
            e164Format = `+${digits}`
        } else if (digits.startsWith('0')) {
            localFormat = digits
            e164Format = `+66${digits.slice(1)}`
        }

        // 1. Check if customer exists with this phone number (Universal Key Matching)
        const { data: existingCustomers, error: searchError } = await supabaseAdmin
            .from('customers')
            .select('*')
            .or(`phone.eq.${localFormat},phone.eq.${e164Format},phone.eq.${digits}`)
            .order('created_at', { ascending: false })
            .limit(1)

        if (searchError) {
            console.error('[Phone Session] Error searching customer:', searchError)
        }

        let customer = existingCustomers?.[0]

        if (customer) {
            // Customer exists! Update auth_provider or google_id if newly provided
            if (googleId && !customer.google_id) {
                await supabaseAdmin
                    .from('customers')
                    .update({ google_id: googleId, auth_provider: 'google' })
                    .eq('id', customer.id)
                customer.google_id = googleId
            }
            return NextResponse.json({
                success: true,
                isNew: false,
                customer
            })
        }

        // 2. New Customer Registration
        const newCustomerId = generateScalableId('CU')
        const newCustomerData = {
            id: newCustomerId,
            phone: localFormat,
            full_name: fullName.trim() || `ลูกค้า ${localFormat.slice(-4)}`,
            auth_provider: googleId ? 'google' : 'phone',
            google_id: googleId,
            line_user_id: null,
            saved_vehicles: [],
            saved_locations: [],
            created_at: new Date().toISOString()
        }

        const { data: createdCustomer, error: insertError } = await supabaseAdmin
            .from('customers')
            .insert(newCustomerData)
            .select()
            .single()

        if (insertError) {
            console.error('[Phone Session] Error creating customer:', insertError)
            return NextResponse.json({ error: insertError.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            isNew: true,
            customer: createdCustomer
        })
    } catch (e: any) {
        console.error('[Phone Session] Fatal error:', e)
        return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
    }
}
