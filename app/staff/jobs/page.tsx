'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_CSS, BookingStatus } from '@/lib/types'

const STATUS_FILTERS: { label: string; value: string }[] = [
    { label: 'ทั้งหมด', value: 'all' },
    { label: 'รอยืนยัน', value: 'pending' },
    { label: 'ยืนยันแล้ว', value: 'confirmed' },
    { label: 'กำลังรับรถ', value: 'picking_up' },
    { label: 'กำลังล้าง', value: 'washing' },
    { label: 'กำลังส่ง', value: 'delivering' },
    { label: 'เสร็จแล้ว', value: 'completed' },
]

export default function StaffJobsPage() {
    const router = useRouter()
    const [jobs, setJobs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [staffId, setStaffId] = useState('')

    useEffect(() => {
        const data = localStorage.getItem('staff_data')
        if (!data) { router.replace('/staff/login'); return }
        setStaffId(JSON.parse(data).id)
    }, [router])

    useEffect(() => {
        if (!staffId) return
        async function load() {
            let q = supabase
                .from('bookings')
                .select('*, customers(full_name, vehicle_brand, vehicle_model, license_plate), services(name), zones(name)')
                .eq('staff_id', staffId)
                .order('scheduled_date', { ascending: false })
                .order('scheduled_time', { ascending: false })

            if (filter !== 'all') q = (q as any).eq('status', filter)

            const { data } = await (q as any)
            setJobs(data || [])
            setLoading(false)
        }
        load()
    }, [staffId, filter])

    const STATUS_ICON: Record<string, string> = {
        pending: '⏳', confirmed: '✅', picking_up: '🏍️',
        washing: '🫧', delivering: '🚗', completed: '🎉', cancelled: '❌',
    }

    return (
        <div className="animate-fade">
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 'var(--space-4)' }}>🔧 รายการงาน</h1>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 'var(--space-4)', paddingBottom: 4 }}>
                {STATUS_FILTERS.map(f => (
                    <button
                        key={f.value}
                        className={`btn btn-sm ${filter === f.value ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setFilter(f.value)}
                        style={{ flexShrink: 0 }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner" /></div>
            ) : jobs.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon">📋</span>
                    <p className="empty-state-title">ไม่มีงาน</p>
                    <p className="empty-state-desc">ยังไม่มีงานในหมวดนี้</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {jobs.map(job => (
                        <Link
                            key={job.id}
                            href={`/staff/jobs/${job.id}`}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                                background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--border)', padding: 'var(--space-4)',
                                textDecoration: 'none', color: 'inherit',
                                transition: 'box-shadow 0.2s, transform 0.2s',
                            }}
                        >
                            <div style={{ fontSize: '1.6rem' }}>{STATUS_ICON[job.status] || '🔧'}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{job.customers?.full_name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    {job.customers?.vehicle_brand} · {job.services?.name} · {job.zones?.name}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    📅 {job.scheduled_date} {job.scheduled_time?.slice(0, 5)}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <span className={`badge ${BOOKING_STATUS_CSS[job.status as BookingStatus] || ''}`}>
                                    {BOOKING_STATUS_LABEL[job.status as BookingStatus] || job.status}
                                </span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    ฿{job.total_price?.toLocaleString()}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
