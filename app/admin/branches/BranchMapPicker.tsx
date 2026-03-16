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

            // Define premium branded marker icon
            const brandColor = '#0066FF'
            const svg = `
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 38C20 38 34 26 34 16C34 8.26801 27.732 2 20 2C12.268 2 6 8.26801 6 16C6 26 20 38 20 38Z" fill="${brandColor}" stroke="white" stroke-width="2.5"/>
                    <circle cx="20" cy="16" r="6" fill="white"/>
                    <rect x="17" y="15" width="6" height="6" fill="${brandColor}" rx="1"/>
                </svg>
            `
            const brandedIcon = L.divIcon({
                html: svg,
                className: 'custom-map-marker',
                iconSize: [40, 40],
                iconAnchor: [20, 38],
            })

            const map = L.map(mapRef.current!, { center: [lat, lng], zoom: 15 })
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap', maxZoom: 19,
            }).addTo(map)

            // Use branded marker icon
            markerRef.current = L.marker([lat, lng], { icon: brandedIcon, draggable: true }).addTo(map)
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
