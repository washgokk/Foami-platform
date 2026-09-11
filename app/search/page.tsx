'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  MapPin, AlertTriangle, Search as SearchIcon, Navigation2, Star, Clock,
  ChevronRight, Bike, Droplets, Wrench, Zap, Filter, X, RefreshCw,
  Map as MapIcon, List as ListIcon, Shield, SlidersHorizontal, ArrowUpDown,
  Award, Columns, Check, Sparkles, CheckCircle2, Package, Tag, Layers
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

export interface EarliestSlotInfo {
  datetime: string
  date: string
  time: string
  display_text: string
  short_text: string
  is_today: boolean
  is_tomorrow: boolean
  is_out_of_reach: boolean
  is_in_zone: boolean
  zone_name?: string
  distance_km?: number
  travel_minutes: number
  badge_color: 'emerald' | 'blue' | 'amber' | 'slate'
  status_message?: string
}

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
  earliest_slot?: EarliestSlotInfo
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
        borderRadius: 20,
        border: isSelected ? '2px solid #315EC3' : '1.5px solid #E2E8F0',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isSelected ? '0 8px 24px rgba(49, 94, 195, 0.16)' : '0 2px 8px rgba(0,0,0,0.04)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = '#93C5FD'
          e.currentTarget.style.transform = 'translateY(-2px)'
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = '#E2E8F0'
          e.currentTarget.style.transform = 'translateY(0)'
        }
      }}
    >
      {/* Photo carousel or fallback cover */}
      <div style={{ position: 'relative', width: '100%', height: 160, borderRadius: 14, overflow: 'hidden', background: '#EFF3FD' }}>
        {photos.length > 0 ? (
          <img
            src={photos[0]}
            alt={shop.shop_name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1E3A8A 0%, #315EC3 100%)',
            color: '#FFFFFF'
          }}>
            <Droplets size={36} style={{ marginBottom: 4, opacity: 0.8 }} />
            <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>{shop.shop_name}</span>
          </div>
        )}

        {/* Featured Badge */}
        {shop.is_featured && (
          <div style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            <Sparkles size={11} /> แนะนำ
          </div>
        )}

        {/* Distance Badge */}
        {shop.distance_km !== undefined && (
          <div style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            color: '#FFFFFF',
            fontSize: 11.5,
            fontWeight: 700,
            padding: '3px 9px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            <Navigation2 size={11} color="#60A5FA" />
            <span>{shop.distance_km} กม.</span>
          </div>
        )}

        {/* Price Tag Pill */}
        <div style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(6px)',
          color: '#1E3A8A',
          fontSize: 12.5,
          fontWeight: 900,
          padding: '3px 10px',
          borderRadius: 8,
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
        }}>
          เริ่มต้น ฿{shop.price_from}
        </div>
      </div>

      {/* Earliest Available Service Time Badge (Minimal Design) */}
      {shop.earliest_slot && (
        shop.earliest_slot.is_out_of_reach ? (
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11.5,
            color: '#64748B'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748B' }}>
              <AlertTriangle size={12} color="#94A3B8" />
              อยู่นอกพื้นที่บริการ ({shop.distance_km || 0} กม.)
            </span>
          </div>
        ) : (
          <div style={{
            background: '#F0F4FC',
            border: '1px solid #D8E2F8',
            borderRadius: 10,
            padding: '7px 11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: '#315EC3'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} color="#315EC3" style={{ flexShrink: 0 }} />
              <span style={{ color: '#5A6589' }}>
                พร้อมบริการเร็วสุด: <span style={{ fontWeight: 700, color: '#1A2340' }}>{shop.earliest_slot.display_text}</span>
              </span>
            </div>
            {shop.earliest_slot.is_in_zone && (
              <span style={{
                fontSize: 10.5,
                color: '#315EC3',
                background: '#FFFFFF',
                border: '1px solid #D8E2F8',
                padding: '2px 7px',
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                whiteSpace: 'nowrap',
                fontWeight: 600
              }}>
                <MapPin size={10} color="#315EC3" />
                {shop.earliest_slot.zone_name ? `โซน${shop.earliest_slot.zone_name}` : 'ในพื้นที่บริการ'}
              </span>
            )}
          </div>
        )
      )}

      {/* Info Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {shop.logo_url ? (
              <img
                src={shop.logo_url}
                alt={shop.shop_name}
                style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', border: '1px solid #DDE3F5' }}
              />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EFF3FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#315EC3' }}>
                {(shop.shop_name || 'F')[0]}
              </div>
            )}
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1A2340' }}>
              {shop.shop_name}
            </h3>
          </div>

          {/* Rating */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            {shop.avg_rating > 0 && shop.review_count > 0 ? (
              <>
                <Star size={13} fill="#F59E0B" color="#F59E0B" />
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#D97706' }}>
                  {shop.avg_rating.toFixed(1)}
                </span>
                <span style={{ fontSize: 11, color: '#9AA5C4' }}>
                  ({shop.review_count})
                </span>
              </>
            ) : (
              <span style={{ fontSize: 11, color: '#9AA5C4', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Star size={11} color="#CBD5E1" /> ยังไม่มีรีวิว
              </span>
            )}
          </div>
        </div>

        {/* Address */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#5A6589' }}>
          <MapPin size={12} color="#9AA5C4" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shop.address || 'ไม่ระบุที่อยู่'}
          </span>
        </div>

        {/* Service Badges */}
        {shop.categories && shop.categories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {shop.categories.slice(0, 3).map((cat, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: '#F0F3FC',
                  color: '#315EC3'
                }}
              >
                {cat}
              </span>
            ))}
            {shop.categories.length > 3 && (
              <span style={{ fontSize: 10.5, color: '#9AA5C4', padding: '2px 4px' }}>
                +{shop.categories.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 10, borderTop: '1px solid #F0F3FC' }}>
          <div style={{ fontSize: 11.5, color: '#64748B' }}>
            {shop.services ? `${shop.services.length} แพ็กเกจพร้อมให้บริการ` : 'เปิดรับจองออนไลน์'}
          </div>
          <button
            onClick={e => {
              e.stopPropagation()
              onSelect()
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              background: '#EFF3FD',
              color: '#315EC3',
              border: 'none',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            เลือกดู <ChevronRight size={13} />
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

  // Filters & Search
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'earliest' | 'distance' | 'rating' | 'price'>('earliest')

  // Layout View Mode: 'split' | 'list' | 'map'
  const [viewMode, setViewMode] = useState<'split' | 'list' | 'map'>('split')
  const [isMobile, setIsMobile] = useState(false)

  // User Geolocation
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [locLoading, setLocLoading] = useState(false)

  // Selected Shop Drawer & Report Modal
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [reportModalOpen, setReportModalOpen] = useState(false)

  // Responsive Screen Detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      if (mobile) {
        setViewMode(current => (current === 'split' ? 'list' : current))
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Auto detect user location once on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        },
        () => {
          // Default to Khon Kaen
          setUserLoc({ lat: 16.4419, lng: 102.8360 })
        },
        { timeout: 8000 }
      )
    }
  }, [])

  // Fetch shops & categories from API
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const latParam = userLoc ? `lat=${userLoc.lat}&lng=${userLoc.lng}` : ''
      const res = await fetch(`/api/marketplace/shops?${latParam}`)
      const data = await res.json()
      if (data.shops) {
        let list: Shop[] = data.shops
        if (userLoc) {
          list = list.map(s => ({
            ...s,
            distance_km: s.lat && s.lng ? calculateDistanceKm(userLoc.lat, userLoc.lng, s.lat, s.lng) : undefined
          }))
        }
        setShops(list)
      }
      if (data.categories) {
        setCategories(data.categories)
      }
    } catch (err) {
      console.error('Failed to load marketplace shops:', err)
    } finally {
      setLoading(false)
    }
  }, [userLoc])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Get current location manually
  const getLocation = () => {
    if (!navigator.geolocation) {
      alert('เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง GPS')
      return
    }
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocLoading(false)
      },
      err => {
        alert('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาเปิดอนุญาต Location: ' + err.message)
        setLocLoading(false)
      },
      { timeout: 10000 }
    )
  }

  // Filter & Sort shops
  const filteredShops = useMemo(() => {
    let result = [...shops]

    // Search query filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.shop_name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        (s.categories && s.categories.some(c => c.toLowerCase().includes(q))) ||
        (s.services && s.services.some(srv => srv.name.toLowerCase().includes(q) || (srv.description && srv.description.toLowerCase().includes(q))))
      )
    }

    // Category filter
    if (selectedCategory !== 'all') {
      const activeCat = categories.find(c => c.id === selectedCategory)
      if (activeCat) {
        result = result.filter(s => {
          if (!s.services || s.services.length === 0) return false
          return s.services.some(srv =>
            activeCat.service_ids.includes(srv.id) ||
            activeCat.service_names.includes(srv.name) ||
            srv.name.toLowerCase().includes(activeCat.label.toLowerCase())
          )
        })
      }
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'earliest') {
        const aOut = a.earliest_slot?.is_out_of_reach ? 1 : 0
        const bOut = b.earliest_slot?.is_out_of_reach ? 1 : 0
        if (aOut !== bOut) return aOut - bOut

        const dtA = a.earliest_slot?.datetime || '9999-99-99 99:99'
        const dtB = b.earliest_slot?.datetime || '9999-99-99 99:99'
        return dtA.localeCompare(dtB)
      }
      if (sortBy === 'distance') {
        const da = a.distance_km ?? 99999
        const db = b.distance_km ?? 99999
        return da - db
      }
      if (sortBy === 'rating') {
        return (b.avg_rating || 0) - (a.avg_rating || 0)
      }
      if (sortBy === 'price') {
        return (a.price_from || 0) - (b.price_from || 0)
      }
      return 0
    })

    return result
  }, [shops, search, selectedCategory, sortBy, categories])

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#F6F8FF',
      fontFamily: 'var(--font-kanit, "Kanit", sans-serif)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* ── Top Header ── */}
      <header style={{
        background: '#FFFFFF',
        borderBottom: '1.5px solid #DDE3F5',
        padding: '0 16px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        boxShadow: '0 2px 10px rgba(49, 94, 195, 0.04)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo width={115} />
        </div>

        {/* Desktop View Mode Segmented Controls (Split / List / Map) */}
        <div className="desktop-view-toggle" style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F0F3FC', padding: 4, borderRadius: 12 }}>
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
            <Columns size={13} /> หน้าจอคู่
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
            <ListIcon size={13} /> รายการ ({filteredShops.length})
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

        {/* Mobile View Toggle Pill in Topbar */}
        <div className="mobile-view-toggle" style={{ display: 'none', alignItems: 'center', gap: 4, background: '#EFF3FD', padding: 3, borderRadius: 10 }}>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: 'none',
              background: viewMode === 'list' ? '#315EC3' : 'transparent',
              color: viewMode === 'list' ? '#FFFFFF' : '#5A6589',
              fontSize: 11.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <ListIcon size={12} /> รายการ
          </button>
          <button
            onClick={() => setViewMode('map')}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: 'none',
              background: viewMode === 'map' ? '#315EC3' : 'transparent',
              color: viewMode === 'map' ? '#FFFFFF' : '#5A6589',
              fontSize: 11.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <MapIcon size={12} /> แผนที่
          </button>
        </div>
      </header>

      {/* ── Filter & Search Bar Area ── */}
      <div style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #DDE3F5',
        padding: '10px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        {/* Search Input & GPS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 280px', width: '100%' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <SearchIcon size={15} color="#9AA5C4" style={{ position: 'absolute', left: 12 }} />
            <input
              type="text"
              placeholder="ค้นหาชื่อร้าน หรือแพ็กเกจ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 32px 8px 34px',
                borderRadius: 12,
                border: '1.5px solid #DDE3F5',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
                color: '#1A2340',
                background: '#F6F8FF',
                boxSizing: 'border-box'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#9AA5C4' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={getLocation}
            disabled={locLoading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px',
              borderRadius: 12, border: 'none',
              background: userLoc ? '#DCFCE7' : '#EFF3FD',
              color: userLoc ? '#15803D' : '#315EC3',
              fontSize: 12.5, fontWeight: 700,
              cursor: locLoading ? 'wait' : 'pointer',
              whiteSpace: 'nowrap', fontFamily: 'inherit',
              flexShrink: 0
            }}
            title="ระบุตำแหน่งเพื่อคำนวณเวลาที่พร้อมให้บริการเร็วที่สุด"
          >
            <Navigation2 size={13} />
            <span className="loc-btn-text">
              {locLoading ? 'กำลังค้นหา...' : userLoc ? 'พิกัดของฉัน' : 'ใกล้ฉัน'}
            </span>
          </button>
        </div>

        {/* GPS location feedback indicator (Foami Themed) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: '#F0F4FC',
          border: '1px solid #D8E2F8',
          borderRadius: 8,
          fontSize: 11.5,
          color: '#315EC3',
          fontWeight: 600
        }}>
          <Navigation2 size={11} color="#315EC3" />
          <span>{userLoc ? 'อิงตำแหน่ง GPS ของคุณ: คำนวณคิวที่พร้อมบริการเร็วสุดแล้ว' : 'กดปุ่ม GPS เพื่อคำนวณคิวพร้อมบริการตามตำแหน่งจริง'}</span>
        </div>

        {/* Category Chips Bar & Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', overflow: 'hidden' }}>
          {/* Scrollable category chips */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 2,
            flex: 1,
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch'
          }}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '5px 12px',
                borderRadius: 999,
                border: `1.5px solid ${selectedCategory === 'all' ? '#315EC3' : '#DDE3F5'}`,
                background: selectedCategory === 'all' ? '#EFF3FD' : '#FFFFFF',
                color: selectedCategory === 'all' ? '#315EC3' : '#5A6589',
                fontSize: 12,
                fontWeight: selectedCategory === 'all' ? 800 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                flexShrink: 0
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
                    gap: 5,
                    padding: '5px 12px',
                    borderRadius: 999,
                    border: `1.5px solid ${active ? '#315EC3' : '#DDE3F5'}`,
                    background: active ? '#EFF3FD' : '#FFFFFF',
                    color: active ? '#315EC3' : '#475569',
                    fontSize: 12,
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                    flexShrink: 0
                  }}
                >
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>

          {/* Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <ArrowUpDown size={13} color="#5A6589" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              style={{
                padding: '5px 8px', borderRadius: 8, border: '1.5px solid #DDE3F5',
                background: '#FFFFFF', color: '#1A2340', fontSize: 11.5, fontWeight: 600,
                outline: 'none', fontFamily: 'inherit', cursor: 'pointer'
              }}
            >
              <option value="earliest">คิวที่ว่างเร็วที่สุด</option>
              <option value="distance">ใกล้ที่สุด</option>
              <option value="rating">คะแนนรีวิว</option>
              <option value="price">ราคาเริ่มต้น</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Main Responsive Content ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', width: '100%', height: 'calc(100vh - 120px)' }}>
        {/* ── Shop Cards Column ── */}
        {(viewMode === 'split' || viewMode === 'list') && (
          <div
            className="responsive-shop-list"
            style={{
              flex: viewMode === 'list' ? '1 1 100%' : '0 0 440px',
              width: viewMode === 'list' ? '100%' : 440,
              maxWidth: viewMode === 'list' ? 1100 : 440,
              margin: viewMode === 'list' ? '0 auto' : '0',
              height: '100%',
              overflowY: 'auto',
              padding: '16px 16px 60px',
              boxSizing: 'border-box',
              background: '#FFFFFF',
              borderRight: viewMode === 'split' ? '1.5px solid #DDE3F5' : 'none',
              zIndex: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
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
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#F8FAFC', borderRadius: 20, border: '1.5px dashed #CBD5E1' }}>
                <Droplets size={36} color="#94A3B8" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1A2340', marginBottom: 4 }}>ไม่พบร้านล้างรถที่ตรงกับเงื่อนไข</div>
                <div style={{ fontSize: 12.5, color: '#64748B' }}>ลองเปลี่ยนคำค้นหา หรือเลือกตัวกรองหมวดหมู่อื่น</div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: viewMode === 'list' ? 'repeat(auto-fill, minmax(290px, 1fr))' : '1fr',
                gap: 14
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
        )}

        {/* ── Leaflet Map Column ── */}
        {(viewMode === 'split' || viewMode === 'map') && (
          <div
            className="responsive-map-container"
            style={{
              flex: 1,
              width: '100%',
              height: '100%',
              position: 'relative'
            }}
          >
            <MarketplaceMap
              shops={filteredShops}
              selectedShop={selectedShop}
              onSelectShop={setSelectedShop}
              userLocation={userLoc}
            />

            {/* Mobile floating map card preview when a shop pin is selected */}
            {isMobile && selectedShop && viewMode === 'map' && (
              <div style={{
                position: 'absolute',
                bottom: 74,
                left: 14,
                right: 14,
                zIndex: 400,
                background: '#FFFFFF',
                borderRadius: 18,
                padding: '12px 14px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
                border: '1.5px solid #315EC3',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                {selectedShop.logo_url ? (
                  <img
                    src={selectedShop.logo_url}
                    alt={selectedShop.shop_name}
                    style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: '#EFF3FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#315EC3', flexShrink: 0 }}>
                    {(selectedShop.shop_name || 'F')[0]}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedShop.shop_name}
                  </div>
                  <div style={{ fontSize: 12, color: '#2563EB', fontWeight: 800, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>เริ่มต้น ฿{selectedShop.price_from}</span>
                    {selectedShop.distance_km !== undefined && (
                      <span style={{ color: '#64748B', fontWeight: 500 }}>
                        · {selectedShop.distance_km} กม.
                      </span>
                    )}
                    {selectedShop.earliest_slot && !selectedShop.earliest_slot.is_out_of_reach && (
                      <span style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: '#315EC3',
                        background: '#EFF3FD',
                        border: '1px solid #D8E2F8',
                        padding: '1px 6px',
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3
                      }}>
                        <Clock size={10} color="#315EC3" />
                        เร็วสุด {selectedShop.earliest_slot.short_text}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedShop(selectedShop)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: '#2563EB',
                    color: '#FFF',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  จองคิว
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Mobile Floating Bottom Switcher (Airbnb-Style FAB) ── */}
        <div className="mobile-floating-fab" style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 500,
          display: 'none'
        }}>
          <button
            onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
            style={{
              padding: '10px 20px',
              borderRadius: 999,
              background: 'linear-gradient(135deg, #1E3A8A, #315EC3)',
              color: '#FFFFFF',
              border: '1.5px solid rgba(255,255,255,0.2)',
              fontSize: 13,
              fontWeight: 800,
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer'
            }}
          >
            {viewMode === 'map' ? (
              <>
                <ListIcon size={15} /> ดูรายการร้าน ({filteredShops.length})
              </>
            ) : (
              <>
                <MapIcon size={15} /> ดูบนแผนที่
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Responsive Slide-Up Drawer / Bottom Sheet for Selected Shop ── */}
      {selectedShop && (
        <>
          <div
            onClick={() => setSelectedShop(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.55)',
              zIndex: 1000,
              backdropFilter: 'blur(4px)',
              transition: 'opacity 0.2s'
            }}
          />
          <div
            className="shop-drawer-modal"
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1001,
              background: '#FFFFFF',
              borderRadius: '28px 28px 0 0',
              padding: '20px 20px 32px',
              maxHeight: '88vh',
              maxWidth: 640,
              margin: '0 auto',
              overflowY: 'auto',
              boxShadow: '0 -16px 40px rgba(0,0,0,0.25)',
              boxSizing: 'border-box'
            }}
          >
            {/* Pull Handle bar */}
            <div style={{ width: 44, height: 5, background: '#CBD5E1', borderRadius: 999, margin: '0 auto 16px' }} />

            {/* Shop Header Info */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
              {selectedShop.logo_url ? (
                <img
                  src={selectedShop.logo_url}
                  alt={selectedShop.shop_name}
                  style={{ width: 56, height: 56, borderRadius: 16, objectFit: 'cover', border: '2px solid #DDE3F5', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 56, height: 56, borderRadius: 16, background: '#EFF3FD',
                  border: '2px solid #DDE3F5', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#315EC3', flexShrink: 0
                }}>
                  {(selectedShop.shop_name || 'F')[0]}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: '#1A2340', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedShop.shop_name}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
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
                        gap: 3
                      }}
                      title="รายงานปัญหาร้านค้านี้"
                    >
                      <Shield size={11} /> รายงานร้าน
                    </button>
                    <button
                      onClick={() => setSelectedShop(null)}
                      style={{ background: '#F0F3FC', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#5A6589' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: 12.5 }}>
                  {selectedShop.avg_rating > 0 && selectedShop.review_count > 0 ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#D97706', fontWeight: 700 }}>
                      <Star size={13} fill="#F59E0B" color="#F59E0B" /> {selectedShop.avg_rating.toFixed(1)} ({selectedShop.review_count} รีวิว)
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#94A3B8', fontWeight: 600 }}>
                      <Star size={13} color="#CBD5E1" /> ยังไม่มีรีวิว
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

            {/* Address */}
            {selectedShop.address && (
              <div style={{
                display: 'flex', gap: 8, fontSize: 12.5, color: '#5A6589',
                marginBottom: 12, background: '#F6F8FF', padding: '9px 12px', borderRadius: 12
              }}>
                <MapPin size={15} color="#315EC3" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ wordBreak: 'break-word' }}>{selectedShop.address}</span>
              </div>
            )}

            {/* Shop Description */}
            {selectedShop.description && (
              <p style={{
                fontSize: 13, color: '#475569', lineHeight: 1.5,
                marginBottom: 16, background: '#FAFAFA', padding: '10px 14px',
                borderRadius: 12, border: '1px solid #F1F5F9', wordBreak: 'break-word'
              }}>
                {selectedShop.description}
              </p>
            )}

            {/* Earliest Availability Banner (Foami Brand Themed) */}
            {selectedShop.earliest_slot && (
              <div style={{
                marginBottom: 16,
                background: selectedShop.earliest_slot.is_out_of_reach ? '#F8FAFC' : '#F0F4FC',
                border: `1px solid ${selectedShop.earliest_slot.is_out_of_reach ? '#E2E8F0' : '#D8E2F8'}`,
                borderRadius: 14,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: '#FFFFFF',
                    border: `1px solid ${selectedShop.earliest_slot.is_out_of_reach ? '#E2E8F0' : '#D8E2F8'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: selectedShop.earliest_slot.is_out_of_reach ? '#64748B' : '#315EC3',
                    flexShrink: 0
                  }}>
                    {selectedShop.earliest_slot.is_out_of_reach ? (
                      <AlertTriangle size={16} color="#64748B" />
                    ) : (
                      <Clock size={16} color="#315EC3" />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#5A6589', fontWeight: 600 }}>
                      เวลาที่พร้อมให้บริการเร็วที่สุด
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1A2340', marginTop: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{selectedShop.earliest_slot.display_text}</span>
                      {selectedShop.earliest_slot.is_in_zone && (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#315EC3',
                          background: '#FFFFFF',
                          border: '1px solid #D8E2F8',
                          padding: '2px 7px',
                          borderRadius: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3
                        }}>
                          <MapPin size={10} color="#315EC3" />
                          {selectedShop.earliest_slot.zone_name ? `โซน${selectedShop.earliest_slot.zone_name}` : 'ในพื้นที่บริการ'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!selectedShop.earliest_slot.is_out_of_reach && (
                  <button
                    onClick={() => router.push(`/${selectedShop.shop_slug}/book?date=${selectedShop.earliest_slot?.date}&slot=${selectedShop.earliest_slot?.time}`)}
                    style={{
                      background: '#315EC3',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 10,
                      padding: '8px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(49, 94, 195, 0.2)',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#2563EB' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#315EC3' }}
                  >
                    จองรอบนี้ <ChevronRight size={13} />
                  </button>
                )}
              </div>
            )}

            {/* Packages & Services (Zero duplicate buttons) */}
            <div style={{ marginBottom: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 14, fontWeight: 800, color: '#1A2340', marginBottom: 10
              }}>
                <Package size={16} color="#315EC3" />
                เลือกแพ็กเกจเพื่อจองคิว
              </div>

              {selectedShop.services && selectedShop.services.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...selectedShop.services].sort((a, b) => {
                    const pA = a.price_s || a.price_m || a.price_l || 0
                    const pB = b.price_s || b.price_m || b.price_l || 0
                    return pA - pB
                  }).map(srv => {
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
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          cursor: 'pointer',
                          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = '#315EC3'
                          e.currentTarget.style.background = '#FBFDFF'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = '#E2E8F0'
                          e.currentTarget.style.background = '#FFFFFF'
                        }}
                      >
                        {/* Service Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 14.5, color: '#0F172A', marginBottom: 2 }}>
                            {srv.name}
                          </div>

                          {mainText && (
                            <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.4, marginBottom: 4 }}>
                              {mainText}
                            </div>
                          )}

                          {/* Addon Badges */}
                          {addons.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                              {addons.map((ad, i) => (
                                <span
                                  key={i}
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    background: '#EFF6FF',
                                    color: '#2563EB',
                                    border: '1px solid #DBEAFE',
                                    padding: '2px 7px',
                                    borderRadius: 999,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3
                                  }}
                                >
                                  <Tag size={9} /> {ad}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Price & Action Button */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 17, fontWeight: 900, color: '#2563EB', lineHeight: 1 }}>
                            {priceDisplay}
                          </div>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              router.push(`/${selectedShop.shop_slug}/book?service=${srv.id}`)
                            }}
                            style={{
                              marginTop: 6,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: '6px 12px',
                              borderRadius: 10,
                              background: 'linear-gradient(135deg, #1E3A8A, #315EC3)',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: 11.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(49, 94, 195, 0.25)'
                            }}
                          >
                            จองแพ็กนี้ <ChevronRight size={12} />
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
                      padding: '10px 20px',
                      borderRadius: 12,
                      background: '#315EC3',
                      color: '#fff',
                      textDecoration: 'none',
                      fontWeight: 800,
                      fontSize: 13
                    }}
                  >
                    จองคิวออนไลน์ทันที <ChevronRight size={15} />
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

        /* Tablet & Mobile Breakpoint */
        @media (max-width: 1023px) {
          .desktop-view-toggle {
            display: none !important;
          }
          .mobile-view-toggle {
            display: flex !important;
          }
          .mobile-floating-fab {
            display: block !important;
          }
          .responsive-shop-list {
            flex: 1 1 100% !important;
            width: 100% !important;
            max-width: 100% !important;
            border-right: none !important;
            padding-bottom: 90px !important;
          }
          .responsive-map-container {
            flex: 1 1 100% !important;
            width: 100% !important;
            height: 100% !important;
          }
          .shop-drawer-modal {
            max-width: 100% !important;
            border-radius: 28px 28px 0 0 !important;
            padding: 16px 14px 28px !important;
          }
        }

        @media (max-width: 480px) {
          .loc-btn-text {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
