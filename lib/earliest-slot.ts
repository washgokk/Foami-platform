import { haversine, isPointInPolygon, minDistanceToPolygon } from './geo-utils'

export interface EarliestSlotInfo {
  datetime: string        // "2026-09-11 14:00"
  date: string            // "2026-09-11"
  time: string            // "14:00"
  display_text: string    // "วันนี้ 14:00 น." or "พรุ่งนี้ 09:00 น."
  short_text: string      // "วันนี้ 14:00"
  is_today: boolean
  is_tomorrow: boolean
  is_out_of_reach: boolean
  is_in_zone: boolean
  zone_name?: string
  distance_km?: number
  travel_minutes: number
  badge_color: 'emerald' | 'blue' | 'amber' | 'slate'
  status_message?: string
}

const THAI_MONTH_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
]

/**
 * Get current Bangkok (UTC+7) Date
 */
export function getBangkokNow(): Date {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
}

export function formatDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Calculate the earliest available service time slot for a shop based on user's location
 */
export function calculateEarliestSlot({
  userLat,
  userLng,
  branch,
  zones = [],
  schedules = [],
  bookings = []
}: {
  userLat?: number
  userLng?: number
  branch: {
    id: string
    lat: number
    lng: number
    max_out_of_zone_km?: number
    [key: string]: any
  }
  zones?: any[]
  schedules?: any[]
  bookings?: any[]
}): EarliestSlotInfo {
  const bangkokNow = getBangkokNow()
  const todayStr = formatDateStr(bangkokNow)
  
  const tomorrow = new Date(bangkokNow.getTime() + 24 * 60 * 60 * 1000)
  const tomorrowStr = formatDateStr(tomorrow)

  const dayAfter = new Date(bangkokNow.getTime() + 48 * 60 * 60 * 1000)
  const dayAfterStr = formatDateStr(dayAfter)

  const currentMinutes = bangkokNow.getHours() * 60 + bangkokNow.getMinutes()

  // 1. Evaluate user location vs shop & zones
  let distanceKm: number | undefined = undefined
  let isInZone = false
  let matchedZone: any = null
  let isOutOfReach = false

  const branchZones = zones.filter(z => z.branch_id === branch.id && z.is_active !== false)

  if (userLat && userLng) {
    distanceKm = Math.round(haversine(userLat, userLng, branch.lat, branch.lng) * 10) / 10

    // Check if user is inside any zone polygon
    matchedZone = branchZones.find(z => isPointInPolygon(userLat, userLng, z.polygon_coords))
    if (matchedZone) {
      isInZone = true
    } else if (branchZones.length > 0) {
      // Calculate distance to nearest zone boundary
      const boundaryDistances = branchZones.map(z => minDistanceToPolygon(userLat, userLng, z.polygon_coords))
      const minBoundaryDist = Math.min(...boundaryDistances)
      const maxAllowed = branch.max_out_of_zone_km || 20 // Default max 20km

      if (minBoundaryDist > maxAllowed && distanceKm > maxAllowed) {
        isOutOfReach = true
      }
    } else {
      // No zones defined, fall back to distance from branch
      const maxAllowed = branch.max_out_of_zone_km || 20
      if (distanceKm > maxAllowed) {
        isOutOfReach = true
      }
    }
  }

  // Estimated travel time in minutes
  // In zone: ~15-20 mins prep & travel
  // Out of zone: 20 mins prep + ~2.5 mins per km
  const travelMinutes = isInZone
    ? 20
    : Math.max(20, Math.round(20 + (distanceKm || 5) * 2.5))

  // If customer is strictly out of reachable radius
  if (isOutOfReach) {
    return {
      datetime: `${todayStr} 00:00`,
      date: todayStr,
      time: '00:00',
      display_text: 'อยู่นอกพื้นที่บริการ',
      short_text: 'นอกพื้นที่',
      is_today: false,
      is_tomorrow: false,
      is_out_of_reach: true,
      is_in_zone: false,
      distance_km: distanceKm,
      travel_minutes: travelMinutes,
      badge_color: 'slate',
      status_message: `ระยะห่าง ${distanceKm} กม. เกินขอบเขตบริการสูงสุด`
    }
  }

  // Total lead time needed before a job can start today
  const requiredLeadMinutes = travelMinutes + 15 // Buffer for dispatch & prep

  // 2. Helper to find available slots for a given date
  const branchSchedules = schedules.filter(s => {
    // If schedule has zone_id, verify it belongs to this branch's zones
    if (s.zone_id) {
      return branchZones.some(bz => bz.id === s.zone_id)
    }
    return true
  })

  const branchBookings = bookings.filter(b => b.branch_id === branch.id && b.status !== 'cancelled')

  const findSlotForDate = (dateStr: string, minMinutesToday: number = 0): { time: string; datetime: string } | null => {
    const daySchedules = branchSchedules.filter(s => s.date === dateStr)
    const dayBookings = branchBookings.filter(b => b.scheduled_date === dateStr)

    // Standard business operating hours: 09:00 - 18:00
    const standardHours = [
      '09:00', '10:00', '11:00', '12:00', '13:00',
      '14:00', '15:00', '16:00', '17:00', '18:00'
    ]

    // If schedules exist in DB for this date
    if (daySchedules.length > 0) {
      // Group available unbooked schedules by time_slot
      const slotMap = new Map<string, any[]>()
      for (const s of daySchedules) {
        if (s.is_booked) continue
        const timeNorm = (s.time_slot || '').slice(0, 5) // "14:00:00" -> "14:00"
        if (!timeNorm) continue

        // Check if staff can serve this user
        if (isInZone && matchedZone) {
          // If in zone: in_zone matching zone, or cross_zone / out_of_zone
          if (s.zone_id === matchedZone.id || s.work_type === 'cross_zone' ) {
            if (!slotMap.has(timeNorm)) slotMap.set(timeNorm, [])
            slotMap.get(timeNorm)!.push(s)
          }
        } else {
          // Out of zone: requires out_of_zone permission or fallback to any unbooked
          if (s.work_type === 'cross_zone' || !s.work_type) {
            if (!slotMap.has(timeNorm)) slotMap.set(timeNorm, [])
            slotMap.get(timeNorm)!.push(s)
          }
        }
      }

      // If strict zone filter yielded no slots, allow cross_zone staff as fallback
      if (slotMap.size === 0) {
        for (const s of daySchedules) {
          if (s.is_booked) continue
          const timeNorm = (s.time_slot || '').slice(0, 5)
          if (!timeNorm) continue
          if (!slotMap.has(timeNorm)) slotMap.set(timeNorm, [])
          slotMap.get(timeNorm)!.push(s)
        }
      }

      const sortedSlots = Array.from(slotMap.keys()).sort()

      for (const slot of sortedSlots) {
        const [h, m] = slot.split(':').map(Number)
        const slotMinutes = h * 60 + m

        if (slotMinutes < minMinutesToday) continue

        // Compare with bookings
        const bookedCount = dayBookings.filter(b => (b.scheduled_time || '').startsWith(slot)).length
        const availableCount = (slotMap.get(slot) || []).length

        if (availableCount > bookedCount) {
          return { time: slot, datetime: `${dateStr} ${slot}` }
        }
      }
    } else {
      // Fallback: Use standard operating hours if no explicit staff schedules recorded
      for (const slot of standardHours) {
        const [h, m] = slot.split(':').map(Number)
        const slotMinutes = h * 60 + m

        if (slotMinutes < minMinutesToday) continue

        const bookedCount = dayBookings.filter(b => (b.scheduled_time || '').startsWith(slot)).length
        if (bookedCount < 2) {
          return { time: slot, datetime: `${dateStr} ${slot}` }
        }
      }
    }

    return null
  }

  // Check Today
  const minMinutesToday = currentMinutes + requiredLeadMinutes
  const todaySlot = findSlotForDate(todayStr, minMinutesToday)

  if (todaySlot) {
    return {
      datetime: todaySlot.datetime,
      date: todayStr,
      time: todaySlot.time,
      display_text: `วันนี้ ${todaySlot.time} น.`,
      short_text: `วันนี้ ${todaySlot.time}`,
      is_today: true,
      is_tomorrow: false,
      is_out_of_reach: false,
      is_in_zone: isInZone,
      zone_name: matchedZone?.name,
      distance_km: distanceKm,
      travel_minutes: travelMinutes,
      badge_color: 'emerald',
      status_message: isInZone ? `ในพื้นที่บริการ${matchedZone?.name ? ` (${matchedZone.name})` : ''}` : `นอกโซน (เดินทาง ~${travelMinutes} นาที)`
    }
  }

  // Check Tomorrow
  const tomorrowSlot = findSlotForDate(tomorrowStr, 0)
  if (tomorrowSlot) {
    return {
      datetime: tomorrowSlot.datetime,
      date: tomorrowStr,
      time: tomorrowSlot.time,
      display_text: `พรุ่งนี้ ${tomorrowSlot.time} น.`,
      short_text: `พรุ่งนี้ ${tomorrowSlot.time}`,
      is_today: false,
      is_tomorrow: true,
      is_out_of_reach: false,
      is_in_zone: isInZone,
      zone_name: matchedZone?.name,
      distance_km: distanceKm,
      travel_minutes: travelMinutes,
      badge_color: 'blue',
      status_message: 'คิววันนี้เต็มหรือเลยเวลาทำการแล้ว'
    }
  }

  // Check Day After Tomorrow
  const dayAfterSlot = findSlotForDate(dayAfterStr, 0)
  if (dayAfterSlot) {
    const dayNum = dayAfter.getDate()
    const monthStr = THAI_MONTH_SHORT[dayAfter.getMonth()]
    const label = `${dayNum} ${monthStr} ${dayAfterSlot.time} น.`

    return {
      datetime: dayAfterSlot.datetime,
      date: dayAfterStr,
      time: dayAfterSlot.time,
      display_text: label,
      short_text: `${dayNum} ${monthStr} ${dayAfterSlot.time}`,
      is_today: false,
      is_tomorrow: false,
      is_out_of_reach: false,
      is_in_zone: isInZone,
      zone_name: matchedZone?.name,
      distance_km: distanceKm,
      travel_minutes: travelMinutes,
      badge_color: 'blue',
      status_message: `เปิดรับคิววันที่ ${dayNum} ${monthStr}`
    }
  }

  // Final fallback (tomorrow morning standard)
  return {
    datetime: `${tomorrowStr} 09:00`,
    date: tomorrowStr,
    time: '09:00',
    display_text: 'พรุ่งนี้ 09:00 น.',
    short_text: 'พรุ่งนี้ 09:00',
    is_today: false,
    is_tomorrow: true,
    is_out_of_reach: false,
    is_in_zone: isInZone,
    zone_name: matchedZone?.name,
    distance_km: distanceKm,
    travel_minutes: travelMinutes,
    badge_color: 'blue',
    status_message: 'เปิดรับคิวล่วงหน้า'
  }
}
