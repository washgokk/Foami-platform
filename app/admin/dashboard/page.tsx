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
    active_staff: number
    total_customers: number
}

const INITIAL_STATS: Stats = {
    total_bookings: 0, today_bookings: 0, pending_bookings: 0,
    completed_bookings: 0, total_revenue: 0, today_revenue: 0,
    active_staff: 0, total_customers: 0,
}

const STATUS_COLORS: Record<string, string> = {
    pending: '#F59E0B', confirmed: '#3B82F6', picking_up: '#8B5CF6',
    washing: '#06B6D4', delivering: '#F97316', completed: '#22C55E', cancelled: '#EF4444',
}
const STATUS_TH: Record<string, string> = {
    pending: 'รอยืนยัน', confirmed: 'ยืนยันแล้ว', picking_up: 'รับรถ',
    washing: 'ล้าง', delivering: 'ส่ง', completed: 'เสร็จ', cancelled: 'ยกเลิก',
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<Stats>(INITIAL_STATS)
    const [recentBookings, setRecentBookings] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const today = new Date().toISOString().split('T')[0]

    useEffect(() => {
        async function load() {
            try {
                const [booksRes, customersRes, staffRes] = await Promise.all([
                    supabase.from('bookings').select('status, total_price, created_at, scheduled_date, customers(full_name), services(name)').order('created_at', { ascending: false }),
                    supabase.from('customers').select('id', { count: 'exact', head: true }),
                    supabase.from('staff').select('id', { count: 'exact', head: true }).eq('is_active', true),
                ])

                const bookings = booksRes.data || []
                const todayBooks = bookings.filter((b: any) => b.scheduled_date === today)

                setStats({
                    total_bookings: bookings.length,
                    today_bookings: todayBooks.length,
                    pending_bookings: bookings.filter((b: any) => b.status === 'pending').length,
                    completed_bookings: bookings.filter((b: any) => b.status === 'completed').length,
                    total_revenue: bookings.filter((b: any) => b.status === 'completed').reduce((s: number, b: any) => s + (b.total_price || 0), 0),
                    today_revenue: todayBooks.filter((b: any) => b.status === 'completed').reduce((s: number, b: any) => s + (b.total_price || 0), 0),
                    active_staff: staffRes.count || 0,
                    total_customers: customersRes.count || 0,
                })
                setRecentBookings(bookings.slice(0, 8))
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [today])

    const STAT_CARDS = [
        { label: 'งานวันนี้', value: stats.today_bookings, icon: '📅', color: '#3B5FCC' },
        { label: 'รอดำเนินการ', value: stats.pending_bookings, icon: '⏳', color: '#F59E0B' },
        { label: 'รายได้วันนี้', value: `฿${stats.today_revenue.toLocaleString()}`, icon: '💰', color: '#22C55E' },
        { label: 'รายได้รวม', value: `฿${stats.total_revenue.toLocaleString()}`, icon: '📈', color: '#8B5CF6' },
        { label: 'ลูกค้าทั้งหมด', value: stats.total_customers, icon: '👥', color: '#06B6D4' },
        { label: 'พนักงานทำงาน', value: stats.active_staff, icon: '🧑‍🔧', color: '#F97316' },
        { label: 'งานทั้งหมด', value: stats.total_bookings, icon: '📋', color: '#3B5FCC' },
        { label: 'งานเสร็จสิ้น', value: stats.completed_bookings, icon: '✅', color: '#22C55E' },
    ]

    return (
        <div className="animate-fade">
            <div className="page-header">
                <div>
                    <h1 className="page-title">📊 ภาพรวมระบบ</h1>
                    <p className="page-subtitle">วันที่ {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
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
                        <div key={card.label} className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: `${card.color}15` }}>
                                <span style={{ fontSize: '1.5rem' }}>{card.icon}</span>
                            </div>
                            <div>
                                <div className={styles.statLabel}>{card.label}</div>
                                <div className={styles.statValue} style={{ color: card.color }}>{card.value}</div>
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
                                <th>ลูกค้า</th>
                                <th>บริการ</th>
                                <th>วันที่นัด</th>
                                <th>ราคา</th>
                                <th>สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentBookings.length === 0 ? (
                                <tr><td colSpan={5}><div className="empty-state"><span className="empty-state-icon">📋</span><p className="empty-state-title">ยังไม่มีการจอง</p></div></td></tr>
                            ) : recentBookings.map((b: any) => (
                                <tr key={b.id}>
                                    <td>{b.customers?.full_name || '-'}</td>
                                    <td>{b.services?.name || '-'}</td>
                                    <td>{b.scheduled_date}</td>
                                    <td>฿{(b.total_price || 0).toLocaleString()}</td>
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
