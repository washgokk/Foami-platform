'use client'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_CSS, BookingStatus } from '@/lib/types'
import { Search, ClipboardList, MessageCircle, Star, Image as ImageIcon, User, MapPin, Calendar, Clock, Phone, Briefcase, ChevronRight, X, LayoutGrid, List } from 'lucide-react'
import ImageZoom from '@/components/Global/ImageZoom'
import BookingChat from '@/components/Chat/BookingChat'

export default function AdminBookingsPage() {
    const [bookings, setBookings] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<any>(null)
    const [addons, setAddons] = useState<any[]>([])
    const [zoomConfig, setZoomConfig] = useState<{ images: { src: string; alt?: string }[]; initialIndex: number } | null>(null)
    const [showChat, setShowChat] = useState(false)
    const [jobPhotos, setJobPhotos] = useState<{ before: string[], after: string[] }>({ before: [], after: [] })
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

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
            let q = supabase.from('bookings').select('*').order('created_at', { ascending: false })
            if (filter !== 'all') q = q.eq('status', filter)

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
        return (b.base_price || 0) + addonTotal + (b.travel_surcharge || 0) + (b.different_spot_fee || 0) + (b.additional_price || 0) - (b.discount_amount || 0)
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
                                            await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', b.id)
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

            <style>{`
                @keyframes modalPopIn {
                    from { transform: scale(0.93) translateY(12px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }
            `}</style>
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
