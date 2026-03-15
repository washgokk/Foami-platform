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
        const { L, map } = mapInstanceRef.current

        const iconUrl = mode === 'pickup'
            ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png'
            : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png'

        const icon = new L.Icon({
            iconUrl,
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })

        markerRef.current.setIcon(icon)
        markerRef.current.setLatLng([lat, lng])
        // Optional: map.panTo([lat, lng]) // Maybe too jarring? Let's leave for now
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
