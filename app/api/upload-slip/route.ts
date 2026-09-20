import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const bookingId = formData.get('booking_id') as string
    const slipFile = formData.get('slip') as File | null

    if (!bookingId || !slipFile) {
      return NextResponse.json({ error: 'booking_id and slip file are required' }, { status: 400 })
    }

    const supabaseAdmin = createServiceClient()
    const ext = slipFile.name.split('.').pop() || 'jpg'
    const fileName = `slip-${bookingId}-${Date.now()}.${ext}`
    const path = `bookings/${bookingId}/${fileName}`

    // Upload to 'slips' bucket
    const arrayBuffer = await slipFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabaseAdmin.storage
      .from('slips')
      .upload(path, buffer, { contentType: slipFile.type || 'image/jpeg', upsert: true })

    if (uploadError) {
      console.error('[UploadSlip] Storage error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('slips')
      .getPublicUrl(path)

    // Save slip_url in bookings table
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        slip_url: publicUrl,
        payment_method: 'transfer',
        payment_status: 'pending' // รอยืนยันสลิปจากแอดมิน
      })
      .eq('id', bookingId)

    if (updateError) {
      console.error('[UploadSlip] DB update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, slip_url: publicUrl })
  } catch (err: any) {
    console.error('[UploadSlip] Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
