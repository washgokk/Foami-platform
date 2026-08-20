'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  MapPin, Search as SearchIcon, Navigation2, Star, Clock,
  ChevronRight, Bike, Droplets, Wrench, Zap, Filter, X, RefreshCw
} from 'lucide-react'

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

const CATEGORY_ICONS: Record<string, any> = {
  'ล้างรถ': Droplets,
  'อุปกรณ์': Wrench,
  'มอเตอร์ไซค์': Bike,
  'ด่วน': Zap,
}

function ShopCard({ shop, onSelect }: { shop: Shop; onSelect: () => void }) {
  const photos = Array.isArray(shop.featured_photos) ? shop.featured_photos : []
  return (
    <div
      onClick={onSelect}
      style={{
        background: '#fff', border: '1.5px solid #E8EEF8', borderRadius: 20,
        overflow: 'hidden', cursor: 'pointer', transition: 'all .2s',
        boxShadow: '0 2px 12px rgba(26,35,64,.06)'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(49,94,195,.14)'
        e.currentTarget.style.borderColor = '#315EC3'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(26,35,64,.06)'
        e.currentTarget.style.borderColor = '#E8EEF8'
      }}
    >
      {/* Cover photo */}
      <div style={{
        height: 140, background: photos[0]
          ? `url(${photos[0]}) center/cover`
          : 'linear-gradient(135deg,#EFF3FD,#DDE6FB)',
        position: 'relative'
      }}>
        {shop.is_featured && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'linear-gradient(135deg,#F59E0B,#EF4444)',
            color: '#fff', borderRadius: 8, padding: '3px 8px',
            fontSize: 10, fontWeight: 700, letterSpacing: '.04em'
          }}>⭐ FEATURED</div>
        )}
        {shop.distance_km !== undefined && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(255,255,255,.92)', borderRadius: 8,
            padding: '3px 8px', fontSize: 10, fontWeight: 700,
            color: '#315EC3', display: 'flex', alignItems: 'center', gap: 3
          }}>
            <Navigation2 size={9} /> {shop.distance_km} km
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          {shop.logo_url && (
            <img src={shop.logo_url} alt={shop.shop_name}
              style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', border: '2px solid #E8EEF8', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2340', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {shop.shop_name}
            </div>
            {shop.address && (
              <div style={{ fontSize: 11, color: '#9AA5C4', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                <MapPin size={9} /> {shop.address}
              </div>
            )}
          </div>
        </div>

        {/* Rating + Bookings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {shop.avg_rating > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Star size={12} fill="#F59E0B" color="#F59E0B" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1A2340' }}>{shop.avg_rating.toFixed(1)}</span>
              <span style={{ fontSize: 11, color: '#9AA5C4' }}>({shop.review_count})</span>
            </div>
          )}
          {shop.booking_count > 0 && (
            <div style={{ fontSize: 11, color: '#9AA5C4', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={9} /> {shop.booking_count} งาน
            </div>
          )}
        </div>

        {/* Categories */}
        {(shop.categories || []).length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {shop.categories.slice(0, 3).map(cat => {
              const Icon = CATEGORY_ICONS[cat]
              return (
                <span key={cat} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '3px 8px', borderRadius: 7, fontSize: 10, fontWeight: 600,
                  background: '#EFF3FD', color: '#315EC3'
                }}>
                  {Icon && <Icon size={9} />} {cat}
                </span>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {shop.price_from > 0 && (
              <span style={{ fontSize: 13, fontWeight: 700, color: '#315EC3' }}>
                เริ่ม ฿{shop.price_from.toLocaleString('th')}
              </span>
            )}
          </div>
          <Link
            href={`/${shop.shop_slug}/book`}
            onClick={e => e.stopPropagation()}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700,
              background: 'linear-gradient(135deg,#214192,#315EC3)', color: '#fff',
              textDecoration: 'none'
            }}
          >
            จองเลย <ChevronRight size={12} />
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
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (userLoc) { params.set('lat', String(userLoc.lat)); params.set('lng', String(userLoc.lng)) }
      if (search) params.set('search', search)
      const res = await fetch(`/api/marketplace/shops?${params}`)
      const data = await res.json()
      setShops(data.shops || [])
    } finally {
      setLoading(false)
    }
  }, [userLoc, search])

  useEffect(() => { load() }, [load])

  const getLocation = () => {
    setLocLoading(true)
    navigator.geolocation?.getCurrentPosition(
      pos => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocLoading(false) },
      () => setLocLoading(false)
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F6F8FF',
      fontFamily: 'Kanit, sans-serif'
    }}>
      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg,#0f1e4a 0%,#1e3d8f 50%,#315EC3 100%)',
        padding: '52px 24px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden'
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />

        <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.12)', borderRadius: 99, padding: '5px 14px', marginBottom: 18 }}>
            <Droplets size={13} color="#93C5FD" />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#93C5FD', letterSpacing: '.06em' }}>FOAMI MARKETPLACE</span>
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: '#fff', lineHeight: 1.2, margin: '0 0 10px' }}>
            ค้นหาร้านล้างรถ<br />ใกล้บ้านคุณ
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,.7)', margin: '0 0 28px' }}>
            จองออนไลน์ ชำระเงินง่าย รับรถถึงบ้าน
          </p>

          {/* Search Box */}
          <div style={{
            background: '#fff', borderRadius: 18, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 16px 40px rgba(0,0,0,.25)'
          }}>
            <SearchIcon size={16} color="#9AA5C4" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="ค้นหาร้าน หรือพื้นที่..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none', fontSize: 14,
                fontFamily: 'Kanit, sans-serif', color: '#1A2340'
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <X size={14} color="#9AA5C4" />
              </button>
            )}
            <button
              onClick={getLocation}
              disabled={locLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                background: userLoc ? '#DCFCE7' : '#EFF3FD',
                color: userLoc ? '#15803D' : '#315EC3',
                border: 'none', cursor: locLoading ? 'wait' : 'pointer',
                flexShrink: 0
              }}
            >
              <Navigation2 size={13} />
              {locLoading ? '...' : userLoc ? 'ใกล้ฉัน' : 'ตำแหน่งฉัน'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '-32px auto 0', padding: '0 20px 48px' }}>
        {/* Stats bar */}
        <div style={{
          background: '#fff', borderRadius: 18, padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 8px 24px rgba(26,35,64,.09)', marginBottom: 24,
          border: '1px solid #E8EEF8'
        }}>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#315EC3' }}>{shops.length}</div>
              <div style={{ fontSize: 10, color: '#9AA5C4', fontWeight: 600 }}>ร้านทั้งหมด</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#22C55E' }}>
                {shops.filter(s => s.avg_rating >= 4).length}
              </div>
              <div style={{ fontSize: 10, color: '#9AA5C4', fontWeight: 600 }}>Rating 4+ ⭐</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#F59E0B' }}>
                {shops.filter(s => s.is_featured).length}
              </div>
              <div style={{ fontSize: 10, color: '#9AA5C4', fontWeight: 600 }}>Featured</div>
            </div>
          </div>
          {userLoc && (
            <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Navigation2 size={12} /> เรียงตามระยะทาง
            </div>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 64, color: '#9AA5C4' }}>
            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13 }}>กำลังค้นหาร้าน...</div>
          </div>
        ) : shops.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <MapPin size={40} style={{ opacity: .2, margin: '0 auto 16px', display: 'block' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A2340', marginBottom: 6 }}>ไม่พบร้านในขณะนี้</div>
            <div style={{ fontSize: 13, color: '#9AA5C4' }}>ลองเปลี่ยนคำค้นหา หรือรอร้านพาร์ทเนอร์ใหม่เร็วๆ นี้</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
            gap: 18
          }}>
            {shops.map(shop => (
              <ShopCard key={shop.id} shop={shop} onSelect={() => setSelectedShop(shop)} />
            ))}
          </div>
        )}

        {/* CTA for shops */}
        <div style={{
          marginTop: 48, background: 'linear-gradient(135deg,#0f1e4a,#315EC3)',
          borderRadius: 24, padding: '32px 36px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 20
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 }}>เปิดร้านบน Foami</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
              เพิ่มรายได้ ขยายฐานลูกค้า ระบบจัดการครบครัน
            </div>
          </div>
          <a href="/register" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 22px', borderRadius: 14, fontSize: 13, fontWeight: 700,
            background: '#fff', color: '#1A2340', textDecoration: 'none',
            boxShadow: '0 8px 20px rgba(0,0,0,.2)'
          }}>
            สมัครเป็นพาร์ทเนอร์ <ChevronRight size={14} />
          </a>
        </div>
      </div>

      {/* Shop Detail Drawer */}
      {selectedShop && (
        <>
          <div onClick={() => setSelectedShop(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100
          }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
            background: '#fff', borderRadius: '24px 24px 0 0',
            padding: '24px 24px 32px', maxHeight: '70vh', overflow: 'auto',
            boxShadow: '0 -12px 40px rgba(0,0,0,.15)'
          }}>
            <div style={{ width: 36, height: 4, background: '#E8EEF8', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
              {selectedShop.logo_url && (
                <img src={selectedShop.logo_url} alt={selectedShop.shop_name}
                  style={{ width: 56, height: 56, borderRadius: 16, objectFit: 'cover', border: '2px solid #E8EEF8' }} />
              )}
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A2340', margin: '0 0 4px' }}>{selectedShop.shop_name}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#9AA5C4' }}>
                  {selectedShop.avg_rating > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Star size={12} fill="#F59E0B" color="#F59E0B" />
                      {selectedShop.avg_rating.toFixed(1)} ({selectedShop.review_count} รีวิว)
                    </span>
                  )}
                  {selectedShop.distance_km !== undefined && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Navigation2 size={11} /> {selectedShop.distance_km} km
                    </span>
                  )}
                </div>
              </div>
            </div>

            {selectedShop.description && (
              <p style={{ fontSize: 13, color: '#555E7A', lineHeight: 1.6, marginBottom: 16 }}>{selectedShop.description}</p>
            )}

            {selectedShop.address && (
              <div style={{ display: 'flex', gap: 7, fontSize: 13, color: '#555E7A', marginBottom: 16 }}>
                <MapPin size={14} color="#315EC3" style={{ flexShrink: 0, marginTop: 2 }} />
                {selectedShop.address}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <Link href={`/${selectedShop.shop_slug}`} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '12px 0', borderRadius: 14, fontSize: 13, fontWeight: 700,
                border: '2px solid #315EC3', color: '#315EC3', textDecoration: 'none'
              }}>
                ดูโปรไฟล์ร้าน
              </Link>
              <Link href={`/${selectedShop.shop_slug}/book`} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '12px 0', borderRadius: 14, fontSize: 13, fontWeight: 700,
                background: 'linear-gradient(135deg,#214192,#315EC3)', color: '#fff', textDecoration: 'none'
              }}>
                จองเลย <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
