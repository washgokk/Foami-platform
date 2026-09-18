import { isPointInPolygon, minDistanceToPolygon } from './geo-utils'

/**
 * Result of the staff matching process
 */
export interface MatchingStaffResult {
    staff_id: string;
    base_zone_id: string;
    fee: number;
    type: 'local' | 'overflow';
}

/**
 * Core Logic Shared between Booking Page and Cron Jobs.
 * Finds all staff members who can perform a specific job at a specific time.
 * 
 * NEW FAIR-SERVICE MODEL:
 * 1. In-Zone (Free Delivery): If customer pickup & delivery are inside ANY active zone of the branch,
 *    fee is ALWAYS 0 (รับ-ส่งฟรี). Any available staff in the branch can take the job.
 * 2. Out-of-Zone: If outside active zones but within max_out_of_zone_km, calculate out-of-zone fee
 *    based on distance from nearest polygon boundary. Available staff can take the job with out-of-zone surcharge.
 */
export function findMatchingStaffForJob({
    pickupLat,
    pickupLng,
    deliveryLat,
    deliveryLng,
    showDelivery,
    zones,
    branch,
    daySchedules,
    dayBookings,
    timeSlot
}: {
    pickupLat: number;
    pickupLng: number;
    deliveryLat?: number;
    deliveryLng?: number;
    showDelivery: boolean;
    zones: any[];
    branch: any;
    daySchedules: any[];
    dayBookings: any[];
    timeSlot: string;
}) {
    const activeZones = (zones || []).filter(z => z.is_active && z.polygon_coords?.length >= 3)
    if (activeZones.length === 0) return []

    // 1. Check if pickup & delivery are inside active service zones
    const isPickupInZone = activeZones.some(z => isPointInPolygon(pickupLat, pickupLng, z.polygon_coords))
    const isDeliveryInZone = !showDelivery || activeZones.some(z => isPointInPolygon(deliveryLat || 0, deliveryLng || 0, z.polygon_coords))

    let isOutOfZone = false
    let calculatedFee = 0

    if (isPickupInZone && isDeliveryInZone) {
        // In-zone: FREE delivery! 0 fee
        calculatedFee = 0
        isOutOfZone = false
    } else {
        // Out-of-zone check: Does branch accept out-of-zone?
        const maxKm = Number(branch?.max_out_of_zone_km) || 0
        if (maxKm <= 0) {
            // Branch does not accept out-of-zone bookings
            return []
        }

        // Distance from nearest polygon edge
        let minPickupD = Infinity
        let minDeliveryD = Infinity

        activeZones.forEach(z => {
            const dP = minDistanceToPolygon(pickupLat, pickupLng, z.polygon_coords)
            if (dP < minPickupD) minPickupD = dP
            if (showDelivery) {
                const dD = minDistanceToPolygon(deliveryLat || 0, deliveryLng || 0, z.polygon_coords)
                if (dD < minDeliveryD) minDeliveryD = dD
            }
        })

        const maxD = showDelivery ? Math.max(minPickupD, minDeliveryD) : minPickupD
        if (maxD > maxKm) {
            // Exceeds max out-of-zone radius
            return []
        }

        isOutOfZone = true
        const ratePerKm = Number(branch?.delivery_rate_per_km || branch?.out_of_zone_fee) || 10
        // Standard road distance = straight line * 1.35
        const roadDistance = maxD * 1.35
        calculatedFee = Math.ceil(roadDistance * ratePerKm)
    }

    // 2. Filter schedules for this time slot
    const slotSchedules = daySchedules.filter(s => (s.time_slot === timeSlot || s.time_slot?.startsWith(timeSlot)))
    const bookedStaffIds = slotSchedules.filter(s => s.is_booked).map(s => s.staff_id)

    // Available staff on duty in this branch
    const availableSchedules = slotSchedules.filter(s => !s.is_booked && !bookedStaffIds.includes(s.staff_id))
    const uniqueStaffIds = Array.from(new Set(availableSchedules.map(s => s.staff_id)))

    const primaryZoneId = activeZones[0]?.id || ''

    const matchingStaff: MatchingStaffResult[] = uniqueStaffIds.map(sId => ({
        staff_id: sId,
        base_zone_id: primaryZoneId,
        fee: calculatedFee,
        type: isOutOfZone ? 'overflow' : 'local'
    }))

    return matchingStaff.sort((a, b) => a.fee - b.fee)
}
