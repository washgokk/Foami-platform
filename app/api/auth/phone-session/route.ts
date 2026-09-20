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
        const email = (body.email || '').trim().toLowerCase()
        const fullName = body.fullName || ''
        const googleId = body.googleId || null

        if (!rawPhone && !email) {
            return NextResponse.json({ error: 'กรุณาระบุหมายเลขโทรศัพท์หรืออีเมล' }, { status: 400 })
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

        // 1. Check if customer exists by google_id, email, or phone (Universal Key Matching)
        const orConditions: string[] = []
        if (googleId) orConditions.push(`google_id.eq.${googleId}`)
        if (email) orConditions.push(`email.eq.${email}`)
        if (digits) {
            orConditions.push(`phone.eq.${localFormat}`, `phone.eq.${e164Format}`, `phone.eq.${digits}`)
        }

        let query = supabaseAdmin.from('customers').select('*')
        if (orConditions.length > 0) {
            query = query.or(orConditions.join(','))
        }

        const { data: existingCustomers, error: searchError } = await query
            .order('created_at', { ascending: false })
            .limit(1)

        if (searchError) {
            console.error('[Phone Session] Error searching customer:', searchError)
        }

        let customer = existingCustomers?.[0]

        if (customer) {
            // Customer exists! Update missing credentials if newly provided
            const updates: any = {}
            if (googleId && !customer.google_id) updates.google_id = googleId
            if (email && !customer.email) updates.email = email
            if (localFormat && !customer.phone) updates.phone = localFormat
            if (fullName && (!customer.full_name || customer.full_name.startsWith('ลูกค้า '))) {
                updates.full_name = fullName
            }
            if (Object.keys(updates).length > 0) {
                await supabaseAdmin.from('customers').update(updates).eq('id', customer.id)
                customer = { ...customer, ...updates }
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
            phone: localFormat || null,
            email: email || null,
            full_name: fullName.trim() || (email ? email.split('@')[0] : `ลูกค้า ${localFormat.slice(-4)}`),
            auth_provider: googleId ? 'google' : (email ? 'email' : 'phone'),
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
