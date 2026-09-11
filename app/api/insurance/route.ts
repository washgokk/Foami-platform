import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * GET /api/insurance - รายการต่อพรบของ branch
 * POST /api/insurance - สร้างรายการต่อพรบใหม่
 */

export async function GET(req: NextRequest) {
    const supabase = createServiceClient()
    const { searchParams } = new URL(req.url)
    const branch_id = searchParams.get('branch_id')
    const customer_id = searchParams.get('customer_id')
    const status = searchParams.get('status')

    let query = supabase.from('vehicle_insurance_renewals').select('*').order('created_at', { ascending: false })

    if (branch_id) query = query.eq('branch_id', branch_id)
    if (customer_id) query = query.eq('customer_id', customer_id)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ renewals: data || [] })
}

export async function POST(req: NextRequest) {
    const supabase = createServiceClient()

    try {
        const body = await req.json()
        const {
            customer_id, branch_id,
            license_plate, vehicle_brand, vehicle_model, vehicle_year,
            vehicle_age_over_5, insurance_type, current_expiry,
            tax_expired, tax_expired_years,
            pickup_address, pickup_lat, pickup_lng,
            scheduled_date, scheduled_time,
            customer_note
        } = body

        if (!customer_id || !branch_id || !license_plate) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Check branch has insurance feature enabled
        const { data: branch } = await supabase
            .from('branches')
            .select('features')
            .eq('id', branch_id)
            .single()

        if (!branch?.features?.insurance_renewal) {
            return NextResponse.json({ error: 'This branch does not offer insurance renewal service' }, { status: 403 })
        }

        // Calculate needs_inspection and service_fee
        const needsInspection = Boolean(vehicle_age_over_5) || Number(tax_expired_years) >= 1
        // Pricing: standard=100, inspection=150 (can be overridden by branch config)
        const feeStandard = branch?.features?.insurance_fee_standard || 100
        const feeInspection = branch?.features?.insurance_fee_inspection || 150
        const serviceFee = needsInspection ? feeInspection : feeStandard
        // Deposit = full service fee upfront (ค่าบริการ + เอกสาร)
        const depositAmount = serviceFee
        const remainingAmount = 0  // ส่วนที่เหลือ = ค่าภาษี/พรบ จริงๆ (แจ้งทีหลัง)

        const { data: renewal, error: insertError } = await supabase
            .from('vehicle_insurance_renewals')
            .insert({
                customer_id, branch_id,
                license_plate, vehicle_brand, vehicle_model, vehicle_year,
                vehicle_age_over_5: Boolean(vehicle_age_over_5),
                insurance_type: insurance_type || 'compulsory',
                current_expiry,
                tax_expired: Boolean(tax_expired),
                tax_expired_years: Number(tax_expired_years) || 0,
                needs_inspection: needsInspection,
                pickup_address, pickup_lat, pickup_lng,
                scheduled_date, scheduled_time,
                service_fee: serviceFee,
                deposit_amount: depositAmount,
                remaining_amount: remainingAmount,
                customer_note,
                status: 'pending'
            })
            .select()
            .single()

        if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })

        return NextResponse.json({ renewal, needs_inspection: needsInspection, service_fee: serviceFee })

    } catch (err: any) {
        console.error('[Insurance API] Error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

/**
 * PATCH /api/insurance - อัปเดตสถานะ (สำหรับ Shop Admin)
 */
export async function PATCH(req: NextRequest) {
    const supabase = createServiceClient()
    try {
        const body = await req.json()
        const { id, status, staff_note, remaining_amount, remaining_paid, remaining_slip_url, document_urls } = body

        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

        const updates: any = { updated_at: new Date().toISOString() }
        if (status) updates.status = status
        if (staff_note !== undefined) updates.staff_note = staff_note
        if (remaining_amount !== undefined) updates.remaining_amount = remaining_amount
        if (remaining_paid !== undefined) updates.remaining_paid = remaining_paid
        if (remaining_slip_url) updates.remaining_slip_url = remaining_slip_url
        if (document_urls) updates.document_urls = document_urls

        const { data, error } = await supabase
            .from('vehicle_insurance_renewals')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json({ renewal: data })

    } catch (err: any) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}