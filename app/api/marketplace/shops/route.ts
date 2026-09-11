import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateAICategories } from '@/lib/gemini-filter'

export const dynamic = 'force-dynamic'

const supabase = createServiceClient()

// GET /api/marketplace/shops — public list of marketplace-listed shops & filter categories
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const lat = parseFloat(url.searchParams.get('lat') || '0')
  const lng = parseFloat(url.searchParams.get('lng') || '0')
  const search = url.searchParams.get('search') || ''

  try {
    // 1. Fetch active branches, app_settings, marketplace listings, services, bookings
    const [branchesRes, settingsRes, listingsRes, servicesRes, bookingsRes] = await Promise.all([
      supabase.from('branches').select('*').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('app_settings').select('key, value').like('key', 'shop_settings:%'),
      supabase.from('marketplace_listings').select('*').eq('is_active', true),
      supabase.from('services').select('*').eq('is_active', true),
      supabase.from('bookings').select('branch_id, rating, status')
    ])

    if (branchesRes.error) {
      return NextResponse.json({ error: branchesRes.error.message }, { status: 500 })
    }

    const branches = branchesRes.data || []
    const appSettingsMap = new Map((settingsRes.data || []).map(s => [s.key, s.value]))
    const listingsMap = new Map((listingsRes.data || []).map(l => [l.shop_slug, l]))
    const allServices = servicesRes.data || []
    const allBookings = bookingsRes.data || []

    // 2. Generate Filter Categories directly from real active packages
    const filterCategories = await generateAICategories(
      allServices.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        price_s: s.price_s,
        price_m: s.price_m,
        price_l: s.price_l,
        image_url: s.image_url
      }))
    )

    // 3. Map branches into Marketplace Shop format
    let shops = branches.map(b => {
      const slug = b.slug || b.id
      const listing = listingsMap.get(slug) || listingsMap.get(b.id)
      const shopSetting = appSettingsMap.get(`shop_settings:${slug}`) || {}

      // Calculate rating & review count for this branch
      const branchBooks = allBookings.filter(bk => bk.branch_id === b.id)
      const ratedBooks = branchBooks.filter(bk => bk.rating && Number(bk.rating) > 0)
      const avgRating = ratedBooks.length > 0
        ? ratedBooks.reduce((sum, bk) => sum + Number(bk.rating), 0) / ratedBooks.length
        : (listing?.avg_rating || 0)

      const reviewCount = ratedBooks.length || (listing?.review_count || 0)
      const completedCount = branchBooks.filter(bk => bk.status === 'completed').length || branchBooks.length

      // Branch-specific active services
      const branchServices = allServices
        .filter(s => {
          const bSetting = s.branch_settings?.[b.id]
          if (bSetting && bSetting.is_active === false) return false
          return s.is_active !== false
        })
        .map(s => {
          const bSetting = s.branch_settings?.[b.id]
          const markup = Number(bSetting?.price_markup) || 0
          return {
            id: s.id,
            name: s.name,
            description: s.description || '',
            price_s: (Number(s.price_s) || 0) + markup,
            price_m: (Number(s.price_m) || 0) + markup,
            price_l: (Number(s.price_l) || 0) + markup,
            image_url: s.image_url || '',
            is_addon_required: Boolean(s.is_addon_required)
          }
        })

      // Calculate lowest price
      let branchLowestPrice = 0
      if (branchServices.length > 0) {
        const prices = branchServices.map(s => s.price_s || s.price_m || 0).filter(p => p > 0)
        if (prices.length > 0) branchLowestPrice = Math.min(...prices)
      }

      // Shop description prioritized from shop settings edited by branch admin
      const shopDescription = shopSetting.shop_description ||
        listing?.description ||
        b.browser_title ||
        'บริการล้างรถและเดลิเวอรี่ระดับพรีเมียม รับรถถึงที่'

      return {
        id: b.id,
        shop_slug: slug,
        shop_name: shopSetting.name || listing?.shop_name || b.name,
        description: shopDescription,
        categories: listing?.categories && listing.categories.length > 0 
          ? listing.categories 
          : branchServices.map(s => s.name),
        featured_photos: shopSetting.shop_photos || (listing?.featured_photos && listing.featured_photos.length > 0 
          ? listing.featured_photos 
          : (shopSetting.cover_photo_url ? [shopSetting.cover_photo_url] : [])),
        avg_rating: Number(avgRating) || 0,
        review_count: reviewCount,
        booking_count: completedCount,
        is_featured: Boolean(listing?.is_featured),
        lat: Number(b.lat) || 16.4419,
        lng: Number(b.lng) || 102.8360,
        address: shopSetting.address || b.address || 'ขอนแก่น',
        logo_url: shopSetting.logo_url || b.logo_url || '',
        price_from: branchLowestPrice || listing?.price_from || 120,
        distance_km: undefined as number | undefined,
        services: branchServices
      }
    })

    // Filter by search term if given
    if (search) {
      const q = search.toLowerCase()
      shops = shops.filter(s =>
        s.shop_name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.services.some(srv => srv.name.toLowerCase().includes(q) || srv.description.toLowerCase().includes(q))
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

    return NextResponse.json({ shops, categories: filterCategories })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
