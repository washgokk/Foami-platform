'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Bath, ClipboardList, Settings, Bike, ChevronRight, Search, User, Star, ShieldCheck, Ticket, Copy, Check } from 'lucide-react'
import Logo from '@/components/Branding/Logo'
import styles from './menu.module.css'

export default function MenuPage() {
    const { branchSlug } = useParams<{ branchSlug: string }>()
    const router = useRouter()
    const [customer, setCustomer] = useState<any>(null)
    const [unratedBooking, setUnratedBooking] = useState<any>(null)
    const [rating, setRating] = useState(0)
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [unratedCount, setUnratedCount] = useState(0)
    const [zones, setZones] = useState<any[]>([])
    const [branchName, setBranchName] = useState('')
    const [rewardCoupon, setRewardCoupon] = useState<any>(null)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const data = localStorage.getItem('liff_customer')
        if (!data) { router.replace(`/${branchSlug}`); return }
        const parsed = JSON.parse(data)
        setCustomer(parsed)

        // Resolve branch from slug and persist it
        supabase.from('branches').select('id, name').eq('slug', branchSlug).maybeSingle()
            .then(({ data: brData }) => {
                if (brData) {
                    setBranchName(brData.name)
                    const updatedCustomer = { ...parsed, branch_id: brData.id }
                    localStorage.setItem('liff_customer', JSON.stringify(updatedCustomer))
                    setCustomer(updatedCustomer)
                }
            })

        // Initial data setup
        supabase.from('bookings')
            .select('id, scheduled_date, scheduled_time, rating, review_comment, branch_id, services(name)')
            .eq('customer_id', parsed.id)
            .eq('status', 'completed')
            .is('rating', null)
            .order('scheduled_date', { ascending: false })
            .then(({ data: bData }) => {
                if (bData && bData.length > 0) {
                    setUnratedCount(bData.length)
                    
                    const dismissed = sessionStorage.getItem('dismissed_review_' + bData[0].id)
                    if (!dismissed) {
                        setUnratedBooking(bData[0])
                    }

                    const currentBranchId = customer?.branch_id || bData[0].branch_id
                    if (currentBranchId) {
                        supabase.from('zones').select('name').eq('branch_id', currentBranchId).eq('is_active', true)
                            .then(({ data: zData }) => {
                                if (zData) setZones(zData)
                            })
                    }
                } else {
                    supabase.from('branches').select('id').eq('slug', branchSlug).maybeSingle()
                        .then(({ data: brData }) => {
                            if (brData) {
                                supabase.from('zones').select('name').eq('branch_id', brData.id).eq('is_active', true)
                                    .then(({ data: zData }) => {
                                        if (zData) setZones(zData)
                                    })
                            }
                        })
                }
            })
    }, [router, branchSlug])

    const dismissReview = () => {
        if (unratedBooking) {
            sessionStorage.setItem('dismissed_review_' + unratedBooking.id, 'true')
        }
        setUnratedBooking(null)
        setRewardCoupon(null)
    }

    const handleReview = async () => {
        if (!unratedBooking || rating === 0) return
        setSubmitting(true)
        try {
            const { error } = await supabase.from('bookings')
                .update({ rating, review_comment: comment })
                .eq('id', unratedBooking.id)
            
            if (error) throw error
            
            // Request review reward coupon (100% Platform Funded)
            try {
                const resReward = await fetch('/api/reviews/reward', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customer_phone: customer.phone,
                        booking_id: unratedBooking.id,
                        branch_slug: branchSlug,
                        branch_id: unratedBooking.branch_id || customer.branch_id,
                        rating: rating
                    })
                })
                const rData = await resReward.json()
                if (rData.coupon) {
                    setRewardCoupon(rData.coupon)
                } else {
                    alert('ขอบคุณสำหรับรีวิวของคุณครับ!')
                    setUnratedBooking(null)
                }
            } catch (err) {
                alert('ขอบคุณสำหรับรีวิวของคุณครับ!')
                setUnratedBooking(null)
            }

            setRating(0)
            setComment('')
        } catch (e: any) {
            alert('ไม่สามารถบันทึกรีวิวได้: ' + e.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleCopyCoupon = (code: string) => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    if (!customer) return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <p style={{ color: 'var(--text-muted)' }}>กำลังโหลด...</p>
        </div>
    )

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.brandRow}>
                    <Logo width={120} />
                    {branchName && (
                        <Link href="/search" className={styles.branchSelector}>
                            <Search size={14} /> {branchName}
                        </Link>
                    )}
                </div>
                <div className={styles.greeting}>
                    <p className={styles.greetText}>สวัสดี คุณ{customer.full_name?.split(' ')[0]}</p>
                    <p className={styles.vehicleText}><Bike size={16} /> {customer.vehicle_brand} {customer.vehicle_model} · {customer.license_plate}</p>
                </div>
            </div>

            {/* Menu Buttons */}
            <div className={styles.menuGrid}>
                <Link href={`/${branchSlug}/book`} className={styles.menuCard}>
                    <div className={`${styles.menuIcon} ${styles.iconBook}`}><Bath size={24} /></div>
                    <div className={styles.menuTitle}>จองล้างรถ</div>
                    <div className={styles.menuDesc}>เลือกบริการและเวลาที่สะดวก</div>
                    <span className={styles.menuArrow}><ChevronRight size={18} /></span>
                </Link>

                <Link href={`/${branchSlug}/my-bookings`} className={styles.menuCard}>
                    <div className={`${styles.menuIcon} ${styles.iconHistory}`}><ClipboardList size={24} /></div>
                    <div className={styles.menuTitle}>การจองของฉัน</div>
                    <div className={styles.menuDesc}>ดูสถานะและประวัติ</div>
                    <span className={styles.menuArrow}><ChevronRight size={18} /></span>
                </Link>

                <Link href={`/${branchSlug}/settings`} className={styles.menuCard}>
                    <div className={`${styles.menuIcon} ${styles.iconSettings}`}><Settings size={24} /></div>
                    <div className={styles.menuTitle}>ตั้งค่า</div>
                    <div className={styles.menuDesc}>แก้ไขข้อมูลส่วนตัว</div>
                    <span className={styles.menuArrow}><ChevronRight size={18} /></span>
                </Link>

                <div className={`${styles.menuCard} ${styles.disabled}`}>
                    <span className={styles.comingSoon}>COMING SOON</span>
                </div>
            </div>

            {/* Footer brand */}
            <div className={styles.footer}>
                <p>Foami Wash &amp; Delivery © 2025</p>
                {zones.length > 0 && (
                    <p style={{ fontSize: '0.75rem', marginTop: 4, opacity: 0.6 }}>
                        โซนบริการ: {zones.map(z => z.name).join(' · ')}
                    </p>
                )}
            </div>

            {/* Review Popup Modal */}
            {unratedBooking && (
                <div className={styles.overlay} onClick={dismissReview}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>รีวิวบริการล่าสุด</h2>
                                {unratedCount > 1 && <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>คุณมี {unratedCount} งานที่ยังไม่ได้รีวิว</span>}
                            </div>
                            <button className={styles.closeBtn} onClick={dismissReview}>×</button>
                        </div>

                        {rewardCoupon ? (
                            /* Reward voucher reveal */
                            <div style={{ padding: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                    <ShieldCheck size={32} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                        ขอบคุณสำหรับรีวิวของคุณ!
                                    </h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                                        คุณได้รับคูปองส่วนลดสำหรับการจองครั้งถัดไป
                                    </p>
                                </div>

                                <div style={{ background: '#f8fafc', border: '2px dashed var(--brand-dominant)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'left' }}>รหัสส่วนลดของคุณ</div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: 2, color: 'var(--brand-dominant)', textAlign: 'left' }}>
                                            {rewardCoupon.code}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, textAlign: 'left', marginTop: 2 }}>
                                            ลด ฿{rewardCoupon.discount_value} · สนับสนุนโดย Foami 100%
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCopyCoupon(rewardCoupon.code)}
                                        style={{
                                            padding: '8px 14px',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: copied ? '#059669' : 'var(--brand-dominant)',
                                            color: 'white',
                                            fontWeight: 700,
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4
                                        }}
                                    >
                                        {copied ? <><Check size={14} /> คัดลอกแล้ว</> : <><Copy size={14} /> คัดลอก</>}
                                    </button>
                                </div>

                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%', borderRadius: 'var(--radius-full)', fontWeight: 800 }}
                                    onClick={dismissReview}
                                >
                                    รับสิทธิ์และปิดหน้านี้
                                </button>
                            </div>
                        ) : (
                            /* Review form with promo banner */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {/* Promo Incentive Banner (Always visible) */}
                                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Ticket size={20} color="#059669" style={{ flexShrink: 0 }} />
                                    <div style={{ fontSize: '0.8rem', color: '#065f46', lineHeight: 1.4, textAlign: 'left' }}>
                                        <strong>รับคูปองส่วนลด ฿50 ทันที!</strong> เพียงส่งรีวิวบริการนี้ (Foami สนับสนุน 100% ไม่หักเงินร้านค้า)
                                    </div>
                                </div>

                                <div style={{ textAlign: 'center', background: 'var(--surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>งานเมื่อวันที่ {unratedBooking.scheduled_date}</div>
                                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>{unratedBooking.services?.name}</div>
                                </div>

                                <div style={{ padding: 'var(--space-4)', background: 'var(--surface-2)', borderRadius: 'var(--radius-xl)' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 'var(--space-2)', textAlign: 'center' }}>คุณพอใจกับบริการครั้งนี้แค่ไหน?</div>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <button 
                                                key={s} 
                                                type="button"
                                                onClick={() => setRating(s)}
                                                style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <Star 
                                                    size={32} 
                                                    fill={s <= rating ? '#f59e0b' : 'none'} 
                                                    color={s <= rating ? '#f59e0b' : '#cbd5e1'} 
                                                />
                                            </button>
                                        ))}
                                    </div>

                                    <textarea 
                                        className="form-input" 
                                        placeholder="เขียนคอมเม้นเพิ่มเติมที่นี่ (ไม่บังคับ)..." 
                                        style={{ width: '100%', borderRadius: 12, marginBottom: 'var(--space-3)', fontSize: '0.85rem', padding: 12, minHeight: 80, border: '1px solid var(--border)' }}
                                        value={comment}
                                        onChange={e => setComment(e.target.value)}
                                    />
                                    
                                    <button 
                                        className="btn btn-primary" 
                                        style={{ width: '100%', borderRadius: 'var(--radius-full)', fontWeight: 800 }} 
                                        disabled={rating === 0 || submitting}
                                        onClick={handleReview}
                                    >
                                        {submitting ? <div className="spinner" style={{ width: 20, height: 20, borderTopColor: '#fff' }} /> : 'ส่งรีวิวและรับคูปอง'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    )
}
