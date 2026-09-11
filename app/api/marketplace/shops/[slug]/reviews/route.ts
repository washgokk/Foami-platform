import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    const supabase = createServiceClient()
    const { slug } = await context.params

    // 1. Resolve branch id
    const { data: branch } = await supabase
        .from('branches')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()

    if (!branch) {
        return NextResponse.json({ reviews: [] })
    }

    // 2. Fetch bookings with ratings for this branch
    const { data: bookings } = await supabase
        .from('bookings')
        .select('id, rating, review_comment, review_photos, updated_at, created_at, customer_id')
        .eq('branch_id', branch.id)
        .gt('rating', 0)
        .order('created_at', { ascending: false })
        .limit(15)

    if (!bookings || bookings.length === 0) {
        return NextResponse.json({ reviews: [] })
    }

    // 3. Fetch customer names
    const customerIds = [...new Set(bookings.map(b => b.customer_id).filter(Boolean))]
    let customerMap = new Map()
    if (customerIds.length > 0) {
        const { data: customers } = await supabase
            .from('customers')
            .select('id, full_name')
            .in('id', customerIds)
        if (customers) {
            customers.forEach(c => customerMap.set(c.id, c.full_name))
        }
    }

    const reviews = bookings.map(b => ({
        id: b.id,
        rating: b.rating,
        comment: b.review_comment || '????????? ???????????????',
        photos: b.review_photos || [],
        created_at: b.updated_at || b.created_at,
        customer_name: customerMap.get(b.customer_id) || '????????????'
    }))

    return NextResponse.json({ reviews })
}
