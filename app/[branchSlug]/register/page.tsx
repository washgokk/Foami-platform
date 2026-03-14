'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { generateScalableId } from '@/lib/id-utils'
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
import styles from './register.module.css'

const VEHICLE_SIZES = [
    { value: 'S', label: 'S — ไม่เกิน 125 cc' },
    { value: 'M', label: 'M — 126-249 cc' },
    { value: 'L', label: 'L — 250 cc ขึ้นไป' },
]

export default function RegisterPage() {
    const { branchSlug } = useParams<{ branchSlug: string }>()
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [form, setForm] = useState({
        full_name: '', phone: '',
        vehicle_brand: '', vehicle_model: '', vehicle_color: '',
        license_plate: '', vehicle_size: 'M',
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        // Pre-fill name from Line profile if available
        const displayName = localStorage.getItem('liff_display_name')
        if (displayName) setForm(p => ({ ...p, full_name: displayName }))
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (step === 1) { setStep(2); return }

        setSaving(true)
        setError('')
        const lineUserId = localStorage.getItem('liff_line_user_id') || 'mock_user'
        const customId = generateScalableId('CU')

        const initialVehicle = {
            id: generateScalableId('VH'),
            vehicle_brand: form.vehicle_brand,
            vehicle_model: form.vehicle_model,
            vehicle_color: form.vehicle_color,
            license_plate: form.license_plate,
            vehicle_size: form.vehicle_size
        }

        const { data, error: err } = await supabase.from('customers').insert({
            id: customId,
            line_user_id: lineUserId,
            ...form,
            saved_vehicles: [initialVehicle]
        }).select().single()

        if (err) {
            setError(err.message)
            setSaving(false)
            return
        }

        localStorage.setItem('liff_customer', JSON.stringify(data))
        router.replace(`/${branchSlug}/menu`)
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.logo}>
                    <img src="/logo - lanscape.svg" alt="Foami" />
                </div>
                <h1 className={styles.title}>สมัครใช้บริการ Foami</h1>
                <p className={styles.sub}>กรอกข้อมูลครั้งเดียว ใช้ได้ตลอด</p>
            </div>

            <div className={styles.stepDots}>
                <div className={`${styles.dot} ${step >= 1 ? styles.active : ''}`} />
                <div className={styles.line} />
                <div className={`${styles.dot} ${step >= 2 ? styles.active : ''}`} />
            </div>
            <p className={styles.stepLabel}>{step === 1 ? '1. ข้อมูลส่วนตัว' : '2. ข้อมูลรถ'}</p>

            <form onSubmit={handleSubmit} className={styles.form}>
                {step === 1 ? (
                    <>
                        <div className="form-group">
                            <label className="form-label">ชื่อ-นามสกุล</label>
                            <input className="form-input" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="สมชาย ใจดี" required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">เบอร์โทรศัพท์</label>
                            <input type="tel" className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="08X-XXX-XXXX" required />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="form-group">
                            <label className="form-label">ยี่ห้อรถ</label>
                            <input className="form-input" value={form.vehicle_brand} onChange={e => setForm(p => ({ ...p, vehicle_brand: e.target.value }))} placeholder="Honda / Yamaha / Kawasaki" required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">รุ่นรถ</label>
                            <input className="form-input" value={form.vehicle_model} onChange={e => setForm(p => ({ ...p, vehicle_model: e.target.value }))} placeholder="Click 125i / Aerox 155" required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">สีรถ</label>
                            <input className="form-input" value={form.vehicle_color} onChange={e => setForm(p => ({ ...p, vehicle_color: e.target.value }))} placeholder="ขาว / ดำ / แดง" required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">เลขทะเบียน</label>
                            <input className="form-input" value={form.license_plate} onChange={e => setForm(p => ({ ...p, license_plate: e.target.value }))} placeholder="กก 1234 ขอนแก่น" required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">ไซส์รถ <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                {VEHICLE_SIZES.map(s => (
                                    <label key={s.value} className={`${styles.sizeOption} ${form.vehicle_size === s.value ? styles.sizeSelected : ''}`}>
                                        <input type="radio" value={s.value} checked={form.vehicle_size === s.value} onChange={e => setForm(p => ({ ...p, vehicle_size: e.target.value }))} style={{ display: 'none' }} />
                                        <span className={styles.sizeLabel}>{s.label.split(' — ')[1]}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {error && <div className="alert alert-error">{error}</div>}

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    {step === 2 && (
                        <button type="button" className="btn btn-ghost btn-full" onClick={() => setStep(1)} style={{ gap: 8 }}>
                            <ChevronLeft size={18} /> กลับ
                        </button>
                    )}
                    <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={saving} style={{ gap: 8 }}>
                        {saving ? (
                            <span className="spinner" />
                        ) : step === 1 ? (
                            <>ถัดไป <ChevronRight size={18} /></>
                        ) : (
                            <><CheckCircle size={18} /> สมัครเสร็จสิ้น</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}
