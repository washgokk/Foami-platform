'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './crm.module.css'
import { getRFMScore, segmentCustomer, DEFAULT_CRM_CONFIG } from '@/lib/crm-utils'
import { generateScalableId } from '@/lib/id-utils'
import { VEHICLE_SIZE_LABEL, BOOKING_STATUS_LABEL, BOOKING_STATUS_CSS, BookingStatus } from '@/lib/types'
import { 
    Users, 
    Settings, 
    Edit3, 
    User, 
    Car, 
    FileText, 
    CreditCard, 
    ShieldCheck, 
    MapPin, 
    Star, 
    Flag, 
    Info, 
    Target, 
    ChevronRight, 
    Plus, 
    Trash2, 
    ClipboardList, 
    CheckCircle, 
    Calendar,
    ArrowRight,
    Map,
    Sparkles,
    BarChart3,
    History,
    Search,
    X
} from 'lucide-react'
import { trackAuditLog } from '@/lib/audit'

/* 
This CRM Page groups customer data into 4 tabs:
1. Profiles (All customer info & dynamic flags)
2. Transactions (All booking history)
3. Analytics (RFM scoring algorithms & behaviors)
4. Segments (Custom segment builder for discounts)
*/

export default function CRMPage() {
    const [activeTab, setActiveTab] = useState<'profiles' | 'transactions' | 'analytics' | 'segments'>('profiles')

    // Data State
    const [customers, setCustomers] = useState<any[]>([])
    const [bookings, setBookings] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [branches, setBranches] = useState<any[]>([])
    const [services, setServices] = useState<any[]>([])
    const [addons, setAddons] = useState<any[]>([])
    const [txFilters, setTxFilters] = useState({
        branchId: 'all',
        status: 'all',
        startDate: '',
        endDate: '',
        search: ''
    })

    // Segment Builder State
    const [segmentName, setSegmentName] = useState('')
    const [conditions, setConditions] = useState<any[]>([
        { id: Date.now(), metric: 'totalVisits', operator: '>=', value: '5' }
    ])
    const [showLegend, setShowLegend] = useState(false)
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
    const [crmConfig, setCrmConfig] = useState(DEFAULT_CRM_CONFIG)
    const [savedSegments, setSavedSegments] = useState<any[]>([])
    const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)

    // Load Data
    useEffect(() => {
        const loadSavedConfig = localStorage.getItem('foami_crm_config')
        if (loadSavedConfig) {
            try { setCrmConfig(JSON.parse(loadSavedConfig)) } catch(e) {}
        }
        const loadSegments = localStorage.getItem('crm_custom_segments')
        if (loadSegments) {
            try { setSavedSegments(JSON.parse(loadSegments)) } catch(e) {}
        }
    }, [])

    const saveConfig = (newConfig: any) => {
        setCrmConfig(newConfig)
        localStorage.setItem('foami_crm_config', JSON.stringify(newConfig))
    }

    // Load Data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            const [custRes, bookRes, svcRes, stfRes, znRes, brRes, addRes] = await Promise.all([
                supabase.from('customers').select('*').order('created_at', { ascending: false }),
                supabase.from('bookings').select(`
                    *, 
                    customers(*), 
                    staff(full_name),
                    services(name, price_s),
                    zones(name, branches(name))
                `).order('created_at', { ascending: false }),
                supabase.from('services').select('*'),
                supabase.from('staff').select('*'),
                supabase.from('zones').select('*'),
                supabase.from('branches').select('*'),
                supabase.from('service_addons').select('*')
            ])

            const customersData = custRes.data || []
            const rawBookings = bookRes.data || []
            const servicesData = svcRes.data || []
            const staffData = stfRes.data || []
            const zonesData = znRes.data || []
            const branchesData = brRes.data || []

            // Manual Client-Side Join (Fallback for Mock DB or loose relations)
            const enrichedBookings = rawBookings.map(b => {
                const enriched = { ...b }
                if (!enriched.customers && enriched.customer_id) {
                    enriched.customers = customersData.find(c => c.id === enriched.customer_id)
                }
                if (!enriched.services && enriched.service_id) {
                    enriched.services = servicesData.find(s => s.id === enriched.service_id)
                }
                if (!enriched.staff && enriched.staff_id) {
                    enriched.staff = staffData.find(s => s.id === enriched.staff_id)
                }
                if (!enriched.zones && enriched.zone_id) {
                    const zone = zonesData.find(z => z.id === enriched.zone_id)
                    if (zone) {
                        const branch = branchesData.find(br => br.id === zone.branch_id)
                        enriched.zones = { ...zone, branches: branch }
                    }
                }
                return enriched
            })

            setCustomers(customersData)
            setBookings(enrichedBookings)
            setBranches(branchesData)
            setServices(servicesData)
            setAddons(addRes.data || [])
            setLoading(false)
        }
        loadData()
    }, [])

    // Process Analytics
    const customerStats = customers.map(c => {
        const cBookings = bookings.filter((b: any) => b.customer_id === c.id && ['completed', 'paid', 'delivering', 'washing'].includes(b.status))
        const totalSpent = cBookings.reduce((sum: number, b: any) => sum + (b.total_price || 0), 0)
        const totalVisits = cBookings.length
        
        const allAddons = new Set<string>()
        const allServices = new Set<string>()
        let totalDiscount = 0
        let totalRating = 0
        let ratingCount = 0
        
        cBookings.forEach((b: any) => {
            if (Array.isArray(b.addon_ids)) {
                b.addon_ids.forEach((a: any) => {
                    if (typeof a === 'string') allAddons.add(a)
                    else if (a && a.name) allAddons.add(a.name)
                })
            }
            if (b.services?.name) allServices.add(b.services.name)
            if (b.discount_amount) totalDiscount += b.discount_amount
            if (b.rating) {
                totalRating += b.rating
                ratingCount++
            }
        })

        const sortedArrivals = [...cBookings].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const lastVisitDate = sortedArrivals.length > 0 ? sortedArrivals[0].created_at : null
        const lastBranchId = sortedArrivals.length > 0 ? (sortedArrivals[0].branch_id || sortedArrivals[0].zones?.branch_id) : null

        let daysSinceLast = 999
        if (lastVisitDate) {
            daysSinceLast = Math.floor((new Date().getTime() - new Date(lastVisitDate).getTime()) / (1000 * 3600 * 24))
        }

        const rfmParams = getRFMScore(daysSinceLast, totalVisits, totalSpent, crmConfig)
        const segment = segmentCustomer(rfmParams, crmConfig)

        const vehicleCount = (Array.isArray(c.saved_vehicles)) 
            ? c.saved_vehicles.length 
            : 0

        const birthMonth = c.birthdate ? new Date(c.birthdate).getMonth() + 1 : null

        return { 
            ...c, 
            totalSpent, 
            totalVisits,
            avgSpent: totalVisits > 0 ? totalSpent / totalVisits : 0,
            lastVisitDate, 
            daysSinceLast, 
            lastBranchId,
            hasDiscountUsage: totalDiscount > 0,
            totalSavings: totalDiscount,
            avgRating: ratingCount > 0 ? totalRating / ratingCount : null,
            birthMonth,
            rfm: rfmParams, 
            segment, 
            vehicleCount,
            addons: Array.from(allAddons),
            servicesUsed: Array.from(allServices)
        }
    })

    // Extract unique value lists for dynamic dropdowns
    const uniqueGenders = Array.from(new Set(customers.map(c => c.gender).filter(Boolean)))
    const uniqueOccupations = Array.from(new Set(customers.map(c => c.occupation).filter(Boolean)))
    const uniqueInterests = Array.from(new Set(customers.flatMap(c => c.interests || []).filter(Boolean)))
    const uniqueVehicleBrands = Array.from(new Set(customers.map(c => c.vehicle_brand).filter(Boolean)))

    const filteredStats = customerStats.filter(c =>
        c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm) ||
        c.license_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.occupation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (Array.isArray(c.interests) && c.interests.some((i: string) => i.toLowerCase().includes(searchTerm.toLowerCase())))
    )

    // Transaction Filtering
    const filteredTransactions = bookings.filter(b => {
        const matchBranch = txFilters.branchId === 'all' || b.branch_id === txFilters.branchId || b.zones?.branch_id === txFilters.branchId
        const matchStatus = txFilters.status === 'all' || b.status === txFilters.status
        const matchDate = (!txFilters.startDate || b.scheduled_date >= txFilters.startDate) && 
                          (!txFilters.endDate || b.scheduled_date <= txFilters.endDate)
        const s = txFilters.search.toLowerCase()
        const matchSearch = !s || 
                            b.id.toLowerCase().includes(s) || 
                            b.customers?.full_name?.toLowerCase().includes(s) || 
                            b.customers?.phone?.includes(s) ||
                            (b.vehicle_data?.license_plate || b.customers?.license_plate || '').toLowerCase().includes(s)
        
        return matchBranch && matchStatus && matchDate && matchSearch
    })

    // Calculate how many users fit the segment builder condition
    const evaluateSegmentMatch = (c: any) => {
        if (conditions.length === 0) return true 

        return conditions.every(cond => {
            const val = cond.value
            const target = c[cond.metric]
            
            // Boolean Handle
            if (['is_profile_complete', 'hasDiscountUsage'].includes(cond.metric)) {
                const targetBool = !!target
                const valBool = val === 'true'
                return cond.operator === '===' ? targetBool === valBool : targetBool !== valBool
            }

            if (target === undefined || target === null) {
                // For numeric/date nulls, fail unless specifically checking for null
                if (cond.operator === '!=' && val === '') return true
                return false
            }

            // Handle Array match (Interests / Addons / ServicesUsed)
            if (['interests', 'addons', 'servicesUsed'].includes(cond.metric) && Array.isArray(target)) {
                const isIncluded = target.some(a => String(a).toLowerCase() === String(val).toLowerCase())
                return cond.operator === '===' ? isIncluded : !isIncluded
            }

            // Handle categorical string comparisons
            if (['gender', 'vehicle_brand', 'vehicle_size', 'segment', 'occupation', 'lastBranchId'].includes(cond.metric)) {
                const isMatch = String(target).toLowerCase() === String(val).toLowerCase()
                return cond.operator === '===' ? isMatch : !isMatch
            }

            // Handle numeric comparisons
            const numVal = Number(val)
            const numTarget = Number(target)
            if (cond.operator === '>=') return numTarget >= numVal
            if (cond.operator === '<=') return numTarget <= numVal
            if (cond.operator === '===') return numTarget === numVal
            if (cond.operator === '!=') return numTarget !== numVal
            return false
        })
    }
    const matchedUsersCount = customerStats.filter(evaluateSegmentMatch).length

    // ─── ID Migration Logic ─────────────────────────────────────
    const runIdMigration = async () => {
        if (!confirm('ยืนยันระบบอัปเกรด Booking ID และ Customer ID ให้เป็นรูปแบบ Professional? \n(ระบบจะเปลี่ยน UUID เดิมทั้งหมด และเชื่อมความสัมพันธ์ให้ถูกต้อง)')) return
        
        setLoading(true)
        const idMap: Record<string, string> = {}
        
        // 1. Migrate Customers
        const { data: rawCustomers } = await supabase.from('customers').select('*')
        const migratedCustomers = (rawCustomers || []).map(c => {
            if (c.id.startsWith('CU-')) return c
            const newId = generateScalableId('CU')
            idMap[c.id] = newId
            return { ...c, id: newId }
        })

        // 2. Migrate Bookings
        const { data: rawBookings } = await supabase.from('bookings').select('*')
        const migratedBookings = (rawBookings || []).map(b => {
            const oldBookingId = b.id
            // Update Customer Reference
            if (idMap[b.customer_id]) {
                b.customer_id = idMap[b.customer_id]
            }

            // Update Booking ID itself if it's a UUID
            if (!b.id.startsWith('BK-')) {
                const now = new Date(b.created_at)
                const yy = now.getFullYear().toString().slice(-2)
                const mm = (now.getMonth() + 1).toString().padStart(2, '0')
                const dd = now.getDate().toString().padStart(2, '0')
                const random = Math.random().toString(36).substring(2, 8).toUpperCase()
                const newBookingId = `BK-${yy}${mm}${dd}-${random}`
                idMap[oldBookingId] = newBookingId
                b.id = newBookingId
            }
            return b
        })

        // 3. Migrate Job Photos
        const { data: rawPhotos } = await supabase.from('job_photos').select('*')
        const migratedPhotos = (rawPhotos || []).map(p => {
            if (idMap[p.booking_id]) {
                p.booking_id = idMap[p.booking_id]
            }
            return p
        })

        // Save back to Mock DB
        localStorage.setItem('foami_mock_db_customers', JSON.stringify(migratedCustomers))
        localStorage.setItem('foami_mock_db_bookings', JSON.stringify(migratedBookings))
        localStorage.setItem('foami_mock_db_job_photos', JSON.stringify(migratedPhotos))
        
        alert('อัปเกรด ID เสร็จสิ้น! ระบบทำการจดจำความสัมพันธ์ลูกค้าและการจองเดิมได้ครบถ้วน')
        window.location.reload()
    }

    if (loading) return (
        <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <div className="animate-fade" style={{ color: 'var(--text-muted)' }}>กำลังโหลดข้อมูล CRM...</div>
        </div>
    )

    return (
        <>
        <div className={`animate-fade ${styles.page}`}>
            <div className="page-header animate-fade">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Users size={28} color="var(--brand-dominant)" /> ลูกค้า & CRM
                    </h1>
                    <p className="page-subtitle">จัดการฐานข้อมูลลูกค้า วิเคราะห์พฤติกรรม และสร้างกลุ่มเป้าหมาย</p>
                </div>
                <button className="btn btn-sm btn-ghost" onClick={runIdMigration} style={{ opacity: 0.6, fontSize: '0.7rem', gap: 4 }}>
                    <Settings size={14} /> อัปเกรด ID ระบบ
                </button>
            </div>

            <div className={styles.tabs} style={{ background: 'var(--surface-2)', padding: 6, borderRadius: '20px' }}>
                <button 
                    className={`${styles.tabBtn} ${activeTab === 'profiles' ? styles.tabActive : ''}`} 
                    style={{ borderRadius: '14px', background: activeTab === 'profiles' ? 'var(--brand-dominant)' : 'transparent', color: activeTab === 'profiles' ? 'white' : 'var(--text-muted)' }}
                    onClick={() => setActiveTab('profiles')}
                >
                    <User size={18} style={{ marginRight: 8, display: 'inline' }} /> โปรไฟล์ลูกค้า
                </button>
                <button 
                    className={`${styles.tabBtn} ${activeTab === 'transactions' ? styles.tabActive : ''}`} 
                    style={{ borderRadius: '14px', background: activeTab === 'transactions' ? 'var(--brand-dominant)' : 'transparent', color: activeTab === 'transactions' ? 'white' : 'var(--text-muted)' }}
                    onClick={() => setActiveTab('transactions')}
                >
                    <ClipboardList size={18} style={{ marginRight: 8, display: 'inline' }} /> ประวัติธุรกรรม
                </button>
                <button 
                    className={`${styles.tabBtn} ${activeTab === 'analytics' ? styles.tabActive : ''}`} 
                    style={{ borderRadius: '14px', background: activeTab === 'analytics' ? 'var(--brand-dominant)' : 'transparent', color: activeTab === 'analytics' ? 'white' : 'var(--text-muted)' }}
                    onClick={() => setActiveTab('analytics')}
                >
                    <ShieldCheck size={18} style={{ marginRight: 8, display: 'inline' }} /> วิเคราะห์พฤติกรรม (RFM)
                </button>
                <button 
                    className={`${styles.tabBtn} ${activeTab === 'segments' ? styles.tabActive : ''}`} 
                    style={{ borderRadius: '14px', background: activeTab === 'segments' ? 'var(--brand-dominant)' : 'transparent', color: activeTab === 'segments' ? 'white' : 'var(--text-muted)' }}
                    onClick={() => setActiveTab('segments')}
                >
                    <Target size={18} style={{ marginRight: 8, display: 'inline' }} /> เครื่องมือสร้าง Segments
                </button>
            </div>

            {/* TAB 1: PROFILES */}
            {activeTab === 'profiles' && (
                <div className={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ background: 'var(--primary-ghost)', color: 'var(--primary)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={24} />
                            </div>
                            <div>
                                <h2 className={styles.tableTitle} style={{ margin: 0 }}>ฐานข้อมูลลูกค้า (Profiles)</h2>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>รวมข้อมูลพื้นฐาน พฤติกรรม และความสนใจของลูกค้ารายบุคคล</p>
                            </div>
                        </div>
                        <div style={{ position: 'relative', width: 280 }}>
                            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input className="form-input" style={{ width: '100%', paddingLeft: 36 }} placeholder="ค้นหาชื่อ, เบอร์, ทะเบียน..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>

                    <div className={styles.tableContainer}>
                        <table>
                            <thead>
                                <tr>
                                    <th>รหัสลูกค้า</th>
                                    <th>ชื่อลูกค้า</th>
                                    <th>เบอร์โทร</th>
                                    <th>วันเกิด</th>
                                    <th>เพศ</th>
                                    <th>อาชีพ</th>
                                    <th>วันที่สมัคร</th>
                                    <th>รถ/ที่อยู่</th>
                                    <th>ความสนใจ</th>
                                    <th>ล้าง</th>
                                    <th>สะสม</th>
                                    <th>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStats.map(c => (
                                    <tr key={c.id}>
                                        <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.id}</td>
                                        <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                                        <td>{c.phone}</td>
                                        <td>{c.birthdate ? new Date(c.birthdate).toLocaleDateString('th-TH') : '-'}</td>
                                        <td>{c.gender === 'male' ? 'ชาย' : c.gender === 'female' ? 'หญิง' : c.gender || '-'}</td>
                                        <td style={{ fontSize: '0.85rem' }}>{c.occupation || '-'}</td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {c.created_at ? new Date(c.created_at).toLocaleDateString('th-TH') : '-'}
                                        </td>
                                        <td style={{ fontSize: '0.85rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <span style={{ color: 'var(--brand-dominant)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Car size={12} /> {c.vehicleCount} คัน
                                                </span>
                                                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <MapPin size={12} /> {Array.isArray(c.saved_locations) ? c.saved_locations.length : 0} แห่ง
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 150 }}>
                                                {Array.isArray(c.interests) && c.interests.map((i: string) => (
                                                    <span key={i} style={{ fontSize: '0.6rem', padding: '2px 4px', background: 'var(--primary-ghost)', color: 'var(--primary)', borderRadius: 4 }}>{i.split(' ')[1] || i}</span>
                                                ))}
                                                {(!c.interests || c.interests.length === 0) && '-'}
                                            </div>
                                        </td>
                                        <td>{c.totalVisits}</td>
                                        <td>{c.totalSpent.toLocaleString()}</td>
                                        <td>
                                            <button 
                                                className="btn btn-sm btn-ghost" 
                                                style={{ borderRadius: '10px' }}
                                                title="ดูรายละเอียดแบบเต็ม"
                                                onClick={() => setSelectedCustomer(c)}
                                            ><Edit3 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredStats.length === 0 && (
                                    <tr>
                                        <td colSpan={12}>
                                            <div className="empty-state" style={{ padding: 'var(--space-12)' }}>
                                                <div style={{ background: 'var(--surface-2)', width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--text-muted)' }}>
                                                    <Users size={32} />
                                                </div>
                                                <p className="empty-state-title" style={{ fontWeight: 800 }}>ยังไม่มีข้อมูลลูกค้า</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: TRANSACTIONS */}
            {activeTab === 'transactions' && (
                <div className={styles.card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <div style={{ background: 'var(--primary-ghost)', color: 'var(--primary)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ClipboardList size={24} />
                        </div>
                        <div>
                            <h2 className={styles.tableTitle} style={{ margin: 0 }}>ประวัติธุรกรรมทั้งหมด (All Transactions)</h2>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>รายการจองและการชำระเงินย้อนหลังของลูกค้าทุกคน</p>
                        </div>
                    </div>
                    
                    {/* Transaction Filters */}
                    <div className={styles.txFilterBar}>
                        <div className={styles.filterItem}>
                            <label className={styles.filterLabel}>สาขา</label>
                            <select 
                                className="form-input" 
                                style={{ width: 140 }}
                                value={txFilters.branchId} 
                                onChange={e => setTxFilters({ ...txFilters, branchId: e.target.value })}
                            >
                                <option value="all">ทั้งหมด</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div className={styles.filterItem}>
                            <label className={styles.filterLabel}>สถานะงาน</label>
                            <select 
                                className="form-input" 
                                style={{ width: 130 }}
                                value={txFilters.status} 
                                onChange={e => setTxFilters({ ...txFilters, status: e.target.value })}
                            >
                                <option value="all">ทั้งหมด</option>
                                {Object.entries(BOOKING_STATUS_LABEL).map(([val, label]) => (
                                    <option key={val} value={val}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.filterItem}>
                            <label className={styles.filterLabel}>เริ่มวันที่</label>
                            <input 
                                type="date" 
                                className="form-input" 
                                value={txFilters.startDate} 
                                onChange={e => setTxFilters({ ...txFilters, startDate: e.target.value })} 
                            />
                        </div>
                        <div className={styles.filterItem}>
                            <label className={styles.filterLabel}>ถึงวันที่</label>
                            <input 
                                type="date" 
                                className="form-input" 
                                value={txFilters.endDate} 
                                onChange={e => setTxFilters({ ...txFilters, endDate: e.target.value })} 
                            />
                        </div>
                        <div className={styles.filterItem} style={{ flex: 1 }}>
                            <label className={styles.filterLabel}>ค้นหา (ชื่อ/เบอร์/ทะเบียน/ID)</label>
                            <input 
                                className="form-input" 
                                placeholder="🔍 คีย์เวิร์ด..." 
                                value={txFilters.search} 
                                onChange={e => setTxFilters({ ...txFilters, search: e.target.value })} 
                            />
                        </div>
                        <button 
                            className="btn btn-ghost btn-sm"
                            onClick={() => setTxFilters({ branchId: 'all', status: 'all', startDate: '', endDate: '', search: '' })}
                        >ล้างค่า</button>
                    </div>

                    <div className={styles.tableContainer}>
                        <table>
                                    <thead>
                                        {/* Category Grouping Row */}
                                        <tr>
                                            <th colSpan={3} className={styles.bgGroupCustomer} style={{ textAlign: 'center', borderBottom: 'none' }}>ข้อมูลลูกค้า</th>
                                            <th colSpan={3} className={styles.bgGroupVehicle} style={{ textAlign: 'center', borderBottom: 'none' }}>ข้อมูลรถ</th>
                                            <th colSpan={4} className={styles.bgGroupDetail} style={{ textAlign: 'center', borderBottom: 'none' }}>รายละเอียดงาน</th>
                                            <th colSpan={6} className={styles.bgGroupPricing} style={{ textAlign: 'center', borderBottom: 'none' }}>การเงิน & ส่วนลด</th>
                                            <th colSpan={3} className={styles.bgGroupStatus} style={{ textAlign: 'center', borderBottom: 'none' }}>สถานะ & รีวิว</th>
                                            <th colSpan={2} style={{ textAlign: 'center', borderBottom: 'none' }}>รับ/ส่ง</th>
                                        </tr>
                                        <tr>
                                            {/* Customer */}
                                            <th className={styles.bgGroupCustomer}>Timestamp</th>
                                            <th className={styles.bgGroupCustomer}>Booking ID</th>
                                            <th className={styles.bgGroupCustomer}>ชื่อลูกค้า / เบอร์</th>

                                            {/* Vehicle */}
                                            <th className={styles.bgGroupVehicle}>ยี่ห้อ / รุ่น</th>
                                            <th className={styles.bgGroupVehicle}>ทะเบียน</th>
                                            <th className={styles.bgGroupVehicle}>สีรถ</th>

                                            {/* Details */}
                                            <th className={styles.bgGroupDetail}>วันที่นัด</th>
                                            <th className={styles.bgGroupDetail}>เวลา</th>
                                            <th className={styles.bgGroupDetail}>สาขา / โซน</th>
                                            <th className={styles.bgGroupDetail}>แพ็กเกจ / เสริม</th>

                                            {/* Pricing */}
                                            <th className={styles.bgGroupPricing}>แพ็กเกจ</th>
                                            <th className={styles.bgGroupPricing}>ส่วนต่าง CC</th>
                                            <th className={styles.bgGroupPricing}>นอกโซน</th>
                                            <th className={styles.bgGroupPricing}>เพิ่มเติม</th>
                                            <th className={styles.bgGroupPricing}>ส่วนลด</th>
                                            <th className={styles.bgGroupPricing}>ยอดรวม</th>

                                            {/* Status */}
                                            <th className={styles.bgGroupStatus}>ชำระเงิน</th>
                                            <th className={styles.bgGroupStatus}>สถานะงาน</th>
                                            <th className={styles.bgGroupStatus}>รีวิว</th>

                                            {/* Location */}
                                            <th>รับรถ</th>
                                            <th>ส่งรถ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions.map(b => {
                                            const vData = b.vehicle_data || b.customers || {}
                                            const zonesData = b.zones as any
                                            const branchName = zonesData?.branches?.name || branches.find(br => br.id === b.branch_id)?.name || 'ไม่ระบุ'
                                            const zoneName = b.extra_fee > 0 ? 'นอกโซน' : (zonesData?.name || '-')
                                            
                                            // Split Pricing Logic
                                            const rawBasePrice = b.services?.price_s || 0
                                            const ccAdj = Math.max(0, (b.base_price || 0) - rawBasePrice)

                                            // Parse Addons
                                            let addonListStr = 'ไม่มี'
                                            if (Array.isArray(b.addon_ids) && b.addon_ids.length > 0) {
                                                addonListStr = b.addon_ids.map((a: any) => typeof a === 'string' ? a : a.name).join(', ')
                                            }

                                            // Helper to extract building/detail name from full address
                                            const formatLocation = (addr: string) => {
                                                if (!addr) return '-'
                                                const parts = addr.split('(')
                                                let detail = parts[0].trim()
                                                if (!detail && addr.includes(')')) detail = addr.split(')')[1].trim().split(' ')[0]
                                                return detail || '-'
                                            }

                                            return (
                                                <tr key={b.id}>
                                                    {/* Customer */}
                                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(b.created_at).toLocaleString('th-TH')}</td>
                                                    <td style={{ fontWeight: 600, fontSize: '0.72rem', fontFamily: 'monospace' }}>{b.id}</td>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{b.customers?.full_name || 'ไม่ทราบชื่อ'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.customers?.phone || '-'}</div>
                                                    </td>
                                                    {/* Vehicle */}
                                                    <td style={{ fontWeight: 600 }}>{vData.vehicle_brand || '-'} {vData.vehicle_model || ''}</td>
                                                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{vData.license_plate || '-'}</td>
                                                    <td style={{ fontSize: '0.85rem' }}>{vData.vehicle_color || '-'}</td>
                                                    {/* Details */}
                                                    <td>{b.scheduled_date ? new Date(b.scheduled_date).toLocaleDateString('th-TH') : '-'}</td>
                                                    <td>{b.scheduled_time?.substring(0, 5) || '-'}</td>
                                                    <td>
                                                        <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{branchName}</div>
                                                        <div style={{ fontSize: '0.75rem', color: b.extra_fee > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{zoneName}</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ color: 'var(--primary)', fontWeight: 600 }}>{b.services?.name || '-'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={addonListStr}>
                                                            + {addonListStr}
                                                        </div>
                                                    </td>
                                                    {/* Pricing */}
                                                    <td>฿{rawBasePrice.toLocaleString()}</td>
                                                    <td style={{ color: ccAdj > 0 ? 'var(--danger)' : 'inherit' }}>฿{ccAdj.toLocaleString()}</td>
                                                    <td style={{ color: b.extra_fee > 0 ? 'var(--primary)' : 'inherit' }}>฿{b.extra_fee?.toLocaleString() || 0}</td>
                                                    <td style={{ color: 'var(--warning)' }}>
                                                        <div>
                                                            {b.slip_url ? (
                                                                <a href={b.slip_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }} title="กดเพื่อดูสลิป">
                                                                    ฿{b.additional_price?.toLocaleString() || 0} <FileText size={12} />
                                                                </a>
                                                            ) : (
                                                                <span style={{ fontWeight: 700 }}>฿{b.additional_price?.toLocaleString() || 0}</span>
                                                            )}
                                                        </div>
                                                        {b.additional_price_note && (
                                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic', maxWidth: 80 }}>
                                                                {b.additional_price_note}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ color: 'var(--danger)' }}>
                                                        {b.discount_amount ? `-฿${b.discount_amount.toLocaleString()}` : '฿0'}
                                                    </td>
                                                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>฿{b.total_price?.toLocaleString() || 0}</td>
                                                    {/* Status */}
                                                    <td>
                                                        <span className={`badge ${b.payment_status === 'paid' ? 'badge-completed' : 'badge-pending'}`}>
                                                            {b.payment_status === 'paid' ? 'จ่ายแล้ว' : 'รอชำระ'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${BOOKING_STATUS_CSS[b.status as BookingStatus] || ''}`}>
                                                            {BOOKING_STATUS_LABEL[b.status as BookingStatus] || b.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {b.rating ? (
                                                            <div style={{ fontWeight: 700, color: 'var(--warning)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                <Star size={12} fill="currentColor" /> {b.rating}
                                                            </div>
                                                        ) : '-'}
                                                    </td>
                                                    {/* Location */}
                                                    <td style={{ fontSize: '0.8rem' }} title={b.pickup_address}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <MapPin size={12} style={{ color: 'var(--brand-dominant)' }} /> {formatLocation(b.pickup_address)}
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem' }} title={b.delivery_address}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <Flag size={12} style={{ color: 'var(--brand-secondary)' }} /> {formatLocation(b.delivery_address)}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                {filteredTransactions.length === 0 && (
                                    <tr><td colSpan={21} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>ไม่พบข้อมูลธุรกรรมในช่วงเวลานี้</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: ANALYTICS (RFM) */}
            {activeTab === 'analytics' && (
                <div className={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ background: 'var(--primary-ghost)', color: 'var(--primary)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <BarChart3 size={24} />
                            </div>
                            <div>
                                <h2 className={styles.tableTitle} style={{ margin: 0 }}>วิเคราะห์พฤติกรรม (Behavior & RFM)</h2>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>สรุปสถิติลูกค้าตามพฤติกรรมและการจัดกลุ่ม (R+F+M)</p>
                            </div>
                        </div>
                        <button className="btn btn-sm btn-ghost" style={{ background: 'var(--surface-2)', borderRadius: '10px', gap: 8 }} onClick={() => setShowLegend(true)}>
                            <Info size={16} /> ดูความหมายแท็ก
                        </button>
                    </div>


                    <div className={styles.tableContainer}>
                        <table>
                            <thead>
                                <tr>
                                    <th>ชื่อลูกค้า</th>
                                    <th>เวลาที่ผ่านไป (R)</th>
                                    <th>ความถี่ (F)</th>
                                    <th>ยอดรวม (M)</th>
                                    <th>Auto-Segment แท็ก</th>
                                </tr>
                            </thead>
                                <tbody>
                                    {customerStats.sort((a, b) => b.totalSpent - a.totalSpent).map(c => (
                                        <tr key={c.id}>
                                            <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                                            <td>
                                                {c.lastVisitDate ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ color: c.daysSinceLast > 30 ? 'var(--danger)' : 'var(--success)' }}>
                                                            {c.daysSinceLast} วัน
                                                        </span>
                                                        {c.daysSinceLast > 30 && <small style={{ color: 'var(--text-muted)' }}>(ควรติดตาม)</small>}
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td>{c.totalVisits} ครั้ง</td>
                                            <td style={{ color: 'var(--primary)', fontWeight: 700 }}>฿{c.totalSpent.toLocaleString()}</td>
                                            <td><span className={`${styles.tag} ${styles['tag-' + c.segment?.replace(/\s+/g, '-').replace(/[()]/g, '').toLowerCase()]}`}>{c.segment}</span></td>
                                        </tr>
                                    ))}
                                {customerStats.length === 0 && (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>ไม่พบข้อมูลลูกค้าสำหรับวิเคราะห์</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 4: SEGMENT BUILDER */}
            {activeTab === 'segments' && (
                <div className={styles.card} style={{ border: '2px solid var(--primary-ghost)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <div style={{ background: 'var(--primary-ghost)', color: 'var(--primary)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Target size={24} />
                        </div>
                        <div>
                            <h2 className={styles.tableTitle} style={{ margin: 0 }}>เครื่องมือสร้างกลุ่มเป้าหมาย (Segment Builder)</h2>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>กำหนดเงื่อนไขเพื่อดึงรายชื่อลูกค้าเป้าหมายสำหรับทำแคมเปญ</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                        {/* Builder Form */}
                        <div style={{ flex: '1 1 350px', background: 'var(--surface-2)', padding: 24, borderRadius: 12, border: '1px solid var(--border)' }}>
                            <div className="form-group">
                                <label style={{ fontWeight: 700, marginBottom: 8, display: 'block' }}>ตั้งชื่อ Segment นี้</label>
                                <input className="form-input" placeholder="เช่น ลูกค้าสาวก Honda, แคมเปญวันพ่อ..." value={segmentName} onChange={e => setSegmentName(e.target.value)} />
                            </div>

                            <div style={{ marginTop: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <h3 style={{ fontWeight: 800, fontSize: '0.9rem', margin: 0 }}>เงื่อนไข (Conditions)</h3>
                                    <button 
                                        className="btn btn-sm btn-primary" 
                                        style={{ height: 32, fontSize: '0.75rem', borderRadius: 8, gap: 4 }}
                                        onClick={() => setConditions([...conditions, { id: Date.now(), metric: 'totalVisits', operator: '>=', value: '1' }])}
                                    >
                                        <Plus size={14} /> เพิ่มเงื่อนไข
                                    </button>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {conditions.map((cond, idx) => (
                                        <div key={cond.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 32px', gap: 6, alignItems: 'center' }}>
                                            <select 
                                                className="form-input" 
                                                style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                                                value={cond.metric} 
                                                onChange={e => {
                                                    const newConds = [...conditions]
                                                    newConds[idx].metric = e.target.value
                                                    // Reset operator and value on metric change
                                                    const isNumeric = ['totalVisits', 'totalSpent', 'avgSpent', 'daysSinceLast', 'vehicleCount', 'totalSavings', 'avgRating', 'birthMonth'].includes(e.target.value)
                                                    
                                                    if (['is_profile_complete', 'hasDiscountUsage'].includes(e.target.value)) {
                                                        newConds[idx].operator = '==='
                                                        newConds[idx].value = 'true'
                                                    } else if (e.target.value === 'gender') {
                                                        newConds[idx].operator = '==='
                                                        newConds[idx].value = uniqueGenders[0] || ''
                                                    } else if (e.target.value === 'occupation') {
                                                        newConds[idx].operator = '==='
                                                        newConds[idx].value = uniqueOccupations[0] || ''
                                                    } else if (e.target.value === 'interests') {
                                                        newConds[idx].operator = '==='
                                                        newConds[idx].value = uniqueInterests[0] || ''
                                                    } else if (e.target.value === 'vehicle_brand') {
                                                        newConds[idx].operator = '==='
                                                        newConds[idx].value = uniqueVehicleBrands[0] || ''
                                                    } else if (e.target.value === 'servicesUsed') {
                                                        newConds[idx].operator = '==='
                                                        newConds[idx].value = services[0]?.name || ''
                                                    } else if (e.target.value === 'addons') {
                                                        newConds[idx].operator = '==='
                                                        newConds[idx].value = addons[0]?.name || ''
                                                    } else if (e.target.value === 'lastBranchId') {
                                                        newConds[idx].operator = '==='
                                                        newConds[idx].value = branches[0]?.id || ''
                                                    } else if (e.target.value === 'segment') {
                                                        newConds[idx].operator = '==='
                                                        newConds[idx].value = 'VIP'
                                                    } else if (e.target.value === 'vehicle_size') {
                                                        newConds[idx].operator = '==='
                                                        newConds[idx].value = 'S'
                                                    } else if (isNumeric) {
                                                        newConds[idx].operator = '>='
                                                        newConds[idx].value = '0'
                                                    } else {
                                                        newConds[idx].operator = '==='
                                                        newConds[idx].value = ''
                                                    }
                                                    setConditions(newConds)
                                                }}
                                            >
                                                <optgroup label="ข้อมูลโปรไฟล์">
                                                    <option value="is_profile_complete">กรอกข้อมูลครบ (Boolean)</option>
                                                    <option value="gender">เพศ</option>
                                                    <option value="occupation">อาชีพ</option>
                                                    <option value="birthMonth">เดือนเกิด (1-12)</option>
                                                    <option value="interests">สิ่งที่สนใจ (Array)</option>
                                                </optgroup>
                                                <optgroup label="ข้อมูลรถ">
                                                    <option value="vehicle_size">ขนาดรถ (SML)</option>
                                                    <option value="vehicle_brand">ยี่ห้อรถ</option>
                                                    <option value="vehicleCount">จำนวนรถที่บันทึก</option>
                                                </optgroup>
                                                <optgroup label="พฤติกรรม (RFM)">
                                                    <option value="totalVisits">จำนวนครั้งที่ล้าง</option>
                                                    <option value="totalSpent">ยอดรวมที่จ่าย</option>
                                                    <option value="avgSpent">ยอดใช้จ่ายเฉลี่ย/ครั้ง</option>
                                                    <option value="daysSinceLast">หายไป (วัน)</option>
                                                    <option value="segment">กลุ่ม RFM (แท็ก)</option>
                                                </optgroup>
                                                <optgroup label="การมีส่วนร่วม & ประวัติ">
                                                    <option value="lastBranchId">สาขาล่าสุดที่ใช้</option>
                                                    <option value="hasDiscountUsage">เคยใช้ส่วนลด (Boolean)</option>
                                                    <option value="totalSavings">ยอดที่ประหยัดไปได้</option>
                                                    <option value="avgRating">คะแนนรีวิวเฉลี่ย</option>
                                                    <option value="servicesUsed">แพ็กเกจที่เคยใช้ (Array)</option>
                                                    <option value="addons">บริการเสริมที่เคยใช้ (Array)</option>
                                                </optgroup>
                                            </select>

                                            {['is_profile_complete', 'hasDiscountUsage', 'gender', 'occupation', 'interests', 'vehicle_brand', 'servicesUsed', 'addons', 'vehicle_size', 'lastBranchId', 'segment'].includes(cond.metric) ? (
                                                <select 
                                                    className="form-input"
                                                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                                                    value={cond.operator}
                                                    onChange={e => {
                                                        const newConds = [...conditions]
                                                        newConds[idx].operator = e.target.value
                                                        setConditions(newConds)
                                                    }}
                                                >
                                                    <option value="===">=</option>
                                                    <option value="!=">!=</option>
                                                </select>
                                            ) : (
                                                <select 
                                                    className="form-input"
                                                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                                                    value={cond.operator} 
                                                    onChange={e => {
                                                        const newConds = [...conditions]
                                                        newConds[idx].operator = e.target.value
                                                        setConditions(newConds)
                                                    }}
                                                >
                                                    <option value=">=">&ge;</option>
                                                    <option value="<=">&le;</option>
                                                    <option value="===">=</option>
                                                    <option value="!=">!=</option>
                                                </select>
                                            )}

                                            {['is_profile_complete', 'hasDiscountUsage'].includes(cond.metric) ? (
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                    {cond.operator === '===' ? (cond.metric === 'is_profile_complete' ? 'กรอกข้อมูลครบ' : 'เคยใช้') : (cond.metric === 'is_profile_complete' ? 'ไม่ครบ' : 'ไม่เคยใช้')}
                                                </div>
                                            ) : cond.metric === 'vehicle_size' ? (
                                                <select 
                                                    className="form-input"
                                                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                                                    value={cond.value}
                                                    onChange={e => {
                                                        const newConds = [...conditions]
                                                        newConds[idx].value = e.target.value
                                                        setConditions(newConds)
                                                    }}
                                                >
                                                    {['S', 'M', 'L'].map(v => (
                                                        <option key={v} value={v}>{v} ({VEHICLE_SIZE_LABEL[v]})</option>
                                                    ))}
                                                </select>
                                            ) : cond.metric === 'lastBranchId' ? (
                                                <select 
                                                    className="form-input"
                                                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                                                    value={cond.value}
                                                    onChange={e => {
                                                        const newConds = [...conditions]
                                                        newConds[idx].value = e.target.value
                                                        setConditions(newConds)
                                                    }}
                                                >
                                                    {branches.map(br => (
                                                        <option key={br.id} value={br.id}>{br.name}</option>
                                                    ))}
                                                </select>
                                            ) : cond.metric === 'segment' ? (
                                                <select 
                                                    className="form-input"
                                                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                                                    value={cond.value}
                                                    onChange={e => {
                                                        const newConds = [...conditions]
                                                        newConds[idx].value = e.target.value
                                                        setConditions(newConds)
                                                    }}
                                                >
                                                    {['VIP', 'Loyal', 'Churn Risk', 'Lost Customer', 'New', 'Big Ticket (Rare)', 'Promising', 'Inactive', 'Regular'].map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                            ) : cond.metric === 'gender' ? (
                                                <select 
                                                    className="form-input"
                                                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                                                    value={cond.value}
                                                    onChange={e => {
                                                        const newConds = [...conditions]
                                                        newConds[idx].value = e.target.value
                                                        setConditions(newConds)
                                                    }}
                                                >
                                                    {uniqueGenders.map(g => (
                                                        <option key={g} value={g}>{g}</option>
                                                    ))}
                                                </select>
                                            ) : cond.metric === 'occupation' ? (
                                                <select 
                                                    className="form-input"
                                                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                                                    value={cond.value}
                                                    onChange={e => {
                                                        const newConds = [...conditions]
                                                        newConds[idx].value = e.target.value
                                                        setConditions(newConds)
                                                    }}
                                                >
                                                    {uniqueOccupations.map(o => (
                                                        <option key={o} value={o}>{o}</option>
                                                    ))}
                                                </select>
                                            ) : cond.metric === 'interests' ? (
                                                <select 
                                                    className="form-input"
                                                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                                                    value={cond.value}
                                                    onChange={e => {
                                                        const newConds = [...conditions]
                                                        newConds[idx].value = e.target.value
                                                        setConditions(newConds)
                                                    }}
                                                >
                                                    {uniqueInterests.map(i => (
                                                        <option key={i} value={i}>{i}</option>
                                                    ))}
                                                </select>
                                            ) : cond.metric === 'vehicle_brand' ? (
                                                <select 
                                                    className="form-input"
                                                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                                                    value={cond.value}
                                                    onChange={e => {
                                                        const newConds = [...conditions]
                                                        newConds[idx].value = e.target.value
                                                        setConditions(newConds)
                                                    }}
                                                >
                                                    {uniqueVehicleBrands.map(v => (
                                                        <option key={v} value={v}>{v}</option>
                                                    ))}
                                                </select>
                                            ) : cond.metric === 'addons' ? (
                                                <select 
                                                    className="form-input"
                                                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                                                    value={cond.value}
                                                    onChange={e => {
                                                        const newConds = [...conditions]
                                                        newConds[idx].value = e.target.value
                                                        setConditions(newConds)
                                                    }}
                                                >
                                                    {addons.map(a => (
                                                        <option key={a.id} value={a.name}>{a.name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input 
                                                    className="form-input"
                                                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                                                    placeholder={['interests', 'vehicle_brand'].includes(cond.metric) ? "ระบุชื่อ..." : "ตัวเลข..."}
                                                    value={cond.value} 
                                                    onChange={e => {
                                                        const newConds = [...conditions]
                                                        newConds[idx].value = e.target.value
                                                        setConditions(newConds)
                                                    }} 
                                                />
                                            )}
                                            
                                            <button 
                                                className="btn btn-sm btn-ghost" 
                                                style={{ color: 'var(--danger)', padding: 0, width: 32, height: 32, borderRadius: 8 }}
                                                onClick={() => setConditions(conditions.filter(c => c.id !== cond.id))}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {conditions.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '12px', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            ยังไม่มีเงื่อนไข (คลิกปุ่มเพื่อเพิ่ม)
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    className="btn btn-primary"
                                    style={{ flex: 1, marginTop: 24, opacity: segmentName && conditions.length > 0 ? 1 : 0.5 }}
                                    onClick={() => {
                                        if (!segmentName || conditions.length === 0) return;
                                        
                                        const newSegment = {
                                            id: editingSegmentId || 'seg_' + Date.now(),
                                            name: segmentName,
                                            conditions: conditions
                                        };

                                        let updated: any[] = [];
                                        if (editingSegmentId) {
                                            updated = savedSegments.map(s => s.id === editingSegmentId ? newSegment : s);
                                        } else {
                                            updated = [...savedSegments, newSegment];
                                        }
                                        
                                        localStorage.setItem('crm_custom_segments', JSON.stringify(updated));
                                        setSavedSegments(updated);
                                        
                                        // [AUDIT Phase 17/18] Track Segment Action
                                        trackAuditLog({
                                            action_type: editingSegmentId ? 'UPDATE' : 'CREATE',
                                            entity_type: 'service', // Using service as generic or custom if needed
                                            entity_id: newSegment.id,
                                            old_data: editingSegmentId ? savedSegments.find(s => s.id === editingSegmentId) : null,
                                            new_data: newSegment,
                                            description: `${editingSegmentId ? 'แก้ไข' : 'สร้าง'} Segment: ${segmentName}`
                                        });

                                        alert(`บันทึก Segment "${segmentName}" สำเร็จแล้ว!`);
                                        setSegmentName('');
                                        setConditions([{ id: Date.now(), metric: 'totalVisits', operator: '>=', value: '5' }]);
                                        setEditingSegmentId(null);
                                    }}
                                >
                                    {editingSegmentId ? '💾 บันทึกการแก้ไข' : '➕ สร้าง Segment ใหม่'}
                                </button>
                                {editingSegmentId && (
                                    <button 
                                        className="btn btn-outline" 
                                        style={{ marginTop: 24 }}
                                        onClick={() => {
                                            setEditingSegmentId(null);
                                            setSegmentName('');
                                            setConditions([{ id: Date.now(), metric: 'totalVisits', operator: '>=', value: '5' }]);
                                        }}
                                    >ยกเลิก</button>
                                )}
                            </div>
                        </div>

                        {/* List & Live Preview */}
                        <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {/* List of Saved Segments */}
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <ClipboardList size={18} color="var(--primary)" /> รายการที่บันทึกไว้ ({savedSegments.length})
                                </h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                    {savedSegments.map(seg => (
                                        <div key={seg.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '10px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-sm)' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{seg.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{seg.conditions.length} เงื่อนไข · {customerStats.filter(c => {
                                                    // Quick match for list count
                                                    return seg.conditions.every((cond: any) => {
                                                        const target = c[cond.metric]
                                                        if (target === undefined) return false
                                                        if (cond.metric === 'is_profile_complete') return !!target === (cond.value === 'true')
                                                        if (['interests', 'addons'].includes(cond.metric)) return Array.isArray(target) && target.some(a => String(a).toLowerCase().includes(String(cond.value).toLowerCase()))
                                                        if (cond.operator === '>=') return Number(target) >= Number(cond.value)
                                                        if (cond.operator === '<=') return Number(target) <= Number(cond.value)
                                                        return String(target).toLowerCase().includes(String(cond.value).toLowerCase())
                                                    })
                                                }).length} คน</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn btn-xs btn-ghost" style={{ borderRadius: 6 }} onClick={() => {
                                                    setEditingSegmentId(seg.id);
                                                    setSegmentName(seg.name);
                                                    setConditions(seg.conditions);
                                                }}><Edit3 size={14} /></button>
                                                <button className="btn btn-xs btn-ghost" style={{ color: 'var(--danger)', borderRadius: 6 }} onClick={() => {
                                                    if (confirm(`ยืนยันลบ Segment "${seg.name}"?`)) {
                                                        // [FIX] Use functional update for state safety
                                                        setSavedSegments(prev => {
                                                            const updated = prev.filter(s => s.id !== seg.id);
                                                            localStorage.setItem('crm_custom_segments', JSON.stringify(updated));
                                                            return updated;
                                                        });

                                                        // [AUDIT Phase 17/18] Track Delete Segment
                                                        trackAuditLog({
                                                            action_type: 'DELETE',
                                                            entity_type: 'service',
                                                            entity_id: seg.id,
                                                            old_data: seg,
                                                            description: `ลบ Segment: ${seg.name}`
                                                        });
                                                    }
                                                }}><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {savedSegments.length === 0 && (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>ยังไม่มี Segment ที่บันทึกไว้</div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <CheckCircle size={18} color="var(--success)" /> ตัวอย่างลูกค้าที่เข้าเงื่อนไขปัจจุบัน ({matchedUsersCount} คน)
                                </h3>
                                <div className={styles.tableContainer} style={{ maxHeight: 300, overflowY: 'auto' }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th style={{ width: 140 }}>ชื่อ</th>
                                                {conditions.map((cond, idx) => (
                                                    <th key={cond.id} style={{ fontSize: '0.75rem' }}>
                                                        {idx + 1}. {(cond.metric.charAt(0).toUpperCase() + cond.metric.slice(1)).replace(/([A-Z])/g, ' $1')}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {customerStats.filter(evaluateSegmentMatch).slice(0, 10).map(c => (
                                                <tr key={c.id}>
                                                    <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                                                    {conditions.map(cond => (
                                                        <td key={cond.id} style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem' }}>
                                                            {cond.metric === 'totalSpent' || cond.metric === 'avgSpent' || cond.metric === 'totalSavings' ? '฿' : ''}
                                                            {cond.metric === 'is_profile_complete' ? (c.is_profile_complete ? '✅ ครบ' : '❌ ไม่ครบ') : 
                                                             cond.metric === 'vehicle_size' ? (VEHICLE_SIZE_LABEL[c.vehicle_size] || c.vehicle_size) :
                                                             cond.metric === 'lastBranchId' ? (branches.find(b => b.id === c.lastBranchId)?.name || 'N/A') :
                                                             cond.metric === 'segment' ? c.segment :
                                                             cond.metric === 'hasDiscountUsage' ? (c.hasDiscountUsage ? 'เคยใช้' : 'ไม่เคย') :
                                                             ['interests', 'addons', 'servicesUsed'].includes(cond.metric) ? (Array.isArray(c[cond.metric]) ? c[cond.metric].join(', ') : '-') :
                                                             String(c[cond.metric] ?? '-')}
                                                            {cond.metric === 'totalVisits' || cond.metric === 'vehicleCount' ? ' ครั้ง' : 
                                                             cond.metric === 'daysSinceLast' ? ' วัน' : ''}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                            {matchedUsersCount > 10 && (
                                                <tr><td colSpan={conditions.length + 1} style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>และอีก {matchedUsersCount - 10} คน...</td></tr>
                                            )}
                                            {matchedUsersCount === 0 && (
                                                <tr><td colSpan={conditions.length + 1} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>ไม่มีลูกค้าตรงตามเงื่อนไขนี้</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {showLegend && (
            <div className={styles.fullscreenOverlay} onClick={() => setShowLegend(false)}>
                <div className={styles.fullscreenModal} onClick={e => e.stopPropagation()}>
                    <div className={styles.modalHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ background: 'var(--brand-dominant)', color: 'white', width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Settings size={32} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--brand-dominant)', margin: 0 }}>ตั้งค่าเกณฑ์แบ่งกลุ่ม (CRM Config)</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>ปรับจูนเกณฑ์การให้คะแนนและตรรกะการจัดกลุ่มลูกค้า</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn btn-outline" onClick={() => {
                                if (confirm('ยืนยันการรีเซ็ตเป็นค่าเริ่มต้น?')) {
                                    saveConfig(DEFAULT_CRM_CONFIG);
                                }
                            }}>🔄 รีเซ็ตเป็นค่าเริ่มต้น</button>
                            <button className="btn btn-primary" style={{ padding: '12px 32px' }} onClick={() => setShowLegend(false)}>บันทึกและปิดหน้าต่างนี้</button>
                        </div>
                    </div>

                    <div className={styles.modalBody}>
                        {/* Column 1: RFM Scoring */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                                <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-ghost)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>1</span>
                                เกณฑ์คะแนน (RFM Thresholds)
                            </h3>
                            
                            <div className={styles.configGroup}>
                                <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16 }}>Recency (R) - วันที่หายไปไม่เกิน...</p>
                                <div className={styles.configGrid}>
                                    {['r5', 'r4', 'r3', 'r2'].map((key, i) => (
                                        <div key={key} className={styles.thresholdCard}>
                                            <span className={styles.thresholdLabel}>คะแนน {5-i} {5-i === 5 ? '🎯' : ''}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <input type="number" className={styles.thresholdInput} value={(crmConfig.recency as any)[key]} onChange={e => {
                                                    const newCfg = { ...crmConfig };
                                                    (newCfg.recency as any)[key] = Number(e.target.value);
                                                    saveConfig(newCfg);
                                                }} />
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>วัน</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.configGroup}>
                                <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16 }}>Frequency (F) - จำนวนครั้งขึ้นไป...</p>
                                <div className={styles.configGrid}>
                                    {['f5', 'f4', 'f3', 'f2'].map((key, i) => (
                                        <div key={key} className={styles.thresholdCard}>
                                            <span className={styles.thresholdLabel}>คะแนน {5-i}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <input type="number" className={styles.thresholdInput} value={(crmConfig.frequency as any)[key]} onChange={e => {
                                                    const newCfg = { ...crmConfig };
                                                    (newCfg.frequency as any)[key] = Number(e.target.value);
                                                    saveConfig(newCfg);
                                                }} />
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>ครั้ง</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.configGroup}>
                                <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16 }}>Monetary (M) - ยอดรวมสะสมขึ้นไป...</p>
                                <div className={styles.configGrid}>
                                    {['m5', 'm4', 'm3', 'm2'].map((key, i) => (
                                        <div key={key} className={styles.thresholdCard}>
                                            <span className={styles.thresholdLabel}>คะแนน {5-i}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ fontSize: '1rem', color: 'var(--primary)', fontWeight: 700 }}>฿</span>
                                                <input type="number" className={styles.thresholdInput} value={(crmConfig.monetary as any)[key]} onChange={e => {
                                                    const newCfg = { ...crmConfig };
                                                    (newCfg.monetary as any)[key] = Number(e.target.value);
                                                    saveConfig(newCfg);
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Column 2: Segment Logic */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                                <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-ghost)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>2</span>
                                ตรรกะการแบ่งกลุ่ม (Segment Logic)
                            </h3>
                            
                            <div className={styles.segmentConfigCard}>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>ระบุคะแนนคะแนนเฉลี่ยหรือคะแนนขั้นต่ำ (1-5) เพื่อจัดกลุ่มลูกค้า</p>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {[
                                        { id: 'vip', label: 'VIP', keys: ['f', 'm', 'r'], desc: 'คะแนน F, M, R ต้องมากกว่าหรือเท่ากับค่าที่ตั้ง' },
                                        { id: 'loyal', label: 'Loyal', keys: ['f', 'r'], desc: 'เน้นความถี่และความสม่ำเสมอ' },
                                        { id: 'churnRisk', label: 'Churn Risk', keys: ['f', 'r'], desc: 'มาบ่อย (F) แต่ล่าสุด (R) คะแนนต่ำกว่า/เท่ากับที่ตั้ง' },
                                        { id: 'lost', label: 'Lost', keys: ['f', 'r'], desc: 'เคยบ่อย (F) แต่ล่าสุด (R) คะแนนต่ำสุด' },
                                        { id: 'new', label: 'New', keys: ['r', 'f'], desc: 'มาล่าสุด (R) แต่ความถี่ (F) ยังน้อย' },
                                        { id: 'bigSpender', label: 'Big Ticket', keys: ['m', 'f'], desc: 'ยอดจ่าย (M) สูง แต่ความถี่ (F) น้อย' },
                                    ].map(seg => (
                                        <div key={seg.id} className={styles.configGroup} style={{ marginBottom: 0, padding: 20 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                                <span className={`${styles.tag} ${styles['tag-' + (seg.id === 'bigSpender' ? 'big-ticket-rare' : seg.id.toLowerCase())]}`} style={{ margin: 0, fontSize: '0.8rem', padding: '6px 12px' }}>{seg.label}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{seg.desc}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 12 }}>
                                                {seg.keys.map(k => (
                                                    <div key={k} className={styles.thresholdCard} style={{ flex: 1, padding: 10 }}>
                                                        <span className={styles.thresholdLabel}>{k.toUpperCase()} {k === 'r' && seg.id === 'churnRisk' ? 'Max' : 'Min'}</span>
                                                        <input type="number" className={styles.thresholdInput} style={{ fontSize: '1.1rem' }} value={(crmConfig.segments as any)[seg.id][k]} onChange={e => {
                                                            const newCfg = { ...crmConfig };
                                                            (newCfg.segments as any)[seg.id][k] = Number(e.target.value);
                                                            saveConfig(newCfg);
                                                        }} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    <div className={styles.configGroup} style={{ marginBottom: 0, padding: 20 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                            <span className={`${styles.tag} ${styles['tag-promising']}`} style={{ margin: 0, fontSize: '0.8rem', padding: '6px 12px' }}>Promising / Inactive</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>ใช้คะแนนเฉลี่ย (R+F+M)/3</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 12 }}>
                                            <div className={styles.thresholdCard} style={{ flex: 1, padding: 10 }}>
                                                <span className={styles.thresholdLabel}>Promising Avg Min</span>
                                                <input type="number" step="0.1" className={styles.thresholdInput} style={{ fontSize: '1.1rem' }} value={crmConfig.segments.promising} onChange={e => {
                                                    const newCfg = { ...crmConfig };
                                                    newCfg.segments.promising = Number(e.target.value);
                                                    saveConfig(newCfg);
                                                }} />
                                            </div>
                                            <div className={styles.thresholdCard} style={{ flex: 1, padding: 10 }}>
                                                <span className={styles.thresholdLabel}>Inactive Avg Max</span>
                                                <input type="number" step="0.1" className={styles.thresholdInput} style={{ fontSize: '1.1rem' }} value={crmConfig.segments.inactive} onChange={e => {
                                                    const newCfg = { ...crmConfig };
                                                    newCfg.segments.inactive = Number(e.target.value);
                                                    saveConfig(newCfg);
                                                }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
        {selectedCustomer && (
            <div className={styles.fullscreenOverlay} onClick={() => setSelectedCustomer(null)}>
                <div className={styles.fullscreenModal} style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
                    <div className={styles.modalHeader} style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ background: 'var(--brand-dominant)', color: 'white', width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={28} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-dominant)', margin: 0 }}>โปรไฟล์ลูกค้า</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>ข้อมูลเชิงลึกและรายละเอียดทรัพย์สิน</p>
                            </div>
                        </div>
                        <button className="btn btn-sm btn-ghost" style={{ background: 'var(--surface-2)', borderRadius: 10, width: 40, height: 40, padding: 0 }} onClick={() => setSelectedCustomer(null)}>✕</button>
                    </div>
                    
                    <div className={styles.modalBody} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                        {/* Column 1: Personal Info & Interests */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <section>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, borderBottom: '2px solid var(--primary-ghost)', paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <User size={18} color="var(--primary)" /> ข้อมูลส่วนตัว
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, fontSize: '0.9rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>ชื่อ-นามสกุล:</span> <span style={{ fontWeight: 600 }}>{selectedCustomer.full_name}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>เบอร์โทรศัพท์:</span> <span>{selectedCustomer.phone}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>วันเกิด:</span> <span>{selectedCustomer.birthdate ? new Date(selectedCustomer.birthdate).toLocaleDateString('th-TH') : '-'}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>เพศ:</span> <span>{selectedCustomer.gender === 'male' ? 'ชาย' : selectedCustomer.gender === 'female' ? 'หญิง' : selectedCustomer.gender || '-'}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>อาชีพ:</span> <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{selectedCustomer.occupation || '-'}</span>
                                </div>
                            </section>

                            <section>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, borderBottom: '2px solid var(--primary-ghost)', paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Sparkles size={18} color="var(--warning)" /> สิ่งที่สนใจ
                                </h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {Array.isArray(selectedCustomer.interests) && selectedCustomer.interests.map((i: string) => (
                                        <span key={i} style={{ fontSize: '0.8rem', padding: '4px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20 }}>{i}</span>
                                    ))}
                                    {(!selectedCustomer.interests || selectedCustomer.interests.length === 0) && <span style={{ color: 'var(--text-muted)' }}>ไม่ระบุ</span>}
                                </div>
                            </section>

                            <section>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, borderBottom: '2px solid var(--primary-ghost)', paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <BarChart3 size={18} color="var(--info)" /> สถิติล้างรถ
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className={styles.thresholdCard} style={{ padding: 12 }}>
                                        <div className={styles.thresholdLabel}>จำนวนครั้ง</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{selectedCustomer.totalVisits} ครั้ง</div>
                                    </div>
                                    <div className={styles.thresholdCard} style={{ padding: 12 }}>
                                        <div className={styles.thresholdLabel}>ยอดสะสม</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>฿{selectedCustomer.totalSpent.toLocaleString()}</div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Column 2: Vehicles & Locations */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <section>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, borderBottom: '2px solid var(--primary-ghost)', paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Car size={18} color="var(--primary)" /> ยานพาหนะที่บันทึกไว้ ({selectedCustomer.saved_vehicles?.length || 0})
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {Array.isArray(selectedCustomer.saved_vehicles) && selectedCustomer.saved_vehicles.map((v: any, idx: number) => (
                                        <div key={idx} style={{ padding: 10, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{v.license_plate} - {v.vehicle_brand} {v.vehicle_model}</div>
                                            <div style={{ color: 'var(--text-muted)' }}>สี: {v.vehicle_color} | ขนาด: {v.vehicle_size}</div>
                                        </div>
                                    ))}
                                    {(!selectedCustomer.saved_vehicles || selectedCustomer.saved_vehicles.length === 0) && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>ไม่มีข้อมูลรถ</div>}
                                </div>
                            </section>

                            <section>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, borderBottom: '2px solid var(--primary-ghost)', paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <MapPin size={18} color="var(--danger)" /> ที่อยู่ที่บันทึกไว้ ({selectedCustomer.saved_locations?.length || 0})
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {Array.isArray(selectedCustomer.saved_locations) && selectedCustomer.saved_locations.map((l: any, idx: number) => (
                                        <div key={idx} style={{ padding: 10, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{l.name}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{l.address}</div>
                                            {l.note && <div style={{ color: 'var(--warning)', fontSize: '0.75rem', marginTop: 4 }}>📝 {l.note}</div>}
                                        </div>
                                    ))}
                                    {(!selectedCustomer.saved_locations || selectedCustomer.saved_locations.length === 0) && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>ไม่มีข้อมูลที่อยู่</div>}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}
