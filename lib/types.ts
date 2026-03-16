// ─── Foami Service Packages ─────────────────────────────────
export type FuelAddonType = 'full_tank' | 'custom_price'

export interface OilChangeOption {
    label: string
    price: number
}

export const OIL_CHANGE_OPTIONS: OilChangeOption[] = [
    { label: 'ถูกๆ — 150 บาท', price: 150 },
    { label: 'อย่างดี — 200 บาท', price: 200 },
]

export const GEAR_OIL_OPTIONS: OilChangeOption[] = [
    { label: 'เล็ก — 50 บาท', price: 50 },
    { label: 'ใหญ่ — 100 บาท', price: 100 },
]

// น้ำมันเบรค = ราคาคงที่ 50 บาท
export const BRAKE_FLUID_PRICE = 50

export interface FoamiPackage {
    id: string
    name: string
    description: string
    price: number
    icon: string
    color: string
    availableAddons: ('air' | 'fuel' | 'oil_change' | 'brake_fluid' | 'gear_oil')[]
}

export const FOAMI_PACKAGES: FoamiPackage[] = [
    {
        id: 'wash',
        name: 'ล้างรถ',
        description: 'ล้างทำความสะอาดภายนอกทั้งคัน ขัดสีเบื้องต้น',
        price: 169,
        icon: 'droplets',
        color: '#3B5FCC',
        availableAddons: ['air', 'fuel'],
    },
    {
        id: 'wash_polish',
        name: 'ล้าง+เคลือบเงา',
        description: 'ล้างทำความสะอาด พร้อมเคลือบเงาสีให้รถดูใหม่',
        price: 189,
        icon: 'sparkles',
        color: '#7C3AED',
        availableAddons: ['air', 'fuel'],
    },
    {
        id: 'maintenance',
        name: 'บำรุงรักษา',
        description: 'บริการดูแลรักษารถ เปลี่ยนน้ำมัน ตรวจเช็คระบบ',
        price: 30,
        icon: 'wrench',
        color: '#D97706',
        availableAddons: ['air', 'fuel', 'oil_change', 'brake_fluid', 'gear_oil'],
    },
]

export const ADDON_LABELS: Record<string, string> = {
    air: 'เติมลม',
    fuel: 'เติมน้ำมัน',
    oil_change: 'เปลี่ยนน้ำมันเครื่อง',
    brake_fluid: 'เติมน้ำมันเบรค',
    gear_oil: 'เปลี่ยนน้ำมันเฟืองท้าย',
}

export const SERVICE_ZONES = [
    { id: 'mko', name: 'หลังมอ', centerLat: 16.4419, centerLng: 102.836, description: 'บริเวณด้านหลังมหาวิทยาลัยขอนแก่น' },
    { id: 'kangsadan', name: 'กังสดาล', centerLat: 16.4380, centerLng: 102.829, description: 'บริเวณกังสดาลและรอบข้าง' },
]

export const OUT_OF_ZONE_RATE = 10 // baht per km
export const OVERFLOW_FEE = 100 // baht for sending staff from another zone
export const DEFAULT_ZONE_CENTER: [number, number] = [16.4419, 102.836] // KKU

// ─── Booking Status ─────────────────────────────────────────
export type BookingStatus =
    | 'pending'
    | 'confirmed'
    | 'picking_up'
    | 'washing'
    | 'delivering'
    | 'completed'
    | 'cancelled'

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
    pending: 'รอยืนยัน',
    confirmed: 'ยืนยันแล้ว',
    picking_up: 'กำลังรับรถ',
    washing: 'กำลังล้าง',
    delivering: 'กำลังส่ง',
    completed: 'เสร็จสิ้น',
    cancelled: 'ยกเลิก',
}

export const BOOKING_STATUS_CSS: Record<BookingStatus, string> = {
    pending: 'badge-pending',
    confirmed: 'badge-confirmed',
    picking_up: 'badge-picking',
    washing: 'badge-washing',
    delivering: 'badge-delivering',
    completed: 'badge-completed',
    cancelled: 'badge-cancelled',
}

// ─── Vehicle Size (SML with CC Ranges) ───────────────────────
export type VehicleSize = 'S' | 'M' | 'L'
export const VEHICLE_SIZE_LABEL: Record<string, string> = {
    S: 'ไม่เกิน 125 cc',
    M: '126-249 cc',
    L: '250 cc ขึ้นไป',
}

// ─── Time Slots ──────────────────────────────────────────────
export const TIME_SLOTS = [
    '00:00', '01:00', '02:00', '03:00', '04:00', '05:00',
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
]

// ─── Database Types ──────────────────────────────────────────
export interface Branch {
    id: string
    slug: string
    name: string
    address: string
    lat: number
    lng: number
    is_active: boolean
    created_at: string
    out_of_zone_type?: 'per_km' | 'flat_rate'
    out_of_zone_fee?: number
    labor_cost_per_job?: number
    max_capital_per_job?: number
    vehicle_rental_per_job?: number
    fuel_cost_per_job?: number
    price_group_id?: string
}

export interface Zone {
    id: string
    branch_id: string
    name: string
    description: string
    extra_fee: number
    polygon_coords: [number, number][]
    is_active: boolean
}

export interface Staff {
    id: string
    branch_id: string
    full_name: string
    phone: string
    line_user_id?: string
    role: 'admin' | 'staff'
    is_active: boolean
    created_at: string
    branches?: Branch
    bank_account_number?: string
    bank_name?: string
    promptpay_number?: string
    email?: string
    password?: string
    image_url?: string
}

