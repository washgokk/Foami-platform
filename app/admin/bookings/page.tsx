'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_CSS, BookingStatus } from '@/lib/types'

export default function AdminBookingsPage() {
    const [bookings, setBookings] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<any>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            let q = supabase.from('bookings').select('*').order('created_at', { ascending: false })
            if (filter !== 'all') q = q.eq('status', filter)
            const { data, error } = await q
            if (error) throw error
            
            const rawBookings = data || []
            
            // MOCK DB FALLBACK: Manually fetch relations since mock doesn't support joins
            const enhanced = await Promise.all(rawBookings.map(async (b: any) => {
                const item = { ...b }
                if (item.customer_id) {
                    const { data: c } = await supabase.from('customers').select('*').eq('id', item.customer_id).single()
                    item.customers = c
                }
                if (item.service_id) {
                    const { data: s } = await supabase.from('services').select('*').eq('id', item.service_id).single()
                    item.services = s
                }
                if (item.zone_id) {
                    const { data: z } = await supabase.from('zones').select('*').eq('id', item.zone_id).single()
                    item.zones = z
                }
                if (item.staff_id) {
                    const { data: st } = await supabase.from('staff').select('*').eq('id', item.staff_id).single()
                    item.staff = st
                }
                return item
            }))

            setBookings(enhanced)
        } catch (e) {
            console.error('Admin Load Error:', e)
        } finally {
            setLoading(false)
        }
    }, [filter])

    useEffect(() => { load() }, [load])

    const filtered = bookings.filter(b =>
        !search || b.customers?.full_name?.includes(search) || b.customers?.phone?.includes(search) || b.id.includes(search)
    )

    const STATUS_OPTIONS = ['all', 'pending', 'confirmed', 'picking_up', 'washing', 'delivering', 'completed', 'cancelled']
    const STATUS_OPTS_TH: Record<string, string> = { all: 'ทั้งหมด', ...Object.fromEntries(Object.entries(BOOKING_STATUS_LABEL)) }

    return (
        <div className="animate-fade">
            <div className="page-header">
                <div>
                    <h1 className="page-title">📋 การจองทั้งหมด</h1>
                    <p className="page-subtitle">{filtered.length} รายการ</p>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
                <input className="form-input" style={{ maxWidth: 280 }} placeholder="🔍 ค้นหา ชื่อ / เบอร์ / ID" value={search} onChange={e => setSearch(e.target.value)} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {STATUS_OPTIONS.map(s => (
                        <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(s)}>
                            {STATUS_OPTS_TH[s]}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? <div className="empty-state"><div className="spinner" /></div> : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr><th>ลูกค้า</th><th>บริการ</th><th>นัด</th><th>ผู้รับผิดชอบ</th><th>ราคา</th><th>ชำระ</th><th>สถานะ</th><th></th></tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={8}><div className="empty-state"><span className="empty-state-icon">📋</span><p className="empty-state-title">ไม่พบการจอง</p></div></td></tr>
                            ) : filtered.map(b => (
                                <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(b)}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{b.customers?.full_name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.customers?.phone}</div>
                                    </td>
                                    <td>{b.services?.name}</td>
                                    <td>
                                        <div>{b.scheduled_date}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.scheduled_time}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{b.staff?.full_name || '-'}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.zones?.name}</div>
                                    </td>
                                    <td style={{ fontWeight: 700 }}>฿{(b.total_price || 0).toLocaleString()}</td>
                                    <td>
                                        <span className={`badge ${b.payment_status === 'paid' ? 'badge-completed' : b.payment_status === 'refunded' ? 'badge-cancelled' : 'badge-pending'}`}>
                                            {b.payment_status === 'paid' ? 'ชำระแล้ว' : b.payment_status === 'refunded' ? 'คืนเงิน' : 'รอชำระ'}
                                        </span>
                                    </td>
                                    <td><span className={`badge ${BOOKING_STATUS_CSS[b.status as BookingStatus] || ''}`}>{BOOKING_STATUS_LABEL[b.status as BookingStatus] || b.status}</span></td>
                                    <td onClick={e => e.stopPropagation()}>
                                        {b.status === 'pending' && (
                                            <button className="btn btn-danger btn-sm" onClick={async () => {
                                                await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', b.id)
                                                load()
                                            }}>ยกเลิก</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Detail Modal */}
            {selected && (
                <div className="overlay" onClick={() => setSelected(null)}>
                    <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>รายละเอียดการจอง</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: '0.9rem' }}>
                            {[
                                ['Booking ID', selected.id.slice(0, 8) + '...'],
                                ['ลูกค้า', selected.customers?.full_name],
                                ['เบอร์โทร', selected.customers?.phone],
                                ['รถ', `${selected.customers?.vehicle_brand} ${selected.customers?.vehicle_model}`],
                                ['ทะเบียน', selected.customers?.license_plate],
                                ['บริการ', selected.services?.name],
                                ['วันนัด', `${selected.scheduled_date} ${selected.scheduled_time}`],
                                ['โซน', selected.zones?.name],
                                ['รับจาก', selected.pickup_address],
                                ['ส่งที่', selected.delivery_address],
                                ['ราคา', `฿${(selected.total_price || 0).toLocaleString()}`],
                                ['ช่างผู้รับผิดชอบ', selected.staff?.full_name || 'ยังไม่ได้รับ'],
                                ['สถานะ', BOOKING_STATUS_LABEL[selected.status as BookingStatus]],
                            ].map(([key, val]) => (
                                <div key={key} style={{ display: 'flex', gap: 'var(--space-4)' }}>
                                    <span style={{ color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>{key}</span>
                                    <span style={{ fontWeight: 500 }}>{val}</span>
                                </div>
                            ))}
                            {selected.slip_url && (
                                <div>
                                    <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>สลิปโอนเงิน</div>
                                    <img src={selected.slip_url} alt="slip" style={{ width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
