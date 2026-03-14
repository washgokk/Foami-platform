import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
    const { amount, booking_metadata } = await req.json()

    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to satang
        currency: 'thb',
        metadata: booking_metadata || {},
    })

    return NextResponse.json({ clientSecret: paymentIntent.client_secret })
}
