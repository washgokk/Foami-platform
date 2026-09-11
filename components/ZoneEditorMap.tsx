'use client'
import { useEffect, useRef, useState } from 'react'

interface ZoneEditorMapProps {
    center: [number, number]
    initialCoords: [number, number][]
    color: string
    onCoordsChange: (coords: [number, number][]) => void
}

export default function ZoneEditorMap({ center, initialCoords, color, onCoordsChange }: ZoneEditorMapProps) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const [points, setPoints] = useState<[number, number][]>(initialCoords || [])
    const polylineRef = useRef<any>(null)
    const polygonRef = useRef<any>(null)
    const markersRef = useRef<any[]>([])

    useEffect(() => {
        if (!mapRef.current) return
        let map: any = null

        import('leaflet').then(L => {
            if (!mapRef.current) return

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

            map = L.map(mapRef.current!, {
                center,
                zoom: 14,
                zoomControl: true,
            })

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '? OpenStreetMap',
                maxZoom: 19,
            }).addTo(map)

            mapInstanceRef.current = map

            // Draw initial coords if any
            if (initialCoords && initialCoords.length > 0) {
                if (initialCoords.length >= 3) {
                    polygonRef.current = L.polygon(initialCoords, {
                        color,
                        fillColor: color,
                        fillOpacity: 0.25,
                        weight: 2
                    }).addTo(map)
                }
                initialCoords.forEach((p, idx) => {
                    const m = L.circleMarker(p, { radius: 6, color, fillColor: '#FFFFFF', fillOpacity: 1, weight: 2 }).addTo(map)
                    markersRef.current.push(m)
                })
            }

            // Click to add point
            map.on('click', (e: any) => {
                const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng]
                setPoints(prev => {
                    const next = [...prev, newPoint]
                    onCoordsChange(next)

                    // update marker
                    const m = L.circleMarker(newPoint, { radius: 6, color, fillColor: '#FFFFFF', fillOpacity: 1, weight: 2 }).addTo(map)
                    markersRef.current.push(m)

                    // redraw polyline/polygon
                    if (polygonRef.current) map.removeLayer(polygonRef.current)
                    if (polylineRef.current) map.removeLayer(polylineRef.current)

                    if (next.length >= 3) {
                        polygonRef.current = L.polygon(next, {
                            color,
                            fillColor: color,
                            fillOpacity: 0.25,
                            weight: 2
                        }).addTo(map)
                    } else if (next.length === 2) {
                        polylineRef.current = L.polyline(next, { color, weight: 2 }).addTo(map)
                    }

                    return next
                })
            })
        })

        return () => {
            if (map) map.remove()
            mapInstanceRef.current = null
        }
    }, [])

    const handleClear = () => {
        setPoints([])
        onCoordsChange([])
        if (mapInstanceRef.current) {
            markersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m))
            markersRef.current = []
            if (polygonRef.current) mapInstanceRef.current.removeLayer(polygonRef.current)
            if (polylineRef.current) mapInstanceRef.current.removeLayer(polylineRef.current)
        }
    }

    return (
        <div style={{ position: 'relative' }}>
            <div ref={mapRef} style={{ height: 380, width: '100%' }} />
            <div style={{
                position: 'absolute', top: 12, right: 12, zIndex: 1000,
                display: 'flex', gap: 8
            }}>
                <button
                    type="button"
                    onClick={handleClear}
                    style={{
                        background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 8,
                        padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#EF4444',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)', cursor: 'pointer'
                    }}
                >
                    ?????????? ({points.length})
                </button>
            </div>
        </div>
    )
}
