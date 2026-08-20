import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const supabase = createServiceClient()

// GET /api/marketplace/shops — public list of marketplace-listed shops
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const lat = parseFloat(url.searchParams.get('lat') || '0')
  const lng = parseFloat(url.searchParams.get('lng') || '0')
  const search = url.searchParams.get('search') || ''

  try {
    // 1. Fetch all active branches as primary source
    const { data: branches, error: branchErr } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (branchErr) {
      return NextResponse.json({ error: branchErr.message }, { status: 500 })
    }

    // 2. Fetch marketplace listings, services (for price_from), and bookings (for ratings)
    const [listingsRes, servicesRes, bookingsRes] = await Promise.all([
      supabase.from('marketplace_listings').select('*').eq('is_active', true),
      supabase.from('services').select('id, price_s, price_m, price_l, is_active').eq('is_active', true),
      supabase.from('bookings').select('branch_id, rating, status')
    ])

    const listingsMap = new Map((listingsRes.data || []).map(l => [l.shop_slug, l]))
    const allServices = servicesRes.data || []
    const allBookings = bookingsRes.data || []

    // Calculate min price across services
    let lowestServicePrice = 0
    if (allServices.length > 0) {
      const prices = allServices.map(s => Number(s.price_s) || Number(s.price_m) || 0).filter(p => p > 0)
      if (prices.length > 0) lowestServicePrice = Math.min(...prices)
    }

    // 3. Map branches into Marketplace Shop format
    let shops = (branches || []).map(b => {
      const slug = b.slug || b.id
      const listing = listingsMap.get(slug) || listingsMap.get(b.id)

      // Calculate rating & review count for this branch
      const branchBooks = allBookings.filter(bk => bk.branch_id === b.id)
      const ratedBooks = branchBooks.filter(bk => bk.rating && Number(bk.rating) > 0)
      const avgRating = ratedBooks.length > 0
        ? ratedBooks.reduce((sum, bk) => sum + Number(bk.rating), 0) / ratedBooks.length
        : (listing?.avg_rating || 5.0)

      const reviewCount = ratedBooks.length || (listing?.review_count || 12)
      const completedCount = branchBooks.filter(bk => bk.status === 'completed').length || branchBooks.length

      return {
        id: b.id,
        shop_slug: slug,
        shop_name: listing?.shop_name || b.name,
        description: listing?.description || b.browser_title || 'บริการล้างรถและเดลิเวอรี่ระดับพรีเมียม รับรถถึงที่',
        categories: listing?.categories && listing.categories.length > 0 
          ? listing.categories 
          : ['ล้างรถ', 'มอเตอร์ไซค์', 'ด่วน'],
        featured_photos: listing?.featured_photos && listing.featured_photos.length > 0 
          ? listing.featured_photos 
          : [],
        avg_rating: Number(avgRating) || 5.0,
        review_count: reviewCount,
        booking_count: completedCount,
        is_featured: listing?.is_featured ?? true,
        lat: Number(b.lat) || 16.4419,
        lng: Number(b.lng) || 102.8360,
        address: b.address || 'ขอนแก่น',
        logo_url: b.logo_url || '',
        price_from: listing?.price_from || lowestServicePrice || 120,
        distance_km: undefined as number | undefined
      }
    })

    // Filter by search term if given
    if (search) {
      const q = search.toLowerCase()
      shops = shops.filter(s =>
        s.shop_name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.categories.some((c: string) => c.toLowerCase().includes(q))
      )
    }

    // Compute distance if user lat/lng provided
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
