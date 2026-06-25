import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    try {
        const adminToken = req.headers.get('authorization')?.replace('Bearer ', '')
        if (!adminToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createServiceClient()

        // 1. Fetch all WALKIN customers that have a phone number
        const { data: walkins, error: walkinError } = await supabase
            .from('customers')
            .select('id, phone')
            .like('id', 'WALKIN-%')
            .not('phone', 'is', null)
            .not('phone', 'eq', '')

        if (walkinError) throw walkinError

        if (!walkins || walkins.length === 0) {
            return NextResponse.json({ message: 'ไม่มีข้อมูลลูกค้า Walk-in ที่สามารถรวมได้', mergedCount: 0 })
        }

        let mergedCount = 0
        const mergeDetails: string[] = []

        // 2. Iterate through walkins and find matching real customers
        for (const walkin of walkins) {
            // Find real customers (id does not start with WALKIN) with the exact same phone
            const { data: realCustomers } = await supabase
                .from('customers')
                .select('id')
                .eq('phone', walkin.phone)
                .not('id', 'like', 'WALKIN-%')
                .limit(1)

            if (realCustomers && realCustomers.length > 0) {
                const realId = realCustomers[0].id

                // 3. Re-assign bookings to the real customer
                const { error: updateError } = await supabase
                    .from('bookings')
                    .update({ customer_id: realId })
                    .eq('customer_id', walkin.id)

                if (updateError) {
                    console.error(`Failed to update bookings for ${walkin.id}:`, updateError)
                    continue
                }

                // 4. Delete the WALKIN profile
                const { error: deleteError } = await supabase
                    .from('customers')
                    .delete()
                    .eq('id', walkin.id)

                if (deleteError) {
                    console.error(`Failed to delete WALKIN profile ${walkin.id}:`, deleteError)
                } else {
                    mergedCount++
                    const detailMsg = `ย้ายประวัติจากรหัส ${walkin.id} ไปยังบัญชีหลัก ${realId} (เบอร์ ${walkin.phone})`
                    mergeDetails.push(detailMsg)
                    console.log(detailMsg)

                    // Write audit log
                    await supabase.from('audit_logs').insert({
                        admin_id: adminToken.length > 20 ? adminToken : 'system', // Use token as ID or fallback
                        action_type: 'UPDATE',
                        entity_type: 'customer',
                        entity_id: realId,
                        old_data: { merged_from: walkin.id },
                        new_data: null,
                        description: `รวมประวัติการจองของ Walk-in รหัส ${walkin.id} เข้ากับบัญชีนี้โดยอัตโนมัติ (เบอร์โทร ${walkin.phone} ตรงกัน)`,
                        created_at: new Date().toISOString()
                    })
                }
            }
        }

        return NextResponse.json({ message: 'Success', mergedCount, details: mergeDetails })

    } catch (error: any) {
        console.error('[Merge Customers] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
