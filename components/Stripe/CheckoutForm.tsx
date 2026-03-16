'use client'
import React, { useState } from 'react'
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

interface CheckoutFormProps {
    amount: number
    customerEmail?: string
    onSuccess: (paymentIntentId: string) => void
    onCancel: () => void
}

export default function CheckoutForm({ amount, customerEmail, onSuccess, onCancel }: CheckoutFormProps) {
    const stripe = useStripe()
    const elements = useElements()
    const [isProcessing, setIsProcessing] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!stripe || !elements) return

        setIsProcessing(true)
        setErrorMessage(null)

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            redirect: 'if_required',
            confirmParams: {
                payment_method_data: {
                    billing_details: {
                        email: customerEmail || 'customer@foami-app.com' // Fallback to satisfy Stripe if hidden
                    }
                }
            }
        })

        if (error) {
            setErrorMessage(error.message || 'เกิดข้อผิดพลาดในการชำระเงิน')
            setIsProcessing(false)
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            onSuccess(paymentIntent.id)
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <PaymentElement options={{ 
                fields: {
                    billingDetails: {
                        email: 'never'
                    }
                }
            }} />
            {errorMessage && <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{errorMessage}</div>}
            
            <div style={{ display: 'flex' }}>
                <button 
                    type="submit" 
                    className="btn btn-primary btn-full" 
                    disabled={!stripe || isProcessing}
                >
                    {isProcessing ? <span className="spinner" /> : `ชำระเงิน ฿${amount.toLocaleString()}`}
                </button>
            </div>
        </form>
    )
}
