'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Shield, MapPin, Car, CheckCircle2, Clock, AlertTriangle, Truck, XCircle, Phone, Lock, ChevronRight, MessageSquare, AlertCircle, Zap, Store, Info, X } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    pending:      { label: 'รอยืนยัน',         color: '#F59E0B', icon: Clock },
    confirmed:    { label: 'ยืนยันแล้ว',        color: '#3B82F6', icon: CheckCircle2 },
    picked_up:    { label: 'รับเอกสารแล้ว',     color: '#8B5CF6', icon: Car },
    at_transport: { label: 'กำลังไปขนส่ง',      color: '#EC4899', icon: Truck },
    processing:   { label: 'กำลังดำเนินการ',     color: '#6366F1', icon: Clock },
    completed:    { label: 'เสร็จสิ้น',          color: '#10B981', icon: CheckCircle2 },
    cancelled:    { label: 'ยกเลิก',            color: '#EF4444', icon: XCircle },
}

const STATUS_FLOW: Record<string, string> = {
    pending:      'confirmed',
    confirmed:    'picked_up',
    picked_up:    'at_transport',
    at_transport: 'processing',
    processing:   'completed',
}

export default function AdminInsurancePage() {
    const [branch, setBranch] = useState<any>(null)
    const [renewals, setRenewals] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeFilter, setActiveFilter] = useState('all')
    const [selected, setSelected] = useState<any>(null)
    const [staffNote, setStaffNote] = useState('')
    const [remainingAmt, setRemainingAmt] = useState('')
    const [updating, setUpdating] = useState(false)

    const load = async () => {
        setLoading(true)
        try {
            // Get current branch
            const { data: branches } = await supabase.from('branches').select('*').order('created_at').limit(1)
            const b = branches?.[0]
            if (!b) {
                setLoading(false)
                return
            }
            const feat = (b.features && typeof b.features === 'object') ? b.features : {}
            const hasInsurance = Boolean(feat.insurance_renewal ?? feat.has_insurance ?? b.has_insurance)
            const enrichedBranch = { ...b, has_insurance: hasInsurance }
            setBranch(enrichedBranch)

            if (hasInsurance) {
                const res = await fetch(`/api/insurance?branch_id=${b.id}`)
                const data = await res.json()
                setRenewals(data.renewals || [])
            }
        } catch (e) {
            console.error('Failed to load insurance data:', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const handleStatusUpdate = async (renewal: any, nextStatus: string) => {
        setUpdating(true)
        const updates: any = { id: renewal.id, status: nextStatus }
        if (staffNote) updates.staff_note = staffNote

        try {
            await fetch('/api/insurance', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            })
            await load()
            if (selected?.id === renewal.id) {
                setSelected((prev: any) => ({ ...prev, status: nextStatus, staff_note: staffNote || prev.staff_note }))
            }
        } finally {
            setUpdating(false)
        }
    }

    const handlePaymentUpdate = async (renewal: any, type: 'deposit' | 'remaining') => {
        setUpdating(true)
        const updates: any = { id: renewal.id }
        if (type === 'deposit') {
            updates.deposit_paid = true
        } else {
            updates.remaining_paid = true
            if (remainingAmt) updates.remaining_amount = Number(remainingAmt)
        }

        try {
            await fetch('/api/insurance', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            })
            await load()
            if (selected?.id === renewal.id) {
                setSelected((prev: any) => ({ ...prev, ...updates }))
            }
        } finally {
            setUpdating(false)
        }
    }

    const filtered = renewals.filter(r => {
        if (activeFilter === 'all') return true
        if (activeFilter === 'needs_action') return ['pending', 'confirmed', 'picked_up', 'at_transport', 'processing'].includes(r.status)
        if (activeFilter === 'needs_inspection') return r.needs_inspection && r.status !== 'completed'
        return r.status === activeFilter
    })

    const counts = {
        all: renewals.length,
        needs_action: renewals.filter(r => ['pending', 'confirmed', 'picked_up', 'at_transport', 'processing'].includes(r.status)).length,
        needs_inspection: renewals.filter(r => r.needs_inspection && r.status !== 'completed').length,
        completed: renewals.filter(r => r.status === 'completed').length,
    }

    if (loading) {
        return (
            <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                <div className="spinner" />
            </div>
        )
    }

    // If branch doesn't have insurance enabled by Super Admin
    if (!branch?.has_insurance) {
        return (
            <div style={{ padding: '32px 24px', maxWidth: 800, margin: '0 auto' }}>
                <div style={{
                    background: '#FFFFFF',
                    borderRadius: 20,
                    border: '1.5px solid #E2E8F0',
                    padding: '40px 32px',
                    textAlign: 'center',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
                }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: 20,
                        background: '#FEF3C7',
                        color: '#D97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px'
                    }}>
                        <Lock size={32} />
                    </div>

                    <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', marginBottom: 10 }}>
                        ฟีเจอร์นี้ยังไม่เปิดใช้งานสำหรับสาขาของคุณ
                    </h2>

                    <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, maxWidth: 500, margin: '0 auto 24px' }}>
                        ระบบต่อ พ.ร.บ. & ประกันภัย ต้องได้รับการเปิดสิทธิ์จาก <strong>Platform Super Admin</strong> ก่อน เพื่อความถูกต้องตามมาตรฐานและเงื่อนไขการเป็น Partner ของ Foami
                    </p>

                    <div style={{
                        background: '#F8FAFC',
                        borderRadius: 12,
                        padding: '16px 20px',
                        border: '1px solid #E2E8F0',
                        fontSize: 13,
                        color: '#475569',
                        display: 'inline-block',
                        textAlign: 'left',
                        marginBottom: 24
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Store size={14} style={{ color: '#315EC3' }} /> <strong>สาขา:</strong> {branch?.name || 'ไม่พบข้อมูลสาขา'}</div>
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Info size={14} style={{ color: '#D97706' }} /> <strong>สถานะปัจจุบัน:</strong> <span style={{ color: '#D97706', fontWeight: 700 }}>รอการอนุมัติสิทธิ์ พ.ร.บ.</span></div>
                    </div>

                    <div>
                        <a
                            href="mailto:washgo.kk@gmail.com?subject=ขอเปิดสิทธิ์ฟีเจอร์พ.ร.บ.สำหรับสาขา"
                            className="btn btn-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 12, textDecoration: 'none' }}
                        >
                            <Shield size={16} /> ติดต่อขอเปิดสิทธิ์ใช้งาน
                        </a>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div style={{ padding: '24px 24px 60px', maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                        <Shield size={26} style={{ color: '#315EC3' }} /> ระบบจัดการ พ.ร.บ. & ประกันภัย
                    </h1>
                    <p style={{ fontSize: 13, color: '#64748B', marginTop: 4, margin: 0 }}>
                        รายการขอต่อ พ.ร.บ. และตรวจสภาพรถยนต์ของสาขา {branch.name}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={load} className="btn btn-ghost btn-sm" style={{ borderRadius: 8, gap: 6 }}>
                        รีเฟรช
                    </button>
                </div>
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                    { key: 'all', label: 'ทั้งหมด', icon: Shield, count: counts.all },
                    { key: 'needs_action', label: 'กำลังดำเนินการ', icon: Zap, count: counts.needs_action },
                    { key: 'needs_inspection', label: 'ต้องไปขนส่ง', icon: AlertTriangle, count: counts.needs_inspection },
                    { key: 'completed', label: 'เสร็จสิ้น', icon: CheckCircle2, count: counts.completed },
                ].map(f => {
                    const FilterIcon = f.icon
                    return (
                    <button
                        key={f.key}
                        onClick={() => setActiveFilter(f.key)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 20,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: activeFilter === f.key ? '1px solid #315EC3' : '1px solid #E2E8F0',
                            background: activeFilter === f.key ? '#315EC3' : '#FFFFFF',
                            color: activeFilter === f.key ? '#FFFFFF' : '#64748B',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}
                    >
                        <FilterIcon size={14} />
                        <span>{f.label}</span>
                        <span style={{
                            fontSize: 11,
                            padding: '1px 7px',
                            borderRadius: 99,
                            background: activeFilter === f.key ? 'rgba(255,255,255,0.25)' : '#F1F5F9',
                            color: activeFilter === f.key ? '#FFFFFF' : '#64748B'
                        }}>
                            {f.count}
                        </span>
                    </button>
                )})}
            </div>

            {/* List Table / Cards */}
            {filtered.length === 0 ? (
                <div style={{
                    background: '#FFFFFF',
                    borderRadius: 16,
                    border: '1px solid #E2E8F0',
                    padding: '48px 24px',
                    textAlign: 'center',
                    color: '#94A3B8'
                }}>
                    <Shield size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#64748B' }}>ไม่มีรายการต่อ พ.ร.บ. ในหมวดนี้</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>เมื่อมีลูกค้าส่งคำขอต่อ พ.ร.บ. รายการจะปรากฏที่นี่</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                    {filtered.map(r => {
                        const statusConf = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending
                        const StatusIcon = statusConf.icon
                        const nextStatus = STATUS_FLOW[r.status]

                        return (
                            <div
                                key={r.id}
                                style={{
                                    background: '#FFFFFF',
                                    borderRadius: 16,
                                    border: '1px solid #E2E8F0',
                                    padding: '18px 20px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 16,
                                    flexWrap: 'wrap'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 260 }}>
                                    <div style={{
                                        width: 46,
                                        height: 46,
                                        borderRadius: 12,
                                        background: `${statusConf.color}15`,
                                        color: statusConf.color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <StatusIcon size={22} />
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 16, fontWeight: 800, color: '#1E293B' }}>{r.license_plate}</span>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: 6,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                background: `${statusConf.color}20`,
                                                color: statusConf.color
                                            }}>
                                                {statusConf.label}
                                            </span>
                                            {r.needs_inspection && (
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: 6,
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    background: '#FEF3C7',
                                                    color: '#B45309',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 3
                                                }}>
                                                    <AlertTriangle size={11} /> ต้องตรวจขนส่ง
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>
                                            {r.vehicle_brand} {r.vehicle_model} {r.vehicle_year ? `(${r.vehicle_year})` : ''} · หมดอายุ: {r.current_expiry || '-'}
                                        </div>
                                    </div>
                                </div>

                                {/* Appointment & Payment Info */}
                                <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div style={{ fontSize: 13 }}>
                                        <div style={{ color: '#94A3B8', fontSize: 11 }}>นัดหมายรับเอกสาร</div>
                                        <div style={{ fontWeight: 700, color: '#334155' }}>
                                            {r.scheduled_date || '-'} {r.scheduled_time || ''}
                                        </div>
                                    </div>

                                    <div style={{ fontSize: 13 }}>
                                        <div style={{ color: '#94A3B8', fontSize: 11 }}>การชำระเงิน (2 งวด)</div>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <span style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: r.deposit_paid ? '#15803D' : '#D97706'
                                            }}>
                                                มัดจำ: {r.deposit_paid ? 'ชำระแล้ว' : 'รอชำระ'}
                                            </span>
                                            <span>·</span>
                                            <span style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: r.remaining_paid ? '#15803D' : '#64748B'
                                            }}>
                                                งวด 2: {r.remaining_paid ? 'ชำระแล้ว' : `฿${r.remaining_amount || 0}`}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            onClick={() => {
                                                setSelected(r)
                                                setStaffNote(r.staff_note || '')
                                                setRemainingAmt(r.remaining_amount?.toString() || '')
                                            }}
                                            className="btn btn-outline btn-sm"
                                            style={{ borderRadius: 8, gap: 4 }}
                                        >
                                            ดูรายละเอียด
                                        </button>

                                        {nextStatus && (
                                            <button
                                                onClick={() => handleStatusUpdate(r, nextStatus)}
                                                disabled={updating}
                                                className="btn btn-primary btn-sm"
                                                style={{ borderRadius: 8, gap: 4 }}
                                            >
                                                <span>เลื่อนเป็น {STATUS_CONFIG[nextStatus]?.label}</span>
                                                <ChevronRight size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Detail / Action Modal */}
            {selected && (
                <div className="overlay" onClick={() => setSelected(null)}>
                    <div className="modal" style={{ maxWidth: 620, width: '95vw', borderRadius: 20 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                            <div>
                                <span style={{
                                    padding: '3px 10px',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: `${STATUS_CONFIG[selected.status]?.color}20`,
                                    color: STATUS_CONFIG[selected.status]?.color
                                }}>
                                    {STATUS_CONFIG[selected.status]?.label}
                                </span>
                                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', marginTop: 8, margin: 0 }}>
                                    ทะเบียน: {selected.license_plate}
                                </h2>
                                <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
                                    {selected.vehicle_brand} {selected.vehicle_model} {selected.vehicle_year ? `(${selected.vehicle_year})` : ''}
                                </p>
                            </div>
                            <button className="btn btn-ghost btn-xs" onClick={() => setSelected(null)}><X size={16} /></button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, background: '#F8FAFC', padding: 16, borderRadius: 12, fontSize: 13 }}>
                            <div>
                                <div style={{ color: '#94A3B8', fontSize: 11 }}>วันหมดอายุ พ.ร.บ.</div>
                                <div style={{ fontWeight: 700, color: '#334155' }}>{selected.current_expiry || '-'}</div>
                            </div>
                            <div>
                                <div style={{ color: '#94A3B8', fontSize: 11 }}>ขาดต่อภาษี</div>
                                <div style={{ fontWeight: 700, color: selected.tax_expired ? '#B45309' : '#15803D' }}>
                                    {selected.tax_expired ? `ขาดต่อ ${selected.tax_expired_years || 0} ปี` : 'ไม่ขาด'}
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#94A3B8', fontSize: 11 }}>จุดรับเอกสาร</div>
                                <div style={{ fontWeight: 700, color: '#334155' }}>{selected.pickup_address || '-'}</div>
                            </div>
                            <div>
                                <div style={{ color: '#94A3B8', fontSize: 11 }}>วันเวลาที่นัด</div>
                                <div style={{ fontWeight: 700, color: '#334155' }}>{selected.scheduled_date || '-'} {selected.scheduled_time || ''}</div>
                            </div>
                        </div>

                        {/* Payment updater */}
                        <div style={{ marginBottom: 20, borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', marginBottom: 10 }}>
                                การชำระเงิน (แบ่ง 2 งวด)
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 10 }}>
                                    <div style={{ fontSize: 12, color: '#64748B' }}>งวดที่ 1: มัดจำ</div>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', margin: '4px 0' }}>
                                        ฿{selected.deposit_amount || 0}
                                    </div>
                                    {selected.deposit_paid ? (
                                        <span style={{ fontSize: 12, color: '#15803D', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> ชำระแล้ว</span>
                                    ) : (
                                        <button
                                            onClick={() => handlePaymentUpdate(selected, 'deposit')}
                                            disabled={updating}
                                            className="btn btn-primary btn-xs"
                                            style={{ marginTop: 6 }}
                                        >
                                            บันทึกว่าชำระแล้ว
                                        </button>
                                    )}
                                </div>

                                <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 10 }}>
                                    <div style={{ fontSize: 12, color: '#64748B' }}>งวดที่ 2: ชำระหลังจบงาน</div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                                        <input
                                            type="number"
                                            value={remainingAmt}
                                            onChange={e => setRemainingAmt(e.target.value)}
                                            placeholder="ระบุยอดหลังตรวจ"
                                            className="form-input"
                                            style={{ height: 32, fontSize: 13 }}
                                            disabled={selected.remaining_paid}
                                        />
                                    </div>
                                    {selected.remaining_paid ? (
                                        <span style={{ fontSize: 12, color: '#15803D', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}><CheckCircle2 size={13} /> ชำระแล้ว</span>
                                    ) : (
                                        <button
                                            onClick={() => handlePaymentUpdate(selected, 'remaining')}
                                            disabled={updating}
                                            className="btn btn-outline btn-xs"
                                            style={{ marginTop: 6 }}
                                        >
                                            บันทึกยอดชำระงวด 2
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Staff Note */}
                        <div style={{ marginBottom: 20 }}>
                            <label className="form-label" style={{ fontSize: 13, fontWeight: 700 }}>โน้ตของทีมงาน</label>
                            <textarea
                                value={staffNote}
                                onChange={e => setStaffNote(e.target.value)}
                                placeholder="บันทึกรายละเอียด เช่น วันที่ส่งเอกสารที่ขนส่ง หรือเลขที่ใบรับรอง..."
                                className="form-input"
                                rows={2}
                                style={{ fontSize: 13 }}
                            />
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
                            <button className="btn btn-ghost" onClick={() => setSelected(null)}>ปิด</button>
                            <button
                                className="btn btn-primary"
                                disabled={updating}
                                onClick={async () => {
                                    setUpdating(true)
                                    try {
                                        await fetch('/api/insurance', {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ id: selected.id, staff_note: staffNote })
                                        })
                                        await load()
                                        setSelected(null)
                                    } finally {
                                        setUpdating(false)
                                    }
                                }}
                            >
                                บันทึกข้อมูล
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
