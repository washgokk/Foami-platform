'use client'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { generateScalableId } from '@/lib/id-utils'
import {
    FOAMI_PACKAGES, ADDON_LABELS, OIL_CHANGE_OPTIONS, GEAR_OIL_OPTIONS, BRAKE_FLUID_PRICE,
    OUT_OF_ZONE_RATE, OVERFLOW_FEE, TIME_SLOTS, type FoamiPackage, VEHICLE_SIZE_LABEL,
    type CCPriceGroup
} from '@/lib/types'
import { format, addDays } from 'date-fns'
import { th } from 'date-fns/locale'
import { haversine, isPointInPolygon, minDistanceToPolygon } from '@/lib/geo-utils'
import { findMatchingStaffForJob } from '@/lib/staff-matching'
import {
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Sparkles,
    Wrench,
    Droplets,
    CheckCircle,
    CheckCircle2,
    XCircle,
    Star,
    Home,
    MapPin,
    Bike,
    Camera,
    AlertTriangle,
    Clock,
    Coins,
    CreditCard,
    Smartphone,
    Info,
    Calendar,
    Wallet,
    Gift,
    Tag,
    X,
    Check,
    FileText
} from 'lucide-react'
import styles from './book.module.css'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import CheckoutForm from '@/components/Stripe/CheckoutForm'
import Logo from '@/components/Branding/Logo'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

import type MapPickerType from './MapPicker'
const MapPicker = dynamic<React.ComponentProps<typeof MapPickerType>>(
    () => import('./MapPicker'),
    { ssr: false }
)
//owner edit
// ─── Step names ──────────────────────────────────────────────
const STEPS = [
    { name: 'แพ็กเกจ', icon: ClipboardList },
    { name: 'ตำแหน่ง', icon: MapPin },
    { name: 'เวลา', icon: Clock },
    { name: 'สรุป', icon: FileText },
    { name: 'ชำระ', icon: CreditCard },
]

