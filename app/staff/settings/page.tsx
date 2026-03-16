'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Staff, Payout, THAI_BANKS } from '@/lib/types'
import styles from './settings.module.css'
import { User, Lock, Building2, Wallet, Phone, Mail, History, ExternalLink, X, ChevronRight, CheckCircle2, AlertCircle, Info, HelpCircle, MapPin, ShieldCheck, UserCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { Booking } from '@/lib/types'
import ImageZoom from '@/components/Global/ImageZoom'
import { usePushNotifications } from '@/lib/hooks/usePushNotifications'
import { Bell, BellOff, Send } from 'lucide-react'

export default function StaffSettingsPage() {
    const [staff, setStaff] = useState<Staff | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })
    const [payouts, setPayouts] = useState<Payout[]>([])
    const [showHistoryDetail, setShowHistoryDetail] = useState<Payout | null>(null)
    const [historyDetailBookings, setHistoryDetailBookings] = useState<Booking[]>([])
    const [loadingHistoryDetail, setLoadingHistoryDetail] = useState(false)
    const [zoomConfig, setZoomConfig] = useState<{ images: { src: string; alt?: string }[]; initialIndex: number } | null>(null)

    const { 
        subscribe, 
        unsubscribe, 
        sendTest, 
        isSubscribed, 
        loading: pushLoading 
    } = usePushNotifications(staff?.id, 'staff')

    const [form, setForm] = useState({
        full_name: '',
        phone: '',
        email: '',
        password: '',
        bank_name: '',
        bank_account_number: '',
        promptpay_number: '',
        image_url: ''
    })


    useEffect(() => {
        const loadStaff = async () => {
            const staffData = JSON.parse(localStorage.getItem('staff_data') || '{}')
            if (!staffData.id) return
            
            const { data, error } = await supabase
                .from('staff')
                .select('*')
                .eq('id', staffData.id)
                .single()
            
            if (data) {
                // Manual join for Branch Name (Compatibility with Mock DB)
                const { data: branchData } = await supabase
                    .from('branches')
                    .select('name')
                    .eq('id', data.branch_id)
                    .single()
                
                if (branchData) {
                    data.branches = branchData
                }

                setStaff(data)
                setForm({
                    full_name: data.full_name || '',
                    phone: data.phone || '',
                    email: data.email || '',
                    password: '', // Don't show password
                    bank_name: data.bank_name || '',
                    bank_account_number: data.bank_account_number || '',
                    promptpay_number: data.promptpay_number || '',
                    image_url: data.image_url || ''
                })

                // Load Payout History
                const { data: pData } = await supabase
                    .from('staff_payouts')
                    .select('*')
                    .eq('staff_id', staffData.id)
                    .order('created_at', { ascending: false })
                
                setPayouts(pData || [])
            }
            setLoading(false)
        }
        loadStaff()
    }, [])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!staff) return
        setSaving(true)
        setMessage({ type: '', text: '' })

        try {
            if (localStorage.getItem('foami_mock_db_enabled') === 'true') {
                const { error: staffErr } = await supabase
                    .from('staff')
                    .update({
                        full_name: form.full_name,
                        phone: form.phone,
                        email: form.email,
                        bank_name: form.bank_name,
                        bank_account_number: form.bank_account_number,
                        promptpay_number: form.promptpay_number,
                        image_url: form.image_url,
                        password: form.password || staff.password // Keep old pass if not changed
                    })
                    .eq('id', staff.id)
                
                if (staffErr) throw staffErr
            } else {
                const res = await fetch('/api/auth/update-staff', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: staff.id,
                        full_name: form.full_name,
                        phone: form.phone,
                        email: form.email,
                        password: form.password || undefined,
                        branch_id: staff.branch_id,
                        role: staff.role,
                        bank_name: form.bank_name,
                        bank_account_number: form.bank_account_number,
                        promptpay_number: form.promptpay_number,
                        image_url: form.image_url
                    })
                })

                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Failed to update')
            }

            setMessage({ type: 'success', text: 'บันทึกข้อมูลเรียบร้อยแล้ว' })
            setForm(p => ({ ...p, password: '' }))
            
            // Refresh local staff data
            const updatedStaff = { ...staff, ...form, password: form.password || staff.password }
            setStaff(updatedStaff)
            localStorage.setItem('staff_data', JSON.stringify(updatedStaff))
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message })
        } finally {
            setSaving(false)
        }
    }
    const openHistoryDetail = async (payout: Payout) => {
        setShowHistoryDetail(payout)
        setLoadingHistoryDetail(true)
        const { data } = await supabase
            .from('bookings')
            .select('*, services(name)')
            .eq('payout_id', payout.id)
        setHistoryDetailBookings(data || [])
        setLoadingHistoryDetail(false)
    }

    if (loading) return (
        <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <div className="animate-fade" style={{ color: 'var(--text-muted)' }}>กำลังโหลด...</div>
        </div>
    )

    return (
        <div className={`${styles.container} animate-fade`}>
            {/* Premium Profile Header */}
            <div className={styles.profileHeader}>
                <div 
                    className={styles.avatarWrapper} 
                    style={{ cursor: staff?.image_url ? 'zoom-in' : 'default' }}
                    onClick={() => staff?.image_url && setZoomConfig({ images: [{ src: staff.image_url, alt: `โปรไฟล์: ${staff.full_name}` }], initialIndex: 0 })}
                >
                    {staff?.image_url ? (
                        <img src={staff.image_url} alt={staff.full_name} className={styles.avatarImage} />
                    ) : (
                        <UserCircle2 size={48} />
                    )}
                </div>
                <div className={styles.headerInfo}>
                    <h2>{staff?.full_name}</h2>
                    <p><MapPin size={14} /> {staff?.branches?.name || 'ไม่ระบุสาขา'}</p>
                    <p><Phone size={14} /> {staff?.phone || 'ไม่ระบุเบอร์โทร'}</p>
                </div>
                <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'var(--brand-dominant-ghost)', borderRadius: '50%', zIndex: -1 }}></div>
            </div>

            {message.text && (
                <div className={`${styles.alert} ${message.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSave} className={styles.formGrid}>
                {/* Account & Security Section */}
                <div className={styles.card}>
                    <h2 className={styles.sectionTitle}><User size={20} /> บัญชีและความปลอดภัย</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                             <label className="form-label" style={{ color: 'var(--text-muted)' }}>ชื่อ (แก้ไขโดยแอดมินเท่านั้น)</label>
                            <input 
                                className="form-input" 
                                style={{ borderRadius: 12, background: 'var(--surface-2)', opacity: 0.8 }}
                                value={form.full_name} 
                                readOnly 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">เบอร์โทรศัพท์</label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={16} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--text-muted)' }} />
                                <input 
                                    className="form-input" 
                                    style={{ paddingLeft: 42, borderRadius: 12 }}
                                    value={form.phone} 
                                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                    required 
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">อีเมลเข้าสู่ระบบ</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={16} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--text-muted)' }} />
                                <input 
                                    type="email"
                                    className="form-input" 
                                    style={{ paddingLeft: 42, borderRadius: 12 }}
                                    value={form.email} 
                                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                    required 
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">เปลี่ยนรหัสผ่าน (เว้นว่างไว้หากไม่เปลี่ยน)</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={16} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--text-muted)' }} />
                                <input 
                                    type="password"
                                    className="form-input" 
                                    style={{ paddingLeft: 42, borderRadius: 12 }}
                                    placeholder="รหัสผ่านใหม่"
                                    value={form.password} 
                                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bank Section */}
                <div className={styles.card}>
                    <h2 className={styles.sectionTitle}><Wallet size={20} /> ช่องทางการรับเงิน</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Info size={14} /> ข้อมูลนี้จะใช้เพื่อเตรียมโอนเบี้ยเลี้ยงรายทริปให้พนักงาน
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">ธนาคาร</label>
                            <div style={{ position: 'relative' }}>
                                <Building2 size={16} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--text-muted)' }} />
                                <select 
                                    className="form-input" 
                                    style={{ paddingLeft: 42, borderRadius: 12 }}
                                    value={form.bank_name} 
                                    onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))}
                                >
                                    <option value="">-- เลือกธนาคาร --</option>
                                    {THAI_BANKS.map(bank => (
                                        <option key={bank.code} value={bank.name}>{bank.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">เลขบัญชีธนาคาร</label>
                            <input 
                                className="form-input" 
                                style={{ borderRadius: 12 }}
                                placeholder="000-0-00000-0"
                                value={form.bank_account_number} 
                                onChange={e => setForm(p => ({ ...p, bank_account_number: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">เลขพร้อมเพย์ (ถ้ามี)</label>
                            <input 
                                className="form-input" 
                                style={{ borderRadius: 12 }}
                                placeholder="เบอร์โทรศัพท์ หรือ เลขบัตรประชาชน"
                                value={form.promptpay_number} 
                                onChange={e => setForm(p => ({ ...p, promptpay_number: e.target.value }))}
                            />
                        </div>
                    </div>
                 </div>

                {/* Notification Section */}
                <div className={styles.card}>
                    <h2 className={styles.sectionTitle}><Bell size={20} /> การแจ้งเตือน (Push Notifications)</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                        รับแจ้งเตือนงานใหม่, งานยกเลิก และยอดวันโอนเงินผ่านมือถือโดยตรง
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
                                    {isSubscribed ? 'คุณจะได้รับข้อความแจ้งเตือนทันที' : 'คลิกเพื่อรับการแจ้งเตือน'}
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

                <button type="submit" className={`btn btn-primary ${styles.saveBtn}`} disabled={saving}>
                    {saving ? <span className="spinner" /> : <><CheckCircle2 size={18} style={{ marginRight: 8 }} /> บันทึกการเปลี่ยนแปลง</>}
                </button>
            </form>

            {/* Payout History Section */}
            <div className={styles.card} style={{ marginTop: 'var(--space-6)' }}>
                <h2 className={styles.sectionTitle}><History size={20} /> ประวัติการรับเบี้ยเลี้ยง</h2>
                <div className={styles.payoutList}>
                    {payouts.length === 0 ? (
                        <div className="empty-state" style={{ padding: 40 }}>
                            <Wallet size={48} style={{ opacity: 0.1, marginBottom: 16 }} />
                            <p style={{ color: 'var(--text-muted)' }}>ยังไม่มีประวัติการรับเงิน</p>
                        </div>
                    ) : payouts.map(p => (
                        <div key={p.id} className={styles.payoutItem} onClick={() => openHistoryDetail(p)}>
                            <div className={styles.payoutMain}>
                                <div className={styles.payoutDate}>{format(new Date(p.created_at), 'dd MMM yyyy')}</div>
                                <div className={styles.payoutPeriod}>
                                    <HelpCircle size={12} /> {format(new Date(p.start_date), 'dd/MM/yy')} - {format(new Date(p.end_date), 'dd/MM/yy')}
                                </div>
                            </div>
                            <div className={styles.payoutAmount}>
                                <div className={styles.amountValue}>{(p.amount + p.extra_costs).toLocaleString()} ฿</div>
                                <div className={styles.payoutActions}>
                                     {p.slip_url && <div style={{ color: 'var(--brand-dominant)', display: 'flex', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setZoomConfig({ images: [{ src: p.slip_url, alt: 'หลักฐานการโอนเงิน (Slip)' }], initialIndex: 0 }) }}><ExternalLink size={16} /></div>}
                                    <ChevronRight size={18} color="var(--text-muted)" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* History Detail Modal */}
            {showHistoryDetail && (
                <div className="overlay" onClick={() => setShowHistoryDetail(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 600, maxWidth: '95vw' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary)' }}>รายละเอียดการรับเงิน</h2>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{format(new Date(showHistoryDetail.created_at), 'dd/MM/yyyy')}</p>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowHistoryDetail(null)}><X size={20} /></button>
                        </div>

                        <div className="table-wrapper" style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 20 }}>
                            <table style={{ fontSize: '0.8rem' }}>
                                <thead>
                                    <tr>
                                        <th>วันที่ / เวลา</th>
                                        <th>บริการ</th>
                                        <th style={{ textAlign: 'center' }}>ค่าแรง</th>
                                        <th style={{ textAlign: 'center' }}>ค่ารถ</th>
                                        <th style={{ textAlign: 'center' }}>น้ำมัน</th>
                                        <th style={{ textAlign: 'right' }}>เพิ่มเติม</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingHistoryDetail ? (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16 }}><span className="spinner" /></td></tr>
                                    ) : historyDetailBookings.map(b => (
                                        <tr key={b.id}>
                                            <td>{format(new Date(b.scheduled_date), 'dd/MM/yy')} {b.scheduled_time}</td>
                                            <td>{(b as any).services?.name}</td>
                                            <td style={{ textAlign: 'center' }}>{(staff as any)?.branch_data?.labor_cost_per_job || 0}</td>
                                            <td style={{ textAlign: 'center' }}>{(staff as any)?.branch_data?.vehicle_rental_per_job || 0}</td>
                                            <td style={{ textAlign: 'center' }}>{(staff as any)?.branch_data?.fuel_cost_per_job || 0}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>{b.additional_price ? `+${b.additional_price.toLocaleString()}` : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 'var(--radius)', border: '2.5px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.85rem' }}>
                                <span>ค่าแรงพื้นฐาน</span>
                                <span style={{ fontWeight: 700 }}>{showHistoryDetail.amount.toLocaleString()} ฿</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.85rem' }}>
                                <span>ค่าใช้จ่ายเพิ่มเติม</span>
                                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>+{showHistoryDetail.extra_costs.toLocaleString()} ฿</span>
                            </div>
                            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
                                <span>ยอดโอนสุทธิ</span>
                                <span style={{ color: 'var(--primary)' }}>{(showHistoryDetail.amount + showHistoryDetail.extra_costs).toLocaleString()} ฿</span>
                            </div>
                        </div>

                        {showHistoryDetail.slip_url && (
                            <div style={{ marginTop: 16 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: 8 }}>สลิปหลักฐาน</div>
                                <img 
                                    src={showHistoryDetail.slip_url} 
                                    alt="Slip" 
                                    style={{ width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: 'zoom-in' }}                                     onClick={() => setZoomConfig({ images: [{ src: showHistoryDetail.slip_url, alt: 'หลักฐานการโอนเงิน (Slip)' }], initialIndex: 0 })} 
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
