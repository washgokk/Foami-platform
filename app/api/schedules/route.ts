import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET: Get schedules for a staff member
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const staff_id = searchParams.get('staff_id')
    const supabase = createServiceClient()

    let q = supabase.from('staff_schedules')
        .select('*, zones(name, extra_fee, branch_id, branches(name))')
        .order('date').order('time_slot')

    if (staff_id) q = q.eq('staff_id', staff_id)

    const { data } = await q
    return NextResponse.json({ schedules: data || [] })
}

// POST: Add availability (batch)
export async function POST(req: NextRequest) {
    const { staff_id, slots } = await req.json()
    // slots: [{date, time_slot, zone_id}]
    const supabase = createServiceClient()

    const rows = slots.map((s: any) => ({
        staff_id,
        zone_id: s.zone_id,
        date: s.date,
        time_slot: s.time_slot,
        work_type: s.work_type || 'in_zone',
        is_booked: false,
    }))

    const { error } = await supabase
        .from('staff_schedules')
        .upsert(rows, { onConflict: 'staff_id,date,time_slot,zone_id' })

    if (error) {
        console.error('Schedule POST error:', error)
        return NextResponse.json({ error: error.message, details: error.hint }, { status: 400 })
    }
    return NextResponse.json({ saved: rows.length })
}

// DELETE: Remove a specific schedule slot
export async function DELETE(req: NextRequest) {
    const { id } = await req.json()
    const supabase = createServiceClient()
    await supabase.from('staff_schedules').delete().eq('id', id)
    return NextResponse.json({ deleted: true })
}
