import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
    try {
        const { paymentIntentId, reason } = await req.json()

        if (!paymentIntentId) {
            return NextResponse.json({ error: 'Missing paymentIntentId' }, { status: 400 })
        }

        // Create a full refund for the payment intent
        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            reason: reason || 'duplicate', // 'duplicate' = booking failed after payment
        })

        console.log(`[Stripe Refund] Created refund ${refund.id} for PaymentIntent ${paymentIntentId}, status: ${refund.status}`)

        return NextResponse.json({ 
            success: true, 
            refund_id: refund.id, 
            status: refund.status 
        })
    } catch (err: any) {
        console.error('[Stripe Refund] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
