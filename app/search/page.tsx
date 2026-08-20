'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  MapPin, Search as SearchIcon, Navigation2, Star, Clock,
  ChevronRight, Bike, Droplets, Wrench, Zap, Filter, X, RefreshCw,
  Map as MapIcon, List as ListIcon, Shield, SlidersHorizontal, ArrowUpDown,
  Award, Columns, Check, Sparkles
} from 'lucide-react'
import Logo from '@/components/Branding/Logo'

// Dynamic import for Leaflet map to avoid SSR window issues
const MarketplaceMap = dynamic(() => import('@/components/Marketplace/MarketplaceMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#EFF3FD',
      color: '#315EC3',
      fontWeight: 600,
      fontSize: 14
    }}>
      <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
      กำลังโหลดแผนที่...
    </div>
  )
})

interface Shop {
  id: string
  shop_slug: string
  shop_name: string
  description: string
  categories: string[]
  featured_photos: string[]
  avg_rating: number
  review_count: number
  booking_count: number
  is_featured: boolean
  lat: number
  lng: number
  address: string
  logo_url: string
  price_from: number
  distance_km?: number
}

const CATEGORIES = [
  { label: 'ทั้งหมด', value: 'all' },
  { label: 'ล้างสีดูดฝุ่น', value: 'ล้าง', icon: Droplets },
  { label: 'เคลือบสี / เคลือบแก้ว', value: 'เคลือบ', icon: Sparkles },
  { label: 'ซักเบาะ / พรม / สปา', value: 'ซัก', icon: Wrench },
  { label: 'มอเตอร์ไซค์', value: 'มอเตอร์ไซค์', icon: Bike },
  { label: 'ล้างด่วน / เดลิเวอรี่', value: 'ด่วน', icon: Zap },
]

// Haversine formula distance calculation (km)
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

