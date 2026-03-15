'use client'
import { useEffect, useState, ReactNode } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_CSS, BookingStatus, VEHICLE_SIZE_LABEL } from '@/lib/types'
import { 
    ChevronLeft, 
    Clock, 
    CheckCircle, 
    Bike, 
    Droplets, 
    Truck, 
    PartyPopper, 
    XCircle, 
    Calendar,
    MapPin,
    Star,
    Phone,
    Info,
    ChevronRight,
    Tag,
    X,
    User,
    ClipboardList,
    AlertCircle
} from 'lucide-react'
import styles from './my-bookings.module.css'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import CheckoutForm from '@/components/Stripe/CheckoutForm'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

const StatusIconComponent = ({ status, size = 20 }: { status: string, size?: number }) => {
    switch (status) {
        case 'pending': return <Clock size={size} />
        case 'confirmed': return <CheckCircle size={size} />
        case 'picking_up': return <Bike size={size} />
        case 'washing': return <Droplets size={size} />
        case 'delivering': return <Truck size={size} />
        case 'completed': return <PartyPopper size={size} />
        case 'cancelled': return <XCircle size={size} />
        default: return <Info size={size} />
    }
}

export default function MyBookingsPage() {
    const { branchSlug } = useParams<{ branchSlug: string }>()
    const router = useRouter()
    const searchParams = useSearchParams()
    const success = searchParams.get('success')
    const [bookings, setBookings] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [photos, setPhotos] = useState<Record<string, any>>({})
    const [selectedBooking, setSelectedBooking] = useState<any>(null)
    const [rating, setRating] = useState(0)
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [clientSecret, setClientSecret] = useState('')

    useEffect(() => {
        const customer = localStorage.getItem('liff_customer')
        if (!customer) { router.replace(`/${branchSlug}`); return }
        const { id } = JSON.parse(customer)

        supabase.from('bookings')
            .select('*, services(name), zones(name), staff(full_name, phone)')
            .eq('customer_id', id)
            .order('created_at', { ascending: false })
            .then(async ({ data }) => {
                const bData = data || []
                
                // ─── Manual Joins Fallback (Mock DB) ───────────────────
                // We do this because standard joins like services(name) return null/undefined in the simple mock
                const serviceIds = [...new Set(bData.filter(b => b.service_id).map(b => b.service_id))]
                const zoneIds = [...new Set(bData.filter(b => b.zone_id).map(b => b.zone_id))]
                const staffIds = [...new Set(bData.filter(b => b.staff_id).map(b => b.staff_id))]

                if (serviceIds.length > 0) {
                    const { data: sData } = await supabase.from('services').select('*').in('id', serviceIds)
                    const map = Object.fromEntries(sData?.map((s: any) => [s.id, s]) || [])
                    bData.forEach(b => { if (b.service_id) b.services = map[b.service_id] })
                }
                if (zoneIds.length > 0) {
                    const { data: zData } = await supabase.from('zones').select('*').in('id', zoneIds)
                    const map = Object.fromEntries(zData?.map((z: any) => [z.id, z]) || [])
                    bData.forEach(b => { if (b.zone_id) b.zones = map[b.zone_id] })
                }
                if (staffIds.length > 0) {
                    const { data: stData } = await supabase.from('staff').select('*').in('id', staffIds)
                    const map = Object.fromEntries(stData?.map((st: any) => [st.id, st]) || [])
                    bData.forEach(b => { if (b.staff_id) b.staff = map[b.staff_id] })
                }

                setBookings([...bData])
                
                // 🚀 AUTO-POPUP: If there's a completed booking without a rating, OR any booking with unpaid additional price
                const unrated = bData.find((b: any) => b.status === 'completed' && !b.rating)
                const unpaid = bData.find((b: any) => b.additional_price > 0 && !b.is_additional_paid)
                
                if (unpaid) {
                    // Always show unpaid popup until paid
                    setSelectedBooking(unpaid)
                } else if (unrated) {
                    // Only show unrated popup once per session
                    const dismissed = sessionStorage.getItem('dismissed_popup_' + unrated.id)
                    if (!dismissed) {
                        setSelectedBooking(unrated)
                    }
                }

                // Load photos for completed bookings
                const completedIds = bData.filter((b: any) => b.status === 'completed').map((b: any) => b.id)
                if (completedIds.length > 0) {
                    supabase.from('job_photos').select('*').in('booking_id', completedIds).then(({ data: pData }) => {
                        const map: Record<string, any> = {}
                            ; (pData || []).forEach((p: any) => { map[p.booking_id] = map[p.booking_id] || {}; map[p.booking_id][p.type] = p.photo_urls })
                        setPhotos(map)
                    })
                }
                setLoading(false)
            })
    }, [router, branchSlug])

    const handleReview = async () => {
        if (!selectedBooking || rating === 0) return
        setSubmitting(true)
        try {
            const { error } = await supabase.from('bookings')
                .update({ rating, review_comment: comment })
                .eq('id', selectedBooking.id)
            
            if (error) throw error
            
            // Update local state
            setBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, rating, review_comment: comment } : b))
            alert('ขอบคุณสำหรับรีวิวของคุณครับ!')
            setSelectedBooking(null)
            setRating(0)
            setComment('')
        } catch (e: any) {
            alert('ไม่สามารถบันทึกรีวิวได้: ' + e.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handlePayAdditional = async () => {
        if (!selectedBooking || !selectedBooking.additional_price) return
        setSubmitting(true)
        try {
            const res = await fetch('/api/stripe/create-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: selectedBooking.additional_price,
                    booking_metadata: {
                        booking_id: selectedBooking.id,
                        type: 'additional_payment',
                        customer_name: (JSON.parse(localStorage.getItem('liff_customer') || '{}')).full_name
                    }
                }),
            })
            const data = await res.json()
            if (data.clientSecret) {
                setClientSecret(data.clientSecret)
            } else {
                throw new Error('Failed to create payment intent')
            }
        } catch (e: any) {
            alert('การเตรียมชำระเงินขัดข้อง: ' + e.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleStripeSuccess = async (paymentIntentId: string) => {
        setSubmitting(true)
        try {
            const { error } = await supabase.from('bookings')
                .update({ 
                    is_additional_paid: true,
                    additional_payment_stripe_id: paymentIntentId
                })
                .eq('id', selectedBooking.id)
            
            if (error) throw error
            
            setBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, is_additional_paid: true } : b))
            alert('ชำระค่าใช้จ่ายเพิ่มเติมสำเร็จ! ขอบคุณครับ')
            setSelectedBooking((p: any) => ({ ...p, is_additional_paid: true }))
            setClientSecret('')
        } catch (e: any) {
            alert('บันทึกข้อมูลการชำระเงินขัดข้อง: ' + e.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.topbar}>
                <Link href={`/${branchSlug}/menu`} className="btn btn-ghost btn-sm btn-icon"><ChevronLeft size={20} /></Link>
                <div className={styles.title}>การจองของฉัน</div>
                <div style={{ width: 36 }} />
            </div>

            {success === '1' && (
                <div style={{ margin: 'var(--space-4)' }}>
                    <div className="alert alert-success" style={{ animation: 'fadeIn 0.3s ease', borderRadius: '18px', padding: '16px', display: 'flex', gap: 12 }}>
                        <div style={{ background: 'white', borderRadius: '10px', padding: 8, color: 'var(--success)' }}><CheckCircle size={20} /></div>
                        <div style={{ fontSize: '0.9rem', lineHeight: 1.4, fontWeight: 700 }}>
                            จองสำเร็จแล้ว! <br/>
                            <span style={{ fontWeight: 500, opacity: 0.9 }}>เราจะแจ้งเตือนคุณผ่าน Line เมื่อพนักงานรับงาน</span>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}>
                    <div className="spinner" />
                </div>
            ) : bookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-6)' }}>
                    <div style={{ background: 'var(--surface-2)', width: 80, height: 80, borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)', color: 'var(--text-muted)' }}>
                        <ClipboardList size={40} />
                    </div>
                    <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>ยังไม่มีการจอง</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 'var(--space-6)' }}>คุณยังไม่เคยจองบริการกับเราเลย</p>
                    <Link href={`/${branchSlug}/book`} className="btn btn-primary btn-lg" style={{ borderRadius: 'var(--radius-full)', padding: '12px 32px' }}>จองเลย</Link>
                </div>
            ) : (
                <div className={styles.list}>
                    {bookings.map(b => (
                        <div key={b.id} className={styles.card} onClick={() => {
                            setSelectedBooking(b)
                            setRating(b.rating || 0)
                            setComment(b.review_comment || '')
                        }}>
                            <div className={styles.cardHeader}>
                                <div className={styles.statusIcon}>
                                    <StatusIconComponent status={b.status} size={24} />
                                </div>
                                <div className={styles.statusInfo}>
                                    <div className={styles.serviceName}>{b.services?.name}</div>
                                    <div className={styles.dateTime}>{b.scheduled_date} · {b.scheduled_time?.slice(0, 5)} · {b.zones?.name}</div>
                                </div>
                                <span className={`badge ${BOOKING_STATUS_CSS[b.status as BookingStatus] || ''}`} style={{ fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: '10px' }}>
                                    {BOOKING_STATUS_LABEL[b.status as BookingStatus] || b.status}
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className={styles.progress}>
                                {['pending', 'confirmed', 'picking_up', 'washing', 'delivering', 'completed'].map((s, i, arr) => {
                                    const idx = arr.indexOf(b.status)
                                    const done = i <= idx
                                    return <div key={s} className={`${styles.progressDot} ${done ? styles.progressDone : ''}`} />
                                })}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    {b.additional_price > 0 && !b.is_additional_paid ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fffbeb', color: '#b45309', padding: '2px 8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, border: '1px solid #fcd34d' }}>
                                            <AlertCircle size={12} /> มียอดค้างชำระ
                                        </div>
                                    ) : b.rating ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--warning-ghost)', color: 'var(--warning)', padding: '2px 8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800 }}>
                                            <Star size={12} fill="currentColor" /> {b.rating}
                                        </div>
                                    ) : b.status === 'completed' ? (
                                        <div style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem' }}>ให้คะแนนบริการนี้</div>
                                    ) : <div />}
                                </div>
                                <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary)' }}>฿{b.total_price?.toLocaleString()}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Float Modal Details */}
            {selectedBooking && (
                <div className={styles.overlay} onClick={() => {
                    if (selectedBooking) {
                        sessionStorage.setItem('dismissed_popup_' + selectedBooking.id, 'true')
                    }
                    setSelectedBooking(null)
                }}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-primary)' }}>รายละเอียดการจอง</h2>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>ID: #{selectedBooking.id.slice(0, 8)}</div>
                            </div>
                            <button className={styles.closeBtn} onClick={() => {
                                if (selectedBooking) {
                                    sessionStorage.setItem('dismissed_popup_' + selectedBooking.id, 'true')
                                }
                                setSelectedBooking(null)
                            }}><X size={24} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            {/* Status Section */}
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <span className={`badge ${BOOKING_STATUS_CSS[selectedBooking.status as BookingStatus] || ''}`} style={{ fontSize: '0.95rem', padding: '8px 20px', borderRadius: '15px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <StatusIconComponent status={selectedBooking.status} size={18} />
                                        {BOOKING_STATUS_LABEL[selectedBooking.status as BookingStatus] || selectedBooking.status}
                                    </div>
                                </span>
                            </div>

                            {/* Section: Basic Info */}
                            <div style={{ background: 'var(--surface-2)', borderRadius: '24px', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div className={styles.detailRow}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                        <Calendar size={18} /> วันที่
                                    </div>
                                    <span style={{ fontWeight: 800 }}>{selectedBooking.scheduled_date}</span>
                                </div>
                                <div className={styles.detailRow}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                        <Clock size={18} /> เวลา
                                    </div>
                                    <span style={{ fontWeight: 800 }}>{selectedBooking.scheduled_time?.slice(0, 5)} น.</span>
                                </div>
                                {selectedBooking.staff && (
                                    <div className={styles.detailRow}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            <User size={18} /> พนักงาน
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                            <span style={{ fontWeight: 800 }}>{selectedBooking.staff.full_name}</span>
                                            {selectedBooking.staff.phone && (
                                                <a href={`tel:${selectedBooking.staff.phone}`} className="btn btn-primary btn-sm" style={{ padding: '6px 12px', borderRadius: '12px', fontSize: '0.75rem', gap: 6 }}>
                                                    <Phone size={14} /> โทรหาพนักงาน
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section: Vehicle */}
                            <div style={{ padding: '0 4px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ข้อมูลรถ</div>
                                <div className={styles.itemCard}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div className={styles.iconBox}><Bike size={18} /></div>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{selectedBooking.vehicle_data?.vehicle_brand} {selectedBooking.vehicle_data?.vehicle_model}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedBooking.vehicle_data?.license_plate} · {VEHICLE_SIZE_LABEL[selectedBooking.vehicle_data?.vehicle_size] || selectedBooking.vehicle_data?.vehicle_size}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Addresses */}
                            <div style={{ padding: '0 4px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>สถานที่</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                        <div style={{ width: 24, height: 24, borderRadius: 8, background: 'var(--primary-ghost)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                                            <MapPin size={14} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>{selectedBooking.pickup_address}</div>
                                            {selectedBooking.delivery_address && selectedBooking.pickup_address !== selectedBooking.delivery_address && (
                                                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                                    <div style={{ width: 24, height: 24, borderRadius: 8, background: 'var(--success-ghost)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                                                        <CheckCircle size={14} />
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem' }}>{selectedBooking.delivery_address}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: 'var(--surface-2)', borderRadius: '24px', padding: 'var(--space-4)' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <ClipboardList size={18} /> สรุปค่าบริการ: {selectedBooking.services?.name}
                                </div>
                                
                                {(() => {
                                    let addonsTotal = 0
                                    if (Array.isArray(selectedBooking.addon_ids)) {
                                        selectedBooking.addon_ids.forEach((addon: any) => {
                                            let price = 0
                                            if (typeof addon !== 'string') {
                                                if (addon.isFree) price = 0
                                                else if (addon.selectedPrice !== undefined) price = addon.selectedPrice
                                                else if (addon.price !== undefined) price = addon.price
                                                else if (addon.variableState?.customAmount) price = Number(addon.variableState.customAmount)
                                            }
                                            addonsTotal += price
                                        })
                                    }
                                    const trueBasePrice = selectedBooking.services?.price_s || selectedBooking.base_price || 0
                                    const sizeAdj = (selectedBooking.total_price || 0) - trueBasePrice - addonsTotal - (selectedBooking.extra_fee || 0) + (selectedBooking.discount_amount || 0) - (selectedBooking.additional_price || 0)
                                    
                                    return (
                                        <>
                                            <div className={styles.detailRow}>
                                                <span style={{ color: 'var(--text-secondary)' }}>ค่าบริการพื้นฐาน</span>
                                                <span style={{ fontWeight: 700 }}>฿{trueBasePrice.toLocaleString()}</span>
                                            </div>

                                            {sizeAdj !== 0 && (
                                                <div className={styles.detailRow}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>ส่วนต่างขนาดรถ ({VEHICLE_SIZE_LABEL[selectedBooking.vehicle_data?.vehicle_size || selectedBooking.customers?.vehicle_size] || selectedBooking.vehicle_data?.vehicle_size || selectedBooking.customers?.vehicle_size})</span>
                                                    <span style={{ fontWeight: 700, color: sizeAdj > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                                        {sizeAdj > 0 ? '+' : '-'}฿{Math.abs(sizeAdj).toLocaleString()}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Rich Addons */}
                                            {Array.isArray(selectedBooking.addon_ids) && selectedBooking.addon_ids.map((addon: any, idx: number) => {
                                                const label = typeof addon === 'string' ? addon : (addon.name || 'บริการเสริม')
                                                let price = 0
                                                if (typeof addon !== 'string') {
                                                    if (addon.isFree) price = 0
                                                    else if (addon.selectedPrice !== undefined) price = addon.selectedPrice
                                                    else if (addon.price !== undefined) price = addon.price
                                                    else if (addon.variableState?.customAmount) price = Number(addon.variableState.customAmount)
                                                }

                                                return (
                                                    <div key={idx} className={styles.detailRow}>
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', paddingLeft: 12 }}>+ {label} {addon.variableState?.mode === 'full_tank' ? '(ตามจริง)' : ''}</span>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                                            {addon.isFree ? 'ฟรี' : (price === 0 && addon.variableState?.mode === 'full_tank' && selectedBooking.additional_price > 0) ? `฿${selectedBooking.additional_price.toLocaleString()}` : (price === 0 && addon.variableState?.mode === 'full_tank') ? 'เก็บหน้างาน' : `฿${price.toLocaleString()}`}
                                                        </span>
                                                    </div>
                                                )
                                            })}

                                            {selectedBooking.extra_fee > 0 && (
                                                <div className={styles.detailRow}>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>ค่าระยะทางนอกโซน</span>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>฿{selectedBooking.extra_fee.toLocaleString()}</span>
                                                </div>
                                            )}

                                            {selectedBooking.discount_amount > 0 && (
                                                <div className={styles.detailRow} style={{ color: 'var(--pink)' }}>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><Tag size={12} /> ส่วนลด ({selectedBooking.discount_code})</span>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>-฿{selectedBooking.discount_amount.toLocaleString()}</span>
                                                </div>
                                            )}
                                        </>
                                    )
                                })()}

                                <div className={styles.detailRow} style={{ marginTop: 8, paddingTop: 12, borderTop: '2px dashed var(--border)', fontWeight: 900, fontSize: '1.2rem' }}>
                                    <span style={{ color: 'var(--text-primary)' }}>รวมทั้งหมด</span>
                                    <span style={{ color: 'var(--primary)' }}>฿{selectedBooking.total_price?.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Additional Fees (Manual Staff adjustment) */}
                            {selectedBooking.additional_price > 0 && (
                                <div style={{ background: '#fffbeb', borderRadius: '24px', padding: 'var(--space-4)', border: '1.5px solid #fcd34d' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 800, marginBottom: 8, fontSize: '0.95rem' }}>
                                        <AlertCircle size={18} /> ยอดเพิ่มเติมที่หน้างาน
                                        <div style={{ marginLeft: 'auto' }}>฿{selectedBooking.additional_price.toLocaleString()}</div>
                                    </div>
                                    {selectedBooking.additional_price_note && (
                                        <div style={{ color: '#92400e', fontSize: '0.8rem', background: 'rgba(252, 211, 77, 0.4)', padding: '8px 12px', borderRadius: '12px', marginBottom: 12 }}>
                                            <strong>สาเหตุ:</strong> {selectedBooking.additional_price_note}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {/* Multi-Slip Display */}
                                        {(Array.isArray(selectedBooking.additional_price_slips) && selectedBooking.additional_price_slips.length > 0) || selectedBooking.additional_price_slip ? (
                                            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                                                {[...(selectedBooking.additional_price_slips || []), selectedBooking.additional_price_slip].filter(Boolean).map((url, i) => (
                                                    <img 
                                                        key={i} src={url} alt={`receipt-${i}`} 
                                                        style={{ height: 80, width: 80, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: '1px solid #fcd34d' }} 
                                                        onClick={() => window.open(url, '_blank')}
                                                    />
                                                ))}
                                            </div>
                                        ) : null}

                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {!selectedBooking.is_additional_paid ? (
                                                !clientSecret ? (
                                                    <button className="btn btn-primary btn-sm" style={{ flex: 2, borderRadius: '12px', background: '#b45309', border: 'none' }} onClick={handlePayAdditional} disabled={submitting}>
                                                        {submitting ? <div className="spinner spinner-white" /> : '💰 ชำระเงินส่วนนี้'}
                                                    </button>
                                                ) : null
                                            ) : (
                                                <div style={{ flex: 2, background: 'var(--success)', color: 'white', borderRadius: '12px', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                                                    ✅ ชำระแล้ว
                                                </div>
                                            )}
                                        </div>

                                        {clientSecret && !selectedBooking.is_additional_paid && (
                                            <div style={{ background: 'white', borderRadius: '16px', padding: 16 }}>
                                                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                                                    <CheckoutForm 
                                                        amount={selectedBooking.additional_price}
                                                        onSuccess={handleStripeSuccess}
                                                        onCancel={() => setClientSecret('')}
                                                    />
                                                </Elements>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Before/After photos if completed */}
                            {selectedBooking.status === 'completed' && photos[selectedBooking.id] && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    {photos[selectedBooking.id].before?.[0] && (
                                        <div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textAlign: 'center' }}>ก่อนล้าง</div>
                                            <img src={photos[selectedBooking.id].before[0]} alt="before" style={{ width: '100%', borderRadius: 16, objectFit: 'cover', aspectRatio: '4/3', border: '2px solid var(--surface-2)' }} />
                                        </div>
                                    )}
                                    {photos[selectedBooking.id].after?.[0] && (
                                        <div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textAlign: 'center' }}>หลังล้าง</div>
                                            <img src={photos[selectedBooking.id].after[0]} alt="after" style={{ width: '100%', borderRadius: 16, objectFit: 'cover', aspectRatio: '4/3', border: '2px solid var(--surface-2)' }} />
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedBooking.status === 'completed' && (
                                <div style={{ background: 'var(--surface-2)', borderRadius: '24px', padding: 'var(--space-5)', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
                                        {selectedBooking.rating ? 'ขอบคุณสำหรับรีวิวของคุณครับ!' : 'รีวิวบริการนี้'}
                                    </div>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 'var(--space-4)' }}>
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <button 
                                                key={s} 
                                                disabled={!!selectedBooking.rating}
                                                onClick={() => setRating(s)}
                                                style={{ background: 'none', border: 'none', fontSize: '2rem', cursor: selectedBooking.rating ? 'default' : 'pointer', color: s <= rating ? '#fbbf24' : '#d1d5db' }}
                                            >
                                                <Star size={32} fill={s <= rating ? '#fbbf24' : 'none'} color={s <= rating ? '#fbbf24' : '#d1d5db'} />
                                            </button>
                                        ))}
                                    </div>

                                    {!selectedBooking.rating ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <textarea 
                                                className="form-input" 
                                                placeholder="เขียนคอมเม้นเพิ่มเติมที่นี่..." 
                                                style={{ width: '100%', borderRadius: '16px', fontSize: '0.85rem', padding: 14, minHeight: 90, border: 'none', background: 'white' }}
                                                value={comment}
                                                onChange={e => setComment(e.target.value)}
                                            />
                                            <button 
                                                className="btn btn-primary btn-lg" 
                                                style={{ width: '100%', borderRadius: 'var(--radius-full)', fontWeight: 800 }} 
                                                disabled={rating === 0 || submitting}
                                                onClick={handleReview}
                                            >
                                                {submitting ? <div className="spinner spinner-white" /> : 'ส่งรีวิว'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ background: 'white', padding: 16, borderRadius: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, textAlign: 'left' }}>
                                            {selectedBooking.review_comment || '(ไม่มีคอมเม้น)'}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
