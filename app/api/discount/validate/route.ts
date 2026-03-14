import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const { code, customerId, basePrice = 0 } = await req.json()
    const supabase = createServiceClient()

    // 1. Fetch discount code
    const { data: discount } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single()

    if (!discount) return NextResponse.json({ error: 'โค้ดไม่ถูกต้องหรือไม่มีการเปิดใช้งาน' }, { status: 404 })

    // 2. Check Expiration
    if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
        return NextResponse.json({ error: 'โค้ดหมดอายุแล้ว' }, { status: 400 })
    }

    // 3. Check Total Uses
    if (discount.max_uses && (discount.used_count || 0) >= discount.max_uses) {
        return NextResponse.json({ error: 'โค้ดถูกใช้ครบสิทธิ์ทั้งหมดแล้ว' }, { status: 400 })
    }

    // 4. Check Customer Caps & Segments (If customer ID is provided)
    if (customerId) {
        // 4.a Check uses per customer
        if (discount.max_uses_per_customer) {
            const { count } = await supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('discount_code', discount.code)
                .eq('customer_id', customerId)
                .neq('status', 'cancelled')

            if (count !== null && count >= discount.max_uses_per_customer) {
                return NextResponse.json({ error: 'คุณใช้สิทธิ์ของโค้ดนี้ครบแล้ว' }, { status: 400 })
            }
        }

        // 4.b Evaluate segment
        if (discount.target_segment && discount.target_segment !== 'all' && discount.target_segment !== '"all"') {
            try {
                const segmentRule = JSON.parse(discount.target_segment)

                // Fetch customer stats for evaluation
                const { data: bookings } = await supabase.from('bookings').select('total_price, created_at, status').eq('customer_id', customerId)
                const validBookings = (bookings || []).filter(b => b.status === 'completed' || b.status === 'paid' || b.status === 'confirmed')

                const stats = {
                    totalVisits: validBookings.length,
                    totalSpent: validBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0),
                    daysSinceLast: validBookings.length > 0
                        ? Math.floor((new Date().getTime() - new Date(Math.max(...validBookings.map(b => new Date(b.created_at).getTime()))).getTime()) / (1000 * 3600 * 24))
                        : 9999
                }

                // Evaluate Rule
                let isMatch = false;
                const metricVal = stats[segmentRule.metric as keyof typeof stats];
                if (segmentRule.operator === '>=') isMatch = metricVal >= segmentRule.value;
                if (segmentRule.operator === '<=') isMatch = metricVal <= segmentRule.value;
                if (segmentRule.operator === '===') isMatch = metricVal === segmentRule.value;

                if (!isMatch) {
                    return NextResponse.json({ error: `โค้ดนี้สงวนสิทธิ์เฉพาะลูกค้าในกลุ่ม "${segmentRule.name}" เท่านั้น` }, { status: 400 })
                }
            } catch (e) {
                // Ignore parsing errors, assume valid or log it
                console.error('Failed to parse target_segment', e)
            }
        }
    }

    // 5. Calculate Discount Amount
    let amountToDiscount = 0
    if (discount.discount_type === 'percent') {
        amountToDiscount = Math.floor(basePrice * (discount.discount_value / 100))
        if (discount.max_discount_amount) {
            amountToDiscount = Math.min(amountToDiscount, discount.max_discount_amount)
        }
    } else if (discount.discount_type === 'fixed') {
        amountToDiscount = discount.discount_value
    }

    // Can't discount more than the base price
    amountToDiscount = Math.min(amountToDiscount, basePrice)

    return NextResponse.json({
        valid: true,
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        discount_amount: amountToDiscount
    })
}
