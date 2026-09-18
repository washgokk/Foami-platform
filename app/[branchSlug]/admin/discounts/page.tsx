'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Ticket, ShieldCheck, Percent, Store, Check, X,
  Clock, Plus, Trash2, Calendar, Star, Award, AlertCircle, RefreshCw
} from 'lucide-react'

export default function ShopDiscountsPage() {
  const params = useParams()
  const branchSlug = (params?.branchSlug as string) || 'kku'

  const [branch, setBranch] = useState<any>(null)
  const [proposals, setProposals] = useState<any[]>([])
  const [shopCodes, setShopCodes] = useState<any[]>([])
  const [reviewPromo, setReviewPromo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // New code modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCodeForm, setNewCodeForm] = useState({
    code: '',
    discount_type: 'fixed',
    discount_value: '50',
    max_discount_amount: '',
    max_uses: '50',
    expires_at: ''
  })
  const [savingCode, setSavingCode] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Get Branch
      const { data: bData } = await supabase.from('branches').select('*').eq('slug', branchSlug).maybeSingle()
      setBranch(bData)

      if (bData) {
        // 2. Load Proposals for this branch
        const propRes = await fetch(`/api/platform/campaigns?branchId=${bData.id}`)
        const propData = await propRes.json()
        setProposals(propData?.proposals || [])

        // 3. Load Shop's own codes
        const { data: codes } = await supabase
          .from('discount_codes')
          .select('*')
          .or(`allowed_branch_ids.cs.{${bData.id}},target_segment.ilike.%shop%`)
          .order('created_at', { ascending: false })
        setShopCodes(codes || [])

        // 4. Load Review Promo config
        const revRes = await fetch('/api/platform/review-promo')
        const revData = await revRes.json()
        setReviewPromo(revData?.promo || null)
      }
    } finally {
      setLoading(false)
    }
  }, [branchSlug])

  useEffect(() => { loadData() }, [loadData])

  const handleRespondProposal = async (proposalId: string, action: 'accept' | 'decline') => {
    if (!branch?.id) return
    setRespondingId(proposalId)
    setActionNotice(null)

    try {
      const res = await fetch('/api/platform/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id: proposalId,
          branch_id: branch.id,
          action
        })
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'เกิดข้อผิดพลาด')

      setActionNotice({
        type: 'success',
        message: action === 'accept' ? 'ยอมรับข้อเสนอแคมเปญสำเร็จ แคมเปญพร้อมใช้งาน' : 'ปฏิเสธข้อเสนอแคมเปญเรียบร้อยแล้ว'
      })
      await loadData()
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'เกิดข้อผิดพลาดในการตอบรับ' })
    } finally {
      setRespondingId(null)
    }
  }

  const handleCreateShopCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!branch?.id) return
    setSavingCode(true)
    setActionNotice(null)

    try {
      const cleanCode = newCodeForm.code.toUpperCase().trim()
      const segmentData = {
        created_by_role: 'shop',
        funding_type: 'shop', // Shop pays 100%
        branch_id: branch.id
      }

      const { error } = await supabase.from('discount_codes').insert({
        code: cleanCode,
        discount_type: newCodeForm.discount_type,
        discount_value: Number(newCodeForm.discount_value),
        max_discount_amount: newCodeForm.max_discount_amount ? Number(newCodeForm.max_discount_amount) : null,
        max_uses: newCodeForm.max_uses ? Number(newCodeForm.max_uses) : 50,
        allowed_branch_ids: [branch.id],
        target_segment: JSON.stringify(segmentData),
        is_active: true,
        expires_at: newCodeForm.expires_at ? new Date(newCodeForm.expires_at).toISOString() : null
      })

      if (error) throw error

      setShowCreateModal(false)
      setNewCodeForm({ code: '', discount_type: 'fixed', discount_value: '50', max_discount_amount: '', max_uses: '50', expires_at: '' })
      setActionNotice({ type: 'success', message: `สร้างโค้ดส่วนลด "${cleanCode}" สำเร็จ (ร้านค้าสนับสนุน 100%)` })
      await loadData()
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'เกิดข้อผิดพลาดในการสร้างโค้ด' })
    } finally {
      setSavingCode(false)
    }
  }

  const handleDeleteCode = async (id: string, codeName: string) => {
    if (!confirm(`ต้องการลบโค้ด "${codeName}" หรือไม่?`)) return
    await supabase.from('discount_codes').delete().eq('id', id)
    await loadData()
  }

  const handleToggleCode = async (c: any) => {
    await supabase.from('discount_codes').update({ is_active: !c.is_active }).eq('id', c.id)
    await loadData()
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={26} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} />
        กำลังโหลดข้อมูลส่วนลดและแคมเปญ...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Ticket size={24} color="var(--brand)" /> จัดการส่วนลด &amp; แคมเปญโปรโมชั่น ({branchSlug})
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          ข้อเสนอแคมเปญสนับสนุนจากแพลตฟอร์ม Foami และโค้ดโปรโมชั่นประจำสาขา
        </div>
      </div>

      {actionNotice && (
        <div style={{
          padding: '12px 18px', borderRadius: 14, marginBottom: 20,
          background: actionNotice.type === 'success' ? '#DCFCE7' : '#FEE2E2',
          color: actionNotice.type === 'success' ? '#15803D' : '#B91C1C',
          fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8
        }}>
          {actionNotice.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          {actionNotice.message}
        </div>
      )}

      {/* SECTION 1: ALWAYS-ACTIVE REVIEW REWARD PROMO */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.08), rgba(49, 94, 195, 0.08))',
        border: '1.5px solid #16A34A',
        borderRadius: 20, padding: 22, marginBottom: 24, boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#15803D', fontWeight: 800, fontSize: 16 }}>
            <Award size={22} /> โปรโมชั่นกระตุ้นรีวิวหลังรับบริการ (เปิดใช้งานอยู่ตลอดเวลา)
          </div>
          <span style={{
            background: '#DCFCE7', color: '#15803D', padding: '3px 10px', borderRadius: 12,
            fontSize: '0.75rem', fontWeight: 800, border: '1px solid #86EFAC'
          }}>
            Foami สนับสนุน 100%
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          ลูกค้าที่ใช้บริการกับสาขาของคุณเสร็จและส่งรีวิว จะได้รับคูปองส่วนลดพิเศษทันที{' '}
          <strong>(ลด ฿{reviewPromo?.discount_value || 50})</strong> สำหรับการจองครั้งถัดไป โดย{' '}
          <strong>Foami รับผิดชอบค่าใช้จ่ายส่วนลดนี้เต็ม 100%</strong> ร้านค้าของคุณจะได้รับเงินรายได้เต็มจำนวนโดยไม่ถูกหักค่าส่วนลด
        </div>
      </div>

      {/* SECTION 2: PLATFORM PROPOSALS */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={20} color="var(--brand)" /> ข้อเสนอโปรโมชั่นจากแพลตฟอร์ม Foami
          </h2>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
            แคมเปญการตลาดที่แพลตฟอร์มส่งเสนอให้ร้านค้าสาขาพิจารณาเข้าร่วม พร้อมระบุสัดส่วนการออกค่าใช้จ่ายชัดเจน
          </div>
        </div>

        {proposals.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, color: 'var(--text-muted)' }}>
            ยังไม่มีข้อเสนอแคมเปญใหม่จากแพลตฟอร์มในขณะนี้
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {proposals.map(p => {
              const isAccepted = p.my_status === 'accepted'
              const isDeclined = p.my_status === 'declined'
              const isPending = !isAccepted && !isDeclined

              // Funding badge info
              let fundingLabel = 'Foami สนับสนุน 100% (ร้านไม่เสียค่าใช้จ่าย)'
              let fundingBg = '#DCFCE7'
              let fundingColor = '#15803D'
              let FundingIcon = ShieldCheck

              if (p.funding_type === 'shared_50_50') {
                fundingLabel = 'คนละครึ่ง 50/50 (ร้านร่วมออก 50% / Foami ออก 50%)'
                fundingBg = '#FEF3C7'
                fundingColor = '#92400E'
                FundingIcon = Percent
              } else if (p.funding_type === 'shop') {
                fundingLabel = 'ร้านค้าสนับสนุน 100%'
                fundingBg = '#EFF6FF'
                fundingColor = '#1E40AF'
                FundingIcon = Store
              }

              return (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--surface)',
                    border: `1.5px solid ${isAccepted ? '#16A34A' : isDeclined ? '#E2E8F0' : 'var(--brand)'}`,
                    borderRadius: 18, padding: 20, boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 800,
                          background: 'var(--surface-2)', color: 'var(--text-primary)', fontFamily: 'monospace'
                        }}>
                          รหัสโค้ด: {p.code}
                        </span>
                      </div>
                      {p.description && (
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                          {p.description}
                        </div>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isAccepted && (
                        <span style={{ padding: '4px 12px', borderRadius: 10, background: '#DCFCE7', color: '#15803D', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Check size={14} /> เข้าร่วมแคมเปญแล้ว (เปิดใช้งาน)
                        </span>
                      )}
                      {isDeclined && (
                        <span style={{ padding: '4px 12px', borderRadius: 10, background: '#F1F5F9', color: '#64748B', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <X size={14} /> ปฏิเสธข้อเสนอแล้ว
                        </span>
                      )}
                      {isPending && (
                        <span style={{ padding: '4px 12px', borderRadius: 10, background: '#FEF3C7', color: '#92400E', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Clock size={14} /> รอการตอบรับจากร้านค้า
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Funding & Rules Info */}
                  <div style={{
                    padding: '10px 14px', borderRadius: 12, background: fundingBg, color: fundingColor,
                    fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14
                  }}>
                    <FundingIcon size={15} /> {fundingLabel}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      ส่วนลด: <strong>{p.discount_type === 'percent' ? `${p.discount_value}%` : `฿${p.discount_value}`}</strong>
                      {p.valid_from && p.valid_until && ` · ระยะเวลา: ${p.valid_from} ถึง ${p.valid_until}`}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!isAccepted && (
                        <button
                          type="button"
                          disabled={respondingId === p.id}
                          onClick={() => handleRespondProposal(p.id, 'accept')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '8px 18px', borderRadius: 10, background: '#16A34A', color: '#fff',
                            border: 'none', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                            opacity: respondingId === p.id ? 0.7 : 1
                          }}
                        >
                          <Check size={14} /> ยอมรับแคมเปญ
                        </button>
                      )}
                      {!isDeclined && (
                        <button
                          type="button"
                          disabled={respondingId === p.id}
                          onClick={() => handleRespondProposal(p.id, 'decline')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '8px 14px', borderRadius: 10, background: 'var(--surface-2)', color: '#B91C1C',
                            border: '1px solid var(--border)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
                            opacity: respondingId === p.id ? 0.7 : 1
                          }}
                        >
                          <X size={14} /> ปฏิเสธ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SECTION 3: SHOP'S OWN CUSTOM CODES */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Store size={20} color="var(--brand)" /> โค้ดส่วนลดของร้านค้าเอง (ร้านค้าสนับสนุน 100%)
            </h2>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
              สร้างโค้ดโปรโมชั่นส่วนตัวเพื่อดึงดูดลูกค้าประจำของสาขาคุณ
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 12, background: 'var(--brand)', color: '#fff',
              border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: 'var(--shadow-brand)'
            }}
          >
            <Plus size={15} /> สร้างโค้ดของร้าน
          </button>
        </div>

        {shopCodes.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 18, color: 'var(--text-muted)' }}>
            ยังไม่มีโค้ดส่วนลดที่สร้างเอง กดปุ่ม &quot;สร้างโค้ดของร้าน&quot; เพื่อเริ่มต้น
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {shopCodes.map(c => (
              <div
                key={c.id}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 14, padding: '14px 18px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', flexWrap: 'wrap', gap: 10
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, fontFamily: 'monospace', color: 'var(--brand)' }}>{c.code}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700,
                      background: c.is_active ? '#DCFCE7' : '#FEE2E2',
                      color: c.is_active ? '#15803D' : '#B91C1C'
                    }}>
                      {c.is_active ? 'เปิดใช้งาน' : 'หยุดใช้งาน'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    ส่วนลด: <strong>{c.discount_type === 'percent' ? `${c.discount_value}%` : `฿${c.discount_value}`}</strong> · ใช้ไปแล้ว: {c.used_count || 0} / {c.max_uses || 'ไม่จำกัด'} ครั้ง
                    {c.expires_at && ` · หมดอายุ: ${new Date(c.expires_at).toLocaleDateString('th-TH')}`}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleToggleCode(c)}
                    style={{
                      padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: c.is_active ? '#FEF2F2' : '#F0FDF4',
                      color: c.is_active ? '#B91C1C' : '#15803D',
                      fontWeight: 700, fontSize: 12, cursor: 'pointer'
                    }}
                  >
                    {c.is_active ? 'หยุด' : 'เปิด'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCode(c.id, c.code)}
                    style={{
                      padding: '6px 10px', borderRadius: 8, border: '1px solid #FCA5A5',
                      background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Shop Code Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }} onClick={() => setShowCreateModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface)', borderRadius: 20, padding: 24,
            width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-xl)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>สร้างโค้ดส่วนลดของร้าน</h3>
            <form onSubmit={handleCreateShopCode} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>รหัสโค้ด (Code) *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น VIP10, WELCOME50"
                  value={newCodeForm.code}
                  onChange={e => setNewCodeForm({ ...newCodeForm, code: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>ประเภทส่วนลด</label>
                  <select
                    value={newCodeForm.discount_type}
                    onChange={e => setNewCodeForm({ ...newCodeForm, discount_type: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13 }}
                  >
                    <option value="fixed">บาท (฿)</option>
                    <option value="percent">เปอร์เซ็นต์ (%)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>มูลค่าส่วนลด *</label>
                  <input
                    type="number"
                    required
                    value={newCodeForm.discount_value}
                    onChange={e => setNewCodeForm({ ...newCodeForm, discount_value: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>จำนวนสิทธิ์ทั้งหมด</label>
                <input
                  type="number"
                  value={newCodeForm.max_uses}
                  onChange={e => setNewCodeForm({ ...newCodeForm, max_uses: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>วันหมดอายุ (เว้นว่างได้)</label>
                <input
                  type="date"
                  value={newCodeForm.expires_at}
                  onChange={e => setNewCodeForm({ ...newCodeForm, expires_at: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#EFF6FF', color: '#1E40AF', fontSize: 12 }}>
                หมายเหตุ: โค้ดที่สร้างเองในส่วนนี้ ร้านค้าจะเป็นผู้รับผิดชอบค่าส่วนลด 100%
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="submit"
                  disabled={savingCode}
                  style={{
                    flex: 1, padding: '11px', borderRadius: 10, background: 'var(--brand)', color: '#fff',
                    border: 'none', fontWeight: 700, cursor: savingCode ? 'not-allowed' : 'pointer'
                  }}
                >
                  {savingCode ? 'กำลังบันทึก...' : 'สร้างโค้ด'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    flex: 1, padding: '11px', borderRadius: 10, background: 'var(--surface-2)',
                    color: 'var(--text-primary)', border: 'none', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
