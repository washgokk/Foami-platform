'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_CSS, BookingStatus } from '@/lib/types'
import { Search, Filter, ClipboardList, Trash2, X, ChevronRight, User, Package, Calendar as CalendarIcon, MapPin, Phone, CreditCard, MessageCircle } from 'lucide-react'
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

    const load = useCallback(async () => {
        setLoading(true)
        try {
            let q = supabase.from('bookings').select('*').order('created_at', { ascending: false })
            if (filter !== 'all') q = q.eq('status', filter)
            
            const [bookingRes, addonRes] = await Promise.all([
                q,
                supabase.from('addons').select('*')
            ])
            
            if (bookingRes.error) throw bookingRes.error
            if (addonRes.data) setAddons(addonRes.data)
            
            const rawBookings = bookingRes.data || []
            
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
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ClipboardList size={28} color="var(--brand-dominant)" /> การจองทั้งหมด
                    </h1>
                    <p className="page-subtitle">{filtered.length} รายการที่พบ</p>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-8)', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
                    <Search size={18} style={{ position: 'absolute', left: 16, top: 14, color: 'var(--text-muted)', opacity: 0.6 }} />
                    <input 
                        className="form-input" 
                        style={{ paddingLeft: 46, borderRadius: '18px' }} 
                        placeholder="ค้นหา ชื่อ / เบอร์ / ID..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                    />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', background: 'var(--surface-2)', padding: 6, borderRadius: '20px' }}>
                    {STATUS_OPTIONS.map(s => (
                        <button 
                            key={s} 
                            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`} 
                            style={{ 
                                borderRadius: '14px', 
                                padding: '6px 14px',
                                background: filter === s ? 'var(--brand-dominant)' : 'transparent',
                                border: 'none',
                                color: filter === s ? 'white' : 'var(--text-muted)'
                            }}
                            onClick={() => setFilter(s)}
                        >
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
                                <tr>
                                    <td colSpan={8}>
                                        <div className="empty-state" style={{ padding: 'var(--space-12)' }}>
                                            <div style={{ background: 'var(--surface-2)', width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--text-muted)' }}>
                                                <ClipboardList size={32} />
                                            </div>
                                            <p className="empty-state-title" style={{ fontWeight: 800 }}>ยังไม่มีการจอง</p>
                                        </div>
                                    </td>
                                </tr>
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
                                     <td style={{ fontWeight: 700 }}>
                                        {(() => {
                                            const pkgMarkup = b.package_markup_amount || 0
                                            const ccAdj = ((b.total_price || 0) + (b.discount_amount || 0) - (b.extra_fee || 0) - (b.travel_surcharge || 0) - (b.different_spot_fee || 0)) - (b.services?.price_s || b.services?.price || 0)
                                            
                                            let addonTotal = 0
                                            if (Array.isArray(b.addon_ids)) {
                                                b.addon_ids.forEach((a: any) => {
                                                    if (typeof a === 'string') {
                                                        const ad = addons.find(da => da.id === a || da.name === a)
                                                        addonTotal += (ad?.price || 0)
                                                    } else {
                                                        // Rich Addon Object
                                                        if (a.isFree) addonTotal += 0
                                                        else if (a.selectedPrice !== undefined) addonTotal += a.selectedPrice
                                                        else if (a.price !== undefined) addonTotal += a.price
                                                        else if (a.variableState?.customAmount) addonTotal += (Number(a.variableState.customAmount) || 0)
                                                    }
                                                })
                                            }

                                            const totalBill = (b.base_price || 0) + addonTotal + (b.travel_surcharge || 0) + (b.different_spot_fee || 0) + (b.additional_price || 0) - (b.discount_amount || 0)
                                            return `฿${totalBill.toLocaleString()}`
                                        })()}
                                    </td>
                                    <td>
                                        <span className={`badge ${b.payment_status === 'paid' ? 'badge-completed' : b.payment_status === 'refunded' ? 'badge-cancelled' : 'badge-pending'}`}>
                                            {b.payment_status === 'paid' ? 'ชำระแล้ว' : b.payment_status === 'refunded' ? 'คืนเงิน' : 'รอชำระ'}
                                        </span>
                                    </td>
                                    <td><span className={`badge ${BOOKING_STATUS_CSS[b.status as BookingStatus] || ''}`}>{BOOKING_STATUS_LABEL[b.status as BookingStatus] || b.status}</span></td>
                                    <td onClick={e => e.stopPropagation()}>
                                        {b.status === 'pending' && (
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
                            <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(null); setShowChat(false); }}>✕</button>
                        </div>
                        
                        <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-5)', background: 'var(--surface-2)', padding: 5, borderRadius: 16 }}>
                            <button 
                                onClick={() => setShowChat(false)}
                                style={{ flex: 1, padding: '7px', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', background: !showChat ? 'white' : 'transparent', color: !showChat ? 'var(--brand-dominant)' : 'var(--text-muted)', boxShadow: !showChat ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                            ><ClipboardList size={15} /> ข้อมูล</button>
                            <button 
                                onClick={() => setShowChat(true)}
                                style={{ flex: 1, padding: '7px', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', background: showChat ? 'white' : 'transparent', color: showChat ? 'var(--brand-dominant)' : 'var(--text-muted)', boxShadow: showChat ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                            ><MessageCircle size={15} /> แชท {['confirmed', 'picking_up', 'washing', 'delivering'].includes(selected.status) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)' }} />} </button>
                        </div>

                        {!showChat ? (
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
                            ].map(([key, val]) => (
                                <div key={key} style={{ display: 'flex', gap: 'var(--space-4)' }}>
                                    <span style={{ color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>{key}</span>
                                    <span style={{ fontWeight: 500 }}>{val}</span>
                                </div>
                            ))}


                            {[
                                ['ผู้รับผิดชอบ', selected.staff?.full_name || 'ยังไม่ได้รับ'],
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
                                    <img 
                                        src={selected.slip_url} 
                                        alt="slip" 
                                        style={{ width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: 'zoom-in' }} 
                                         onClick={() => setZoomConfig({ images: [{ src: selected.slip_url, alt: `สลิปการจอง: ${selected.customers?.full_name}` }], initialIndex: 0 })}
                                    />
                                </div>
                            )}
                        </div>
                        ) : (
                            <div style={{ height: 550, overflow: 'hidden', margin: '0 -24px -24px', position: 'relative', background: '#F8F9FC', borderRadius: '0 0 20px 20px' }}>
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
            )}

            {zoomConfig && (
                <ImageZoom 
                    images={zoomConfig.images} 
                    initialIndex={zoomConfig.initialIndex}
                    onClose={() => setZoomConfig(null)} 
                />
            )}
        </div>
    )
}
