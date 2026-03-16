import { NextRequest, NextResponse } from 'next/server'
import { notifyTargetStaff } from '@/lib/push'

export async function POST(req: NextRequest) {
    try {
        const { staff_ids, payload } = await req.json()

        if (!staff_ids || !Array.isArray(staff_ids)) {
            return NextResponse.json({ error: 'Invalid staff_ids' }, { status: 400 })
        }

        await notifyTargetStaff(staff_ids, payload)

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Push notify-staff error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