function ShopCard({
  shop,
  isSelected,
  onSelect
}: {
  shop: Shop
  isSelected: boolean
  onSelect: () => void
}) {
  const photos = Array.isArray(shop.featured_photos) ? shop.featured_photos : []

  return (
    <div
      onClick={onSelect}
      style={{
        background: '#FFFFFF',
        border: `2px solid ${isSelected ? '#315EC3' : '#DDE3F5'}`,
        borderRadius: 20,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all .2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isSelected ? '0 12px 30px rgba(49, 94, 195, 0.16)' : '0 4px 14px rgba(26, 35, 64, 0.04)',
        display: 'flex',
        flexDirection: 'column'
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.borderColor = '#A0D9F6'
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(49, 94, 195, 0.1)'
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.borderColor = '#DDE3F5'
          e.currentTarget.style.boxShadow = '0 4px 14px rgba(26, 35, 64, 0.04)'
        }
      }}
    >
      {/* Cover image & badges */}
      <div style={{
        height: 140,
        background: photos[0]
          ? `url(${photos[0]}) center/cover`
          : 'linear-gradient(135deg, #EFF3FD 0%, #DDE6FB 100%)',
        position: 'relative'
      }}>
        {shop.is_featured && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
            color: '#fff', borderRadius: 8, padding: '3px 8px',
            fontSize: 10.5, fontWeight: 800, letterSpacing: '.04em',
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
            display: 'flex', alignItems: 'center', gap: 4
          }}>
            <Award size={12} /> แนะนำพิเศษ
          </div>
        )}

        {shop.distance_km !== undefined && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(255,255,255,0.95)', borderRadius: 999,
            padding: '4px 10px', fontSize: 11, fontWeight: 800,
            color: '#315EC3', display: 'flex', alignItems: 'center', gap: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <Navigation2 size={10} /> {shop.distance_km} กม.
          </div>
        )}
      </div>

      {/* Card Body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            {shop.logo_url && (
              <img
                src={shop.logo_url}
                alt={shop.shop_name}
                style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', border: '1.5px solid #DDE3F5', flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1A2340', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {shop.shop_name}
              </div>
              {shop.address && (
                <div style={{ fontSize: 11.5, color: '#5A6589', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <MapPin size={11} color="#315EC3" style={{ flexShrink: 0 }} /> {shop.address}
                </div>
              )}
            </div>
          </div>

          {/* Rating + Bookings count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            {shop.avg_rating > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#FFFBEB', padding: '2px 8px', borderRadius: 6 }}>
                <Star size={12} fill="#F59E0B" color="#F59E0B" />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#B45309' }}>{shop.avg_rating.toFixed(1)}</span>
                <span style={{ fontSize: 11, color: '#92400E' }}>({shop.review_count})</span>
              </div>
            )}
            {shop.booking_count > 0 && (
              <div style={{ fontSize: 11.5, color: '#5A6589', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} color="#9AA5C4" /> ล้างแล้ว {shop.booking_count} คัน
              </div>
            )}
          </div>
        </div>

        {/* Footer with Starting Price & CTA */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 10,
          borderTop: '1px solid #F0F3FC'
        }}>
          <div>
            <div style={{ fontSize: 10, color: '#9AA5C4', fontWeight: 600 }}>ราคาเริ่มต้น</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#315EC3' }}>
              {shop.price_from > 0 ? `฿${shop.price_from.toLocaleString('th')}` : 'ราคามาตรฐาน'}
            </div>
          </div>

          <Link
            href={`/${shop.shop_slug}/book`}
            onClick={e => e.stopPropagation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '8px 14px',
              borderRadius: 12,
              fontSize: 12.5,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #214192, #315EC3)',
              color: '#FFFFFF',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(49, 94, 195, 0.25)'
            }}
          >
            จองคิว <ChevronRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [minRating, setMinRating] = useState<number>(0)
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'price'>('distance')
  const [viewMode, setViewMode] = useState<'split' | 'list' | 'map'>('split')
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)

  // 1. Fetch Shops
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/marketplace/shops`)
      const data = await res.json()
      setShops(data.shops || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // 2. Geolocation Request
  const getLocation = () => {
    setLocLoading(true)
    if (!navigator.geolocation) {
      alert('อุปกรณ์ของคุณไม่รองรับการระบุตำแหน่ง GPS')
      setLocLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocLoading(false)
      },
      err => {
        console.warn('Geolocation error:', err)
        setLocLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // 3. Enrich and Filter shops
  const enrichedShops = useMemo(() => {
    return shops.map(s => {
      let dist: number | undefined = undefined
      if (userLoc && s.lat && s.lng) {
        dist = calculateDistanceKm(userLoc.lat, userLoc.lng, s.lat, s.lng)
      }
      return { ...s, distance_km: dist }
    })
  }, [shops, userLoc])

  const filteredShops = useMemo(() => {
    return enrichedShops
      .filter(s => {
        const matchesSearch = !search || 
          s.shop_name?.toLowerCase().includes(search.toLowerCase()) || 
          s.address?.toLowerCase().includes(search.toLowerCase()) ||
          s.shop_slug?.toLowerCase().includes(search.toLowerCase())

        const matchesCat = selectedCategory === 'all' || 
          (s.categories || []).some(c => c.includes(selectedCategory))

        const matchesRating = minRating === 0 || s.avg_rating >= minRating

        return matchesSearch && matchesCat && matchesRating
      })
      .sort((a, b) => {
        if (sortBy === 'distance') {
          if (a.distance_km === undefined && b.distance_km === undefined) return 0
          if (a.distance_km === undefined) return 1
          if (b.distance_km === undefined) return -1
          return a.distance_km - b.distance_km
        }
        if (sortBy === 'rating') {
          return (b.avg_rating || 0) - (a.avg_rating || 0)
        }
        if (sortBy === 'price') {
          return (a.price_from || 0) - (b.price_from || 0)
        }
        return 0
      })
  }, [enrichedShops, search, selectedCategory, minRating, sortBy])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg, #F6F8FF)',
      fontFamily: 'var(--font-kanit, "Kanit", sans-serif)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Header Navigation */}
      <header style={{
        background: '#FFFFFF',
        borderBottom: '1.5px solid #DDE3F5',
        padding: '0 20px',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        boxShadow: '0 2px 10px rgba(49, 94, 195, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Logo width={130} />
        </div>

        {/* View Mode Toggle (Desktop) */}
        <div className="view-mode-toggle" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F0F3FC', padding: 4, borderRadius: 12 }}>
          <button
            onClick={() => setViewMode('split')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: viewMode === 'split' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'split' ? '#315EC3' : '#5A6589',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: viewMode === 'split' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <Columns size={13} /> แยกหน้าต่าง
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: viewMode === 'list' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'list' ? '#315EC3' : '#5A6589',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: viewMode === 'list' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <ListIcon size={13} /> รายการ
          </button>
          <button
            onClick={() => setViewMode('map')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: viewMode === 'map' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'map' ? '#315EC3' : '#5A6589',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: viewMode === 'map' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <MapIcon size={13} /> แผนที่
          </button>
        </div>
      </header>

      {/* Filter & Search Bar Area */}
      <div style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #DDE3F5',
        padding: '12px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Search Input & GPS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <div style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            alignItems: 'center'
          }}>
            <SearchIcon size={16} color="#9AA5C4" style={{ position: 'absolute', left: 14 }} />
            <input
              type="text"
              placeholder="ค้นหาชื่อร้าน หรือทำเลที่ตั้ง..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 36px 10px 38px',
                borderRadius: 14,
                border: '1.5px solid #DDE3F5',
                fontSize: 13.5,
                outline: 'none',
                fontFamily: 'inherit',
                color: '#1A2340',
                background: '#F6F8FF'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#9AA5C4' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={getLocation}
            disabled={locLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 14px',
              borderRadius: 14,
              border: 'none',
              background: userLoc ? '#DCFCE7' : '#EFF3FD',
              color: userLoc ? '#15803D' : '#315EC3',
              fontSize: 13,
              fontWeight: 700,
              cursor: locLoading ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'inherit'
            }}
          >
            <Navigation2 size={14} />
            {locLoading ? 'กำลังหาพิกัด...' : userLoc ? 'พิกัดของฉัน' : 'ตำแหน่งใกล้ฉัน'}
          </button>
        </div>

        {/* Category Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {CATEGORIES.map(cat => {
            const active = selectedCategory === cat.value
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: `1.5px solid ${active ? '#315EC3' : '#DDE3F5'}`,
                  background: active ? '#EFF3FD' : '#FFFFFF',
                  color: active ? '#315EC3' : '#5A6589',
                  fontSize: 12.5,
                  fontWeight: active ? 800 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s'
                }}
              >
                {cat.label}
              </button>
            )
          })}
        </div>

        {/* Sort by dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowUpDown size={14} color="#5A6589" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            style={{
              padding: '7px 10px',
              borderRadius: 10,
              border: '1.5px solid #DDE3F5',
              background: '#FFFFFF',
              fontSize: 12.5,
              fontWeight: 600,
              color: '#1A2340',
              fontFamily: 'inherit',
              outline: 'none'
            }}
          >
            <option value="distance">เรียงตาม: ใกล้ฉันที่สุด</option>
            <option value="rating">เรียงตาม: เรตติ้งดาวสูงสุด</option>
            <option value="price">เรียงตาม: ราคาเริ่มต้นต่ำสุด</option>
          </select>
        </div>
      </div>

      {/* Main Content Layout (Split / List / Map) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left Side: Shop List Grid */}
        <div 
          className="shop-list-container"
          style={{
            flex: viewMode === 'split' ? '1 1 50%' : viewMode === 'list' ? '1 1 100%' : '0 0 0%',
            display: viewMode === 'map' ? 'none' : 'block',
            overflowY: 'auto',
            padding: '20px',
            height: 'calc(100vh - 128px)',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2340' }}>
              พบร้านล้างรถทั้งหมด <span style={{ color: '#315EC3' }}>{filteredShops.length}</span> ร้าน
            </div>
            {userLoc && (
              <div style={{ fontSize: 12, color: '#15803D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Navigation2 size={12} /> คำนวณระยะทางจาก GPS จริง
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 64, textAlign: 'center', color: '#9AA5C4' }}>
              <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} />
              กำลังโหลดข้อมูลร้านค้า...
            </div>
          ) : filteredShops.length === 0 ? (
            <div style={{ padding: 64, textAlign: 'center', background: '#FFFFFF', borderRadius: 20, border: '1.5px dashed #DDE3F5' }}>
              <MapPin size={40} style={{ opacity: .3, margin: '0 auto 12px', display: 'block', color: '#315EC3' }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1A2340', marginBottom: 4 }}>ไม่พบร้านตามเงื่อนไขที่ค้นหา</div>
              <div style={{ fontSize: 13, color: '#5A6589' }}>ลองล้างคำค้นหาหรือเลือกหมวดหมู่อื่น</div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: viewMode === 'split' ? 'repeat(auto-fill, minmax(260px, 1fr))' : 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16
            }}>
              {filteredShops.map(shop => (
                <ShopCard
                  key={shop.id}
                  shop={shop}
                  isSelected={selectedShop?.id === shop.id}
                  onSelect={() => setSelectedShop(shop)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Interactive Map */}
        <div 
          className="map-container"
          style={{
            flex: viewMode === 'split' ? '1 1 50%' : viewMode === 'map' ? '1 1 100%' : '0 0 0%',
            display: viewMode === 'list' ? 'none' : 'block',
            height: 'calc(100vh - 128px)',
            position: 'relative',
            borderLeft: '1.5px solid #DDE3F5'
          }}
        >
          <MarketplaceMap
            shops={filteredShops}
            selectedShop={selectedShop}
            onSelectShop={shop => setSelectedShop(shop)}
            userLocation={userLoc}
          />
        </div>
      </div>

      {/* Mobile Floating View Switcher Button */}
      <div className="mobile-view-fab" style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        display: 'none'
      }}>
        <button
          onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 24px',
            borderRadius: 999,
            background: '#1A2340',
            color: '#FFFFFF',
            border: 'none',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          {viewMode === 'map' ? (
            <>
              <ListIcon size={16} /> ดูแบบรายการ
            </>
          ) : (
            <>
              <MapIcon size={16} /> ดูแบบแผนที่ & ราคา
            </>
          )}
        </button>
      </div>

      {/* Selected Shop Drawer/Modal */}
      {selectedShop && (
        <>
          <div
            onClick={() => setSelectedShop(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 100, backdropFilter: 'blur(2px)' }}
          />
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 101,
            background: '#FFFFFF',
            borderRadius: '24px 24px 0 0',
            padding: '24px 24px 32px',
            maxHeight: '80vh',
            maxWidth: 600,
            margin: '0 auto',
            overflowY: 'auto',
            boxShadow: '0 -16px 40px rgba(0,0,0,0.18)'
          }}>
            <div style={{ width: 40, height: 5, background: '#DDE3F5', borderRadius: 999, margin: '0 auto 16px' }} />

            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
              {selectedShop.logo_url && (
                <img
                  src={selectedShop.logo_url}
                  alt={selectedShop.shop_name}
                  style={{ width: 60, height: 60, borderRadius: 16, objectFit: 'cover', border: '2px solid #DDE3F5' }}
                />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1A2340', margin: 0 }}>
                    {selectedShop.shop_name}
                  </h2>
                  <button onClick={() => setSelectedShop(null)} style={{ background: '#F0F3FC', border: 'none', borderRadius: 999, padding: 6, cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: 13, color: '#5A6589' }}>
                  {selectedShop.avg_rating > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#D97706', fontWeight: 700 }}>
                      <Star size={13} fill="#F59E0B" color="#F59E0B" /> {selectedShop.avg_rating.toFixed(1)} ({selectedShop.review_count} รีวิว)
                    </span>
                  )}
                  {selectedShop.distance_km !== undefined && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#315EC3', fontWeight: 700 }}>
                      <Navigation2 size={12} /> {selectedShop.distance_km} กม.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {selectedShop.address && (
              <div style={{ display: 'flex', gap: 8, fontSize: 13, color: '#5A6589', marginBottom: 16, background: '#F6F8FF', padding: '10px 14px', borderRadius: 12 }}>
                <MapPin size={16} color="#315EC3" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{selectedShop.address}</span>
              </div>
            )}

            {selectedShop.description && (
              <p style={{ fontSize: 13.5, color: '#5A6589', lineHeight: 1.6, marginBottom: 20 }}>
                {selectedShop.description}
              </p>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <Link
                href={`/${selectedShop.shop_slug}`}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '13px 0',
                  borderRadius: 14,
                  fontSize: 14,
                  fontWeight: 700,
                  border: '2px solid #315EC3',
                  color: '#315EC3',
                  textDecoration: 'none'
                }}
              >
                ดูโปรไฟล์ร้าน
              </Link>
              <Link
                href={`/${selectedShop.shop_slug}/book`}
                style={{
                  flex: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '13px 0',
                  borderRadius: 14,
                  fontSize: 14,
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #214192, #315EC3)',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(49, 94, 195, 0.3)'
                }}
              >
                จองคิวออนไลน์ <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1024px) {
          .view-mode-toggle {
            display: none !important;
          }
          .mobile-view-fab {
            display: block !important;
          }
          .shop-list-container {
            flex: 1 1 100% !important;
            height: calc(100vh - 180px) !important;
          }
          .map-container {
            height: calc(100vh - 180px) !important;
          }
        }
      `}</style>
    </div>
  )
}
