'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
    ChevronLeft, Calendar, Clock, MapPin, Bike, CheckCircle2, 
    Upload, X, Image as ImageIcon, MessageCircle, Phone, 
    Info, Star, ClipboardList, AlertCircle, Tag, Package
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Booking, JobPhoto, Service, VEHICLE_SIZE_LABEL, BOOKING_STATUS_LABEL, BookingStatus } from '@/lib/types'
import styles from './job.module.css'

const STATUS_ACTIONS: Record<string, { label: string; next: BookingStatus; color: string }> = {
    confirmed: { label: '🏍️ ออกรับรถ', next: 'picking_up', color: 'var(--primary)' },
    picking_up: { label: '📸 อัปโหลดรูปก่อนล้าง', next: 'washing', color: 'var(--warning)' },
    washing: { label: '📸 อัปโหลดรูปหลังล้าง', next: 'delivering', color: '#06B6D4' },
    delivering: { label: '✅ ถึงที่หมายแล้ว', next: 'completed', color: 'var(--success)' },
}

const InfoSection = ({ job }: { job: any }) => {
    let addonsTotal = 0
    if (Array.isArray(job.addon_ids)) {
        job.addon_ids.forEach((addon: any) => {
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
    
    const derivedPkgPrice = (job.total_price || 0) - addonsTotal - (job.extra_fee || 0) + (job.discount_amount || 0) - (job.additional_price || 0)

    return (
        <div className={styles.jobItem}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{job.services?.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>ไซส์รถ (CC): <strong>{VEHICLE_SIZE_LABEL[job.customers?.vehicle_size] || job.customers?.vehicle_size || 'ไม่ระบุ'}</strong></div>
                </div>
                <div style={{ fontWeight: 900, fontSize: '1.2rem', color: 'var(--primary)' }}>฿{derivedPkgPrice?.toLocaleString()}</div>
            </div>

            {/* Addons List */}
            {Array.isArray(job.addon_ids) && job.addon_ids.length > 0 && (
                <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>บริการเสริม</div>
                    {job.addon_ids.map((addon: any, idx: number) => {
                        const label = typeof addon === 'string' ? addon : (addon.name || 'บริการเสริม')
                        let price = 0
                        if (typeof addon !== 'string') {
                            if (addon.isFree) price = 0
                            else if (addon.selectedPrice !== undefined) price = addon.selectedPrice
                            else if (addon.price !== undefined) price = addon.price
                            else if (addon.variableState?.customAmount) price = Number(addon.variableState.customAmount)
                        }
                        return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    • {label} {addon.variableState?.mode === 'full_tank' ? '(เต็มถัง)' : addon.variableState?.mode === 'custom' ? `(กำหนดเอง ฿${Number(addon.variableState.customAmount).toLocaleString()})` : ''}
                                </span>
                                <span style={{ fontWeight: 700 }}>
                                    {addon.isFree ? 'ฟรี' : (price === 0 && addon.variableState?.mode === 'full_tank') ? 'เก็บหน้างาน' : `฿${price.toLocaleString()}`}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Full Price Breakdown */}
            <div style={{ borderTop: '2px dashed var(--border)', marginTop: 20, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span>วันที่จอง</span>
                    <span>{job.scheduled_date} {job.scheduled_time?.slice(0, 5)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span>ค่าบริการพื้นฐาน</span>
                    <span>฿{derivedPkgPrice?.toLocaleString()}</span>
                </div>
                {addonsTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <span>ค่าบริการเสริมรวม</span>
                        <span>฿{addonsTotal.toLocaleString()}</span>
                    </div>
                )}
                {job.extra_fee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <span>ค่าระยะทางนอกโซน</span>
                        <span>฿{job.extra_fee.toLocaleString()}</span>
                    </div>
                )}
                {job.additional_price > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <span>ค่าใช้จ่ายเพิ่มเติมหน้างาน</span>
                        <span>฿{job.additional_price.toLocaleString()}</span>
                    </div>
                )}
                {job.discount_amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--danger)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Tag size={14} /> ส่วนลด {job.discount_code ? `(${job.discount_code})` : ''}</span>
                        <span>-฿{job.discount_amount.toLocaleString()}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 12, borderTop: '1.5px solid var(--border)' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>ยอดรวมทั้งหมด</span>
                    <span style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1.2rem' }}>฿{job.total_price?.toLocaleString()}</span>
                </div>
            </div>
        </div>
    )
}

export default function JobDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [job, setJob] = useState<any>(null)
    const [photos, setPhotos] = useState<{ before: string[]; after: string[] }>({ before: [], after: [] })
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [showPhotoUpload, setShowPhotoUpload] = useState(false)
    const [uploadType, setUploadType] = useState<'before' | 'after'>('before')
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [uploading, setUploading] = useState(false)

    // Additional Costs State
    const [additionalPrice, setAdditionalPrice] = useState<number | ''>('')
    const [additionalNote, setAdditionalNote] = useState('')
    const [additionalSlipFiles, setAdditionalSlipFiles] = useState<File[]>([])
    const [additionalPriceSlips, setAdditionalPriceSlips] = useState<string[]>([])
    const [savingCost, setSavingCost] = useState(false)
    const [sizeAdjustments, setSizeAdjustments] = useState<any[]>([])

    const [showConfirmModal, setShowConfirmModal] = useState(false)

    const load = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    *,
                    customers (
                        full_name, phone, vehicle_brand, vehicle_model, vehicle_color, license_plate, vehicle_size
                    ),
                    services (
                        name, price_s, price_m, price_l
                    ),
                    zones (
                        name, extra_fee
                    ),
                    staff (
                        full_name
                    )
                `)
                .eq('id', id)
                .single()
            
            if (error) throw error
            const currentJob = data ? { ...data } : null

            // MOCK DB FALLBACK: Manually fetch relations since the simple mock doesn't support joins
            if (currentJob && !currentJob.customers && currentJob.customer_id) {
                const { data: cData } = await supabase.from('customers').select('*').eq('id', currentJob.customer_id).single()
                currentJob.customers = cData
            }
            if (currentJob && !currentJob.services && currentJob.service_id) {
                const { data: sData } = await supabase.from('services').select('*').eq('id', currentJob.service_id).single()
                currentJob.services = sData
            }
            if (currentJob && !currentJob.zones && currentJob.zone_id) {
                const { data: zData } = await supabase.from('zones').select('*').eq('id', currentJob.zone_id).single()
                currentJob.zones = zData
            }
            if (currentJob && !currentJob.staff && currentJob.staff_id) {
                const { data: stData } = await supabase.from('staff').select('*').eq('id', currentJob.staff_id).single()
                currentJob.staff = stData
            }

            setJob(currentJob)

            if (currentJob && currentJob.id) {
                const { data: photoData } = await supabase.from('job_photos').select('*').eq('booking_id', id)
                const before = photoData?.find((p: any) => p.type === 'before')?.photo_urls || []
                const after = photoData?.find((p: any) => p.type === 'after')?.photo_urls || []
                setPhotos({ before, after })

                if (currentJob.additional_price) {
                    setAdditionalPrice(currentJob.additional_price)
                } else {
                    // Pre-populate from custom variable addons if not already set
                    const customAddon = (currentJob.addon_ids || []).find((a: any) => 
                        typeof a !== 'string' && a.variableState?.mode === 'custom' && a.variableState?.customAmount
                    )
                    if (customAddon) {
                        setAdditionalPrice(Number(customAddon.variableState.customAmount))
                    }
                }

                if (currentJob.additional_price_note) setAdditionalNote(currentJob.additional_price_note)

                // Fetch size adjustments for the branch
                const { data: adjData } = await supabase.from('service_size_adjustments').select('*')
                if (adjData) setSizeAdjustments(adjData)
            }
        } catch (err) {
            console.error('Error loading job:', err)
            setJob(null)
        } finally {
            setLoading(false)
        }
    }, [id])

    useEffect(() => { load() }, [load])

    const handleAccept = async () => {
        const staffData = JSON.parse(localStorage.getItem('staff_data') || '{}')
        if (!staffData.id) {
            alert('กรุณาเข้าสู่ระบบใหม่')
            return
        }
        setActionLoading(true)
        setShowConfirmModal(false)
        try {
            const { error: updateError } = await supabase.from('bookings').update({ staff_id: staffData.id, status: 'confirmed' }).eq('id', id)
            if (updateError) throw updateError

            // Also mark schedule slot as booked if they have one for this time
            await supabase.from('staff_schedules').update({ is_booked: true })
                .eq('staff_id', staffData.id).eq('zone_id', job.zone_id)
                .eq('date', job.scheduled_date).eq('time_slot', job.scheduled_time)
            
            await load()
        } catch (e: any) {
            console.error('Accept error:', e)
            alert('ไม่สามารถรับงานได้: ' + (e.message || 'เกิดข้อผิดพลาดบางอย่าง'))
        } finally {
            setActionLoading(false)
        }
    }

    const saveAdditionalCostData = async () => {
        if (additionalPrice === '' || isNaN(Number(additionalPrice)) || Number(additionalPrice) === 0) return
        setSavingCost(true)

        let slipUrls = [...(job.additional_price_slips || [])];

        for (const file of additionalSlipFiles) {
            const ext = file.name.split('.').pop()
            const fileName = `slip-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
            const { error: uploadError } = await supabase.storage
                .from('slips')
                .upload(`additional/${fileName}`, file)
            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(`additional/${fileName}`)
                slipUrls.push(publicUrl)
            }
        }

        // Calculate current addons total for correct total_price update
        let currentAddonsTotal = 0
        if (Array.isArray(job.addon_ids)) {
            job.addon_ids.forEach((addon: any) => {
                let price = 0
                if (typeof addon !== 'string') {
                    if (addon.isFree) price = 0
                    else if (addon.selectedPrice !== undefined) price = addon.selectedPrice
                    else if (addon.price !== undefined) price = addon.price
                    else if (addon.variableState?.customAmount) price = Number(addon.variableState.customAmount)
                }
                currentAddonsTotal += price
            })
        }

        // Calculate size adjustment
        const vSize = job.customers?.vehicle_size || 'S'
        const currentAdj = sizeAdjustments.find(a => a.vehicle_size === vSize)
        const adjAmount = currentAdj?.adjustment_amount || 0

        const newTotal = (job.base_price || 0) + adjAmount + currentAddonsTotal + (job.extra_fee || 0) + Number(additionalPrice) - (job.discount_amount || 0)

        await supabase.from('bookings').update({
            additional_price: Number(additionalPrice),
            additional_price_note: additionalNote,
            additional_price_slips: slipUrls,
            total_price: newTotal
        }).eq('id', id)
        
        setAdditionalSlipFiles([])
        setSavingCost(false)
    }

    const isFuelJob = job?.services?.name?.includes('น้ำมัน') || 
        (Array.isArray(job?.addon_ids) && job.addon_ids.some((a: any) => {
            const name = typeof a === 'string' ? a : (a.name || '')
            return name.includes('น้ำมัน')
        }))

    const handleStatusAction = async () => {
        const action = STATUS_ACTIONS[job.status]
        if (!action) return

        if (job.status === 'picking_up') {
            setUploadType('before')
            setShowPhotoUpload(true)
            return
        }
        if (job.status === 'washing') {
            setUploadType('after')
            setShowPhotoUpload(true)
            return
        }

        if (action.next === 'completed' && Number(job.additional_price) > 0 && !job.is_additional_paid) {
            alert('ลูกค้ายังไม่ได้ชำระค่าใช้จ่ายเพิ่มเติม กรุณารอให้ระบบแจ้งว่าชำระแล้วก่อนกดจบงาน')
            return
        }

        setActionLoading(true)
        await supabase.from('bookings').update({ 
            status: action.next,
            updated_at: new Date().toISOString()
        }).eq('id', id)

        fetch(`/api/bookings/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: action.next }),
        }).catch(() => {})

        load()
        setActionLoading(false)
    }

    const handleUpload = async () => {
        if (selectedFiles.length === 0) return
        setUploading(true)

        const urls: string[] = []
        for (const file of selectedFiles) {
            if (!file) continue
            const ext = file.name.split('.').pop()
            const path = `jobs/${id}/${uploadType}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
            const { data, error } = await supabase.storage
                .from('job-photos')
                .upload(path, file, { contentType: file.type })
            if (!error && data) {
                const { data: { publicUrl } } = supabase.storage.from('job-photos').getPublicUrl(path)
                urls.push(publicUrl)
            }
        }

        await supabase.from('job_photos').upsert({
            booking_id: id,
            type: uploadType,
            photo_urls: urls,
            uploaded_at: new Date().toISOString()
        })

        if (uploadType === 'after' && Number(additionalPrice) > 0) {
            await saveAdditionalCostData()
        }

        const nextStatus = uploadType === 'before' ? 'washing' : 'delivering'
        await supabase.from('bookings').update({ status: nextStatus }).eq('id', id)

        fetch(`/api/bookings/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nextStatus }),
        }).catch(() => {})

        setShowPhotoUpload(false)
        setSelectedFiles([])
        load()
        setUploading(false)
    }

    const handleCopy = () => {
        if (!job.customers?.phone) return
        navigator.clipboard.writeText(job.customers.phone)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
    }

    const [copySuccess, setCopySuccess] = useState(false)

    if (loading) return <div className="empty-state"><div className="spinner" /></div>
    if (!job) return <div className="empty-state"><p className="empty-state-title">ไม่พบงาน</p></div>

    const action = STATUS_ACTIONS[job.status]
    const isDifferent = job.pickup_lat && job.delivery_lat && 
        (Math.abs(job.pickup_lat - job.delivery_lat) > 0.0001 || 
         Math.abs(job.pickup_lng - job.delivery_lng) > 0.0001);

    const embedUrl = isDifferent 
        ? `https://maps.google.com/maps?saddr=${job.pickup_lat},${job.pickup_lng}&daddr=${job.delivery_lat},${job.delivery_lng}&output=embed`
        : `https://maps.google.com/maps?q=${job.pickup_lat},${job.pickup_lng}&z=15&output=embed`;

    const pickupNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${job.pickup_lat},${job.pickup_lng}`;
    const deliveryNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${job.delivery_lat},${job.delivery_lng}`;

    return (
        <>
        <div className="animate-fade" style={{ paddingBottom: 'calc(180px + env(safe-area-inset-bottom))' }}>
            <div className={styles.header}>
                <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← กลับ</button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span className={`badge badge-${job.status.replace('_', '-')}`}>{BOOKING_STATUS_LABEL[job.status as BookingStatus]}</span>
                    {job.staff && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📍 รับงานโดย: {job.staff.full_name}</span>}
                </div>
            </div>

            <div className={`card card-padded ${styles.section}`}>
                <div className={styles.sectionTitle}>👤 ข้อมูลลูกค้า</div>
                <div className={styles.infoGrid}>
                    <div className={styles.infoRow}><span>ชื่อลูกค้า</span><strong>{job.customers?.full_name || 'ไม่ระบุชื่อ'}</strong></div>
                    <div className={styles.infoRow}>
                        <span>เบอร์โทร</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <strong style={{ fontSize: '1.1rem' }}>{job.customers?.phone || 'ไม่พบเบอร์'}</strong>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <a href={`tel:${job.customers?.phone}`} className="btn btn-primary btn-sm">📞 โทรเลย</a>
                                <button className="btn btn-ghost btn-sm" onClick={handleCopy} style={{ border: '1px solid var(--border)', fontSize: '1rem', padding: '0 8px' }} title="คัดลอก">
                                    {copySuccess ? '✅' : '📋'}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className={styles.infoRow}><span>รถ</span><strong>{job.customers?.vehicle_brand} {job.customers?.vehicle_model}</strong></div>
                    <div className={styles.infoRow}><span>สี</span><strong>{job.customers?.vehicle_color || '-'}</strong></div>
                    <div className={styles.infoRow}><span>ทะเบียน</span><strong style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: 'var(--primary)' }}>{job.customers?.license_plate}</strong></div>
                </div>
            </div>

            <div className={`card card-padded ${styles.section}`}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', fontWeight: 800, marginBottom: 16 }}>
                    <ClipboardList size={20} color="var(--primary)" /> รายละเอียดการบริการ
                </h3>
                <InfoSection job={job} />
            </div>

            <div className={`card card-padded ${styles.section}`}>
                <div className={styles.sectionTitle}>📍 ตำแหน่งรับ/ส่งรถ</div>
                <div className={styles.infoGrid}>
                    <div className={styles.infoRow} style={{ alignItems: 'flex-start' }}>
                        <span>📍 จุดรับ</span>
                        <span style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 500 }}>{job.pickup_address}</span>
                    </div>
                    <div className={styles.infoRow} style={{ alignItems: 'flex-start' }}>
                        <span>🏁 จุดส่ง</span>
                        <span style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 500 }}>{job.delivery_address}</span>
                    </div>
                </div>

                <div className={styles.mapContainer} style={{ marginTop: 'var(--space-4)', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', height: 240 }}>
                    <iframe
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        style={{ border: 0 }}
                        src={embedUrl}
                        allowFullScreen
                    ></iframe>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isDifferent ? '1fr 1fr' : '1fr', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                    <a href={pickupNavUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-full" style={{ border: '1px solid var(--border)', fontSize: '0.85rem', padding: '10px 4px' }}>
                        📍 นำทางจุดรับ
                    </a>
                    {isDifferent && (
                        <a href={deliveryNavUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-full" style={{ border: '1px solid var(--border)', fontSize: '0.85rem', padding: '10px 4px' }}>
                            🏁 นำทางจุดส่ง
                        </a>
                    )}
                </div>
            </div>

            {job.customer_note && (
                <div className={`card card-padded ${styles.section}`} style={{ borderLeft: '4px solid var(--warning)', background: '#FFFDF0' }}>
                    <div className={styles.sectionTitle} style={{ color: '#856404', display: 'flex', alignItems: 'center', gap: 6 }}>
                        📝 หมายเหตุจากลูกค้า
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#856404', whiteSpace: 'pre-wrap' }}>
                        {job.customer_note}
                    </div>
                </div>
            )}

            {job.vehicle_photos && job.vehicle_photos.length > 0 && (
                <div className={`card card-padded ${styles.section}`}>
                    <div className={styles.sectionTitle}>📸 รูปประกอบจากลูกค้า</div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 4 }}>
                        {job.vehicle_photos.map((url: string, i: number) => (
                            <img 
                                key={i} src={url} alt={`customer-photo-${i}`} 
                                style={{ height: 120, width: 120, borderRadius: 'var(--radius)', objectFit: 'cover', flexShrink: 0 }} 
                                onClick={() => window.open(url, '_blank')}
                            />
                        ))}
                    </div>
                </div>
            )}

            {(photos.before.length > 0 || photos.after.length > 0) && (
                <div className={`card card-padded ${styles.section}`}>
                    <div className={styles.sectionTitle}>📸 รูปภาพ Before / After</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        {photos.before[0] && <div><p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>ก่อนล้าง</p><img src={photos.before[0]} alt="before" style={{ width: '100%', borderRadius: 'var(--radius)', objectFit: 'cover', aspectRatio: '4/3' }} /></div>}
                        {photos.after[0] && <div><p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>หลังล้าง</p><img src={photos.after[0]} alt="after" style={{ width: '100%', borderRadius: 'var(--radius)', objectFit: 'cover', aspectRatio: '4/3' }} /></div>}
                    </div>
                </div>
            )}

            {['washing', 'delivering', 'completed'].includes(job.status) && (
                <div className={`card ${styles.section} ${styles.costCard}`}>
                    <div className={styles.sectionTitle} style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>💰 ค่าใช้จ่ายเพิ่มเติมหน้างาน</span>
                        {Number(job.additional_price) > 0 && (
                            <span className={`badge ${job.is_additional_paid ? 'badge-completed' : 'badge-pending'}`} style={{ fontSize: '0.75rem' }}>
                                {job.is_additional_paid ? '✅ ชำระแล้ว' : '🕒 รอชำระ'}
                            </span>
                        )}
                    </div>
                    
                    <div className={styles.costInputGroup}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <label className={styles.fieldLabel}>💵 จำนวนเงิน (บาท)</label>
                            <div className={styles.priceInputWrapper}>
                                <span className={styles.currencySymbol}>฿</span>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="0.00"
                                    value={additionalPrice}
                                    onChange={e => setAdditionalPrice(e.target.value ? Number(e.target.value) : '')}
                                    disabled={job.status !== 'washing' || savingCost}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <label className={styles.fieldLabel}>📝 รายละเอียด / หมายเหตุ</label>
                            <textarea
                                className="form-input"
                                placeholder="เช่น เติมน้ำมัน 95 เต็มถัง"
                                rows={2}
                                value={additionalNote}
                                onChange={e => setAdditionalNote(e.target.value)}
                                disabled={job.status !== 'washing' || savingCost}
                            />
                        </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                <label className={styles.fieldLabel}>
                                    📸 แนบใบเสร็จ {Number(additionalPrice) > 0 && <span className={styles.mandatoryLabel}>(จำเป็น!)</span>}
                                </label>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12 }}>
                                    {[...(job.additional_price_slips || []), ...additionalSlipFiles.map(f => URL.createObjectURL(f))].map((url, idx) => (
                                        <div key={idx} className={styles.slipPreview} style={{ position: 'relative', width: '100%', aspectRatio: '1/1' }}>
                                            <img src={url} alt={`Slip ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                                            {job.status === 'washing' && (
                                                <button 
                                                    className={styles.removeSlip} 
                                                    onClick={() => {
                                                        const existingCount = (job.additional_price_slips || []).length
                                                        if (idx < existingCount) {
                                                            const newSlips = job.additional_price_slips.filter((_: any, i: number) => i !== idx)
                                                            supabase.from('bookings').update({ additional_price_slips: newSlips }).eq('id', id).then(() => load())
                                                        } else {
                                                            const newFiles = [...additionalSlipFiles]
                                                            newFiles.splice(idx - existingCount, 1)
                                                            setAdditionalSlipFiles(newFiles)
                                                        }
                                                    }}
                                                    style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, padding: 0 }}
                                                >✕</button>
                                            )}
                                        </div>
                                    ))}
                                    
                                    {job.status === 'washing' && (
                                        <div className={styles.slipUploadArea} onClick={() => document.getElementById('slip-input')?.click()} style={{ width: '100%', aspectRatio: '1/1', minHeight: 'unset' }}>
                                            <input
                                                type="file"
                                                id="slip-input"
                                                accept="image/*"
                                                multiple
                                                onChange={e => {
                                                    if (e.target.files) {
                                                        setAdditionalSlipFiles(prev => [...prev, ...Array.from(e.target.files!)])
                                                    }
                                                }}
                                                disabled={job.status !== 'washing' || savingCost}
                                                style={{ display: 'none' }}
                                            />
                                            <div className={styles.uploadPlaceholder}>
                                                <span>📷</span>
                                                <span style={{ fontSize: '0.6rem' }}>เพิ่มรูป</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        {job.status === 'washing' && (
                            <div style={{ marginTop: 'var(--space-2)', fontSize: '0.8rem', color: 'var(--info)', background: 'var(--info-light)', padding: '8px 12px', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>ℹ️</span> ข้อมูลจะถูกบันทึกอัตโนมัติเมื่อกดอัปโหลดรูปภาพหลังล้าง
                            </div>
                        )}

                        {job.status !== 'washing' && Number(additionalPrice) > 0 && (
                            <div className={styles.infoRow} style={{ marginTop: 'var(--space-2)', color: 'var(--primary)', fontWeight: 700, fontSize: '1.1rem' }}>
                                <span>รวมค่าใช้จ่ายเพิ่มเติม:</span>
                                <span>+฿{Number(additionalPrice).toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {((job.status === 'pending' && !job.staff_id) || action) && (
            <div className={styles.actionBar}>
                {job.status === 'pending' && !job.staff_id && (
                    <button className="btn btn-primary btn-full btn-lg" onClick={() => setShowConfirmModal(true)} disabled={actionLoading}>
                        {actionLoading ? <span className="spinner" /> : '✅ รับงานนี้'}
                    </button>
                )}
                {action && (
                    <button
                        className="btn btn-full btn-lg"
                        style={{ 
                            background: action.color, 
                            color: '#fff',
                            opacity: (
                                (job.status === 'washing' && Number(additionalPrice) > 0 && additionalSlipFiles.length === 0 && (!job.additional_price_slips || job.additional_price_slips.length === 0)) ||
                                (job.status === 'washing' && isFuelJob && (Number(additionalPrice) === 0 || additionalPrice === '')) ||
                                (job.status === 'delivering' && Number(job.additional_price) > 0 && !job.is_additional_paid)
                            ) ? 0.5 : 1
                        }}
                        onClick={handleStatusAction}
                        disabled={actionLoading || 
                            (job.status === 'washing' && Number(additionalPrice) > 0 && additionalSlipFiles.length === 0 && (!job.additional_price_slips || job.additional_price_slips.length === 0)) ||
                            (job.status === 'washing' && isFuelJob && (Number(additionalPrice) === 0 || additionalPrice === '')) ||
                            (job.status === 'delivering' && Number(job.additional_price) > 0 && !job.is_additional_paid)
                        }
                    >
                        {actionLoading ? <span className="spinner" /> : action.label}
                    </button>
                )}
            </div>
        )}

        {showPhotoUpload && (
            <div className="overlay" onClick={() => setShowPhotoUpload(false)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                        📸 ถ่ายรูปรถ ({uploadType === 'before' ? 'ก่อนล้าง' : 'หลังล้าง'})
                    </h2>
                    <div className="photo-grid" style={{ marginBottom: 'var(--space-5)' }}>
                        {[0, 1, 2, 3].map((side) => (
                            <label key={side} className="photo-slot">
                                {selectedFiles[side] ? (
                                    <img src={URL.createObjectURL(selectedFiles[side])} alt={`photo-${side}`} />
                                ) : (
                                    <><span className="photo-slot-icon">📷</span><span className="photo-slot-label">{['หน้า', 'หลัง', 'ซ้าย', 'ขวา'][side]}</span></>
                                )}
                                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                                    onChange={e => {
                                        if (e.target.files?.[0]) {
                                            const files = [...selectedFiles]
                                            files[side] = e.target.files[0]
                                            setSelectedFiles(files)
                                        }
                                    }}
                                />
                            </label>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <button className="btn btn-ghost btn-full" onClick={() => setShowPhotoUpload(false)}>ยกเลิก</button>
                        <button 
                            className="btn btn-primary btn-full" 
                            onClick={handleUpload} 
                            disabled={
                                uploading || 
                                selectedFiles.filter(Boolean).length === 0 ||
                                (uploadType === 'after' && Number(additionalPrice) > 0 && additionalSlipFiles.length === 0 && (!job.additional_price_slips || job.additional_price_slips.length === 0)) ||
                                (uploadType === 'after' && isFuelJob && (Number(additionalPrice) === 0 || additionalPrice === ''))
                            }
                        >
                            {uploading ? <span className="spinner" /> : '📤 อัปโหลด'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showConfirmModal && (
            <div className={styles.modalOverlay} onClick={() => setShowConfirmModal(false)}>
                <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>🤔</div>
                    <h3 className={styles.modalTitle}>รับงานนี้ใช่หรือไม่?</h3>
                    <p className={styles.modalDesc}>
                        เมื่อกดรับแล้ว คุณจะต้องรับผิดชอบงานนี้<br/>
                        {job.scheduled_time?.slice(0, 5)} น. ({job.scheduled_date})
                    </p>
                    <div className={styles.modalActions}>
                        <button className="btn btn-ghost btn-full" onClick={() => setShowConfirmModal(false)}>ยกเลิก</button>
                        <button className="btn btn-primary btn-full" style={{ background: 'var(--primary)', borderColor: 'var(--primary)' }} onClick={handleAccept}>
                            ✅ ยืนยันรับงาน
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}
