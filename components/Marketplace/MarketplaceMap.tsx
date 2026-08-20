'use client'
import { useEffect, useRef } from 'react'

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

      // Load Leaflet CSS
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

      // Light, clean map tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map)

      markersGroupRef.current = L.featureGroup().addTo(map)
      mapInstanceRef.current = map

      // Render markers
      renderMarkers(L, map)
    })

    return () => {
      if (map) {
        map.remove()
      }
      mapInstanceRef.current = null
    }
  }, [])

  // 2. Re-render markers when shops or selectedShop changes
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
            width: 20px;
            height: 20px;
            background: #22C55E;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 0 16px rgba(34, 197, 94, 0.8), 0 2px 6px rgba(0,0,0,0.3);
            animation: pulse-gps 2s infinite;
          "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })

      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 })
        .addTo(markersGroupRef.current)
        .bindTooltip('ตำแหน่งของคุณ', { permanent: false, direction: 'top' })
    }

    const bounds = L.latLngBounds([])

    shops.forEach(shop => {
      if (!shop.lat || !shop.lng) return

      const isSelected = selectedShop?.id === shop.id
      const priceText = shop.price_from > 0 ? `฿${shop.price_from}` : 'ดูร้าน'

      // Agoda / Airbnb Style Price Pin Icon
      const pricePinIcon = L.divIcon({
        className: 'agoda-price-marker',
        html: `
          <div style="
            background: ${isSelected ? '#315EC3' : '#FFFFFF'};
            color: ${isSelected ? '#FFFFFF' : '#1A2340'};
            border: 2px solid ${isSelected ? '#214192' : '#DDE3F5'};
            border-radius: 999px;
            padding: 5px 12px;
            font-size: 13px;
            font-weight: 800;
            font-family: 'Kanit', sans-serif;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            box-shadow: ${isSelected ? '0 8px 24px rgba(49, 94, 195, 0.4)' : '0 4px 14px rgba(0, 0, 0, 0.12)'};
            transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            white-space: nowrap;
            cursor: pointer;
          ">
            <span>${priceText}</span>
            ${shop.avg_rating > 0 ? `<span style="font-size: 10.5px; opacity: 0.9; color: ${isSelected ? '#FDE68A' : '#D97706'};">★${shop.avg_rating.toFixed(1)}</span>` : ''}
          </div>
        `,
        iconSize: [80, 32],
        iconAnchor: [40, 16]
      })

      const marker = L.marker([shop.lat, shop.lng], { icon: pricePinIcon })
        .addTo(markersGroupRef.current)
        .on('click', () => {
          onSelectShop(shop)
        })

      bounds.extend([shop.lat, shop.lng])
    })

    if (userLocation) {
      bounds.extend([userLocation.lat, userLocation.lng])
    }

    if (bounds.isValid() && shops.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 'inherit' }} />

      <style jsx global>{`
        @keyframes pulse-gps {
          0% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          }
          70% {
            box-shadow: 0 0 0 14px rgba(34, 197, 94, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
          }
        }
      `}</style>
    </div>
  )
}
