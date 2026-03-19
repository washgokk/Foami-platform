import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    try {
        // v42: Parse body ONCE to avoid req.json() double-read bug
        const body = await req.json()
        const { bridgeId, customerData, branchSlug } = body

        if (!bridgeId || !customerData) {
            return NextResponse.json({ error: 'Missing bridgeId or customerData' }, { status: 400 })
        }

        const supabase = createServiceClient()

        console.log(`[Bridge Sync] Attempting to sync ID: ${bridgeId} for user: ${customerData.line_user_id}`)

        // 1. Update Customer's Last Branch in DB
        if (branchSlug) {
            await supabase
                .from('customers')
                .update({ last_branch_slug: branchSlug })
                .eq('line_user_id', customerData.line_user_id)
        }

        // 2. Upsert the data into the bridge table
        const { error } = await supabase
            .from('pwa_auth_bridges')
            .upsert({ 
                id: bridgeId, 
                customer_data: { ...customerData, last_branch_slug: branchSlug || customerData.last_branch_slug },
                created_at: new Date().toISOString()
            })

        if (error) {
            console.error('[Bridge Sync] Supabase Error:', error)
            throw error
        }

        console.log(`[Bridge Sync] Success for ID: ${bridgeId}`)

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[Bridge Sync] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
