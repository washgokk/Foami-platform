'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './discounts.module.css'
import { Ticket, Sparkles, Edit2, CheckCircle, AlertCircle, Trash2, Calendar, ClipboardList, Clock, RefreshCcw, CalendarRange, MapPin, RefreshCw, Info } from 'lucide-react'
import ConfirmModal from '@/components/Global/ConfirmModal'
import { trackAuditLog } from '@/lib/audit'

// B6 FIX: Accept optional branchId
export default function AdvancedDiscountsPage(props: any) {
    const branchId: string | undefined = props?.branchId
    const [codes, setCodes] = useState<any[]>([])
    const [segments, setSegments] = useState<any[]>([])
    const [branches, setBranches] = useState<any[]>([])
    const [zones, setZones] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        id: string;
        title: string;
        message: string;
    }>({ isOpen: false, id: '', title: '', message: '' })
    const [showModal, setShowModal] = useState(false)

    // Form state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        code: '',
        discount_type: 'percent',
        discount_value: '',
        max_discount_amount: '',
        max_uses: '10',
        max_uses_per_customer: '1',
        target_segment: 'all',
        expires_at: '',
        is_refund_code: false,
        // Condition fields
        usage_type: 'all' as 'all' | 'specific_days' | 'date_range',
        valid_days: [] as string[],
        valid_from: '',
        valid_until: '',
        allowed_branch_ids: [] as string[],
        allowed_zone_ids: [] as string[],
    })

    const loadData = async () => {
        setLoading(true)
        // Load CRM segments from local storage
        const savedSegments = JSON.parse(localStorage.getItem('crm_custom_segments') || '[]')
        setSegments(savedSegments)

        // Load discount codes
        let q = supabase.from('discount_codes').select('*').order('created_at', { ascending: false })
        if (branchId) q = q.eq('branch_id', branchId)
        const { data } = await q
        if (data) setCodes(data)

        // Load branches and zones
        const [brRes, znRes] = await Promise.all([
            supabase.from('branches').select('id, name').eq('is_active', true),
            supabase.from('zones').select('id, name, branch_id').eq('is_active', true),
        ])
        if (brRes.data) setBranches(brRes.data)
        if (znRes.data) setZones(znRes.data)

        setLoading(false)
    }

    useEffect(() => { loadData() }, [])

    useEffect(() => {
        const handleRefresh = () => loadData()
        window.addEventListener('foami:refresh', handleRefresh)
        return () => window.removeEventListener('foami:refresh', handleRefresh)
    }, [])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()

        const selectedSeg = segments.find(s => s.id === formData.target_segment);
        const targetValue = formData.target_segment === 'all' ? 'all' : (selectedSeg ? JSON.stringify(selectedSeg) : 'all');

        const payload = {
            code: formData.code.toUpperCase(),
            discount_type: formData.discount_type,
            discount_value: Number(formData.discount_value),
            max_discount_amount: formData.max_discount_amount ? Number(formData.max_discount_amount) : null,
            max_uses: formData.max_uses ? Number(formData.max_uses) : null,
            max_uses_per_customer: formData.max_uses_per_customer ? Number(formData.max_uses_per_customer) : null,
            target_segment: targetValue,
            expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
            is_active: true,
            is_refund_code: formData.is_refund_code,
            // Condition fields
            usage_type: formData.usage_type,
            valid_days: formData.usage_type === 'specific_days' && formData.valid_days.length > 0 ? formData.valid_days : null,
            valid_from: formData.usage_type === 'date_range' && formData.valid_from ? formData.valid_from : null,
            valid_until: formData.usage_type === 'date_range' && formData.valid_until ? formData.valid_until : null,
            allowed_branch_ids: formData.allowed_branch_ids.length > 0 ? formData.allowed_branch_ids : null,
            allowed_zone_ids: formData.allowed_zone_ids.length > 0 ? formData.allowed_zone_ids : null,
        }

        if (editingId) {
            const oldCode = codes.find(c => c.id === editingId)
            await supabase.from('discount_codes').update(payload).eq('id', editingId)
            
            await trackAuditLog({
                action_type: 'UPDATE',
                entity_type: 'discount_code',
                entity_id: editingId,
                old_data: oldCode,
                new_data: payload,
                description: `แก้ไขโค้ดส่วนลด: ${payload.code}`
            })
        } else {
            const { data: newCode } = await supabase.from('discount_codes').insert(payload).select().single()
            if (newCode) {
                await trackAuditLog({
                    action_type: 'CREATE',
                    entity_type: 'discount_code',
                    entity_id: newCode.id,
                    new_data: newCode,
                    description: `สร้างโค้ดส่วนลดใหม่: ${payload.code}`
                })
            }
        }

        resetForm()
        loadData()
        setShowModal(false)
    }

    const resetForm = () => {
        setEditingId(null)
        setFormData({
            code: '', discount_type: 'percent', discount_value: '',
            max_discount_amount: '100', max_uses: '10', max_uses_per_customer: '1',
            target_segment: 'all', expires_at: '', is_refund_code: false,
            usage_type: 'all', valid_days: [], valid_from: '', valid_until: '',
            allowed_branch_ids: [], allowed_zone_ids: [],
        })
    }

    const handleEdit = (code: any) => {
        setEditingId(code.id)

        let parsedSegmentId = 'all'
        if (code.target_segment && code.target_segment !== 'all') {
            try {
                const parsed = JSON.parse(code.target_segment)
                parsedSegmentId = parsed.id || 'all'
            } catch (e) {
                parsedSegmentId = code.target_segment
            }
        }

        setFormData({
            code: code.code,
            discount_type: code.discount_type,
            discount_value: code.discount_value.toString(),
            max_discount_amount: code.max_discount_amount?.toString() || '',
            max_uses: code.max_uses?.toString() || '',
            max_uses_per_customer: code.max_uses_per_customer?.toString() || '',
            target_segment: parsedSegmentId,
            expires_at: code.expires_at ? new Date(code.expires_at).toISOString().slice(0, 16) : '',
            is_refund_code: code.is_refund_code || false,
            usage_type: code.usage_type || 'all',
            valid_days: code.valid_days || [],
            valid_from: code.valid_from || '',
            valid_until: code.valid_until || '',
            allowed_branch_ids: code.allowed_branch_ids || [],
            allowed_zone_ids: code.allowed_zone_ids || [],
        })
        setShowModal(true)
    }

    const toggleBranch = (id: string) => {
        setFormData(prev => {
            const active = prev.allowed_branch_ids.includes(id)
            if (active) {
                const removedZones = zones.filter(z => z.branch_id === id).map((z: any) => z.id)
                return { ...prev, allowed_branch_ids: prev.allowed_branch_ids.filter(b => b !== id), allowed_zone_ids: prev.allowed_zone_ids.filter(z => !removedZones.includes(z)) }
            }
            return { ...prev, allowed_branch_ids: [...prev.allowed_branch_ids, id] }
        })
    }

    const toggleZone = (id: string) => {
        setFormData(prev => {
            const active = prev.allowed_zone_ids.includes(id)
            return { ...prev, allowed_zone_ids: active ? prev.allowed_zone_ids.filter(z => z !== id) : [...prev.allowed_zone_ids, id] }
        })
    }

    const visibleZones = formData.allowed_branch_ids.length > 0
        ? zones.filter(z => formData.allowed_branch_ids.includes(z.branch_id))
        : zones

    const toggleDay = (day: string) => {
        setFormData(prev => {
            const active = prev.valid_days.includes(day)
            return { ...prev, valid_days: active ? prev.valid_days.filter(d => d !== day) : [...prev.valid_days, day] }
        })
    }

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        const oldCode = codes.find(c => c.id === id)
        await supabase.from('discount_codes').update({ is_active: !currentStatus }).eq('id', id)
        
        await trackAuditLog({
            action_type: 'TOGGLE_STATUS',
            entity_type: 'discount_code',
            entity_id: id,
            old_data: oldCode,
            new_data: { is_active: !currentStatus },
            description: `${!currentStatus ? 'เปิด' : 'ปิด'}การใช้งานโค้ด: ${oldCode?.code || id}`
        })
        
        loadData()
    }

    const deleteCode = async (id: string) => {
        const c = codes.find(item => item.id === id)
        if (!c) return
        
        setConfirmConfig({
            isOpen: true,
            id: id,
            title: 'ยืนยันการลบโค้ดส่วนลด',
            message: `คุณแน่ใจหรือไม่ว่าต้องการลบโค้ด "${c.code}"? การลบนี้จะไม่สามารถย้อนคืนได้`
        })
    }

    const handleConfirmDelete = async () => {
        const id = confirmConfig.id
        const c = codes.find(item => item.id === id)
        if (!c) return

        setConfirmConfig(p => ({ ...p, isOpen: false }))
        setSaving(true)
        
        try {
            const { error: delError } = await supabase.from('discount_codes').delete().eq('id', id)
            if (delError) {
                if (delError.code === '23503') {
                    alert('ไม่สามารถลบโค้ดนี้ได้ เนื่องจากมีการนำไปใช้งานในรายการจองแล้ว\n\nกรุณาปิดการใช้งาน (Deactivate) แทนการลบเพื่อรักษาประวัติข้อมูล')
                } else {
                    throw delError
                }
                setSaving(false)
                return
            }
            
            await trackAuditLog({
                action_type: 'DELETE',
                entity_type: 'discount_code',
                entity_id: id,
                old_data: c,
                description: `ลบโค้ดส่วนลด: ${c.code}`
            })
            
            loadData()
            alert('ลบโค้ดส่วนลดเรียบร้อยแล้ว')
        } catch (err: any) {
            alert('เกิดข้อผิดพลาดในการลบ: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className={styles.page}>
            <div className="page-header animate-fade">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Ticket size={28} color="var(--brand-dominant)" /> จัดการโค้ดส่วนลด
                    </h1>
                    <p className="page-subtitle">จัดการส่วนลด กำหนดกลุ่มเป้าหมาย และสิทธิ์การใช้งาน</p>
                </div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>+ เพิ่มโค้ด</button>
            </div>

            {/* List Full Width */}
            <div className={`card ${styles.card} animate-fade`} style={{ border: 'none' }}>
                {loading ? (
                    <div className="empty-state"><div className="spinner" /></div>
                ) : codes.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-state-title">ยังไม่มีโค้ดส่วนลด</span>
                    </div>
                ) : (
                    <div className={styles.codeList}>
                        {codes.map(c => (
                            <div key={c.id} className={styles.codeItem} style={{ opacity: c.is_active ? 1 : 0.6 }}>
                                <div className={styles.codeItemLeft}>
                                    <div className={styles.codeName} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {c.code}
                                        {c.is_refund_code && (
                                            <span style={{ fontSize: '0.65rem', padding: '2px 7px', background: '#7C3AED', color: 'white', borderRadius: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <RefreshCcw size={10} /> Rebooking
                                            </span>
                                        )}
                                        {c.usage_type === 'specific_days' && c.valid_days?.length > 0 && (
                                            <span style={{ fontSize: '0.65rem', padding: '2px 7px', background: '#e0f2fe', color: '#0284c7', borderRadius: 20, fontWeight: 700 }}>ทุกวัน {c.valid_days.join(', ')}</span>
                                        )}
                                        {c.usage_type === 'date_range' && (
                                            <span style={{ fontSize: '0.65rem', padding: '2px 7px', background: '#fef3c7', color: '#d97706', borderRadius: 20, fontWeight: 700 }}>เฉพาะช่วงเวลา</span>
                                        )}
                                    </div>
                                    <div className={styles.codeDetails}>
                                        ลด {c.discount_value}{c.discount_type === 'percent' ? '%' : '฿'}
                                        {c.max_discount_amount && ` (สูงสุด ฿${c.max_discount_amount})`}
                                    </div>
                                    <div className={styles.codeDetails}>
                                        ใครใช้ได้: {c.target_segment === 'all' ? 'ทุกคน' : segments.find(s => s.id === (JSON.parse(c.target_segment || '{}').id || c.target_segment))?.name || 'เฉพาะกลุ่ม'}
                                    </div>
                                    <div className={styles.codeDetails}>
                                        สิทธิ์ต่อคน: <strong style={{ color: 'var(--primary)' }}>{c.max_uses_per_customer || 'ไม่จำกัด'}</strong>
                                    </div>
                                    {/* Condition badges */}
                                    {(c.valid_from || c.valid_until || c.allowed_branch_ids?.length || c.allowed_zone_ids?.length) && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                            {c.usage_type === 'date_range' && (c.valid_from || c.valid_until) && (
                                                <span style={{ fontSize: '0.65rem', padding: '2px 7px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 20, fontWeight: 600 }}>
                                                    {c.valid_from ? c.valid_from : 'เริ่มใช้งานได้ทันที'} 
                                                    {c.valid_until ? ` ถึง ${c.valid_until}` : ' (ไม่มีวันสิ้นสุดแคมเปญ)'}
                                                </span>
                                            )}
                                            {c.allowed_branch_ids?.length > 0 && <span style={{ fontSize: '0.65rem', padding: '2px 7px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 20, fontWeight: 600 }}>เฉพาะ {c.allowed_branch_ids.length} สาขา</span>}
                                            {c.allowed_zone_ids?.length > 0 && <span style={{ fontSize: '0.65rem', padding: '2px 7px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 20, fontWeight: 600 }}>เฉพาะ {c.allowed_zone_ids.length} โซน</span>}
                                        </div>
                                    )}
                                    {(() => {
                                        const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
                                        const isFull = c.max_uses && (c.used_count || 0) >= c.max_uses;
                                        const isUsable = c.is_active && !isExpired && !isFull;
                                        const statusColor = isUsable ? 'var(--success)' : 'var(--danger)';

                                        return (
                                            <>
                                                <div style={{ fontSize: '0.75rem', color: isUsable ? 'var(--text-muted)' : 'var(--danger)', marginTop: 4 }}>
                                                    ใช้ไป: <strong style={{ color: statusColor }}>{c.used_count || 0} / {c.max_uses || '∞'}</strong> สิทธิ์
                                                </div>
                                                {c.expires_at && (
                                                    <div style={{ fontSize: '0.75rem', color: isUsable ? 'var(--text-muted)' : 'var(--danger)', marginTop: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Clock size={12} /> หมดอายุ: <span style={{ color: statusColor }}>{new Date(c.expires_at).toLocaleDateString('th-TH', { 
                                                            year: 'numeric', month: 'short', day: 'numeric', 
                                                            hour: '2-digit', minute: '2-digit' 
                                                        })}</span>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>

                                <div className={styles.codeItemRight}>
                                    <div className={`${styles.codeStatus} ${c.is_active ? styles.statusActive : styles.statusInactive}`}>
                                        {c.is_active ? <><CheckCircle size={14} style={{ marginRight: 4 }} /> ใช้งานอยู่</> : <><AlertCircle size={14} style={{ marginRight: 4 }} /> ปิดใช้งาน</>}
                                    </div>
                                    <div className={styles.codeActions}>
                                        <button className="btn btn-outline btn-sm" style={{ padding: '4px 8px' }} onClick={() => toggleStatus(c.id, c.is_active)}>
                                            {c.is_active ? 'ปิด' : 'เปิด'}
                                        </button>
                                         <button className="btn btn-outline btn-sm" style={{ padding: '4px 8px' }} onClick={() => handleEdit(c)}>
                                             <Edit2 size={14} />
                                         </button>
                                         <button className="btn-delete-premium" onClick={() => deleteCode(c.id)} title="ลบโค้ด">
                                             <Trash2 size={16} />
                                         </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Overlay for Form */}
            {showModal && (
                <div className="overlay" onClick={() => setShowModal(false)} style={{ zIndex: 999 }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                {editingId ? <><Edit2 size={20} color="var(--brand-dominant)" /> แก้ไขโค้ดส่วนลด</> : <><Sparkles size={20} color="var(--brand-dominant)" /> สร้างโค้ดส่วนลด</>}
                        </h2>

                        <form onSubmit={handleSave}>
                            <div className={styles.formGrid}>
                                <div className={styles.formRow}>
                                    <label className={styles.label}>รหัสคูปอง (Code)</label>
                                    <input required className={styles.input} style={{ textTransform: 'uppercase', fontWeight: 800, fontSize: '1.2rem', letterSpacing: 2 }} placeholder="เช่น SUMMER20" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
                                </div>

                                <div>
                                    <label className={styles.label}>ประเภทส่วนลด</label>
                                    <select className={styles.input} value={formData.discount_type} onChange={e => setFormData({ ...formData, discount_type: e.target.value })}>
                                        <option value="percent">เปอร์เซ็นต์ (%)</option>
                                        <option value="fixed">ราคาเต็ม (บาท)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={styles.label}>มูลค่า ({formData.discount_type === 'percent' ? '%' : 'บาท'})</label>
                                    <input required type="number" className={styles.input} placeholder="เช่น 20" value={formData.discount_value} onChange={e => setFormData({ ...formData, discount_value: e.target.value })} />
                                </div>

                                {formData.discount_type === 'percent' && (
                                    <div className={styles.formRow}>
                                        <label className={styles.label}>ลดสูงสุดไม่เกิน (บาท) *ถ้ามี</label>
                                        <input type="number" className={styles.input} placeholder="เช่น 100" value={formData.max_discount_amount} onChange={e => setFormData({ ...formData, max_discount_amount: e.target.value })} />
                                    </div>
                                )}

                                <div>
                                    <label className={styles.label}>จำนวนสิทธิ์รวมทั้งหมด (ครั้ง)</label>
                                    <input type="number" className={styles.input} placeholder="ไม่มีจำกัดให้เว้นว่าง" value={formData.max_uses} onChange={e => setFormData({ ...formData, max_uses: e.target.value })} />
                                </div>
                                <div>
                                    <label className={styles.label}>สิทธิ์การใช้ต่อคน (คนละกี่ครั้ง)</label>
                                    <input type="number" className={styles.input} placeholder="ไม่มีจำกัดให้เว้นว่าง" value={formData.max_uses_per_customer} onChange={e => setFormData({ ...formData, max_uses_per_customer: e.target.value })} />
                                </div>

                                <div className={styles.formRow}>
                                    <label className={styles.label}>แจกโค้ดนี้ให้ใครบ้าง? (Target Segment)</label>
                                    <select required className={styles.input} value={formData.target_segment} onChange={e => setFormData({ ...formData, target_segment: e.target.value })}>
                                        <option value="all">แจกทุกคน (ใช้ได้หมด)</option>
                                        {segments.length > 0 && (
                                            <optgroup label="ลูกค้ากลุ่มเจาะจง (CRM Segments)">
                                                {segments.map(seg => (
                                                    <option key={seg.id} value={seg.id}>{seg.name}</option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                        *สามารถสร้าง Segment ใหม่ๆ ได้ที่เมนู CRM &amp; ลูกค้า
                                    </p>
                                </div>

                                <div className={styles.formRow}>
                                    <label className={styles.label}>วันหมดอายุคูปอง (ตัวคูปองหลัก)</label>
                                    <input 
                                        type="datetime-local" 
                                        className={styles.input} 
                                        value={formData.expires_at} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData(p => ({ 
                                                ...p, 
                                                expires_at: val,
                                                ...(p.usage_type === 'date_range' && val ? { valid_until: val.split('T')[0] } : {}) 
                                            }))
                                        }} 
                                    />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                        *หากไม่กำหนด คูปองนี้จะใช้ได้ตลอดไปจนกว่าจะปิดใช้งาน หรือจนกว่าจะถึงวันที่สิ้นสุดเงื่อนไข
                                    </p>
                                </div>

                                {/* ── CONDITION SECTION ── */}
                                <div className={styles.formRow} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 12, padding: '20px' }}>
                                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: '1rem' }}>
                                        <CalendarRange size={18} /> เงื่อนไขการใช้งาน
                                    </div>

                                    {/* Usage type */}
                                    <div style={{ marginBottom: 24 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            ช่วงเวลาที่ใช้ได้
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {([
                                                ['all', 'ใช้ได้ทุกวัน (ไม่จำกัดเวลา)'],
                                                ['specific_days', 'เฉพาะบางวันในสัปดาห์ (เช่น ทุกวันเสาร์-อาทิตย์)'],
                                                ['date_range', 'เฉพาะช่วงวันที่กำหนด (เช่น 1-30 พ.ย.)']
                                            ] as const).map(([val, label]) => (
                                                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: formData.usage_type === val ? '1.5px solid var(--brand-dominant)' : '1px solid var(--border)', background: formData.usage_type === val ? 'var(--primary-ghost)' : 'white', transition: 'all 0.15s' }}>
                                                    <input 
                                                        type="radio" 
                                                        name="usage_type" 
                                                        value={val} 
                                                        checked={formData.usage_type === val} 
                                                        onChange={(e) => setFormData(p => ({ ...p, usage_type: e.target.value as any }))}
                                                        style={{ accentColor: 'var(--brand-dominant)', width: 16, height: 16 }}
                                                    />
                                                    <span style={{ fontSize: '0.85rem', fontWeight: formData.usage_type === val ? 700 : 500, color: formData.usage_type === val ? 'var(--brand-dominant)' : 'var(--text-primary)' }}>
                                                        {label}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Specific Days Picker */}
                                    {formData.usage_type === 'specific_days' && (
                                        <div style={{ marginBottom: 24, padding: '16px', background: 'white', borderRadius: 8, border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>เลือกวันที่อนุญาตให้ใช้โค้ดส่วนลดนี้ได้</div>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'].map(day => {
                                                    const active = formData.valid_days.includes(day);
                                                    return (
                                                        <button 
                                                            key={day} 
                                                            type="button" 
                                                            onClick={() => toggleDay(day)} 
                                                            style={{
                                                                padding: '6px 16px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600,
                                                                border: active ? '1.5px solid var(--brand-dominant)' : '1px solid var(--border)',
                                                                background: active ? 'var(--brand-dominant)' : 'var(--surface)',
                                                                color: active ? 'white' : 'var(--text-secondary)',
                                                                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                                                            }}
                                                        >
                                                            {day}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                            <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px dashed #cbd5e1', fontSize: '0.75rem', color: '#475569', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                                <Info size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--brand-dominant)' }} />
                                                <span>
                                                    <strong>อธิบายเพิ่มเติม:</strong> โหมดนี้คูปองจะใช้ได้ <u>ทุกสัปดาห์</u> ในวันที่เลือก จนกว่าจะถึง "วันหมดอายุคูปอง" ด้านบน<br/>
                                                    หากต้องการให้ใช้ได้ <strong>วันเดียวเท่านั้น (ไม่ทำซ้ำ)</strong> เช่น วันเสาร์ที่ 14 พ.ย. วันเดียว กรุณาเลือก <b>"เฉพาะช่วงวันที่กำหนด"</b> ด้านล่าง แล้วตั้งวันที่เริ่มต้น-สิ้นสุด เป็นวันเดียวกันแทน
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Date range */}
                                    {formData.usage_type === 'date_range' && (
                                        <div style={{ marginBottom: 24, padding: '16px', background: 'white', borderRadius: 8, border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>วันที่เริ่มต้น</div>
                                                    <input type="date" className={styles.input} value={formData.valid_from} onChange={e => setFormData(p => ({ ...p, valid_from: e.target.value }))} style={{ fontSize: '0.85rem' }} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>วันที่สิ้นสุดแคมเปญ</div>
                                                    <input 
                                                        type="date" 
                                                        className={styles.input} 
                                                        value={formData.valid_until} 
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setFormData(p => ({ 
                                                                ...p, 
                                                                valid_until: val,
                                                                expires_at: val ? `${val}T23:59` : p.expires_at
                                                            }))
                                                        }} 
                                                        style={{ fontSize: '0.85rem' }} 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />

                                    {/* Branch chips */}
                                    <div style={{ marginBottom: 20 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span>จำกัดสาขาที่ใช้งานได้</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                                                {formData.allowed_branch_ids.length === 0 ? 'อนุญาตทุกสาขา' : `เลือกแล้ว ${formData.allowed_branch_ids.length} สาขา`}
                                            </span>
                                        </div>
                                        {branches.length === 0 ? (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>กำลังโหลดสาขา...</div>
                                        ) : (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                {branches.map(b => {
                                                    const active = formData.allowed_branch_ids.includes(b.id)
                                                    return (
                                                        <button key={b.id} type="button" onClick={() => toggleBranch(b.id)} style={{
                                                            padding: '6px 14px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 500,
                                                            border: active ? '1.5px solid var(--brand-dominant)' : '1px solid var(--border)',
                                                            background: active ? 'var(--primary-ghost)' : 'white',
                                                            color: active ? 'var(--brand-dominant)' : 'var(--text-primary)',
                                                            cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                                                        }}>{b.name}</button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Zone chips */}
                                    {visibleZones.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span>จำกัดโซน (ย่อยจากสาขา)</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                                                    {formData.allowed_zone_ids.length === 0 ? 'อนุญาตทุกโซน' : `เลือกแล้ว ${formData.allowed_zone_ids.length} โซน`}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 150, overflowY: 'auto' }}>
                                                {visibleZones.map((z: any) => {
                                                    const active = formData.allowed_zone_ids.includes(z.id)
                                                    return (
                                                        <button key={z.id} type="button" onClick={() => toggleZone(z.id)} style={{
                                                            padding: '6px 14px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 500,
                                                            border: active ? '1.5px solid #7C3AED' : '1px solid var(--border)',
                                                            background: active ? 'rgba(124, 58, 237, 0.05)' : 'white',
                                                            color: active ? '#7C3AED' : 'var(--text-primary)',
                                                            cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                                                        }}>{z.name}</button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Rebooking Code Toggle */}
                                <div className={styles.formRow} style={{ background: 'rgba(124,58,237,0.06)', border: '1.5px solid rgba(124,58,237,0.2)', borderRadius: 12, padding: '14px 16px' }}>
                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_refund_code}
                                            onChange={e => setFormData({ ...formData, is_refund_code: e.target.checked })}
                                            style={{ marginTop: 3, width: 16, height: 16, accentColor: '#7C3AED', cursor: 'pointer' }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <RefreshCcw size={14} /> โค้ดจองใหม่ทดแทน (Rebooking Code)
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
                                                เมื่อติ๊ก: ส่วนลดจะคำนวณจาก <strong>ยอดรวมทั้งหมด</strong> (แพ็กเกจ + ค่าเดินทาง + บริการเสริม)
                                                เหมาะสำหรับให้ลูกค้าที่เคยโดนตัดเงินแล้วแต่การจองไม่สำเร็จ ให้จองใหม่ได้เลย
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                <div className={styles.formRow} style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-3)' }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ flex: 1 }}>ยกเลิก</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>{editingId ? 'บันทึกการแก้ไข' : 'สร้างคูปองใหม่'}</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(p => ({ ...p, isOpen: false }))}
                onConfirm={handleConfirmDelete}
                title={confirmConfig.title}
                message={confirmConfig.message}
                isLoading={saving}
            />
        </div>
    )
}
