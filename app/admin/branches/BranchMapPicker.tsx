'use client'
import { useEffect, useRef } from 'react'

interface Props {
    lat: number
    lng: number
    onChange: (lat: number, lng: number) => void
}

export default function BranchMapPicker({ lat, lng, onChange }: Props) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const markerRef = useRef<any>(null)

    useEffect(() => {
        if (mapInstanceRef.current || !mapRef.current) return

        import('leaflet').then(L => {
            if (!document.querySelector('link[href*="leaflet.css"]')) {
                const link = document.createElement('link')
                link.rel = 'stylesheet'
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
                document.head.appendChild(link)
            }

            // Define red marker icon
            const redIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })

            const map = L.map(mapRef.current!, { center: [lat, lng], zoom: 15 })
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap', maxZoom: 19,
            }).addTo(map)

            // Use red marker icon
            markerRef.current = L.marker([lat, lng], { icon: redIcon, draggable: true }).addTo(map)
            markerRef.current.on('dragend', (e: any) => {
                const { lat: la, lng: lo } = e.target.getLatLng()
                onChange(la, lo)
            })

            map.on('click', (e: any) => {
                const { lat: la, lng: lo } = e.latlng
                markerRef.current?.setLatLng([la, lo])
                onChange(la, lo)
            })

            mapInstanceRef.current = map
        })

        return () => {
            mapInstanceRef.current?.remove()
            mapInstanceRef.current = null
        }
    }, [])

    // Update marker when props change (e.g. when edit modal opens)
    useEffect(() => {
        markerRef.current?.setLatLng([lat, lng])
        mapInstanceRef.current?.setView([lat, lng], mapInstanceRef.current.getZoom())
    }, [lat, lng])

    return (
        <div style={{ position: 'relative', isolation: 'isolate', borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div ref={mapRef} style={{ width: '100%', height: 260, cursor: 'crosshair' }} />
        </div>
    )
}
