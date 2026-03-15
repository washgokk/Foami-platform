import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const body = await req.text()
    const sig = req.headers.get('stripe-signature')!
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

    let event
    try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object as any
        const supabase = createServiceClient()
        const bookingId = pi.metadata.booking_id
        const paymentType = pi.metadata.type // 'additional_payment' or undefined

        if (paymentType === 'additional_payment') {
            await supabase
                .from('bookings')
                .update({ 
                    is_additional_paid: true, 
                    additional_payment_stripe_id: pi.id 
                })
                .eq('id', bookingId)
        } else {
            // Initial Booking Payment
            await supabase
                .from('bookings')
                .update({ 
                    payment_status: 'paid', 
                    status: 'pending',
                    stripe_payment_id: pi.id 
                })
                .eq('id', bookingId)
        }
    }

    return NextResponse.json({ received: true })
}
