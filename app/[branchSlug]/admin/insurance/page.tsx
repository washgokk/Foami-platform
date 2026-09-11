'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Shield, MapPin, Car, CheckCircle2, Clock, AlertTriangle, Truck, XCircle, Phone } from 'lucide-react'

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
    picked_up:    'at_transport',  // only if needs_inspection
    at_transport: 'processing',
    processing:   'completed',
}

export default function InsurancePage() {
    const { branchSlug } = useParams() as { branchSlug: string }
    // use global supabase proxy
    const [renewals, setRenewals] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeFilter, setActiveFilter] = useState('all')
    const [selected, setSelected] = useState<any>(null)
    const [staffNote, setStaffNote] = useState('')
    const [remainingAmt, setRemainingAmt] = useState('')

    const load = async () => {
        setLoading(true)
        const { data: branch } = await supabase.from('branches').select('id').eq('slug', branchSlug).single()
        if (!branch) { setLoading(false); return }

        const res = await fetch(`/api/insurance?branch_id=${branch.id}`)
        const data = await res.json()
        setRenewals(data.renewals || [])
        setLoading(false)
    }

    useEffect(() => { load() }, [branchSlug])

    const handleStatusUpdate = async (renewal: any, nextStatus: string) => {
        const updates: any = { id: renewal.id, status: nextStatus }
        if (staffNote) updates.staff_note = staffNote
        if (remainingAmt) updates.remaining_amount = Number(remainingAmt)
        await fetch('/api/insurance', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
        setSelected(null); setStaffNote(''); setRemainingAmt('')
        load()
    }

    const filtered = renewals.filter(r => activeFilter === 'all' || r.status === activeFilter)
    const counts: Record<string, number> = {}
    renewals.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1 })

    return (
        <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <Shield size={28} color="#315EC3" />
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>ต่อพรบ / ประกันภัย</h1>
                    <div style={{ fontSize: 13, color: '#7E8BAA' }}>จัดการคำขอต่อพรบและประกันรถยนต์</div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {['all', 'pending', 'confirmed', 'picked_up', 'at_transport', 'processing', 'completed', 'cancelled'].map(s => {
                    const cfg = s === 'all' ? { label: 'ทั้งหมด', color: '#315EC3' } : STATUS_CONFIG[s]
                    const count = s === 'all' ? renewals.length : (counts[s] || 0)
                    return (
                        <button key={s} onClick={() => setActiveFilter(s)} style={{
                            padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
                            borderColor: activeFilter === s ? cfg.color : '#E2E8F0',
                            background: activeFilter === s ? cfg.color + '15' : '#fff',
                            color: activeFilter === s ? cfg.color : '#7E8BAA',
                            fontWeight: 700, fontSize: 13, cursor: 'pointer'
                        }}>
                            {cfg.label} {count > 0 && `(${count})`}
                        </button>
                    )
                })}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>กำลังโหลด...</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60 }}>
                    <Shield size={48} color="#CBD5E1" />
                    <div style={{ marginTop: 12, color: '#94A3B8' }}>ยังไม่มีรายการต่อพรบ</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtered.map(r => {
                        const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending
                        const Icon = cfg.icon
                        const nextStatus = STATUS_FLOW[r.status]
                        // If needs_inspection skip at_transport for non-inspection cases
                        const actualNext = r.needs_inspection ? nextStatus : (r.status === 'picked_up' ? 'processing' : nextStatus)

                        return (
                            <div key={r.id} onClick={() => { setSelected(r); setStaffNote(r.staff_note || ''); setRemainingAmt(r.remaining_amount?.toString() || '') }}
                                style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: 20, cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(49,94,195,0.08)')}
                                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Car size={18} color="#315EC3" />
                                            <strong style={{ fontSize: 16 }}>{r.license_plate}</strong>
                                            <span style={{ fontSize: 13, color: '#7E8BAA' }}>{r.vehicle_brand} {r.vehicle_model}</span>
                                        </div>
                                        {r.needs_inspection && (
                                            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, color: '#F59E0B', fontSize: 13, fontWeight: 600 }}>
                                                <AlertTriangle size={14} /> ต้องนำไปตรวจที่ขนส่ง
                                            </div>
                                        )}
                                        {r.pickup_address && (
                                            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: 13 }}>
                                                <MapPin size={13} /> {r.pickup_address}
                                            </div>
                                        )}
                                        <div style={{ marginTop: 4, fontSize: 13, color: '#64748B' }}>
                                            📅 {r.scheduled_date} {r.scheduled_time?.slice(0,5) || ''}
                                            &nbsp;·&nbsp; ค่าบริการ ฿{r.service_fee?.toLocaleString()}
                                            {r.remaining_amount > 0 && <span style={{ color: '#EF4444' }}> + ฿{r.remaining_amount?.toLocaleString()} (ค้าง)</span>}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: cfg.color + '15', color: cfg.color, borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>
                                            <Icon size={14} /> {cfg.label}
                                        </div>
                                        {actualNext && (
                                            <button onClick={e => { e.stopPropagation(); handleStatusUpdate(r, actualNext) }} style={{
                                                display: 'block', marginTop: 8, padding: '6px 14px', borderRadius: 12,
                                                background: '#315EC3', color: '#fff', border: 'none', cursor: 'pointer',
                                                fontSize: 12, fontWeight: 700
                                            }}>
                                                → {STATUS_CONFIG[actualNext]?.label}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Detail Modal */}
            {selected && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
                    onClick={() => setSelected(null)}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: 28, width: '100%', maxWidth: 600, maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>รายละเอียด — {selected.license_plate}</div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            {[
                                ['ยี่ห้อ/รุ่น', `${selected.vehicle_brand} ${selected.vehicle_model}`],
                                ['ปีรถ', selected.vehicle_year || '—'],
                                ['รถอายุเกิน 5 ปี', selected.vehicle_age_over_5 ? '✅ ใช่' : '❌ ไม่'],
                                ['ขาดต่อภาษี', selected.tax_expired ? `ใช่ (${selected.tax_expired_years} ปี)` : 'ไม่ขาด'],
                                ['ต้องตรวจขนส่ง', selected.needs_inspection ? '⚠️ ต้อง' : 'ไม่ต้อง'],
                                ['ค่าบริการ', `฿${selected.service_fee?.toLocaleString()}`],
                                ['มัดจำชำระแล้ว', selected.deposit_paid ? '✅' : '⏳ ยังไม่ชำระ'],
                            ].map(([k, v]) => (
                                <div key={k as string} style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 14px' }}>
                                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{k as string}</div>
                                    <div style={{ fontWeight: 700, marginTop: 2 }}>{v as string}</div>
                                </div>
                            ))}
                        </div>

                        {selected.customer_note && (
                            <div style={{ background: '#FEF3C7', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>หมายเหตุลูกค้า</div>
                                <div style={{ fontSize: 13, marginTop: 4 }}>{selected.customer_note}</div>
                            </div>
                        )}

                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>หมายเหตุพนักงาน</label>
                            <textarea value={staffNote} onChange={e => setStaffNote(e.target.value)} rows={3}
                                style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', fontSize: 14, resize: 'none', boxSizing: 'border-box' }} />
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 }}>ยอดที่เหลือ (ชำระหลัง — ค่าภาษี/พรบจริง)</label>
                            <input type="number" value={remainingAmt} onChange={e => setRemainingAmt(e.target.value)} placeholder="0"
                                style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box' }} />
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            {STATUS_FLOW[selected.status] && (
                                <button onClick={() => handleStatusUpdate(selected, STATUS_FLOW[selected.status])} style={{
                                    flex: 1, padding: '14px', background: '#315EC3', color: '#fff',
                                    border: 'none', borderRadius: 14, fontWeight: 800, fontSize: 15, cursor: 'pointer'
                                }}>
                                    → {STATUS_CONFIG[STATUS_FLOW[selected.status]]?.label || STATUS_FLOW[selected.status]}
                                </button>
                            )}
                            <button onClick={() => setSelected(null)} style={{
                                flex: 1, padding: '14px', background: '#F1F5F9', color: '#1A2340',
                                border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer'
                            }}>
                                ปิด
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}