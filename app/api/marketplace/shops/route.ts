import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabase = createServiceClient()

// GET /api/marketplace/shops — public list of marketplace-listed shops
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const lat = parseFloat(url.searchParams.get('lat') || '0')
  const lng = parseFloat(url.searchParams.get('lng') || '0')
  const search = url.searchParams.get('search') || ''

  let query = supabase
    .from('marketplace_listings')
    .select('*')
    .eq('is_active', true)
    .order('is_featured', { ascending: false })
    .order('booking_count', { ascending: false })

  if (search) {
    query = query.or(`shop_name.ilike.%${search}%,description.ilike.%${search}%,categories.cs.{${search}}`)
  }

  const { data, error } = await query.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Compute distance if lat/lng provided
  let shops = data || []
  if (lat && lng) {
    shops = shops.map(s => {
      if (s.lat && s.lng) {
        const R = 6371
        const dLat = (s.lat - lat) * Math.PI / 180
        const dLng = (s.lng - lng) * Math.PI / 180
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(s.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return { ...s, distance_km: Math.round(dist * 10) / 10 }
      }
      return s
    }).sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999))
  }

  return NextResponse.json({ shops })
}
