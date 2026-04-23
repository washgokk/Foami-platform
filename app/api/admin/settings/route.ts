import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
    try {
        const supabase = createServiceClient()
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'notification_preferences')
            .single()

        if (error && error.code !== 'PGRST116') {
            throw error
        }

        return NextResponse.json({ settings: data?.value || null })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const { settings } = await req.json()
        const supabase = createServiceClient()
        
        const { error } = await supabase
            .from('system_settings')
            .upsert({ 
                key: 'notification_preferences', 
                value: settings,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' })

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Save settings error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
