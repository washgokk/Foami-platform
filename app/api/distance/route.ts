import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/distance
 * Server-side road distance calculation using OSRM (free, no API key)
 * Falls back to Haversine × 1.35 if OSRM is unavailable
 *
 * Body: { lat1, lng1, lat2, lng2 }
 * Response: { distance_km, duration_min, source: 'osrm' | 'haversine' }
 */

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { lat1, lng1, lat2, lng2 } = body

        if (!lat1 || !lng1 || !lat2 || !lng2) {
            return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 })
        }

        const n = (v: any) => Number(v)
        if ([lat1, lng1, lat2, lng2].some(v => isNaN(n(v)))) {
            return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
        }

        // Try OSRM (free, uses OpenStreetMap data — no API key needed)
        try {
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${n(lng1)},${n(lat1)};${n(lng2)},${n(lat2)}?overview=false&alternatives=false`

            const osrmRes = await fetch(osrmUrl, {
                signal: AbortSignal.timeout(4000),  // 4 sec timeout
                headers: { 'User-Agent': 'Foami-Platform/1.0' }
            })

            if (osrmRes.ok) {
                const data = await osrmRes.json()
                if (data.code === 'Ok' && data.routes?.[0]) {
                    const route = data.routes[0]
                    return NextResponse.json({
                        distance_km: parseFloat((route.distance / 1000).toFixed(2)),
                        duration_min: parseFloat((route.duration / 60).toFixed(1)),
                        source: 'osrm'
                    })
                }
            }
        } catch (osrmError) {
            console.warn('[Distance API] OSRM failed, using haversine fallback:', osrmError)
        }

        // Fallback: Haversine × 1.35 (road factor estimate for Thailand)
        const straightKm = haversineKm(n(lat1), n(lng1), n(lat2), n(lng2))
        const roadKm = straightKm * 1.35
        const estimatedMinutes = (roadKm / 30) * 60  // assume 30 km/h avg in city

        return NextResponse.json({
            distance_km: parseFloat(roadKm.toFixed(2)),
            duration_min: parseFloat(estimatedMinutes.toFixed(1)),
            source: 'haversine'
        })

    } catch (err: any) {
        console.error('[Distance API] Error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

// GET for quick testing: /api/distance?lat1=16.44&lng1=102.83&lat2=16.45&lng2=102.84
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const lat1 = searchParams.get('lat1')
    const lng1 = searchParams.get('lng1')
    const lat2 = searchParams.get('lat2')
    const lng2 = searchParams.get('lng2')

    if (!lat1 || !lng1 || !lat2 || !lng2) {
        return NextResponse.json({ error: 'Use ?lat1=&lng1=&lat2=&lng2=' }, { status: 400 })
    }

    const mockReq = new Request(req.url, {
        method: 'POST',
        body: JSON.stringify({ lat1, lng1, lat2, lng2 })
    })
    return POST(new NextRequest(mockReq))
}