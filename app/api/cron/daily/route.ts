import { NextRequest, NextResponse } from 'next/server'

// Consolidated daily cron job
export async function GET(req: NextRequest) {
    const auth = req.headers.get('authorization')
    const secret = process.env.CRON_SECRET || 'foami-cron-2025'
    
    if (auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // 1. Run Storage Lifecycle (Aging & Cleanup)
        // We call the existing internal API logic or just trigger the route
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`
        
        const lifecycleResponse = await fetch(`${appUrl}/api/storage/lifecycle`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.STORAGE_CRON_SECRET}`
            }
        })
        const lifecycleResult = await lifecycleResponse.json()

        // 2. Run Auto-assign (Even though it's daily, we check just in case)
        const assignResponse = await fetch(`${appUrl}/api/cron/auto-assign`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${secret}`
            }
        })
        const assignResult = await assignResponse.json()

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            lifecycle: lifecycleResult,
            auto_assign: assignResult
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
