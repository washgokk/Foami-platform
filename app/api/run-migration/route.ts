import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// One-time migration endpoint — DELETE this file after running!
// Visit: GET /api/run-migration to apply the schema changes
export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const migrations = [
        // Fix 1: bookings payment_method constraint (add 'cash')
        `ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check`,
        `ALTER TABLE bookings ADD CONSTRAINT bookings_payment_method_check CHECK (payment_method IN ('stripe', 'transfer', 'cash', 'promptpay', 'other'))`,

        // Fix 2: discount_codes condition columns
        `ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS usage_type TEXT DEFAULT 'once'`,
        `ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS valid_days TEXT[] DEFAULT NULL`,
        `ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT NULL`,
        `ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS valid_until DATE DEFAULT NULL`,
        `ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS allowed_branch_ids TEXT[] DEFAULT NULL`,
        `ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS allowed_zone_ids TEXT[] DEFAULT NULL`,
    ]

    const results: { sql: string; ok: boolean; error?: string }[] = []

    for (const sql of migrations) {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql_migration`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
                    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({ query: sql }),
            })
            const body = await res.json().catch(() => ({}))
            results.push({ sql: sql.substring(0, 80), ok: res.ok, error: res.ok ? undefined : (body?.message || res.statusText) })
        } catch (e: any) {
            results.push({ sql: sql.substring(0, 80), ok: false, error: e.message })
        }
    }

    return NextResponse.json({ results, note: 'DELETE /app/api/run-migration/route.ts after use' })
}
