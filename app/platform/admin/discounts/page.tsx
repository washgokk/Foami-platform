'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './discounts.module.css'
import { 
    Ticket, Sparkles, Edit2, CheckCircle, AlertCircle, Trash2, 
    Calendar, ClipboardList, Clock, RefreshCcw, CalendarRange, 
    MapPin, RefreshCw, Info, Send, Star, ShieldCheck, CheckCircle2, 
    XCircle, Users, Percent, Gift, ArrowRight, Store
} from 'lucide-react'
import ConfirmModal from '@/components/Global/ConfirmModal'
import { trackAuditLog } from '@/lib/audit'

export default function AdvancedDiscountsPage(props: any) {
    const branchId: string | undefined = props?.branchId
    const [activeTab, setActiveTab] = useState<'coupons' | 'proposals' | 'review_promo'>('coupons')

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

    // Form state for coupon
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        code: '',
        discount_type: 'percent',
        discount_value: '',
        max_discount_amount: '',
        max_uses: '10',
        max_uses_per_customer: '1',
        target_segment: 'all',
        funding_type: 'platform' as 'platform' | 'shared_50_50' | 'shop',
        expires_at: '',
        is_refund_code: false,
        usage_type: 'all' as 'all' | 'specific_days' | 'date_range',
        valid_days: [] as string[],
        valid_from: '',
        valid_until: '',
        allowed_branch_ids: [] as string[],
        allowed_zone_ids: [] as string[],
    })

    // Proposals state
    const [proposals, setProposals] = useState<any[]>([])
    const [loadingProposals, setLoadingProposals] = useState(false)
    const [showProposalModal, setShowProposalModal] = useState(false)
    const [submittingProposal, setSubmittingProposal] = useState(false)
    const [proposalForm, setProposalForm] = useState({
        title: '',
        code: '',
        description: '',
        discount_type: 'fixed' as 'fixed' | 'percent',
        discount_value: '50',
        max_discount_amount: '',
        min_booking_amount: '300',
        funding_type: 'platform' as 'platform' | 'shared_50_50' | 'shop',
        target_branches: [] as string[], // empty means all
        valid_from: '',
        valid_until: ''
    })

    // Review promo state
    const [reviewPromoConfig, setReviewPromoConfig] = useState<any>({
        enabled: true,
        discount_type: 'fixed',
        discount_value: 50,
        min_booking_amount: 0,
        validity_days: 30,
        max_uses_per_customer: 1,
        funding_type: 'platform'
    })
    const [savingReviewPromo, setSavingReviewPromo] = useState(false)

    const loadData = async () => {
        setLoading(true)
        const savedSegments = JSON.parse(localStorage.getItem('crm_custom_segments') || '[]')
        setSegments(savedSegments)

        let q = supabase.from('discount_codes').select('*').order('created_at', { ascending: false })
        if (branchId) q = q.eq('branch_id', branchId)
        const { data } = await q
        if (data) setCodes(data)

        const [brRes, znRes] = await Promise.all([
            supabase.from('branches').select('id, name').eq('is_active', true),
            supabase.from('zones').select('id, name, branch_id').eq('is_active', true),
        ])
        if (brRes.data) setBranches(brRes.data)
        if (znRes.data) setZones(znRes.data)

        setLoading(false)
    }

    const loadProposals = async () => {
        setLoadingProposals(true)
        try {
            const res = await fetch('/api/platform/campaigns')
            const data = await res.json()
            if (data.proposals) {
                setProposals(data.proposals)
            }
        } catch (e) {
            console.error('Failed to load proposals', e)
        } finally {
            setLoadingProposals(false)
        }
    }

    const loadReviewPromo = async () => {
        try {
            const res = await fetch('/api/platform/review-promo')
            const data = await res.json()
            if (data.config) {
                setReviewPromoConfig(data.config)
            }
        } catch (e) {
            console.error('Failed to load review promo config', e)
        }
    }

    useEffect(() => { 
        loadData() 
        loadProposals()
        loadReviewPromo()
    }, [])

    useEffect(() => {
        const handleRefresh = () => {
            loadData()
            loadProposals()
            loadReviewPromo()
        }
        window.addEventListener('foami:refresh', handleRefresh)
        return () => window.removeEventListener('foami:refresh', handleRefresh)
    }, [])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()

        const selectedSeg = segments.find(s => s.id === formData.target_segment);
        const baseTarget = formData.target_segment === 'all' ? {} : (selectedSeg || {});
        const targetValue = JSON.stringify({
            ...baseTarget,
            funding_type: formData.funding_type,
            raw_segment: formData.target_segment
        });

        const payload = {
            code: formData.code.toUpperCase().trim(),
            discount_type: formData.discount_type,
            discount_value: Number(formData.discount_value),
            max_discount_amount: formData.max_discount_amount ? Number(formData.max_discount_amount) : null,
            max_uses: formData.max_uses ? Number(formData.max_uses) : null,
            max_uses_per_customer: formData.max_uses_per_customer ? Number(formData.max_uses_per_customer) : null,
            target_segment: targetValue,
            expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
            is_active: true,
            is_refund_code: formData.is_refund_code,
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
            target_segment: 'all', funding_type: 'platform', expires_at: '', is_refund_code: false,
            usage_type: 'all', valid_days: [], valid_from: '', valid_until: '',
            allowed_branch_ids: [], allowed_zone_ids: [],
        })
    }

    const handleEdit = (code: any) => {
        setEditingId(code.id)

        let parsedSegmentId = 'all'
        let fundingType: any = 'shop'
        if (code.target_segment && code.target_segment !== 'all') {
            try {
                const parsed = JSON.parse(code.target_segment)
                parsedSegmentId = parsed.raw_segment || parsed.id || 'all'
                if (parsed.funding_type) fundingType = parsed.funding_type
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
            funding_type: fundingType,
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
                    alert('ไม่สามารถลบโค้ดนี้ได้ เนื่องจากมีการนำไปใช้งานในรายการจองแล้ว กรุณาปิดการใช้งานแทนการลบ')
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

    // Submit Campaign Proposal
    const handleSendProposal = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmittingProposal(true)
        try {
            const res = await fetch('/api/platform/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: proposalForm.title,
                    code: proposalForm.code ? proposalForm.code.toUpperCase().trim() : undefined,
                    description: proposalForm.description,
                    discount_type: proposalForm.discount_type,
                    discount_value: Number(proposalForm.discount_value),
                    max_discount_amount: proposalForm.max_discount_amount ? Number(proposalForm.max_discount_amount) : undefined,
                    min_booking_amount: proposalForm.min_booking_amount ? Number(proposalForm.min_booking_amount) : 0,
                    funding_type: proposalForm.funding_type,
                    target_branches: proposalForm.target_branches.length > 0 ? proposalForm.target_branches : ['all'],
                    valid_from: proposalForm.valid_from || undefined,
                    valid_until: proposalForm.valid_until || undefined
                })
            })
            const data = await res.json()
            if (data.success) {
                alert('ส่งข้อเสนอแคมเปญให้ร้านค้าพาร์ทเนอร์เรียบร้อยแล้ว')
                setShowProposalModal(false)
                setProposalForm({
                    title: '',
                    code: '',
                    description: '',
                    discount_type: 'fixed',
                    discount_value: '50',
                    max_discount_amount: '',
                    min_booking_amount: '300',
                    funding_type: 'platform',
                    target_branches: [],
                    valid_from: '',
                    valid_until: ''
                })
                loadProposals()
            } else {
                alert(data.error || 'เกิดข้อผิดพลาด')
            }
        } catch (e: any) {
            alert('เกิดข้อผิดพลาด: ' + e.message)
        } finally {
            setSubmittingProposal(false)
        }
    }

    // Save Review Promo Config
    const handleSaveReviewPromo = async (e: React.FormEvent) => {
        e.preventDefault()
        setSavingReviewPromo(true)
        try {
            const res = await fetch('/api/platform/review-promo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reviewPromoConfig)
            })
            const data = await res.json()
            if (data.success) {
                alert('บันทึกการตั้งค่าโปรโมชั่นหลังรีวิวสำเร็จ')
            } else {
                alert(data.error || 'เกิดข้อผิดพลาด')
            }
        } catch (e: any) {
            alert('เกิดข้อผิดพลาด: ' + e.message)
        } finally {
            setSavingReviewPromo(false)
        }
    }

    const getFundingBadge = (fundingType: string) => {
        if (fundingType === 'platform') {
            return (
                <span style={{ fontSize: '0.68rem', padding: '3px 8px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 20, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <ShieldCheck size={11} /> Foami ออก 100%
                </span>
            )
        } else if (fundingType === 'shared_50_50') {
            return (
                <span style={{ fontSize: '0.68rem', padding: '3px 8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 20, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Percent size={11} /> คนละครึ่ง 50/50
                </span>
            )
        }
        return (
            <span style={{ fontSize: '0.68rem', padding: '3px 8px', background: '#faf5ff', color: '#7c3aed', border: '1px solid #e9d5ff', borderRadius: 20, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Store size={11} /> ร้านค้ารับผิดชอบ 100%
            </span>
        )
    }

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className="page-header animate-fade" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Ticket size={28} color="var(--brand-dominant)" /> แพลตฟอร์มโปรโมชั่น &amp; ส่วนลด
                    </h1>
                    <p className="page-subtitle">จัดการคูปอง ส่งข้อเสนอแคมเปญให้พาร์ทเนอร์ และตั้งค่าโปรโมชั่นหลังรีวิว</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    {activeTab === 'coupons' && (
                        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>
                            <Sparkles size={16} style={{ marginRight: 6 }} /> สร้างโค้ดส่วนลดใหม่
                        </button>
                    )}
                    {activeTab === 'proposals' && (
                        <button className="btn btn-primary" onClick={() => setShowProposalModal(true)}>
                            <Send size={16} style={{ marginRight: 6 }} /> สร้างข้อเสนอแคมเปญใหม่
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
                <button
                    onClick={() => setActiveTab('coupons')}
                    style={{
                        padding: '12px 20px',
                        border: 'none',
                        background: 'transparent',
                        fontWeight: activeTab === 'coupons' ? 800 : 500,
                        color: activeTab === 'coupons' ? 'var(--brand-dominant)' : 'var(--text-secondary)',
                        borderBottom: activeTab === 'coupons' ? '3px solid var(--brand-dominant)' : '3px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.95rem',
                        transition: 'all 0.15s'
                    }}
                >
                    <Ticket size={18} /> โค้ดส่วนลดทั้งหมด ({codes.length})
                </button>
                <button
                    onClick={() => setActiveTab('proposals')}
                    style={{
                        padding: '12px 20px',
                        border: 'none',
                        background: 'transparent',
                        fontWeight: activeTab === 'proposals' ? 800 : 500,
                        color: activeTab === 'proposals' ? 'var(--brand-dominant)' : 'var(--text-secondary)',
                        borderBottom: activeTab === 'proposals' ? '3px solid var(--brand-dominant)' : '3px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.95rem',
                        transition: 'all 0.15s'
                    }}
                >
                    <Send size={18} /> ส่งข้อเสนอแคมเปญให้ร้านค้า ({proposals.length})
                </button>
                <button
                    onClick={() => setActiveTab('review_promo')}
                    style={{
                        padding: '12px 20px',
                        border: 'none',
                        background: 'transparent',
                        fontWeight: activeTab === 'review_promo' ? 800 : 500,
                        color: activeTab === 'review_promo' ? 'var(--brand-dominant)' : 'var(--text-secondary)',
                        borderBottom: activeTab === 'review_promo' ? '3px solid var(--brand-dominant)' : '3px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.95rem',
                        transition: 'all 0.15s'
                    }}
                >
                    <Star size={18} /> โปรโมชั่นกระตุ้นรีวิว (Foami 100%)
                </button>
            </div>

            {/* TAB 1: ALL COUPONS */}
            {activeTab === 'coupons' && (
                <div className={`card ${styles.card} animate-fade`} style={{ border: 'none' }}>
                    {loading ? (
                        <div className="empty-state"><div className="spinner" /></div>
                    ) : codes.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-state-title">ยังไม่มีโค้ดส่วนลด</span>
                        </div>
                    ) : (
                        <div className={styles.codeList}>
                            {codes.map(c => {
                                let itemFunding = 'shop'
                                try {
                                    if (c.target_segment) {
                                        const p = JSON.parse(c.target_segment)
                                        if (p.funding_type) itemFunding = p.funding_type
                                    }
                                } catch (e) {}

                                return (
                                    <div key={c.id} className={styles.codeItem} style={{ opacity: c.is_active ? 1 : 0.6 }}>
                                        <div className={styles.codeItemLeft}>
                                            <div className={styles.codeName} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                {c.code}
                                                {getFundingBadge(itemFunding)}
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
                                                เป้าหมาย: {c.target_segment === 'all' ? 'ลูกค้าทุกคน' : 'กลุ่มเป้าหมายเจาะจง'}
                                            </div>
                                            <div className={styles.codeDetails}>
                                                สิทธิ์ต่อคน: <strong style={{ color: 'var(--primary)' }}>{c.max_uses_per_customer || 'ไม่จำกัด'}</strong>
                                            </div>
                                            {/* Condition badges */}
                                            {(c.valid_from || c.valid_until || c.allowed_branch_ids?.length || c.allowed_zone_ids?.length) && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                                    {c.usage_type === 'date_range' && (c.valid_from || c.valid_until) && (
                                                        <span style={{ fontSize: '0.65rem', padding: '2px 7px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 20, fontWeight: 600 }}>
                                                            {c.valid_from ? c.valid_from : 'เริ่มได้ทันที'} 
                                                            {c.valid_until ? ` ถึง ${c.valid_until}` : ' (ไม่มีวันสิ้นสุด)'}
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
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: PROPOSALS */}
            {activeTab === 'proposals' && (
                <div className="animate-fade">
                    <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border)', padding: 24, marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    รายการข้อเสนอแคมเปญที่ส่งให้ร้านค้าพาร์ทเนอร์
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                    ร้านค้าจะได้รับข้อเสนอนี้ในเมนู "ข้อเสนอแคมเปญจาก Foami" และสามารถกด ยอมรับ หรือ ปฏิเสธ ได้อย่างอิสระ
                                </p>
                            </div>
                            <button className="btn btn-outline btn-sm" onClick={loadProposals} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <RefreshCw size={14} /> รีเฟรช
                            </button>
                        </div>

                        {loadingProposals ? (
                            <div className="empty-state"><div className="spinner" /></div>
                        ) : proposals.length === 0 ? (
                            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Ticket size={40} strokeWidth={1} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>ยังไม่มีข้อเสนอแคมเปญที่สร้างไว้</div>
                                <div style={{ fontSize: '0.8rem', marginTop: 4 }}>กดปุ่ม "สร้างข้อเสนอแคมเปญใหม่" เพื่อเริ่มสร้างโปรโมชั่นร่วมกับพาร์ทเนอร์</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {proposals.map((prop: any) => {
                                    const branchesData = prop.branches || {}
                                    const branchList = Object.entries(branchesData)
                                    const acceptedCount = branchList.filter(([_, b]: any) => b.status === 'accepted').length
                                    const declinedCount = branchList.filter(([_, b]: any) => b.status === 'declined').length
                                    const pendingCount = branchList.filter(([_, b]: any) => b.status === 'pending').length

                                    return (
                                        <div key={prop.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 20, background: '#fafbfc' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{prop.title}</span>
                                                        {getFundingBadge(prop.funding_type)}
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <Calendar size={12} /> สร้างเมื่อ {new Date(prop.created_at).toLocaleDateString('th-TH')}
                                                        </span>
                                                    </div>
                                                    {prop.description && (
                                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 6 }}>{prop.description}</p>
                                                    )}
                                                    <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                        <div>ส่วนลด: <span style={{ color: 'var(--brand-dominant)' }}>{prop.discount_type === 'percent' ? `${prop.discount_value}%` : `฿${prop.discount_value}`}</span></div>
                                                        {prop.min_booking_amount > 0 && <div>ยอดจองขั้นต่ำ: ฿{prop.min_booking_amount}</div>}
                                                        {prop.max_discount_amount && <div>ลดสูงสุด: ฿{prop.max_discount_amount}</div>}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <div style={{ padding: '6px 12px', background: '#ecfdf5', borderRadius: 8, textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>ตอบรับแล้ว</div>
                                                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}>{acceptedCount}</div>
                                                    </div>
                                                    <div style={{ padding: '6px 12px', background: '#fef2f2', borderRadius: 8, textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 700 }}>ปฏิเสธ</div>
                                                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dc2626' }}>{declinedCount}</div>
                                                    </div>
                                                    <div style={{ padding: '6px 12px', background: '#fffbeb', borderRadius: 8, textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 700 }}>รอการตอบรับ</div>
                                                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#d97706' }}>{pendingCount}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Branch statuses breakdown */}
                                            {branchList.length > 0 && (
                                                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                                                        สถานะแยกตามสาขาพาร์ทเนอร์ ({branchList.length} สาขา):
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                        {branchList.map(([bId, bInfo]: any) => {
                                                            const brObj = branches.find(b => b.id === bId)
                                                            const branchName = brObj?.name || bId
                                                            const isAcc = bInfo.status === 'accepted'
                                                            const isDec = bInfo.status === 'declined'

                                                            return (
                                                                <span
                                                                    key={bId}
                                                                    style={{
                                                                        fontSize: '0.75rem',
                                                                        padding: '4px 10px',
                                                                        borderRadius: 6,
                                                                        background: isAcc ? '#ecfdf5' : isDec ? '#fef2f2' : 'white',
                                                                        color: isAcc ? '#059669' : isDec ? '#dc2626' : '#64748b',
                                                                        border: `1px solid ${isAcc ? '#a7f3d0' : isDec ? '#fecaca' : '#cbd5e1'}`,
                                                                        fontWeight: 600,
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: 6
                                                                    }}
                                                                >
                                                                    {isAcc && <CheckCircle2 size={12} />}
                                                                    {isDec && <XCircle size={12} />}
                                                                    {!isAcc && !isDec && <Clock size={12} />}
                                                                    {branchName} ({isAcc ? 'ยอมรับ' : isDec ? 'ปฏิเสธ' : 'รอพิจารณา'})
                                                                </span>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: REVIEW PROMO (100% PLATFORM FUNDED) */}
            {activeTab === 'review_promo' && (
                <div className="animate-fade">
                    <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border)', padding: 24, maxWidth: 800 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                                <Star size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    ระบบโปรโมชั่นหลังรีวิว (Post-Review Incentive)
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    คูปองนี้จะแสดงในหน้ารายการของลูกค้าทุกร้าน เพื่อกระตุ้นให้ลูกค้ารีวิวบริการ และ <strong>แพลตฟอร์ม Foami เป็นผู้รับผิดชอบค่าส่วนลด 100%</strong> (ร้านค้าได้รับเงินเต็มจำนวน)
                                </p>
                            </div>
                        </div>

                        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 16, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
                            <ShieldCheck size={28} color="#059669" style={{ flexShrink: 0 }} />
                            <div style={{ fontSize: '0.85rem', color: '#065f46' }}>
                                <strong>สัญญาคุ้มครองพาร์ทเนอร์:</strong> ส่วนลดจากการรีวิวจะถูกเบิกจ่ายทดแทนให้ร้านค้าเต็มจำนวนในการคำนวณยอดเงินสุทธิ (Net to Shop) โดยไม่หักค่าใช้จ่ายจากร้านค้า
                            </div>
                        </div>

                        <form onSubmit={handleSaveReviewPromo}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                                    <input
                                        type="checkbox"
                                        checked={reviewPromoConfig.enabled}
                                        onChange={e => setReviewPromoConfig({ ...reviewPromoConfig, enabled: e.target.checked })}
                                        style={{ width: 18, height: 18, accentColor: 'var(--brand-dominant)', cursor: 'pointer' }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                            เปิดใช้งานโปรโมชั่นแจกคูปองหลังรีวิวทุกร้านค้า
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            เมื่อลูกค้าให้คะแนนและส่งรีวิว จะได้รับคูปองโค้ดทันทีสำหรับใช้ในการจองรอบถัดไป
                                        </div>
                                    </div>
                                </label>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div>
                                        <label className={styles.label}>มูลค่าส่วนลด (บาท)</label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            className={styles.input}
                                            value={reviewPromoConfig.discount_value}
                                            onChange={e => setReviewPromoConfig({ ...reviewPromoConfig, discount_value: Number(e.target.value) })}
                                        />
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                            ค่าเริ่มต้น ฿50 (Foami รับผิดชอบ 100%)
                                        </div>
                                    </div>

                                    <div>
                                        <label className={styles.label}>ยอดจองขั้นต่ำเพื่อใช้คูปอง (บาท)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className={styles.input}
                                            value={reviewPromoConfig.min_booking_amount}
                                            onChange={e => setReviewPromoConfig({ ...reviewPromoConfig, min_booking_amount: Number(e.target.value) })}
                                        />
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                            0 = ไม่มียอดขั้นต่ำ
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div>
                                        <label className={styles.label}>อายุคูปองหลังออก (วัน)</label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            className={styles.input}
                                            value={reviewPromoConfig.validity_days}
                                            onChange={e => setReviewPromoConfig({ ...reviewPromoConfig, validity_days: Number(e.target.value) })}
                                        />
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                            เช่น 30 วันนับจากวันที่ได้รับคูปอง
                                        </div>
                                    </div>

                                    <div>
                                        <label className={styles.label}>ผู้รับผิดชอบค่าส่วนลด</label>
                                        <input
                                            type="text"
                                            disabled
                                            className={styles.input}
                                            value="แพลตฟอร์ม Foami 100% (กำหนดตายตัว)"
                                            style={{ background: '#f1f5f9', color: '#475569', fontWeight: 600 }}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginTop: 12 }}>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={savingReviewPromo}
                                        style={{ padding: '12px 28px', fontWeight: 700 }}
                                    >
                                        {savingReviewPromo ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าโปรโมชั่นหลังรีวิว'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Create / Edit Coupon */}
            {showModal && (
                <div className="overlay" onClick={() => setShowModal(false)} style={{ zIndex: 999 }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            {editingId ? <><Edit2 size={20} color="var(--brand-dominant)" /> แก้ไขโค้ดส่วนลด</> : <><Sparkles size={20} color="var(--brand-dominant)" /> สร้างโค้ดส่วนลด</>}
                        </h2>

                        <form onSubmit={handleSave}>
                            <div className={styles.formGrid}>
                                <div className={styles.formRow}>
                                    <label className={styles.label}>รหัสคูปอง (Code)</label>
                                    <input required className={styles.input} style={{ textTransform: 'uppercase', fontWeight: 800, fontSize: '1.2rem', letterSpacing: 2 }} placeholder="เช่น FOAMI50" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
                                </div>

                                {/* Funding Source Split */}
                                <div className={styles.formRow} style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1.5px solid #e2e8f0' }}>
                                    <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        <ShieldCheck size={16} color="var(--brand-dominant)" /> แหล่งเงินสนับสนุนส่วนลด (Funding Source)
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 8 }}>
                                        {[
                                            { val: 'platform', label: 'Foami 100%', desc: 'แพลตฟอร์มจ่ายให้ร้าน' },
                                            { val: 'shared_50_50', label: 'คนละครึ่ง 50/50', desc: 'ร้านค้า 50% แพลตฟอร์ม 50%' },
                                            { val: 'shop', label: 'ร้านค้า 100%', desc: 'ร้านค้ารับผิดชอบเอง' }
                                        ].map(item => (
                                            <label key={item.val} style={{
                                                padding: '10px 12px',
                                                borderRadius: 8,
                                                border: formData.funding_type === item.val ? '2px solid var(--brand-dominant)' : '1px solid var(--border)',
                                                background: formData.funding_type === item.val ? 'var(--primary-ghost)' : 'white',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 3
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <input
                                                        type="radio"
                                                        name="funding_type"
                                                        value={item.val}
                                                        checked={formData.funding_type === item.val}
                                                        onChange={() => setFormData({ ...formData, funding_type: item.val as any })}
                                                        style={{ accentColor: 'var(--brand-dominant)' }}
                                                    />
                                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{item.label}</span>
                                                </div>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 20 }}>{item.desc}</span>
                                            </label>
                                        ))}
                                    </div>
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
                                    <input required type="number" className={styles.input} placeholder="เช่น 50" value={formData.discount_value} onChange={e => setFormData({ ...formData, discount_value: e.target.value })} />
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
                                </div>

                                {/* Condition Section */}
                                <div className={styles.formRow} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 12, padding: '16px' }}>
                                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '0.95rem' }}>
                                        <CalendarRange size={16} /> เงื่อนไขการใช้งาน
                                    </div>

                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                            ช่วงเวลาที่ใช้ได้
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {([
                                                ['all', 'ใช้ได้ทุกวัน (ไม่จำกัดเวลา)'],
                                                ['specific_days', 'เฉพาะบางวันในสัปดาห์ (เช่น เสาร์-อาทิตย์)'],
                                                ['date_range', 'เฉพาะช่วงวันที่กำหนด']
                                            ] as const).map(([val, label]) => (
                                                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, border: formData.usage_type === val ? '1.5px solid var(--brand-dominant)' : '1px solid var(--border)', background: formData.usage_type === val ? 'var(--primary-ghost)' : 'white' }}>
                                                    <input 
                                                        type="radio" 
                                                        name="usage_type" 
                                                        value={val} 
                                                        checked={formData.usage_type === val} 
                                                        onChange={(e) => setFormData(p => ({ ...p, usage_type: e.target.value as any }))}
                                                        style={{ accentColor: 'var(--brand-dominant)' }}
                                                    />
                                                    <span style={{ fontSize: '0.85rem', fontWeight: formData.usage_type === val ? 700 : 500 }}>
                                                        {label}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Specific Days Picker */}
                                    {formData.usage_type === 'specific_days' && (
                                        <div style={{ marginBottom: 16, padding: '12px', background: 'white', borderRadius: 8, border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>เลือกวันที่อนุญาตให้ใช้โค้ดส่วนลด</div>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'].map(day => {
                                                    const active = formData.valid_days.includes(day);
                                                    return (
                                                        <button 
                                                            key={day} 
                                                            type="button" 
                                                            onClick={() => toggleDay(day)} 
                                                            style={{
                                                                padding: '5px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                                                                border: active ? '1.5px solid var(--brand-dominant)' : '1px solid var(--border)',
                                                                background: active ? 'var(--brand-dominant)' : 'var(--surface)',
                                                                color: active ? 'white' : 'var(--text-secondary)',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {day}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Date range */}
                                    {formData.usage_type === 'date_range' && (
                                        <div style={{ marginBottom: 16, padding: '12px', background: 'white', borderRadius: 8, border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>วันที่เริ่มต้น</div>
                                                    <input type="date" className={styles.input} value={formData.valid_from} onChange={e => setFormData(p => ({ ...p, valid_from: e.target.value }))} style={{ fontSize: '0.85rem' }} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>วันที่สิ้นสุดแคมเปญ</div>
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

                                    {/* Branch Chips */}
                                    <div style={{ marginBottom: 12 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                                            <span>จำกัดสาขาที่ใช้งานได้</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {formData.allowed_branch_ids.length === 0 ? 'อนุญาตทุกสาขา' : `เลือกแล้ว ${formData.allowed_branch_ids.length} สาขา`}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {branches.map(b => {
                                                const active = formData.allowed_branch_ids.includes(b.id)
                                                return (
                                                    <button key={b.id} type="button" onClick={() => toggleBranch(b.id)} style={{
                                                        padding: '4px 10px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 500,
                                                        border: active ? '1.5px solid var(--brand-dominant)' : '1px solid var(--border)',
                                                        background: active ? 'var(--primary-ghost)' : 'white',
                                                        color: active ? 'var(--brand-dominant)' : 'var(--text-primary)',
                                                        cursor: 'pointer'
                                                    }}>{b.name}</button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Rebooking Code Toggle */}
                                <div className={styles.formRow} style={{ background: 'rgba(124,58,237,0.06)', border: '1.5px solid rgba(124,58,237,0.2)', borderRadius: 12, padding: '12px 14px' }}>
                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_refund_code}
                                            onChange={e => setFormData({ ...formData, is_refund_code: e.target.checked })}
                                            style={{ marginTop: 3, width: 16, height: 16, accentColor: '#7C3AED', cursor: 'pointer' }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                                                <RefreshCcw size={14} /> โค้ดจองใหม่ทดแทน (Rebooking Code)
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                ส่วนลดจะคำนวณจากยอดรวมทั้งหมด สำหรับลูกค้าที่เคยชำระแล้วแต่การจองไม่สำเร็จ
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

            {/* Modal: Create Campaign Proposal */}
            {showProposalModal && (
                <div className="overlay" onClick={() => setShowProposalModal(false)} style={{ zIndex: 999 }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Send size={20} color="var(--brand-dominant)" /> ส่งข้อเสนอแคมเปญให้ร้านค้าพาร์ทเนอร์
                        </h2>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                            สร้างข้อเสนอแคมเปญโปรโมชั่นใหม่ และส่งตรงไปยังระบบหลังบ้านของร้านค้าเพื่อให้ร้านกดยอมรับหรือปฏิเสธ
                        </p>

                        <form onSubmit={handleSendProposal}>
                            <div className={styles.formGrid}>
                                <div className={styles.formRow}>
                                    <label className={styles.label}>ชื่อแคมเปญโปรโมชั่น *</label>
                                    <input
                                        required
                                        className={styles.input}
                                        placeholder="เช่น แคมเปญต้อนรับเปิดเทอม ลดทันที ฿50"
                                        value={proposalForm.title}
                                        onChange={e => setProposalForm({ ...proposalForm, title: e.target.value })}
                                    />
                                </div>

                                <div className={styles.formRow}>
                                    <label className={styles.label}>รหัสโค้ดส่วนลด (Code)</label>
                                    <input
                                        className={styles.input}
                                        placeholder="เช่น BACK2SCHOOL (เว้นว่างไว้เพื่อสร้างอัตโนมัติ)"
                                        value={proposalForm.code}
                                        onChange={e => setProposalForm({ ...proposalForm, code: e.target.value.toUpperCase() })}
                                        style={{ fontFamily: 'monospace', fontWeight: 700 }}
                                    />
                                </div>

                                <div className={styles.formRow}>
                                    <label className={styles.label}>คำอธิบาย / รายละเอียดเงื่อนไขสำหรับร้านค้า</label>
                                    <textarea
                                        className={styles.input}
                                        rows={3}
                                        placeholder="ระบุวัตถุประสงค์และประโยชน์ที่ร้านค้าจะได้รับจากการเข้าร่วมแคมเปญนี้..."
                                        value={proposalForm.description}
                                        onChange={e => setProposalForm({ ...proposalForm, description: e.target.value })}
                                    />
                                </div>

                                {/* Funding Source */}
                                <div className={styles.formRow} style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1.5px solid #e2e8f0' }}>
                                    <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        <ShieldCheck size={16} color="var(--brand-dominant)" /> สัดส่วนการรับผิดชอบค่าส่วนลด
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 8 }}>
                                        {[
                                            { val: 'platform', label: 'Foami 100%', desc: 'แพลตฟอร์มจ่ายเงินชดเชยให้ร้านค้าเต็มจำนวน' },
                                            { val: 'shared_50_50', label: 'คนละครึ่ง 50/50', desc: 'ร้านค้าออก 50% แพลตฟอร์มออก 50%' },
                                            { val: 'shop', label: 'ร้านค้า 100%', desc: 'ร้านค้ารับผิดชอบค่าส่วนลดทั้งหมด' }
                                        ].map(item => (
                                            <label key={item.val} style={{
                                                padding: '10px 12px',
                                                borderRadius: 8,
                                                border: proposalForm.funding_type === item.val ? '2px solid var(--brand-dominant)' : '1px solid var(--border)',
                                                background: proposalForm.funding_type === item.val ? 'var(--primary-ghost)' : 'white',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 3
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <input
                                                        type="radio"
                                                        name="prop_funding_type"
                                                        value={item.val}
                                                        checked={proposalForm.funding_type === item.val}
                                                        onChange={() => setProposalForm({ ...proposalForm, funding_type: item.val as any })}
                                                        style={{ accentColor: 'var(--brand-dominant)' }}
                                                    />
                                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{item.label}</span>
                                                </div>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 20 }}>{item.desc}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className={styles.label}>ประเภทส่วนลด</label>
                                    <select
                                        className={styles.input}
                                        value={proposalForm.discount_type}
                                        onChange={e => setProposalForm({ ...proposalForm, discount_type: e.target.value as any })}
                                    >
                                        <option value="fixed">ลดเงินสด (บาท)</option>
                                        <option value="percent">เปอร์เซ็นต์ (%)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className={styles.label}>มูลค่าส่วนลด ({proposalForm.discount_type === 'percent' ? '%' : 'บาท'})</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        className={styles.input}
                                        placeholder="เช่น 50"
                                        value={proposalForm.discount_value}
                                        onChange={e => setProposalForm({ ...proposalForm, discount_value: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className={styles.label}>ยอดจองขั้นต่ำ (บาท)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className={styles.input}
                                        placeholder="เช่น 300 (0 คือไม่จำกัด)"
                                        value={proposalForm.min_booking_amount}
                                        onChange={e => setProposalForm({ ...proposalForm, min_booking_amount: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className={styles.label}>ลดสูงสุด (บาท) *สำหรับเปอร์เซ็นต์</label>
                                    <input
                                        type="number"
                                        min="0"
                                        disabled={proposalForm.discount_type === 'fixed'}
                                        className={styles.input}
                                        placeholder="เช่น 100"
                                        value={proposalForm.max_discount_amount}
                                        onChange={e => setProposalForm({ ...proposalForm, max_discount_amount: e.target.value })}
                                    />
                                </div>

                                {/* Target Branches */}
                                <div className={styles.formRow}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                                        <span>ส่งข้อเสนอให้ร้านค้าสาขาใดบ้าง?</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {proposalForm.target_branches.length === 0 ? 'ส่งให้ทุกสาขาพาร์ทเนอร์' : `เลือกแล้ว ${proposalForm.target_branches.length} สาขา`}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {branches.map(b => {
                                            const active = proposalForm.target_branches.includes(b.id)
                                            return (
                                                <button
                                                    key={b.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setProposalForm(prev => {
                                                            const exists = prev.target_branches.includes(b.id)
                                                            return {
                                                                ...prev,
                                                                target_branches: exists 
                                                                    ? prev.target_branches.filter(id => id !== b.id)
                                                                    : [...prev.target_branches, b.id]
                                                            }
                                                        })
                                                    }}
                                                    style={{
                                                        padding: '5px 12px',
                                                        borderRadius: 6,
                                                        fontSize: '0.8rem',
                                                        fontWeight: 500,
                                                        border: active ? '1.5px solid var(--brand-dominant)' : '1px solid var(--border)',
                                                        background: active ? 'var(--primary-ghost)' : 'white',
                                                        color: active ? 'var(--brand-dominant)' : 'var(--text-primary)',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {b.name}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className={styles.formRow} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label className={styles.label}>วันที่เริ่มแคมเปญ</label>
                                        <input
                                            type="date"
                                            className={styles.input}
                                            value={proposalForm.valid_from}
                                            onChange={e => setProposalForm({ ...proposalForm, valid_from: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className={styles.label}>วันที่สิ้นสุดแคมเปญ</label>
                                        <input
                                            type="date"
                                            className={styles.input}
                                            value={proposalForm.valid_until}
                                            onChange={e => setProposalForm({ ...proposalForm, valid_until: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className={styles.formRow} style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-3)' }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowProposalModal(false)} style={{ flex: 1 }}>ยกเลิก</button>
                                    <button type="submit" className="btn btn-primary" disabled={submittingProposal} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                        <Send size={16} /> {submittingProposal ? 'กำลังส่งข้อเสนอ...' : 'ส่งข้อเสนอให้ร้านค้า'}
                                    </button>
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
