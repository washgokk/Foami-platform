import { supabase, createServiceClient } from './supabase'

export type PaymentMethodType = 'transfer' | 'omise_promptpay' | 'omise_card' | 'stripe' | 'cash'

export interface BankPaymentDetails {
  bank_name: string
  account_number: string
  account_name: string
  promptpay_id?: string
  qr_code_url?: string
}

// Default Platform / Shop Bank Details (สามารถดึงจาก branch settings ได้)
export const DEFAULT_BANK_DETAILS: BankPaymentDetails = {
  bank_name: 'ธนาคารกสิกรไทย (KBANK)',
  account_number: '123-4-56789-0',
  account_name: 'บริษัท โฟมี่ แพลตฟอร์ม จำกัด (Foami)',
  promptpay_id: '0812345678'
}

/**
 * Upload payment slip to Supabase storage 'slips' bucket
 */
export async function uploadPaymentSlip(bookingId: string, file: File): Promise<{ url: string | null; error: string | null }> {
  try {
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `slip-${bookingId}-${Date.now()}.${ext}`
    const path = `bookings/${bookingId}/${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('slips')
      .upload(path, file, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('[Payment] Slip upload error:', uploadError)
      return { url: null, error: uploadError.message }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('slips')
      .getPublicUrl(path)

    // Update booking record with slip_url
    await supabase
      .from('bookings')
      .update({
        slip_url: publicUrl,
        payment_method: 'transfer',
        payment_status: 'pending' // รอยืนยันสลิปจากแอดมิน
      })
      .eq('id', bookingId)

    return { url: publicUrl, error: null }
  } catch (err: any) {
    console.error('[Payment] Unexpected slip upload exception:', err)
    return { url: null, error: err.message || 'เกิดข้อผิดพลาดในการอัปโหลดสลิป' }
  }
}

/**
 * Verify and approve payment slip by Admin
 */
export async function approvePaymentSlip(bookingId: string, verifiedBy: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabaseAdmin = createServiceClient()
    const now = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from('bookings')
      .update({
        payment_status: 'paid',
        payment_verified_by: verifiedBy,
        payment_verified_at: now
      })
      .eq('id', bookingId)

    if (error) return { success: false, error: error.message }
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Omise Payment Adapter Interface (เตรียมพร้อมสำหรับการเชื่อมต่อ Omise API)
 * เมื่อผู้ใช้เปิดใช้งาน Omise: ใส่ OMISE_PUBLIC_KEY และ OMISE_SECRET_KEY ใน .env
 */
export interface OmiseChargeParams {
  amountThb: number
  bookingId: string
  customerEmail?: string
  customerName?: string
  method: 'promptpay' | 'credit_card'
  cardToken?: string
}

export async function createOmiseCharge(params: OmiseChargeParams): Promise<{
  chargeId: string | null
  qrDownloadUrl?: string
  authorizeUrl?: string
  status: 'pending' | 'successful' | 'failed'
  error?: string
}> {
  const omiseSecretKey = process.env.OMISE_SECRET_KEY
  if (!omiseSecretKey) {
    return {
      chargeId: null,
      status: 'failed',
      error: 'ระบบ Omise ยังไม่ได้กำหนด OMISE_SECRET_KEY ใน .env'
    }
  }

  // Omise accepts amount in satangs (THB * 100)
  const amountInSatangs = Math.round(params.amountThb * 100)

  try {
    // Calling Omise Charges API
    const authHeader = Buffer.from(`${omiseSecretKey}:`).toString('base64')
    const omisePayload: Record<string, any> = {
      amount: amountInSatangs,
      currency: 'thb',
      return_uri: `${process.env.NEXT_PUBLIC_APP_URL || ''}/bookings/${params.bookingId}/complete`,
      metadata: {
        booking_id: params.bookingId,
        customer_name: params.customerName
      }
    }

    if (params.method === 'promptpay') {
      omisePayload.source = { type: 'promptpay' }
    } else if (params.cardToken) {
      omisePayload.card = params.cardToken
    }

    const response = await fetch('https://api.omise.co/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(omisePayload)
    })

    const chargeData = await response.json()

    if (!response.ok || chargeData.object === 'error') {
      return {
        chargeId: null,
        status: 'failed',
        error: chargeData.message || 'Omise charge failed'
      }
    }

    return {
      chargeId: chargeData.id,
      qrDownloadUrl: chargeData.source?.scannable_code?.image?.download_uri,
      authorizeUrl: chargeData.authorize_uri,
      status: chargeData.status
    }
  } catch (err: any) {
    return {
      chargeId: null,
      status: 'failed',
      error: err.message || 'Omise request failed'
    }
  }
}
