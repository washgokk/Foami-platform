import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateAICategories } from '@/lib/gemini-filter'

export const dynamic = 'force-dynamic'

const supabase = createServiceClient()

export async function GET() {
  try {
    const { data: services, error } = await supabase
      .from('services')
      .select('id, name, description, price_s, price_m, price_l, image_url')
      .eq('is_active', true)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const categories = await generateAICategories(services || [])
    return NextResponse.json({ categories })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
