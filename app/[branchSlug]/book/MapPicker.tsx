'use client'
import { useEffect, useRef, useState } from 'react'
import { LocateFixed, Home, Flag } from 'lucide-react'

interface Props {
    lat: number
    lng: number
    mode: 'pickup' | 'delivery'
    onChange: (lat: number, lng: number, addr: string) => void
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=th`)
        const data = await res.json()
        return data.display_name?.split(',').slice(0, 3).join(', ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    } catch {
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    }
}

export default function MapPicker({ lat, lng, mode, onChange }: Props) {
    const mapRef = useRef<any>(null)
    const mapInstanceRef = useRef<any>(null)
    const markerRef = useRef<any>(null)
    const [locating, setLocating] = useState(false)

    useEffect(() => {
        let isMounted = true
        if (mapInstanceRef.current) return

        import('leaflet').then(L => {
            if (!isMounted || !mapRef.current) return
            if (mapRef.current._leaflet_id) return // Map already exists

            // Inject Leaflet CSS
            if (!document.querySelector('link[href*="leaflet.css"]')) {
                const link = document.createElement('link')
                link.rel = 'stylesheet'
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
                document.head.appendChild(link)
            }

            // Fix default marker icons
            delete (L.Icon.Default.prototype as any)._getIconUrl
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: '/leaflet/marker-icon-2x.png',
                iconUrl: '/leaflet/marker-icon.png',
                shadowUrl: '/leaflet/marker-shadow.png',
            })

            const map = L.map(mapRef.current, {
                center: [lat, lng],
                zoom: 15,
                zoomControl: true,
            })

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
            }).addTo(map)

            const marker = L.marker([lat, lng], { draggable: true }).addTo(map)
            markerRef.current = marker

            marker.on('dragend', async (e: any) => {
                const { lat: newLat, lng: newLng } = e.target.getLatLng()
                const addr = await reverseGeocode(newLat, newLng)
                onChange(newLat, newLng, addr)
            })

            map.on('click', async (e: any) => {
                const { lat: newLat, lng: newLng } = e.latlng
                const addr = await reverseGeocode(newLat, newLng)
                marker?.setLatLng([newLat, newLng])
                onChange(newLat, newLng, addr)
            })

            mapInstanceRef.current = { map, L }
        })

        return () => {
            isMounted = false
            // We don't necessarily remove the map on every effect run if we use []
            // But if the component is truly unmounting:
            if (!mapInstanceRef.current) return
            const { map } = mapInstanceRef.current
            map.remove()
            mapInstanceRef.current = null
        }
    }, []) // Initialize only once

    // Update marker icon and position when props change
    useEffect(() => {
        if (!mapInstanceRef.current || !markerRef.current) return
        const { L } = mapInstanceRef.current

        // Custom Branded Marker using DivIcon
        const color = mode === 'pickup' ? '#315EC3' : '#F1BFDB'
        
        const html = `
            <div style="
                width: 40px; 
                height: 48px; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));
            ">
                <div style="
                    width: 36px; 
                    height: 36px; 
                    background: ${color}; 
                    border: 3px solid white; 
                    border-radius: 50%; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center;
                    color: white;
                ">
                    ${mode === 'pickup' ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>'}
                </div>
                <div style="
                    width: 0; 
                    height: 0; 
                    border-left: 6px solid transparent; 
                    border-right: 6px solid transparent; 
                    border-top: 8px solid white; 
                    margin-top: -3px;
                "></div>
            </div>
        `

        const customIcon = L.divIcon({
            html,
            className: '',
            iconSize: [40, 48],
            iconAnchor: [20, 48],
        })

        markerRef.current.setIcon(customIcon)
        markerRef.current.setLatLng([lat, lng])
    }, [lat, lng, mode])

    const getCurrentLocation = () => {
        setLocating(true)
        navigator.geolocation.getCurrentPosition(async pos => {
            const { latitude: newLat, longitude: newLng } = pos.coords
            const addr = await reverseGeocode(newLat, newLng)
            onChange(newLat, newLng, addr)
            markerRef.current?.setLatLng([newLat, newLng])
            mapInstanceRef.current?.map.setView([newLat, newLng], 17)
            setLocating(false)
        }, () => setLocating(false), { enableHighAccuracy: true })
    }

    return (
        <div>
            <button type="button" onClick={getCurrentLocation} disabled={locating}
                className="btn btn-ghost btn-sm btn-full" style={{ marginBottom: 'var(--space-3)' }}>
                {locating ? <span className="spinner" /> : <><LocateFixed size={16} /> ใช้ตำแหน่งปัจจุบัน</>}
            </button>

            {/* Map wrapped in isolation context to prevent z-index bleed */}
            <div style={{ position: 'relative', isolation: 'isolate' }}>
                <div ref={mapRef} className="map-container liff-map-tall" style={{ height: 280, cursor: 'crosshair', borderRadius: 'var(--radius)' }} />
            </div>

            {/* Address feedback */}
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ background: mode === 'pickup' ? '#EEF1FB' : '#F0FDF4', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 700, color: mode === 'pickup' ? '#3B5FCC' : '#16A34A', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        {mode === 'pickup' ? <><Home size={14} /> พิกัดรับรถ: </> : <><Flag size={14} /> พิกัดส่งรถ: </>}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                </div>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
                กดแผนที่เพื่อตั้งตำแหน่ง หรือลากหมุดบนแผนที่ได้เลย
            </p>
        </div>
    )
}
