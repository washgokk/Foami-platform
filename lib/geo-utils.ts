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
