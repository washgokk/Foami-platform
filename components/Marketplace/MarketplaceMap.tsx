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
  is_verified?: boolean
  has_insurance?: boolean
  price_from: number
  distance_km?: number
  services?: any[]
  earliest_slot?: EarliestSlotInfo
}

interface Props {
  shops: any[]
  selectedShop: any | null
  onSelectShop: (shop: any) => void
  onOpenDrawer?: (shop: any) => void
  userLocation: { lat: number; lng: number } | null
}

export default function MarketplaceMap({ shops, selectedShop, onSelectShop, onOpenDrawer, userLocation }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersGroupRef = useRef<any>(null)
  const markersMapRef = useRef<Record<string, any>>({})
  const onSelectShopRef = useRef(onSelectShop)
  const onOpenDrawerRef = useRef(onOpenDrawer)

  // Keep latest handlers in refs to avoid stale closures
  useEffect(() => {
    onSelectShopRef.current = onSelectShop
  }, [onSelectShop])

  useEffect(() => {
    onOpenDrawerRef.current = onOpenDrawer
  }, [onOpenDrawer])

  // 1. Initialize Leaflet Map
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

      // Clean OpenStreetMap tiles
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
      markersMapRef.current = {}
    }
  }, [])

  // 2. Re-render markers when shops or userLocation changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return
    import('leaflet').then(L => {
      renderMarkers(L, mapInstanceRef.current)
    })
  }, [shops, userLocation])

  // 3. When selectedShop changes, pan to it and open its popup
  useEffect(() => {
    if (!selectedShop || !mapInstanceRef.current) return
    const marker = markersMapRef.current[selectedShop.id]
    if (marker) {
      if (selectedShop.lat && selectedShop.lng) {
        mapInstanceRef.current.panTo([selectedShop.lat, selectedShop.lng], {
          animate: true,
          duration: 0.5
        })
      }
      if (!marker.isPopupOpen()) {
        marker.openPopup()
      }
    }
  }, [selectedShop])

  const renderMarkers = (L: any, map: any) => {
    if (!markersGroupRef.current) return
    markersGroupRef.current.clearLayers()
    markersMapRef.current = {}

    // Render User Location Pin if available
    if (userLocation && userLocation.lat && userLocation.lng) {
      const userIcon = L.divIcon({
        className: 'user-gps-marker-container',
        html: `
          <div style="
            width: 20px;
            height: 20px;
            background: #22C55E;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 0 16px rgba(34, 197, 94, 0.8), 0 2px 8px rgba(0,0,0,0.25);
            animation: pulse-gps 2s infinite;
          "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })

      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 })
        .addTo(markersGroupRef.current)
        .bindTooltip('ตำแหน่งปัจจุบันของคุณ', { permanent: false, direction: 'top' })
    }

    const bounds = L.latLngBounds([])

    shops.forEach(shop => {
      if (!shop.lat || !shop.lng) return

      const isSelected = selectedShop?.id === shop.id
      const priceText = shop.price_from > 0 ? `฿${shop.price_from}` : 'ดูร้าน'

      const verifiedBadge = shop.is_verified
        ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:#16A34A;color:#fff;font-size:10px;font-weight:900;margin-left:4px;" title="ร้านค้าผ่านการตรวจสอบแล้ว">✓</span>`
        : ''

      const logoHtml = shop.logo_url 
        ? `<img src="${shop.logo_url}" alt="${shop.shop_name}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 1.5px solid #315EC3; flex-shrink: 0; background: #FFF;" />`
        : `<div style="width: 28px; height: 28px; border-radius: 50%; background: #EFF3FD; border: 1.5px solid #315EC3; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; color: #315EC3; flex-shrink: 0;">${(shop.shop_name || 'F')[0]}</div>`

      const ratingBadge = (shop.avg_rating > 0 && shop.review_count > 0)
        ? `<span style="font-size: 11px; font-weight: 700; color: #D97706; background: #FEF3C7; padding: 2px 6px; border-radius: 6px; display: inline-flex; align-items: center; gap: 3px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${shop.avg_rating.toFixed(1)}</span>`
        : ''

      // Earliest Slot Pill
      const slotBadge = shop.earliest_slot && !shop.earliest_slot.is_out_of_reach
        ? `<span style="font-size: 10px; font-weight: 600; color: #315EC3; background: #EFF3FD; padding: 1px 6px; border-radius: 4px; display: inline-flex; align-items: center; border: 0.5px solid #DDE3F5;">ว่าง ${shop.earliest_slot.short_text}</span>`
        : (shop.earliest_slot?.is_out_of_reach
          ? `<span style="font-size: 9.5px; font-weight: 600; color: #94A3B8; background: #F8FAFC; padding: 1px 5px; border-radius: 4px;">นอกโซน</span>`
          : '')

      const coverPhoto = shop.featured_photos && shop.featured_photos.length > 0
        ? shop.featured_photos[0]
        : (shop.logo_url || '')

      // ── Rich Leaflet Popup Content ──
      const popupHtml = `
        <div class="foami-popup-card" style="font-family: 'Prompt', 'Sarabun', sans-serif; min-width: 250px; max-width: 300px; padding: 2px;">
          ${coverPhoto ? `
            <div style="width: 100%; height: 115px; border-radius: 12px 12px 0 0; overflow: hidden; position: relative; margin: -14px -14px 10px -14px; width: calc(100% + 28px); background: #E2E8F0;">
              <img src="${coverPhoto}" alt="${shop.shop_name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'" />
              <div style="position: absolute; bottom: 8px; left: 10px; background: rgba(26, 35, 64, 0.85); backdrop-filter: blur(4px); color: #FFFFFF; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                เริ่มต้น ฿${shop.price_from}
              </div>
            </div>
          ` : ''}
          <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
            ${!coverPhoto ? logoHtml : ''}
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 700; font-size: 14.5px; color: #0F172A; line-height: 1.25; display: flex; align-items: center; gap: 4px;">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${shop.shop_name}</span>
                ${verifiedBadge}
              </div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 11.5px; color: #64748B;">
                ${ratingBadge}
                ${shop.distance_km !== undefined ? `<span>📍 ${shop.distance_km} กม.</span>` : ''}
              </div>
            </div>
          </div>

          ${shop.earliest_slot && !shop.earliest_slot.is_out_of_reach ? `
            <div style="background: #F0F5FF; border: 1px solid #D1E1FF; border-radius: 8px; padding: 6px 10px; margin: 8px 0; display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #1E40AF; font-weight: 600;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>รอบว่างเร็วสุด: ${shop.earliest_slot.display_text || shop.earliest_slot.short_text}</span>
            </div>
          ` : ''}

          ${shop.address ? `
            <div style="font-size: 11px; color: #64748B; margin: 6px 0 10px 0; line-height: 1.4; max-height: 32px; overflow: hidden; text-overflow: ellipsis;">
              ${shop.address}
            </div>
          ` : ''}

          <div style="display: flex; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px solid #EEF2FA;">
            <button
              id="btn-drawer-${shop.id}"
              style="
                flex: 1;
                padding: 8px 0;
                font-size: 12px;
                font-weight: 700;
                background: #EDF3FF;
                color: #2563EB;
                border: 1.5px solid #D1E1FF;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.15s;
              "
              onmouseover="this.style.background='#DCE8FF'"
              onmouseout="this.style.background='#EDF3FF'"
            >
              ดูข้อมูลร้าน
            </button>
            <a
              href="/${shop.shop_slug}/book"
              style="
                flex: 1;
                text-align: center;
                text-decoration: none;
                padding: 8px 0;
                font-size: 12px;
                font-weight: 700;
                background: #315EC3;
                color: #FFFFFF;
                border-radius: 8px;
                cursor: pointer;
                box-shadow: 0 2px 6px rgba(49, 94, 195, 0.35);
              "
            >
              จองคิวทันที
            </a>
          </div>
        </div>
      `

      // ── Custom DivIcon (Clean anchor without overriding Leaflet's translate3d) ──
      const pricePinIcon = L.divIcon({
        className: 'foami-marker-pin',
        html: `
          <div id="pin-shop-${shop.id}" class="foami-pin-card-wrapper" style="
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            filter: drop-shadow(0 4px 10px rgba(0, 0, 0, ${isSelected ? '0.3' : '0.15'}));
            transition: transform 0.15s ease-out;
            pointer-events: auto;
          ">
            <div style="
              background: ${isSelected ? '#315EC3' : '#FFFFFF'};
              color: ${isSelected ? '#FFFFFF' : '#1A2340'};
              border: 2px solid ${isSelected ? '#1E3A8A' : '#315EC3'};
              border-radius: 999px;
              padding: 4px 12px 4px 5px;
              font-family: 'Prompt', sans-serif;
              display: inline-flex;
              align-items: center;
              gap: 8px;
              white-space: nowrap;
              user-select: none;
              cursor: pointer;
            ">
              ${logoHtml}
              <div style="display: flex; flex-direction: column; text-align: left; line-height: 1.2; pointer-events: none;">
                <div style="display: flex; align-items: center; gap: 5px;">
                  <span style="font-size: 11.5px; font-weight: 700; color: ${isSelected ? '#FFFFFF' : '#0F172A'}; max-width: 125px; overflow: hidden; text-overflow: ellipsis;">
                    ${shop.shop_name}
                  </span>
                  ${ratingBadge}
                </div>
                <div style="display: flex; align-items: center; gap: 5px; margin-top: 1px;">
                  <span style="font-size: 11.5px; font-weight: 700; color: ${isSelected ? '#93C5FD' : '#2563EB'};">
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
              pointer-events: none;
            "></div>
          </div>
        `,
        iconSize: [1, 1],
        iconAnchor: [0, 0]
      })

      const marker = L.marker([shop.lat, shop.lng], { icon: pricePinIcon, riseOnHover: true })
        .addTo(markersGroupRef.current)

      // Bind Leaflet Popup with customized styling sitting cleanly above the pin
      const popup = L.popup({
        offset: [0, -48],
        className: 'foami-leaflet-popup',
        closeButton: true,
        autoPan: true,
        maxWidth: 320,
        minWidth: 260
      }).setContent(popupHtml)

      marker.bindPopup(popup)

      // When popup opens, attach click listener to "ดูข้อมูลร้าน" button
      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-drawer-${shop.id}`)
        if (btn) {
          btn.onclick = (e) => {
            e.stopPropagation()
            if (onOpenDrawerRef.current) {
              onOpenDrawerRef.current(shop)
            } else {
              onSelectShopRef.current(shop)
            }
          }
        }
      })

      const handleTriggerShop = (e?: any) => {
        if (e) {
          if (e.stopPropagation) e.stopPropagation()
          if (e.originalEvent && e.originalEvent.stopPropagation) {
            e.originalEvent.stopPropagation()
          }
        }
        onSelectShopRef.current(shop)
        if (typeof window !== 'undefined' && window.innerWidth < 1024 && onOpenDrawerRef.current) {
          onOpenDrawerRef.current(shop)
        }
        marker.openPopup()
      }

      // Marker Leaflet event listener
      marker.on('click', handleTriggerShop)

      // Direct DOM event listener with disableClickPropagation to prevent map click cancel
      setTimeout(() => {
        const pinEl = document.getElementById(`pin-shop-${shop.id}`)
        if (pinEl) {
          L.DomEvent.disableClickPropagation(pinEl)
          L.DomEvent.disableScrollPropagation(pinEl)
          pinEl.style.cursor = 'pointer'
          pinEl.onclick = handleTriggerShop
          pinEl.ontouchend = handleTriggerShop
        }
      }, 50)

      markersMapRef.current[shop.id] = marker
      bounds.extend([shop.lat, shop.lng])
    })

    if (userLocation && userLocation.lat && userLocation.lng) {
      bounds.extend([userLocation.lat, userLocation.lng])
    }

    // Fit map bounds on first load
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

        .foami-marker-pin {
          overflow: visible !important;
          pointer-events: auto !important;
          cursor: pointer !important;
          background: transparent !important;
          border: none !important;
        }

        .foami-marker-pin * {
          cursor: pointer !important;
        }

        /* Marker hover effect on inner card only to protect Leaflet's translate3d coords */
        .foami-marker-pin .foami-pin-card-wrapper:hover {
          transform: translateX(-50%) translateY(-4px) scale(1.04) !important;
          z-index: 1000 !important;
        }

        /* Foami Branded Leaflet Popup */
        .foami-leaflet-popup .leaflet-popup-content-wrapper {
          background: #FFFFFF !important;
          border-radius: 16px !important;
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.22) !important;
          padding: 14px !important;
          border: 1.5px solid #E2E8F0 !important;
        }
        .foami-leaflet-popup .leaflet-popup-tip {
          background: #FFFFFF !important;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.15) !important;
        }
        .foami-leaflet-popup .leaflet-popup-content {
          margin: 0 !important;
          line-height: inherit !important;
        }
        .foami-leaflet-popup a.leaflet-popup-close-button {
          top: 8px !important;
          right: 8px !important;
          color: #94A3B8 !important;
          font-size: 16px !important;
          width: 24px !important;
          height: 24px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: rgba(255, 255, 255, 0.85) !important;
          backdrop-filter: blur(4px) !important;
          border-radius: 50% !important;
          z-index: 10 !important;
        }
        .foami-leaflet-popup a.leaflet-popup-close-button:hover {
          color: #1E293B !important;
          background: #F1F5F9 !important;
        }
      `}</style>
    </div>
  )
}