// ─── Get Zone Center ──────────────────────────────────────────
function getZoneCenter(zone: any): [number, number] {
    if (!zone?.polygon_coords?.length) return [0, 0]
    const sum = zone.polygon_coords.reduce((acc: [number, number], p: [number, number]) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
    return [sum[0] / zone.polygon_coords.length, sum[1] / zone.polygon_coords.length]
}

export default function BookPage() {
    const { branchSlug } = useParams<{ branchSlug: string }>()
    const router = useRouter()
    const [step, setStep] = useState(0)
    const [customer, setCustomer] = useState<any>(null)

    // Step 1 — Package
    const [dbPackages, setDbPackages] = useState<any[]>([])
    const [dbAddons, setDbAddons] = useState<any[]>([])
    const [selectedPkg, setSelectedPkg] = useState<any>(null)

    // Global schedules for chaining check
    const [allSchedulesData, setAllSchedulesData] = useState<any[]>([])
    const [addons, setAddons] = useState<Record<string, boolean>>({})
    const [addonSelectedPrices, setAddonSelectedPrices] = useState<Record<string, number>>({})
    const [addonVariableStates, setAddonVariableStates] = useState<Record<string, { mode: 'full_tank' | 'custom', customAmount: string, note?: string }>>({})

    // Step 2 — Vehicle & Location
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null)
    const [pickupLat, setPickupLat] = useState(16.4419)
    const [pickupLng, setPickupLng] = useState(102.8360)
    const [pickupAddress, setPickupAddress] = useState('')
    const [pickupAddressDetail, setPickupAddressDetail] = useState('')
    const [pickupNote, setPickupNote] = useState('')
    const [customerNote, setCustomerNote] = useState('')

    const [showDelivery, setShowDelivery] = useState(false)
    const [deliveryLat, setDeliveryLat] = useState(16.4419)
    const [deliveryLng, setDeliveryLng] = useState(102.8360)
    const [deliveryAddress, setDeliveryAddress] = useState('')
    const [deliveryAddressDetail, setDeliveryAddressDetail] = useState('')
    const [deliveryNote, setDeliveryNote] = useState('')

    const [zones, setZones] = useState<any[]>([])
    const [branches, setBranches] = useState<any[]>([])
    const [zoneId, setZoneId] = useState('')
    const [extraFee, setExtraFee] = useState(0)

    // Step 3 — Time
    const [slots, setSlots] = useState<any>({})
    const [selectedDate, setSelectedDate] = useState('')
    const [selectedSlot, setSelectedSlot] = useState('')
    const [dateRange, setDateRange] = useState<Date[]>([])
    const [isTooFar, setIsTooFar] = useState(false)
    const [differentSpotFee, setDifferentSpotFee] = useState(0)
    const [travelSurchargeState, setTravelSurchargeState] = useState(0)
    const [baseZoneExtraFee, setBaseZoneExtraFee] = useState(0)

    // Step 4 — Summary
    const [discountCode, setDiscountCode] = useState('')
    const [discountAmount, setDiscountAmount] = useState(0)
    const [discountLoading, setDiscountLoading] = useState(false)
    const [discountMsg, setDiscountMsg] = useState('')

    // Step 5 — Payment
    const [payMethod, setPayMethod] = useState<'transfer' | 'stripe'>('stripe')
    const [slip, setSlip] = useState<File | null>(null)
    const [vehicleFiles, setVehicleFiles] = useState<File[]>([])
    const [ccPriceGroups, setCcPriceGroups] = useState<CCPriceGroup[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [clientSecret, setClientSecret] = useState('')
    const [paymentError, setPaymentError] = useState<string | null>(null)
    const [pendingBookingId, setPendingBookingId] = useState<string | null>(null)
    const [paymentSuccessful, setPaymentSuccessful] = useState(false)
    const [previewImg, setPreviewImg] = useState<string | null>(null)

    const [pickupMatched, setPickupMatched] = useState<any>(null)
    const [deliveryMatched, setDeliveryMatched] = useState<any>(null)

    useEffect(() => {
        if (!zones.length) { setPickupMatched(null); return }
        const found = zones.find(z => z.is_active && z.polygon_coords?.length >= 3 && isPointInPolygon(pickupLat, pickupLng, z.polygon_coords))
        setPickupMatched(found || null)
    }, [zones, pickupLat, pickupLng])

    useEffect(() => {
        if (!showDelivery || !zones.length) { setDeliveryMatched(null); return }
        const found = zones.find(z => z.is_active && z.polygon_coords?.length >= 3 && isPointInPolygon(deliveryLat, deliveryLng, z.polygon_coords))
        setDeliveryMatched(found || null)
    }, [showDelivery, zones, deliveryLat, deliveryLng])

    // ─── Init ───────────────────────────────────────────────────
    useEffect(() => {
        const c = localStorage.getItem('liff_customer')
        if (!c) { router.replace(`/${branchSlug}`); return }
        const parsedCustomer = JSON.parse(c)
        setCustomer(parsedCustomer)

        // Fetch fresh customer data to ensure latest saved_locations
        supabase.from('customers').select('*').eq('id', parsedCustomer.id).single()
            .then(({ data }) => {
                if (data) {
                    setCustomer(data)
                    localStorage.setItem('liff_customer', JSON.stringify(data))

                    // Set default vehicle
                    if (data.saved_vehicles && data.saved_vehicles.length > 0) {
                        setSelectedVehicle(data.saved_vehicles[0])
                    } else {
                        // Fallback to legacy profile info
                        setSelectedVehicle({
                            vehicle_brand: data.vehicle_brand,
                            vehicle_model: data.vehicle_model,
                            vehicle_color: data.vehicle_color,
                            license_plate: data.license_plate,
                            vehicle_size: data.vehicle_size,
                        })
                    }
                }
            })

        // Load Services, Addons, and Zones from Supabase
        Promise.all([
            supabase.from('services').select('*').eq('is_active', true).order('price_s'),
            supabase.from('service_addons').select('*').eq('is_active', true),
            supabase.from('branches').select('*').eq('slug', branchSlug).maybeSingle()
        ]).then(([{ data: svcs }, { data: ads }, { data: branch }]) => {
            if (svcs && branch) {
                const filteredSvcs = svcs.filter(s => {
                    const settings = s.branch_settings?.[branch.id]
                    return settings ? settings.is_active : true
                })

                const parsed = filteredSvcs.map(s => {
                    const settings = s.branch_settings?.[branch.id]
                    const markup = Number(settings?.price_markup || 0)

                    const parts = s.description.split('\n[Addons: ')
                    const desc = parts[0]
                    const addonsStr = parts.length > 1 ? parts[1].replace(']', '') : ''

                    return {
                        id: s.id,
                        name: s.name,
                        description: desc,
                        price_s: Number(s.price_s) + markup,
                        price_m: Number(s.price_m) + markup,
                        price_l: Number(s.price_l) + markup,
                        original_price_s: Number(s.price_s),
                        original_price_m: Number(s.price_m) || 0,
                        original_price_l: Number(s.price_l) || 0,
                        icon: s.name.includes('เคลือบ') ? 'sparkles' : s.name.includes('บำรุง') ? 'wrench' : 'droplets',
                        color: s.name.includes('เคลือบ') ? 'var(--brand-accent)' : s.name.includes('บำรุง') ? 'var(--brand-subordinate)' : 'var(--brand-dominant)',
                        image_url: s.image_url,
                        availableAddons: addonsStr ? addonsStr.split(',') : [],
                        is_addon_required: s.is_addon_required,
                        branch_markup: markup
                    }
                })
                setDbPackages(parsed)
            }
            if (ads && branch) {
                const filteredAds = ads.filter(a => {
                    const settings = a.branch_settings?.[branch.id]
                    return settings ? settings.is_active : true
                }).map(a => {
                    const settings = a.branch_settings?.[branch.id]
                    const markup = Number(settings?.price_markup || 0)
                    return {
                        ...a,
                        price: Number(a.price) + markup,
                        branch_markup: markup
                    }
                })
                setDbAddons(filteredAds)
            }

            if (branch) {
                setBranches([branch])
                supabase.from('zones').select('*').eq('branch_id', branch.id).eq('is_active', true)
                    .then(({ data: zns }) => { if (zns) setZones(zns) })

                // Fetch all active CC price groups and filter by branch_id in JS to be safe
                supabase.from('cc_price_groups').select('*')
                    .eq('is_active', true)
                    .then(({ data: groups, error }) => {
                        if (error) {
                            console.error('[CC Pricing] Fetch error:', error)
                        } else if (groups) {
                            const branchGroups = (groups || []).filter(g => (g.branch_ids || []).includes(branch.id))
                            console.log(`[CC Pricing] Total entries: ${groups.length}, Matches current branch: ${branchGroups.length}`)
                            setCcPriceGroups(branchGroups as CCPriceGroup[])
                        }
                    })
            }
        })

        // Date range: today + 6 days
        const range = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i))
        setDateRange(range)
        setSelectedDate(format(range[0], 'yyyy-MM-dd'))
    }, [router, branchSlug])

    // ─── Load time slots ─────────────────────────────────────────
    useEffect(() => {
        if (!selectedDate) return
        const from = format(dateRange[0], 'yyyy-MM-dd')
        const to = format(dateRange[dateRange.length - 1], 'yyyy-MM-dd')

        const loadAvailability = async () => {
            if (!zones.length) return
            const zoneIds = zones.map(z => z.id)

            // 1. Fetch Staff Schedules only for THIS branch's zones
            const { data: allSchedules } = await supabase
                .from('staff_schedules')
                .select('date, time_slot, zone_id, is_booked, staff_id, work_type')
                .gte('date', from)
                .lte('date', to)
                .in('zone_id', zoneIds)

            // 2. Fetch Existing Bookings for the entire branch to ensure capacity is tracked correctly
            const { data: allBookings } = await supabase
                .from('bookings')
                .select('scheduled_date, scheduled_time, zone_id, staff_id, branch_id')
                .gte('scheduled_date', from)
                .lte('scheduled_date', to)
                .eq('branch_id', branches[0].id)
                .not('status', 'eq', 'cancelled')

            setAllSchedulesData(allSchedules || [])
            const now = new Date()
            const thTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
            const todayStr = thTime.getFullYear() + '-' + String(thTime.getMonth() + 1).padStart(2, '0') + '-' + String(thTime.getDate()).padStart(2, '0')
            const nowMinutes = thTime.getHours() * 60 + thTime.getMinutes()

            const availabilityMap: Record<string, any[]> = {}

            dateRange.forEach(d => {
                const dateKey = format(d, 'yyyy-MM-dd')
                const daySchedules = (allSchedules || []).filter(s => s.date === dateKey)
                const dayBookings = (allBookings || []).filter(b => b.scheduled_date === dateKey)

                // Calculate pickup/delivery status directly from coordinates to avoid stale state
                const localPickupMatched = zones.find(z => z.is_active && isPointInPolygon(pickupLat, pickupLng, z.polygon_coords))
                const localDeliveryMatched = zones.find(z => z.is_active && isPointInPolygon(deliveryLat, deliveryLng, z.polygon_coords))

                const slotsForDay = TIME_SLOTS.map(slot => {
                const dateKey = format(d, 'yyyy-MM-dd')

                // 1. ดึงข้อมูลพนักงานออกมาก่อน
                const matchingStaff = findMatchingStaffForJob({
                    pickupLat, pickupLng, deliveryLat, deliveryLng, showDelivery,
                    zones, branch: branches[0],
                    daySchedules, dayBookings, timeSlot: slot
                })
                const hasAnyStaff = daySchedules.some(s => (s.time_slot === slot || s.time_slot?.startsWith(slot)))

                // 2. ถ้าไม่มีพนักงานคนไหนลงเวลานี้ไว้เลย ให้ซ่อนคิวนี้ไปเลย (ไม่ให้มันดันทุรังไปโชว์ว่า "หมดเวลา")
                if (!hasAnyStaff && matchingStaff.length === 0) return null

                // 3. ค่อยมาเช็คเรื่องเวลาหมด (Timed out) สำหรับคิวที่มีพนักงานลงไว้
                if (dateKey === todayStr) {
                    const [sh, sm] = slot.split(':').map(Number)
                    const slotMinutes = sh * 60 + sm
                    const nowMinutes = thTime.getHours() * 60 + thTime.getMinutes()

                    if (slotMinutes <= nowMinutes) return null
                    if (slotMinutes < nowMinutes + 20) return { time_slot: slot, type: 'timed_out' }
                }

                // 4. คำนวณความจุ (Capacity)
                const allPendingInBranch = dayBookings.filter(b => (b.scheduled_time === slot || b.scheduled_time?.startsWith(slot)) && !b.staff_id)
                const availableCount = matchingStaff.length - allPendingInBranch.length

                if (availableCount > 0) {
                    const topStaff = matchingStaff[0]
                    return {
                        time_slot: slot,
                        type: topStaff.type,
                        serving_zone_id: topStaff.base_zone_id,
                        available_staff_ids: matchingStaff.slice(0, availableCount).map(ms => ms.staff_id),
                        calculated_fee: topStaff.fee
                    }
                } else {
                    return { time_slot: slot, type: 'full' }
                }
            }).filter(Boolean) as any[]

                if (slotsForDay.length > 0) availabilityMap[dateKey] = slotsForDay
            })

            setSlots(availabilityMap)
        }

        loadAvailability()
    }, [zoneId, selectedDate, dateRange, pickupLat, pickupLng, deliveryLat, deliveryLng, showDelivery, branches, zones])

    // ─── Recently Used Locations (from History) ────────────────
    const [recentLocations, setRecentLocations] = useState<any[]>([])

    useEffect(() => {
        if (!customer?.id) return
        const loadHistory = async () => {
            const { data } = await supabase
                .from('bookings')
                .select('pickup_address, pickup_lat, pickup_lng, delivery_address, delivery_lat, delivery_lng')
                .eq('customer_id', customer.id)
                .order('created_at', { ascending: false })
                .limit(20)

            const unique: Record<string, any> = {}
            for (const b of data || []) {
                // Pickup
                if (b.pickup_address) {
                    const full = b.pickup_address
                    const detail = full.split(' (')[0]
                    const note = full.includes('(') ? full.split('(')[1].split(')')[0] : ''
                    const raw = full.includes(') ') ? full.split(') ').slice(1).join(') ') : (detail ? full.replace(detail, '').trim() : full)

                    const nameKey = detail || full
                    if (!unique[nameKey]) {
                        let name = detail || 'สถานที่เดิม'
                        if (name.length > 25) name = name.slice(0, 22) + '...'
                        unique[nameKey] = {
                            name: name,
                            lat: b.pickup_lat, lng: b.pickup_lng,
                            address: raw,
                            detail: detail,
                            note: note
                        }
                    }
                }
                // Delivery
                if (b.delivery_address) {
                    const full = b.delivery_address
                    const detail = full.split(' (')[0]
                    const note = full.includes('(') ? full.split('(')[1].split(')')[0] : ''
                    const raw = full.includes(') ') ? full.split(') ').slice(1).join(') ') : (detail ? full.replace(detail, '').trim() : full)

                    const nameKey = detail || full
                    if (!unique[nameKey]) {
                        let name = detail || 'สถานที่เดิม'
                        if (name.length > 25) name = name.slice(0, 22) + '...'
                        unique[nameKey] = {
                            name: name,
                            lat: b.delivery_lat, lng: b.delivery_lng,
                            address: raw,
                            detail: detail,
                            note: note
                        }
                    }
                }
            }
            setRecentLocations(Object.values(unique).slice(0, 5))
        }
        loadHistory()
    }, [customer?.id])

    // ─── Zone detection & Extra Fee ──────────────────────────────
    useEffect(() => {
        if (!zones.length || !branches.length) return

        let baseZoneFee = 0
        if (pickupMatched) {
            setZoneId(pickupMatched.id)
            baseZoneFee = Number(pickupMatched.extra_fee || 0)
        } else {
            setZoneId('')
        }

        if (showDelivery && deliveryMatched) {
            baseZoneFee += Number(deliveryMatched.extra_fee || 0)
        }

        const maxKm = branches[0]?.max_out_of_zone_km || 2
        let tooFar = false
        let diffFee = 0
        let travelSurcharge = 0

        // 1. Distance check for the pickup point (Too far from any zone)
        let minD = Infinity
        zones.forEach(z => {
            if (z.is_active && z.polygon_coords?.length >= 3) {
                const d = minDistanceToPolygon(pickupLat, pickupLng, z.polygon_coords)
                if (d < minD) minD = d
            }
        })
        if (minD > maxKm && minD !== Infinity) tooFar = true

        // 2. Different spot fee (Pickup -> Delivery)
        if (showDelivery && (pickupLat !== deliveryLat || pickupLng !== deliveryLng)) {
            const distBetween = haversine(pickupLat, pickupLng, deliveryLat, deliveryLng)
            const rate = branches[0]?.out_of_zone_fee || 10
            // 2x Multiplier for Round-trip (Pickup -> Delivery -> Pickup)
            diffFee = Math.round(distBetween * 2) * Number(rate)
        }

        // 3. Travel surcharge (Base -> Pickup) from pre-calculated slot data
        if (selectedDate && selectedSlot && slots[selectedDate]) {
            const daySlots = slots[selectedDate] || []
            const currentSlotData = daySlots.find((s: any) => s.time_slot === selectedSlot)
            if (currentSlotData?.calculated_fee) {
                travelSurcharge = currentSlotData.calculated_fee
            }
        }

        console.log(`[Summary Calc] Slot: ${selectedSlot}, baseZoneFee: ${baseZoneFee}, travelSurcharge: ${travelSurcharge}, diffFee: ${diffFee}`);
        setIsTooFar(tooFar)
        setDifferentSpotFee(Math.round(diffFee))
        setTravelSurchargeState(Math.round(travelSurcharge))
        setBaseZoneExtraFee(Math.round(baseZoneFee))
        setExtraFee(Math.round(baseZoneFee + travelSurcharge + diffFee))

    }, [pickupLat, pickupLng, deliveryLat, deliveryLng, showDelivery, zones, branches, selectedDate, selectedSlot, slots])

    // ─── Pricing ─────────────────────────────────────────────────
    const addonTotal = () => {
        let t = 0
        for (const addonName of Object.keys(addons)) {
            if (!addons[addonName]) continue

            const dbA = dbAddons.find(a => a.name === addonName)
            if (!dbA) continue

            const pricingType = dbA.pricing_type || (dbA.description.includes('[Pricing: Free]') ? 'free' : dbA.description.includes('[Pricing: Variable]') ? 'notify_later' : 'fixed')

            if (pricingType === 'free') {
                t += 0
            } else if (pricingType === 'notify_later') {
                const vState = addonVariableStates[addonName]
                if (vState && vState.mode === 'custom') {
                    // Include markup for custom fuel amount
                    t += (Number(vState.customAmount) || 0) + (dbA.branch_markup || 0)
                }
            } else {
                // Fixed or has sub_options
                if (addonSelectedPrices[addonName] !== undefined) {
                    t += addonSelectedPrices[addonName] + (dbA.branch_markup || 0)
                } else {
                    t += (dbA.price || 0) + (dbA.branch_markup || 0)
                }
            }
        }
        return t
    }

    // New: Calculate only what needs to be paid NOW (Free = 0, others = 0 because they are Pay Later)
    const addonPaymentTotal = () => {
        return 0 // All non-free addons are now Pay Later
    }

    const isAddonComplete = (addonName: string) => {
        if (!addons[addonName]) return true
        const dbA = dbAddons.find(a => a.name === addonName)
        if (!dbA) return true

        const pricingType = dbA.pricing_type || (dbA.description.includes('[Pricing: Variable]') ? 'notify_later' : 'fixed')

        if (pricingType === 'notify_later') {
            const vState = addonVariableStates[addonName]
            if (!vState) return false
            if (addonName.includes('น้ำมัน') && !vState.note?.trim()) return false
            if (vState.mode === 'full_tank') return true
            if (vState.mode === 'custom' && (Number(vState.customAmount) || 0) > 0) return true
            return false
        }

        const hasSubOptions = dbA.sub_options && dbA.sub_options.length > 0
        if (hasSubOptions || dbA.description.includes('[Prices:')) {
            return addonSelectedPrices[addonName] !== undefined
        }
        return true
    }

    // Calculate Package Price based on CC Price Group
    const getPkgPrice = (pkg: any) => {
        if (!pkg) return { price: 0, basePrice: 0, adjustment: 0, isCc: false, matchedGroupName: null }
        const size = (selectedVehicle?.vehicle_size || 'S').toUpperCase() as keyof CCPriceGroup['prices']

        // Base Price is ALWAYS the starting price (Size S)
        const basePrice = pkg.price_s || pkg.price || 0

        // Standard S/M/L Price (for fallback and comparison)
        const standardPriceForSize = (size === 'S' ? pkg.price_s : size === 'M' ? pkg.price_m : pkg.price_l) || pkg.price || 0

        // Find price group matching this service
        const matchingGroup = ccPriceGroups.find(g => {
            const ids = Array.isArray(g.service_ids) ? g.service_ids : []
            return ids.includes(pkg.id)
        })

        if (matchingGroup && matchingGroup.prices) {
            const ccValue = matchingGroup.prices[size] || matchingGroup.prices[size.toLowerCase()]
            if (ccValue !== undefined) {
                const adjustment = Number(ccValue)
                // Treat CC value as the adjustment itself (additive to base)
                return {
                    price: basePrice + adjustment,
                    basePrice,
                    adjustment,
                    isCc: true,
                    matchedGroupName: matchingGroup.name
                }
            }
        }

        // Fallback to standard absolute prices
        return {
            price: standardPriceForSize,
            basePrice,
            adjustment: standardPriceForSize - basePrice,
            isCc: false,
            matchedGroupName: null
        }
    }

    const { price: pkgPrice, basePrice: pkgBasePrice, adjustment: pkgAdjustment, isCc: isCcPrice, matchedGroupName } = getPkgPrice(selectedPkg)
    const currentAddonDisplayTotal = addonTotal()
    const currentAddonPaymentTotal = addonPaymentTotal()
    const extraFeeValue = Math.round(extraFee)
    const total = Math.round(pkgPrice + currentAddonPaymentTotal + extraFeeValue - discountAmount)
    const displayTotal = Math.round(pkgPrice + currentAddonDisplayTotal + extraFeeValue - discountAmount)
    const basePrice = pkgPrice
    const travelSurcharge = travelSurchargeState
    const diffFee = differentSpotFee

    // ─── Discount ────────────────────────────────────────────────
    const applyDiscount = async () => {
        if (!discountCode) return
        setDiscountLoading(true)

        try {
            const { data: discount, error } = await supabase
                .from('discount_codes')
                .select('*')
                .eq('code', discountCode.toUpperCase())
                .eq('is_active', true)
                .single()

            if (error || !discount) throw new Error('โค้ดไม่ถูกต้อง')
            if (discount.expires_at && new Date(discount.expires_at) < new Date()) throw new Error('หมดอายุ')
            if (discount.max_uses && (discount.used_count || 0) >= discount.max_uses) throw new Error('สิทหมดแล้ว')

            // CRM Segment Checking (simplified for Client DB)
            if (discount.target_segment && discount.target_segment !== 'all' && discount.target_segment !== '"all"') {
                try {
                    const segmentRule = JSON.parse(discount.target_segment)
                    const { data: bookings } = await supabase.from('bookings').select('total_price, status').eq('customer_id', customer.id)
                    const validBookings = (bookings || []).filter(b => b.status === 'completed' || b.status === 'paid' || b.status === 'confirmed')

                    const totalVisits = validBookings.length
                    const totalSpent = validBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0)

                    let isMatch = false
                    const metricVal = segmentRule.metric === 'totalVisits' ? totalVisits : totalSpent
                    if (segmentRule.operator === '>=') isMatch = metricVal >= segmentRule.value
                    if (segmentRule.operator === '<=') isMatch = metricVal <= segmentRule.value
                    if (segmentRule.operator === '===') isMatch = metricVal === segmentRule.value

                    if (!isMatch) throw new Error('ไม่พร้อมใช้งาน')
                } catch (e: any) {
                    if (e.message === 'ไม่พร้อมใช้งาน') throw e
                }
            }

            let amountToDiscount = 0
            if (discount.discount_type === 'percent') {
                amountToDiscount = Math.ceil(pkgPrice * (discount.discount_value / 100))
                if (discount.max_discount_amount) amountToDiscount = Math.min(amountToDiscount, discount.max_discount_amount)
            } else {
                amountToDiscount = discount.discount_value
            }
            amountToDiscount = Math.min(amountToDiscount, pkgPrice)

            setDiscountAmount(amountToDiscount)
            setDiscountMsg(`✅ ลด ${amountToDiscount} บาท`)
        } catch (e: any) {
            setDiscountMsg(`❌ ${e.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'}`)
            setDiscountAmount(0)
        }

        setDiscountLoading(false)
    }
    const fetchPaymentIntent = async () => {
        if (clientSecret || submitting) return
        setSubmitting(true)
        const bId = pendingBookingId || generateScalableId('BK')
        setPendingBookingId(bId)

        try {
            const res = await fetch('/api/stripe/create-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: total,
                    booking_metadata: {
                        booking_id: bId,
                        customer_name: customer?.full_name || 'Guest',
                        service: selectedPkg?.name,
                    }
                }),
            })
            const data = await res.json()
            if (data.clientSecret) {
                setClientSecret(data.clientSecret)
                setPaymentError(null)
            } else {
                throw new Error(data.error || 'Failed to create payment intent')
            }
        } catch (err: any) {
            console.error('[Stripe] Intent fetch error:', err)
            setPaymentError(err.message || 'ไม่สามารถเตรียมชำระเงินได้')
        } finally {
            setSubmitting(false)
        }
    }

    // Auto-fetch when reaching payment step or when total price changes
    useEffect(() => {
        if (step === 4 && payMethod === 'stripe') {
            fetchPaymentIntent()
        }
    }, [step, payMethod, total]) // Re-fetch if total price changes

    const handleStripeSuccess = async (paymentIntentId: string) => {
        setPaymentSuccessful(true)
        await submit(paymentIntentId)
    }

    // ─── Submit ──────────────────────────────────────────────────
    const submit = async (stripeId?: string) => {
        setSubmitting(true)
        const addonList = Object.entries(addons).filter(([, v]) => v).map(([k]) => k)

        const richAddons = addonList.map(name => {
            const dbA = dbAddons.find(a => a.name === name)
            const desc = dbA?.description || ''
            const detail: any = { name, isFree: desc.includes('[Pricing: Free]') }
            if (dbA) {
                if (desc.includes('[Pricing: Variable]')) {
                    const vState = addonVariableStates[name] || { mode: 'full_tank', customAmount: '' }
                    detail.variableState = vState
                    if (vState.note && name.includes('น้ำมัน')) {
                        detail.name = `${name} (${vState.note.trim()})`
                    }
                } else if (desc.includes('[Prices:')) {
                    detail.selectedPrice = addonSelectedPrices[name]
                } else {
                    detail.price = dbA.price
                }
            }
            return detail
        })

        const finalPickupAddr = `${pickupAddressDetail ? pickupAddressDetail + ' ' : ''}${pickupNote ? '(' + pickupNote + ') ' : ''}${pickupAddress}`
        const finalDeliveryAddr = showDelivery
            ? `${deliveryAddressDetail ? deliveryAddressDetail + ' ' : ''}${deliveryNote ? '(' + deliveryNote + ') ' : ''}${deliveryAddress}`
            : finalPickupAddr

        const finalDeliveryLat = showDelivery ? deliveryLat : pickupLat
        const finalDeliveryLng = showDelivery ? deliveryLng : pickupLng

        const body: any = {
            customer_id: customer.id,
            service_id: selectedPkg?.id,
            addon_ids: richAddons,
            pickup_lat: pickupLat, pickup_lng: pickupLng, pickup_address: finalPickupAddr,
            delivery_lat: finalDeliveryLat, delivery_lng: finalDeliveryLng, delivery_address: finalDeliveryAddr,
            scheduled_date: selectedDate, scheduled_time: selectedSlot,
            zone_id: zoneId, extra_fee: extraFee,
            base_price: selectedPkg?.price || 0, // ONLY Package Price
            total_price: total,
            discount_code: discountCode,
            discount_amount: discountAmount,
            payment_method: payMethod,
            vehicle_data: selectedVehicle,
            vehicle_photos: []
        }

        // Identify active branch for the booking
        const bookingId = pendingBookingId || generateScalableId('BK')
        const activeSlot = slots[selectedDate]?.find((s: any) => s.time_slot === selectedSlot)
        const activeBranchId = activeSlot ? zones.find(z => z.id === activeSlot.serving_zone_id)?.branch_id : null

        // Snapshot branch costs
        const bSettings = branches.find(b => b.id === activeBranchId) || branches[0]

        // Calculate additional_price (addons that were NOT paid now)
        const initAdditionalPrice = currentAddonDisplayTotal // Since currentAddonPaymentTotal is 0
        const initAdditionalNote = currentAddonDisplayTotal > 0 ? 'บริการเสริม (รอชำระ)' : null

        try {
            // ── Guard: ตรวจสอบว่าเวลาที่เลือกยังไม่เลยมาแล้ว ณ เวลา submit จริง ──
            const nowAtSubmit = new Date()
            const thAtSubmit = new Date(nowAtSubmit.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
            const thDateStr = thAtSubmit.getFullYear() + '-' + String(thAtSubmit.getMonth() + 1).padStart(2, '0') + '-' + String(thAtSubmit.getDate()).padStart(2, '0')
            if (selectedDate === thDateStr) {
                const [sh, sm] = selectedSlot.split(':').map(Number)
                const slotMins = sh * 60 + sm
                const nowMins = thAtSubmit.getHours() * 60 + thAtSubmit.getMinutes()
                if (slotMins <= nowMins) {
                    alert('ขออภัยครับ เวลาที่เลือกผ่านมาแล้ว กรุณาเลือกเวลาใหม่')
                    setSubmitting(false)
                    setStep(2) // กลับไปหน้าเลือกเวลา
                    return
                }
                if (slotMins < nowMins + 20) {
                    alert('ขออภัยครับ กรุณาจองล่วงหน้าอย่างน้อย 20 นาที กรุณาเลือกเวลาใหม่')
                    setSubmitting(false)
                    setStep(2)
                    return
                }
            }

            const { data: bookingData, error } = await supabase.from('bookings').insert({
                id: bookingId,
                customer_id: customer.id,
                service_id: selectedPkg?.id,
                addon_ids: richAddons,
                pickup_lat: pickupLat, pickup_lng: pickupLng, pickup_address: finalPickupAddr,
                delivery_lat: finalDeliveryLat, delivery_lng: finalDeliveryLng, delivery_address: finalDeliveryAddr,
                scheduled_date: selectedDate, scheduled_time: selectedSlot,
                branch_id: activeBranchId,
                zone_id: zoneId || null,
                extra_fee: extraFee,
                travel_surcharge: travelSurchargeState,
                different_spot_fee: differentSpotFee,
                staff_extra_payout: (travelSurchargeState + differentSpotFee) * 0.5,
                base_price: basePrice, 
                total_price: total, // Only paid amount (Package + Fees - Discount)
                additional_price: 0,
                additional_price_note: richAddons.length > 0 ? `บริการเสริมที่เลือก: ${richAddons.map(a => a.name).join(', ')} (รอเรียกเก็บ)` : null,
                is_additional_paid: false,
                discount_code: discountCode || null, discount_amount: discountAmount,
                payment_method: payMethod,
                payment_status: stripeId ? 'paid' : (payMethod === 'stripe' ? 'paid' : 'pending'),
                stripe_payment_id: stripeId || null,
                vehicle_data: selectedVehicle,
                vehicle_photos: [], // Start with empty
                customer_note: customerNote || null,
                status: 'pending',
                auto_assigned: false,
                package_markup_amount: (selectedPkg as any)?.branch_markup || 0,
                original_base_price: (selectedPkg?.vehicle_size === 'S' ? (selectedPkg as any).original_price_s : selectedPkg?.vehicle_size === 'M' ? (selectedPkg as any).original_price_m : (selectedPkg as any).original_price_l) || 0,
                labor_cost: bSettings?.labor_cost_per_job || 0,
                capital_cost: bSettings?.max_capital_per_job || 0,
                rental_cost: bSettings?.vehicle_rental_per_job || 0,
                fuel_cost: bSettings?.fuel_cost_per_job || 0
            }).select().single()

            if (error) throw error
            const insertedBooking: any = bookingData
            if (!insertedBooking) throw new Error('ไม่พบข้อมูลการจองหลังบันทึก')

            // Increment discount code usage if applicable
            if (discountCode) {
                const { data: disc } = await supabase.from('discount_codes').select('used_count').eq('code', discountCode.toUpperCase()).single()
                if (disc) {
                    await supabase.from('discount_codes').update({ used_count: (disc.used_count || 0) + 1 }).eq('code', discountCode.toUpperCase())
                }
            }

            // Upload slip if transfer
            if (payMethod === 'transfer' && slip && insertedBooking.id) {
                const fd = new FormData()
                fd.append('booking_id', insertedBooking.id)
                fd.append('slip', slip)
                await fetch('/api/upload-slip', { method: 'POST', body: fd }).catch(e => console.error('Slip upload error:', e))
            }

            // Upload vehicle photos if any
            if (vehicleFiles.length > 0 && insertedBooking.id) {
                const photoUrls: string[] = []
                for (const file of vehicleFiles) {
                    try {
                        const ext = file.name.split('.').pop()
                        const path = `customer-uploads/${insertedBooking.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
                        const { data: uData, error: uError } = await supabase.storage
                            .from('job-photos')
                            .upload(path, file, { contentType: file.type })

                        if (!uError && uData) {
                            const { data: { publicUrl } } = supabase.storage.from('job-photos').getPublicUrl(path)
                            photoUrls.push(publicUrl)
                        }
                    } catch (e) { console.error('Photo upload fail:', e) }
                }
                if (photoUrls.length > 0) {
                    await supabase.from('bookings').update({ vehicle_photos: photoUrls }).eq('id', insertedBooking.id)
                }
            }

            // Notify staff (non-blocking)
            try {
                const { data: schedules } = await supabase
                    .from('staff_schedules')
                    .select('staff_id, staff(line_user_id)')
                    .eq('zone_id', zoneId)
                    .eq('date', selectedDate)
                    .eq('time_slot', selectedSlot)
                    .eq('is_booked', false)

                const lineIds = schedules?.map((s: any) => s.staff?.line_user_id).filter(Boolean) || []
                const staffIds = schedules?.map((s: any) => s.staff_id).filter(Boolean) || []

                // Send Line Notifications
                if (lineIds.length > 0) {
                    fetch('/api/line/notify-staff', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            line_user_ids: lineIds, 
                            booking_id: insertedBooking.id, 
                            message: `🔔 มีงานใหม่!\nวันที่: ${selectedDate} เวลา: ${selectedSlot?.slice(0, 5)} น.\nกรุณาเปิดแอปเพื่อรับงาน` 
                        }),
                    }).catch(() => { })
                }

                // Send Web Push Notifications
                if (staffIds.length > 0) {
                    const payload = {
                        title: '🔔 มีงานใหม่เข้า!',
                        body: `วันที่: ${selectedDate} เวลา: ${selectedSlot?.slice(0, 5)} น.\nกดเพื่อดูรายละเอียดและรับงานเลย`,
                        url: '/staff'
                    }
                    
                    if (localStorage.getItem('foami_mock_db_enabled') === 'true') {
                        // LOCAL BRIDGE for Mock DB Testing:
                        // Search for staff subscriptions directly in local storage for same-device testing
                        const localSubs = JSON.parse(localStorage.getItem('foami_mock_db_push_subscriptions') || '[]')
                        const targetSubs = localSubs.filter((s: any) => staffIds.includes(s.user_id) && s.platform === 'staff')
                        
                        targetSubs.forEach((s: any) => {
                            fetch('/api/push/send-test', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    subscription: s.subscription,
                                    ...payload 
                                }),
                            }).catch(() => {})
                        })
                    } else {
                        // Standard Production Flow
                        fetch('/api/push/notify-staff', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                staff_ids: staffIds,
                                payload
                            })
                        }).catch(e => console.error('Push notify error:', e))
                    }
                }
            } catch (err) {
                console.error('Notification error:', err)
            }

            setSubmitting(false)
            router.replace(`/${branchSlug}/my-bookings?success=1`)
        } catch (e: any) {
            console.error('Submit Error:', e)
            alert('เกิดข้อผิดพลาดในการจอง: ' + (e.message || 'กรุณาลองใหม่อีกครั้ง'))
            setSubmitting(false)
        }
    }

    const canNext = [
        !!selectedPkg &&
        Object.keys(addons).every(name => !addons[name] || isAddonComplete(name)) &&
        (selectedPkg.is_addon_required === true ? Object.values(addons).some(v => v === true) : true),
        !!selectedVehicle && !!pickupAddress && !!pickupAddressDetail.trim() && !isTooFar,
        !!(selectedDate && selectedSlot),
        true,
        !!payMethod,
    ]

    const isDeliveryValid = !showDelivery || (!!deliveryAddress && !!deliveryAddressDetail.trim())
    const currentCanNext = canNext[step] && (step === 1 ? isDeliveryValid : true)

    if (!customer) return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <p style={{ color: 'var(--text-muted)' }}>กำลังโหลด...</p>
        </div>
    )

    return (
        <div className={styles.page}>
            {/* Topbar */}
            <div className={styles.topbar}>
                <div style={{ width: 44 }} />
                <div className={styles.topbarCenter}>
                    <Logo width={110} variant="landscape" />
                </div>
                <div style={{ width: 44 }} />
            </div>

            {/* Step Bar */}
            <div className={styles.stepBar}>
                {STEPS.map((s, i) => (
                    <div key={i} className={styles.stepItem}>
                        <div className={`${styles.stepDot} ${i === step ? styles.stepCurrent : i < step ? styles.stepDone : ''}`}>
                            <s.icon size={16} />
                        </div>
                        {i < STEPS.length - 1 && <div className={`${styles.stepLine} ${i < step ? styles.stepLineDone : ''}`} />}
                    </div>
                ))}
            </div>
            <div className={styles.stepName}>{STEPS[step].name}</div>

            {/* ─── Content ─── */}
            <div className={styles.content}>

                {/* STEP 0: Package */}
                {step === 0 && (
                    <div>
                        <h2 style={{ fontWeight: 800, marginBottom: 'var(--space-2)' }}>เลือกแพ็กเกจ</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 'var(--space-5)' }}>
                            รถของคุณ: {customer.vehicle_brand} {customer.vehicle_model} · {customer.license_plate}
                        </p>

                        {/* Package cards — uses CSS class for responsive grid */}
                        <div className={styles.packageGrid}>
                            {dbPackages.map(pkg => {
                                const IconComp = pkg.icon === 'sparkles' ? Sparkles : pkg.icon === 'wrench' ? Wrench : Droplets
                                const isSelected = selectedPkg?.id === pkg.id
                                return (
                                    <div
                                        key={pkg.id}
                                        onClick={() => { setSelectedPkg(pkg); setAddons({}) }}
                                        className={styles.packageCard}
                                        style={{
                                            borderColor: isSelected ? pkg.color : 'var(--border)',
                                            boxShadow: isSelected ? `0 8px 30px ${pkg.color}30` : 'var(--shadow-card)',
                                        }}
                                    >
                                        {/* Image Header */}
                                        <div className={styles.packageImageContainer}>
                                            {pkg.image_url ? (
                                                <img 
                                                    src={pkg.image_url} 
                                                    alt={pkg.name} 
                                                    className={styles.packageImg} 
                                                    style={{ cursor: 'zoom-in' }}
                                                    onClick={(e) => { e.stopPropagation(); setPreviewImg(pkg.image_url) }}
                                                />
                                            ) : (
                                                <div className={styles.packageIconOverlay}>
                                                    <IconComp size={48} color={pkg.color} style={{ opacity: 0.2 }} />
                                                </div>
                                            )}

                                            {/* Badge for Maintenance */}
                                            {pkg.name.includes('บำรุง') && (
                                                <div className={styles.packageBadge}>
                                                    PREMIUM CARE
                                                </div>
                                            )}

                                            {/* Selection Indicator */}
                                            {isSelected && (
                                                <div className={styles.selectedIndicator}>
                                                    <CheckCircle size={20} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Package Info */}
                                        <div className={styles.packageInfo}>
                                            <div className={styles.packageName}>{pkg.name}</div>
                                            <div className={styles.packageDesc}>{pkg.description}</div>

                                            <div className={styles.packagePriceRow}>
                                                <div>
                                                    <div style={{ color: pkg.color }}>
                                                        {(() => {
                                                            const prices = [pkg.price_s, pkg.price_m, pkg.price_l].filter(p => p !== null && p !== undefined && p > 0);
                                                            const min = Math.min(...prices);
                                                            const max = Math.max(...prices);
                                                            if (min !== max && prices.length > 1) {
                                                                return (
                                                                    <span className={styles.packageAmount}>฿{min.toLocaleString()} - ฿{max.toLocaleString()}</span>
                                                                );
                                                            }
                                                            return (
                                                                <>
                                                                    <span className={styles.packageCurrency}>฿</span>
                                                                    <span className={styles.packageAmount}>{(pkg.price_s || pkg.price || 0).toLocaleString()}</span>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                                {!isSelected && (
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                                                        คลิกเลือก
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Addons for selected package */}
                        {selectedPkg && selectedPkg.availableAddons.length > 0 && (
                            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', border: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 700, marginBottom: 'var(--space-4)' }}>บริการเสริม</div>
                                <div className="addon-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-3)' }}>
                                    {selectedPkg.availableAddons.map((addon: string) => {
                                        const label = ADDON_LABELS[addon] || addon
                                        const dbA = dbAddons.find(a => a.name === label)
                                        const desc = dbA?.description || ''

                                        const pricingType = dbA?.pricing_type || (desc.includes('[Pricing: Free]') ? 'free' : desc.includes('[Pricing: Variable]') ? 'notify_later' : 'fixed')
                                        const isFree = pricingType === 'free'
                                        const isNotifyLater = pricingType === 'notify_later'
                                        const baseDBPrice = dbA?.price || 0

                                        // New Sub-options parsing
                                        let dynPrices = dbA?.sub_options?.map((o: any) => ({ label: o.name, price: o.price, image_url: o.image_url })) || []

                                        // Legacy fallback
                                        if (dynPrices.length === 0 && desc.includes('[Prices:')) {
                                            const match = desc.match(/\[Prices:\s*(.+?)\]/)
                                            if (match && match[1]) {
                                                dynPrices = match[1].split(',').map((part: string) => {
                                                    const [l, p] = part.split('=').map(s => s.trim())
                                                    return { label: l, price: Number(p) || 0, image_url: '' }
                                                })
                                            }
                                        }

                                        const selectedSubOption = dynPrices.find((opt: any) => opt.price === addonSelectedPrices[addon]) || (dynPrices.length > 0 ? dynPrices[0] : null)

                                        const handleToggle = () => {
                                            const newState = !addons[addon]
                                            setAddons(p => ({ ...p, [addon]: newState }))

                                            // Initialize default prices on toggle
                                            if (newState) {
                                                if (dynPrices.length > 0) {
                                                    setAddonSelectedPrices(p => ({ ...p, [addon]: dynPrices[0].price }))
                                                }
                                                if (isNotifyLater) {
                                                    setAddonVariableStates(p => ({ ...p, [addon]: { mode: 'full_tank', customAmount: '' } }))
                                                }
                                            }
                                        }

                                        return (
                                            <div key={addon}>
                                                <div
                                                    onClick={handleToggle}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                                        padding: 'var(--space-3) var(--space-4)',
                                                        borderRadius: 'var(--radius)', cursor: 'pointer',
                                                        border: addons[addon] ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                                                        background: addons[addon] ? 'var(--primary-ghost)' : 'transparent',
                                                        transition: 'all 0.2s',
                                                    }}
                                                >
                                                    <div style={{
                                                        width: 20, height: 20, borderRadius: 4,
                                                        border: addons[addon] ? '2px solid var(--primary)' : '2px solid var(--border)',
                                                        background: addons[addon] ? 'var(--primary)' : 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        flexShrink: 0, transition: 'all 0.2s',
                                                    }}>
                                                        {addons[addon] && <Check size={14} color="#fff" strokeWidth={3} />}
                                                    </div>
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        {dbA?.image_url && !addons[addon] && (
                                                            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius)', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                                                                <img src={dbA.image_url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            </div>
                                                        )}
                                                        {addons[addon] && selectedSubOption?.image_url && (
                                                            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius)', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                                                                <img src={selectedSubOption.image_url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            </div>
                                                        )}
                                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</span>
                                                    </div>

                                                    {!isFree && !isNotifyLater && dynPrices.length > 0 && (
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700 }}>
                                                                {(() => {
                                                                    const prs = dynPrices.map((p: any) => p.price);
                                                                    const min = Math.min(...prs);
                                                                    const max = Math.max(...prs);
                                                                    return min === max ? `${min} ฿` : `${min}-${max} ฿`;
                                                                })()}
                                                            </div>
                                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>(จ่ายหลังใช้บริการ)</div>
                                                        </div>
                                                    )}
                                                    {!isFree && !isNotifyLater && dynPrices.length === 0 && (
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700 }}>{baseDBPrice} ฿</div>
                                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>(จ่ายหลังใช้บริการ)</div>
                                                        </div>
                                                    )}
                                                    {isNotifyLater && (
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700 }}>แจ้งภายหลัง</div>
                                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>(จ่ายหลังใช้บริการ)</div>
                                                        </div>
                                                    )}
                                                    {isFree && <span style={{ color: 'var(--success)', fontSize: '0.78rem', fontWeight: 600 }}>ฟรี</span>}
                                                </div>

                                                {/* Dynamic Sub-options with Images */}
                                                {addons[addon] && dynPrices.length > 0 && (
                                                    <div style={{ marginTop: 12, paddingLeft: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                                                        {dynPrices.map((opt: any) => {
                                                            const isSelected = addonSelectedPrices[addon] === opt.price
                                                            return (
                                                                <div key={opt.label}
                                                                    onClick={() => setAddonSelectedPrices(p => ({ ...p, [addon]: opt.price }))}
                                                                    style={{
                                                                        cursor: 'pointer',
                                                                        borderRadius: 12,
                                                                        border: isSelected ? '2.5px solid var(--primary)' : '1px solid var(--border)',
                                                                        padding: 8,
                                                                        background: isSelected ? 'var(--primary-ghost)' : 'var(--surface)',
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        gap: 6
                                                                    }}
                                                                >
                                                                    {opt.image_url && (
                                                                        <div
                                                                            style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in', transition: 'transform 0.2s' }}
                                                                            onClick={(e) => { e.stopPropagation(); setPreviewImg(opt.image_url) }}
                                                                            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                                                            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                                                        >
                                                                            <img src={opt.image_url} alt={opt.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                        </div>
                                                                    )}
                                                                    <div style={{ textAlign: 'center' }}>
                                                                        <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{opt.label}</div>
                                                                        <div style={{ fontSize: '0.75rem', color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>{opt.price} ฿</div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}

                                                {/* Variable sub-options */}
                                                {addons[addon] && isNotifyLater && (
                                                    <div style={{ marginTop: 8, paddingLeft: 32 }}>
                                                        {addon.includes('น้ำมัน') && (
                                                            <div style={{ marginBottom: 12 }}>
                                                                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                                                                    ประเภทน้ำมันที่ต้องการ/รายละเอียด <span style={{ color: 'var(--danger)' }}>*</span>
                                                                </label>
                                                                <textarea
                                                                    className="form-input"
                                                                    placeholder="เช่น เติม 95, ดีเซล B7..."
                                                                    rows={2}
                                                                    value={addonVariableStates[addon]?.note || ''}
                                                                    onChange={e => setAddonVariableStates(p => ({ ...p, [addon]: { ...p[addon], note: e.target.value } }))}
                                                                    style={{ borderRadius: 'var(--radius)', fontSize: '0.85rem' }}
                                                                />
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                                            <button onClick={() => setAddonVariableStates(p => ({ ...p, [addon]: { ...p[addon], mode: 'full_tank' } }))} className={`btn btn-sm ${addonVariableStates[addon]?.mode === 'full_tank' ? 'btn-primary' : 'btn-outline'}`} style={{ gap: 6 }}>
                                                                <Droplets size={14} /> เต็มถัง
                                                            </button>
                                                            <button onClick={() => setAddonVariableStates(p => ({ ...p, [addon]: { ...p[addon], mode: 'custom' } }))} className={`btn btn-sm ${addonVariableStates[addon]?.mode === 'custom' ? 'btn-primary' : 'btn-outline'}`} style={{ gap: 6 }}>
                                                                <Coins size={14} /> กำหนดเอง
                                                            </button>
                                                        </div>
                                                        {addonVariableStates[addon]?.mode === 'custom' && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <input type="number" className="form-input" placeholder="ราคา" value={addonVariableStates[addon]?.customAmount || ''} onChange={e => setAddonVariableStates(p => ({ ...p, [addon]: { ...p[addon], customAmount: e.target.value } }))} style={{ maxWidth: 120, fontSize: '0.9rem' }} />
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>บาท</span>
                                                            </div>
                                                        )}
                                                        {addonVariableStates[addon]?.mode === 'full_tank' && (
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>* ทีมงานจะแจ้งราคาหน้างานตามจริง</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                {selectedPkg.is_addon_required && !Object.values(addons).some(v => v === true) && (
                                    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', borderRadius: 'var(--radius)', background: 'rgba(217, 119, 6, 0.1)', color: '#D97706', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <AlertTriangle size={16} /> แพ็กเกจนี้บังคับเลือกบริการเสริมอย่างน้อย 1 อย่างครับ
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 1: Vehicle & Location */}
                {step === 1 && (
                    <div>
                        <h2 style={{ fontWeight: 800, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Bike size={24} color="var(--primary)" /> รถและจุดรับส่ง
                        </h2>

                        {/* Vehicle details */}
                        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)', border: '1px solid var(--border)', marginBottom: 'var(--space-4)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#3B5FCC', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-3)' }}>
                                <Bike size={20} /> ข้อมูลรถที่ต้องการรับบริการ
                            </h3>

                            {customer?.saved_vehicles?.length > 0 ? (
                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>เลือกรถของคุณ</div>
                                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                                        {customer.saved_vehicles.map((v: any) => (
                                            <div
                                                key={v.id}
                                                onClick={() => setSelectedVehicle(v)}
                                                style={{
                                                    flexShrink: 0,
                                                    padding: 'var(--space-3)',
                                                    borderRadius: 'var(--radius)',
                                                    border: selectedVehicle?.id === v.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                    background: selectedVehicle?.id === v.id ? 'rgba(59, 95, 204, 0.05)' : 'var(--surface)',
                                                    cursor: 'pointer',
                                                    minWidth: 160
                                                }}
                                            >
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{v.vehicle_brand} {v.vehicle_model}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>สี: {v.vehicle_color} | ทะเบียน: {v.license_plate}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>ไซส์: {VEHICLE_SIZE_LABEL[v.vehicle_size]}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: 'var(--space-3)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        * สามารถเพิ่มรถคันอื่นได้ที่เมนู "ตั้งค่าบัญชี"
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'rgba(59, 95, 204, 0.05)' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{selectedVehicle?.vehicle_brand} {selectedVehicle?.vehicle_model}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>สี: {selectedVehicle?.vehicle_color} | ทะเบียน: {selectedVehicle?.license_plate}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>ไซส์: {selectedVehicle?.vehicle_size ? VEHICLE_SIZE_LABEL[selectedVehicle.vehicle_size] : ''}</div>
                                    <div style={{ marginTop: 'var(--space-2)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        * เพิ่มรถหลายคันได้ที่เมนู "ตั้งค่าบัญชี"
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pickup details */}
                        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)', border: '1px solid var(--border)', marginBottom: 'var(--space-4)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#3B5FCC', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-3)' }}>
                                <Home size={20} /> ข้อมูลจุดรับรถ
                            </h3>

                            {/* Saved / Recent Locations Quick Select */}
                            {(customer?.saved_locations?.length > 0 || recentLocations.length > 0) && (
                                <div style={{ marginBottom: 'var(--space-4)' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                        {customer?.saved_locations?.length > 0 ? 'เลือกจากสถานที่ที่บันทึกไว้' : 'สถานที่ที่เคยใช้ล่าสุด'}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                                        {/* Priority 1: Explicitly Saved Locations */}
                                        {customer?.saved_locations?.map((loc: any) => (
                                            <button
                                                key={`saved-${loc.id}`} type="button"
                                                onClick={() => {
                                                    setPickupLat(loc.lat); setPickupLng(loc.lng);
                                                    setPickupAddressDetail(loc.detail || ''); setPickupNote(loc.note || '');
                                                    setPickupAddress(loc.address || ''); // Ensure we set the address string for map display
                                                }}
                                                className="btn btn-outline btn-sm" style={{ flexShrink: 0, borderRadius: 'var(--radius-full)', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                                            >
                                                <Star size={14} fill="var(--primary)" /> {loc.name}
                                            </button>
                                        ))}
                                        {/* Priority 2: History-based Recommendations */}
                                        {recentLocations.map((loc: any, idx: number) => (
                                            <button
                                                key={`recent-${idx}`} type="button"
                                                onClick={() => {
                                                    setPickupLat(loc.lat); setPickupLng(loc.lng);
                                                    setPickupAddressDetail(loc.detail || ''); setPickupNote(loc.note || '');
                                                    setPickupAddress(loc.address || '');
                                                }}
                                                className="btn btn-outline btn-sm" style={{ flexShrink: 0, borderRadius: 'var(--radius-full)', opacity: 0.8 }}
                                            >
                                                {loc.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">ชื่อหอพัก / หมู่บ้าน / ที่อยู่ <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input 
                                    className="form-input" 
                                    placeholder="เช่น หอพัก ABC, บ้านเลขที่ 123" 
                                    value={pickupAddressDetail} 
                                    onChange={e => setPickupAddressDetail(e.target.value)} 
                                    required 
                                    style={!pickupAddressDetail.trim() ? { borderColor: 'var(--danger)', background: '#FEF2F2' } : {}}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">รายละเอียดเพิ่มเติม</label>
                                <input className="form-input" placeholder="เช่น จอดหน้าตึก B, รอที่ป้อมยาม" value={pickupNote} onChange={e => setPickupNote(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span><Camera size={16} /> แนบรูปภาพรถและจุดรับส่ง (ไม่บังคับ)</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{vehicleFiles.length}/3 รูป</span>
                                </label>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
                                    {vehicleFiles.map((f, i) => (
                                        <div key={i} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                                            <img src={URL.createObjectURL(f)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <button
                                                onClick={() => setVehicleFiles(prev => prev.filter((_, idx) => idx !== i))}
                                                style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            ><X size={14} /></button>
                                        </div>
                                    ))}
                                    {vehicleFiles.length < 3 && (
                                        <label style={{
                                            aspectRatio: '1/1', borderRadius: 12, border: '2px dashed var(--border)',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', background: 'var(--surface-2)', transition: 'all 0.2s'
                                        }}>
                                            <input
                                                type="file" accept="image/*" multiple hidden
                                                onChange={e => {
                                                    const files = Array.from(e.target.files || [])
                                                    setVehicleFiles(prev => [...prev, ...files].slice(0, 3))
                                                }}
                                            />
                                            <span style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>+</span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>เพิ่มรูป</span>
                                        </label>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                                    * ถ่ายรูปจุดจอดรถ หรือรูปสภาพรถ ช่วยให้ทีมงานหาจุดหมายได้ง่ายขึ้น
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">หมายเหตุถึงพนักงาน (เช่น ระวังสีรถพิเศษ, ฝากกุญแจไว้ที่ไหน)</label>
                                <textarea
                                    className="form-input"
                                    placeholder="ระบุข้อความถึงพนักงาน..."
                                    rows={3}
                                    value={customerNote}
                                    onChange={e => setCustomerNote(e.target.value)}
                                    style={{ resize: 'none', borderRadius: 'var(--radius)' }}
                                />
                            </div>

                            <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>แผนที่สำหรับปักหมุด</label>
                            <MapPicker
                                lat={pickupLat} lng={pickupLng} mode="pickup"
                                onChange={(lat, lng, addr) => { setPickupLat(lat); setPickupLng(lng); setPickupAddress(addr) }}
                            />
                        </div>

                        {/* Optional Delivery details */}
                        {!showDelivery ? (
                            <button className="btn btn-outline btn-full" onClick={() => setShowDelivery(true)} style={{ marginBottom: 'var(--space-4)', gap: 8 }}>
                                <Sparkles size={18} /> เพิ่มจุดส่งรถ (กรณีคนละที่กับจุดรับรถ)
                            </button>
                        ) : (
                            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)', border: '1px solid var(--border)', marginBottom: 'var(--space-4)', position: 'relative' }}>
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowDelivery(false)} style={{ position: 'absolute', top: 12, right: 12, color: 'var(--text-muted)' }}><X size={20} /></button>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-3)' }}>
                                    <MapPin size={20} /> ข้อมูลจุดส่งรถ
                                </h3>

                                {/* Saved / Recent Locations Quick Select */}
                                {(customer?.saved_locations?.length > 0 || recentLocations.length > 0) && (
                                    <div style={{ marginBottom: 'var(--space-4)' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                            {customer?.saved_locations?.length > 0 ? 'เลือกจากสถานที่ที่บันทึกไว้' : 'สถานที่ที่เคยใช้ล่าสุด'}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                                            {customer?.saved_locations?.map((loc: any) => (
                                                <button
                                                    key={`saved-d-${loc.id}`} type="button"
                                                    onClick={() => {
                                                        setDeliveryLat(loc.lat); setDeliveryLng(loc.lng);
                                                        setDeliveryAddressDetail(loc.detail || ''); setDeliveryNote(loc.note || '');
                                                        setDeliveryAddress(loc.address || '');
                                                    }}
                                                    className="btn btn-outline btn-sm" style={{ flexShrink: 0, borderRadius: 'var(--radius-full)', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                                                >
                                                    <Star size={14} fill="currentColor" /> {loc.name}
                                                </button>
                                            ))}
                                            {recentLocations.map((loc: any, idx: number) => (
                                                <button
                                                    key={`recent-d-${idx}`} type="button"
                                                    onClick={() => {
                                                        setDeliveryLat(loc.lat); setDeliveryLng(loc.lng);
                                                        setDeliveryAddressDetail(loc.detail || ''); setDeliveryNote(loc.note || '');
                                                        setDeliveryAddress(loc.address || '');
                                                    }}
                                                    className="btn btn-outline btn-sm" style={{ flexShrink: 0, borderRadius: 'var(--radius-full)', opacity: 0.8 }}
                                                >
                                                    {loc.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">ชื่อหอพัก / หมู่บ้าน / ที่อยู่ <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input 
                                        className="form-input" 
                                        placeholder="เช่น หอพัก XYZ, บ้านเลขที่ 456" 
                                        value={deliveryAddressDetail} 
                                        onChange={e => setDeliveryAddressDetail(e.target.value)} 
                                        required 
                                        style={(!deliveryAddressDetail.trim() && showDelivery) ? { borderColor: 'var(--danger)', background: '#FEF2F2' } : {}}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">รายละเอียดเพิ่มเติม</label>
                                    <input className="form-input" placeholder="เช่น จอดช่อง 5, ฝากกุญแจที่นิติ" value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} />
                                </div>

                                <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>แผนที่สำหรับปักหมุด</label>
                                <MapPicker
                                    lat={deliveryLat} lng={deliveryLng} mode="delivery"
                                    onChange={(lat, lng, addr) => { setDeliveryLat(lat); setDeliveryLng(lng); setDeliveryAddress(addr) }}
                                />
                            </div>
                        )}

                        {isTooFar && (
                            <div className="alert alert-error" style={{ marginTop: 'var(--space-4)', gap: 8, display: 'flex', alignItems: 'center', background: '#FEE2E2', color: '#B91C1C', borderColor: '#FCA5A5' }}>
                                <XCircle size={20} /> <div><strong>ขออภัย!</strong> ตำแหน่งของคุณอยู่นอกพื้นที่ให้บริการสูงสุด</div>
                            </div>
                        )}

                        {extraFee > 0 && !isTooFar && (
                            <div className="alert alert-warning" style={{ marginTop: 'var(--space-4)', gap: 8, display: 'flex', alignItems: 'center' }}>
                                <AlertTriangle size={20} /> <div>
                                    {differentSpotFee > 0 && <div>• ตำแหน่งรับและส่งรถเป็นคนละที่กัน (มีค่าเดินทางเพิ่มเติม)</div>}
                                    {extraFee - differentSpotFee > 0 && <div>• มีค่าบริการจัดการพื้นที่ห่างไกล</div>}
                                    โปรดตรวจสอบสรุปราคาสุดท้ายในขั้นตอนถัดไป
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 2: Time */}
                {step === 2 && (
                    <div>
                        <h2 style={{ fontWeight: 800, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Clock size={24} color="var(--primary)" /> เลือกวันและเวลา
                        </h2>
                        {/* Date tabs */}
                        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 'var(--space-5)' }}>
                            {dateRange.map(d => {
                                const key = format(d, 'yyyy-MM-dd')
                                const isSelected = key === selectedDate
                                return (
                                    <button key={key} onClick={() => setSelectedDate(key)}
                                        style={{
                                            flexShrink: 0, padding: '10px 16px', borderRadius: 'var(--radius)',
                                            border: isSelected ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                                            background: isSelected ? 'var(--primary)' : 'var(--surface)',
                                            color: isSelected ? '#fff' : 'var(--text-primary)',
                                            fontWeight: 700, cursor: 'pointer', minWidth: 72, textAlign: 'center',
                                        }}
                                    >
                                        <div style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.85 }}>{format(d, 'EEE', { locale: th })}</div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{format(d, 'd')}</div>
                                        <div style={{ fontSize: '0.72rem', opacity: 0.75 }}>{format(d, 'MMM', { locale: th })}</div>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Time slots */}
                        {pickupAddress ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                {(slots[selectedDate] || []).map((sl: any) => {
                                    const isSelected = selectedSlot === sl.time_slot
                                    const isFull = sl.type === 'full'
                                    const isTimedOut = sl.type === 'timed_out'

                                    // NEW: Unified Fee display (Travel + Different Spot)
                                    const diffFee = differentSpotFee
                                    const slotSurcharge = Math.round((sl.calculated_fee || 0) + diffFee + baseZoneExtraFee)
                                    const hasSurcharge = slotSurcharge > 0

                                    return (
                                        <button key={sl.time_slot} disabled={isFull || isTimedOut}
                                            onClick={() => setSelectedSlot(sl.time_slot)}
                                            style={{
                                                padding: '10px 8px', borderRadius: 'var(--radius)', fontWeight: 700,
                                                border: isSelected ? '2.5px solid var(--primary)' : '1.5px solid var(--border)',
                                                background: isSelected ? 'var(--primary)' : (isFull || isTimedOut) ? 'var(--surface-2)' : hasSurcharge ? '#FFF9C4' : 'var(--surface)',
                                                color: isSelected ? '#fff' : (isFull || isTimedOut) ? 'var(--text-muted)' : 'var(--text-primary)',
                                                cursor: (isFull || isTimedOut) ? 'not-allowed' : 'pointer', opacity: (isFull || isTimedOut) ? 0.6 : 1,
                                                transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
                                            }}
                                        >
                                            <div style={{ fontSize: '0.9rem' }}>{sl.time_slot?.slice(0, 5)}</div>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 600, marginTop: 2, color: isSelected ? 'rgba(255,255,255,0.9)' : hasSurcharge ? '#D4A017' : 'var(--text-muted)' }}>
                                                {isTimedOut ? 'หมดเวลา' : isFull ? 'คิวเต็ม' : hasSurcharge ? `+฿${slotSurcharge}` : 'ว่าง'}
                                            </div>
                                            {hasSurcharge && !isSelected && !isFull && <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 12px 12px 0', borderColor: `transparent #FBC02D transparent transparent` }} />}
                                        </button>
                                    )
                                })}
                                {!(slots[selectedDate]?.length) && (
                                    <div style={{ gridColumn: '1/-1', padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        ไม่มีช่วงเวลาว่างในวันนี้
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="alert alert-warning" style={{ gap: 8, display: 'flex', alignItems: 'center' }}>
                                <Info size={20} /> กรุณาเลือกตำแหน่งก่อนเพื่อดูช่วงเวลาว่าง
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 3: Summary */}
                {step === 3 && (
                    <div>
                        <h2 style={{ fontWeight: 800, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ClipboardList size={24} color="var(--primary)" /> สรุปการจอง
                        </h2>

                        {/* Package summary card */}
                        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', border: '1px solid var(--border)', marginBottom: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <div className={styles.iconBox} style={{ background: selectedPkg?.color + '20', color: selectedPkg?.color, width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {selectedPkg?.icon === 'sparkles' ? <Sparkles size={24} /> :
                                        selectedPkg?.icon === 'wrench' ? <Wrench size={24} /> :
                                            <Droplets size={24} />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>{selectedPkg?.name}</div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                        {customer.vehicle_brand} {customer.vehicle_model} · {customer.license_plate} ({VEHICLE_SIZE_LABEL[selectedVehicle?.vehicle_size]})
                                    </div>
                                </div>
                            </div>
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {[
                                    { label: 'วันที่', val: `${selectedDate} เวลา ${selectedSlot?.slice(0, 5)} น.`, icon: <Calendar size={14} /> },
                                    { label: 'รับรถ', val: `${pickupAddressDetail} ${pickupNote ? `(${pickupNote})` : ''}`, icon: <MapPin size={14} /> },
                                    { label: 'ส่งรถ', val: showDelivery ? `${deliveryAddressDetail} ${deliveryNote ? `(${deliveryNote})` : ''}` : '(ที่เดียวกับจุดรับรถ)', icon: <Home size={14} /> },
                                ].map(row => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', gap: 8 }}>
                                        <span style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {row.icon}
                                            {row.label}
                                        </span>
                                        <span style={{ fontWeight: 600, textAlign: 'right' }}>{row.val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Price breakdown */}
                        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', border: '1px solid var(--border)', marginBottom: 'var(--space-4)' }}>
                            <div style={{ fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Coins size={20} color="var(--primary)" /> รายละเอียดค่าใช้จ่าย
                            </div>
                            {[
                                { label: `แพ็กเกจ ${selectedPkg?.name}`, val: pkgBasePrice },
                                ...((pkgAdjustment !== 0 || (selectedVehicle?.vehicle_size && selectedVehicle.vehicle_size !== 'S') || isCcPrice) ? [{
                                    label: isCcPrice ? `ค่าบริการตาม CC` : `ส่วนต่างตามขนาดรถ (${selectedVehicle?.vehicle_size})`,
                                    val: pkgAdjustment,
                                    note: pkgAdjustment === 0 ? '฿0' : (pkgAdjustment > 0 ? `+฿${pkgAdjustment.toLocaleString()}` : `-฿${Math.abs(pkgAdjustment).toLocaleString()}`)
                                }] : []),
                                ...Object.entries(addons).map(([name, isSelected]) => {
                                    if (!isSelected) return null
                                    const dbA = dbAddons.find(a => a.name === name)
                                    if (!dbA) return null
                                    const label = ADDON_LABELS[name] || name
                                    const isFree = dbA.description.includes('[Pricing: Free]')
                                    if (isFree) return { label, val: 0, note: 'ฟรี' }
                                    return null // All paid/variable addons go to the Pay Later section
                                }).filter(Boolean),
                                ...(travelSurchargeState > 0 ? [{ label: (pickupMatched ? 'ค่าเดินทางเพิ่มเติม' : 'ค่าระยะทางนอกโซน'), val: Math.round(travelSurchargeState) }] : []),
                                ...(differentSpotFee > 0 ? [{ label: 'ค่าส่งรถต่างสถานที่', val: Math.round(differentSpotFee) }] : []),
                                ...((extraFee - travelSurchargeState - differentSpotFee) > 0 ? [{ label: 'ค่าบริการจัดการพื้นที่ห่างไกล', val: Math.round(extraFee - travelSurchargeState - differentSpotFee) }] : []),
                                ...(discountAmount > 0 ? [{ label: `ส่วนลด (${discountCode})`, val: -discountAmount }] : []),
                            ].map((row: any) => (
                                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: 8, alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                                    </div>
                                    <span style={{ fontWeight: 600, color: row.val < 0 ? 'var(--success)' : 'inherit' }}>
                                        {row.note || (row.val === 0 ? 'ฟรี' : `฿${Math.abs(row.val).toLocaleString()}`)}
                                    </span>
                                </div>
                            ))}
                            <div style={{ borderTop: '2px solid var(--border)', paddingTop: 'var(--space-4)', marginTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.2rem' }}>
                                <span>ยอดโอน/จ่ายตอนนี้</span>
                                <span style={{ color: 'var(--primary)' }}>฿{Math.round(total).toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Pay Later Section */}
                        {Object.entries(addons).some(([name, isSelected]) => {
                            if (!isSelected) return false
                            const dbA = dbAddons.find(a => a.name === name)
                            return dbA && !dbA.description.includes('[Pricing: Free]')
                        }) && (
                            <div style={{ background: '#F8FAFC', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', border: '1px solid var(--border)', marginBottom: 'var(--space-4)', borderLeft: '4px solid var(--warning)' }}>
                                <div style={{ fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warning-dark)' }}>
                                    <Smartphone size={20} /> รายการชำระหน้างาน (จ่ายทีหลัง)
                                </div>
                                {Object.entries(addons).map(([name, isSelected]) => {
                                    if (!isSelected) return null
                                    const dbA = dbAddons.find(a => a.name === name)
                                    if (!dbA || dbA.description.includes('[Pricing: Free]')) return null
                                    
                                    const label = ADDON_LABELS[name] || name
                                    const isVariable = dbA.description.includes('[Pricing: Variable]')
                                    const vState = addonVariableStates[name]
                                    
                                    let priceDisplay = 'ตามจริงหน้างงาน'
                                    if (!isVariable) {
                                        const p = Math.round(addonSelectedPrices[name] || dbA.price || 0)
                                        priceDisplay = `฿${p.toLocaleString()}`
                                    } else if (vState?.mode === 'custom') {
                                        const val = Number(vState.customAmount) || 0
                                        priceDisplay = `฿${val.toLocaleString()}`
                                    }

                                    return (
                                        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: 8, alignItems: 'center' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>
                                                {vState?.mode === 'full_tank' ? `${label} (เต็มถัง)` : label}
                                            </span>
                                            <span style={{ fontWeight: 600, color: 'var(--warning-dark)' }}>
                                                {priceDisplay}
                                            </span>
                                        </div>
                                    )
                                }).filter(Boolean)}
                                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 12, fontStyle: 'italic', background: '#F1F5F9', padding: '8px 12px', borderRadius: '8px' }}>
                                    * พนักงานจะเรียกเก็บยอดส่วนนี้หน้างานตามการใช้งานจริง
                                </div>
                            </div>
                        )}

                        {/* Discount code */}
                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                            <input className="form-input" placeholder="โค้ดส่วนลด" value={discountCode} onChange={e => { setDiscountCode(e.target.value); setDiscountMsg('') }} style={{ flex: 1 }} />
                            <button className="btn btn-outline" onClick={applyDiscount} disabled={discountLoading || !discountCode}>
                                {discountLoading ? <span className="spinner" /> : <><Tag size={18} /> ใช้</>}
                            </button>
                        </div>
                        {discountMsg && <div style={{ fontSize: '0.85rem', color: discountMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {discountMsg.startsWith('✅') ? <CheckCircle size={16} /> : <XCircle size={16} />} {discountMsg.replace('✅ ', '').replace('❌ ', '')}
                        </div>}
                    </div>
                )}

                {/* STEP 4: Payment */}
                {step === 4 && (
                    <div>
                        <h2 style={{ fontWeight: 800, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CreditCard size={24} color="var(--primary)" /> ชำระเงิน
                        </h2>

                        {/* Total reminder */}
                        <div style={{ textAlign: 'center', padding: 'var(--space-6)', background: 'var(--primary-ghost)', borderRadius: 'var(--radius-xl)', marginBottom: 'var(--space-5)' }}>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ยอดชำระ</div>
                            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--primary)' }}>฿{total.toLocaleString()}</div>
                        </div>

                        {/* Payment method - Hidden if only one option or already fetching */}
                        {paymentError ? (
                            <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <AlertTriangle size={20} />
                                    <div style={{ fontWeight: 600 }}>{paymentError}</div>
                                </div>
                                <button className="btn btn-primary btn-sm" onClick={() => fetchPaymentIntent()}>
                                    ลองใหม่
                                </button>
                            </div>
                        ) : !clientSecret ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                                <div className="spinner" style={{ margin: '0 auto 12px', border: '3px solid var(--primary-ghost)', borderTop: '3px solid var(--primary)' }} />
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>กำลังเตรียมรายการชำระเงิน...</div>
                            </div>
                        ) : (
                            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', border: '1px solid var(--border)' }}>
                                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                                    <CheckoutForm
                                        amount={total}
                                        customerEmail={customer?.email}
                                        onSuccess={handleStripeSuccess}
                                        onCancel={() => setClientSecret('')}
                                    />
                                </Elements>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer navigation */}
            <div className={styles.footer}>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button 
                        className="btn btn-ghost" 
                        style={{ flex: 1, gap: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                        onClick={() => step === 0 ? router.back() : setStep(s => s - 1)}
                    >
                        {step === 0 ? <X size={18} /> : <ChevronLeft size={18} />} 
                        {step === 0 ? 'กลับหน้าหลัก' : 'ย้อนกลับ'}
                    </button>
                    {(step < STEPS.length - 1 && step !== 4) ? (
                        <button
                            className="btn btn-primary"
                            style={{ flex: 2, gap: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            disabled={!currentCanNext}
                            onClick={() => setStep(s => s + 1)}
                        >
                            ถัดไป <ChevronRight size={18} />
                        </button>
                    ) : (
                        // Hide main footer button when Stripe form is active (CheckoutForm has its own button)
                        clientSecret && step === 4 ? null : (
                            <button
                                className="btn btn-primary"
                                style={{ flex: 2, gap: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' }}
                                disabled={submitting || !currentCanNext}
                                onClick={payMethod === 'stripe' ? fetchPaymentIntent : () => submit()}
                            >
                                {submitting ? <span className="spinner" /> :
                                    payMethod === 'stripe' ? <><CreditCard size={18} /> ชำระเงิน</> :
                                        <><CheckCircle size={18} /> ยืนยันการจอง</>}
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Image Preview Modal */}
            {previewImg && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                    onClick={() => setPreviewImg(null)}
                >
                    <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setPreviewImg(null)}
                            style={{ position: 'absolute', top: -40, right: 0, color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            <X size={32} />
                        </button>
                        <img src={previewImg} style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 100px)', borderRadius: 12, objectFit: 'contain', boxShadow: '0 0 40px rgba(0,0,0,0.5)' }} />
                    </div>
                </div>
            )}
        </div>
    )
}
