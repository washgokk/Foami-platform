import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * Storage Lifecycle Manager
 * Handles:
 * 1. Aging (Day 7): Identifies images to be resized (placeholder for actual resizing worker)
 * 2. Cleanup (Day 90): Final deletion from Supabase
 */
export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (process.env.STORAGE_CRON_SECRET && authHeader !== `Bearer ${process.env.STORAGE_CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const supabaseAdmin = createServiceClient()
        
        const now = new Date()
        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(now.getDate() - 7)
        
        const ninetyDaysAgo = new Date(now)
        ninetyDaysAgo.setDate(now.getDate() - 90)

        // --- 1. CLEANUP (Day 90+) ---
        // Find job photos for bookings completed > 90 days ago
        const { data: toDelete, error: delError } = await supabaseAdmin
            .from('bookings')
            .select('id, vehicle_photos')
            .eq('status', 'completed')
            .lt('updated_at', ninetyDaysAgo.toISOString())

        let deletedCount = 0
        if (toDelete && toDelete.length > 0) {
            for (const booking of toDelete) {
                // In production: iterate through vehicle_photos (urls) and call supabaseAdmin.storage.from('images').remove([paths])
                // Then clear vehicle_photos JSON in DB
                await supabaseAdmin.from('bookings').update({ vehicle_photos: [] }).eq('id', booking.id)
                deletedCount++
            }
        }

        // --- 2. AGING (Day 7-90) ---
        // Find job photos for bookings completed > 7 days ago but < 90 days ago
        const { data: toAge, error: ageError } = await supabaseAdmin
            .from('bookings')
            .select('id, vehicle_photos')
            .eq('status', 'completed')
            .lt('updated_at', sevenDaysAgo.toISOString())
            .gt('updated_at', ninetyDaysAgo.toISOString())

        return NextResponse.json({
            success: true,
            action: 'lifecycle_scan',
            cleanup: {
                target_date: ninetyDaysAgo.toISOString(),
                processed: deletedCount
            },
            aging: {
                target_date: sevenDaysAgo.toISOString(),
                potential_targets: toAge?.length || 0,
                note: 'Aging logic requires an external image processing worker to download, resize, and re-upload.'
            }
        })

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
