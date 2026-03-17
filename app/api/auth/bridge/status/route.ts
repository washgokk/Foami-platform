import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'Missing bridge ID' }, { status: 400 })
        }

        const supabase = createServiceClient()

        const { data, error } = await supabase
            .from('pwa_auth_bridges')
            .select('customer_data')
            .eq('id', id)
            .maybeSingle()

        if (error) throw error

        if (!data || !data.customer_data) {
            return NextResponse.json({ status: 'pending' })
        }

        return NextResponse.json({ 
            status: 'completed', 
            customerData: data.customer_data 
        })
    } catch (err: any) {
        console.error('[Bridge Status] Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
