'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ChevronLeft, Calendar, Clock, MapPin, Bike, CheckCircle2, CheckCircle,
    Upload, X, Image as ImageIcon, MessageCircle, Phone,
    Info, Star, ClipboardList, AlertCircle, Tag, Package,
    User, HelpCircle, BadgeDollarSign, Receipt, History, FileText
} from 'lucide-react'
import ImageZoom from '@/components/Global/ImageZoom'
import BookingChat from '@/components/Chat/BookingChat'
import { supabase } from '@/lib/supabase'
import { Booking, JobPhoto, Service, VEHICLE_SIZE_LABEL, BOOKING_STATUS_LABEL, BookingStatus } from '@/lib/types'
import styles from './job.module.css'

const STATUS_ACTIONS: Record<string, { label: string; next: BookingStatus; color: string; icon: any }> = {
    confirmed: { label: 'ออกรับรถ', next: 'picking_up', color: 'var(--brand-dominant)', icon: Bike },
    picking_up: { label: 'อัปโหลดรูปก่อนล้าง', next: 'washing', color: 'var(--brand-dominant)', icon: Upload },
    washing: { label: 'อัปโหลดรูปหลังล้าง', next: 'delivering', color: 'var(--brand-dominant)', icon: Upload },
    delivering: { label: 'ถึงที่หมายแล้ว', next: 'completed', color: 'var(--success)', icon: CheckCircle2 },
}

