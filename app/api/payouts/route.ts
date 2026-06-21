import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const staff_id = formData.get('staff_id') as string
        const amount = parseFloat(formData.get('amount') as string)
        const extra_costs = parseFloat(formData.get('extra_costs') as string)
        const start_date = formData.get('start_date') as string
        const end_date = formData.get('end_date') as string
        const notes = formData.get('notes') as string
        const slip = formData.get('slip') as File | null
        const booking_ids_str = formData.get('booking_ids') as string // JSON array
        const booking_ids = booking_ids_str ? JSON.parse(booking_ids_str) : []

        if (!staff_id || isNaN(amount)) {
            return NextResponse.json({ error: 'Data incomplete' }, { status: 400 })
        }

        const supabase = createServiceClient()
        let slip_url: string | null = null

        if (slip) {
            try {
                const fileExt = slip.name.split('.').pop()
                const fileName = `${staff_id}_${Date.now()}.${fileExt}`
                const filePath = `slips/${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('staff_payouts')
                    .upload(filePath, slip)

                if (uploadError) {
                    // Non-fatal: log the error but continue saving the payout record
                    console.error('Payout slip upload failed (non-fatal):', uploadError.message)
                } else {
                    const { data: { publicUrl } } = supabase.storage
                        .from('staff_payouts')
                        .getPublicUrl(filePath)
                    slip_url = publicUrl
                }
            } catch (uploadErr: any) {
                console.error('Payout slip upload exception (non-fatal):', uploadErr.message)
            }
        }

        const { data: payout, error: payoutError } = await supabase
            .from('staff_payouts')
            .insert({
                staff_id,
                amount,
                extra_costs,
                start_date,
                end_date,
                notes,
                slip_url,
                booking_ids: booking_ids, // store for fallback lookup
                status: 'completed'
            })
            .select()
            .single()

        if (payoutError) throw payoutError

        // Link bookings to this payout via payout_id column
        if (booking_ids.length > 0) {
            const { error: linkError } = await supabase
                .from('bookings')
                .update({ payout_id: payout.id })
                .in('id', booking_ids)
            
            // Non-fatal: if payout_id column doesn't exist yet, log but don't fail
            if (linkError) {
                console.error('Booking payout_id link failed (non-fatal):', linkError.message)
            }
        }

        return NextResponse.json(payout)
    } catch (err: any) {
        console.error('Payout Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
