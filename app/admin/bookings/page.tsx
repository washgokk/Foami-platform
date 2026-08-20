'use client'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { trackAuditLog } from '@/lib/audit'
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_CSS, BookingStatus, TIME_SLOTS, VEHICLE_SIZE_LABEL } from '@/lib/types'
import { generateScalableId } from '@/lib/id-utils'
import { Search, ClipboardList, MessageCircle, Star, Image as ImageIcon, User, MapPin, Calendar, Clock, Phone, Briefcase, ChevronRight, X, LayoutGrid, List, Plus, Bike, CreditCard, FileText, Tag, Hash, Edit2 } from 'lucide-react'
import ImageZoom from '@/components/Global/ImageZoom'
import BookingChat from '@/components/Chat/BookingChat'

// B2 FIX: Accept optional branchId — when provided (shop admin), filter all queries to that branch only
export default function AdminBookingsPage({ branchId }: { branchId?: string }) {
    const [bookings, setBookings] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<any>(null)
    const [addons, setAddons] = useState<any[]>([])
    const [zoomConfig, setZoomConfig] = useState<{ images: { src: string; alt?: string }[]; initialIndex: number } | null>(null)
    const [showChat, setShowChat] = useState(false)
    const [manualBookingToEdit, setManualBookingToEdit] = useState<any>(null)
    const [jobPhotos, setJobPhotos] = useState<{ before: string[], after: string[] }>({ before: [], after: [] })
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [showManualModal, setShowManualModal] = useState(false)

    useEffect(() => {
        if (selected?.id) {
            supabase.from('job_photos').select('*').eq('booking_id', selected.id)
                .then(({ data }) => {
                    if (data) {
                        const before = data.filter(d => d.type === 'before').flatMap(d => d.photo_urls || [])
                        const after = data.filter(d => d.type === 'after').flatMap(d => d.photo_urls || [])
                        setJobPhotos({ before, after })
                    } else {
                        setJobPhotos({ before: [], after: [] })
                    }
                })
        } else {
            setJobPhotos({ before: [], after: [] })
        }
    }, [selected?.id])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            // B2 FIX: filter by branchId when in shop admin context
            let q = supabase.from('bookings').select('*').order('created_at', { ascending: false })
            if (filter !== 'all') q = q.eq('status', filter)
            if (branchId) q = q.eq('branch_id', branchId)
            const [bookingRes, addonRes] = await Promise.all([q, supabase.from('addons').select('*')])

            if (bookingRes.error) throw bookingRes.error
            if (addonRes.data) setAddons(addonRes.data)

            const rawBookings = bookingRes.data || []
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

    const calcTotal = (b: any) => {
        // Prefer total_price from DB (stored as gross pre-discount by booking flow)
        // Fallback: compute from fields if total_price not stored yet
        if (b.total_price != null && b.total_price > 0) return b.total_price
        let addonTotal = 0
        if (Array.isArray(b.addon_ids)) {
            b.addon_ids.forEach((a: any) => {
                if (typeof a === 'string') {
                    const ad = addons.find(da => da.id === a || da.name === a)
                    addonTotal += (ad?.price || 0)
                } else {
                    if (a.isFree) addonTotal += 0
                    else if (a.selectedPrice !== undefined) addonTotal += a.selectedPrice
                    else if (a.price !== undefined) addonTotal += a.price
                    else if (a.variableState?.customAmount) addonTotal += (Number(a.variableState.customAmount) || 0)
                }
            })
        }
        return (b.base_price || 0) + addonTotal + (b.travel_surcharge || 0) + (b.different_spot_fee || 0) + (b.additional_price || 0)
    }

    const STATUS_OPTIONS = ['all', 'pending', 'confirmed', 'picking_up', 'washing', 'delivering', 'completed', 'cancelled']
    const STATUS_OPTS_TH: Record<string, string> = { all: 'ทั้งหมด', ...Object.fromEntries(Object.entries(BOOKING_STATUS_LABEL)) }

    const STATUS_COLORS: Record<string, string> = {
        pending: '#F59E0B', confirmed: '#3B82F6', picking_up: '#8B5CF6',
        washing: '#06B6D4', delivering: '#F97316', completed: '#10B981', cancelled: '#EF4444'
    }

    return (
        <div className="animate-fade">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ClipboardList size={28} color="var(--brand-dominant)" /> การจองทั้งหมด
                    </h1>
                    <p className="page-subtitle">{filtered.length} รายการที่พบ</p>
                </div>
                <button
                    className="btn btn-primary"
                    style={{ borderRadius: 16, gap: 8, fontSize: '0.9rem' }}
                    onClick={() => setShowManualModal(true)}
                >
                    <Plus size={18} /> เพิ่มการจองใหม่
                </button>
            </div>

            {/* Search + Filter Bar */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 340 }}>
                    <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        className="form-input"
                        style={{ paddingLeft: 42, borderRadius: 20, height: 44 }}
                        placeholder="ค้นหา ชื่อ / เบอร์ / ID..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', background: 'var(--surface-2)', padding: '5px 6px', borderRadius: 20, border: '1px solid var(--border)' }}>
                    {STATUS_OPTIONS.map(s => (
                        <button
                            key={s}
                            style={{
                                borderRadius: 14, padding: '6px 14px', border: 'none', cursor: 'pointer',
                                fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.18s',
                                background: filter === s ? 'var(--brand-dominant)' : 'transparent',
                                color: filter === s ? 'white' : 'var(--text-muted)',
                                boxShadow: filter === s ? '0 2px 8px rgba(59,95,204,0.25)' : 'none',
                            }}
                            onClick={() => setFilter(s)}
                        >
                            {STATUS_OPTS_TH[s]}
                        </button>
                    ))}
                </div>
                {/* View toggle */}
                <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 12, padding: 4, border: '1px solid var(--border)', gap: 2, marginLeft: 'auto' }}>
                    <button
                        onClick={() => setViewMode('grid')}
                        title="แบบการ์ด"
                        style={{
                            width: 36, height: 36, border: 'none', borderRadius: 9, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: viewMode === 'grid' ? 'var(--surface)' : 'transparent',
                            color: viewMode === 'grid' ? 'var(--brand-dominant)' : 'var(--text-muted)',
                            boxShadow: viewMode === 'grid' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.15s',
                        }}
                    ><LayoutGrid size={16} /></button>
                    <button
                        onClick={() => setViewMode('list')}
                        title="แบบรายการ"
                        style={{
                            width: 36, height: 36, border: 'none', borderRadius: 9, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: viewMode === 'list' ? 'var(--surface)' : 'transparent',
                            color: viewMode === 'list' ? 'var(--brand-dominant)' : 'var(--text-muted)',
                            boxShadow: viewMode === 'list' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.15s',
                        }}
                    ><List size={16} /></button>
                </div>
            </div>

            {/* Booking List */}
            {loading ? (
                <div className="empty-state"><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state" style={{ padding: '80px 0' }}>
                    <div style={{ background: 'var(--surface-2)', width: 72, height: 72, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', marginBottom: 16 }}>
                        <ClipboardList size={36} />
                    </div>
                    <p className="empty-state-title" style={{ fontWeight: 800 }}>ยังไม่มีการจอง</p>
                    <p className="empty-state-desc">ไม่พบรายการที่ตรงกับเงื่อนไข</p>
                </div>
            ) : viewMode === 'grid' ? (
                /* ── GRID VIEW ── */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                    {filtered.map(b => {
                        const total = calcTotal(b)
                        const statusColor = STATUS_COLORS[b.status] || '#94A3B8'
                        return (
                            <div
                                key={b.id}
                                onClick={() => setSelected(b)}
                                style={{
                                    background: 'var(--surface)', borderRadius: 20,
                                    border: '1.5px solid var(--border)', cursor: 'pointer',
                                    overflow: 'hidden', transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                                    boxShadow: '0 2px 8px rgba(30,40,80,0.04)',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'
                                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(30,40,80,0.12)'
                                    ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--brand-dominant)'
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(30,40,80,0.04)'
                                    ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
                                }}
                            >
                                <div style={{ height: 4, background: statusColor, borderRadius: '20px 20px 0 0' }} />
                                <div style={{ padding: '18px 20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 14, background: `${statusColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <User size={20} color={statusColor} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{b.customers?.full_name || '—'}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                    <Phone size={11} />{b.customers?.phone || '—'}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`badge ${BOOKING_STATUS_CSS[b.status as BookingStatus] || ''}`} style={{ flexShrink: 0, fontSize: '0.75rem' }}>
                                            {BOOKING_STATUS_LABEL[b.status as BookingStatus] || b.status}
                                        </span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginBottom: 14 }}>
                                        <InfoChip icon={<Briefcase size={13} />} label={b.services?.name || '—'} />
                                        <InfoChip icon={<Calendar size={13} />} label={b.scheduled_date || '—'} />
                                        <InfoChip icon={<Clock size={13} />} label={b.scheduled_time || '—'} />
                                        <InfoChip icon={<MapPin size={13} />} label={b.zones?.name || '—'} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                                        <div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-dominant)' }}>฿{calcTotal(b).toLocaleString()}</div>
                                            <span className={`badge ${b.payment_status === 'paid' ? 'badge-completed' : b.payment_status === 'refunded' ? 'badge-cancelled' : 'badge-pending'}`} style={{ fontSize: '0.7rem', marginTop: 4 }}>
                                                {b.payment_status === 'paid' ? 'ชำระแล้ว' : b.payment_status === 'refunded' ? 'คืนเงิน' : 'รอชำระ'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>พนักงาน</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: b.staff?.full_name ? 'var(--text-primary)' : 'var(--text-muted)' }}>{b.staff?.full_name || 'ยังไม่ได้รับ'}</div>
                                            </div>
                                            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                <ChevronRight size={18} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {b.status === 'pending' && (
                                    <div style={{ padding: '0 20px 16px', display: 'flex', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                                        <button className="btn btn-danger btn-sm" onClick={async () => {
                                            const { data: booking } = await supabase.from('bookings').select('*').eq('id', b.id).single()
                                            if (booking?.staff_id) {
                                                await supabase.from('staff_schedules').update({ is_booked: false })
                                                    .eq('staff_id', booking.staff_id).eq('zone_id', booking.zone_id)
                                                    .eq('date', booking.scheduled_date).eq('time_slot', booking.scheduled_time)
                                            }
                                            const { error: updateErr } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', b.id)
                                            if (!updateErr) {
                                                await trackAuditLog({
                                                    action_type: 'UPDATE',
                                                    entity_type: 'booking',
                                                    entity_id: b.id,
                                                    old_data: booking,
                                                    new_data: { ...(booking || {}), status: 'cancelled' },
                                                    description: `ยกเลิกการจอง ID: ${b.id} ของลูกค้า: ${b.customers?.full_name || 'ไม่ระบุชื่อ'}`
                                                })
                                            }
                                            load()
                                        }}>ยกเลิก</button>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ) : (
                /* ── LIST VIEW ── */
                <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1.5px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(30,40,80,0.04)' }}>
                    {/* List header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1.4fr 1.2fr 1.2fr 1fr 1fr 1fr 44px',
                        gap: 0,
                        padding: '11px 20px',
                        background: 'var(--surface-2)',
                        borderBottom: '1.5px solid var(--border)',
                        fontSize: '0.76rem', fontWeight: 700,
                        color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                        <span>ลูกค้า</span>
                        <span>บริการ</span>
                        <span>วันที่ / เวลา</span>
                        <span>พนักงาน</span>
                        <span>ราคา</span>
                        <span>ชำระ</span>
                        <span>สถานะ</span>
                        <span></span>
                    </div>
                    {filtered.map((b, idx) => {
                        const statusColor = STATUS_COLORS[b.status] || '#94A3B8'
                        return (
                            <div
                                key={b.id}
                                onClick={() => setSelected(b)}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 1.4fr 1.2fr 1.2fr 1fr 1fr 1fr 44px',
                                    gap: 0,
                                    padding: '14px 20px',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                                    transition: 'background 0.15s',
                                    borderLeft: `3px solid ${statusColor}`,
                                }}
                                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'}
                                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                            >
                                {/* Customer */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 11, background: `${statusColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <User size={16} color={statusColor} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{b.customers?.full_name || '—'}</div>
                                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{b.customers?.phone || '—'}</div>
                                    </div>
                                </div>
                                {/* Service */}
                                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', paddingRight: 8 }}>{b.services?.name || '—'}</div>
                                {/* Date/Time */}
                                <div>
                                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{b.scheduled_date || '—'}</div>
                                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{b.scheduled_time || '—'}</div>
                                </div>
                                {/* Staff */}
                                <div style={{ fontSize: '0.88rem', color: b.staff?.full_name ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: b.staff?.full_name ? 'normal' : 'italic' }}>
                                    {b.staff?.full_name || 'ยังไม่ได้รับ'}
                                </div>
                                {/* Price */}
                                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--brand-dominant)' }}>฿{calcTotal(b).toLocaleString()}</div>
                                {/* Payment */}
                                <div>
                                    <span className={`badge ${b.payment_status === 'paid' ? 'badge-completed' : b.payment_status === 'refunded' ? 'badge-cancelled' : 'badge-pending'}`} style={{ fontSize: '0.72rem' }}>
                                        {b.payment_status === 'paid' ? 'ชำระแล้ว' : b.payment_status === 'refunded' ? 'คืนเงิน' : 'รอชำระ'}
                                    </span>
                                </div>
                                {/* Status */}
                                <div>
                                    <span className={`badge ${BOOKING_STATUS_CSS[b.status as BookingStatus] || ''}`} style={{ fontSize: '0.72rem' }}>
                                        {BOOKING_STATUS_LABEL[b.status as BookingStatus] || b.status}
                                    </span>
                                </div>
                                {/* Arrow */}
                                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                    <ChevronRight size={16} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Detail Modal — rendered via portal so position:fixed is viewport-relative */}
            {selected && createPortal(
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(15, 20, 50, 0.55)',
                        backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '24px 16px',
                    }}
                    onClick={() => { setSelected(null); setShowChat(false) }}
                >
                    <div
                        style={{
                            width: '100%', maxWidth: 1100,
                            height: 'min(92vh, 900px)',
                            background: 'var(--bg)', display: 'flex', flexDirection: 'column',
                            borderRadius: 24,
                            boxShadow: '0 32px 80px rgba(15,20,50,0.28)',
                            border: '1px solid var(--border)',
                            animation: 'modalPopIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div style={{
                            padding: '0 32px', height: 72, display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', flexShrink: 0,
                            borderBottom: '1.5px solid var(--border)',
                            background: 'var(--surface)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{
                                    width: 42, height: 42, borderRadius: 13,
                                    background: 'linear-gradient(135deg, var(--brand-dominant), #7C5CFA)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                                }}>
                                    <ClipboardList size={20} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>รายละเอียดการจอง</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
                                        {selected.customers?.full_name} • {selected.id.slice(0, 12)}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                {selected.customers?.line_user_id?.startsWith('walkin_') && (
                                    <button
                                        onClick={() => { setManualBookingToEdit(selected); setShowManualModal(true) }}
                                        style={{
                                            padding: '0 16px', height: 38, borderRadius: 12, border: '1px solid var(--brand-dominant)',
                                            background: 'var(--primary-ghost)', color: 'var(--brand-dominant)',
                                            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s'
                                        }}
                                    >
                                        <Edit2 size={14} /> แก้ไขการจอง
                                    </button>
                                )}
                                <button
                                    onClick={() => { setSelected(null); setShowChat(false) }}
                                    style={{
                                        width: 38, height: 38, borderRadius: 12, border: 'none',
                                        background: 'var(--surface-2)', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--text-muted)', transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--danger-light)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)' }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
                                >
                                    <X size={17} />
                                </button>
                            </div>
                        </div>

                        {/* Tab Bar */}
                        <div style={{ padding: '0 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 0, flexShrink: 0 }}>
                            {[
                                { id: false, icon: <ClipboardList size={15} />, label: 'ข้อมูล' },
                                { id: true, icon: <MessageCircle size={15} />, label: 'แชท', dot: ['confirmed', 'picking_up', 'washing', 'delivering'].includes(selected.status) },
                            ].map(tab => (
                                <button
                                    key={String(tab.id)}
                                    onClick={() => setShowChat(tab.id)}
                                    style={{
                                        padding: '14px 20px', border: 'none', background: 'transparent',
                                        borderBottom: showChat === tab.id ? '2.5px solid var(--brand-dominant)' : '2.5px solid transparent',
                                        color: showChat === tab.id ? 'var(--brand-dominant)' : 'var(--text-muted)',
                                        fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 7,
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {tab.icon} {tab.label}
                                    {tab.dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)' }} />}
                                </button>
                            ))}
                        </div>

                        {/* Body */}
                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {!showChat ? (
                                <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

                                        {/* LEFT: Info */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                                            {/* Customer card */}
                                            <SectionCard title="ลูกค้า" icon={<User size={15} />}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 0' }}>
                                                    <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #EEF1FB, #E0E7FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <User size={22} color="var(--brand-dominant)" />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selected.customers?.full_name}</div>
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{selected.customers?.phone}</div>
                                                    </div>
                                                </div>
                                                <DrawerRow label="รถ" value={`${selected.customers?.vehicle_brand || ''} ${selected.customers?.vehicle_model || ''}`} />
                                                <DrawerRow label="ทะเบียน" value={selected.customers?.license_plate} />
                                            </SectionCard>

                                            {/* Booking details card */}
                                            <SectionCard title="รายละเอียดการจอง" icon={<ClipboardList size={15} />}>
                                                <DrawerRow label="Booking ID" value={<span style={{ fontFamily: 'monospace', fontSize: '0.82rem', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 6 }}>{selected.id.slice(0, 16)}…</span>} />
                                                <DrawerRow label="บริการ" value={selected.services?.name} />
                                                <DrawerRow label="วันที่" value={selected.scheduled_date} />
                                                <DrawerRow label="เวลา" value={selected.scheduled_time} />
                                                <DrawerRow label="โซน" value={selected.zones?.name} />
                                                <DrawerRow label="รับจาก" value={selected.pickup_address} />
                                                <DrawerRow label="ส่งที่" value={selected.delivery_address} />
                                            </SectionCard>

                                            {/* Staff + Status card */}
                                            <SectionCard title="พนักงานและสถานะ" icon={<Briefcase size={15} />}>
                                                <DrawerRow label="พนักงาน" value={selected.staff?.full_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>ยังไม่ได้รับมอบหมาย</span>} />
                                                <DrawerRow label="สถานะงาน" value={
                                                    <span className={`badge ${BOOKING_STATUS_CSS[selected.status as BookingStatus] || ''}`}>
                                                        {BOOKING_STATUS_LABEL[selected.status as BookingStatus]}
                                                    </span>
                                                } />
                                                <DrawerRow label="การชำระ" value={
                                                    <span className={`badge ${selected.payment_status === 'paid' ? 'badge-completed' : selected.payment_status === 'refunded' ? 'badge-cancelled' : 'badge-pending'}`}>
                                                        {selected.payment_status === 'paid' ? 'ชำระแล้ว' : selected.payment_status === 'refunded' ? 'คืนเงิน' : 'รอชำระ'}
                                                    </span>
                                                } />
                                                <DrawerRow label="ยอดรวม" value={<span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--brand-dominant)' }}>฿{calcTotal(selected).toLocaleString()}</span>} />
                                                {selected.discount_code && (
                                                    <DrawerRow label="โค้ดส่วนลด" value={
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                            <span style={{ fontFamily: 'monospace', fontWeight: 700, background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 6, fontSize: '0.88rem' }}>{selected.discount_code}</span>
                                                            {selected.discount_amount > 0 && <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem' }}>-฿{selected.discount_amount.toLocaleString()}</span>}
                                                        </span>
                                                    } />
                                                )}
                                            </SectionCard>

                                            {/* Slip */}
                                            {selected.slip_url && (
                                                <SectionCard title="สลิปโอนเงิน" icon={<ImageIcon size={15} />}>
                                                    <img
                                                        src={selected.slip_url}
                                                        alt="slip"
                                                        style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--border)', cursor: 'zoom-in' }}
                                                        onClick={() => setZoomConfig({ images: [{ src: selected.slip_url, alt: `สลิป: ${selected.customers?.full_name}` }], initialIndex: 0 })}
                                                    />
                                                </SectionCard>
                                            )}
                                        </div>

                                        {/* RIGHT: Photos + Review */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                                            {/* Before photos */}
                                            <SectionCard title={`ภาพก่อนล้าง (${jobPhotos.before.length})`} icon={<ImageIcon size={15} />}>
                                                {jobPhotos.before.length > 0 ? (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                                                        {jobPhotos.before.map((url, i) => (
                                                            <div
                                                                key={i}
                                                                style={{ aspectRatio: '1', borderRadius: 12, overflow: 'hidden', cursor: 'zoom-in', border: '1px solid var(--border)' }}
                                                                onClick={() => setZoomConfig({ images: jobPhotos.before.map(src => ({ src })), initialIndex: i })}
                                                            >
                                                                <img src={url} alt="before" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }}
                                                                    onMouseEnter={e => (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.05)'}
                                                                    onMouseLeave={e => (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <EmptyPhotoState label="ยังไม่มีภาพก่อนล้าง" />}
                                            </SectionCard>

                                            {/* After photos */}
                                            <SectionCard title={`ภาพหลังล้าง (${jobPhotos.after.length})`} icon={<ImageIcon size={15} />} accent>
                                                {jobPhotos.after.length > 0 ? (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                                                        {jobPhotos.after.map((url, i) => (
                                                            <div
                                                                key={i}
                                                                style={{ aspectRatio: '1', borderRadius: 12, overflow: 'hidden', cursor: 'zoom-in', border: '1px solid var(--border)' }}
                                                                onClick={() => setZoomConfig({ images: jobPhotos.after.map(src => ({ src })), initialIndex: i })}
                                                            >
                                                                <img src={url} alt="after" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }}
                                                                    onMouseEnter={e => (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.05)'}
                                                                    onMouseLeave={e => (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <EmptyPhotoState label="ยังไม่มีภาพหลังล้าง" />}
                                            </SectionCard>

                                            {/* Review */}
                                            <SectionCard title="คะแนนและรีวิว" icon={<Star size={15} />}>
                                                {selected.rating ? (
                                                    <div>
                                                        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                                                            {[1, 2, 3, 4, 5].map(star => (
                                                                <Star key={star} size={22}
                                                                    fill={star <= selected.rating ? '#F59E0B' : 'none'}
                                                                    color={star <= selected.rating ? '#F59E0B' : 'var(--border)'}
                                                                />
                                                            ))}
                                                            <span style={{ marginLeft: 8, fontWeight: 700, fontSize: '1.05rem', color: '#F59E0B' }}>{selected.rating}/5</span>
                                                        </div>
                                                        {selected.review_comment ? (
                                                            <div style={{
                                                                background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
                                                                border: '1px solid #FCD34D', borderRadius: 12,
                                                                padding: '14px 16px', fontSize: '0.9rem', lineHeight: 1.6,
                                                                color: 'var(--text-primary)',
                                                            }}>
                                                                "{selected.review_comment}"
                                                            </div>
                                                        ) : (
                                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>ไม่มีความคิดเห็นเพิ่มเติม</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                                                        <Star size={32} style={{ opacity: 0.25, margin: '0 auto 10px' }} />
                                                        <p style={{ fontSize: '0.88rem' }}>ยังไม่มีการรีวิว</p>
                                                    </div>
                                                )}
                                            </SectionCard>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <BookingChat
                                        bookingId={selected.id}
                                        senderId="admin-system"
                                        senderType="admin"
                                        senderName="Admin"
                                isOpen={true}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            , document.body)}

            {zoomConfig && createPortal(
                <ImageZoom
                    images={zoomConfig.images}
                    initialIndex={zoomConfig.initialIndex}
                    onClose={() => setZoomConfig(null)}
                />
            , document.body)}

            {/* Manual Booking Modal */}
            {showManualModal && createPortal(
                <ManualBookingModal
                    initialBooking={manualBookingToEdit}
                    onClose={() => { setShowManualModal(false); setManualBookingToEdit(null) }}
                    onCreated={() => { setShowManualModal(false); setManualBookingToEdit(null); load(); setSelected(null) }}
                />
            , document.body)}

            <style>{`
                @keyframes modalPopIn {
                    from { transform: scale(0.93) translateY(12px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}

// Persisted last-used customer across modal opens (module-level so it survives re-renders)


function ManualBookingModal({ onClose, onCreated, initialBooking = null }: { onClose: () => void; onCreated: () => void; initialBooking?: any }) {
    // ── Pre-fill data if editing ──
    const isEdit = !!initialBooking
    const [customerId, setCustomerId] = useState(initialBooking?.customer_id || '')
    const [customerName, setCustomerName] = useState(initialBooking?.customers?.full_name || '')
    const [customerPhone, setCustomerPhone] = useState(initialBooking?.customers?.phone || '')
    
    // Parse vehicle data if available
    let initVeh = { brand: '', model: '', color: '', plate: '', size: 'S' }
    if (initialBooking?.vehicle_data) {
        if (typeof initialBooking.vehicle_data === 'string') {
            try { initVeh = JSON.parse(initialBooking.vehicle_data) } catch (e) {}
        } else {
            initVeh = initialBooking.vehicle_data
        }
    }
    const [vehicleBrand, setVehicleBrand] = useState(initVeh.brand || initialBooking?.vehicle_brand || '')
    const [vehicleModel, setVehicleModel] = useState(initVeh.model || initialBooking?.vehicle_model || '')
    const [vehicleColor, setVehicleColor] = useState(initVeh.color || initialBooking?.vehicle_color || '')
    const [licensePlate, setLicensePlate] = useState(initVeh.plate || initialBooking?.license_plate || '')
    const [vehicleSize, setVehicleSize] = useState(initVeh.size || initialBooking?.vehicle_size || 'S')
    
    // Addresses
    const [pickupAddress, setPickupAddress] = useState(initialBooking?.pickup_address || '')
    const [deliveryAddress, setDeliveryAddress] = useState(initialBooking?.delivery_address || '')

    const [selectedBranchId, setSelectedBranchId] = useState(initialBooking?.branch_id || '')
    const [selectedZoneId, setSelectedZoneId] = useState(initialBooking?.zone_id || '')
    const [selectedStaffId, setSelectedStaffId] = useState(initialBooking?.staff_id || '')
    const [selectedDate, setSelectedDate] = useState(initialBooking?.scheduled_date || '')
    const [selectedTime, setSelectedTime] = useState(initialBooking?.scheduled_time || '')
    const [selectedServiceId, setSelectedServiceId] = useState(initialBooking?.service_id || '')
    const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(initialBooking?.addon_ids || [])

    const [basePrice, setBasePrice] = useState(initialBooking?.base_price || 0)
    const [extraFee, setExtraFee] = useState(initialBooking?.extra_fee || 0)
    const [totalPrice, setTotalPrice] = useState(initialBooking?.total_price || 0)
    const [discountCode, setDiscountCode] = useState(initialBooking?.discount_code || '')
    const [discountAmount, setDiscountAmount] = useState(initialBooking?.discount_amount || 0)
    const [discountError, setDiscountError] = useState('')
    const [isCheckingDiscount, setIsCheckingDiscount] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState(initialBooking?.payment_method || 'transfer')
    const [paymentStatus, setPaymentStatus] = useState(initialBooking?.payment_status || 'pending')

    const [note, setNote] = useState(initialBooking?.customer_note || '')

    // ── Data from DB ──
    const [branches, setBranches] = useState<any[]>([])
    const [zones, setZones] = useState<any[]>([])
    const [staffList, setStaffList] = useState<any[]>([])
    const [services, setServices] = useState<any[]>([])
    const [serviceAddons, setServiceAddons] = useState<any[]>([])
    const [schedules, setSchedules] = useState<any[]>([])
    const [recentCustomers, setRecentCustomers] = useState<any[]>([])
    const [showRecentPicker, setShowRecentPicker] = useState(false)

    // ── Live search by phone ──
    const [foundCustomer, setFoundCustomer] = useState<any>(null)
    const [isSearchingPhone, setIsSearchingPhone] = useState(false)

    useEffect(() => {
        if (!customerPhone || customerPhone.length < 9) {
            setFoundCustomer(null)
            return
        }
        const timer = setTimeout(async () => {
            setIsSearchingPhone(true)
            const { data } = await supabase
                .from('customers')
                .select('id, full_name, phone, vehicle_brand, vehicle_model, vehicle_color, license_plate, vehicle_size, saved_locations, line_user_id')
                .eq('phone', customerPhone.trim())
                .limit(1)
                
            if (data && data.length > 0) {
                // don't show prompt if it's already filled with this exact customer
                if (customerId !== data[0].id) {
                    setFoundCustomer(data[0])
                } else {
                    setFoundCustomer(null)
                }
            } else {
                setFoundCustomer(null)
            }
            setIsSearchingPhone(false)
        }, 500)
        return () => clearTimeout(timer)
    }, [customerPhone, customerId])

    // ── Fill from a previous/recent customer ──
    const fillFromCustomer = (c: any) => {
        setCustomerId(c.id || '')
        setCustomerName(c.name || '')
        setCustomerPhone(c.phone || '')
        setVehicleBrand(c.brand || '')
        setVehicleModel(c.model || '')
        setVehicleColor(c.color || '')
        setLicensePlate(c.plate || '')
        setVehicleSize(c.size || 'S')
        setPickupAddress(c.pickup || '')
        setShowRecentPicker(false)
    }

    const todayStr = (() => {
        const now = new Date()
        const thTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
        return thTime.getFullYear() + '-' + String(thTime.getMonth() + 1).padStart(2, '0') + '-' + String(thTime.getDate()).padStart(2, '0')
    })()
    const isPastDate = selectedDate && selectedDate < todayStr

    // ── Load initial data ──
    useEffect(() => {
        Promise.all([
            supabase.from('branches').select('*').eq('is_active', true),
            supabase.from('zones').select('*').eq('is_active', true),
            supabase.from('staff').select('*').eq('is_active', true),
            supabase.from('services').select('*').eq('is_active', true).order('price_s'),
supabase.from('service_addons').select('*').eq('is_active', true),
        ]).then(([brRes, znRes, stRes, svcRes, adnRes]) => {
            if (brRes.data) { setBranches(brRes.data); if (!isEdit && brRes.data.length > 0) setSelectedBranchId(brRes.data[0].id) }
            if (znRes.data) setZones(znRes.data)
            if (stRes.data) setStaffList(stRes.data)
            if (svcRes.data) setServices(svcRes.data)
            if (adnRes.data) setServiceAddons(adnRes.data)
        })
        if (!isEdit) setSelectedDate(todayStr)

        // Load recent walk-in customers from database
        supabase
            .from('customers')
            .select('id, full_name, phone, vehicle_brand, vehicle_model, vehicle_color, license_plate, vehicle_size, saved_locations')
            .like('line_user_id', 'walkin_%')
            .order('created_at', { ascending: false })
            .limit(15)
            .then(({ data }) => {
                if (data) {
                    const mapped = data.map(c => ({
                        id: c.id,
                        name: c.full_name,
                        phone: c.phone || '',
                        brand: c.vehicle_brand || '',
                        model: c.vehicle_model || '',
                        color: c.vehicle_color || '',
                        plate: c.license_plate || '',
                        size: c.vehicle_size || 'S',
                        pickup: c.saved_locations?.[0]?.address || ''
                    }))
                    setRecentCustomers(mapped)
                }
            })
    }, [todayStr, isEdit])

    // ── Load schedules when branch/zone/date change ──
    useEffect(() => {
        if (!selectedBranchId || !selectedDate) return
        const activeZones = selectedZoneId
            ? [selectedZoneId]
            : zones.filter(z => z.branch_id === selectedBranchId).map(z => z.id)

        if (activeZones.length === 0) { setSchedules([]); return }

        supabase
            .from('staff_schedules')
            .select('id, staff_id, zone_id, date, time_slot, is_booked, work_type')
            .in('zone_id', activeZones)
            .eq('date', selectedDate)
            .then(({ data }) => setSchedules(data || []))
    }, [selectedBranchId, selectedZoneId, selectedDate, zones])

    // ── Auto-fill price when service changes ──
    useEffect(() => {
        if (!selectedServiceId) { if (!isEdit) setBasePrice(0); return }
        const svc = services.find(s => s.id === selectedServiceId)
        if (!svc) return
        const sizeKey = `price_${vehicleSize.toLowerCase()}`
        const price = Number(svc[sizeKey] || svc.price_s || 0)
        setBasePrice(price)
    }, [selectedServiceId, vehicleSize, services, isEdit])

    // ── Calculate total ──
    useEffect(() => {
        setTotalPrice(Math.max(0, basePrice + extraFee - discountAmount))
    }, [basePrice, extraFee, discountAmount])

    // ── Derived data ──
    const branchZones = zones.filter(z => z.branch_id === selectedBranchId)
    const branchStaff = staffList.filter(s => s.branch_id === selectedBranchId)

    // Available time slots (not yet booked for any staff in this zone)
    const availableSlots = TIME_SLOTS.filter(slot => {
        if (!selectedStaffId) return true
        const staffSlots = schedules.filter(s => s.staff_id === selectedStaffId && (s.time_slot === slot || s.time_slot?.startsWith(slot)))
        // Staff has a schedule entry for this slot AND it's not booked
        return staffSlots.some(s => !s.is_booked)
    })

    // Available staff for selected time slot
    const availableStaff = selectedTime && !isPastDate
        ? branchStaff.filter(st => {
            const staffSlots = schedules.filter(s => s.staff_id === st.id && (s.time_slot === selectedTime || s.time_slot?.startsWith(selectedTime)))
            return staffSlots.some(s => !s.is_booked)
        })
        : branchStaff

    const handleCheckDiscount = async () => {
        if (!discountCode.trim()) return;
        setIsCheckingDiscount(true);
        setDiscountError('');
        try {
            const res = await fetch('/api/discount/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: discountCode,
                    customerId: customerId,
                    basePrice: basePrice + extraFee,
                    branchId: selectedBranchId,
                    zoneId: selectedZoneId,
                    bookingId: isEdit ? initialBooking.id : undefined
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'ตรวจสอบไม่ผ่าน');
            
            const amt = data.discount_amount || 0;
            setDiscountAmount(amt);
            
            // Auto calculate new total price
            const gross = basePrice + extraFee;
            setTotalPrice(Math.max(0, gross - amt));
            
        } catch (err: any) {
            setDiscountError(err.message);
            setDiscountAmount(0);
            setTotalPrice(basePrice + extraFee); // Reset to gross
        } finally {
            setIsCheckingDiscount(false);
        }
    }

    // ── Submit ──
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async () => {
        if (!customerName.trim()) { setError('กรุณากรอกชื่อลูกค้า'); return }
        if (!selectedServiceId) { setError('กรุณาเลือกแพ็กเกจ'); return }
        if (!selectedBranchId) { setError('กรุณาเลือกสาขา'); return }
        if (!selectedZoneId) { setError('กรุณาเลือกโซน'); return }
        if (!selectedStaffId) { setError('กรุณาเลือกพนักงาน'); return }
        if (!selectedDate) { setError('กรุณาเลือกวันที่'); return }
        if (!selectedTime) { setError('กรุณาเลือกเวลา'); return }

        setSubmitting(true)
        setError('')

        try {
            const bookingId = isEdit ? initialBooking.id : generateScalableId('BK')
            const adminId = typeof window !== 'undefined' ? localStorage.getItem('shop_admin_token') || localStorage.getItem('admin_token') // BUG-11 FIX : 'unknown'
            
            const payload = {
                id: isEdit ? initialBooking.id : `MANUAL-${Date.now()}`,
                admin_id: adminId,
                customer_id: customerId,
                customer_name: customerName,
                customer_phone: customerPhone,
                vehicle_brand: vehicleBrand,
                vehicle_model: vehicleModel,
                vehicle_color: vehicleColor,
                license_plate: licensePlate,
                vehicle_size: vehicleSize,
                pickup_address: pickupAddress,
                delivery_address: deliveryAddress,
                branch_id: selectedBranchId,
                zone_id: selectedZoneId,
                staff_id: selectedStaffId,
                scheduled_date: selectedDate,
                scheduled_time: selectedTime,
                service_id: selectedServiceId,
                addon_ids: selectedAddonIds,
                base_price: basePrice,
                extra_fee: extraFee,
                total_price: totalPrice,
                discount_code: discountCode,
                discount_amount: discountAmount,
                payment_method: paymentMethod,
                payment_status: paymentStatus,
                customer_note: note,
            }
            
            const endpoint = isEdit ? '/api/bookings/manual/edit' : '/api/bookings/manual'
            
            const res = await fetch(endpoint, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')

            onCreated()
        } catch (e: any) {
            setError(e.message || 'เกิดข้อผิดพลาด')
        } finally {
            setSubmitting(false)
        }
    }

    const sectionStyle: React.CSSProperties = {
        background: 'var(--surface)', borderRadius: 16,
        border: '1.5px solid var(--border)', overflow: 'hidden',
    }
    const sectionHeaderStyle: React.CSSProperties = {
        padding: '13px 18px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--surface-2)',
    }
    const sectionBodyStyle: React.CSSProperties = { padding: '16px 18px' }
    const fieldRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }
    const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }
    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 14px', border: '2px solid var(--border)',
        borderRadius: 12, fontSize: '0.9rem', color: 'var(--text-primary)',
        background: 'var(--surface)', outline: 'none', transition: 'border-color 0.2s',
        fontFamily: 'var(--font-main)',
    }

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(15, 20, 50, 0.55)',
                backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '24px 16px',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '100%', maxWidth: 860,
                    maxHeight: '92vh',
                    background: 'var(--bg)', display: 'flex', flexDirection: 'column',
                    borderRadius: 24,
                    boxShadow: '0 32px 80px rgba(15,20,50,0.28)',
                    border: '1px solid var(--border)',
                    animation: 'modalPopIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '0 28px', height: 72, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', flexShrink: 0,
                    borderBottom: '1.5px solid var(--border)',
                    background: 'var(--surface)', borderRadius: '24px 24px 0 0',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                            width: 42, height: 42, borderRadius: 13,
                            background: 'linear-gradient(135deg, var(--brand-dominant), #7C5CFA)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                        }}>
                            <Plus size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{isEdit ? 'แก้ไขการจอง (Manual)' : 'เพิ่มการจองใหม่ (Manual)'}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
                                {isEdit ? `กำลังแก้ไขข้อมูลของการจอง ${initialBooking?.id?.slice(0, 8)}` : 'สำหรับลูกค้าที่จองผ่าน LINE หรือช่องทางอื่น'}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 38, height: 38, borderRadius: 12, border: 'none',
                            background: 'var(--surface-2)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-muted)', transition: 'all 0.15s',
                        }}
                    >
                        <X size={17} />
                    </button>
                </div>

                {/* Body — scrollable */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                        {/* ── LEFT COLUMN ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* Customer Info */}
                            <div style={sectionStyle}>
                                <div style={sectionHeaderStyle}>
                                    <User size={15} color="var(--brand-dominant)" />
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>ข้อมูลลูกค้า</span>
                                    {recentCustomers.length > 0 && (
                                        <div style={{ marginLeft: 'auto', position: 'relative' }}>
                                            <button
                                                onClick={() => setShowRecentPicker(p => !p)}
                                                style={{
                                                    fontSize: '0.75rem', fontWeight: 700, border: '1.5px solid var(--brand-dominant)',
                                                    color: 'var(--brand-dominant)', background: 'var(--primary-ghost)',
                                                    borderRadius: 10, padding: '4px 10px', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: 5,
                                                }}
                                            >
                                                <User size={12} /> ลูกค้าเดิม ({recentCustomers.length})
                                            </button>
                                            {showRecentPicker && (
                                                <div style={{
                                                    position: 'absolute', top: '110%', right: 0, zIndex: 100,
                                                    background: 'var(--surface)', border: '1.5px solid var(--border)',
                                                    borderRadius: 14, boxShadow: '0 8px 32px rgba(30,40,80,0.15)',
                                                    minWidth: 280, maxHeight: 280, overflowY: 'auto',
                                                    padding: '8px 0',
                                                }}>
                                                    <div style={{ padding: '6px 14px 8px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                                                        เลือกลูกค้าที่เคยจองมาแล้ว
                                                    </div>
                                                    {recentCustomers.map((c: any, i: number) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => fillFromCustomer(c)}
                                                            style={{
                                                                width: '100%', border: 'none', background: 'transparent',
                                                                textAlign: 'left', padding: '9px 14px', cursor: 'pointer',
                                                                transition: 'background 0.12s',
                                                            }}
                                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                        >
                                                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{c.name}</div>
                                                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                                                {c.phone && <span>{c.phone} • </span>}
                                                                {c.brand} {c.model} {c.plate && `(${c.plate})`}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div style={sectionBodyStyle}>
                                    <div style={fieldRow}>
                                        <div>
                                            <label style={labelStyle}>ชื่อลูกค้า *</label>
                                            <input style={inputStyle} placeholder="ชื่อ-นามสกุล" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>เบอร์โทร</label>
                                            <input style={inputStyle} placeholder="08x-xxx-xxxx" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                                            {foundCustomer && (
                                                <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--primary-ghost)', borderRadius: 10, border: '1px solid var(--brand-dominant)', fontSize: '0.8rem', animation: 'modalPopIn 0.2s ease-out' }}>
                                                    <div style={{ color: 'var(--brand-dominant)', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <User size={14} /> พบข้อมูลในระบบ: {foundCustomer.full_name} 
                                                        <span style={{ fontWeight: 400, opacity: 0.8 }}>
                                                            {foundCustomer.line_user_id?.startsWith('walkin_') ? '(Walk-in)' : '(สมาชิกระบบ)'}
                                                        </span>
                                                    </div>
                                                    <button 
                                                        onClick={() => fillFromCustomer({
                                                            id: foundCustomer.id,
                                                            name: foundCustomer.full_name,
                                                            phone: foundCustomer.phone,
                                                            brand: foundCustomer.vehicle_brand,
                                                            model: foundCustomer.vehicle_model,
                                                            color: foundCustomer.vehicle_color,
                                                            plate: foundCustomer.license_plate,
                                                            size: foundCustomer.vehicle_size,
                                                            pickup: foundCustomer.saved_locations?.[0]?.address || ''
                                                        })}
                                                        style={{ background: 'var(--brand-dominant)', color: 'white', padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, width: '100%', transition: 'opacity 0.2s' }}
                                                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                                                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                                    >
                                                        ใช้ข้อมูลและรถของลูกค้ารายนี้
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={fieldRow}>
                                        <div>
                                            <label style={labelStyle}>ยี่ห้อรถ</label>
                                            <input style={inputStyle} placeholder="เช่น Honda, Yamaha" value={vehicleBrand} onChange={e => setVehicleBrand(e.target.value)} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>รุ่นรถ</label>
                                            <input style={inputStyle} placeholder="เช่น Click, Wave" value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} />
                                        </div>
                                    </div>
                                    <div style={fieldRow}>
                                        <div>
                                            <label style={labelStyle}>สีรถ</label>
                                            <input style={inputStyle} placeholder="เช่น แดง, ดำ" value={vehicleColor} onChange={e => setVehicleColor(e.target.value)} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>ทะเบียน</label>
                                            <input style={inputStyle} placeholder="เช่น กข 1234" value={licensePlate} onChange={e => setLicensePlate(e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>ขนาดรถ (CC)</label>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                            {(['S', 'M', 'L'] as const).map(sz => (
                                                <button
                                                    key={sz}
                                                    onClick={() => setVehicleSize(sz)}
                                                    style={{
                                                        flex: 1, padding: '10px 8px', borderRadius: 12,
                                                        border: vehicleSize === sz ? '2px solid var(--brand-dominant)' : '2px solid var(--border)',
                                                        background: vehicleSize === sz ? 'var(--primary-ghost)' : 'var(--surface)',
                                                        color: vehicleSize === sz ? 'var(--brand-dominant)' : 'var(--text-secondary)',
                                                        fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                                                        transition: 'all 0.15s', fontFamily: 'var(--font-main)',
                                                    }}
                                                >
                                                    <div>{sz}</div>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 400, marginTop: 2 }}>{VEHICLE_SIZE_LABEL[sz]}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Service Selection */}
                            <div style={sectionStyle}>
                                <div style={sectionHeaderStyle}>
                                    <Briefcase size={15} color="var(--brand-dominant)" />
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>แพ็กเกจและบริการ</span>
                                </div>
                                <div style={sectionBodyStyle}>
                                    <div>
                                        <label style={labelStyle}>เลือกแพ็กเกจ *</label>
                                        <select
                                            style={{ ...inputStyle, cursor: 'pointer' }}
                                            value={selectedServiceId}
                                            onChange={e => setSelectedServiceId(e.target.value)}
                                        >
                                            <option value="">-- เลือกแพ็กเกจ --</option>
                                            {services.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} — ฿{s[`price_${vehicleSize.toLowerCase()}`] || s.price_s}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {serviceAddons.length > 0 && (
                                        <div style={{ marginTop: 14 }}>
                                            <label style={labelStyle}>บริการเสริม</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                                                {serviceAddons.map(addon => (
                                                    <label
                                                        key={addon.id}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: 10,
                                                            padding: '10px 14px', borderRadius: 12,
                                                            border: selectedAddonIds.includes(addon.id) ? '2px solid var(--brand-dominant)' : '2px solid var(--border)',
                                                            background: selectedAddonIds.includes(addon.id) ? 'var(--primary-ghost)' : 'var(--surface)',
                                                            cursor: 'pointer', transition: 'all 0.15s',
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedAddonIds.includes(addon.id)}
                                                            onChange={e => {
                                                                if (e.target.checked) setSelectedAddonIds(p => [...p, addon.id])
                                                                else setSelectedAddonIds(p => p.filter(id => id !== addon.id))
                                                            }}
                                                            style={{ width: 18, height: 18, accentColor: 'var(--brand-dominant)' }}
                                                        />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{addon.name}</div>
                                                            {addon.price > 0 && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>฿{addon.price}</div>}
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Location */}
                            <div style={sectionStyle}>
                                <div style={sectionHeaderStyle}>
                                    <MapPin size={15} color="var(--brand-dominant)" />
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>ที่อยู่</span>
                                </div>
                                <div style={sectionBodyStyle}>
                                    <div style={{ marginBottom: 12 }}>
                                        <label style={labelStyle}>ที่อยู่รับรถ</label>
                                        <input style={inputStyle} placeholder="เช่น หอพักหลังมอ ตรงข้ามเซเว่น" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>ที่อยู่ส่งรถ (ถ้าต่างจากจุดรับ)</label>
                                        <input style={inputStyle} placeholder="เว้นว่างถ้าส่งจุดเดิม" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── RIGHT COLUMN ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* Schedule */}
                            <div style={sectionStyle}>
                                <div style={sectionHeaderStyle}>
                                    <Calendar size={15} color="var(--brand-dominant)" />
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>กำหนดการและพนักงาน</span>
                                </div>
                                <div style={sectionBodyStyle}>
                                    <div style={fieldRow}>
                                        <div>
                                            <label style={labelStyle}>สาขา *</label>
                                            <select style={{ ...inputStyle, cursor: 'pointer' }} value={selectedBranchId} onChange={e => { setSelectedBranchId(e.target.value); setSelectedZoneId(''); setSelectedStaffId('') }}>
                                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>โซน *</label>
                                            <select style={{ ...inputStyle, cursor: 'pointer' }} value={selectedZoneId} onChange={e => { setSelectedZoneId(e.target.value); setSelectedStaffId('') }}>
                                                <option value="">-- เลือกโซน --</option>
                                                {branchZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div style={fieldRow}>
                                        <div>
                                            <label style={labelStyle}>วันที่ *</label>
                                            <input type="date" style={inputStyle} value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSelectedTime(''); setSelectedStaffId('') }} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>เวลา *</label>
                                            <select style={{ ...inputStyle, cursor: 'pointer' }} value={selectedTime} onChange={e => { setSelectedTime(e.target.value); setSelectedStaffId('') }}>
                                                <option value="">-- เลือกเวลา --</option>
                                                {TIME_SLOTS.map(slot => {
                                                    const hasSchedule = schedules.some(s => (s.time_slot === slot || s.time_slot?.startsWith(slot)) && !s.is_booked)
                                                    return (
                                                        <option key={slot} value={slot} disabled={isPastDate ? false : (!hasSchedule && selectedZoneId !== '')}>
                                                            {slot} {isPastDate ? '' : (hasSchedule ? '✓' : selectedZoneId ? '(ไม่มีพนักงาน)' : '')}
                                                        </option>
                                                    )
                                                })}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>พนักงาน *</label>
                                        <select style={{ ...inputStyle, cursor: 'pointer' }} value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)}>
                                            <option value="">-- เลือกพนักงาน --</option>
                                            {availableStaff.map(st => {
                                                const isAvail = selectedTime
                                                    ? schedules.some(s => s.staff_id === st.id && (s.time_slot === selectedTime || s.time_slot?.startsWith(selectedTime)) && !s.is_booked)
                                                    : true
                                                return (
                                                    <option key={st.id} value={st.id} disabled={isPastDate ? false : (selectedTime ? !isAvail : false)}>
                                                        {st.full_name} {isPastDate ? '' : (selectedTime && isAvail ? '✓ ว่าง' : selectedTime && !isAvail ? '(ไม่ว่าง)' : '')}
                                                    </option>
                                                )
                                            })}
                                        </select>
                                        {!isPastDate && selectedTime && availableStaff.filter(st => schedules.some(s => s.staff_id === st.id && (s.time_slot === selectedTime || s.time_slot?.startsWith(selectedTime)) && !s.is_booked)).length === 0 && selectedZoneId && (
                                            <div style={{ fontSize: '0.78rem', color: 'var(--danger)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                ⓘ ไม่มีพนักงานว่างในเวลานี้
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Pricing */}
                            <div style={sectionStyle}>
                                <div style={sectionHeaderStyle}>
                                    <Tag size={15} color="var(--brand-dominant)" />
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>ราคา</span>
                                </div>
                                <div style={sectionBodyStyle}>
                                    <div style={fieldRow}>
                                        <div>
                                            <label style={labelStyle}>ราคาแพ็กเกจ (฿)</label>
                                            <input type="number" style={inputStyle} value={basePrice} onChange={e => setBasePrice(Number(e.target.value) || 0)} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>ค่าเดินทาง/เพิ่มเติม (฿)</label>
                                            <input type="number" style={inputStyle} value={extraFee} onChange={e => setExtraFee(Number(e.target.value) || 0)} />
                                        </div>
                                    </div>
                                    <div style={{
                                        background: 'linear-gradient(135deg, var(--primary-ghost), #EEF1FB)',
                                        borderRadius: 14, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12,
                                        border: '1.5px solid var(--border)',
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ส่วนลด</span>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <input 
                                                            type="text" 
                                                            style={{ ...inputStyle, width: 100, textAlign: 'center', fontFamily: 'monospace', fontSize: '0.8rem', padding: '4px 8px', height: 'auto', textTransform: 'uppercase' }} 
                                                            placeholder="CODE"
                                                            value={discountCode} 
                                                            onChange={e => setDiscountCode(e.target.value.toUpperCase())} 
                                                        />
                                                        <button 
                                                            onClick={handleCheckDiscount}
                                                            disabled={!discountCode.trim() || isCheckingDiscount}
                                                            style={{ 
                                                                background: discountCode.trim() ? 'var(--brand-dominant)' : '#e2e8f0', 
                                                                color: 'white', 
                                                                border: 'none', 
                                                                borderRadius: 8, 
                                                                padding: '0 10px', 
                                                                fontSize: '0.75rem', 
                                                                fontWeight: 700,
                                                                cursor: discountCode.trim() && !isCheckingDiscount ? 'pointer' : 'not-allowed',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            {isCheckingDiscount ? '...' : 'ใช้โค้ด'}
                                                        </button>
                                                    </div>
                                                    <div style={{ position: 'relative', width: 90 }}>
                                                        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>฿</span>
                                                        <input type="number" style={{ ...inputStyle, paddingLeft: 22, textAlign: 'right', color: 'var(--danger)', fontWeight: 700 }} value={discountAmount} onChange={e => { setDiscountAmount(Number(e.target.value)); setTotalPrice(Math.max(0, basePrice + extraFee - Number(e.target.value))); }} />
                                                    </div>
                                                </div>
                                            </div>
                                            {discountError && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--danger)', textAlign: 'right' }}>
                                                    {discountError}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{
                                            borderTop: '2px dashed var(--border)', paddingTop: 12,
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ยอดรวม (สุทธิ)</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ position: 'relative', fontSize: '1.3rem', fontWeight: 800, color: 'var(--brand-dominant)' }}>฿</span>
                                                <input type="number" style={{ ...inputStyle, width: 120, fontSize: '1.3rem', fontWeight: 800, color: 'var(--brand-dominant)', padding: '0 8px', textAlign: 'right', background: 'transparent', border: 'none', borderBottom: '2px solid var(--brand-dominant)', borderRadius: 0 }} value={totalPrice} onChange={e => setTotalPrice(Number(e.target.value))} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment */}
                            <div style={sectionStyle}>
                                <div style={sectionHeaderStyle}>
                                    <CreditCard size={15} color="var(--brand-dominant)" />
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>การชำระเงิน</span>
                                </div>
                                <div style={sectionBodyStyle}>
                                    <div style={fieldRow}>
                                        <div>
                                            <label style={labelStyle}>วิธีชำระ</label>
                                            <select style={{ ...inputStyle, cursor: 'pointer' }} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                                <option value="transfer">โอนเงิน</option>
                                                <option value="cash">เงินสด</option>
                                                <option value="stripe">Stripe</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>สถานะการชำระ</label>
                                            <select style={{ ...inputStyle, cursor: 'pointer' }} value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
                                                <option value="pending">รอชำระ</option>
                                                <option value="paid">ชำระแล้ว</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Note */}
                            <div style={sectionStyle}>
                                <div style={sectionHeaderStyle}>
                                    <FileText size={15} color="var(--brand-dominant)" />
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>หมายเหตุ</span>
                                </div>
                                <div style={sectionBodyStyle}>
                                    <textarea
                                        style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                                        placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 28px', borderTop: '1.5px solid var(--border)',
                    background: 'var(--surface)', borderRadius: '0 0 24px 24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                }}>
                    {error && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            ⓘ {error}
                        </div>
                    )}
                    {!error && <div />}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-ghost" style={{ borderRadius: 14 }} onClick={onClose}>ยกเลิก</button>
                        <button
                            className="btn btn-primary"
                            style={{ borderRadius: 14, gap: 8, minWidth: 160 }}
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? <><span className="spinner" style={{ width: 16, height: 16 }} /> กำลังบันทึก...</> : <><Plus size={16} /> {isEdit ? 'บันทึกการแก้ไข' : 'สร้างการจอง'}</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--surface-2)', borderRadius: 8,
            padding: '5px 10px', fontSize: '0.82rem', color: 'var(--text-secondary)',
        }}>
            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{icon}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        </div>
    )
}

function DrawerRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.83rem', width: 90, flexShrink: 0, paddingTop: 2 }}>{label}</span>
            <span style={{ fontWeight: 500, fontSize: '0.92rem', flex: 1 }}>{value || '—'}</span>
        </div>
    )
}

function SectionCard({ title, icon, children, accent }: { title: string; icon: React.ReactNode; children: React.ReactNode; accent?: boolean }) {
    return (
        <div style={{
            background: 'var(--surface)', borderRadius: 16,
            border: accent ? '1.5px solid #D1FAE5' : '1.5px solid var(--border)',
            overflow: 'hidden',
        }}>
            <div style={{
                padding: '13px 18px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8,
                background: accent ? 'linear-gradient(135deg, #F0FDF4, #ECFDF5)' : 'var(--surface-2)',
            }}>
                <span style={{ color: accent ? '#10B981' : 'var(--brand-dominant)' }}>{icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: accent ? '#065F46' : 'var(--text-primary)' }}>{title}</span>
            </div>
            <div style={{ padding: '14px 18px' }}>{children}</div>
        </div>
    )
}

function EmptyPhotoState({ label }: { label: string }) {
    return (
        <div style={{
            textAlign: 'center', padding: '28px 0',
            color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
            <ImageIcon size={28} style={{ opacity: 0.25 }} />
            <p style={{ fontSize: '0.85rem' }}>{label}</p>
        </div>
    )
}
