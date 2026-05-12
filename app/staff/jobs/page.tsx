'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_CSS, BookingStatus } from '@/lib/types'
import { Wrench, Search, Calendar, Clock, ClipboardList, CheckCircle2, Droplets, Truck, XCircle, Bike, MessageCircle } from 'lucide-react'
import styles from './jobs.module.css'

const STATUS_FILTERS: { label: string; value: string }[] = [
    { label: 'ทั้งหมด', value: 'all' },
    { label: 'รอยืนยัน', value: 'pending' },
    { label: 'ยืนยันแล้ว', value: 'confirmed' },
    { label: 'กำลังรับรถ', value: 'picking_up' },
    { label: 'กำลังล้าง', value: 'washing' },
    { label: 'กำลังส่ง', value: 'delivering' },
    { label: 'เสร็จแล้ว', value: 'completed' },
]

// ─── Utility to extract place name from address ─────────────
function getPlaceName(addr: string) {
    if (!addr) return 'ไม่ระบุสถานที่'
    const parts = addr.split('(')
    if (parts.length > 1) return parts[0].trim()
    const words = addr.split(' ')
    if (words.length > 2) return words.slice(0, 2).join(' ')
    return addr
}

export default function StaffJobsPage() {
    const router = useRouter()
    const [jobs, setJobs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [addons, setAddons] = useState<any[]>([])
    const [staffId, setStaffId] = useState('')

    useEffect(() => {
        const data = localStorage.getItem('staff_data')
        if (!data) { router.replace('/staff/login'); return }
        setStaffId(JSON.parse(data).id)
    }, [router])

    useEffect(() => {
        if (!staffId) return
        async function load() {
            setLoading(true)

            // Manual Joins Fallback (Mock DB)
            const resolveRelations = async (bData: any[]) => {
                const sIds = [...new Set(bData.filter(b => b.service_id).map(b => b.service_id))]
                const zIds = [...new Set(bData.filter(b => b.zone_id).map(b => b.zone_id))]
                const cIds = [...new Set(bData.filter(b => b.customer_id).map(b => b.customer_id))]

                if (sIds.length > 0) {
                    const { data: sData } = await supabase.from('services').select('*').in('id', sIds)
                    const smap = Object.fromEntries(sData?.map((s: any) => [s.id, s]) || [])
                    bData.forEach(b => { if (b.service_id) b.services = smap[b.service_id] })
                }
                if (zIds.length > 0) {
                    const { data: zData } = await supabase.from('zones').select('*').in('id', zIds)
                    const zmap = Object.fromEntries(zData?.map((z: any) => [z.id, z]) || [])
                    bData.forEach(b => { if (b.zone_id) b.zones = zmap[b.zone_id] })
                }
                if (cIds.length > 0) {
                    const { data: cData } = await supabase.from('customers').select('*').in('id', cIds)
                    const cmap = Object.fromEntries(cData?.map((c: any) => [c.id, c]) || [])
                    bData.forEach(b => { if (b.customer_id) b.customers = cmap[b.customer_id] })
                }
                return bData
            }

            let q = supabase
                .from('bookings')
                .select('*, customers(full_name, vehicle_brand, vehicle_model, license_plate), services(name), zones(name)')
                .eq('staff_id', staffId)
                .order('scheduled_date', { ascending: false })
                .order('scheduled_time', { ascending: false })

            if (filter !== 'all') q = (q as any).eq('status', filter)

            const { data: bRes } = await (q as any)
            const { data: aRes } = await supabase.from('service_addons').select('*')
            
            if (aRes) setAddons(aRes)
            const finalJobs = await resolveRelations(bRes || [])
            setJobs(finalJobs)
            setLoading(false)
        }
        load()
    }, [staffId, filter])

    return (
        <div className="animate-fade">
            <h1 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <Wrench size={24} color="var(--brand-dominant)" /> รายการงาน
            </h1>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 'var(--space-6)', paddingBottom: 8 }}>
                {STATUS_FILTERS.map(f => (
                    <button
                        key={f.value}
                        className={`btn btn-sm`}
                        onClick={() => setFilter(f.value)}
                        style={{ 
                            flexShrink: 0, 
                            borderRadius: '12px', 
                            padding: '8px 16px',
                            background: filter === f.value ? 'var(--brand-dominant)' : 'var(--surface)',
                            border: filter === f.value ? 'none' : '1px solid var(--border)',
                            color: filter === f.value ? '#fff' : 'var(--text-secondary)',
                            fontWeight: 700
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner" /></div>
            ) : jobs.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--space-12)' }}>
                    <Search size={48} color="var(--brand-dominant)" style={{ opacity: 0.3, marginBottom: 16 }} />
                    <p className="empty-state-title">ไม่พบรายการงาน</p>
                    <p className="empty-state-desc">ยังไม่มีงานในหมวดนี้ที่คุณดูแล</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {jobs.map(job => (
                        <Link
                            key={job.id}
                            href={`/staff/jobs/${job.id}`}
                            className={styles.jobCard}
                            style={{ position: 'relative' }}
                        >
                            {['confirmed', 'picking_up', 'washing', 'delivering'].includes(job.status) && (
                                <div title="ช่องทางแชท" style={{ position: 'absolute', top: 12, right: 12, color: 'var(--brand-dominant)', opacity: 0.4 }}>
                                    <MessageCircle size={16} />
                                </div>
                            )}
                            <div className={styles.jobTime} style={{ minWidth: '75px' }}>
                                <span style={{ fontSize: '1.2rem', fontWeight: 900 }}>{job.scheduled_time?.slice(0, 5)}</span>
                                <span className={styles.jobDate}>{job.scheduled_date}</span>
                            </div>
                            <div className={styles.jobBody}>
                                <div className={styles.jobCustomer} style={{ fontSize: '1.1rem', marginBottom: 2 }}>{getPlaceName(job.pickup_address)}</div>
                                <div className={styles.jobDetail}>
                                    {job.customers?.vehicle_brand} {job.customers?.vehicle_model} {job.customers?.vehicle_color && `(${job.customers.vehicle_color})`} {job.customers?.license_plate && `(${job.customers.license_plate})`} · {job.services?.name}
                                </div>
                            </div>
                            <div className={styles.jobStatusPrice}>
                                <span className={`badge ${BOOKING_STATUS_CSS[job.status as BookingStatus] || ''}`} style={{ fontSize: '0.7rem' }}>
                                    {BOOKING_STATUS_LABEL[job.status as BookingStatus] || job.status}
                                </span>
                                <div className={styles.jobPrice} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                    {(() => {
                                        // ── Gross total stored in DB (pre-discount) ──
                                        const grossTotal = job.total_price || 0
                                        // ── Net = what customer actually owes for this booking ──
                                        const discount = job.discount_amount || 0
                                        const netTotal = Math.max(0, grossTotal - discount)
                                        // ── Additional = on-site charges (pay later) ──
                                        const additional = job.additional_price || 0
                                        // ── What was already paid online (via Stripe or free booking) ──
                                        const paidOnline = netTotal - additional
                                        // ── Balance = additional not yet paid ──
                                        const balance = job.is_additional_paid ? 0 : additional

                                        return (
                                            <>
                                                <div style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '1.05rem' }}>฿{netTotal.toLocaleString()}</div>
                                                {balance > 0 && job.status !== 'completed' && (
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--warning-dark)', fontWeight: 800, background: 'var(--warning-ghost)', padding: '2px 6px', borderRadius: 6 }}>
                                                        ค้าง ฿{balance.toLocaleString()}
                                                    </div>
                                                )}
                                                {job.status === 'completed' && (
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: 700 }}>ชำระครบแล้ว</div>
                                                )}
                                            </>
                                        )
                                    })()}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
