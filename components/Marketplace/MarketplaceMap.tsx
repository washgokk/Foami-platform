'use client'
import { useEffect, useRef } from 'react'

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

export interface Shop {
  id: string
  shop_slug: string
  shop_name: string
  description?: string
  categories?: string[]
  featured_photos?: string[]
  avg_rating: number
  review_count: number
  booking_count?: number
  is_featured?: boolean
  lat: number
  lng: number
  address?: string
  logo_url?: string
  price_from: number
  distance_km?: number
  services?: any[]
  earliest_slot?: EarliestSlotInfo
}

interface Props {
  shops: any[]
  selectedShop: any | null
  onSelectShop: (shop: any) => void
  userLocation: { lat: number; lng: number } | null
}

export default function MarketplaceMap({ shops, selectedShop, onSelectShop, userLocation }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersGroupRef = useRef<any>(null)

  // 1. Initialize Map
  useEffect(() => {
    if (!mapRef.current) return

    let map: any = null

    import('leaflet').then(L => {
      if (!mapRef.current) return

      // Load Leaflet CSS if not already present
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      const defaultCenter: [number, number] = userLocation 
        ? [userLocation.lat, userLocation.lng] 
        : [16.4419, 102.8360]

      map = L.map(mapRef.current!, {
        center: defaultCenter,
        zoom: 12,
        zoomControl: false,
        attributionControl: false
      })

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Clean OpenStreetMap tiles (100% free, no API KEY REQUIRED watermark)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(map)

      markersGroupRef.current = L.featureGroup().addTo(map)
      mapInstanceRef.current = map

      renderMarkers(L, map)
    })

    return () => {
      if (map) {
        map.remove()
      }
      mapInstanceRef.current = null
    }
  }, [])

  // 2. Re-render markers when shops, selectedShop, or userLocation changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return
    import('leaflet').then(L => {
      renderMarkers(L, mapInstanceRef.current)
    })
  }, [shops, selectedShop, userLocation])

  const renderMarkers = (L: any, map: any) => {
    if (!markersGroupRef.current) return
    markersGroupRef.current.clearLayers()

    // Render User Location Pin if available
    if (userLocation && userLocation.lat && userLocation.lng) {
      const userIcon = L.divIcon({
        className: 'user-gps-marker',
        html: `
          <div style="
            width: 22px;
            height: 22px;
            background: #22C55E;
            border: 3.5px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 0 16px rgba(34, 197, 94, 0.8), 0 2px 8px rgba(0,0,0,0.25);
            animation: pulse-gps 2s infinite;
          "></div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })

      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 })
        .addTo(markersGroupRef.current)
        .bindTooltip('ตำแหน่งปัจจุบันของคุณ (อิงเวลาพร้อมบริการ)', { permanent: false, direction: 'top' })
    }

    const bounds = L.latLngBounds([])

    shops.forEach(shop => {
      if (!shop.lat || !shop.lng) return

      const isSelected = selectedShop?.id === shop.id
      const priceText = shop.price_from > 0 ? `฿${shop.price_from}` : 'ดูร้าน'

      // Avatar or Shop Logo
      const logoHtml = shop.logo_url 
        ? `<img src="${shop.logo_url}" alt="${shop.shop_name}" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover; border: 1.5px solid ${isSelected ? '#FFFFFF' : '#315EC3'}; flex-shrink: 0; background: #FFF;" />`
        : `<div style="width: 26px; height: 26px; border-radius: 50%; background: ${isSelected ? 'rgba(255,255,255,0.2)' : '#EFF3FD'}; border: 1.5px solid ${isSelected ? '#FFFFFF' : '#315EC3'}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; color: ${isSelected ? '#FFFFFF' : '#315EC3'}; flex-shrink: 0;">${(shop.shop_name || 'F')[0]}</div>`

      const ratingBadge = (shop.avg_rating > 0 && shop.review_count > 0)
        ? `<span style="font-size: 10.5px; font-weight: 800; color: ${isSelected ? '#FDE68A' : '#D97706'}; background: ${isSelected ? 'rgba(0,0,0,0.2)' : '#FEF3C7'}; padding: 2px 6px; border-radius: 6px; display: inline-flex; align-items: center; gap: 2px;">★ ${shop.avg_rating.toFixed(1)}</span>`
        : ''

      // Earliest Slot Pill on Map Marker (Foami Brand Themed)
      const slotBadge = shop.earliest_slot && !shop.earliest_slot.is_out_of_reach
        ? `<span style="font-size: 9.5px; font-weight: 600; color: ${isSelected ? '#FFFFFF' : '#315EC3'}; background: ${isSelected ? 'rgba(255,255,255,0.2)' : '#EFF3FD'}; padding: 1px 6px; border-radius: 4px; display: inline-flex; align-items: center; border: 0.5px solid ${isSelected ? 'rgba(255,255,255,0.3)' : '#D8E2F8'};">ว่าง ${shop.earliest_slot.short_text}</span>`
        : (shop.earliest_slot?.is_out_of_reach
          ? `<span style="font-size: 9px; font-weight: 600; color: #94A3B8; background: #F8FAFC; padding: 1px 5px; border-radius: 4px;">นอกโซน</span>`
          : '')

      // Marker Pin with Shop Logo, Shop Name, Starting Price, Earliest Slot, and pointer tip
      const pricePinIcon = L.divIcon({
        className: 'foami-shop-marker',
        html: `
          <div style="
            position: relative;
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            transform: translate(-50%, -100%);
            cursor: pointer;
            filter: drop-shadow(0 6px 14px rgba(0, 0, 0, ${isSelected ? '0.3' : '0.15'}));
            transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          ">
            <div style="
              background: ${isSelected ? 'linear-gradient(135deg, #1E3A8A, #315EC3)' : '#FFFFFF'};
              color: ${isSelected ? '#FFFFFF' : '#1A2340'};
              border: 2px solid ${isSelected ? '#214192' : '#315EC3'};
              border-radius: 999px;
              padding: 4px 12px 4px 5px;
              font-family: 'Kanit', sans-serif;
              display: inline-flex;
              align-items: center;
              gap: 8px;
              white-space: nowrap;
              user-select: none;
            ">
              ${logoHtml}
              <div style="display: flex; flex-direction: column; text-align: left; line-height: 1.2;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 11.5px; font-weight: 900; color: ${isSelected ? '#FFFFFF' : '#0F172A'}; max-width: 130px; overflow: hidden; text-overflow: ellipsis;">
                    ${shop.shop_name}
                  </span>
                  ${ratingBadge}
                </div>
                <div style="display: flex; align-items: center; gap: 6px; margin-top: 1px;">
                  <span style="font-size: 11.5px; font-weight: 800; color: ${isSelected ? '#93C5FD' : '#2563EB'};">
                    เริ่มต้น ${priceText}
                  </span>
                  ${slotBadge}
                </div>
              </div>
            </div>
            
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 7px solid ${isSelected ? '#1E3A8A' : '#315EC3'};
              margin-top: -1px;
            "></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      })

      L.marker([shop.lat, shop.lng], { icon: pricePinIcon })
        .addTo(markersGroupRef.current)
        .on('click', () => {
          onSelectShop(shop)
        })

      bounds.extend([shop.lat, shop.lng])
    })

    if (userLocation && userLocation.lat && userLocation.lng) {
      bounds.extend([userLocation.lat, userLocation.lng])
    }

    // Fit map bounds if shops exist and not yet centered
    if (bounds.isValid() && !mapInstanceRef.current._hasInitialFit) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
      mapInstanceRef.current._hasInitialFit = true
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
      <style jsx global>{`
        @keyframes pulse-gps {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          70% { box-shadow: 0 0 0 14px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        .foami-shop-marker:hover {
          transform: translate(-50%, -105%) scale(1.05) !important;
          z-index: 999 !important;
        }
      `}</style>
    </div>
  )
}
