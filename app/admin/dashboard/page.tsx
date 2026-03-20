'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './dashboard.module.css'

interface Stats {
    total_bookings: number
    today_bookings: number
    pending_bookings: number
    completed_bookings: number
    total_revenue: number
    today_revenue: number
}

const INITIAL_STATS: Stats = {
    total_bookings: 0, today_bookings: 0, pending_bookings: 0,
    completed_bookings: 0, total_revenue: 0, today_revenue: 0,
}

const STATUS_COLORS: Record<string, string> = {
    pending: '#F59E0B', confirmed: '#3B82F6', picking_up: '#8B5CF6',
    washing: '#06B6D4', delivering: '#F97316', completed: '#22C55E', cancelled: '#EF4444',
}
const STATUS_TH: Record<string, string> = {
    pending: 'รอยืนยัน', confirmed: 'ยืนยันแล้ว', picking_up: 'รับรถ',
    washing: 'ล้าง', delivering: 'ส่ง', completed: 'เสร็จ', cancelled: 'ยกเลิก',
}

import { 
    format, 
    startOfDay, endOfDay, 
    startOfMonth, endOfMonth, 
    startOfYear, endOfYear,
    isWithinInterval,
    parseISO
} from 'date-fns'
import { th } from 'date-fns/locale'
import { Calendar, TrendingUp, Users, ShoppingBag, MapPin, CheckCircle, ClipboardList } from 'lucide-react'

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<Stats>(INITIAL_STATS)
    const [recentBookings, setRecentBookings] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [timeFilter, setTimeFilter] = useState<'day' | 'month' | 'year'>('day')
    const [filterDate, setFilterDate] = useState(new Date())
    const [topService, setTopService] = useState({ name: '-', count: 0 })
    const [topBranch, setTopBranch] = useState({ name: '-', count: 0, revenue: 0 })
    
    // Revenue logic aligned with CRM (/admin/crm)
    const calculateBookingFullPrice = (b: any) => {
        let rowAddonTotal = 0
        if (Array.isArray(b.addon_ids)) {
            b.addon_ids.forEach((a: any) => {
                rowAddonTotal += (Number(a.price) || Number(a.selectedPrice) || Number(a.variableState?.customAmount) || 0)
            })
        }

        const computedTotal = (Number(b.base_price) || 0) + 
                             rowAddonTotal + 
                             (Number(b.travel_surcharge) || 0) + 
                             (Number(b.different_spot_fee) || 0) + 
                             (Number(b.additional_price) || 0) - 
                             (Number(b.discount_amount) || 0);
        return computedTotal;
    };

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                // Fetch bookings and lookup tables in parallel
                const [
                    { data: allBookings, error: booksError },
                    { data: customerData },
                    { data: serviceData },
                    { data: branchData }
                ] = await Promise.all([
                    supabase.from('bookings').select('*').order('created_at', { ascending: false }),
                    supabase.from('customers').select('id, full_name'),
                    supabase.from('services').select('id, name'),
                    supabase.from('branches').select('id, name')
                ])

                if (booksError) throw booksError

                // Create lookup maps for manual joining (Crucial for Mock DB)
                const customerMap = new Map(customerData?.map(c => [c.id, c]) || [])
                const serviceMap = new Map(serviceData?.map(s => [s.id, s]) || [])
                const branchMap = new Map(branchData?.map(b => [b.id, b]) || [])

                // Map/Join the data manually so it works in both Real and Mock modes
                const bookings = (allBookings || []).map((b: any) => {
                    const cust = b.customers || b.customer || customerMap.get(b.customer_id)
                    const svc = b.services || b.service || serviceMap.get(b.service_id)
                    let br = b.branches || b.branch || branchMap.get(b.branch_id)
                    
                    // Fallback: If branch is missing, try to find it via the zone
                    if (!br && b.zone_id) {
                        const zone = (allBookings as any)?.find((x: any) => x.id === b.id)?.zones || (b as any).zones
                        const brId = zone?.branch_id || (customerData as any)?.find((x: any) => x.id === b.customer_id)?.branch_id
                        if (brId) br = branchMap.get(brId)
                    }

                    return {
                        ...b,
                        customer: cust,
                        service: svc,
                        branch: br
                    }
                }) as any[]
                
                // Determine interval for filtering
                let start: Date, end: Date
                if (timeFilter === 'day') {
                    start = startOfDay(filterDate); end = endOfDay(filterDate)
                } else if (timeFilter === 'month') {
                    start = startOfMonth(filterDate); end = endOfMonth(filterDate)
                } else {
                    start = startOfYear(filterDate); end = endOfYear(filterDate)
                }

                const filteredBookings = bookings.filter((b: any) => {
                    const d = parseISO(b.scheduled_date)
                    return isWithinInterval(d, { start, end })
                })

                // Top Service & Branch Calculation
                const serviceCounts: Record<string, number> = {}
                const branchStats: Record<string, { count: number, revenue: number }> = {}

                filteredBookings.forEach((b: any) => {
                    // Only count stats for COMPLETED bookings as requested
                    if (b.status !== 'completed') return

                    // Service stats
                    const svc = b.service
                    const sName = (Array.isArray(svc) ? svc[0]?.name : svc?.name) || '-'
                    if (sName !== '-') {
                        serviceCounts[sName] = (serviceCounts[sName] || 0) + 1
                    }

                    // Branch stats
                    const br = b.branch
                    const bName = (Array.isArray(br) ? br[0]?.name : br?.name) || '-'
                    if (bName !== '-') {
                        if (!branchStats[bName]) branchStats[bName] = { count: 0, revenue: 0 }
                        branchStats[bName].count++
                        branchStats[bName].revenue += calculateBookingFullPrice(b)
                    }
                })

                const sortedServices = Object.entries(serviceCounts).sort((a,b) => b[1] - a[1])
                const sortedBranches = Object.entries(branchStats).sort((a,b) => b[1].count - a[1].count || b[1].revenue - a[1].revenue)

                setTopService({ 
                    name: sortedServices[0]?.[0] || '-', 
                    count: sortedServices[0]?.[1] || 0 
                })
                setTopBranch({ 
                    name: sortedBranches[0]?.[0] || '-', 
                    count: sortedBranches[0]?.[1]?.count || 0,
                    revenue: sortedBranches[0]?.[1]?.revenue || 0 
                })

                const todayStr = format(new Date(), 'yyyy-MM-dd')

                setStats({
                    total_bookings: filteredBookings.length,
                    today_bookings: bookings.filter((b: any) => b.scheduled_date === todayStr).length,
                    pending_bookings: filteredBookings.filter((b: any) => !['completed', 'cancelled'].includes(b.status)).length,
                    completed_bookings: filteredBookings.filter((b: any) => b.status === 'completed').length,
                    total_revenue: filteredBookings.filter((b: any) => b.status === 'completed').reduce((s: number, b: any) => s + calculateBookingFullPrice(b), 0),
                    today_revenue: bookings.filter((b: any) => b.scheduled_date === todayStr && b.status === 'completed').reduce((s: number, b: any) => s + calculateBookingFullPrice(b), 0),
                })
                setRecentBookings(bookings.slice(0, 10))
            } catch (err) {
                console.error('Dashboard Load Error:', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [timeFilter, filterDate])

    const STAT_CARDS = [
        { label: 'ยอดจองทั้งหมด', value: stats.total_bookings, icon: <ShoppingBag />, color: 'var(--brand-dominant)' },
        { label: 'รายได้รวม', value: `฿${stats.total_revenue.toLocaleString()}`, icon: <TrendingUp />, color: 'var(--brand-dominant)' },
        { label: 'รอดำเนินการ', value: stats.pending_bookings, icon: <Calendar />, color: 'var(--brand-subordinate)' },
        { label: 'เสร็จสิ้น', value: stats.completed_bookings, icon: <CheckCircle />, color: 'var(--brand-accent)' },
        { label: 'บริการยอดนิยม', value: topService.name, sub: `${topService.count} งานที่เสร็จแล้ว`, icon: <ShoppingBag />, color: 'var(--brand-dominant)', isWide: true },
        { label: 'สาขายอดนิยม', value: topBranch.name, sub: `${topBranch.count} งานที่เสร็จแล้ว (฿${topBranch.revenue.toLocaleString()})`, icon: <MapPin />, color: 'var(--brand-subordinate)', isWide: true },
    ]

    return (
        <div className="animate-fade">
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>ภาพรวมระบบ</h1>
                    <p className="page-subtitle">สถิติ {timeFilter === 'day' ? 'รายวัน' : timeFilter === 'month' ? 'รายเดือน' : 'รายปี'}</p>
                </div>
                
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className={styles.filterToggle}>
                        <button className={`${styles.filterBtn} ${timeFilter === 'day' ? styles.active : ''}`} onClick={() => setTimeFilter('day')}>วัน</button>
                        <button className={`${styles.filterBtn} ${timeFilter === 'month' ? styles.active : ''}`} onClick={() => setTimeFilter('month')}>เดือน</button>
                        <button className={`${styles.filterBtn} ${timeFilter === 'year' ? styles.active : ''}`} onClick={() => setTimeFilter('year')}>ปี</button>
                    </div>
                    <input 
                        type={timeFilter === 'day' ? 'date' : timeFilter === 'month' ? 'month' : 'number'} 
                        className="form-input"
                        style={{ width: 150 }}
                        value={timeFilter === 'year' ? filterDate.getFullYear() : format(filterDate, timeFilter === 'day' ? 'yyyy-MM-dd' : 'yyyy-MM')}
                        onChange={e => {
                            if (timeFilter === 'year') {
                                setFilterDate(new Date(parseInt(e.target.value), 0, 1))
                            } else {
                                setFilterDate(new Date(e.target.value))
                            }
                        }}
                    />
                </div>
            </div>

            {loading ? (
                <div className={styles.loadingGrid}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className={`${styles.statCard} animate-pulse`} />
                    ))}
                </div>
            ) : (
                <div className={styles.statsGrid}>
                    {STAT_CARDS.map(card => (
                        <div key={card.label} className={`${styles.statCard} ${card.isWide ? styles.wideCard : ''}`}>
                                <div className={styles.statIcon} style={{ background: `${card.color}15`, color: card.color }}>
                                    {card.icon}
                                </div>
                                <div>
                                    <div className={styles.statLabel}>{card.label}</div>
                                    <div className={styles.statValue} style={{ color: card.color }}>{card.value}</div>
                                    {card.sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{card.sub}</div>}
                                </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Recent Bookings */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>การจองล่าสุด</h2>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>วันที่จอง</th>
                                <th>ลูกค้า</th>
                                <th>บริการ</th>
                                <th>วันที่นัด</th>
                                <th>เวลา</th>
                                <th>ราคา</th>
                                <th>สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentBookings.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <div className="empty-state" style={{ padding: 'var(--space-12)' }}>
                                            <div style={{ background: 'var(--surface-2)', width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--text-muted)' }}>
                                                <ClipboardList size={32} />
                                            </div>
                                            <p className="empty-state-title" style={{ fontWeight: 800 }}>ยังไม่มีการจอง</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : recentBookings.map((b: any) => (
                                <tr key={b.id}>
                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {format(parseISO(b.created_at), 'dd/MM/yy HH:mm')}
                                    </td>
                                    <td>
                                        {(() => {
                                            const cust = b.customer
                                            return (Array.isArray(cust) ? cust[0]?.full_name : cust?.full_name) || '-'
                                        })()}
                                    </td>
                                    <td>
                                        {(() => {
                                            const svc = b.service
                                            return (Array.isArray(svc) ? svc[0]?.name : svc?.name) || '-'
                                        })()}
                                    </td>
                                    <td>{b.scheduled_date}</td>
                                    <td>{b.scheduled_time}</td>
                                    <td>฿{(calculateBookingFullPrice(b)).toLocaleString()}</td>
                                    <td>
                                        <span className="badge" style={{ background: `${STATUS_COLORS[b.status]}15`, color: STATUS_COLORS[b.status] }}>
                                            {STATUS_TH[b.status] || b.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