const InfoSection = ({ job, addons }: { job: any, addons: any[] }) => {
    // ── Package breakdown (for display only, not used in total calc) ──
    const pkgMarkup = job.package_markup_amount || 0
    const originalBase = job.original_base_price || job.services?.price_s || 0
    const ccAdj = job.original_base_price !== undefined
        ? Math.max(0, (job.base_price || 0) - originalBase - pkgMarkup)
        : Math.max(0, (job.base_price || 0) - (job.services?.price_s || 0))

    let rowAddonTotal = 0
    if (Array.isArray(job.addon_ids)) {
        job.addon_ids.forEach((a: any) => {
            const addonObj = typeof a === 'string' ? addons.find((da: any) => da.id === a || da.name === a) : a
            rowAddonTotal += (addonObj?.price || addonObj?.selectedPrice || 0)
        })
    }

    const travelSurcharge = Math.round(job.travel_surcharge || 0)
    const diffSpotFee = Math.round(job.different_spot_fee || 0)
    const additional = job.additional_price || 0
    const discount = Math.round(job.discount_amount || 0)

    // ── Source of truth: gross total stored in DB (before discount) ──
    const grossTotal = job.total_price && job.total_price > 0
        ? Math.round(job.total_price)
        : (job.base_price || 0) + rowAddonTotal + travelSurcharge + diffSpotFee
    const isRebooking = discount > 0 && (discount >= grossTotal || (job.discount_code && /rebook|refund/i.test(job.discount_code)))
    
    // ── Net = what the customer owes for booking (excl. additional) ──
    const netTotal = Math.max(0, grossTotal - discount)
    // ── Display Total (Staff sees full value if rebooking) ──
    const displayNetTotal = isRebooking ? grossTotal : netTotal
    // ── Full bill including on-site additional ──
    const totalBill = displayNetTotal + additional
    // ── What was already paid online via Stripe / free booking ──
    const paidOnline = isRebooking ? grossTotal : Math.max(0, netTotal) // Stripe charge = netTotal (before additional)
    // ── Additional balance ──
    const additionalBalance = job.is_additional_paid ? 0 : additional
    // ── Total balance still owed (incl. additional if not paid) ──
    const balance = additionalBalance

    const paidLabel = job.is_additional_paid || job.status === 'completed'
        ? 'ยอดชำระทั้งหมด (Settled)'
        : 'ยอดชำระแล้วผ่านแอป (Paid)'

    const Row = ({ label, value, color }: { label: string; value: number | string; color?: string }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontWeight: 700, color: color || 'var(--text-primary)' }}>
                {typeof value === 'number' ? `฿${value.toLocaleString()}` : value}
            </span>
        </div>
    )

    return (
        <div className={styles.jobItem}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{job.services?.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>ไซส์รถ (CC): <strong>{VEHICLE_SIZE_LABEL[job.customers?.vehicle_size] || job.customers?.vehicle_size || 'ไม่ระบุ'}</strong></div>
                </div>
                <div style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '1.05rem' }}>฿{displayNetTotal.toLocaleString()}</div>
            </div>

            {/* Addons List */}
            {Array.isArray(job.addon_ids) && job.addon_ids.length > 0 && (
                <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>บริการเสริม</div>
                    {job.addon_ids.map((a: any, idx: number) => {
                        const addonObj = typeof a === 'string' ? addons.find((da: any) => da.id === a || da.name === a) : a
                        const label = addonObj?.name || (typeof a === 'string' ? a : 'บริการเสริม')
                        const price = addonObj?.price || addonObj?.selectedPrice || 0
                        return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    • {label}
                                </span>
                                <span style={{ fontWeight: 700 }}>
                                    {addonObj?.isFree ? 'ฟรี' : `฿${price.toLocaleString()}`}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Financial Summary */}
            <div style={{ marginTop: 24, padding: '20px 16px', background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                    <BadgeDollarSign size={20} color="var(--brand-dominant)" />
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>สรุปรายละเอียดงานและการเงิน</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Row label="ค่าบริการหลัก (S)" value={originalBase} />
                    {pkgMarkup > 0 && <Row label="ส่วนต่างสาขา" value={pkgMarkup} color="var(--brand-dominant)" />}
                    {ccAdj > 0 && <Row label={`ส่วนต่าง CC (${VEHICLE_SIZE_LABEL[job.customers?.vehicle_size] || job.customers?.vehicle_size})`} value={ccAdj} color="var(--danger)" />}
                    {rowAddonTotal > 0 && <Row label="บริการเสริมรวม" value={rowAddonTotal} color="var(--brand-secondary)" />}
                    {travelSurcharge > 0 && <Row label="ค่าเดินทางไปจุดรับ" value={travelSurcharge} color="var(--primary)" />}
                    {diffSpotFee > 0 && <Row label="ค่ารับ-ส่งต่างสถานที่" value={diffSpotFee} color="var(--primary)" />}
                    {discount > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', margin: '4px 0', padding: '8px', background: 'rgba(16,185,129,0.06)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.15)' }}>
                            <Row 
                                label={isRebooking ? `จองใหม่ทดแทน (Rebooking)` : `ส่วนลด${job.discount_code ? ` (${job.discount_code})` : ''}`} 
                                value={isRebooking ? 'ฟรี' : `-฿${discount.toLocaleString()}`} 
                                color="var(--success)" 
                            />
                        </div>
                    )}
                    {additional > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', margin: '4px 0', padding: '8px', background: 'var(--warning-ghost)', borderRadius: 8 }}>
                            <Row label="ยอดเพิ่มเติมหน้างาน" value={additional} color="var(--warning-dark)" />
                            {job.additional_price_note && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>* {job.additional_price_note}</div>
                            )}
                        </div>
                    )}

                    <div style={{
                        marginTop: 12,
                        padding: '12px 0 0',
                        borderTop: '2px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-primary)' }}>ยอดรวมทั้งสิ้น (Total Bill)</span>
                        <span style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--brand-dominant)' }}>฿{totalBill.toLocaleString()}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.85rem', color: 'var(--success)' }}>
                        <span>{paidLabel}</span>
                        <span>฿{paidOnline.toLocaleString()}</span>
                    </div>

                    {balance > 0 && job.status !== 'completed' && (
                        <div style={{
                            marginTop: 16,
                            padding: '16px',
                            borderRadius: '14px',
                            background: '#FFD700',
                            color: '#2D2D2D',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            border: '1px solid #E6C200'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, opacity: 0.8 }}>ยอดที่ต้องเก็บเพิ่ม (Pending)</span>
                                <span style={{ fontSize: '1.6rem', fontWeight: 900 }}>฿{balance.toLocaleString()}</span>
                            </div>
                            <Receipt size={32} />
                        </div>
                    )}

                    {job.status === 'completed' && (
                        <div style={{
                            marginTop: 16,
                            padding: '14px',
                            borderRadius: '12px',
                            background: 'var(--success-ghost)',
                            color: 'var(--success-dark)',
                            textAlign: 'center',
                            fontWeight: 800,
                            border: '1.5px solid var(--success-light)',
                            fontSize: '1rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <CheckCircle size={22} /> ชำระครบถ้วนแล้วและจบงาน
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function JobDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [job, setJob] = useState<any>(null)
    const [addons, setAddons] = useState<any[]>([])
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
    const [savingCost, setSavingCost] = useState(false)

    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [copySuccess, setCopySuccess] = useState(false)
    const [zoomConfig, setZoomConfig] = useState<{ images: { src: string; alt?: string }[]; initialIndex: number } | null>(null)
    const [showStaffChat, setShowStaffChat] = useState(false)
    const [staffId, setStaffId] = useState('')

    const load = useCallback(async () => {
        try {
            const [jobRes, addonRes] = await Promise.all([
                supabase
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
                    .single(),
                supabase.from('addons').select('*')
            ])

            if (jobRes.error) throw jobRes.error
            if (addonRes.data) setAddons(addonRes.data)
            
            const currentJob = jobRes.data ? { ...jobRes.data } : null

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
                    const customAddon = (currentJob.addon_ids || []).find((a: any) =>
                        typeof a !== 'string' && a.variableState?.mode === 'custom' && a.variableState?.customAmount
                    )
                    if (customAddon) {
                        setAdditionalPrice(Number(customAddon.variableState.customAmount))
                    }
                }

                if (currentJob.additional_price_note) setAdditionalNote(currentJob.additional_price_note)
            }
        } catch (err) {
            console.error('Error loading job:', err)
            setJob(null)
        } finally {
            setLoading(false)
        }
    }, [id])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        const data = localStorage.getItem('staff_data')
        if (data) setStaffId(JSON.parse(data).id || '')
    }, [])

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

            await load()
        } catch (e: any) {
            console.error('Accept error:', e)
            alert('ไม่สามารถรับงานได้: ' + (e.message || 'เกิดข้อผิดพลาดบางอย่าง'))
        } finally {
            setActionLoading(false)
        }
    }

    const saveAdditionalCostData = async () => {
        // Only return if price is unset AND there are no new slips
        if ((additionalPrice === '' || isNaN(Number(additionalPrice))) && additionalSlipFiles.length === 0) return

        setSavingCost(true)
        console.log('[CostSave] Starting save for booking:', id)

        try {
            let slipUrls = [...(job.additional_price_slips || [])];

            // Upload new slips
            for (const file of additionalSlipFiles) {
                const ext = file.name.split('.').pop()
                const fileName = `slip-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
                const { error: uploadError } = await supabase.storage
                    .from('slips')
                    .upload(`additional/${fileName}`, file)

                if (uploadError) {
                    console.error('[CostSave] Slip upload failed:', uploadError)
                } else {
                    const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(`additional/${fileName}`)
                    slipUrls.push(publicUrl)
                }
            }

            const oldAdditionalPrice = Number(job.additional_price) || 0
            const newAdditionalPrice = Number(additionalPrice) || 0
            const priceDiff = newAdditionalPrice - oldAdditionalPrice

            // Prepare History
            const history = [...(job.additional_history || [])]
            if (newAdditionalPrice !== oldAdditionalPrice || additionalNote !== job.additional_price_note) {
                history.push({
                    price: newAdditionalPrice,
                    note: additionalNote,
                    timestamp: new Date().toISOString(),
                    staff: job.staff?.full_name || 'Staff'
                })
            }

            const updateData: any = {
                additional_price: newAdditionalPrice,
                additional_price_note: additionalNote,
                additional_price_slips: slipUrls,
                additional_history: history
            }

            console.log('[CostSave] Updating booking with:', updateData)
            const { error: updateError } = await supabase.from('bookings').update(updateData).eq('id', id)

            if (updateError) throw updateError

            // Trigger notification to customer if price increased significantly
            if (job.customer_id && newAdditionalPrice > oldAdditionalPrice) {
                const { NOTIFICATIONS } = await import('@/lib/notifications-config')
                const notif = NOTIFICATIONS.CUSTOMER.PAYMENT_PENDING
                const message = notif.lineMessage(newAdditionalPrice, additionalNote || 'ค่าบริการเพิ่มเติม')
                const pushTitle = notif.pushTitle
                
                // Web Push
                fetch('/api/push/notify-customer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customer_id: job.customer_id,
                        title: pushTitle,
                        body: message,
                        url: `/${job.branches?.slug || 'menu'}/my-bookings`
                    })
                }).catch(() => { })

                // Line
                if (job.customers?.line_user_id) {
                    fetch('/api/line/notify-customer', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            line_user_id: job.customers.line_user_id,
                            message: message,
                            booking_id: id,
                        }),
                    }).catch(() => { })
                }
            }

            setAdditionalSlipFiles([])
            console.log('[CostSave] Save completed successfully')
        } catch (err: any) {
            console.error('[CostSave] Error:', err)
            // We don't alert here to not break the photo upload flow if it's called from there, 
            // but we log it clearly.
        } finally {
            setSavingCost(false)
        }
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

        if (localStorage.getItem('foami_mock_db_enabled') === 'true') {
            console.log('[MockDB] Updating status locally:', action.next)
            await supabase.from('bookings').update({
                status: action.next,
                updated_at: new Date().toISOString()
            }).eq('id', id)

            // Trigger notification to customer in same-device testing
            if (job.customer_id) {
                const localSubs = JSON.parse(localStorage.getItem('foami_mock_db_push_subscriptions') || '[]')
                const targetSub = localSubs.find((s: any) => s.user_id === job.customer_id && s.platform === 'customer')

                if (targetSub) {
                    fetch('/api/push/send-test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            subscription: targetSub.subscription,
                            title: `🔔 อัปเดตสถานะ: ${BOOKING_STATUS_LABEL[action.next]}`,
                            body: `รายการล้าง ${job.services?.name} ของคุณได้รับการอัปเดตสถานะแล้ว`,
                            url: `/my-bookings`
                        }),
                    }).catch(() => { })
                }
            }

            load()
            setActionLoading(false)
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
        }).catch(() => { })

        load()
        setActionLoading(false)
    }

    const handleUpload = async () => {
        if (selectedFiles.filter(Boolean).length < 4) {
            alert('กรุณาอัปโหลดรูปภาพให้ครบ 4 รูป (หน้า, หลัง, ซ้าย, ขวา) เพื่อความถูกต้องของงาน')
            return
        }
        setUploading(true)

        const urls: string[] = []
        for (const [index, file] of selectedFiles.entries()) {
            if (!file) continue
            const ext = file.name.split('.').pop()
            const path = `jobs/${id}/${uploadType}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

            console.log(`[handleUpload] Uploading photo ${index + 1}/${selectedFiles.length}...`)
            const { data, error } = await supabase.storage
                .from('job-photos')
                .upload(path, file, { contentType: file.type })

            if (error) {
                console.error(`[handleUpload] Photo ${index + 1} failed:`, error)
                alert(`อัปโหลดรูปที่ ${index + 1} ไม่สำเร็จ: ${error.message}\nตรวจสอบว่าคุณได้สร้าง Bucket "job-photos" ใน Supabase แล้ว`)
                setUploading(false)
                return // Stop everything if a photo fails
            }

            if (data) {
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

        if (uploadType === 'after' && (Number(additionalPrice) > 0 || additionalSlipFiles.length > 0)) {
            console.log('[handleUpload] Triggering additional cost save before status change...')
            await saveAdditionalCostData()
        }

        const nextStatus = uploadType === 'before' ? 'washing' : 'delivering'
        console.log('[handleUpload] Updating status to:', nextStatus)

        const { error: statusError } = await supabase.from('bookings').update({ status: nextStatus }).eq('id', id)
        if (statusError) console.error('[handleUpload] Status update failed:', statusError)
        if (localStorage.getItem('foami_mock_db_enabled') !== 'true') {
            fetch(`/api/bookings/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus }),
            }).catch(() => { })
        }

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
            <div className="animate-fade" style={{ paddingBottom: 'calc(160px + env(safe-area-inset-bottom, 20px))' }}>
                <div className={styles.header}>
                    <button className="btn btn-ghost btn-sm" style={{ gap: 6, display: 'flex', alignItems: 'center' }} onClick={() => router.back()}><ChevronLeft size={18} /> กลับ</button>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span className={`badge badge-${job.status.replace('_', '-')}`}>{BOOKING_STATUS_LABEL[job.status as BookingStatus]}</span>
                        {job.staff && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>รับงานโดย: {job.staff.full_name}</span>}
                    </div>
                </div>

                <div className={`card card-padded ${styles.section}`}>
                    <div className={styles.sectionTitle}><User size={18} /> ข้อมูลลูกค้า</div>
                    <div className={styles.infoGrid}>
                        <div className={styles.infoRow}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={14} /> ชื่อลูกค้า</span><strong>{job.customers?.full_name || 'ไม่ระบุชื่อ'}</strong></div>
                        <div className={styles.infoRow}>
                            <span>เบอร์โทร</span>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <strong style={{ fontSize: '1.1rem' }}>{job.customers?.phone || 'ไม่พบเบอร์'}</strong>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <a href={`tel:${job.customers?.phone}`} className="btn btn-primary btn-sm" style={{ gap: 6 }}>
                                        <Phone size={14} /> โทรเลย
                                    </a>
                                    <button className="btn btn-ghost btn-sm" onClick={handleCopy} style={{ border: '1px solid var(--border)', fontSize: '1rem', padding: '0 8px', borderRadius: '10px' }} title="คัดลอก">
                                        {copySuccess ? <CheckCircle2 size={16} color="var(--success)" /> : <ClipboardList size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className={styles.infoRow}><span>รถ</span><strong>{job.customers?.vehicle_brand} {job.customers?.vehicle_model}</strong></div>
                        <div className={styles.infoRow}><span>สี</span><strong>{job.customers?.vehicle_color || '-'}</strong></div>
                        <div className={styles.infoRow}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Package size={14} /> ทะเบียน</span><strong style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: 'var(--primary)' }}>{job.customers?.license_plate}</strong></div>
                    </div>
                </div>

                <div className={`card card-padded ${styles.section}`}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', fontWeight: 800, marginBottom: 16 }}>
                        <ClipboardList size={20} color="var(--primary)" /> รายละเอียดการบริการ
                    </h3>
                    <InfoSection job={job} addons={addons} />
                </div>

                <div className={`card card-padded ${styles.section}`}>
                    <div className={styles.sectionTitle}><MapPin size={18} /> ตำแหน่งรับ/ส่งรถ</div>
                    <div className={styles.infoGrid}>
                        <div className={styles.infoRow} style={{ alignItems: 'flex-start' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={14} /> จุดรับ</span>
                            <span style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 500 }}>{job.pickup_address}</span>
                        </div>
                        <div className={styles.infoRow} style={{ alignItems: 'flex-start' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14} /> จุดส่ง</span>
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
                        <a href={pickupNavUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-full" style={{ border: '1px solid var(--border)', fontSize: '0.85rem', padding: '10px 4px', borderRadius: '12px', gap: 6 }}>
                            <MapPin size={14} /> นำทางจุดรับ
                        </a>
                        {isDifferent && (
                            <a href={deliveryNavUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-full" style={{ border: '1px solid var(--border)', fontSize: '0.85rem', padding: '10px 4px', borderRadius: '12px', gap: 6 }}>
                                <CheckCircle2 size={14} /> นำทางจุดส่ง
                            </a>
                        )}
                    </div>
                </div>

                {job.customer_note && (
                    <div className={`card card-padded ${styles.section}`} style={{ borderLeft: '4px solid var(--warning)', background: '#FFFDF0' }}>
                        <div className={styles.sectionTitle} style={{ color: '#856404', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <MessageCircle size={18} /> หมายเหตุจากลูกค้า
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#856404', whiteSpace: 'pre-wrap' }}>
                            {job.customer_note}
                        </div>
                    </div>
                )}

                {job.vehicle_photos && job.vehicle_photos.length > 0 && (
                    <div className={`card card-padded ${styles.section}`}>
                        <div className={styles.sectionTitle}><ImageIcon size={18} /> รูปประกอบจากลูกค้า</div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 4 }}>
                            {job.vehicle_photos.map((url: string, i: number) => (
                                <img
                                    key={i} src={url} alt={`customer-photo-${i}`}
                                    style={{ height: 120, width: 120, borderRadius: 'var(--radius)', objectFit: 'cover', flexShrink: 0, cursor: 'zoom-in' }}
                                    onClick={() => setZoomConfig({
                                        images: job.vehicle_photos.map((v: string, idx: number) => ({ src: v, alt: `รูปประกอบจากลูกค้า (${idx + 1})` })),
                                        initialIndex: i
                                    })}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {(photos.before.length > 0 || photos.after.length > 0) && (
                    <div className={`card card-padded ${styles.section}`}>
                        <div className={styles.sectionTitle}><ImageIcon size={18} /> รูปภาพ Before / After</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            {(() => {
                                const jobPhotos = [
                                    ...photos.before.map((url, idx) => ({ src: url, alt: `รูปถ่ายก่อนล้าง (${idx + 1})` })),
                                    ...photos.after.map((url, idx) => ({ src: url, alt: `รูปถ่ายหลังล้าง (${idx + 1})` }))
                                ]
                                return (
                                    <>
                                        {photos.before[0] && (
                                            <div>
                                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>ก่อนล้าง</p>
                                                <img
                                                    src={photos.before[0]} alt="before"
                                                    style={{ width: '100%', borderRadius: 'var(--radius)', objectFit: 'cover', aspectRatio: '4/3', cursor: 'zoom-in' }}
                                                    onClick={() => setZoomConfig({ images: jobPhotos, initialIndex: 0 })}
                                                />
                                            </div>
                                        )}
                                        {photos.after[0] && (
                                            <div>
                                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>หลังล้าง</p>
                                                <img
                                                    src={photos.after[0]} alt="after"
                                                    style={{ width: '100%', borderRadius: 'var(--radius)', objectFit: 'cover', aspectRatio: '4/3', cursor: 'zoom-in' }}
                                                    onClick={() => setZoomConfig({ images: jobPhotos, initialIndex: photos.before.length })}
                                                />
                                            </div>
                                        )}
                                    </>
                                )
                            })()}
                        </div>
                    </div>
                )}

                {['washing', 'delivering', 'completed'].includes(job.status) && (
                    <div className={`${styles.card} ${styles.section} ${styles.costCard}`} style={{ padding: 'var(--space-6)', borderRadius: '24px' }}>
                        <div className={styles.sectionTitle} style={{ marginBottom: 'var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: '1.2rem' }}>
                                <BadgeDollarSign size={24} color="var(--brand-dominant)" /> ค่าใช้จ่ายเพิ่มเติมหน้างาน
                            </span>
                            {Number(job.additional_price) > 0 && (
                                <span className={`badge ${job.is_additional_paid ? 'badge-completed' : 'badge-pending'}`} style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '10px' }}>
                                    {job.is_additional_paid ? 'ชำระแล้ว' : 'รอชำระ'}
                                </span>
                            )}
                        </div>

                        <div className={styles.costInputGroup}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <label className={styles.fieldLabel}>
                                    จำนวนเงิน (บาท)
                                </label>
                                <div className={styles.priceInputWrapper}>
                                    <span className={styles.currencySymbol}>฿</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={additionalPrice}
                                        onChange={e => setAdditionalPrice(e.target.value ? Number(e.target.value) : '')}
                                        disabled={job.status !== 'washing' || savingCost}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <label className={styles.fieldLabel}>
                                    รายละเอียด / หมายเหตุ
                                </label>
                                <textarea
                                    className="form-input"
                                    placeholder="เช่น เติมน้ำมัน 95 เต็มถัง"
                                    rows={2}
                                    value={additionalNote}
                                    onChange={e => setAdditionalNote(e.target.value)}
                                    disabled={job.status !== 'washing' || savingCost}
                                    style={{ borderRadius: '16px', padding: '16px', fontSize: '0.95rem', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <label className={styles.fieldLabel} style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                    แนบใบเสร็จ {Number(additionalPrice) > 0 && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>(จำเป็น!)</span>}
                                </label>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 12 }}>
                                    {[...(job.additional_price_slips || []), ...additionalSlipFiles.map(f => URL.createObjectURL(f))].map((url, idx) => (
                                        <div key={idx} className={styles.slipPreview} style={{ position: 'relative', width: '100%', aspectRatio: '1/1' }}>
                                            <img
                                                src={url}
                                                alt={`Slip ${idx}`}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)', cursor: 'zoom-in' }}
                                                onClick={() => {
                                                    const allSlips = [...(job.additional_price_slips || []), ...additionalSlipFiles.map(f => URL.createObjectURL(f))]
                                                    setZoomConfig({
                                                        images: allSlips.map((s, i) => ({ src: s, alt: `ใบเสร็จค่าใช้จ่ายเพิ่มเติม (${i + 1})` })),
                                                        initialIndex: idx
                                                    })
                                                }}
                                            />
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
                                                    style={{ position: 'absolute', top: -4, right: -4, background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                                ><X size={12} /></button>
                                            )}
                                        </div>
                                    ))}

                                    {job.status === 'washing' && (
                                        <div className={styles.slipUploadArea} onClick={() => document.getElementById('slip-input')?.click()} style={{ width: '100%', aspectRatio: '1/1', minHeight: 'unset', borderRadius: 12, border: '2px dashed var(--border)', background: 'var(--surface-3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
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
                                            <Upload size={20} color="var(--text-muted)" />
                                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: 4 }}>แนบรูป</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {job.status === 'washing' && (
                            <div style={{ marginTop: 24, padding: '16px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--brand-dominant-ghost) 0%, #EFF6FF 100%)', border: '1px solid var(--brand-dominant-light)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <Info size={18} color="var(--brand-dominant)" style={{ marginTop: 2 }} />
                                <span style={{ fontSize: '0.85rem', color: 'var(--brand-dominant-dark)', fontWeight: 600, lineHeight: 1.5 }}>บันทึกข้อมูลและใบเสร็จให้เรียบร้อย ระบบจะสรุปยอดรวมเมื่อคุณกด "อัปโหลดรูปหลังล้าง"</span>
                            </div>
                        )}

                    </div>
                )}
            </div>

            {/* Bottom Action Bar */}
            {((job.status === 'pending' && !job.staff_id) || action) && (
                <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0,
                    padding: '12px 20px calc(24px + env(safe-area-inset-bottom, 16px))',
                    background: 'white',
                    borderTop: '1px solid var(--border)',
                    boxShadow: '0 -10px 40px rgba(0,0,0,0.06)',
                    zIndex: 200, 
                    display: 'flex', flexDirection: 'column'
                }}>
                    {job.status === 'pending' && !job.staff_id ? (
                        <button 
                            className="btn btn-primary" 
                            style={{ 
                                height: 58, borderRadius: 20, fontSize: '1.1rem', fontWeight: 800, 
                                background: 'var(--brand-dominant)', border: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                boxShadow: '0 8px 25px rgba(49,94,195,0.3)',
                                width: '100%'
                            }} 
                            onClick={() => setShowConfirmModal(true)} 
                            disabled={actionLoading}
                        >
                            {actionLoading ? <span className="spinner" /> : <><CheckCircle size={22} /> รับงานนี้</>}
                        </button>
                    ) : action && (
                        <button
                            className="btn btn-primary"
                            style={{
                                background: action.color,
                                border: 'none',
                                borderRadius: '20px',
                                height: 58,
                                fontSize: '1.1rem',
                                fontWeight: 800,
                                color: 'white',
                                boxShadow: `0 8px 25px ${action.color}44`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10,
                                width: '100%',
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
                            {actionLoading ? <span className="spinner" /> : <>{action.icon && <action.icon size={22} />} {action.label}</>}
                        </button>
                    )}
                </div>
            )}

            {/* Overlays */}
            {showPhotoUpload && (
                <div className="overlay" onClick={() => setShowPhotoUpload(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 900, marginBottom: 'var(--space-5)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <ImageIcon size={22} color="var(--brand-dominant)" /> ถ่ายรูปรถ ({uploadType === 'before' ? 'ก่อนล้าง' : 'หลังล้าง'})
                        </h2>
                        <div className="photo-grid" style={{ marginBottom: 'var(--space-5)' }}>
                            {[0, 1, 2, 3].map((side) => (
                                <label key={side} className="photo-slot">
                                    {selectedFiles[side] ? (
                                        <img src={URL.createObjectURL(selectedFiles[side])} alt={`photo-${side}`} />
                                    ) : (
                                        <><Upload size={24} color="var(--text-muted)" /><span className="photo-slot-label" style={{ fontWeight: 700, fontSize: '0.75rem' }}>{['หน้า', 'หลัง', 'ซ้าย', 'ขวา'][side]}</span></>
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
                                    selectedFiles.filter(Boolean).length < 4 ||
                                    (uploadType === 'after' && Number(additionalPrice) > 0 && additionalSlipFiles.length === 0 && (!job.additional_price_slips || job.additional_price_slips.length === 0)) ||
                                    (uploadType === 'after' && isFuelJob && (Number(additionalPrice) === 0 || additionalPrice === ''))
                                }
                            >
                                {uploading ? <span className="spinner" /> : <><Upload size={18} /> อัปโหลด ({selectedFiles.filter(Boolean).length}/4)</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showConfirmModal && (
                <div className={styles.modalOverlay} onClick={() => setShowConfirmModal(false)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
                            <HelpCircle size={64} color="var(--brand-dominant)" />
                        </div>
                        <h3 className={styles.modalTitle}>รับงานนี้ใช่หรือไม่?</h3>
                        <p className={styles.modalDesc}>
                            เมื่อกดรับแล้ว คุณจะต้องรับผิดชอบงานนี้<br />
                            {job.scheduled_time?.slice(0, 5)} น. ({job.scheduled_date})
                        </p>
                        <div className={styles.modalActions}>
                            <button className="btn btn-ghost btn-full" style={{ borderRadius: '16px' }} onClick={() => setShowConfirmModal(false)}>ยกเลิก</button>
                            <button className="btn btn-primary btn-full" style={{ background: 'var(--brand-dominant)', border: 'none', borderRadius: '16px', gap: 8 }} onClick={handleAccept}>
                                <CheckCircle2 size={18} /> ยืนยันรับงาน
                            </button>
                        </div>
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

            {/* Floating Chat Button */}
            {['confirmed', 'picking_up', 'washing', 'delivering'].includes(job.status) && (
                <button
                    onClick={() => setShowStaffChat(true)}
                    style={{
                        position: 'fixed', bottom: 'calc(140px + env(safe-area-inset-bottom, 20px))', right: 24,
                        width: 68, height: 68, borderRadius: '50%',
                        background: '#315EC3',
                        border: '5px solid white',
                        boxShadow: '0 12px 36px rgba(49,94,195,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', zIndex: 1000, 
                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        padding: 0,
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.15) rotate(-5deg)'
                        e.currentTarget.style.boxShadow = '0 16px 48px rgba(49,94,195,0.6)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1) rotate(0deg)'
                        e.currentTarget.style.boxShadow = '0 12px 36px rgba(49,94,195,0.4)'
                    }}
                >
                    <MessageCircle size={34} color="white" fill="white" fillOpacity={0.2} />
                </button>
            )}

            {/* Chat Slide-up Panel */}
            {showStaffChat && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 5000,
                        background: 'rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                    }}
                    onClick={() => setShowStaffChat(false)}
                >
                    <div
                        className="animate-slide-up"
                        style={{ 
                            height: '84vh',
                            background: 'white', 
                            borderRadius: '32px 32px 0 0', 
                            overflow: 'hidden',
                            boxShadow: '0 -20px 60px rgba(0,0,0,0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <BookingChat
                                bookingId={id}
                                senderId={staffId}
                                senderType="staff"
                                senderName={job.staff?.full_name || 'พนักงาน'}
                                onClose={() => setShowStaffChat(false)}
                                isOpen={true}
                            />
                        </div>
                    </div>
                </div>
            )}
            
            <style jsx>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
            `}</style>
        </>
    )
}
