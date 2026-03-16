import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    try {
        const { user_id, subscription, platform } = await req.json()
        const supabase = createServiceClient()

        // Store or update subscription
        // We use upsert to handle multiple devices/sessions for the same user-platform pair
        // Note: In high-scale apps, you'd store many subscriptions per user. 
        // For Foami, we maintain one primary subscription per platform for simplicity.
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id,
                subscription,
                platform,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'user_id, platform'
            })

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Push subscribe error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
