'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Staff, Branch, Booking } from '@/lib/types'
import styles from './staff.module.css'
import { format } from 'date-fns'
import { trackAuditLog } from '@/lib/audit'
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
    ChevronRight,
    Users,
    UserPlus,
    Mail,
    Phone,
    Shield,
    Briefcase,
    Banknote,
    Lock,
    Trash2,
    Receipt
} from 'lucide-react'
import { Payout, THAI_BANKS } from '@/lib/types'
import ImageUpload from '@/components/ImageUpload'
import ImageZoom from '@/components/Global/ImageZoom'
import ConfirmModal from '@/components/Global/ConfirmModal'

export default function StaffPage() {
    const [staff, setStaff] = useState<Staff[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState<Staff | null>(null)
    const [form, setForm] = useState({ 
        full_name: '', phone: '', branch_id: '', email: '', password: '', role: 'staff', image_url: '',
        bank_name: '', bank_account_number: '', promptpay_number: ''
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState<'list' | 'payouts'>('list')
    const [revealed, setRevealed] = useState<Record<string, boolean>>({})
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        id: string;
        title: string;
        message: string;
    }>({ isOpen: false, id: '', title: '', message: '' })

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
    const [zoomConfig, setZoomConfig] = useState<{ images: { src: string; alt?: string }[]; initialIndex: number } | null>(null)

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
        let query = supabase.from('bookings').select('*, services(name), zones(name), staff(full_name)').eq('status', 'completed').is('payout_id', null)
        
        if (selectedPayoutStaffId) query = query.eq('staff_id', selectedPayoutStaffId)
        if (dateRange.start) query = query.gte('scheduled_date', dateRange.start)
        if (dateRange.end) query = query.lte('scheduled_date', dateRange.end)

        const [bRes, pRes] = await Promise.all([
            query.order('scheduled_date', { ascending: false }),
            supabase.from('staff_payouts').select('*, staff(full_name)').order('created_at', { ascending: false })
        ])

        let resolvedBookings: Booking[] = bRes.data || []
        let resolvedHistory: Payout[] = pRes.data || []

        // MOCK DB FALLBACK: Manually resolve joins
        if (typeof window !== 'undefined' && localStorage.getItem('foami_mock_db_enabled') === 'true') {
            const { data: allServices } = await supabase.from('services').select('*')
            const { data: allZones } = await supabase.from('zones').select('*')
            const { data: allStaff } = await supabase.from('staff').select('*')

            resolvedBookings = resolvedBookings.map(b => ({
                ...b,
                services: b.services || allServices?.find(s => s.id === b.service_id),
                zones: b.zones || allZones?.find(z => z.id === b.zone_id),
                staff: b.staff || allStaff?.find(s => s.id === b.staff_id)
            }))

            resolvedHistory = resolvedHistory.map(p => ({
                ...p,
                staff: p.staff || allStaff?.find(s => s.id === p.staff_id)
            }))
        }

        setBookings(resolvedBookings)
        setPayoutHistory(resolvedHistory)
        setFetchingPayouts(false)
    }

    const openHistoryDetail = async (payout: Payout) => {
        setShowHistoryDetail(payout)
        setLoadingHistoryDetail(true)

        const storedIds: string[] = (payout as any).booking_ids || []
        let resolvedData: any[] = []

        if (storedIds.length > 0) {
            const { data } = await supabase
                .from('bookings')
                .select('*, customers(full_name), services(name)')
                .in('id', storedIds)
            resolvedData = data || []
        } else {
            const { data } = await supabase
                .from('bookings')
                .select('*, customers(full_name), services(name)')
                .eq('payout_id', payout.id)
            resolvedData = data || []
        }
        
        let resolved = resolvedData || []
        if (typeof window !== 'undefined' && localStorage.getItem('foami_mock_db_enabled') === 'true') {
            const { data: allServices } = await supabase.from('services').select('*')
            const { data: allCustomers } = await supabase.from('customers').select('*')
            resolved = resolved.map(b => ({
                ...b,
                services: b.services || allServices?.find(s => s.id === b.service_id),
                customers: b.customers || allCustomers?.find(c => c.id === b.customer_id)
            }))
        }
        setHistoryDetailBookings(resolved)
        setLoadingHistoryDetail(false)
    }


    const handleRecordPayout = async (staffId: string, bookingIds: string[], baseAmount: number, staffExtra: number) => {
        const staffSlip = staffSlips[staffId]
        if (!staffId || bookingIds.length === 0) return
        
        // Slip is strongly recommended but not required — confirm if missing
        if (!staffSlip) {
            const proceed = window.confirm('ยังไม่ได้อัพโหลดสลิป\nต้องการบันทึกการจ่ายเงินโดยไม่มีสลิปหรือไม่?')
            if (!proceed) return
        }
        
        setRecordingPayout(true)
        try {
            const formData = new FormData()
            formData.append('staff_id', staffId)
            formData.append('amount', baseAmount.toString())
            formData.append('extra_costs', staffExtra.toString())
            formData.append('start_date', dateRange.start || format(new Date(), 'yyyy-MM-01'))
            formData.append('end_date', dateRange.end || format(new Date(), 'yyyy-MM-dd'))
            formData.append('booking_ids', JSON.stringify(bookingIds))
            if (staffSlip) formData.append('slip', staffSlip)

            const res = await fetch('/api/payouts', {
                method: 'POST',
                body: formData
            })
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || 'ไม่สามารถบันทึกการจ่ายเงินได้')
            }
            
            setStaffSlips(p => {
                const next = { ...p }
                delete next[staffId]
                return next
            })
            
            setSelectedBookingIds(p => p.filter(id => !bookingIds.includes(id)))
            loadPayouts()
            alert('บันทึกการโอนเงินเรียบร้อยแล้ว' + (!staffSlip ? '\n(ไม่มีสลิป — กรุณาอัพโหลดสลิปในภายหลัง)' : ''))
        } catch (err: any) {
            alert('เกิดข้อผิดพลาด: ' + err.message)
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
            const dateStr = b.scheduled_date ? format(new Date(b.scheduled_date), 'dd/MM/yyyy') : ''
            const q = searchQuery.toLowerCase()

            const matchesSearch = !q || bName.includes(q) || svcName.includes(q) || dateStr.includes(q)
            const matchesBranch = !branchFilter || brId === branchFilter
            
            return matchesSearch && matchesBranch
        })
    }, [bookings, searchQuery, branchFilter, staff])

    const filteredStaff = useMemo(() => {
        return staff.filter(s => {
            const name = s.full_name?.toLowerCase() || ''
            const phone = s.phone?.toLowerCase() || ''
            const email = (s as any).email?.toLowerCase() || ''
            const q = searchQuery.toLowerCase()
            
            const matchesSearch = !q || name.includes(q) || phone.includes(q) || email.includes(q)
            const matchesBranch = !branchFilter || s.branch_id === branchFilter
            
            return matchesSearch && matchesBranch
        })
    }, [staff, searchQuery, branchFilter])

    const selectedByStaff = useMemo(() => {
        const groups: Record<string, { 
            bookings: Booking[], 
            laborTotal: number, 
            rentalTotal: number, 
            fuelTotal: number,
            capitalTotal: number,
            extraFromJobs: number,
            bonusTotal: number
        }> = {}
        selectedBookingIds.forEach(id => {
            const b = bookings.find(x => x.id === id)
            if (b && b.staff_id) {
                if (!groups[b.staff_id]) groups[b.staff_id] = { bookings: [], laborTotal: 0, rentalTotal: 0, fuelTotal: 0, capitalTotal: 0, extraFromJobs: 0, bonusTotal: 0 }
                groups[b.staff_id].bookings.push(b)
                
                const s = staff.find(st => st.id === b.staff_id)
                const bData = s ? (s as any).branch_data : null
                
                // Use snapshot values if available, otherwise fallback to branch defaults
                const labor = b.labor_cost !== undefined ? b.labor_cost : (bData?.labor_cost_per_job || 0)
                const rental = b.rental_cost !== undefined ? b.rental_cost : (bData?.vehicle_rental_per_job || 0)
                const fuel = b.fuel_cost !== undefined ? b.fuel_cost : (bData?.fuel_cost_per_job || 0)
                const capital = b.capital_cost !== undefined ? b.capital_cost : (bData?.max_capital_per_job || 0)
                const bAddi = b.additional_price || 0
                const bBonus = b.staff_extra_payout || 0
                
                groups[b.staff_id].laborTotal += labor
                groups[b.staff_id].rentalTotal += rental
                groups[b.staff_id].fuelTotal += fuel
                groups[b.staff_id].capitalTotal += capital
                groups[b.staff_id].extraFromJobs += bAddi
                groups[b.staff_id].bonusTotal += bBonus
            }
        })
        return groups
    }, [selectedBookingIds, bookings, staff])

    useEffect(() => {
        if (viewMode === 'payouts') loadPayouts()
    }, [selectedPayoutStaffId, dateRange, viewMode])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        const handleRefresh = () => load()
        window.addEventListener('foami:refresh', handleRefresh)
        return () => window.removeEventListener('foami:refresh', handleRefresh)
    }, [load])

    const openAdd = () => {
        setEditing(null)
        setForm({ 
            full_name: '', phone: '', branch_id: branches[0]?.id || '', 
            email: '', password: '', role: 'staff', image_url: '',
            bank_name: '', bank_account_number: '', promptpay_number: ''
        })
        setError('')
        setShowModal(true)
    }
    const openEdit = (s: Staff) => {
        setEditing(s)
        setForm({ 
            full_name: s.full_name, 
            phone: s.phone, 
            branch_id: s.branch_id, 
            email: s.email || '', 
            password: s.password || '', 
            role: s.role, 
            image_url: s.image_url || '',
            bank_name: s.bank_name || '',
            bank_account_number: s.bank_account_number || '',
            promptpay_number: s.promptpay_number || ''
        })
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
                
                await trackAuditLog({
                    action_type: 'UPDATE',
                    entity_type: 'staff',
                    entity_id: editing.id,
                    old_data: editing,
                    new_data: { ...editing, ...form },
                    description: `แก้ไขข้อมูลพนักงาน: ${editing.full_name}`
                })
            } else {
                let newStaffId = ''
                if (localStorage.getItem('foami_mock_db_enabled') === 'true') {
                    const res = await supabase.from('staff').insert({
                        full_name: form.full_name,
                        phone: form.phone,
                        branch_id: form.branch_id,
                        role: form.role,
                        email: form.email,
                        image_url: form.image_url,
                        is_active: true
                    }).select().single()
                    newStaffId = res.data?.id
                } else {
                    const res = await fetch('/api/auth/create-staff', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...form }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    newStaffId = data.id || data.user_id || data.data?.id || data.data?.user_id
                }
                
                if (newStaffId) {
                    await trackAuditLog({
                        action_type: 'CREATE',
                        entity_type: 'staff',
                        entity_id: newStaffId,
                        new_data: form,
                        description: `เพิ่มพนักงานใหม่: ${form.full_name}`
                    })
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
        const nextState = !s.is_active
        await supabase.from('staff').update({ is_active: nextState }).eq('id', s.id)
        
        await trackAuditLog({
            action_type: 'TOGGLE_STATUS',
            entity_type: 'staff',
            entity_id: s.id,
            old_data: { is_active: s.is_active },
            new_data: { is_active: nextState },
            description: `${nextState ? 'เปิด' : 'ปิด'}การใช้งานพนักงาน: ${s.full_name}`
        })
        
        load()
    }
    
    const handleDeleteStaff = async (s: Staff) => {
        setConfirmConfig({
            isOpen: true,
            id: s.id,
            title: 'ยืนยันการลบพนักงาน',
            message: `คุณแน่ใจหรือไม่ว่าต้องการลบพนักงาน "${s.full_name}"? การลบนี้จะไม่สามารถย้อนคืนได้`
        })
    }

    const handleConfirmDeleteStaff = async () => {
        const id = confirmConfig.id
        const s = staff.find(x => x.id === id)
        if (!s) return

        setConfirmConfig(p => ({ ...p, isOpen: false }))
        setSaving(true)
        
        try {
            const { error: delError } = await supabase.from('staff').delete().eq('id', id)
            if (delError) {
                if (delError.code === '23503') {
                    alert('ไม่สามารถลบพนักงานคนนี้ได้ เนื่องจากมีประวัติการจองงานหรือข้อมูลการจ่ายเงินที่ผูกอยู่ในระบบ\n\nกรุณาปิดการใช้งาน (Deactivate) แทนการลบเพื่อรักษาประวัติข้อมูล')
                } else {
                    throw delError
                }
                setSaving(false)
                return
            }
            
            await trackAuditLog({
                action_type: 'DELETE',
                entity_type: 'staff',
                entity_id: id,
                old_data: s,
                description: `ลบพนักงาน: ${s.full_name}`
            })
            
            load()
            alert('ลบข้อมูลพนักงานเรียบร้อยแล้ว')
        } catch (err: any) {
            alert('เกิดข้อผิดพลาดในการลบ: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div>
            <div className="page-header animate-fade">
                <div>
                    <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Users size={28} style={{ color: 'var(--brand-dominant)' }} /> จัดการพนักงาน
                    </h2>
                    <p className="page-subtitle">จัดการรายชื่อและสิทธิ์การเข้าถึงของพนักงานทั้งหมด {staff.length} ท่าน</p>
                </div>
                <button className="btn btn-primary" style={{ borderRadius: 12, gap: 8 }} onClick={openAdd}>
                    <UserPlus size={20} /> เพิ่มพนักงาน
                </button>
            </div>

            <div className="tabs" style={{ marginBottom: 'var(--space-6)', display: 'flex', gap: 6, background: 'var(--surface-2)', padding: 6, borderRadius: '16px', width: 'fit-content', border: '1px solid var(--border)' }}>
                <button 
                    className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`} 
                    onClick={() => setViewMode('list')} 
                    style={{ borderRadius: '10px', padding: '6px 16px', background: viewMode === 'list' ? 'var(--brand-dominant)' : 'transparent', color: viewMode === 'list' ? 'white' : 'var(--text-muted)' }}
                >
                    <Users size={16} /> รายชื่อพนักงาน
                </button>
                <button 
                    className={`btn btn-sm ${viewMode === 'payouts' ? 'btn-primary' : 'btn-ghost'}`} 
                    onClick={() => setViewMode('payouts')} 
                    style={{ borderRadius: '10px', padding: '6px 16px', background: viewMode === 'payouts' ? 'var(--brand-dominant)' : 'transparent', color: viewMode === 'payouts' ? 'white' : 'var(--text-muted)' }}
                >
                    <Wallet size={16} /> จ่ายเบี้ยพนักงาน (Payout)
                </button>
            </div>

            <div className={styles.payoutHeader} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24, background: 'var(--surface)', padding: 20, borderRadius: 16, border: '1px solid var(--border)', visibility: 'visible' }}>
                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Search size={14} /> ค้นหา{viewMode === 'list' ? 'พนักงาน' : 'พนักงาน/บริการ'}</label>
                    <input 
                        className="form-input" 
                        style={{ borderRadius: 10, padding: '8px 12px' }}
                        placeholder="พิมพ์เพื่อค้นหา..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                    />
                </div>
                <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={14} /> กรองสาขา</label>
                    <select className="form-input" style={{ borderRadius: 10, padding: '8px 12px' }} value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                        <option value="">-- ทั้งหมดทุกสาขา --</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                {viewMode === 'payouts' && (
                    <>
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={14} /> จากวันที่</label>
                            <input type="date" className="form-input" style={{ borderRadius: 10, padding: '8px 12px' }} value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={14} /> ถึงวันที่</label>
                            <input type="date" className="form-input" style={{ borderRadius: 10, padding: '8px 12px' }} value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} />
                        </div>
                    </>
                )}
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
                            {filteredStaff.length === 0 ? (
                                <tr><td colSpan={7}><div className="empty-state"><span className="empty-state-icon"></span><p className="empty-state-title">ไม่พบพนักงานที่ค้นหา</p></div></td></tr>
                            ) : filteredStaff.map(s => (
                                <tr key={s.id} style={{ background: 'var(--surface)', cursor: 'default' }}>
                                    <td style={{ borderRadius: 'var(--radius) 0 0 var(--radius)', border: '2.5px solid var(--border)', borderRight: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div 
                                                onClick={() => s.image_url && setZoomConfig({ images: [{ src: s.image_url, alt: `โปรไฟล์: ${s.full_name}` }], initialIndex: 0 })}
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
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(s as any).email || ' ยังไม่ระบุอีเมล'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ borderTop: '2.5px solid var(--border)', borderBottom: '2.5px solid var(--border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Phone size={14} style={{ color: 'var(--brand-dominant)' }} /> {s.phone}
                                        </div>
                                    </td>
                                    <td style={{ borderTop: '2.5px solid var(--border)', borderBottom: '2.5px solid var(--border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Building2 size={14} style={{ color: 'var(--brand-dominant)' }} /> {(s as any).branch_name || '-'}
                                        </div>
                                    </td>
                                    <td style={{ borderTop: '2.5px solid var(--border)', borderBottom: '2.5px solid var(--border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {(s as any).password ? (
                                                <>
                                                    <span style={{ fontFamily: 'monospace', letterSpacing: 2, fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                        {revealed[s.id] ? (s as any).password : ''}
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
                                                <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 700 }}> ต้องตั้งรหัสใหม่</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ borderTop: '2.5px solid var(--border)', borderBottom: '2.5px solid var(--border)' }}>
                                        <span className={`badge ${s.role === 'admin' ? 'badge-picking' : 'badge-confirmed'}`} style={{ border: '1.5px solid currentColor' }}>
                                            {s.role === 'admin' ? 'Admin' : 'Staff'}
                                        </span>
                                    </td>
                                    <td style={{ borderTop: '2.5px solid var(--border)', borderBottom: '2.5px solid var(--border)' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className={`btn btn-sm ${s.is_active ? 'btn-ghost' : 'btn-primary'}`} onClick={() => toggleActive(s)} style={{ padding: 6 }}>
                                                {s.is_active ? <Pause size={16} /> : <Play size={16} />}
                                            </button>
                                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)} style={{ padding: 6 }}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="btn btn-outline btn-sm" onClick={() => handleDeleteStaff(s)} style={{ padding: 6, color: 'var(--danger)' }}>
                                                <Trash2 size={16} />
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
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--brand-dominant)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Wallet size={24} /> รายการงานรอการชำระเงิน ({filteredBookings.length})
                        </h2>
                        {selectedBookingIds.length > 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedBookingIds([])} style={{ color: 'var(--danger)', borderRadius: 10, gap: 6 }}>
                                <X size={16} /> ล้างที่เลือก ({selectedBookingIds.length})
                            </button>
                        )}
                    </div>

                    <div className="table-wrapper" style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 32, border: '1px solid var(--border)', borderRadius: 16 }}>
                        <table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface)' }}>
                                <tr>
                                    <th style={{ width: 60, textAlign: 'center' }}>
                                        <label className={styles.checkboxContainer}>
                                            <input 
                                                type="checkbox" 
                                                className={styles.checkboxInput}
                                                checked={filteredBookings.length > 0 && selectedBookingIds.length === filteredBookings.length}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedBookingIds(filteredBookings.map(b => b.id))
                                                    else setSelectedBookingIds([])
                                                }}
                                            />
                                            <span className={styles.checkmark}></span>
                                        </label>
                                    </th>
                                    <th>พนักงาน</th>
                                    <th>วันที่ / เวลา</th>
                                    <th>บริการ</th>
                                    <th style={{ textAlign: 'center' }}>ค่าแรง</th>
                                    <th style={{ textAlign: 'center' }}>ค่ารถ</th>
                                    <th style={{ textAlign: 'center' }}>น้ำมัน</th>
                                    <th style={{ textAlign: 'center' }}>ต้นทุน</th>
                                    <th style={{ textAlign: 'center' }}>โบนัสค่าเดินทาง</th>
                                    <th style={{ textAlign: 'center' }}>เพิ่มเติม</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBookings.length === 0 ? (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                                        <Wallet size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                                        <div>ไม่พบรายการที่ยังไม่จ่าย</div>
                                    </td></tr>
                                ) : filteredBookings.map(b => {
                                    const s = staff.find(st => st.id === b.staff_id)
                                    const bData = s ? (s as any).branch_data : null
                                    const isSelected = selectedBookingIds.includes(b.id)
                                    
                                    // Snapshot values with fallback
                                    const labor = b.labor_cost !== undefined ? b.labor_cost : (bData?.labor_cost_per_job || 0)
                                    const rental = b.rental_cost !== undefined ? b.rental_cost : (bData?.vehicle_rental_per_job || 0)
                                    const fuel = b.fuel_cost !== undefined ? b.fuel_cost : (bData?.fuel_cost_per_job || 0)
                                    const capital = b.capital_cost !== undefined ? b.capital_cost : (bData?.max_capital_per_job || 0)
                                    
                                    // Use joined staff name if state lookup fails
                                    const staffName = s?.full_name || (b as any).staff?.full_name || 'รอดำเนินการ'
                                    const branchName = (s as any)?.branch_name || 'ไม่ทราบสาขา'

                                    return (
                                        <tr key={b.id} className={isSelected ? styles.selectedRow : ''}>
                                            <td style={{ textAlign: 'center' }}>
                                                <label className={styles.checkboxContainer}>
                                                    <input 
                                                        type="checkbox" 
                                                        className={styles.checkboxInput}
                                                        checked={isSelected}
                                                        onChange={e => {
                                                            if (e.target.checked) setSelectedBookingIds(p => [...p, b.id])
                                                            else setSelectedBookingIds(p => p.filter(id => id !== b.id))
                                                        }}
                                                    />
                                                    <span className={styles.checkmark}></span>
                                                </label>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 700, color: 'var(--brand-dominant)' }}>{staffName}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{branchName}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{format(new Date(b.scheduled_date), 'dd/MM/yyyy')}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.scheduled_time}</div>
                                            </td>
                                            <td style={{ fontSize: '0.85rem' }}>{(b as any).services?.name}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{labor.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{rental.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{fuel.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{capital.toLocaleString()}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--brand-dominant)' }}>
                                                {b.staff_extra_payout ? `฿${b.staff_extra_payout.toLocaleString()}` : '-'}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {b.additional_price ? (
                                                    <div style={{ color: 'var(--brand-dominant)', fontWeight: 800 }}>+{b.additional_price.toLocaleString()} ฿</div>
                                                ) : '-'}
                                                {b.additional_price_note && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{b.additional_price_note}</div>}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {Object.keys(selectedByStaff).length > 0 && (
                        <div className="animate-fade" style={{ background: 'var(--brand-dominant-ghost)', padding: 32, borderRadius: '28px', border: '1px solid var(--brand-dominant-light)', marginBottom: 40, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }}>
                            <h3 style={{ fontWeight: 900, fontSize: '1.4rem', marginBottom: 28, color: 'var(--brand-dominant)', display: 'flex', alignItems: 'center', gap: 14 }}>
                                <Wallet size={32} /> สรุปรายการเตรียมโอน ({Object.keys(selectedByStaff).length} ท่าน)
                            </h3>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24, marginBottom: 28 }}>
                                {Object.entries(selectedByStaff).map(([staffId, data]) => {
                                    const s = staff.find(x => x.id === staffId)
                                    const total = data.laborTotal + data.rentalTotal + data.fuelTotal + data.capitalTotal + data.extraFromJobs + data.bonusTotal
                                    return (
                                        <div key={staffId} style={{ background: 'var(--surface)', padding: 28, borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
                                            <div style={{ fontWeight: 900, color: 'var(--brand-dominant)', marginBottom: 20, fontSize: '1.2rem', borderBottom: '2px solid var(--brand-dominant-ghost)', paddingBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <UserCircle2 size={24} /> {s?.full_name}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: 10 }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>ค่าแรงหลัก ({data.bookings.length} งาน)</span>
                                                <span style={{ fontWeight: 700 }}>{data.laborTotal.toLocaleString()} ฿</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: 10 }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>ค่าเช่ารถ / น้ำมัน</span>
                                                <span style={{ fontWeight: 700 }}>{(data.rentalTotal + data.fuelTotal).toLocaleString()} ฿</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: 10 }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>ค่าต้นทุนอุปกรณ์</span>
                                                <span style={{ fontWeight: 700 }}>{data.capitalTotal.toLocaleString()} ฿</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: 20 }}>
                                                <span style={{ fontWeight: 700, color: 'var(--brand-dominant)' }}>บริการพิเศษ / SML / อื่นๆ</span>
                                                <span style={{ fontWeight: 900, color: 'var(--brand-dominant)' }}>+{data.extraFromJobs.toLocaleString()} ฿</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: 20 }}>
                                                <span style={{ fontWeight: 800, color: 'var(--brand-dominant)' }}>โบนัสค่าเดินทาง (50%)</span>
                                                <span style={{ fontWeight: 900, color: 'var(--brand-dominant)' }}>+{data.bonusTotal.toLocaleString()} ฿</span>
                                            </div>
                                            
                                            <div style={{ background: 'var(--brand-dominant-ghost)', padding: 20, borderRadius: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, border: '1.5px solid var(--brand-dominant-light)' }}>
                                                <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--brand-dominant)' }}>ยอดโอนสุทธิ</span>
                                                <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--brand-dominant)' }}>{total.toLocaleString()} ฿</span>
                                            </div>
                                            
                                            <div style={{ fontSize: '0.85rem', background: 'var(--surface-2)', padding: 20, borderRadius: 16, border: '1px solid var(--border)', marginBottom: 24 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Building2 size={16} /> <strong>{s?.bank_name || 'ไม่ระบุธน.'}</strong></div>
                                                    <button className="btn btn-ghost btn-xs" onClick={() => { s?.bank_account_number && navigator.clipboard.writeText(s.bank_account_number); alert('Copy'); }}><Copy size={12} /></button>
                                                </div>
                                                <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: 1.5, marginBottom: 12 }}>{s?.bank_account_number || '---'}</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Banknote size={16} /> <strong>PP: {s?.promptpay_number || '-'}</strong></div>
                                                    <button className="btn btn-ghost btn-xs" onClick={() => { s?.promptpay_number && navigator.clipboard.writeText(s.promptpay_number); alert('Copy'); }}><Copy size={12} /></button>
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: '0.85rem', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                                                    <Upload size={16} /> อัพโหลดสลิปยืนยัน <span style={{ color: 'var(--danger)' }}>(จำเป็น)</span>
                                                </label>
                                                {staffSlips[staffId] ? (
                                                    <div style={{ position: 'relative', marginBottom: 20 }}>
                                                        <img 
                                                            src={URL.createObjectURL(staffSlips[staffId]!)} 
                                                            style={{ width: '100%', borderRadius: 16, height: 180, objectFit: 'cover', border: '1px solid var(--border)' }} 
                                                        />
                                                        <button 
                                                            className="btn btn-ghost btn-xs" 
                                                            style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.95)', padding: 8, borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                            onClick={() => setStaffSlips(p => ({ ...p, [staffId]: null }))}
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div 
                                                        style={{ border: '2.5px dashed var(--border)', padding: '32px 16px', borderRadius: 16, textAlign: 'center', cursor: 'pointer', marginBottom: 20, background: 'var(--surface-2)', transition: 'all 0.2s' }}
                                                        onClick={() => document.getElementById(`slip-${staffId}`)?.click()}
                                                    >
                                                        <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>เลือกสลิปเพื่ออัพโหลด</div>
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
                                                    className="btn btn-primary" 
                                                    style={{ width: '100%', borderRadius: 16, padding: '16px', fontWeight: 800, gap: 12, fontSize: '1rem', boxShadow: '0 8px 16px var(--brand-dominant-ghost)' }}
                                                    onClick={() => {
                                                        const baseAmount = data.laborTotal + data.rentalTotal + data.fuelTotal + data.capitalTotal;
                                                        const extraCosts = data.extraFromJobs + data.bonusTotal;
                                                        handleRecordPayout(staffId, data.bookings.map(x => x.id), baseAmount, extraCosts);
                                                    }}
                                                    disabled={recordingPayout}
                                                >
                                                    {recordingPayout ? <span className="spinner" /> : <><Banknote size={24} /> บันทึกการจ่ายเงิน</>}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: 56 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                            <h3 style={{ fontWeight: 900, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: 14, color: 'var(--brand-dominant)' }}>
                                <History size={30} /> ประวัติการทำรายการโอน
                            </h3>
                        </div>
                        <div className="table-wrapper" style={{ borderRadius: 20, border: '1px solid var(--border)' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>วันที่ทำรายการ</th>
                                        <th>พนักงาน</th>
                                        <th>ช่วงเวลา</th>
                                        <th style={{ textAlign: 'right' }}>ยอดรวมโอน</th>
                                        <th style={{ textAlign: 'center' }}>สลิป</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payoutHistory.length === 0 ? (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>
                                            <History size={48} style={{ opacity: 0.1, marginBottom: 12 }} />
                                            <div>ยังไม่พบข้อมูลประวัติการโอนเงิน</div>
                                        </td></tr>
                                    ) : payoutHistory.map(p => (
                                        <tr key={p.id}>
                                            <td style={{ fontWeight: 600 }}>{format(new Date(p.created_at), 'dd/MM/yyyy HH:mm')}</td>
                                            <td>
                                                <div style={{ fontWeight: 800, color: 'var(--brand-dominant)', fontSize: '1rem' }}>{(p as any).staff?.full_name}</div>
                                            </td>
                                            <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                                                    <Calendar size={14} /> {format(new Date(p.start_date), 'dd MMM')} - {format(new Date(p.end_date), 'dd MMM yy')}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 900, fontSize: '1.1rem', color: 'var(--brand-dominant)' }}>{(p.amount + p.extra_costs).toLocaleString()} ฿</td>
                                            <td style={{ textAlign: 'center' }}>
                                                {p.slip_url ? (
                                                     <button className="btn btn-ghost btn-sm" onClick={() => setZoomConfig({ images: [{ src: p.slip_url, alt: `สลิปการโอน: ${(p as any).staff?.full_name}` }], initialIndex: 0 })} style={{ color: 'var(--brand-dominant)', padding: 8, borderRadius: 10 }}>
                                                        <ExternalLink size={18} />
                                                    </button>
                                                ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => openHistoryDetail(p)} style={{ borderRadius: 12, gap: 8, color: 'var(--brand-dominant)', fontWeight: 700, padding: '8px 16px' }}>
                                                    ดูรายละเอียด <ChevronRight size={18} />
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
                <div className="overlay" onClick={() => setShowHistoryDetail(null)} style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal animate-fade" onClick={e => e.stopPropagation()} style={{ width: '90vw', maxWidth: 1000, padding: 32, borderRadius: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                            <div>
                                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--brand-dominant)', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                                    <Receipt size={28} /> รายละเอียดการรับเงิน
                                </h2>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginLeft: 40 }}>
                                    รหัสทำรายการ: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{showHistoryDetail.id.split('-')[0].toUpperCase()}</span> • วันที่: {format(new Date(showHistoryDetail.created_at), 'dd/MM/yyyy HH:mm')}
                                </p>
                            </div>
                            <button className="btn btn-ghost btn-sm" style={{ borderRadius: 12, background: 'var(--surface-2)', padding: 8 }} onClick={() => setShowHistoryDetail(null)}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32 }}>
                            <div>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}> 
                                    <CheckCircle2 size={18} color="var(--brand-dominant)" /> งานที่รวมในรอบนี้ ({historyDetailBookings.length} รายการ)
                                </h3>
                                <div className="table-wrapper" style={{ maxHeight: 400, overflowY: 'auto', borderRadius: 16, border: '1px solid var(--border)' }}>
                                    <table style={{ fontSize: '0.85rem' }}>
                                        <thead style={{ background: 'var(--surface-2)', position: 'sticky', top: 0, zIndex: 1 }}>
                                            <tr>
                                                <th style={{ padding: '12px 16px' }}>วันที่ / เวลา</th>
                                                <th>บริการ</th>
                                                <th style={{ textAlign: 'center' }}>ค่าแรง</th>
                                                <th style={{ textAlign: 'center' }}>ค่ารถ</th>
                                                <th style={{ textAlign: 'center' }}>น้ำมัน</th>
                                                <th style={{ textAlign: 'center' }}>ต้นทุน</th>
                                                <th style={{ textAlign: 'center' }}>โบนัส</th>
                                                <th style={{ textAlign: 'center' }}>เพิ่มเติม</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadingHistoryDetail ? (
                                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}><span className="spinner" style={{ width: 32, height: 32 }} /></td></tr>
                                            ) : historyDetailBookings.map(b => {
                                                const s = staff.find(st => st.id === b.staff_id)
                                                const bData = s ? (s as any).branch_data : null
                                                // Use snapshot values stored at booking time; fallback to current branch defaults
                                                const labor = (b as any).labor_cost ?? bData?.labor_cost_per_job ?? 0
                                                const rental = (b as any).rental_cost ?? bData?.vehicle_rental_per_job ?? 0
                                                const fuel = (b as any).fuel_cost ?? bData?.fuel_cost_per_job ?? 0
                                                const capital = (b as any).capital_cost ?? bData?.max_capital_per_job ?? 0
                                                return (
                                                    <tr key={b.id} style={{ transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <div style={{ fontWeight: 600 }}>{format(new Date(b.scheduled_date), 'dd/MM/yy')}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.scheduled_time}</div>
                                                        </td>
                                                        <td>{(b as any).services?.name}</td>
                                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{labor.toLocaleString()}</td>
                                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{rental.toLocaleString()}</td>
                                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{fuel.toLocaleString()}</td>
                                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{capital.toLocaleString()}</td>
                                                        <td style={{ textAlign: 'center', color: 'var(--brand-dominant)', fontWeight: 800 }}>{b.staff_extra_payout ? b.staff_extra_payout.toLocaleString() : '-'}</td>
                                                        <td style={{ textAlign: 'center', color: 'var(--brand-dominant)', fontWeight: 600 }}>{b.additional_price ? `+${b.additional_price.toLocaleString()}` : '-'}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ background: 'var(--surface)', padding: 24, borderRadius: 20, border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 8 }}><Wallet size={16} /> สรุปยอดโอนเงิน</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: '0.95rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>ค่าแรงหลัก</span>
                                        <span style={{ fontWeight: 700 }}>{showHistoryDetail.amount.toLocaleString()} ฿</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: '0.95rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>ค่าใช้จ่ายเพิ่มเติม</span>
                                        <span style={{ fontWeight: 700, color: 'var(--brand-dominant)' }}>+{showHistoryDetail.extra_costs.toLocaleString()} ฿</span>
                                    </div>
                                    <div style={{ borderTop: '2px dashed var(--border)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>ยอดโอนสุทธิ</span>
                                        <span style={{ color: 'var(--brand-dominant)', fontWeight: 900, fontSize: '1.6rem' }}>{(showHistoryDetail.amount + showHistoryDetail.extra_costs).toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 700 }}>฿</span></span>
                                    </div>
                                </div>
                                {showHistoryDetail.slip_url ? (
                                    <div style={{ background: 'var(--brand-dominant-ghost)', padding: 16, borderRadius: 20, border: '1px solid var(--brand-dominant-light)' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--brand-dominant)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Banknote size={16} /> หลักฐานการโอน</span>
                                            <button
                                                className="btn btn-ghost btn-xs"
                                                onClick={() => setZoomConfig({ images: [{ src: showHistoryDetail.slip_url!, alt: 'สลิปการโอน' }], initialIndex: 0 })}
                                                style={{ color: 'var(--brand-dominant)', gap: 6, background: 'var(--surface)', borderRadius: 8, padding: '4px 8px' }}
                                            >
                                                <ExternalLink size={14} /> ขยายดู
                                            </button>
                                        </div>
                                        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: 'var(--surface)' }}>
                                            <img
                                                src={showHistoryDetail.slip_url}
                                                alt="Slip"
                                                style={{ width: '100%', display: 'block', cursor: 'zoom-in', transition: 'transform 0.2s', maxHeight: 200, objectFit: 'cover' }}
                                                onClick={() => setZoomConfig({ images: [{ src: showHistoryDetail.slip_url!, alt: 'สลิปการโอน' }], initialIndex: 0 })}
                                                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
                                                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ background: 'var(--surface-2)', padding: 32, borderRadius: 20, border: '2px dashed var(--border)', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <Receipt size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>ยังไม่มีสลิปอัพโหลด</div>
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
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: 'var(--space-8)', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--brand-dominant)' }}>
                            {editing ? <Edit2 size={28} /> : <UserCircle2 size={28} />}
                            {editing ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
                        </h2>
                        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} /> ชื่อ-นามสกุล</label>
                                    <input className="form-input" style={{ borderRadius: 10 }} value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={14} /> เบอร์โทรศัพท์</label>
                                    <input className="form-input" style={{ borderRadius: 10 }} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} required />
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

                            <div style={{ background: 'var(--surface-2)', padding: 20, borderRadius: '20px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--brand-dominant)', margin: 0 }}>
                                    <Lock size={16} /> ข้อมูลการเข้าใช้งาน
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>อีเมล</label>
                                        <input type="email" className="form-input" style={{ borderRadius: 10 }} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>{editing ? 'เปลี่ยนรหัสผ่าน (ถ้าต้องการ)' : 'รหัสผ่าน'}</label>
                                        <input type="password" className="form-input" style={{ borderRadius: 10 }} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} minLength={8} placeholder={editing ? 'ละไว้ถ้าไม่เปลี่ยน' : 'อย่างน้อย 8 ตัว'} required={!editing} />
                                    </div>
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

                            <div style={{ background: 'var(--surface-2)', padding: 20, borderRadius: '20px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--brand-dominant)', margin: 0 }}>
                                    <Banknote size={16} /> ข้อมูลการเงินรายทริป (Payout Settings)
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>ธนาคาร</label>
                                        <select className="form-input" style={{ borderRadius: 10 }} value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))}>
                                            <option value="">-- เลือกธนาคาร --</option>
                                            {THAI_BANKS.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>เลขบัญชีธนาคาร</label>
                                        <input className="form-input" style={{ borderRadius: 10 }} value={form.bank_account_number} onChange={e => setForm(p => ({ ...p, bank_account_number: e.target.value }))} placeholder="เช่น 123-4-56789-0" />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>เบอร์พร้อมเพย์ (PromptPay)</label>
                                        <input className="form-input" style={{ borderRadius: 10 }} value={form.promptpay_number} onChange={e => setForm(p => ({ ...p, promptpay_number: e.target.value }))} placeholder="เช่น 0812345678" />
                                    </div>
                                </div>
                            </div>

                            {error && <div className="alert alert-error">{error}</div>}
                            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>ยกเลิก</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <span className="spinner" /> : ' บันทึกข้อมูล'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(p => ({ ...p, isOpen: false }))}
                onConfirm={handleConfirmDeleteStaff}
                title={confirmConfig.title}
                message={confirmConfig.message}
                isLoading={saving}
            />

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
