'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  MapPin, Search as SearchIcon, Navigation2, Star, Clock,
  ChevronRight, Bike, Droplets, Wrench, Zap, Filter, X, RefreshCw,
  Map as MapIcon, List as ListIcon, Shield, SlidersHorizontal, ArrowUpDown,
  Award, Columns, Check, Sparkles, CheckCircle2, Package, Tag
} from 'lucide-react'
import Logo from '@/components/Branding/Logo'
import ReportIssueModal from '@/components/Global/ReportIssueModal'

// Dynamic import for Leaflet map
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

interface ServiceItem {
  id: string
  name: string
  description?: string
  price_s?: number
  price_m?: number
  price_l?: number
  image_url?: string
  is_addon_required?: boolean
}

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
  services?: ServiceItem[]
}

interface AICategory {
  id: string
  label: string
  service_ids: string[]
  service_names: string[]
}

// Haversine formula distance calculation (km)
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

// Helper: Parse description to separate clean main text and addon badges
function parseServiceDescription(rawDesc?: string) {
  if (!rawDesc) return { mainText: '', addons: [] }
  const addonMatch = rawDesc.match(/\[Addons?:\s*([^\]]+)\]/i)
  const mainText = rawDesc.replace(/\[Addons?:\s*[^\]]+\]/gi, '').trim()
  const addons = addonMatch
    ? addonMatch[1].split(',').map(s => s.trim()).filter(Boolean)
    : []
  return { mainText, addons }
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
            color: '#315EC3', boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', gap: 4
          }}>
            <Navigation2 size={12} /> {shop.distance_km} กม.
          </div>
        )}

        {/* Shop Logo Avatar */}
        <div style={{
          position: 'absolute', bottom: -18, left: 16,
          width: 48, height: 48, borderRadius: 14,
          background: '#fff', padding: 2,
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
        }}>
          {shop.logo_url ? (
            <img
              src={shop.logo_url}
              alt={shop.shop_name}
              style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', borderRadius: 12,
              background: '#EFF3FD', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 900, color: '#315EC3', fontSize: 18
            }}>
              {(shop.shop_name || 'F')[0]}
            </div>
          )}
        </div>
      </div>

      {/* Card Info */}
      <div style={{ padding: '24px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <h3 style={{
            fontSize: 16, fontWeight: 800, color: '#1A2340',
            margin: 0, lineHeight: 1.3
          }}>
            {shop.shop_name}
          </h3>
          {shop.avg_rating > 0 && shop.review_count > 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3,
              background: '#FEF3C7', color: '#D97706', padding: '2px 6px',
              borderRadius: 6, fontSize: 11, fontWeight: 800, flexShrink: 0
            }}>
              <Star size={12} fill="#F59E0B" color="#F59E0B" />
              {shop.avg_rating.toFixed(1)}
              <span style={{ color: '#92400E', fontWeight: 500 }}>({shop.review_count})</span>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 2,
              color: '#94A3B8', fontSize: 11, fontWeight: 600, flexShrink: 0
            }}>
              <Star size={12} color="#CBD5E1" /> ยังไม่มีรีวิว
            </div>
          )}
        </div>

        {/* Address */}
        <p style={{
          fontSize: 12, color: '#5A6589', margin: '6px 0 10px',
          display: 'flex', alignItems: 'center', gap: 4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>
          <MapPin size={13} color="#9AA5C4" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{shop.address}</span>
        </p>

        {/* Available Packages tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          {(shop.services && shop.services.length > 0 ? shop.services : (shop.categories || []).map(c => ({ name: c })))
            .slice(0, 3)
            .map((srv: any, idx: number) => (
              <span key={idx} style={{
                fontSize: 11, background: '#F0F3FC', color: '#315EC3',
                padding: '2px 8px', borderRadius: 6, fontWeight: 600
              }}>
                {srv.name}
              </span>
            ))}
          {shop.services && shop.services.length > 3 && (
            <span style={{ fontSize: 11, background: '#EFF3FD', color: '#5A6589', padding: '2px 6px', borderRadius: 6 }}>
              +{shop.services.length - 3}
            </span>
          )}
        </div>

        {/* Price & Action */}
        <div style={{
          marginTop: 'auto', paddingTop: 10,
          borderTop: '1px solid #F0F3FC',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: 10.5, color: '#9AA5C4', fontWeight: 600 }}>ราคาเริ่มต้น</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#315EC3' }}>
              ฿{shop.price_from}
            </div>
          </div>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '7px 14px',
              borderRadius: 10,
              background: '#315EC3',
              color: '#FFFFFF',
              border: 'none',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            เลือกดู <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MarketplaceSearchPage() {
  const router = useRouter()
  const [shops, setShops] = useState<Shop[]>([])
  const [categories, setCategories] = useState<AICategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'price'>('distance')
  const [viewMode, setViewMode] = useState<'split' | 'list' | 'map'>('split')
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [reportModalOpen, setReportModalOpen] = useState(false)

  // 1. Fetch Shops & Categories
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/marketplace/shops`)
      const data = await res.json()
      setShops(data.shops || [])
      if (data.categories && Array.isArray(data.categories)) {
        setCategories(data.categories)
      }
    } catch (err) {
      console.error('Failed to load marketplace shops:', err)
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
        const q = search.toLowerCase().trim()
        const matchesSearch = !q || 
          s.shop_name?.toLowerCase().includes(q) || 
          s.address?.toLowerCase().includes(q) ||
          s.shop_slug?.toLowerCase().includes(q) ||
          (s.services || []).some(srv => srv.name?.toLowerCase().includes(q) || srv.description?.toLowerCase().includes(q))

        let matchesCat = true
        if (selectedCategory !== 'all') {
          const catObj = categories.find(c => c.id === selectedCategory)
          if (catObj && catObj.service_ids && catObj.service_ids.length > 0) {
            const shopServiceIds = (s.services || []).map(srv => srv.id)
            const shopServiceNames = (s.services || []).map(srv => srv.name)
            matchesCat = shopServiceIds.some(id => catObj.service_ids.includes(id)) ||
              shopServiceNames.some(name => (catObj.service_names || []).includes(name))
          } else {
            matchesCat = (s.categories || []).some(c => c.includes(selectedCategory))
          }
        }

        return matchesSearch && matchesCat
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
  }, [enrichedShops, search, selectedCategory, categories, sortBy])

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

        {/* View Mode Toggle */}
        <div className="view-mode-toggle" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F0F3FC', padding: 4, borderRadius: 12 }}>
          <button
            onClick={() => setViewMode('split')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              borderRadius: 8, border: 'none',
              background: viewMode === 'split' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'split' ? '#315EC3' : '#5A6589',
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
              boxShadow: viewMode === 'split' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <Columns size={13} /> แยกหน้าต่าง
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              borderRadius: 8, border: 'none',
              background: viewMode === 'list' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'list' ? '#315EC3' : '#5A6589',
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
              boxShadow: viewMode === 'list' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <ListIcon size={13} /> รายการ
          </button>
          <button
            onClick={() => setViewMode('map')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              borderRadius: 8, border: 'none',
              background: viewMode === 'map' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'map' ? '#315EC3' : '#5A6589',
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
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
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <SearchIcon size={16} color="#9AA5C4" style={{ position: 'absolute', left: 14 }} />
            <input
              type="text"
              placeholder="ค้นหาชื่อร้าน หรือแพ็กเกจบริการ..."
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
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px',
              borderRadius: 14, border: 'none',
              background: userLoc ? '#DCFCE7' : '#EFF3FD',
              color: userLoc ? '#15803D' : '#315EC3',
              fontSize: 13, fontWeight: 700,
              cursor: locLoading ? 'wait' : 'pointer',
              whiteSpace: 'nowrap', fontFamily: 'inherit'
            }}
          >
            <Navigation2 size={14} />
            {locLoading ? 'กำลังหาพิกัด...' : userLoc ? 'พิกัดของฉัน' : 'ตำแหน่งใกล้ฉัน'}
          </button>
        </div>

        {/* Exact Package Category Chips (Zero Hallucinated Words) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          <button
            onClick={() => setSelectedCategory('all')}
            style={{
              padding: '7px 15px',
              borderRadius: 999,
              border: `1.5px solid ${selectedCategory === 'all' ? '#315EC3' : '#DDE3F5'}`,
              background: selectedCategory === 'all' ? '#EFF3FD' : '#FFFFFF',
              color: selectedCategory === 'all' ? '#315EC3' : '#5A6589',
              fontSize: 13,
              fontWeight: selectedCategory === 'all' ? 800 : 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
              transition: 'all 0.15s'
            }}
          >
            ทั้งหมด
          </button>

          {categories.map(cat => {
            const active = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 15px',
                  borderRadius: 999,
                  border: `1.5px solid ${active ? '#315EC3' : '#DDE3F5'}`,
                  background: active ? '#EFF3FD' : '#FFFFFF',
                  color: active ? '#315EC3' : '#475569',
                  fontSize: 13,
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s'
                }}
              >
                <span>{cat.label}</span>
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
              padding: '7px 10px', borderRadius: 10, border: '1.5px solid #DDE3F5',
              background: '#FFFFFF', color: '#1A2340', fontSize: 12.5, fontWeight: 600,
              outline: 'none', fontFamily: 'inherit', cursor: 'pointer'
            }}
          >
            <option value="distance">เรียงตาม: ใกล้ที่สุด</option>
            <option value="rating">เรียงตาม: คะแนนรีวิว</option>
            <option value="price">เรียงตาม: ราคาเริ่มต้น</option>
          </select>
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left Column: Shop Cards List */}
        {(viewMode === 'split' || viewMode === 'list') && (
          <div
            className="shop-list-container"
            style={{
              flex: viewMode === 'list' ? '1 1 100%' : '0 0 460px',
              maxWidth: viewMode === 'list' ? 900 : 460,
              margin: viewMode === 'list' ? '0 auto' : '0',
              width: '100%',
              height: 'calc(100vh - 130px)',
              overflowY: 'auto',
              padding: '16px 20px 40px',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#5A6589' }}>
                พบร้านล้างรถทั้งหมด <span style={{ color: '#315EC3', fontWeight: 900 }}>{filteredShops.length}</span> ร้าน
              </div>
              {selectedCategory !== 'all' && (
                <button
                  onClick={() => setSelectedCategory('all')}
                  style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#5A6589' }}>
                <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', color: '#315EC3' }} />
                <div>กำลังค้นหาร้านล้างรถ...</div>
              </div>
            ) : filteredShops.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#FFFFFF', borderRadius: 20, border: '1.5px dashed #DDE3F5' }}>
                <Droplets size={36} color="#9AA5C4" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1A2340', marginBottom: 6 }}>ไม่พบร้านล้างรถที่ตรงกับเงื่อนไข</div>
                <div style={{ fontSize: 13, color: '#5A6589' }}>ลองเปลี่ยนคำค้นหา หรือเลือกตัวกรองหมวดหมู่อื่น</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'list' ? 'repeat(auto-fill, minmax(280px, 1fr))' : '1fr', gap: 16 }}>
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
        )}

        {/* Right Column: Leaflet Map */}
        {(viewMode === 'split' || viewMode === 'map') && (
          <div
            className="map-container"
            style={{
              flex: 1,
              height: 'calc(100vh - 130px)',
              position: 'relative'
            }}
          >
            <MarketplaceMap
              shops={filteredShops}
              selectedShop={selectedShop}
              onSelectShop={setSelectedShop}
              userLocation={userLoc}
            />
          </div>
        )}
      </div>

      {/* Floating Bottom Modal/Drawer for Selected Shop */}
      {selectedShop && (
        <>
          <div
            onClick={() => setSelectedShop(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 100, backdropFilter: 'blur(3px)' }}
          />
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 101,
            background: '#FFFFFF',
            borderRadius: '24px 24px 0 0',
            padding: '24px 24px 30px',
            maxHeight: '85vh',
            maxWidth: 620,
            margin: '0 auto',
            overflowY: 'auto',
            boxShadow: '0 -16px 40px rgba(0,0,0,0.2)'
          }}>
            {/* Handle bar */}
            <div style={{ width: 44, height: 5, background: '#DDE3F5', borderRadius: 999, margin: '0 auto 16px' }} />

            {/* Shop Header Info */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
              {selectedShop.logo_url ? (
                <img
                  src={selectedShop.logo_url}
                  alt={selectedShop.shop_name}
                  style={{ width: 60, height: 60, borderRadius: 16, objectFit: 'cover', border: '2px solid #DDE3F5', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 60, height: 60, borderRadius: 16, background: '#EFF3FD',
                  border: '2px solid #DDE3F5', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 24, fontWeight: 900, color: '#315EC3', flexShrink: 0
                }}>
                  {(selectedShop.shop_name || 'F')[0]}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1A2340', margin: 0 }}>
                    {selectedShop.shop_name}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setReportModalOpen(true); }}
                      style={{
                        background: '#FFF1F2',
                        border: '1px solid #FECDD3',
                        borderRadius: 8,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        color: '#E11D48',
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      title="แจ้งปัญหาหรือรายงานร้านค้านี้"
                    >
                      <Shield size={12} /> รายงานร้านนี้
                    </button>
                    <button
                      onClick={() => setSelectedShop(null)}
                      style={{ background: '#F0F3FC', border: 'none', borderRadius: 999, padding: 8, cursor: 'pointer', color: '#5A6589' }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 13 }}>
                  {selectedShop.avg_rating > 0 && selectedShop.review_count > 0 ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#D97706', fontWeight: 700 }}>
                      <Star size={14} fill="#F59E0B" color="#F59E0B" /> {selectedShop.avg_rating.toFixed(1)} ({selectedShop.review_count} รีวิว)
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#94A3B8', fontWeight: 600 }}>
                      <Star size={14} color="#CBD5E1" /> ยังไม่มีรีวิว
                    </span>
                  )}
                  {selectedShop.distance_km !== undefined && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#315EC3', fontWeight: 700 }}>
                      <Navigation2 size={13} /> {selectedShop.distance_km} กม.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Address */}
            {selectedShop.address && (
              <div style={{
                display: 'flex', gap: 8, fontSize: 13, color: '#5A6589',
                marginBottom: 12, background: '#F6F8FF', padding: '10px 14px', borderRadius: 12
              }}>
                <MapPin size={16} color="#315EC3" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{selectedShop.address}</span>
              </div>
            )}

            {/* Shop Description (editable by shop in admin settings) */}
            {selectedShop.description && (
              <p style={{
                fontSize: 13.5, color: '#475569', lineHeight: 1.6,
                marginBottom: 18, background: '#FAFAFA', padding: '10px 14px',
                borderRadius: 12, border: '1px solid #F1F5F9'
              }}>
                {selectedShop.description}
              </p>
            )}

            {/* Packages & Services (Actionable Cards - No duplicate bottom button) */}
            <div style={{ marginBottom: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 14.5, fontWeight: 800, color: '#1A2340', marginBottom: 12
              }}>
                <Package size={16} color="#315EC3" />
                เลือกแพ็กเกจเพื่อจองคิว
              </div>

              {selectedShop.services && selectedShop.services.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedShop.services.map(srv => {
                    const priceDisplay = srv.price_s ? `฿${srv.price_s}` : '฿--'
                    const { mainText, addons } = parseServiceDescription(srv.description)

                    return (
                      <div
                        key={srv.id}
                        onClick={() => router.push(`/${selectedShop.shop_slug}/book?service=${srv.id}`)}
                        style={{
                          background: '#FFFFFF',
                          border: '1.5px solid #E2E8F0',
                          borderRadius: 16,
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 14,
                          cursor: 'pointer',
                          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = '#315EC3'
                          e.currentTarget.style.background = '#F8FAFC'
                          e.currentTarget.style.transform = 'translateY(-1px)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = '#E2E8F0'
                          e.currentTarget.style.background = '#FFFFFF'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#1E293B' }}>
                            {srv.name}
                          </div>

                          {mainText && (
                            <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 3 }}>
                              {mainText}
                            </div>
                          )}

                          {/* Addons rendered as clean visual badges (no raw [Addons: ...] text) */}
                          {addons.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                              {addons.map((ad, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: '#EFF6FF',
                                    color: '#2563EB',
                                    border: '1px solid #DBEAFE',
                                    padding: '2px 8px',
                                    borderRadius: 999,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3
                                  }}
                                >
                                  <Tag size={10} /> {ad}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Price & Action Button */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: '#2563EB', lineHeight: 1 }}>
                            {priceDisplay}
                          </div>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              router.push(`/${selectedShop.shop_slug}/book?service=${srv.id}`)
                            }}
                            style={{
                              marginTop: 8,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '6px 14px',
                              borderRadius: 10,
                              background: 'linear-gradient(135deg, #1E3A8A, #315EC3)',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(49, 94, 195, 0.25)'
                            }}
                          >
                            จองแพ็กนี้ <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', background: '#F8FAFC', borderRadius: 14 }}>
                  <Link
                    href={`/${selectedShop.shop_slug}/book`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '12px 24px',
                      borderRadius: 14,
                      background: '#315EC3',
                      color: '#fff',
                      textDecoration: 'none',
                      fontWeight: 800
                    }}
                  >
                    จองคิวออนไลน์ทันที <ChevronRight size={16} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Customer Report Shop Modal */}
      {selectedShop && (
        <ReportIssueModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          initialType="shop"
          shopSlug={selectedShop.shop_slug}
          shopName={selectedShop.shop_name}
        />
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
