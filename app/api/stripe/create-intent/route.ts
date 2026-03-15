import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
    try {
        const { amount, booking_metadata } = await req.json()

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to satang
            currency: 'thb',
            automatic_payment_methods: { enabled: true },
            metadata: booking_metadata || {},
        })

        return NextResponse.json({ clientSecret: paymentIntent.client_secret })
    } catch (err: any) {
        console.error('[Stripe] create-intent error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
