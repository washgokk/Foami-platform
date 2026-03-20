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
    // 1. Determine if the job itself is local to any zone
    const localPickupMatched = zones.find(z => z.is_active && isPointInPolygon(pickupLat, pickupLng, z.polygon_coords))
    const localDeliveryMatched = showDelivery ? zones.find(z => z.is_active && isPointInPolygon(deliveryLat || 0, deliveryLng || 0, z.polygon_coords)) : null

    // 2. Identify staff who are ALREADY BOOKED for this slot (any zone)
    const slotSchedules = daySchedules.filter(s => (s.time_slot === timeSlot || s.time_slot?.startsWith(timeSlot)))
    const bookedStaffIdsForSlot = slotSchedules.filter(s => s.is_booked).map(s => s.staff_id)
    
    // 3. Filter for available schedules (not booked, and staff not already busy)
    const availableSchedules = slotSchedules.filter(s => !s.is_booked && !bookedStaffIdsForSlot.includes(s.staff_id))

    const staffAssignments: Record<string, any[]> = {}
    availableSchedules.forEach(s => {
        if (!staffAssignments[s.staff_id]) staffAssignments[s.staff_id] = []
        staffAssignments[s.staff_id].push(s)
    })

    const matchingStaff: MatchingStaffResult[] = []

    Object.entries(staffAssignments).forEach(([sId, assignments]) => {
        // Find the ANCHOR assignment (in_zone) to act as the base for distances
        const anchor = assignments.find(a => !a.work_type || a.work_type === 'in_zone') || assignments[0]
        const baseZone = zones.find(zn => zn.id === anchor.zone_id)
        if (!baseZone) return

        const isO = !localPickupMatched || (showDelivery && !localDeliveryMatched)
        const isC = (localPickupMatched && localPickupMatched.id !== baseZone.id) || 
                   (showDelivery && localDeliveryMatched && localDeliveryMatched.id !== baseZone.id)

        // Check compatibility based on work_type
        let canServe = false
        if (isO) canServe = assignments.some(a => a.work_type === 'out_of_zone')
        else if (isC) canServe = assignments.some(a => a.work_type === 'cross_zone' || a.work_type === 'out_of_zone')
        else canServe = true // Local to their base zone
        
        if (canServe) {
            // Calculate distances from baseZone polygon to pickup/delivery
            const isPickupInBase = isPointInPolygon(pickupLat, pickupLng, baseZone.polygon_coords)
            const dPickup = isPickupInBase ? 0 : minDistanceToPolygon(pickupLat, pickupLng, baseZone.polygon_coords)
            
            const isDeliveryInBase = showDelivery ? isPointInPolygon(deliveryLat || 0, deliveryLng || 0, baseZone.polygon_coords) : true
            const dDelivery = (showDelivery && !isDeliveryInBase) ? minDistanceToPolygon(deliveryLat || 0, deliveryLng || 0, baseZone.polygon_coords) : 0
            
            const maxDist = Math.max(dPickup, dDelivery)

            // Check branch-level distance limit from anchor
            if (maxDist > (branch.max_out_of_zone_km || 2)) return

            // Rule: If job is Out-of-Zone AND Anchor has Rocket, fee is 0.
            const anchorHasRocket = anchor.work_type === 'out_of_zone'
            let fee = dPickup * 2 * (branch.out_of_zone_fee || 10)
            if (isO && anchorHasRocket) {
                fee = 0
            }
            
            matchingStaff.push({
                staff_id: sId,
                base_zone_id: baseZone.id,
                fee: fee,
                type: (isO || isC) ? 'overflow' : 'local'
            })
        }
    })

    // 4. Handle Capacity (Pending unassigned bookings)
    // IMPORTANT: This subtraction should be handled by the caller if they want "Availability" 
    // vs "Matching Staff". Cron Jobs usually want "All Matching Staff".
    
    return matchingStaff.sort((a, b) => a.fee - b.fee)
}
