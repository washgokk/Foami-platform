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
        if (!mapRef.current) return

        // Ensure container is empty and ready
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove()
            mapInstanceRef.current = null
        }

        let map: any = null

        import('leaflet').then(L => {
            if (!mapRef.current) return

            if (!document.querySelector('link[href*="leaflet.css"]')) {
                const link = document.createElement('link')
                link.rel = 'stylesheet'
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
                document.head.appendChild(link)
            }

            map = L.map(mapRef.current!, { center: [16.4419, 102.8360], zoom: 12, zoomControl: true })
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)

            layerGroupRef.current = L.featureGroup().addTo(map)
            mapInstanceRef.current = map
            setMapReady(true)
        })
        
        return () => {
            if (map) {
                map.remove()
            }
            mapInstanceRef.current = null
            setMapReady(false)
        }
    }, [])

    // 2. Redraw branches and zones when data changes
    useEffect(() => {
        if (!mapReady || !mapInstanceRef.current || !layerGroupRef.current) return
        import('leaflet').then(L => {
            layerGroupRef.current.clearLayers()

            // Map each branch ID to a consistent color from our palette
            const branchColorMap: Record<string, string> = {}
            branches.forEach((b, idx) => {
                branchColorMap[b.id] = ZONE_COLORS[idx % ZONE_COLORS.length]
            })

            // Draw Branches
            branches.forEach(b => {
                if (b.lat && b.lng) {
                    const brandColor = branchColorMap[b.id]
                    const svg = `
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 38C20 38 34 26 34 16C34 8.26801 27.732 2 20 2C12.268 2 6 8.26801 6 16C6 26 20 38 20 38Z" fill="${brandColor}" stroke="white" stroke-width="2.5"/>
                            <circle cx="20" cy="16" r="6" fill="white"/>
                            <rect x="17" y="15" width="6" height="6" fill="${brandColor}" rx="1"/>
                        </svg>
                    `
                    const icon = L.divIcon({
                        html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;">
                                ${svg}
                                <div style="background:rgba(15,23,42,0.9);color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;margin-top:-4px;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.2);">
                                    ${b.name}
                                </div>
                               </div>`,
                        className: '',
                        iconSize: [40, 50],
                        iconAnchor: [20, 38],
                    })
                    L.marker([b.lat, b.lng], { icon }).addTo(layerGroupRef.current).bindPopup(`<strong>${b.name}</strong><br/>${b.address}`)
                }
            })

            // Draw Zones (Grouped and Unioned)
            branches.forEach(b => {
                const branchZones = zones.filter(z => z.branch_id === b.id && z.is_active && z.polygon_coords && z.polygon_coords.length >= 3)
                if (branchZones.length === 0) return

                const color = branchColorMap[b.id] || ZONE_COLORS[0]

                try {
                    // Import turf functions
                    const turf = require('@turf/turf')

                    // Convert all zones of this branch to turf polygons
                    const polygons = branchZones.map(z => {
                        // Turf expects [lng, lat] and needs to be closed (first == last)
                        const coords = z.polygon_coords.map(c => [c[1], c[0]])
                        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                            coords.push([coords[0][0], coords[0][1]])
                        }
                        return turf.polygon([coords])
                    })

                    if (polygons.length === 1) {
                        L.geoJSON(polygons[0], {
                            style: { color, fillColor: color, fillOpacity: 0.4, weight: 3 }
                        }).addTo(layerGroupRef.current)
                    } else if (polygons.length > 1) {
                        // Use featureCollection for union in newer Turf versions
                        const collection = turf.featureCollection(polygons)
                        const unioned = turf.union(collection)
                        if (unioned) {
                            L.geoJSON(unioned, {
                                style: { color, fillColor: color, fillOpacity: 0.4, weight: 3 }
                            }).addTo(layerGroupRef.current)
                        }
                    }
                } catch (e) {
                    console.error("Turf union failed, falling back to individual polygons", e)
                    // Fallback to drawing individual polygons if union fails
                    branchZones.forEach(z => {
                        L.polygon(z.polygon_coords, {
                            color, fillColor: color, fillOpacity: 0.4, weight: 3
                        }).addTo(layerGroupRef.current)
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
