'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './discounts.module.css'

export default function AdvancedDiscountsPage() {
    const [codes, setCodes] = useState<any[]>([])
    const [segments, setSegments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
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
        expires_at: ''
    })

    const loadData = async () => {
        setLoading(true)
        // Load CRM segments from local storage
        const savedSegments = JSON.parse(localStorage.getItem('crm_custom_segments') || '[]')
        setSegments(savedSegments)

        // Load discount codes
        const { data } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false })
        if (data) setCodes(data)
        setLoading(false)
    }

    useEffect(() => { loadData() }, [])

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
            is_active: true
        }

        if (editingId) {
            await supabase.from('discount_codes').update(payload).eq('id', editingId)
        } else {
            await supabase.from('discount_codes').insert(payload)
        }

        resetForm()
        loadData()
        setShowModal(false)
    }

    const resetForm = () => {
        setEditingId(null)
        setFormData({
            code: '', discount_type: 'percent', discount_value: '',
            max_discount_amount: '', max_uses: '10', max_uses_per_customer: '1',
            target_segment: 'all', expires_at: ''
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
            expires_at: code.expires_at ? new Date(code.expires_at).toISOString().slice(0, 16) : ''
        })
        setShowModal(true)
    }

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        await supabase.from('discount_codes').update({ is_active: !currentStatus }).eq('id', id)
        loadData()
    }

    return (
        <div className={styles.page}>
            <div className="page-header animate-fade">
                <div>
                    <h1 className="page-title">🎫 จัดการโค้ดส่วนลด (Advanced)</h1>
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
                                    <div className={styles.codeName}>{c.code}</div>
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
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                        ใช้ไป {c.used_count || 0} / {c.max_uses || '∞'} สิทธิ์
                                    </div>
                                    {c.expires_at && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: 2, fontWeight: 600 }}>
                                            ⏳ หมดอายุ: {new Date(c.expires_at).toLocaleDateString('th-TH', { 
                                                year: 'numeric', month: 'short', day: 'numeric', 
                                                hour: '2-digit', minute: '2-digit' 
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className={styles.codeItemRight}>
                                    <div className={`${styles.codeStatus} ${c.is_active ? styles.statusActive : styles.statusInactive}`}>
                                        {c.is_active ? '✅ ใช้งานอยู่' : '⛔ ปิดใช้งาน'}
                                    </div>
                                    <div className={styles.codeActions}>
                                        <button className="btn btn-outline btn-sm" style={{ padding: '4px 8px' }} onClick={() => toggleStatus(c.id, c.is_active)}>
                                            {c.is_active ? 'ปิด' : 'เปิด'}
                                        </button>
                                        <button className="btn btn-outline btn-sm" style={{ padding: '4px 8px' }} onClick={() => handleEdit(c)}>
                                            ✏️
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
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                            {editingId ? '✏️ แก้ไขโค้ดส่วนลด' : '✨ สร้างโค้ดส่วนลด'}
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
                                        *สามารถสร้าง Segment ใหม่ๆ ได้ที่เมนู CRM & ลูกค้า
                                    </p>
                                </div>

                                <div className={styles.formRow}>
                                    <label className={styles.label}>วันหมดอายุคูปอง</label>
                                    <input type="datetime-local" className={styles.input} value={formData.expires_at} onChange={e => setFormData({ ...formData, expires_at: e.target.value })} />
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
        </div>
    )
}
