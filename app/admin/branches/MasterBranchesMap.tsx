'use client'
import { useEffect, useRef, useState } from 'react'
import { Branch, Zone } from '@/lib/types'

interface Props {
    branches: Branch[]
    zones: Zone[]
}

const ZONE_COLORS = ['#3B5FCC', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#059669']

export default function MasterBranchesMap({ branches, zones }: Props) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const layerGroupRef = useRef<any>(null)
    const [mapReady, setMapReady] = useState(false)

    // 1. Initialize Map once
    useEffect(() => {
        if (mapInstanceRef.current || !mapRef.current) return
        import('leaflet').then(L => {
            if (!document.querySelector('link[href*="leaflet.css"]')) {
                const link = document.createElement('link')
                link.rel = 'stylesheet'
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
                document.head.appendChild(link)
            }

            delete (L.Icon.Default.prototype as any)._getIconUrl
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: '/leaflet/marker-icon-2x.png',
                iconUrl: '/leaflet/marker-icon.png',
                shadowUrl: '/leaflet/marker-shadow.png',
            })

            const map = L.map(mapRef.current!, { center: [16.4419, 102.8360], zoom: 12, zoomControl: true })
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)

            layerGroupRef.current = L.featureGroup().addTo(map)
            mapInstanceRef.current = map
            setMapReady(true)
        })
        return () => {
            mapInstanceRef.current?.remove();
            mapInstanceRef.current = null;
            setMapReady(false);
        }
    }, [])

    // 2. Redraw branches and zones when data changes
    useEffect(() => {
        if (!mapReady || !mapInstanceRef.current || !layerGroupRef.current) return
        import('leaflet').then(L => {
            layerGroupRef.current.clearLayers()

            // Draw Branches
            branches.forEach(b => {
                if (b.lat && b.lng) {
                    const icon = L.divIcon({
                        html: `<div style="background:#0F172A;color:#fff;padding:6px 10px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);text-align:center;">
                                🏪 <br/>${b.name}
                               </div>`,
                        className: '',
                        iconAnchor: [30, 40],
                    })
                    L.marker([b.lat, b.lng], { icon }).addTo(layerGroupRef.current).bindPopup(`<strong>${b.name}</strong><br/>${b.address}`)
                }
            })

            // Draw Zones
            zones.forEach((z, idx) => {
                if (!z.is_active) return
                const color = (z as any).color || ZONE_COLORS[idx % ZONE_COLORS.length]
                if (z.polygon_coords && z.polygon_coords.length >= 3) {
                    const branchName = branches.find(b => b.id === z.branch_id)?.name || 'ไม่ทราบสาขา'
                    L.polygon(z.polygon_coords, {
                        color, fillColor: color, fillOpacity: 0.15, weight: 2.5,
                    }).addTo(layerGroupRef.current).bindTooltip(`<strong>${z.name}</strong><br/><span style="font-size:0.8rem;color:#666;">สาขา ${branchName}</span>`, {
                        permanent: true, direction: 'center', className: 'leaflet-zone-label',
                    })
                }
            })

            // Auto-fit bounds if we have elements
            const layers = layerGroupRef.current.getLayers()
            if (layers.length > 0) {
                mapInstanceRef.current.fitBounds(layerGroupRef.current.getBounds(), { padding: [20, 20], maxZoom: 14 })
            } else if (branches.length > 0) {
                // Fallback to center of branches if no bounds from drawn paths
                let cLat = branches.reduce((s, b) => s + (b.lat || 0), 0) / branches.length
                let cLng = branches.reduce((s, b) => s + (b.lng || 0), 0) / branches.length
                if (cLat && cLng) mapInstanceRef.current.setView([cLat, cLng], 12)
            }
        })
    }, [branches, zones, mapReady])

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', isolation: 'isolate' }}>
            <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 'inherit', zIndex: 1 }} />
            <style jsx global>{`
                .leaflet-zone-label {
                    background: rgba(255,255,255,0.9); border: 1px solid #ddd;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 6px; padding: 4px 8px; font-family: inherit;
                }
            `}</style>
        </div>
    )
}
