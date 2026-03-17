import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    try {
        const { user_id, subscription, platform } = await req.json()
        const supabase = createServiceClient()

        // Extract endpoint for unique identification of this specific device/browser
        const endpoint = subscription?.endpoint
        if (!endpoint) {
            return NextResponse.json({ error: 'Missing subscription endpoint' }, { status: 400 })
        }

        // Store or update subscription
        // We now allow multiple devices per user by using the endpoint as the conflict target
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id,
                subscription,
                platform,
                endpoint,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'endpoint'
            })

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Push subscribe error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            hint: error.hint
        })
        return NextResponse.json({ 
            error: `Database error: ${error.message}`,
            details: error.hint || 'No additional hints'
        }, { status: 500 })
    }
}
