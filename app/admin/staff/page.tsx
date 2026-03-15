'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Staff, Branch, Booking } from '@/lib/types'
import styles from './staff.module.css'
import { format } from 'date-fns'
import { 
    UserCircle2, 
    Wallet, 
    Building2, 
    Copy, 
    Search, 
    Calendar,
    Eye,
    EyeOff,
    Edit2,
    Play,
    Pause,
    History,
    CheckCircle2,
    Filter,
    Upload,
    ExternalLink,
    X,
    Info,
    ChevronRight
} from 'lucide-react'
import { Payout } from '@/lib/types'
import ImageUpload from '@/components/ImageUpload'

export default function StaffPage() {
    const [staff, setStaff] = useState<Staff[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Staff | null>(null)
    const [form, setForm] = useState({ full_name: '', phone: '', branch_id: '', email: '', password: '', role: 'staff', image_url: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState<'list' | 'payouts'>('list')
    const [revealed, setRevealed] = useState<Record<string, boolean>>({})
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    // Payout State
    const [selectedPayoutStaffId, setSelectedPayoutStaffId] = useState('')
    const [dateRange, setDateRange] = useState({ start: '', end: '' })
    const [bookings, setBookings] = useState<Booking[]>([])
    const [fetchingPayouts, setFetchingPayouts] = useState(false)
    const [branchFilter, setBranchFilter] = useState('')
    const [extraCosts, setExtraCosts] = useState<number>(0)
    const [staffSlips, setStaffSlips] = useState<Record<string, File | null>>({})
    const [recordingPayout, setRecordingPayout] = useState(false)
    const [payoutHistory, setPayoutHistory] = useState<Payout[]>([])

    // v3.0 New States
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([])
    const [showHistoryDetail, setShowHistoryDetail] = useState<Payout | null>(null)
    const [historyDetailBookings, setHistoryDetailBookings] = useState<Booking[]>([])
    const [loadingHistoryDetail, setLoadingHistoryDetail] = useState(false)

    const load = useCallback(async () => {
        const [{ data: sData }, { data: bData }] = await Promise.all([
            supabase.from('staff').select('*').order('full_name'),
            supabase.from('branches').select('id, name').eq('is_active', true),
        ])

        const bList = (bData || []) as Branch[]
        const bMap = new Map(bList.map(b => [b.id, b.name]))

        const staffWithBranches = (sData || []).map((s: any) => ({
            ...s,
            branch_name: bMap.get(s.branch_id),
            branch_data: bList.find(b => b.id === s.branch_id)
        }))

        setStaff(staffWithBranches)
        setBranches(bList)
        setLoading(false)
    }, [])

    const loadPayouts = async () => {
        setFetchingPayouts(true)
        // Fetch ALL completed bookings that haven't been paid yet (payout_id is null)
        let query = supabase.from('bookings').select('*, services(name), zones(name), staff(full_name)').eq('status', 'completed').is('payout_id', null)
        
        if (selectedPayoutStaffId) query = query.eq('staff_id', selectedPayoutStaffId)
        if (dateRange.start) query = query.gte('scheduled_date', dateRange.start)
        if (dateRange.end) query = query.lte('scheduled_date', dateRange.end)

        const [bRes, pRes] = await Promise.all([
            query.order('scheduled_date', { ascending: false }),
            supabase.from('staff_payouts').select('*, staff(full_name)').order('created_at', { ascending: false })
        ])

        setBookings(bRes.data || [])
        setPayoutHistory(pRes.data || [])
        setFetchingPayouts(false)
    }

    const openHistoryDetail = async (payout: Payout) => {
        setShowHistoryDetail(payout)
        setLoadingHistoryDetail(true)
        const { data } = await supabase
            .from('bookings')
            .select('*, customers(full_name), services(name)')
            .eq('payout_id', payout.id)
        setHistoryDetailBookings(data || [])
        setLoadingHistoryDetail(false)
    }

    const handleRecordPayout = async (staffId: string, bookingIds: string[], baseAmount: number, staffExtra: number) => {
        const staffSlip = staffSlips[staffId]
        if (!staffId || bookingIds.length === 0 || !staffSlip) return
        
        setRecordingPayout(true)
        try {
            const formData = new FormData()
            formData.append('staff_id', staffId)
            formData.append('amount', baseAmount.toString())
            formData.append('extra_costs', staffExtra.toString())
            formData.append('start_date', dateRange.start || format(new Date(), 'yyyy-MM-01'))
            formData.append('end_date', dateRange.end || format(new Date(), 'yyyy-MM-dd'))
            formData.append('booking_ids', JSON.stringify(bookingIds))
            formData.append('slip', staffSlip)

            const res = await fetch('/api/payouts', {
                method: 'POST',
                body: formData
            })
            if (!res.ok) throw new Error('Failed to record payout')
            
            // Clear slip for this staff
            setStaffSlips(p => {
                const next = { ...p }
                delete next[staffId]
                return next
            })
            
            setSelectedBookingIds(p => p.filter(id => !bookingIds.includes(id)))
            loadPayouts()
            alert('บันทึกการโอนเงินเรียบร้อยแล้ว')
        } catch (err: any) {
            alert(err.message)
        } finally {
            setRecordingPayout(false)
        }
    }

    const filteredBookings = useMemo(() => {
        return bookings.filter(b => {
            const s = staff.find(st => st.id === b.staff_id)
            const bName = s?.full_name?.toLowerCase() || ''
            const brId = s?.branch_id || ''
            const svcName = (b as any).services?.name?.toLowerCase() || ''
            const dateStr = format(new Date(b.scheduled_date), 'dd/MM/yyyy')
            const q = searchQuery.toLowerCase()

            const matchesSearch = !q || bName.includes(q) || svcName.includes(q) || dateStr.includes(q)
            const matchesBranch = !branchFilter || brId === branchFilter
            
            return matchesSearch && matchesBranch
        })
    }, [bookings, searchQuery, branchFilter, staff])

    const selectedByStaff = useMemo(() => {
        const groups: Record<string, { 
            bookings: Booking[], 
            laborTotal: number, 
            rentalTotal: number, 
            fuelTotal: number,
            extraFromJobs: number 
        }> = {}
        selectedBookingIds.forEach(id => {
            const b = bookings.find(x => x.id === id)
            if (b && b.staff_id) {
                if (!groups[b.staff_id]) groups[b.staff_id] = { bookings: [], laborTotal: 0, rentalTotal: 0, fuelTotal: 0, extraFromJobs: 0 }
                groups[b.staff_id].bookings.push(b)
                
                const s = staff.find(st => st.id === b.staff_id)
                const bData = s ? (s as any).branch_data : null
                
                // Calculate Size Adjustment for this booking
                let addonsTotal = 0
                if (Array.isArray(b.addon_ids)) {
                    b.addon_ids.forEach((addon: any) => {
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
                const bBase = b.base_price || 0
                const bTotal = b.total_price || 0
                const bExtra = b.extra_fee || 0
                const bDisc = b.discount_amount || 0
                const bAddi = b.additional_price || 0
                // SML = total - base - addons - extra - additional + discount
                const smlAdj = bTotal - bBase - addonsTotal - bExtra - bAddi + bDisc
                
                groups[b.staff_id].laborTotal += (bData?.labor_cost_per_job || 0) + (smlAdj > 0 ? smlAdj : 0)
                groups[b.staff_id].rentalTotal += bData?.vehicle_rental_per_job || 0
                groups[b.staff_id].fuelTotal += bData?.fuel_cost_per_job || 0
                groups[b.staff_id].extraFromJobs += bAddi
            }
        })
        return groups
    }, [selectedBookingIds, bookings, staff])

    useEffect(() => {
        if (viewMode === 'payouts') loadPayouts()
    }, [selectedPayoutStaffId, dateRange, viewMode])

    useEffect(() => { load() }, [load])

    const openAdd = () => {
        setEditing(null)
        setForm({ full_name: '', phone: '', branch_id: branches[0]?.id || '', email: '', password: '', role: 'staff', image_url: '' })
        setError('')
        setShowModal(true)
    }
    const openEdit = (s: Staff) => {
        setEditing(s)
        setForm({ full_name: s.full_name, phone: s.phone, branch_id: s.branch_id, email: s.email || '', password: s.password || '', role: s.role, image_url: s.image_url || '' })
        setError('')
        setShowModal(true)
    }

    const save = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError('')
        try {
            if (editing) {
                if (localStorage.getItem('foami_mock_db_enabled') === 'true') {
                    await supabase.from('staff').update({
                        full_name: form.full_name,
                        phone: form.phone,
                        branch_id: form.branch_id,
                        role: form.role,
                        email: form.email,
                        password: form.password,
                        image_url: form.image_url
                    }).eq('id', editing.id)
                } else {
                    const res = await fetch('/api/auth/update-staff', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: editing.id, ...form }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                }
            } else {
                if (localStorage.getItem('foami_mock_db_enabled') === 'true') {
                    // Mock DB: Skip real auth creation, just insert the staff record directly with email
                    await supabase.from('staff').insert({
                        full_name: form.full_name,
                        phone: form.phone,
                        branch_id: form.branch_id,
                        role: form.role,
                        email: form.email,
                        image_url: form.image_url,
                        is_active: true
                    })
                } else {
                    // Real DB: Create auth user first via API
                    const res = await fetch('/api/auth/create-staff', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...form }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                }
            }
            setShowModal(false)
            load()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
        } finally {
            setSaving(false)
        }
    }

    const toggleActive = async (s: Staff) => {
        await supabase.from('staff').update({ is_active: !s.is_active }).eq('id', s.id)
        load()
    }

    return (
        <div>
            <div className="page-header animate-fade">
                <div>
                    <h1 className="page-title">👤 จัดการพนักงาน</h1>
                    <p className="page-subtitle">พนักงานทั้งหมด {staff.length} คน</p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}>+ เพิ่มพนักงาน</button>
            </div>

            <div className="tabs" style={{ marginBottom: 'var(--space-6)', display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--radius-lg)', width: 'fit-content', border: '2.5px solid var(--border)' }}>
                <button className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('list')} style={{ borderRadius: 'var(--radius)' }}>
                    👤 รายชื่อพนักงาน
                </button>
                <button className={`btn btn-sm ${viewMode === 'payouts' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('payouts')} style={{ borderRadius: 'var(--radius)' }}>
                    💰 จ่ายเบี้ยพนักงาน (Payout)
                </button>
            </div>

            {loading ? (
                <div className="empty-state animate-fade"><div className="spinner" /></div>
            ) : viewMode === 'list' ? (
                <div className="table-wrapper animate-fade">
                    <table style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                        <thead>
                            <tr>
                                <th>ชื่อ / อีเมล</th>
                                <th>เบอร์โทร</th>
                                <th>สาขา</th>
                                <th>รหัสผ่าน</th>
                                <th>ตำแหน่ง</th>
                                <th>สถานะ</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {staff.length === 0 ? (
                                <tr><td colSpan={7}><div className="empty-state"><span className="empty-state-icon">👤</span><p className="empty-state-title">ยังไม่มีพนักงาน</p></div></td></tr>
                            ) : staff.map(s => (
                                <tr key={s.id} style={{ background: 'var(--surface)', cursor: 'default' }}>
                                    <td style={{ borderRadius: 'var(--radius) 0 0 var(--radius)', border: '2.5px solid var(--border)', borderRight: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div 
                                                onClick={() => s.image_url && setPreviewImage(s.image_url)}
                                                style={{ 
                                                    width: 44, 
                                                    height: 44, 
                                                    borderRadius: '50%', 
                                                    background: 'var(--surface-2)', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    color: 'var(--text-muted)', 
                                                    border: '2px solid var(--border)', 
                                                    overflow: 'hidden',
                                                    cursor: s.image_url ? 'zoom-in' : 'default',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                title={s.image_url ? 'คลิกเพื่อขยายรูป' : ''}
                                            >
                                                {s.image_url ? (
                                                    <img src={s.image_url} alt={s.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <UserCircle2 size={24} />
                                                )}
                                            </div>
                                            <div>
                                                <strong>{s.full_name}</strong>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(s as any).email || '⚠️ ยังไม่ระบุอีเมล'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ borderTop: '2.5px solid var(--border)', borderBottom: '2.5px solid var(--border)' }}>{s.phone}</td>
                                    <td style={{ borderTop: '2.5px solid var(--border)', borderBottom: '2.5px solid var(--border)' }}>{(s as any).branch_name || '-'}</td>
                                    <td style={{ borderTop: '2.5px solid var(--border)', borderBottom: '2.5px solid var(--border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {(s as any).password ? (
                                                <>
                                                    <span style={{ fontFamily: 'monospace', letterSpacing: 2, fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                        {revealed[s.id] ? (s as any).password : '••••••••'}
                                                    </span>
                                                    <button 
                                                        className="btn btn-ghost btn-xs" 
                                                        onClick={() => setRevealed(p => ({ ...p, [s.id]: !p[s.id] }))}
                                                        style={{ padding: 4 }}
                                                    >
                                                        {revealed[s.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                </>
                                            ) : (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 700 }}>⚠️ ต้องตั้งรหัสใหม่</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ borderTop: '2.5px solid var(--border)', borderBottom: '2.5px solid var(--border)' }}>
                                        <span className={`badge ${s.role === 'admin' ? 'badge-picking' : 'badge-confirmed'}`} style={{ border: '1.5px solid currentColor' }}>
                                            {s.role === 'admin' ? 'Admin' : 'Staff'}
                                        </span>
                                    </td>
                                    <td style={{ borderTop: '2.5px solid var(--border)', borderBottom: '2.5px solid var(--border)' }}>
                                        <span className={`badge ${s.is_active ? 'badge-completed' : 'badge-cancelled'}`} style={{ border: '1.5px solid currentColor' }}>
                                            {s.is_active ? 'ทำงาน' : 'หยุดพัก'}
                                        </span>
                                    </td>
                                    <td style={{ borderRadius: '0 var(--radius) var(--radius) 0', border: '2.5px solid var(--border)', borderLeft: 'none' }}>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)} style={{ padding: 6 }}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className={`btn btn-sm ${s.is_active ? 'btn-ghost' : 'btn-primary'}`} onClick={() => toggleActive(s)} style={{ padding: 6 }}>
                                                {s.is_active ? <Pause size={16} /> : <Play size={16} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="animate-fade">
                    <div className={styles.payoutHeader} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
                        <div className="form-group">
                            <label className="form-label"><Search size={14} /> ค้นหา (ชื่อ, วันที่, บริการ)</label>
                            <input 
                                className="form-input" 
                                placeholder="พิมพ์เพื่อค้นหา..." 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)} 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label"><Filter size={14} /> กรองสาขา</label>
                            <select className="form-input" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                                <option value="">-- ทั้งหมด --</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">ตั้งแต่วันที่</label>
                            <input type="date" className="form-input" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">ถึงวันที่</label>
                            <input type="date" className="form-input" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} />
                        </div>
                    </div>

                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>📂 รายการงานที่ยังไม่จ่าย ({filteredBookings.length})</h2>
                        {selectedBookingIds.length > 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedBookingIds([])} style={{ color: 'var(--danger)' }}>
                                <X size={16} /> ล้างที่เลือก ({selectedBookingIds.length})
                            </button>
                        )}
                    </div>

                    <div className="table-wrapper" style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 32 }}>
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={filteredBookings.length > 0 && selectedBookingIds.length === filteredBookings.length}
                                            onChange={e => {
                                                if (e.target.checked) setSelectedBookingIds(filteredBookings.map(b => b.id))
                                                else setSelectedBookingIds([])
                                            }}
                                        />
                                    </th>
                                    <th>พนักงาน</th>
                                    <th>วันที่ / เวลา</th>
                                    <th>บริการ</th>
                                    <th style={{ textAlign: 'center' }}>ค่าแรง</th>
                                    <th style={{ textAlign: 'center' }}>ค่ารถ</th>
                                    <th style={{ textAlign: 'center' }}>น้ำมัน</th>
                                    <th style={{ textAlign: 'center' }}>เพิ่มเติม</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBookings.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>ไม่พบรายการที่ยังไม่จ่าย</td></tr>
                                ) : filteredBookings.map(b => {
                                    const s = staff.find(st => st.id === b.staff_id)
                                    const bData = s ? (s as any).branch_data : null
                                    const base = (bData?.labor_cost_per_job || 0) + (bData?.vehicle_rental_per_job || 0)
                                    return (
                                        <tr key={b.id}>
                                            <td style={{ textAlign: 'center' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedBookingIds.includes(b.id)}
                                                    onChange={e => {
                                                        if (e.target.checked) setSelectedBookingIds(p => [...p, b.id])
                                                        else setSelectedBookingIds(p => p.filter(id => id !== b.id))
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{s?.full_name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{(s as any).branch_name}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{format(new Date(b.scheduled_date), 'dd/MM/yyyy')}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.scheduled_time}</div>
                                            </td>
                                            <td style={{ fontSize: '0.85rem' }}>{(b as any).services?.name}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{(bData?.labor_cost_per_job || 0).toLocaleString()}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{(bData?.vehicle_rental_per_job || 0).toLocaleString()}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{(bData?.fuel_cost_per_job || 0).toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                {(() => {
                                                    let addonsTotal = 0
                                                    if (Array.isArray(b.addon_ids)) {
                                                        b.addon_ids.forEach((addon: any) => {
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
                                                    const sml = (b.total_price || 0) - (b.base_price || 0) - addonsTotal - (b.extra_fee || 0) - (b.additional_price || 0) + (b.discount_amount || 0)
                                                    return (
                                                        <>
                                                            {sml !== 0 && <div style={{ color: sml > 0 ? 'var(--primary)' : 'var(--danger)', fontWeight: 700, fontSize: '0.8rem' }}>SML: {sml > 0 ? '+' : ''}{sml.toLocaleString()}</div>}
                                                            {b.additional_price ? (
                                                                <div style={{ color: 'var(--primary)', fontWeight: 700 }}>Extra: +{b.additional_price.toLocaleString()} ฿</div>
                                                            ) : '-'}
                                                        </>
                                                    )
                                                })()}
                                                {b.additional_price_note && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{b.additional_price_note}</div>}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {Object.keys(selectedByStaff).length > 0 && (
                        <div className="animate-fade" style={{ background: 'var(--surface)', padding: 24, borderRadius: 'var(--radius-lg)', border: '2.5px solid var(--primary)', marginBottom: 32 }}>
                            <h3 style={{ fontWeight: 900, fontSize: '1.2rem', marginBottom: 20, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Wallet size={24} /> สรุปยอดเตรียมจ่าย ({Object.keys(selectedByStaff).length} คน)
                            </h3>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
                                {Object.entries(selectedByStaff).map(([staffId, data]) => {
                                    const s = staff.find(x => x.id === staffId)
                                    const totalBase = data.laborTotal + data.rentalTotal + data.fuelTotal
                                    const total = totalBase + data.extraFromJobs
                                    return (
                                        <div key={staffId} style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 'var(--radius)', border: '2px solid var(--border)' }}>
                                            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>{s?.full_name}</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                                                <span>ค่าแรง ({data.bookings.length} งาน)</span>
                                                <span style={{ fontWeight: 600 }}>{data.laborTotal.toLocaleString()} ฿</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                                                <span>ค่ารถ</span>
                                                <span style={{ fontWeight: 600 }}>{data.rentalTotal.toLocaleString()} ฿</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 8 }}>
                                                <span>ค่าน้ำมัน</span>
                                                <span style={{ fontWeight: 600 }}>{data.fuelTotal.toLocaleString()} ฿</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 12 }}>
                                                <span>ค่าใช้จ่ายเพิ่มเติม (Addons)</span>
                                                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>+{data.extraFromJobs.toLocaleString()} ฿</span>
                                            </div>
                                            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
                                                <span>ยอดสุทธิ</span>
                                                <span style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{total.toLocaleString()} ฿</span>
                                            </div>
                                            
                                            <div style={{ marginTop: 12, fontSize: '0.75rem', background: 'var(--surface)', padding: 12, borderRadius: 8, display: 'flex', gap: 12, flexDirection: 'column', border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div><strong>{s?.bank_name || 'ไม่ระบุธน.'}</strong> {s?.bank_account_number || '-'}</div>
                                                    {(s?.bank_account_number) && (
                                                        <button className="btn btn-ghost btn-xs" onClick={() => {
                                                            navigator.clipboard.writeText(s.bank_account_number!);
                                                            alert('คัดลอกเลขบัญชีแล้ว');
                                                        }}><Copy size={12} /></button>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div><strong>PP:</strong> {s?.promptpay_number || '-'}</div>
                                                    {(s?.promptpay_number) && (
                                                        <button className="btn btn-ghost btn-xs" onClick={() => {
                                                            navigator.clipboard.writeText(s.promptpay_number!);
                                                            alert('คัดลอกเลขพร้อมเพย์แล้ว');
                                                        }}><Copy size={12} /></button>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ marginTop: 16 }}>
                                                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 8, display: 'block' }}>📸 อัพโหลดสลิปการโอน <span style={{ color: 'var(--danger)' }}>(จำเป็น)</span></label>
                                                {staffSlips[staffId] ? (
                                                    <div style={{ position: 'relative', marginBottom: 12 }}>
                                                        <img 
                                                            src={URL.createObjectURL(staffSlips[staffId]!)} 
                                                            style={{ width: '100%', borderRadius: 8, height: 120, objectFit: 'cover', border: '1px solid var(--border)' }} 
                                                        />
                                                        <button 
                                                            className="btn btn-ghost btn-xs" 
                                                            style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(255,255,255,0.8)', padding: 4 }}
                                                            onClick={() => setStaffSlips(p => ({ ...p, [staffId]: null }))}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div 
                                                        style={{ border: '2px dashed var(--border)', padding: '16px 8px', borderRadius: 8, textAlign: 'center', cursor: 'pointer', marginBottom: 12 }}
                                                        onClick={() => document.getElementById(`slip-${staffId}`)?.click()}
                                                    >
                                                        <Upload size={20} style={{ color: 'var(--text-muted)', marginBottom: 4 }} />
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>คลิกเพื่อเลือกไฟล์</div>
                                                        <input 
                                                            type="file" 
                                                            id={`slip-${staffId}`} 
                                                            style={{ display: 'none' }} 
                                                            accept="image/*"
                                                            onChange={e => {
                                                                if (e.target.files?.[0]) setStaffSlips(p => ({ ...p, [staffId]: e.target.files![0] }))
                                                            }}
                                                        />
                                                    </div>
                                                )}

                                                <button 
                                                    className="btn btn-primary btn-sm" 
                                                    style={{ width: '100%' }}
                                                    onClick={() => handleRecordPayout(staffId, data.bookings.map(x => x.id), totalBase, data.extraFromJobs)}
                                                    disabled={recordingPayout || !staffSlips[staffId]}
                                                >
                                                    {recordingPayout ? <span className="spinner" /> : `ยืนยันและโอนให้ ${s?.full_name?.split(' ')[0]}`}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, alignItems: 'center', borderTop: '2.5px solid var(--border)', paddingTop: 20 }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>เลือกงานและอัพสลิปรายบุคคลเพื่อโอนเงิน</div>
                            </div>
                        </div>
                    )}

                    {/* History Section */}
                    <div style={{ marginTop: 40 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <History size={20} /> ประวัติการโอนเงิน
                        </h3>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>วันที่โอน</th>
                                        <th>พนักงาน</th>
                                        <th>ช่วงเวลา (งาน)</th>
                                        <th style={{ textAlign: 'right' }}>ยอดรวมสุทธิ</th>
                                        <th style={{ textAlign: 'center' }}>สลิป</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payoutHistory.length === 0 ? (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>ยังไม่มีประวัติการโอนเงิน</td></tr>
                                    ) : payoutHistory.map(p => (
                                        <tr key={p.id}>
                                            <td>{format(new Date(p.created_at), 'dd/MM/yyyy')}</td>
                                            <td style={{ fontWeight: 600 }}>{(p as any).staff?.full_name}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {format(new Date(p.start_date), 'dd/MM/yy')} - {format(new Date(p.end_date), 'dd/MM/yy')}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{(p.amount + p.extra_costs).toLocaleString()} ฿</td>
                                            <td style={{ textAlign: 'center' }}>
                                                {p.slip_url ? (
                                                    <a href={p.slip_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs">
                                                        <ExternalLink size={14} />
                                                    </a>
                                                ) : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => openHistoryDetail(p)}>
                                                    รายละอียด <ChevronRight size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showHistoryDetail && (
                <div className="overlay" onClick={() => setShowHistoryDetail(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 800, maxWidth: '95vw' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary)' }}>รายละเอียดการจ่ายเงิน</h2>
                                <p style={{ color: 'var(--text-muted)' }}>พนักงาน: {(showHistoryDetail as any).staff?.full_name}</p>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowHistoryDetail(null)}><X size={20} /></button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 16 }}>📦 งานที่รวมในฐานกองนี้ ({historyDetailBookings.length} รายการ)</h3>
                                <div className="table-wrapper" style={{ maxHeight: 400, overflowY: 'auto' }}>
                                    <table style={{ fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr>
                                                <th>วันที่ / เวลา</th>
                                                <th>พนักงาน</th>
                                                <th>บริการ</th>
                                                <th style={{ textAlign: 'center' }}>ค่าแรง</th>
                                                <th style={{ textAlign: 'center' }}>ค่ารถ</th>
                                                <th style={{ textAlign: 'center' }}>น้ำมัน</th>
                                                <th style={{ textAlign: 'right' }}>เพิ่มเติม</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadingHistoryDetail ? (
                                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}><span className="spinner" /></td></tr>
                                            ) : historyDetailBookings.map(b => {
                                                const s = staff.find(st => st.id === b.staff_id)
                                                const bData = s ? (s as any).branch_data : null
                                                return (
                                                    <tr key={b.id}>
                                                        <td>{format(new Date(b.scheduled_date), 'dd/MM/yy')} {b.scheduled_time}</td>
                                                        <td style={{ fontSize: '0.75rem' }}>{s?.full_name}</td>
                                                        <td>{(b as any).services?.name}</td>
                                                        <td style={{ textAlign: 'center' }}>{(bData?.labor_cost_per_job || 0).toLocaleString()}</td>
                                                        <td style={{ textAlign: 'center' }}>{(bData?.vehicle_rental_per_job || 0).toLocaleString()}</td>
                                                        <td style={{ textAlign: 'center' }}>{(bData?.fuel_cost_per_job || 0).toLocaleString()}</td>
                                                        <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>{b.additional_price ? `+${b.additional_price.toLocaleString()}` : '-'}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div>
                                <div style={{ background: 'var(--surface-2)', padding: 20, borderRadius: 'var(--radius-lg)', border: '2.5px solid var(--border)', marginBottom: 16 }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>สรุปยอดรวม</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span>ค่าแรงหลัก</span>
                                        <span style={{ fontWeight: 700 }}>{showHistoryDetail.amount.toLocaleString()} ฿</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <span>ค่าใช้จ่ายเพิ่มเติม</span>
                                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>+{showHistoryDetail.extra_costs.toLocaleString()} ฿</span>
                                    </div>
                                    <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.2rem' }}>
                                        <span>ยอดโอนสุทธิ</span>
                                        <span style={{ color: 'var(--primary)' }}>{(showHistoryDetail.amount + showHistoryDetail.extra_costs).toLocaleString()} ฿</span>
                                    </div>
                                </div>
                                {showHistoryDetail.slip_url && (
                                    <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 'var(--radius)', border: '2.5px solid var(--border)' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: 8 }}>สลิปการโอน</div>
                                        <img src={showHistoryDetail.slip_url} alt="Slip" style={{ width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 600 }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            {editing ? <Edit2 size={24} /> : <UserCircle2 size={24} />}
                            {editing ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
                        </h2>
                        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">ชื่อ-นามสกุล</label>
                                    <input className="form-input" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">เบอร์โทรศัพท์</label>
                                    <input className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} required />
                                </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">สาขาหลัก</label>
                                    <select className="form-input" value={form.branch_id} onChange={e => setForm(p => ({ ...p, branch_id: e.target.value }))} required>
                                        <option value="">-- เลือกสาขา --</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">ตำแหน่ง</label>
                                    <select className="form-input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                                        <option value="staff">พนักงานทั่วไป (Staff)</option>
                                        <option value="admin">ผู้ดูแล (Admin)</option>
                                    </select>
                                </div>
                            </div>

                            <hr style={{ border: 'none', borderTop: '2.5px solid var(--border)', margin: 'var(--space-2) 0' }} />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">อีเมล</label>
                                    <input type="email" className="form-input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{editing ? 'เปลี่ยนรหัสผ่าน (ถ้าต้องการ)' : 'รหัสผ่าน'}</label>
                                    <input type="password" className="form-input" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} minLength={8} placeholder={editing ? '••••••••' : 'อย่างน้อย 8 ตัว'} required={!editing} />
                                </div>
                            </div>

                            <div className="form-group">
                                <ImageUpload
                                    label="รูปโปรไฟล์พนักงาน"
                                    value={form.image_url}
                                    onChange={(url) => setForm(p => ({ ...p, image_url: url }))}
                                    folder="staff"
                                    skipCompression={true}
                                />
                            </div>

                            {/* Transaction Info (Read-only for Admin) */}
                            <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 'var(--radius)', border: '2.5px dashed var(--border)', marginTop: 8 }}>
                                <h3 style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                                    <Building2 size={16} /> ข้อมูลธนาคาร
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>ธนาคาร</label>
                                        <input className="form-input" value={(editing as any)?.bank_name || '-'} readOnly style={{ background: 'transparent', borderStyle: 'dotted' }} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>เลขบัญชี</label>
                                        <input className="form-input" value={(editing as any)?.bank_account_number || '-'} readOnly style={{ background: 'transparent', borderStyle: 'dotted' }} />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="form-label" style={{ fontSize: '0.75rem' }}>พร้อมเพย์</label>
                                        <input className="form-input" value={(editing as any)?.promptpay_number || '-'} readOnly style={{ background: 'transparent', borderStyle: 'dotted' }} />
                                    </div>
                                </div>
                            </div>

                            {error && <div className="alert alert-error">{error}</div>}
                            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>ยกเลิก</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <span className="spinner" /> : '💾 บันทึกข้อมูล'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Image Preview Lightbox */}
            {previewImage && (
                <div className="overlay" onClick={() => setPreviewImage(null)} style={{ zIndex: 99999 }}>
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
                        <img 
                            src={previewImage} 
                            alt="Preview" 
                            style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', border: '4px solid white' }} 
                        />
                        <button 
                            className="btn btn-ghost" 
                            onClick={() => setPreviewImage(null)}
                            style={{ position: 'absolute', top: -10, right: -10, background: 'var(--danger)', color: 'white', border: '2px solid white', borderRadius: '50%', width: 40, height: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
