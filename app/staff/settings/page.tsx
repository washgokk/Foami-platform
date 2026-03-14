'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Staff, Payout, THAI_BANKS } from '@/lib/types'
import styles from './settings.module.css'
import { User, Lock, Building2, Wallet, Phone, Mail, History, ExternalLink, X, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { Booking } from '@/lib/types'

export default function StaffSettingsPage() {
    const [staff, setStaff] = useState<Staff | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })
    const [payouts, setPayouts] = useState<Payout[]>([])
    const [showHistoryDetail, setShowHistoryDetail] = useState<Payout | null>(null)
    const [historyDetailBookings, setHistoryDetailBookings] = useState<Booking[]>([])
    const [loadingHistoryDetail, setLoadingHistoryDetail] = useState(false)

    const [form, setForm] = useState({
        full_name: '',
        phone: '',
        email: '',
        password: '',
        bank_name: '',
        bank_account_number: '',
        promptpay_number: ''
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
                setStaff(data)
                setForm({
                    full_name: data.full_name || '',
                    phone: data.phone || '',
                    email: data.email || '',
                    password: '', // Don't show password
                    bank_name: data.bank_name || '',
                    bank_account_number: data.bank_account_number || '',
                    promptpay_number: data.promptpay_number || ''
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
                        promptpay_number: form.promptpay_number
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

    if (loading) return <div className="animate-fade" style={{ padding: 20 }}>กำลังโหลด...</div>

    return (
        <div className={`${styles.container} animate-fade`}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 'var(--space-6)', color: 'var(--text-primary)' }}>
                ⚙️ ตั้งค่าบัญชี
            </h1>

            {message.text && (
                <div className={`${styles.alert} ${message.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSave} className={styles.formGrid}>
                {/* Profile Section */}
                <div className={styles.card}>
                    <h2 className={styles.sectionTitle}><User size={18} /> ข้อมูลส่วนตัว</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">ชื่อ-นามสกุล</label>
                            <input 
                                className="form-input" 
                                value={form.full_name} 
                                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">เบอร์โทรศัพท์</label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }} />
                                <input 
                                    className="form-input" 
                                    style={{ paddingLeft: 40 }}
                                    value={form.phone} 
                                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                    required 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Login Section */}
                <div className={styles.card}>
                    <h2 className={styles.sectionTitle}><Lock size={18} /> ข้อมูลการเข้าสู่ระบบ</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">อีเมล</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }} />
                                <input 
                                    type="email"
                                    className="form-input" 
                                    style={{ paddingLeft: 40 }}
                                    value={form.email} 
                                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                    required 
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">รหัสผ่านใหม่ (หากไม่ต้องการเปลี่ยนให้เว้นว่างไว)</label>
                            <input 
                                type="password"
                                className="form-input" 
                                placeholder="รหัสผ่านใหม่"
                                value={form.password} 
                                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>

                {/* Bank Section */}
                <div className={styles.card}>
                    <h2 className={styles.sectionTitle}><Wallet size={18} /> ข้อมูลการรับเงิน</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                        กรุณาระบุเลขบัญชีธนาคาร หรือ พร้อมเพย์ เพื่อใช้ในการรับเบี้ยเลี้ยง
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">ชื่อธนาคาร</label>
                            <div style={{ position: 'relative' }}>
                                <Building2 size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }} />
                                <select 
                                    className="form-input" 
                                    style={{ paddingLeft: 40 }}
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
                                placeholder="000-0-00000-0"
                                value={form.bank_account_number} 
                                onChange={e => setForm(p => ({ ...p, bank_account_number: e.target.value }))}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>หรือ</span>
                            <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">เลขพร้อมเพย์</label>
                            <input 
                                className="form-input" 
                                placeholder="เบอร์โทรศัพท์ หรือ เลขบัตรประชาชน"
                                value={form.promptpay_number} 
                                onChange={e => setForm(p => ({ ...p, promptpay_number: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>

                <button type="submit" className={`btn btn-primary ${styles.saveBtn}`} disabled={saving}>
                    {saving ? <span className="spinner" /> : '💾 บันทึกการเปลี่ยนแปลง'}
                </button>
            </form>

            {/* Payout History Section */}
            <div className={styles.card} style={{ marginTop: 'var(--space-6)' }}>
                <h2 className={styles.sectionTitle}><History size={18} /> ประวัติการรับเบี้ยเลี้ยง</h2>
                <div className="table-wrapper">
                    <table style={{ minWidth: '100%' }}>
                        <thead>
                            <tr>
                                <th>วันที่โอน</th>
                                <th>ช่วงเวลา</th>
                                <th style={{ textAlign: 'right' }}>จำนวนเงิน</th>
                                <th style={{ textAlign: 'center' }}>สลิป</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payouts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                                        ยังไม่มีประวัติการรับเงิน
                                    </td>
                                </tr>
                            ) : payouts.map(p => (
                                <tr key={p.id}>
                                    <td style={{ fontSize: '0.85rem' }}>{format(new Date(p.created_at), 'dd/MM/yyyy')}</td>
                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {format(new Date(p.start_date), 'dd/MM/yy')} - {format(new Date(p.end_date), 'dd/MM/yy')}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                                        {(p.amount + p.extra_costs).toLocaleString()} ฿
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {p.slip_url ? (
                                            <a href={p.slip_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs" style={{ padding: 4 }}>
                                                <ExternalLink size={14} />
                                            </a>
                                        ) : '-'}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openHistoryDetail(p)}>
                                            <ChevronRight size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                                <img src={showHistoryDetail.slip_url} alt="Slip" style={{ width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