export interface Service {
    id: string
    name: string
    description: string
    price_s: number
    price_m: number
    price_l: number
    is_active: boolean
    is_addon_required: boolean
    image_url?: string
}

export interface ServiceAddon {
    id: string
    name: string
    description: string
    price: number
    is_active: boolean
    image_url?: string
    pricing_type?: 'free' | 'fixed' | 'notify_later'
    sub_options?: Array<{
        name: string
        price: number
        image_url?: string
    }>
}

export interface ServiceSizeAdjustment {
    id: string
    vehicle_size: VehicleSize
    adjustment_amount: number // Can be positive or negative
    branch_ids: string[] // List of branches this applies to
    created_at?: string
}

export interface SavedLocation {
    id: string
    name: string
    lat: number
    lng: number
    address: string
    detail?: string
    note?: string
}

export interface SavedVehicle {
    id: string
    vehicle_brand: string
    vehicle_model: string
    vehicle_color: string
    license_plate: string
    vehicle_size: string
}

export interface Customer {
    id: string
    line_user_id: string
    full_name: string
    phone: string
    vehicle_brand: string
    vehicle_model: string
    vehicle_color: string
    license_plate: string
    vehicle_size: string
    saved_locations?: SavedLocation[]
    saved_vehicles?: SavedVehicle[]
    gender?: string
    birthdate?: string
    occupation?: string
    interests?: string[]
    is_profile_complete: boolean
    reward_claimed: boolean
    created_at: string
}

export interface StaffSchedule {
    id: string
    staff_id: string
    zone_id: string
    date: string
    time_slot: string
    is_booked: boolean
    staff?: Staff
    branches?: Branch
    zones?: Zone
}

export interface CCPriceGroup {
    id: string
    name: string
    branch_ids: string[]
    service_ids: string[]
    prices: Record<string, number> // e.g. { S: 100, M: 130, ... }
    is_active: boolean
    created_at?: string
}

export interface Booking {
    id: string
    customer_id: string
    staff_id?: string
    service_id: string
    addon_ids: string[]
    pickup_lat: number
    pickup_lng: number
    pickup_address: string
    delivery_lat: number
    delivery_lng: number
    delivery_address: string
    scheduled_date: string
    scheduled_time: string
    zone_id: string
    extra_fee: number
    base_price: number
    total_price: number
    discount_code?: string
    discount_amount: number
    payment_method: 'stripe' | 'transfer'
    payment_status: 'pending' | 'paid' | 'refunded'
    stripe_payment_intent_id?: string
    slip_url?: string
    status: BookingStatus
    auto_assigned: boolean
    rating?: number
    review_comment?: string
    vehicle_photos?: string[]
    customer_note?: string
    additional_price?: number
    additional_price_note?: string
    additional_price_slips?: string[]
    payout_id?: string
    created_at: string
    updated_at: string
    // Joins
    customers?: Customer
    staff?: Staff
    services?: Service
    zones?: Zone
}

export interface JobPhoto {
    id: string
    booking_id: string
    type: 'before' | 'after'
    photo_urls: string[]
    uploaded_at: string
}

export interface DiscountCode {
    id: string
    code: string
    discount_type: 'percent' | 'fixed'
    discount_value: number
    max_uses: number
    used_count: number
    expires_at: string
    is_active: boolean
}

// ─── Payout Types ────────────────────────────────────────────
export interface Payout {
    id: string
    staff_id: string
    amount: number
    extra_costs: number
    slip_url: string
    start_date: string
    end_date: string
    status: 'completed'
    notes?: string
    created_at: string
    // Joins
    staff?: Staff
}

// ─── Audit Log Types ──────────────────────────────────────────
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'TOGGLE_STATUS' | 'PAYOUT' | 'RESTORE'
export type AuditEntity = 'staff' | 'branch' | 'service' | 'booking' | 'payout'

export interface AuditLog {
    id: string
    admin_id: string
    action_type: AuditAction
    entity_type: AuditEntity
    entity_id: string
    old_data: any
    new_data: any
    description: string
    created_at: string
}

export const THAI_BANKS = [
    { code: '002', name: 'ธนาคารกรุงเทพ' },
    { code: '004', name: 'ธนาคารกสิกรไทย' },
    { code: '006', name: 'ธนาคารกรุงไทย' },
    { code: '011', name: 'ธนาคารไทยพาณิชย์' },
    { code: '014', name: 'ธนาคารกรุงศรีอยุธยา' },
    { code: '022', name: 'ธนาคารซีไอเอ็มบีไทย' },
    { code: '024', name: 'ธนาคารยูโอบี' },
    { code: '025', name: 'ธนาคารกรุงศรีอยุธยา (BAY)' }, // Often redundant but common
    { code: '030', name: 'ธนาคารออมสิน' },
    { code: '033', name: 'ธนาคารอาคารสงเคราะห์' },
    { code: '034', name: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร' },
    { code: '065', name: 'ธนาคารธนชาต' }, // Now TTB but still used
    { code: '066', name: 'ธนาคารทิสโก้' },
    { code: '067', name: 'ธนาคารเกียรตินาคินภัทร' },
    { code: '069', name: 'ธนาคารแลนด์ แอนด์ เฮ้าส์' },
    { code: '070', name: 'ธนาคารไอซีบีซี (ไทย)' },
    { code: '071', name: 'ธนาคารไทยเครดิตเพื่อรายย่อย' },
    { code: '073', name: 'ธนาคารแลนด์ แอนด์ เฮ้าส์' },
    { code: '098', name: 'ธนาคารพัฒนาวิสาหกิจขนาดกลางและขนาดย่อมแห่งประเทศไทย' }
].sort((a, b) => a.name.localeCompare(b.name, 'th'))

