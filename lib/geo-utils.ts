/**
 * Geospatial Utilities for Foami
 * Handles distance calculations and polygon boundary math.
 */

/**
 * Haversine distance (km) between two points
 */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Point-in-polygon check using ray-casting algorithm
 */
export function isPointInPolygon(lat: number, lng: number, polygon: [number, number][]) {
    if (!polygon || polygon.length < 3) return false
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1]
        const xj = polygon[j][0], yj = polygon[j][1]
        if ((yi > lng) !== (yj > lng) && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
}

/**
 * Minimum Distance to Polygon Boundary (km)
 */
export function minDistanceToPolygon(lat: number, lng: number, polygon: [number, number][]) {
    if (!polygon || polygon.length === 0) return Infinity
    let minD = Infinity
    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i]
        const p2 = polygon[(i + 1) % polygon.length]
        
        const x = lat, y = lng
        const x1 = p1[0], y1 = p1[1]
        const x2 = p2[0], y2 = p2[1]
        
        // Squared distance to segment
        const A = x - x1
        const B = y - y1
        const C = x2 - x1
        const D = y2 - y1

        const dot = A * C + B * D
        const lenSq = C * C + D * D
        let param = -1
        if (lenSq !== 0) param = dot / lenSq

        let xx, yy
        if (param < 0) {
            xx = x1; yy = y1
        } else if (param > 1) {
            xx = x2; yy = y2
        } else {
            xx = x1 + param * C
            yy = y1 + param * D
        }

        // Approx distance in km (using haversine for precision)
        const d = haversine(lat, lng, xx, yy)
        if (d < minD) minD = d
    }
    return minD
}

/**
 * Road distance using OSRM API (server-side) or Haversine fallback (client-side)
 * NOTE: This is async — use with await
 * Falls back to Haversine × 1.35 if OSRM is unavailable
 */
export async function roadDistanceKm(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
    appUrl?: string
): Promise<{ distance_km: number; duration_min: number; source: 'osrm' | 'haversine' }> {
    try {
        const base = appUrl || (typeof window !== 'undefined' ? window.location.origin : '')
        const res = await fetch(`${base}/api/distance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat1, lng1, lat2, lng2 }),
            signal: AbortSignal.timeout(5000)
        })
        if (res.ok) {
            const data = await res.json()
            if (data.distance_km) return data
        }
    } catch (e) {
        // silently fall through to haversine
    }
    // Fallback
    const km = haversine(lat1, lng1, lat2, lng2) * 1.35
    return { distance_km: km, duration_min: (km / 30) * 60, source: 'haversine' }
}

/**
 * Find closest point on polygon boundary to a given point
 */
export function closestPointOnPolygon(lat: number, lng: number, polygon: [number, number][]): { point: [number, number]; distance_km: number } {
    if (!polygon || polygon.length === 0) return { point: [lat, lng], distance_km: Infinity }
    let minD = Infinity
    let closestPoint: [number, number] = [lat, lng]
    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i]
        const p2 = polygon[(i + 1) % polygon.length]
        
        const x = lat, y = lng
        const x1 = p1[0], y1 = p1[1]
        const x2 = p2[0], y2 = p2[1]
        
        const A = x - x1
        const B = y - y1
        const C = x2 - x1
        const D = y2 - y1

        const dot = A * C + B * D
        const lenSq = C * C + D * D
        let param = -1
        if (lenSq !== 0) param = dot / lenSq

        let xx: number, yy: number
        if (param < 0) {
            xx = x1; yy = y1
        } else if (param > 1) {
            xx = x2; yy = y2
        } else {
            xx = x1 + param * C
            yy = y1 + param * D
        }

        const d = haversine(lat, lng, xx, yy)
        if (d < minD) {
            minD = d
            closestPoint = [xx, yy]
        }
    }
    return { point: closestPoint, distance_km: minD }
}

/**
 * Road distance from polygon boundary to an external point
 * Uses OSRM if available, falls back to haversine * 1.35
 */
export async function roadDistanceToPolygonKm(
    lat: number, lng: number,
    polygon: [number, number][],
    appUrl?: string
): Promise<{ distance_km: number; duration_min: number; source: 'osrm' | 'haversine' }> {
    const { point, distance_km } = closestPointOnPolygon(lat, lng, polygon)
    if (distance_km === 0 || distance_km === Infinity) {
        return { distance_km: 0, duration_min: 0, source: 'haversine' }
    }
    return await roadDistanceKm(point[0], point[1], lat, lng, appUrl)
}

/**
 * Calculates geodesic area of a polygon in square kilometers (km²)
 */
export function calculatePolygonAreaKm2(coords: [number, number][]): number {
    if (!coords || coords.length < 3) return 0
    const R = 6371 // Earth radius in km
    let total = 0
    const len = coords.length
    for (let i = 0; i < len; i++) {
        const p1 = coords[i]
        const p2 = coords[(i + 1) % len]
        const lat1 = (p1[0] * Math.PI) / 180
        const lat2 = (p2[0] * Math.PI) / 180
        const lng1 = (p1[1] * Math.PI) / 180
        const lng2 = (p2[1] * Math.PI) / 180
        total += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2))
    }
    const area = (Math.abs(total) * R * R) / 2
    return Number(area.toFixed(2))
}
