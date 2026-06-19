'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
    Bell, 
    Plus, 
    MessageSquare, 
    Send, 
    Edit3, 
    Trash2, 
    ChevronRight, 
    X,
    Eye,
    Code,
    CheckCircle,
    Clock,
    UserCircle2,
    Ticket
} from 'lucide-react'
import { trackAuditLog } from '@/lib/audit'
import { getRFMScore, segmentCustomer, DEFAULT_CRM_CONFIG } from '@/lib/crm-utils'
import { evaluateSegmentMatch } from '@/lib/segment-engine'
import styles from '../admin.module.css'

interface Promotion {
    id: string
    name: string
    type: 'promo' | 'general'
    target_segment: string
    discount_code_id: string | null
    flex_message_json: any
    status: 'draft' | 'sent'
    sent_at: string | null
    created_at: string
}

export default function PromotionsPage() {
    const [promotions, setPromotions] = useState<Promotion[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingPromo, setEditingPromo] = useState<Promotion | null>(null)
    const [discountCodes, setDiscountCodes] = useState<any[]>([])
    const [segments, setSegments] = useState<any[]>([])
    const [usedCodeIds, setUsedCodeIds] = useState<string[]>([])

    // Form State
    const [name, setName] = useState('')
    const [type, setType] = useState<'promo' | 'general'>('promo')
    const [targetSegment, setTargetSegment] = useState('')
    const [discountCodeId, setDiscountCodeId] = useState('')
    const [flexJson, setFlexJson] = useState('{}')
    const [submitting, setSubmitting] = useState(false)

    const editableFields = useEffect(() => {
        // We'll use a local state for editable fields to avoid too many re-renders if we useMemo poorly
    }, [flexJson]);

    // Helper: Extract editable fields from JSON
    const getFields = (obj: any, path: string[] = [], results: any[] = []) => {
        if (!obj || typeof obj !== 'object') return results;
        if (obj.type === 'text' && typeof obj.text === 'string') {
            results.push({ path: [...path, 'text'], label: `ข้อความ (${obj.text.substring(0, 15)}...)`, value: obj.text, type: 'text' });
        }
        if (obj.type === 'image' && typeof obj.url === 'string') {
            results.push({ path: [...path, 'url'], label: 'รูปภาพ (URL)', value: obj.url, type: 'url' });
        }
        if (obj.action && typeof obj.action.label === 'string') {
            results.push({ path: [...path, 'action', 'label'], label: `ปุ่ม: ${obj.action.label}`, value: obj.action.label, type: 'text' });
        }
        if (obj.action && typeof obj.action.uri === 'string') {
            results.push({ path: [...path, 'action', 'uri'], label: `Link: ${obj.action.label || 'URL'}`, value: obj.action.uri, type: 'url' });
        }
        Object.keys(obj).forEach(key => {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                getFields(obj[key], [...path, key], results);
            }
        });
        return results;
    };

    const dynamicFields = (() => {
        try {
            return getFields(JSON.parse(flexJson));
        } catch (e) {
            return [];
        }
    })();

    const updateField = (path: string[], val: string) => {
        try {
            const obj = JSON.parse(flexJson);
            let curr = obj;
            for (let i = 0; i < path.length - 1; i++) curr = curr[path[i]];
            curr[path[path.length - 1]] = val;
            setFlexJson(JSON.stringify(obj, null, 2));
        } catch (e) {}
    };

    useEffect(() => {
        loadData()
        loadSegments()
        loadCodes()
    }, [])

    async function loadData() {
        setLoading(true)
        const { data } = await supabase.from('promotions').select('*').order('created_at', { ascending: false })
        setPromotions(data || [])
        setLoading(false)
    }

    async function loadSegments() {
        // 1. Fetch data to calculate basic RFM segments on the fly
        const [custRes, bookRes, segRes] = await Promise.all([
            supabase.from('customers').select('*'), // Fetch all for full stats calculation
            supabase.from('bookings').select('customer_id, total_price, status, created_at, addon_ids, services(name), rating, discount_amount').in('status', ['completed', 'paid', 'delivering', 'washing']),
            supabase.from('crm_segments').select('*').order('name')
        ])

        const customers = custRes.data || []
        const bookings = bookRes.data || []
        const dbSegments = segRes.data || []

        // Process full stats for all customers to enable custom segment evaluation
        const customerStats = customers.map(c => {
            const cBookings = bookings.filter((b: any) => b.customer_id === c.id)
            const totalSpent = cBookings.reduce((sum: number, b: any) => sum + (b.total_price || 0), 0)
            const totalVisits = cBookings.length
            
            const allAddons = new Set<string>()
            const allServices = new Set<string>()
            let totalDiscount = 0
            
            cBookings.forEach((b: any) => {
                if (Array.isArray(b.addon_ids)) b.addon_ids.forEach((a: any) => allAddons.add(typeof a === 'string' ? a : a.name))
                if (b.services?.name) allServices.add(b.services.name)
                if (b.discount_amount) totalDiscount += b.discount_amount
            })

            const sortedArrivals = [...cBookings].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            const lastVisitDate = sortedArrivals.length > 0 ? sortedArrivals[0].created_at : null

            let daysSinceLast = 999
            if (lastVisitDate) {
                daysSinceLast = Math.floor((new Date().getTime() - new Date(lastVisitDate).getTime()) / (1000 * 3600 * 24))
            }

            const rfm = getRFMScore(daysSinceLast, totalVisits, totalSpent, DEFAULT_CRM_CONFIG)
            const segment = segmentCustomer(rfm, DEFAULT_CRM_CONFIG)

            return { 
                ...c, 
                totalSpent, 
                totalVisits,
                avgSpent: totalVisits > 0 ? totalSpent / totalVisits : 0,
                daysSinceLast, 
                hasDiscountUsage: totalDiscount > 0,
                totalSavings: totalDiscount,
                segment,
                vehicleCount: Array.isArray(c.saved_vehicles) ? c.saved_vehicles.length : 0,
                addons: Array.from(allAddons),
                servicesUsed: Array.from(allServices)
            }
        })

        const segmentCounts: Record<string, number> = {}
        customerStats.forEach(c => {
            segmentCounts[c.segment] = (segmentCounts[c.segment] || 0) + 1
        })

        const segmentList = Object.entries(segmentCounts).map(([name, count]) => ({
            id: name.toLowerCase(),
            name: name,
            matchedUsers: count
        }))

        // 2. Add DB Custom Segments with LIVE calculated counts
        const combined = [
            ...segmentList,
            ...dbSegments.map(s => ({
                id: s.id,
                name: s.name,
                matchedUsers: customerStats.filter(c => evaluateSegmentMatch(c, s.conditions)).length
            })).filter(ds => !segmentList.some(sl => sl.name === ds.name))
        ]

        setSegments(combined.sort((a,b) => b.matchedUsers - a.matchedUsers))

        // Fallback for legacy local segments
        const saved = localStorage.getItem('crm_custom_segments')
        if (saved && dbSegments.length === 0) {
            try { 
                const custom = JSON.parse(saved)
                setSegments(prev => [...prev, ...custom.filter((c: any) => !prev.some(p => p.name === c.name))])
            } catch(e) {}
        }
    }

    async function loadCodes() {
        const now = new Date().toISOString()
        // 1. Fetch all active/non-expired codes
        const { data: codes } = await supabase
            .from('discount_codes')
            .select('*')
            .eq('is_active', true)
            .gt('expires_at', now)
            
        // 2. Fetch all promotions to see which codes are ALREADY assigned (not just sent)
        const { data: allPromos } = await supabase
            .from('promotions')
            .select('id, discount_code_id')
            .not('discount_code_id', 'is', null)
            
        setDiscountCodes(codes || [])
        setUsedCodeIds((allPromos || []).map(p => p.discount_code_id as string))
    }

    const handleOpenModal = (promo?: Promotion) => {
        if (promo) {
            setEditingPromo(promo)
            setName(promo.name)
            setType(promo.type)
            setTargetSegment(promo.target_segment)
            setDiscountCodeId(promo.discount_code_id || '')
            setFlexJson(JSON.stringify(promo.flex_message_json, null, 2))
        } else {
            setEditingPromo(null)
            setName('')
            setType('promo')
            setTargetSegment('')
            setDiscountCodeId('')
            // Default Template
            setFlexJson(JSON.stringify(DEFAULT_TEMPLATE, null, 2))
        }
        setShowModal(true)
    }

    const handleSave = async () => {
        if (!name) return alert('กรุณาระบุชื่อรายการ')
        
        // Duplicate Prevention Check
        if (type === 'promo' && discountCodeId) {
            const { data: existing } = await supabase
                .from('promotions')
                .select('id, name')
                .eq('discount_code_id', discountCodeId)
                .neq('id', editingPromo?.id || 'none')
                .limit(1)
            
            if (existing && existing.length > 0) {
                return alert(`โค้ดนี้ถูกใช้ไปแล้วในแคมเปญ: ${existing[0].name}`)
            }
        }

        let parsedJson = {}
        try { parsedJson = JSON.parse(flexJson) } catch(e) { return alert('JSON ไม่ถูกต้อง') }

        setSubmitting(true)
        const payload = {
            name,
            type,
            target_segment: targetSegment,
            discount_code_id: type === 'promo' ? (discountCodeId || null) : null,
            flex_message_json: parsedJson,
            updated_at: new Date().toISOString(),
        }

        if (editingPromo) {
            const { error } = await supabase.from('promotions').update(payload).eq('id', editingPromo.id)
            if (!error) {
                trackAuditLog({
                    action_type: 'UPDATE',
                    entity_type: 'booking', // Simplified type
                    entity_id: editingPromo.id,
                    description: `Updated promotion: ${name}`
                })
            }
        } else {
            const { error } = await supabase.from('promotions').insert(payload)
            if (!error) {
                trackAuditLog({
                    action_type: 'CREATE',
                    entity_type: 'booking',
                    entity_id: 'new',
                    description: `Created promotion: ${name}`
                })
            }
        }

        setSubmitting(false)
        setShowModal(false)
        loadData()
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        // Show a brief signal or alert
    }

    const onCodeChange = (id: string) => {
        setDiscountCodeId(id)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('ยืนยันการลบรายการนี้?')) return
        await supabase.from('promotions').delete().eq('id', id)
        loadData()
    }

    const handleSend = async (promo: Promotion) => {
        if (!confirm('ยืนยันการยิงแจ้งเตือนไปยังกลุ่มลูกค้าเป้าหมาย? (ระบบจะส่ง Push Notification และ Line Flex Message)')) return
        
        // Simulating the send process
        setLoading(true)
        // In reality, this would trigger an Edge Function or server action to call Line API
        await new Promise(r => setTimeout(r, 1500))
        
        await supabase.from('promotions').update({
            status: 'sent',
            sent_at: new Date().toISOString()
        }).eq('id', promo.id)

        trackAuditLog({
            action_type: 'EXPORT' as any,
            entity_type: 'booking',
            entity_id: promo.id,
            description: `Sent promotion: ${promo.name}`
        })

        setLoading(false)
        loadData()
        alert('ส่งแจ้งเตือนเรียบร้อยแล้ว!')
    }

    if (loading && promotions.length === 0) return (
        <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <div className="animate-fade" style={{ color: 'var(--text-muted)' }}>กำลังโหลดรายการแจ้งเตือน...</div>
        </div>
    )

    return (
        <div className={`animate-fade ${styles.page}`}>
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Bell size={28} color="var(--brand-dominant)" /> แจ้งโปรโมชั่น & ข่าวสาร
                    </h1>
                    <p className="page-subtitle">จัดการและส่งการแจ้งเตือน Line Flex Message ไปยังกลุ่มลูกค้าเป้าหมาย</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ borderRadius: '14px', gap: 8 }}>
                    <Plus size={20} /> เพิ่มการแจ้งเตือน
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                {promotions.map(promo => (
                    <div key={promo.id} className={styles.card} style={{ padding: 20, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 180 }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                                <span style={{
                                    fontSize: '0.65rem', padding: '4px 8px', borderRadius: 8, fontWeight: 700,
                                    background: promo.status === 'sent' ? 'var(--success-ghost)' : 'var(--surface-2)',
                                    color: promo.status === 'sent' ? 'var(--success)' : 'var(--text-muted)'
                                }}>
                                    {promo.status === 'sent' ? 'ส่งแล้ว' : 'ฉบับร่าง'}
                                </span>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button className="btn-icon btn-sm" onClick={() => handleOpenModal(promo)}><Edit3 size={16} /></button>
                                    <button className="btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(promo.id)}><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 800 }}>{promo.name}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 6 }}>
                                <UserCircle2 size={14} /> กลุ่มเป้าหมาย: <span style={{ fontWeight: 600 }}>{promo.target_segment || 'ลูกค้าทั้งหมด'}</span>
                            </div>
                            {promo.discount_code_id && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--brand-dominant)', fontSize: '0.85rem' }}>
                                    <Ticket size={14} /> โค้ดส่วนลด: <span style={{ fontWeight: 600 }}>{discountCodes.find(c => c.id === promo.discount_code_id)?.code || '...'}</span>
                                </div>
                            )}
                            {/* Condition badges */}
                            {(() => {
                                const p = promo as any
                                const badges = []
                                if (p.usage_type === 'recurring') badges.push({ label: '🔄 ประจำ', color: '#7C3AED' })
                                else badges.push({ label: '🎯 ครั้งเดียว', color: '#059669' })
                                if (p.valid_from || p.valid_until) badges.push({ label: `📅 ${p.valid_from || '?'} → ${p.valid_until || '?'}`, color: '#0369a1' })
                                if (p.allowed_branch_ids?.length) badges.push({ label: `🏪 ${p.allowed_branch_ids.length} สาขา`, color: '#B45309' })
                                if (p.allowed_zone_ids?.length) badges.push({ label: `📍 ${p.allowed_zone_ids.length} โซน`, color: '#B45309' })
                                return badges.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                                        {badges.map((b, i) => (
                                            <span key={i} style={{ fontSize: '0.65rem', padding: '3px 7px', borderRadius: 8, fontWeight: 700, background: `${b.color}15`, color: b.color, border: `1px solid ${b.color}30` }}>
                                                {b.label}
                                            </span>
                                        ))}
                                    </div>
                                ) : null
                            })()}

                        </div>
                        
                        <div style={{ marginTop: 20 }}>
                            {promo.status === 'sent' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>
                                    <Clock size={14} /> ส่งเมื่อ {new Date(promo.sent_at!).toLocaleString('th-TH')}
                                </div>
                            ) : (
                                <button className="btn btn-primary" onClick={() => handleSend(promo)} style={{ width: '100%', borderRadius: 12, gap: 8 }}>
                                    <Send size={16} /> ยิงแจ้งเตือนทันที
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {promotions.length === 0 && (
                    <div className={styles.card} style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', background: 'transparent', border: '2px dashed var(--border)' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 16 }}><Bell size={48} style={{ opacity: 0.3 }} /></div>
                        <h3 style={{ margin: 0, color: 'var(--text-muted)' }}>ยังไม่มีรายการแจ้งเตือน</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>สร้างแคมเปญใหม่เพื่อเริ่มส่งแจ้งเตือนให้กับลูกค้าของคุณ</p>
                    </div>
                )}
            </div>

            {/* ADD/EDIT MODAL */}
            {showModal && (
                <div className={`${styles.modalOverlay} animate-fade`} style={{ 
                    zIndex: 1000, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    backdropFilter: 'blur(12px)', 
                    background: 'rgba(15, 23, 42, 0.5)', 
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0 
                }}>
                    <div className={`${styles.modalContent}`} style={{ 
                        width: '92%', 
                        maxWidth: '1400px', 
                        height: '88vh', 
                        padding: 0, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        borderRadius: 32,
                        overflow: 'hidden',
                        boxShadow: '0 40px 100px rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'white',
                    }}>
                        <div style={{ padding: '24px 32px', borderBottom: '1.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                                    {editingPromo ? 'แก้ไขแคมเปญแจ้งเตือน' : 'สร้างแคมเปญแจ้งเตือนใหม่'}
                                </h2>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>กำหนดรายละเอียดและรูปแบบข้อความสำหรับ LINE OA</p>
                            </div>
                            <button className="btn-icon" onClick={() => setShowModal(false)} style={{ background: 'var(--surface-2)', width: 40, height: 40, borderRadius: 20 }}><X size={24} /></button>
                        </div>

                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'white' }}>
                            {/* LEFT COLUMN: CONFIG */}
                            <div style={{ width: '420px', padding: 28, borderRight: '1.5px solid var(--border)', overflowY: 'auto', background: '#f8fafc' }}>
                                <div style={{ marginBottom: 24 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>ข้อมูลพื้นฐาน</label>
                                    <div style={{ background: 'white', padding: 20, borderRadius: 20, border: '1px solid var(--border)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                                        <div style={{ marginBottom: 16 }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>ชื่อแคมเปญ</span>
                                            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น โปรต้อนรับสงกรานต์" style={{ borderRadius: 12 }} />
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>ประเภท</span>
                                            <select className="form-input" value={type} onChange={e => setType(e.target.value as any)} style={{ borderRadius: 12 }}>
                                                <option value="promo">แจ้งโปรโมชั่น (แถมโค้ด)</option>
                                                <option value="general">แจ้งข่าวสารทั่วไป</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: 24 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>กลุ่มเป้าหมาย</label>
                                    <div style={{ background: 'white', padding: 20, borderRadius: 20, border: '1px solid var(--border)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                                        <select className="form-input" value={targetSegment} onChange={e => setTargetSegment(e.target.value)} style={{ borderRadius: 12 }}>
                                            <option value="">ลูกค้าทั้งหมด</option>
                                            {segments.map(s => <option key={s.id} value={s.name}>{s.name} ({s.matchedUsers || 0})</option>)}
                                        </select>
                                        <p style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>* ระบบจะดึงข้อมูล LINE ID ในกลุ่มนี้ออกมาโดยอัตโนมัติ</p>
                                    </div>
                                </div>

                                {type === 'promo' && (
                                    <div style={{ marginBottom: 24 }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>สิทธิพิเศษ</label>
                                        <div style={{ background: 'white', padding: 20, borderRadius: 20, border: '1px solid var(--border)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                                            <select className="form-input" value={discountCodeId} onChange={e => onCodeChange(e.target.value)} style={{ borderRadius: 12 }}>
                                                <option value="">-- เลือกโค้ดส่วนลด --</option>
                                                {discountCodes
                                                    .filter(c => {
                                                        const segmentMatch = !targetSegment || !c.target_segment || c.target_segment === targetSegment;
                                                        const isUsedByOther = usedCodeIds.includes(c.id) && c.id !== editingPromo?.discount_code_id;
                                                        return segmentMatch && !isUsedByOther;
                                                    })
                                                    .map(c => <option key={c.id} value={c.id}>{c.code} ({c.discount_type === 'percent' ? c.discount_value + '%' : c.discount_value + 'บ.'})</option>)
                                                }
                                            </select>
                                            
                                            {discountCodeId && (
                                                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                    {(() => {
                                                        const code = discountCodes.find(c => c.id === discountCodeId);
                                                        if (!code) return null;
                                                        const desc = code.discount_type === 'percent' ? `${code.discount_value}%` : `${code.discount_value} บาท`;
                                                        return (
                                                            <>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                        โค้ด: <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginLeft: 4 }}>{code.code}</span>
                                                                    </div>
                                                                    <button onClick={() => copyToClipboard(code.code)} style={{ padding: '4px 10px', fontSize: '0.65rem', borderRadius: 8, background: 'var(--brand-dominant)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}>คัดลอก</button>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                        ส่วนลด: <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginLeft: 4 }}>{desc}</span>
                                                                    </div>
                                                                    <button onClick={() => copyToClipboard(desc)} style={{ padding: '4px 10px', fontSize: '0.65rem', borderRadius: 8, background: 'var(--brand-dominant)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}>คัดลอก</button>
                                                                </div>
                                                            </>
                                                        )
                                                    })()}
                                                </div>
                                            )}

                                            {targetSegment && discountCodes.filter(c => !c.target_segment || c.target_segment === targetSegment).length === 0 && (
                                                <p style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>
                                                    * ไม่พบโค้ดสำหรับกลุ่ม {targetSegment}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* DYNAMIC FIELDS */}
                                {dynamicFields.length > 0 && (
                                    <div style={{ marginBottom: 24 }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>เนื้อหาข้อความ</label>
                                        <div style={{ background: 'white', padding: 20, borderRadius: 20, border: '1px solid var(--border)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {dynamicFields.map((field, idx) => (
                                                <div key={idx}>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
                                                        {field.label}
                                                    </span>
                                                    {field.type === 'url' ? (
                                                        <input className="form-input" value={field.value} onChange={e => updateField(field.path, e.target.value)} placeholder="https://..." style={{ borderRadius: 10, fontSize: '0.8rem' }} />
                                                    ) : (
                                                        <textarea className="form-input" value={field.value} onChange={e => updateField(field.path, e.target.value)} style={{ borderRadius: 10, fontSize: '0.8rem', minHeight: 60, padding: '8px 12px' }} />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div style={{ marginTop: 32 }}>
                                    <button className="btn btn-primary" onClick={handleSave} disabled={submitting} style={{ width: '100%', borderRadius: 16, height: 54, fontWeight: 800, fontSize: '1rem', boxShadow: '0 10px 20px rgba(59, 95, 204, 0.2)' }}>
                                        {submitting ? 'กำลังบันทึก...' : 'บันทึกฉบับร่าง'}
                                    </button>
                                </div>
                            </div>

                            {/* MIDDLE COLUMN: LIVE PREVIEW */}
                            <div style={{ flex: 1, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f0f4f8', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, alignSelf: 'start', color: '#475569', fontWeight: 800, fontSize: '0.95rem' }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                        <Eye size={18} color="var(--brand-dominant)" />
                                    </div>
                                    LINE FLEX PREVIEW
                                </div>
                                
                                <div style={{ position: 'relative' }}>
                                    <FlexMessagePreview json={flexJson} />
                                    <div style={{ position: 'absolute', top: -10, right: -10, padding: '4px 10px', background: '#06c755', color: 'white', borderRadius: 8, fontSize: '0.6rem', fontWeight: 900 }}>LIVE</div>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: JSON EDITOR */}
                            <div style={{ width: '420px', padding: 32, borderLeft: '1.5px solid var(--border)', display: 'flex', flexDirection: 'column', background: '#1a1d21' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 800, fontSize: '0.9rem' }}>
                                        <Code size={20} color="#60a5fa" />
                                        FLEX JSON CONFIG
                                    </div>
                                    <button className="btn btn-sm" style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: 8, background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }} onClick={() => setFlexJson(JSON.stringify(DEFAULT_TEMPLATE, null, 2))}>RESET</button>
                                </div>
                                <textarea 
                                    className="form-input" 
                                    style={{ 
                                        flex: 1, 
                                        fontFamily: '"Fira Code", monospace', 
                                        fontSize: '0.85rem', 
                                        padding: 24, 
                                        background: '#0f1115', 
                                        color: '#e2e8f0', 
                                        borderRadius: 20,
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        resize: 'none',
                                        lineHeight: 1.6
                                    }}
                                    value={flexJson}
                                    onChange={e => setFlexJson(e.target.value)}
                                    spellCheck={false}
                                />
                                <div style={{ marginTop: 16, fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                                    <p style={{ margin: 0 }}>Tip: Use <a href="https://developers.line.biz/flex-simulator/" target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>simulator</a> to design complexes.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .spinner {
                    border: 4px solid var(--surface-2);
                    border-top: 4px solid var(--brand-dominant);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .animate-fade {
                    animation: fadeIn 0.2s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .btn-icon {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    color: var(--text-muted);
                    padding: 4px;
                    border-radius: 8px;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .btn-icon:hover {
                    background: var(--surface-2);
                    color: var(--text-primary);
                }
                .btn-icon.btn-sm {
                    padding: 2px;
                }
            `}</style>
        </div>
    )
}

const SIZES: any = {
    xxs: '10px',
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '19px',
    xl: '22px',
    xxl: '26px',
    '3xl': '30px',
    '4xl': '38px',
    '5xl': '48px'
}

const SPACING: any = {
    none: '0px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '24px'
}

function FlexItem({ item }: { item: any }) {
    if (!item) return null

    const marginStyle = item.margin ? { marginTop: SPACING[item.margin] || item.margin } : {}
    const flexStyle = item.flex !== undefined ? { flex: item.flex } : {}

    if (item.type === 'box') {
        const layoutStyle: any = {
            display: 'flex',
            flexDirection: item.layout === 'vertical' ? 'column' : 'row',
            alignItems: item.layout === 'baseline' ? 'baseline' : 'stretch',
            gap: SPACING[item.spacing] || item.spacing || 0,
            ...marginStyle,
            ...flexStyle
        }
        return (
            <div style={layoutStyle}>
                {item.contents?.map((child: any, i: number) => (
                    <FlexItem key={i} item={child} />
                ))}
            </div>
        )
    }

    if (item.type === 'text') {
        const textStyle: any = {
            fontSize: SIZES[item.size] || item.size || SIZES.md,
            fontWeight: item.weight === 'bold' ? 700 : 400,
            color: item.color || '#333',
            textAlign: item.align || 'left',
            whiteSpace: item.wrap ? 'normal' : 'nowrap',
            overflow: item.wrap ? 'visible' : 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.4,
            ...marginStyle,
            ...flexStyle
        }
        return <div style={textStyle}>{item.text}</div>
    }

    if (item.type === 'icon' || (item.type === 'image' && item.url)) {
        const isIcon = item.type === 'icon'
        const imgStyle: any = {
            width: isIcon ? (SIZES[item.size] || item.size || '1.2em') : '100%',
            height: isIcon ? (SIZES[item.size] || item.size || '1.2em') : 'auto',
            objectFit: item.aspectMode || 'cover',
            display: 'block',
            ...marginStyle,
            ...flexStyle
        }
        return <img src={item.url} alt="flex-item" style={imgStyle} />
    }

    if (item.type === 'separator') {
        return <div style={{ height: 1, background: item.color || '#eee', margin: '8px 0', ...marginStyle }} />
    }

    if (item.type === 'button') {
        const btnStyle: any = {
            padding: '8px 16px',
            textAlign: 'center',
            borderRadius: 12,
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            ...marginStyle,
            ...flexStyle,
            background: item.style === 'primary' ? (item.color || '#3B5FCC') : 'transparent',
            color: item.style === 'primary' ? 'white' : (item.color || '#3B5FCC'),
            border: item.style === 'primary' ? 'none' : `1px solid ${item.color || '#3B5FCC'}`
        }
        return <div style={btnStyle}>{item.action?.label || item.label}</div>
    }

    if (item.type === 'filler') {
        return <div style={{ flex: 1 }} />
    }

    return null
}

function FlexMessagePreview({ json }: { json: string }) {
    let data: any = {}
    let error = false
    try {
        data = JSON.parse(json)
    } catch (e) {
        error = true
    }

    if (error) return (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 600 }}>
            <X size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
            <br /> รูปแบบ JSON ไม่ถูกต้อง
        </div>
    )

    // Modern Flex Renderer
    const bubble = data.type === 'bubble' ? data : data.contents?.[0] || {}
    
    return (
        <div style={{ width: 300, background: bubble.styles?.body?.backgroundColor || 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            {/* HERO */}
            {bubble.hero && <FlexItem item={bubble.hero} />}
            
            {/* BODY */}
            <div style={{ padding: 16 }}>
                {bubble.header && (
                    <div style={{ marginBottom: 12 }}>
                        <FlexItem item={bubble.header} />
                        <div style={{ height: 1, background: '#eee', margin: '8px 0' }} />
                    </div>
                )}
                
                <FlexItem item={bubble.body} />

                {/* FOOTER */}
                {bubble.footer && (
                    <div style={{ marginTop: 20 }}>
                        <FlexItem item={bubble.footer} />
                    </div>
                )}
            </div>
        </div>
    )
}

const DEFAULT_TEMPLATE = {
  "type": "bubble",
  "hero": {
    "type": "image",
    "url": "https://developers-resource.landpress.line.me/fx/img/01_1_cafe.png",
    "size": "full",
    "aspectRatio": "20:13",
    "aspectMode": "cover",
    "action": {
      "type": "uri",
      "uri": "https://line.me/"
    }
  },
  "body": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "Brown Cafe",
        "weight": "bold",
        "size": "xl"
      },
      {
        "type": "box",
        "layout": "baseline",
        "margin": "md",
        "contents": [
          {
            "type": "icon",
            "size": "sm",
            "url": "https://developers-resource.landpress.line.me/fx/img/review_gold_star_28.png"
          },
          {
            "type": "icon",
            "size": "sm",
            "url": "https://developers-resource.landpress.line.me/fx/img/review_gold_star_28.png"
          },
          {
            "type": "icon",
            "size": "sm",
            "url": "https://developers-resource.landpress.line.me/fx/img/review_gold_star_28.png"
          },
          {
            "type": "icon",
            "size": "sm",
            "url": "https://developers-resource.landpress.line.me/fx/img/review_gold_star_28.png"
          },
          {
            "type": "icon",
            "size": "sm",
            "url": "https://developers-resource.landpress.line.me/fx/img/review_gray_star_28.png"
          },
          {
            "type": "text",
            "text": "4.0",
            "size": "sm",
            "color": "#999999",
            "margin": "md",
            "flex": 1
          }
        ]
      },
      {
        "type": "box",
        "layout": "vertical",
        "margin": "lg",
        "spacing": "sm",
        "contents": [
          {
            "type": "box",
            "layout": "baseline",
            "spacing": "sm",
            "contents": [
              {
                "type": "text",
                "text": "Place",
                "color": "#aaaaaa",
                "size": "sm",
                "flex": 1
              },
              {
                "type": "text",
                "text": "Flex Tower, 7-7-4 Midori-ku, Tokyo",
                "wrap": true,
                "color": "#666666",
                "size": "sm",
                "flex": 5
              }
            ]
          },
          {
            "type": "box",
            "layout": "baseline",
            "spacing": "sm",
            "contents": [
              {
                "type": "text",
                "text": "Time",
                "color": "#aaaaaa",
                "size": "sm",
                "flex": 1
              },
              {
                "type": "text",
                "text": "10:00 - 23:00",
                "wrap": true,
                "color": "#666666",
                "size": "sm",
                "flex": 5
              }
            ]
          }
        ]
      }
    ]
  },
  "footer": {
    "type": "box",
    "layout": "vertical",
    "spacing": "sm",
    "contents": [
      {
        "type": "button",
        "style": "link",
        "height": "sm",
        "action": {
          "type": "uri",
          "label": "CALL",
          "uri": "https://line.me/"
        }
      },
      {
        "type": "button",
        "style": "link",
        "height": "sm",
        "action": {
          "type": "uri",
          "label": "WEBSITE",
          "uri": "https://line.me/"
        }
      },
      {
        "type": "box",
        "layout": "vertical",
        "contents": [],
        "margin": "sm"
      }
    ],
    "flex": 0
  }
}
