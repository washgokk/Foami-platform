import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    const formData = await req.formData()
    const booking_id = formData.get('booking_id') as string
    const type = formData.get('type') as 'before' | 'after'
    const files = formData.getAll('photos') as File[]

    const supabase = createServiceClient()
    const urls: string[] = []

    for (const file of files) {
        const ext = file.name.split('.').pop()
        const path = `jobs/${booking_id}/${type}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { data, error } = await supabase.storage
            .from('job-photos')
            .upload(path, file, { contentType: file.type })
        if (!error && data) {
            const { data: { publicUrl } } = supabase.storage.from('job-photos').getPublicUrl(path)
            urls.push(publicUrl)
        }
    }

    // Upsert the photo record
    const { data } = await supabase
        .from('job_photos')
        .upsert({ booking_id, type, photo_urls: urls, uploaded_at: new Date().toISOString() }, { onConflict: 'booking_id,type' })
        .select()
        .single()

    // If before photos done → update booking status to picking_up
    // If after photos done → update to delivering
    if (type === 'before') {
        await supabase.from('bookings').update({ status: 'washing' }).eq('id', booking_id)
    } else if (type === 'after') {
        await supabase.from('bookings').update({ status: 'delivering' }).eq('id', booking_id)
    }

    return NextResponse.json({ urls, record: data })
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const booking_id = searchParams.get('booking_id')
    const supabase = createServiceClient()

    const { data } = await supabase
        .from('job_photos')
        .select('*')
        .eq('booking_id', booking_id)

    return NextResponse.json({ photos: data || [] })
}
