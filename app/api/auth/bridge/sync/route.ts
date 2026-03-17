import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    try {
        const { bridgeId, customerData } = await req.json()

        if (!bridgeId || !customerData) {
            return NextResponse.json({ error: 'Missing bridgeId or customerData' }, { status: 400 })
        }

        const supabase = createServiceClient()

        // Upsert the data into the bridge table
        const { error } = await supabase
            .from('pwa_auth_bridges')
            .upsert({ 
                id: bridgeId, 
                customer_data: customerData,
                created_at: new Date().toISOString()
            })

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[Bridge Sync] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
