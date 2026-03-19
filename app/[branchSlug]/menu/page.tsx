'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Bath, ClipboardList, Settings, Bike, ChevronRight, Search, User } from 'lucide-react'
import Logo from '@/components/Branding/Logo'
import styles from './menu.module.css'
import dynamic from 'next/dynamic'

const PushPromptBanner = dynamic(() => import('@/components/Global/PushPromptBanner'), { ssr: false })

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

        // 🚀 Check for unrated completed bookings
        supabase.from('bookings')
            .select('id, scheduled_date, branch_id, services(name), zones(name), staff(full_name)')
            .eq('customer_id', parsed.id)
            .eq('status', 'completed')
            .is('rating', null)
            .order('created_at', { ascending: false })
            .then(({ data: bData }) => {
                if (bData && bData.length > 0) {
                    setUnratedCount(bData.length)
                    
                    // Check if this specific booking was recently dismissed in this session
                    const dismissed = sessionStorage.getItem('dismissed_review_' + bData[0].id)
                    if (!dismissed) {
                        setUnratedBooking(bData[0])
                    }

                    // Fetch zones of the branch resolved from Slug OR the most recent booking
                    const currentBranchId = customer?.branch_id || bData[0].branch_id
                    if (currentBranchId) {
                        supabase.from('zones').select('name').eq('branch_id', currentBranchId).eq('is_active', true)
                            .then(({ data: zData }) => {
                                if (zData) setZones(zData)
                            })
                    }
                } else {
                    // Fallback: fetch zones of the branch resolved from Slug
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
    }

    const handleReview = async () => {
        if (!unratedBooking || rating === 0) return
        setSubmitting(true)
        try {
            const { error } = await supabase.from('bookings')
                .update({ rating, review_comment: comment })
                .eq('id', unratedBooking.id)
            
            if (error) throw error
            
            alert('ขอบคุณสำหรับรีวิวของคุณครับ!')
            setUnratedBooking(null)
            setRating(0)
            setComment('')
        } catch (e: any) {
            alert('ไม่สามารถบันทึกรีวิวได้: ' + e.message)
        } finally {
            setSubmitting(false)
        }
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
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>รีวิวบริการล่าสุด</h2>
                                {unratedCount > 1 && <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>คุณมี {unratedCount} งานที่ยังไม่ได้รีวิว</span>}
                            </div>
                            <button className={styles.closeBtn} onClick={dismissReview}>×</button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div style={{ textAlign: 'center', background: 'var(--surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>งานเมื่อวันที่ {unratedBooking.scheduled_date}</div>
                                <div style={{ fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>{unratedBooking.services?.name}</div>
                            </div>

                            <div style={{ padding: 'var(--space-4)', background: 'var(--surface-2)', borderRadius: 'var(--radius-xl)' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 'var(--space-2)', textAlign: 'center' }}>คุณพอใจกับบริการครั้งนี้แค่ไหน?</div>
                                
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <button 
                                            key={s} 
                                            onClick={() => setRating(s)}
                                            style={{ background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', color: s <= rating ? '#fbbf24' : '#d1d5db', transition: 'transform 0.1s' }}
                                            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.9)')}
                                            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>

                                <textarea 
                                    className="form-input" 
                                    placeholder="เขียนคอมเม้นเพิ่มเติมที่นี่ (ไม่บังคับ)..." 
                                    style={{ width: '100%', borderRadius: 12, marginBottom: 'var(--space-3)', fontSize: '0.85rem', padding: 12, minHeight: 80 }}
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                />
                                
                                <button 
                                    className="btn btn-primary" 
                                    style={{ width: '100%', borderRadius: 'var(--radius-full)' }} 
                                    disabled={rating === 0 || submitting}
                                    onClick={handleReview}
                                >
                                    {submitting ? <div className="spinner" style={{ width: 20, height: 20, borderTopColor: '#fff' }} /> : 'ส่งรีวิว'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Push Notification Prompt */}
            {customer && <PushPromptBanner userId={customer.id} platform="customer" />}

        </div>
    )
}
