'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { SavedLocation, SavedVehicle, VEHICLE_SIZE_LABEL } from '@/lib/types'
import { 
    ChevronLeft, 
    User, 
    Bike, 
    MapPin, 
    Star, 
    Trash2, 
    Plus, 
    X, 
    Gift, 
    CheckCircle,
    Save,
    Utensils,
    Plane,
    Activity,
    Smartphone,
    ShoppingBag,
    Music,
    Gamepad2,
    BookOpen,
    PawPrint,
    Home,
    Coins,
    Palette,
    ChevronUp,
    ChevronDown,
    Wrench,
    Droplets,
    Sparkles,
    LogOut,
    Search
} from 'lucide-react'
import styles from './settings.module.css'
import Logo from '@/components/Branding/Logo'
import { usePushNotifications } from '@/lib/hooks/usePushNotifications'
import { Bell, BellOff, Send } from 'lucide-react'
import ConfirmModal from '@/components/Global/ConfirmModal'

import type MapPickerType from '../book/MapPicker'
const MapPicker = dynamic<React.ComponentProps<typeof MapPickerType>>(
    () => import('../book/MapPicker'),
    { ssr: false }
)

export default function SettingsPage() {
    const { branchSlug } = useParams<{ branchSlug: string }>()
    const router = useRouter()
    const [form, setForm] = useState<any>({})
    const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])
    const [savedVehicles, setSavedVehicles] = useState<SavedVehicle[]>([])
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

    const [loading, setLoading] = useState(true)
    const [showLocModal, setShowLocModal] = useState(false)

    const { 
        subscribe, 
        unsubscribe, 
        sendTest, 
        isSubscribed, 
        loading: pushLoading 
    } = usePushNotifications(form?.id, 'customer')
    const [locForm, setLocForm] = useState<Partial<SavedLocation>>({ lat: 16.4419, lng: 102.8360 })

    // Modal state for adding a new vehicle
    const [showVModal, setShowVModal] = useState(false)
    const [vForm, setVForm] = useState<Partial<SavedVehicle>>({ vehicle_size: 'S' })

    const [recentLocations, setRecentLocations] = useState<any[]>([])
    const [showAllInterests, setShowAllInterests] = useState(false)
    const [occType, setOccType] = useState('') // 'standard' or 'other'

    const STANDARD_OCCUPATIONS = ['พนักงานบริษัท', 'เจ้าของธุรกิจ / ค้าขาย', 'ข้าราชการ / รัฐวิสาหกิจ', 'นักเรียน / นักศึกษา', 'ฟรีแลนซ์', 'พ่อบ้าน / แม่บ้าน', 'เกษียณอายุ']
    const INTERESTS_LIST = [
        { label: 'อาหารและเครื่องดื่ม', icon: Utensils },
        { label: 'การเดินทางและท่องเที่ยว', icon: Plane },
        { label: 'สุขภาพและกีฬา', icon: Activity },
        { label: 'เทคโนโลยีและแกดเจ็ต', icon: Smartphone },
        { label: 'ช้อปปิ้งและแฟชั่น', icon: ShoppingBag },
        { label: 'ดนตรีและบันเทิง', icon: Music },
        { label: 'เกมและอีสปอร์ต', icon: Gamepad2 },
        { label: 'การศึกษาและพัฒนาตนเอง', icon: BookOpen },
        { label: 'สัตว์เลี้ยง', icon: PawPrint },
        { label: 'บ้านและสวน', icon: Home },
        { label: 'การเงินและการลงทุน', icon: Coins },
        { label: 'ศิลปะและงานอดิเรก', icon: Palette },
    ]

    useEffect(() => {
        const c = localStorage.getItem('liff_customer')
        if (!c) { router.replace(`/${branchSlug}`); return }
        const parsed = JSON.parse(c)
        setForm(parsed)
        setSavedLocations(parsed.saved_locations || [])
        setSavedVehicles(parsed.saved_vehicles || [])

        // Fetch fresh data
        supabase.from('customers').select('*').eq('id', parsed.id).single()
            .then(({ data, error }) => {
                if (error) {
                    console.error('Initial fetch error:', error)
                    alert(`ไม่สามารถดึงข้อมูลใหม่ได้ (Error): ${error.message}`)
                } else if (data) {
                    setForm(data)
                    setSavedLocations(data.saved_locations || [])
                    setSavedVehicles(data.saved_vehicles || [])
                    localStorage.setItem('liff_customer', JSON.stringify(data))

                    // Sync occupation type
                    if (data.occupation) {
                        if (STANDARD_OCCUPATIONS.includes(data.occupation)) setOccType(data.occupation)
                        else setOccType('อื่นๆ')
                    }
                } else {
                    alert(`ไม่พบข้อมูลโปรไฟล์ของคุณในระบบ (ID: ${parsed.id?.substring(0,8)}...) กรุณาลองเข้าใหม่ครับ`)
                }
            })

        // Fetch Recent Locations from History
        const loadHistory = async () => {
            const { data } = await supabase
                .from('bookings')
                .select('pickup_address, pickup_lat, pickup_lng, delivery_address, delivery_lat, delivery_lng')
                .eq('customer_id', parsed.id)
                .order('created_at', { ascending: false })
                .limit(20)

            const unique: Record<string, any> = {}
            for (const b of data || []) {
                const detail = b.pickup_address?.split(' (')[0]
                if (detail && !unique[detail]) {
                    // Check if already in savedLocations (compare by detail/name)
                    const isSaved = parsed.saved_locations?.some((sl: any) => sl.detail === detail || sl.name === detail)
                    if (isSaved) continue

                    unique[detail] = {
                        name: `${detail}`, lat: b.pickup_lat, lng: b.pickup_lng,
                        address: b.pickup_address, detail: detail,
                        note: b.pickup_address.includes('(') ? b.pickup_address.split('(')[1].split(')')[0] : '',
                        isHistory: true
                    }
                }
            }
            setRecentLocations(Object.values(unique).slice(0, 5))
        }
        loadHistory()
        setLoading(false)
    }, [router, branchSlug])

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        setSaving(true)
        await syncProfile(true)
    }

    const syncProfile = async (isManualSave = false) => {
        // Standardize fields for DB (Supabase DATE type doesn't like empty string)
        const cleanForm = {
            ...form,
            birthdate: form.birthdate || null,
        }

        // Check for profile completeness using standardized values
        const isComplete = !!(
            cleanForm.full_name && 
            cleanForm.phone && 
            cleanForm.gender && 
            cleanForm.birthdate && 
            cleanForm.occupation && 
            (cleanForm.interests && cleanForm.interests.length > 0)
        )

        const payload = {
            full_name: cleanForm.full_name, 
            phone: cleanForm.phone,
            vehicle_brand: cleanForm.vehicle_brand, 
            vehicle_model: cleanForm.vehicle_model,
            vehicle_color: cleanForm.vehicle_color, 
            license_plate: cleanForm.license_plate,
            vehicle_size: cleanForm.vehicle_size,
            saved_locations: savedLocations,
            saved_vehicles: savedVehicles,
            gender: cleanForm.gender,
            birthdate: cleanForm.birthdate,
            occupation: cleanForm.occupation,
            interests: cleanForm.interests || [],
            is_profile_complete: isComplete
        }

        const { data, error } = await supabase.from('customers')
            .update(payload)
            .eq('id', cleanForm.id)
            .select()
            .single()
        
        if (error) {
            console.error('Error saving profile:', error)
            if (isManualSave) alert(`บันทึกไม่สำเร็จ (Error): ${error.message}`);
            setSaving(false)
            return
        }

        if (data) {
            localStorage.setItem('liff_customer', JSON.stringify(data))
            setForm(data)
            setSavedLocations(data.saved_locations || [])
            setSavedVehicles(data.saved_vehicles || [])
            
            if (isManualSave) {
                if (isComplete && !form.is_profile_complete) {
                    setShowSuccessModal(true)
                } else {
                    setSaved(true)
                    setTimeout(() => setSaved(false), 3000)
                }
            }
        } else {
            if (isManualSave) alert(`หาข้อมูลไม่พบในระบบ (ID: ${cleanForm.id?.substring(0,8)}) ไม่สามารถบันทึกได้ครับ`);
        }
        setSaving(false)
    }

    const handleAddLocation = async () => {
        const id = Math.random().toString(36).substring(2, 9)
        const newLoc = { ...locForm, id } as SavedLocation
        const updated = [...savedLocations, newLoc]
        
        // Update local state first for syncProfile to pick up
        setSavedLocations(updated)
        setShowLocModal(false)
        setLocForm({ lat: 16.4419, lng: 102.8360 })

        // Trigger sync with explicit payload (DO NOT SPREAD FORM)
        setSaving(true)
        const birthdays = form.birthdate || null
        const isComplete = !!(form.full_name && form.phone && form.gender && birthdays && form.occupation && (form.interests && form.interests.length > 0))
        const payload = {
            full_name: form.full_name,
            phone: form.phone,
            gender: form.gender,
            birthdate: birthdays,
            occupation: form.occupation,
            interests: form.interests || [],
            saved_locations: updated,
            saved_vehicles: savedVehicles,
            is_profile_complete: isComplete
        }
        const { data, error } = await supabase.from('customers').update(payload).eq('id', form.id).select().single()

        if (error) {
            alert('ไม่สามารถบันทึกสถานที่ได้: ' + error.message)
        } else if (data) {
            localStorage.setItem('liff_customer', JSON.stringify(data))
            setForm(data)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } else {
            alert('ไม่พบข้อมูลลูกค้าเพื่ออัปเดต (ID mismatch)')
        }
        setSaving(false)
    }

    const handleRemoveLocation = async (id: string) => {
        const updated = savedLocations.filter(loc => loc.id !== id)
        setSavedLocations(updated)

        setSaving(true)
        const birthdays = form.birthdate || null
        const isComplete = !!(form.full_name && form.phone && form.gender && birthdays && form.occupation && (form.interests && form.interests.length > 0))
        const payload = {
            full_name: form.full_name,
            phone: form.phone,
            gender: form.gender,
            birthdate: birthdays,
            occupation: form.occupation,
            interests: form.interests || [],
            saved_locations: updated,
            saved_vehicles: savedVehicles,
            is_profile_complete: isComplete
        }
        const { data, error } = await supabase.from('customers').update(payload).eq('id', form.id).select().single()

        if (error) {
            alert('ไม่สามารถลบสถานที่ได้: ' + error.message)
        } else if (data) {
            localStorage.setItem('liff_customer', JSON.stringify(data))
            setForm(data)
        } else {
            alert('ไม่พบข้อมูลลูกค้าเพื่ออัปเดต (ID mismatch)')
        }
        setSaving(false)
    }

    const handleAddVehicle = async () => {
        const id = Math.random().toString(36).substring(2, 9)
        const newV = { ...vForm, id } as SavedVehicle
        const updated = [...savedVehicles, newV]
        
        setSavedVehicles(updated)
        setShowVModal(false)
        setVForm({ vehicle_size: 'M' })

        setSaving(true)
        const birthdays = form.birthdate || null
        const isComplete = !!(form.full_name && form.phone && form.gender && birthdays && form.occupation && (form.interests && form.interests.length > 0))
        const payload = {
            full_name: form.full_name,
            phone: form.phone,
            gender: form.gender,
            birthdate: birthdays,
            occupation: form.occupation,
            interests: form.interests || [],
            saved_locations: savedLocations,
            saved_vehicles: updated,
            is_profile_complete: isComplete,
            ...(updated.length === 1 && {
                vehicle_brand: newV.vehicle_brand,
                vehicle_model: newV.vehicle_model,
                vehicle_color: newV.vehicle_color,
                license_plate: newV.license_plate,
                vehicle_size: newV.vehicle_size
            })
        }
        const { data, error } = await supabase.from('customers').update(payload).eq('id', form.id).select().single()

        if (error) {
            alert('ไม่สามารถบันทึกรถได้: ' + error.message)
        } else if (data) {
            localStorage.setItem('liff_customer', JSON.stringify(data))
            setForm(data)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } else {
            alert('ไม่พบข้อมูลลูกค้าเพื่ออัปเดต (ID mismatch)')
        }
        setSaving(false)
    }

    const handleRemoveVehicle = async (id: string) => {
        const updated = savedVehicles.filter(v => v.id !== id)
        setSavedVehicles(updated)

        setSaving(true)
        const birthdays = form.birthdate || null
        const isComplete = !!(form.full_name && form.phone && form.gender && birthdays && form.occupation && (form.interests && form.interests.length > 0))
        const payload = {
            ...form,
            birthdate: birthdays,
            saved_vehicles: updated,
            is_profile_complete: isComplete
        }
        const { data, error } = await supabase.from('customers').update(payload).eq('id', form.id).select().single()

        if (error) {
            alert('ไม่สามารถลบรถได้: ' + error.message)
        } else if (data) {
            localStorage.setItem('liff_customer', JSON.stringify(data))
            setForm(data)
        }
        setSaving(false)
    }

    const handleSetPrimaryVehicle = async (vehicle: SavedVehicle) => {
        setSaving(true)
        const birthdays = form.birthdate || null
        const isComplete = !!(form.full_name && form.phone && form.gender && birthdays && form.occupation && (form.interests && form.interests.length > 0))
        
        const payload = {
            ...form,
            birthdate: birthdays,
            vehicle_brand: vehicle.vehicle_brand,
            vehicle_model: vehicle.vehicle_model,
            vehicle_color: vehicle.vehicle_color,
            license_plate: vehicle.license_plate,
            vehicle_size: vehicle.vehicle_size,
            is_profile_complete: isComplete
        }
        const { data, error } = await supabase.from('customers').update(payload).eq('id', form.id).select().single()

        if (error) {
            alert('ไม่สามารถตั้งค่ารถหลักได้: ' + error.message)
        } else if (data) {
            localStorage.setItem('liff_customer', JSON.stringify(data))
            setForm(data)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        }
        setSaving(false)
    }

    const field = (label: string, key: string, type = 'text') => (
        <div className="form-group">
            <label className="form-label">{label}</label>
            <input type={type} className="form-input" value={form[key] || ''} onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))} />
        </div>
    )

    return (
        <div className={styles.page}>
            <div className={styles.topbar}>
                <Link href={`/${branchSlug}/menu`} className="btn btn-ghost btn-sm btn-icon"><ChevronLeft size={24} /></Link>
                <Logo width={110} variant="landscape" />
                <div style={{ width: 44 }} />
            </div>

            <form onSubmit={handleSave} className={styles.form}>
                {/* Section: Profile */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <User size={18} /> ข้อมูลส่วนตัว
                        </div>
                    </div>
                    {field('ชื่อ-นามสกุล', 'full_name')}
                    {field('เบอร์โทรศัพท์', 'phone', 'tel')}

                    <div className="form-group">
                        <label className="form-label">เพศ</label>
                        <select className="form-input" value={form.gender || ''} onChange={e => setForm((p: any) => ({ ...p, gender: e.target.value }))}>
                            <option value="">เลือกเพศ</option>
                            <option value="male">ชาย</option>
                            <option value="female">หญิง</option>
                            <option value="other">อื่นๆ / ไม่ระบุ</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">วันเกิด</label>
                        <input type="date" className="form-input" value={form.birthdate || ''} onChange={e => setForm((p: any) => ({ ...p, birthdate: e.target.value }))} />
                    </div>
                    
                    <div className="form-group">
                        <label className="form-label">อาชีพ</label>
                        <select 
                            className="form-input" 
                            value={occType} 
                            onChange={e => {
                                const val = e.target.value
                                setOccType(val)
                                if (val !== 'อื่นๆ') {
                                    setForm((p: any) => ({ ...p, occupation: val }))
                                } else if (occType !== 'อื่นๆ') {
                                    setForm((p: any) => ({ ...p, occupation: '' }))
                                }
                            }}
                        >
                            <option value="">เลือกอาชีพ</option>
                            {STANDARD_OCCUPATIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            <option value="อื่นๆ">อื่นๆ (ระบุเอง)</option>
                        </select>
                    </div>

                    {occType === 'อื่นๆ' && (
                        <div className="form-group animate-fade-in">
                            <label className="form-label">ระบุอาชีพของคุณ</label>
                            <input 
                                className="form-input" 
                                value={form.occupation || ''} 
                                onChange={e => setForm((p: any) => ({ ...p, occupation: e.target.value }))} 
                                placeholder="เช่น กราฟิกดีไซน์เนอร์"
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">สิ่งที่คุณสนใจ (เลือกได้หลายอย่าง)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {(showAllInterests ? INTERESTS_LIST : INTERESTS_LIST.slice(0, 6)).map(item => {
                                const Icon = item.icon
                                const isActive = (form.interests || []).includes(item.label)
                                return (
                                    <label key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', padding: '6px 10px', background: isActive ? 'var(--accent-pink-ghost)' : 'var(--surface-2)', borderRadius: '12px', transition: 'all 0.2s ease', border: isActive ? '1px solid var(--accent-pink)' : '1px solid transparent' }}>
                                        <input 
                                            type="checkbox" 
                                            style={{ display: 'none' }}
                                            checked={isActive} 
                                            onChange={e => {
                                                const current = form.interests || []
                                                const updated = e.target.checked 
                                                    ? [...current, item.label]
                                                    : current.filter((i: string) => i !== item.label)
                                                setForm((p: any) => ({ ...p, interests: updated }))
                                            }}
                                        />
                                        <Icon size={14} color={isActive ? 'var(--accent-pink-dark)' : 'var(--text-muted)'} />
                                        <span style={{ fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--accent-pink-dark)' : 'var(--text-primary)' }}>{item.label}</span>
                                    </label>
                                )
                            })}
                        </div>
                        {INTERESTS_LIST.length > 6 && (
                            <button 
                                type="button" 
                                className="btn btn-ghost btn-sm" 
                                style={{ marginTop: 8, color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', width: '100%', textAlign: 'center' }}
                                onClick={() => setShowAllInterests(!showAllInterests)}
                            >
                                {showAllInterests ? (
                                    <>แสดงน้อยลง <ChevronUp size={16} /></>
                                ) : (
                                    <>แสดงเพิ่มเติม <ChevronDown size={16} /></>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Section: Vehicle */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Bike size={18} /> ยานพาหนะของคุณ
                        </div>
                    </div>
                    
                    {savedVehicles.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {savedVehicles.map((v: any) => {
                                const isPrimary = form.vehicle_brand === v.vehicle_brand && 
                                                  form.vehicle_model === v.vehicle_model && 
                                                  form.license_plate === v.license_plate;
                                return (
                                    <div key={v.id} className={styles.itemCard} style={{ border: isPrimary ? '1.5px solid var(--primary)' : '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div className={styles.iconBox} style={{ background: isPrimary ? 'var(--primary)' : 'var(--surface-2)', color: isPrimary ? 'white' : 'var(--text-muted)' }}>
                                                <Bike size={16} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{v.vehicle_brand} {v.vehicle_model}</div>
                                                    {isPrimary && <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'white', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>คันหลัก</span>}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.license_plate} · {v.vehicle_color} · {VEHICLE_SIZE_LABEL[v.vehicle_size] || v.vehicle_size}</div>
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {!isPrimary && (
                                                <button 
                                                    type="button" 
                                                    className="btn btn-ghost btn-sm" 
                                                    onClick={() => handleSetPrimaryVehicle(v)}
                                                    style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700 }}
                                                >
                                                    ตั้งเป็นคันหลัก
                                                </button>
                                            )}
                                            <button 
                                                type="button" 
                                                className="btn btn-ghost btn-sm btn-icon" 
                                                style={{ color: 'var(--danger)' }} 
                                                onClick={() => handleRemoveVehicle(v.id)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>ยังไม่มีข้อมูลยานพาหนะ</p>
                    )}

                    <button type="button" className="btn btn-outline btn-full" onClick={() => setShowVModal(true)} style={{ gap: 8, marginTop: savedVehicles.length > 0 ? 8 : 0 }}>
                        <Plus size={18} /> เพิ่มยานพาหนะใหม่
                    </button>
                </div>

                {/* Section: Locations */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <MapPin size={18} /> สถานที่ที่บันทึกไว้
                        </div>
                    </div>
                    {savedLocations.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {savedLocations.map((loc: any) => (
                                <div key={loc.id} className={styles.itemCard}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div className={styles.iconBox}><Star size={16} fill="currentColor" /></div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{loc.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.address}</div>
                                        </div>
                                    </div>
                                    <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleRemoveLocation(loc.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>ยังไม่มีสถานที่ที่บันทึกไว้</p>
                    )}
                    
                    {/* Priority 2: Automatically from History */}
                    {recentLocations.length > 0 && (
                        <div style={{ marginTop: 'var(--space-2)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>สถานที่ที่เคยใช้ล่าสุด</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {recentLocations.map((loc, idx) => (
                                    <div key={`recent-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59, 95, 204, 0.03)', padding: 'var(--space-3)', border: '1px dashed var(--border)', borderRadius: '20px' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{loc.name}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.address}</div>
                                        </div>
                                        <button 
                                            type="button" 
                                            className="btn btn-ghost btn-sm" 
                                            onClick={() => {
                                                setLocForm({ ...loc, name: loc.name.replace(/^🏠\s*/, '').replace(/^🏁\s*/, '') });
                                                setShowLocModal(true);
                                            }}
                                            style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700 }}
                                        >
                                            บันทึก
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button type="button" className="btn btn-outline btn-full" onClick={() => setShowLocModal(true)} style={{ gap: 8 }}>
                        <Plus size={18} /> เพิ่มสถานที่ใหม่
                    </button>
                </div>

                {/* Section: Notifications */}
                <div className={styles.card}>
                    <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Bell size={20} /> การแจ้งเตือน (Push Notifications)
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                        รับแจ้งเตือนเมื่อพนักงานรับงาน, เริ่มล้าง และล้างรถเสร็จแล้ว
                    </p>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '16px',
                        background: 'var(--surface-2)',
                        borderRadius: '16px',
                        border: '1px solid var(--border)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ 
                                width: 40, 
                                height: 40, 
                                borderRadius: '12px',
                                background: isSubscribed ? 'var(--accent-green-ghost)' : 'var(--surface-3)',
                                color: isSubscribed ? 'var(--accent-green-dark)' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {isSubscribed ? <Bell size={20} /> : <BellOff size={20} />}
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                    {isSubscribed ? 'เปิดการแจ้งเตือนแล้ว' : 'ปิดการแจ้งเตือนอยู่'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {isSubscribed ? 'ระบบจะแจ้งสถานะงานให้ทราบ' : 'กดเปิดเพื่อไม่พลาดสถานะงาน'}
                                </div>
                            </div>
                        </div>
                        <button 
                            type="button"
                            className={`btn ${isSubscribed ? 'btn-ghost' : 'btn-primary'}`}
                            style={{ 
                                height: 40, 
                                padding: '0 16px', 
                                fontSize: '0.85rem',
                                borderRadius: '12px',
                                border: isSubscribed ? '1px solid var(--border)' : 'none'
                            }}
                            onClick={() => isSubscribed ? unsubscribe() : subscribe()}
                            disabled={pushLoading}
                        >
                            {pushLoading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 
                             (isSubscribed ? 'ปิดใช้งาน' : 'เปิดใช้งาน')}
                        </button>
                    </div>

                </div>

                {saved && <div className="alert alert-success" style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', gap: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={18} /> บันทึกเรียบร้อยแล้ว
                </div>}

                <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={saving} style={{ marginTop: 'var(--space-2)', gap: 8, borderRadius: 'var(--radius-xl)' }}>
                    {saving ? <div className="spinner" style={{ width: 22, height: 22, borderTopColor: '#fff' }} /> : <><Save size={18} /> บันทึกข้อมูล</>}
                </button>

                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: 12, 
                    marginTop: 32,
                    padding: '0 16px'
                }}>
                    <button 
                        type="button" 
                        className="btn btn-ghost btn-full" 
                        onClick={() => setShowLogoutConfirm(true)}
                        style={{ 
                            gap: 10, 
                            borderRadius: 'var(--radius-xl)', 
                            color: 'var(--danger)', 
                            fontSize: '0.95rem',
                            height: '56px',
                            fontWeight: 700,
                            background: 'rgba(239, 68, 68, 0.05)',
                            border: '2.5px solid rgba(239, 68, 68, 0.1)'
                        }}
                    >
                        <LogOut size={20} /> ออกจากระบบ
                    </button>
                </div>
            </form>

            {/* Modal for adding a new location */}
            {showLocModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                            <h2 style={{ fontWeight: 800, fontSize: '1.2rem' }}>เพิ่มสถานที่</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowLocModal(false)}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div className="form-group">
                                <label className="form-label">ชื่อเรียกสถานที่ (เช่น บ้าน, ที่ทำงาน) <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input className="form-input" value={locForm.name || ''} onChange={e => setLocForm(p => ({ ...p, name: e.target.value }))} placeholder="เช่น บ้าน, บิ๊กซี" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">ชื่อหอพัก / หมู่บ้าน / ที่อยู่ <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input className="form-input" value={locForm.detail || ''} onChange={e => setLocForm(p => ({ ...p, detail: e.target.value }))} placeholder="เช่น หอพัก ABC, บ้านเลขที่ 123" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">รายละเอียดเพิ่มเติม</label>
                                <input className="form-input" value={locForm.note || ''} onChange={e => setLocForm(p => ({ ...p, note: e.target.value }))} placeholder="เช่น จอดหน้าตึก B, รอที่ป้อมยาม" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">แผนที่สำหรับปักหมุด <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <MapPicker
                                    lat={locForm.lat!} lng={locForm.lng!} mode="pickup"
                                    onChange={(lat, lng, addr) => setLocForm(p => ({ ...p, lat, lng, address: addr }))}
                                />
                            </div>
                            <button className="btn btn-primary btn-full" onClick={handleAddLocation} disabled={!locForm.name || !locForm.detail || !locForm.address} style={{ borderRadius: 'var(--radius-xl)' }}>
                                บันทึกสถานที่
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for adding a new vehicle */}
            {showVModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                            <h2 style={{ fontWeight: 800, fontSize: '1.2rem' }}>เพิ่มข้อมูลรถ</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowVModal(false)}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div className="form-group">
                                <label className="form-label">ยี่ห้อรถ <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input className="form-input" value={vForm.vehicle_brand || ''} onChange={e => setVForm(p => ({ ...p, vehicle_brand: e.target.value }))} placeholder="เช่น Honda" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">รุ่นรถ <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input className="form-input" value={vForm.vehicle_model || ''} onChange={e => setVForm(p => ({ ...p, vehicle_model: e.target.value }))} placeholder="เช่น PCX 160" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">สีรถ <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input className="form-input" value={vForm.vehicle_color || ''} onChange={e => setVForm(p => ({ ...p, vehicle_color: e.target.value }))} placeholder="เช่น ขาว" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">เลขทะเบียน <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input className="form-input" value={vForm.license_plate || ''} onChange={e => setVForm(p => ({ ...p, license_plate: e.target.value }))} placeholder="เช่น 1กข 1234" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">ไซส์รถ <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                    {[
                                        { value: 'S', label: 'ไม่เกิน 125 cc' },
                                        { value: 'M', label: '126-249 cc' },
                                        { value: 'L', label: '250 cc ขึ้นไป' },
                                    ].map(s => (
                                        <label key={s.value} style={{
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                                            padding: 'var(--space-4) var(--space-2)', borderRadius: 'var(--radius-xl)',
                                            border: `1.5px solid ${vForm.vehicle_size === s.value ? 'var(--primary)' : 'var(--border)'}`,
                                            background: vForm.vehicle_size === s.value ? 'var(--primary-ghost)' : 'white',
                                            cursor: 'pointer', transition: 'all 0.2s', marginTop: 4, textAlign: 'center'
                                        }}>
                                            <input type="radio" value={s.value} checked={vForm.vehicle_size === s.value} onChange={e => setVForm(p => ({ ...p, vehicle_size: e.target.value }))} style={{ display: 'none' }} />
                                            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--primary)', width: '100%' }}>{s.value}</span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <button
                                className="btn btn-primary btn-full"
                                onClick={handleAddVehicle}
                                disabled={!vForm.vehicle_brand || !vForm.vehicle_model || !vForm.vehicle_color || !vForm.license_plate}
                                style={{ borderRadius: 'var(--radius-xl)' }}
                            >
                                บันทึกข้อมูลรถ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'center' }}><Gift size={64} color="var(--primary)" /></div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>ข้อมูลครบถ้วน! มารับรางวัลกัน</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                            ขอบคุณที่ร่วมแชร์ข้อมูลกับ Foami <br/>
                            นี่คือโค้ดส่วนลดพิเศษสำหรับคุณ:
                        </p>
                        
                        <div style={{ background: 'var(--primary-ghost)', padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)', border: '2px dashed var(--primary)', marginBottom: 'var(--space-6)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Discount Code</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: 2 }}>FOAMI100</div>
                        </div>

                        <button 
                            className="btn btn-primary btn-full btn-lg"
                            onClick={() => router.replace(`/${branchSlug}/menu`)}
                            style={{ borderRadius: 'var(--radius-full)' }}
                        >
                            กลับไปหน้าหลัก
                        </button>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={showLogoutConfirm}
                onClose={() => setShowLogoutConfirm(false)}
                onConfirm={async () => {
                    localStorage.removeItem('liff_customer');
                    localStorage.removeItem('liff_line_user_id');
                    localStorage.removeItem('liff_display_name');
                    
                    try {
                        const { default: liff } = await import('@line/liff');
                        if (typeof liff !== 'undefined' && liff.logout) {
                            liff.logout();
                        }
                    } catch (e) {
                        console.error('Logout error:', e);
                    }

                    router.replace('/login');
                }}
                title="ยืนยันการออกจากระบบ"
                message="คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ? ข้อมูลที่ยังไม่ได้บันทึกอาจจะสูญหาย"
                variant="danger"
                confirmText="ออกจากระบบ"
                cancelText="ยกเลิก"
            />
        </div>
    )
}
