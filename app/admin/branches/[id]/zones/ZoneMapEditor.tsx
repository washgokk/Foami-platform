'use client'
import { useEffect, useRef, useState } from 'react'
import { MousePointer2, RotateCcw, Trash2, Save, AlertTriangle } from 'lucide-react'
import { calculatePolygonAreaKm2 } from '@/lib/geo-utils'

interface Props {
    zones: any[]
    mode: 'view' | 'draw'
    editingZone?: any
    center: [number, number]
    onSave: (coords: [number, number][]) => void
    onCancel: () => void
}

export default function ZoneMapEditor({ zones, mode, editingZone, center, onSave, onCancel }: Props) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const [points, setPoints] = useState<[number, number][]>(
        mode === 'draw' && editingZone?.polygon_coords?.length >= 3
            ? editingZone.polygon_coords
            : []
    )
    const polylineRef = useRef<any>(null)
    const markersRef = useRef<any[]>([])
    const areaKm2 = calculatePolygonAreaKm2(points)
    const isAreaOverLimit = areaKm2 > 100

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

            const map = L.map(mapRef.current!, {
                center,
                zoom: 15,
                zoomControl: true,
            })

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19,
            }).addTo(map)

            // Draw existing zones
            zones.forEach(z => {
                if (!z.polygon_coords?.length || z.id === editingZone?.id) return
                const poly = L.polygon(z.polygon_coords, {
                    color: '#3B5FCC',
                    fillColor: '#3B5FCC',
                    fillOpacity: 0.12,
                    weight: 2,
                }).addTo(map)
                poly.bindTooltip(z.name, { permanent: true, direction: 'center', className: 'zone-tooltip' })
            })

            // In draw mode: show existing points and allow adding new
            if (mode === 'draw') {
                const existingCoords = editingZone?.polygon_coords || []

                // Draw existing polygon outline for editing zone
                if (existingCoords.length >= 3) {
                    L.polygon(existingCoords, {
                        color: '#F59E0B',
                        fillColor: '#F59E0B',
                        fillOpacity: 0.15,
                        weight: 2,
                        dashArray: '6,4',
                    }).addTo(map)
                }

                // Click to add point
                map.on('click', (e: any) => {
                    const coord: [number, number] = [e.latlng.lat, e.latlng.lng]
                    setPoints(prev => {
                        const next = [...prev, coord]
                        polylineRef.current?.remove()
                        if (next.length > 1) {
                            polylineRef.current = L.polygon(next, {
                                color: '#3B5FCC',
                                fillColor: '#3B5FCC',
                                fillOpacity: 0.2,
                                weight: 2.5,
                            }).addTo(map)
                        }
                        const marker = L.circleMarker(coord, {
                            radius: 6, fillColor: '#3B5FCC', color: '#fff', weight: 2, fillOpacity: 1,
                        }).addTo(map)
                        markersRef.current.push(marker)
                        return next
                    })
                })

                map.on('contextmenu', (e: any) => {
                    e.originalEvent.preventDefault()
                    setPoints(prev => {
                        const next = prev.slice(0, -1)
                        markersRef.current.pop()?.remove()
                        polylineRef.current?.remove()
                        if (next.length > 1) {
                            polylineRef.current = L.polygon(next, {
                                color: '#3B5FCC', fillColor: '#3B5FCC', fillOpacity: 0.2, weight: 2.5,
                            }).addTo(map)
                        }
                        return next
                    })
                })
            }

            mapInstanceRef.current = { map, L }
        })

        return () => {
            mapInstanceRef.current?.map.remove()
            mapInstanceRef.current = null
        }
    }, [])

    const clearAll = () => {
        markersRef.current.forEach(m => m.remove())
        markersRef.current = []
        polylineRef.current?.remove()
        polylineRef.current = null
        setPoints([])
    }

    if (mode === 'view') {
        return (
            <div style={{ position: 'relative', isolation: 'isolate' }}>
                <div ref={mapRef} style={{ width: '100%', height: 340 }} />
            </div>
        )
    }

    // Draw mode controls (NO EMOJIS, clean Lucide icons)
    return (
        <div>
            <div style={{
                padding: 'var(--space-3) var(--space-4)',
                background: '#FFFBEB',
                borderBottom: '1px solid var(--border)',
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)',
                fontSize: '0.82rem', color: 'var(--text-secondary)',
            }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <MousePointer2 size={14} color="#3B5FCC" />
                    <strong>คลิกซ้าย</strong> = เพิ่มจุดขอบเขต
                </span>
                <span>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <RotateCcw size={14} color="#D97706" />
                    <strong>คลิกขวา</strong> = ยกเลิกจุดล่าสุด
                </span>
                <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-ghost)', padding: '2px 12px', borderRadius: 'var(--radius-full)' }}>
                    {points.length} จุด
                </span>
            </div>
            <div style={{ position: 'relative', isolation: 'isolate' }}>
                <div ref={mapRef} style={{ width: '100%', height: 420, cursor: 'crosshair' }} />
            </div>
            <div style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={clearAll}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                    <Trash2 size={14} /> ล้างทั้งหมด
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
                    ยกเลิก
                </button>
                <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={points.length < 3 || isAreaOverLimit}
                    onClick={() => onSave(points)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                    <Save size={14} /> บันทึกกรอบ ({points.length} จุด)
                </button>
            </div>
        </div>
    )
}
