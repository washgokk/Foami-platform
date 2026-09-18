'use client'
import { useState, useEffect } from 'react'
import {
  Wallet, Clock, CheckCircle, XCircle, RefreshCw,
  ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp,
  Percent, ShieldCheck, Lock, Sparkles, Award, Check, Save, Info
} from 'lucide-react'

interface Withdrawal {
  id: string
  shop_id: string
  shop_name: string
  shop_slug: string
  amount_thb: number
  bank_name: string
  account_number: string
  account_name: string
  status: 'pending' | 'approved' | 'completed' | 'rejected'
  admin_note: string | null
  created_at: string
  resolved_at: string | null
}

const STATUS_CONFIG = {
  pending: { bg: '#FEF3C7', color: '#92400E', icon: Clock, label: 'รอดำเนินการ' },
  approved: { bg: '#DCFCE7', color: '#15803D', icon: CheckCircle, label: 'อนุมัติแล้ว' },
  completed: { bg: '#EFF3FD', color: '#315EC3', icon: CheckCircle, label: 'เสร็จสิ้น' },
  rejected: { bg: '#FEE2E2', color: '#B91C1C', icon: XCircle, label: 'ปฏิเสธ' },
}

export default function PlatformFinancePage() {
  const [activeTab, setActiveTab] = useState<'withdrawals' | 'packages_config'>('withdrawals')

  // Withdrawals state
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Package Config state
  const [packages, setPackages] = useState<any>({
    starter: {
      id: 'starter',
      name: 'Starter Plan',
      monthly_fee: 0,
      yearly_fee: 0,
      commission_pct: 15,
      features: ['พื้นที่บริการสูงสุด 2 โซน', 'ฟีเจอร์จองคิวมาตรฐาน', 'สัญญาแบบต่อเดือน ไม่มีผูกมัด']
    },
    pro: {
      id: 'pro',
      name: 'Pro Partner Plan',
      monthly_fee: 350,
      yearly_fee: 3500,
      commission_pct: 10,
      features: ['สร้างพื้นที่บริการได้สูงสุด 100 ตร.กม.', 'ลดค่าคอมมิชชั่นเหลือ 10%', 'ตราสัญลักษณ์ Verified Partner', 'แนะนำบนหน้าแรก Marketplace']
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise 0% Plan',
      monthly_fee: 790,
      yearly_fee: 7900,
      commission_pct: 0,
      features: ['ฟรีค่าคอมมิชชั่น 0% ตลอดอายุสัญญา', 'เก็บรายได้ค่าล้างรถเต็ม 100%', 'พื้นที่บริการเต็มพิกัด 100 ตร.กม.', 'รองรับระบบต่อ พ.ร.บ./ประกันภัย']
    }
  })
  const [loadingPackages, setLoadingPackages] = useState(false)
  const [savingPackages, setSavingPackages] = useState(false)
  const [pkgSaveSuccess, setPkgSaveSuccess] = useState('')
  const [packagesUpdatedAt, setPackagesUpdatedAt] = useState<string | null>(null)

  const loadWithdrawals = async (status?: string) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('platform_token') || ''
      const qs = status && status !== 'all' ? `?status=${status}` : ''
      const res = await fetch(`/api/platform/withdrawals${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setWithdrawals(data.withdrawals || [])
    } finally {
      setLoading(false)
    }
  }

  const loadPackagesConfig = async () => {
    setLoadingPackages(true)
    try {
      const res = await fetch('/api/platform/packages')
      const data = await res.json()
      if (data.packages) {
        setPackages(data.packages)
      }
      if (data.updated_at) {
        setPackagesUpdatedAt(data.updated_at)
      }
    } catch (e) {
      console.error('Failed to load package config', e)
    } finally {
      setLoadingPackages(false)
    }
  }

  useEffect(() => {
    loadWithdrawals(filter === 'all' ? undefined : filter)
    loadPackagesConfig()
  }, [filter])

  const act = async (id: string, action: 'approve' | 'reject' | 'complete') => {
    setActionLoading(id + action)
    try {
      const token = localStorage.getItem('platform_token') || ''
      await fetch('/api/platform/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action, admin_note: adminNote[id] || '' })
      })
      await loadWithdrawals(filter === 'all' ? undefined : filter)
    } finally {
      setActionLoading(null)
    }
  }

  const handleSavePackages = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPackages(true)
    setPkgSaveSuccess('')
    try {
      const res = await fetch('/api/platform/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages })
      })
      const data = await res.json()
      if (data.success) {
        setPkgSaveSuccess('บันทึกการตั้งค่าราคาแพ็กเกจและค่าคอมมิชชั่นเรียบร้อยแล้ว ร้านค้าที่สมัครใหม่หรือต่อสัญญาจะได้รับราคาใหม่นี้ทันที')
        setPackagesUpdatedAt(new Date().toISOString())
        setTimeout(() => setPkgSaveSuccess(''), 5000)
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการบันทึก')
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSavingPackages(false)
    }
  }

  const total = withdrawals.reduce((s, w) => s + w.amount_thb, 0)
  const pending = withdrawals.filter(w => w.status === 'pending')

  const fmt = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          การเงิน แพลตฟอร์ม &amp; จัดการแพ็กเกจ
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          ตรวจสอบการถอนเงินของร้านพาร์ทเนอร์ และตั้งค่าราคาแพ็กเกจสมาชิกรายเดือน/รายปี
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('withdrawals')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'transparent',
            fontWeight: activeTab === 'withdrawals' ? 800 : 500,
            color: activeTab === 'withdrawals' ? 'var(--brand-dominant)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'withdrawals' ? '3px solid var(--brand-dominant)' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.95rem'
          }}
        >
          <Wallet size={18} /> คำขอถอนเงินร้านพาร์ทเนอร์ ({withdrawals.length})
        </button>
        <button
          onClick={() => setActiveTab('packages_config')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'transparent',
            fontWeight: activeTab === 'packages_config' ? 800 : 500,
            color: activeTab === 'packages_config' ? 'var(--brand-dominant)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'packages_config' ? '3px solid var(--brand-dominant)' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.95rem'
          }}
        >
          <Percent size={18} /> ตั้งค่าราคาแพ็กเกจ &amp; ค่าคอมมิชชั่น
        </button>
      </div>

      {/* TAB 1: WITHDRAWALS */}
      {activeTab === 'withdrawals' && (
        <div>
          {/* Summary Banner */}
          {pending.length > 0 && (
            <div style={{
              background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 16,
              padding: '16px 20px', marginBottom: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FCD34D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={20} color="#92400E" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>
                    {pending.length} รายการรอดำเนินการ (เกณฑ์ขั้นต่ำ ฿2,500)
                  </div>
                  <div style={{ fontSize: 12, color: '#B45309' }}>
                    ยอดรวม ฿{pending.reduce((s, w) => s + w.amount_thb, 0).toLocaleString('th')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6, background: '#F1F5F9', padding: 4, borderRadius: 12 }}>
              {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
                <button key={s} onClick={() => setFilter(s)} style={{
                  padding: '6px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: filter === s ? 700 : 500,
                  background: filter === s ? '#fff' : 'transparent',
                  color: filter === s ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: filter === s ? '0 1px 3px rgba(0,0,0,.08)' : 'none'
                }}>
                  {s === 'pending' ? 'รอดำเนินการ' : s === 'approved' ? 'อนุมัติแล้ว' : s === 'rejected' ? 'ปฏิเสธ' : 'ทั้งหมด'}
                </button>
              ))}
            </div>
            <button onClick={() => loadWithdrawals(filter === 'all' ? undefined : filter)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 10, border: '1px solid var(--border)', background: '#fff',
              cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)'
            }}>
              <RefreshCw size={13} /> รีเฟรช
            </button>
          </div>

          {/* List */}
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} />
              กำลังโหลด...
            </div>
          ) : withdrawals.length === 0 ? (
            <div style={{
              background: '#fff', border: '1px solid var(--border)', borderRadius: 16,
              padding: 60, textAlign: 'center', color: 'var(--text-muted)'
            }}>
              <Wallet size={36} color="var(--border)" style={{ margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>ไม่มีรายการในสถานะนี้</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {withdrawals.map(w => {
                const s = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending
                const SIcon = s.icon
                const isOpen = expandedId === w.id
                return (
                  <div key={w.id} style={{
                    background: '#fff', border: '1px solid var(--border)',
                    borderRadius: 16, overflow: 'hidden'
                  }}>
                    <div
                      onClick={() => setExpandedId(isOpen ? null : w.id)}
                      style={{
                        padding: '16px 20px', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', cursor: 'pointer', gap: 12
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <SIcon size={18} color={s.color} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{w.shop_name || w.shop_slug}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{w.bank_name} · {w.account_number} ({w.account_name})</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>฿{w.amount_thb.toLocaleString('th')}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{fmt(w.created_at)}</div>
                        </div>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                          borderRadius: 8, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color
                        }}>
                          {s.label}
                        </span>
                        {isOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{
                        padding: '16px 20px', borderTop: '1px solid var(--border)',
                        background: 'var(--surface-2, #F8FAFC)', display: 'flex',
                        flexDirection: 'column', gap: 12
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 12 }}>
                          <div><span style={{ color: 'var(--text-muted)' }}>สาขา: </span><strong>{w.shop_name || w.shop_slug}</strong></div>
                          <div><span style={{ color: 'var(--text-muted)' }}>ธนาคาร: </span><strong>{w.bank_name}</strong></div>
                          <div><span style={{ color: 'var(--text-muted)' }}>เลขบัญชี: </span><strong>{w.account_number}</strong></div>
                          <div><span style={{ color: 'var(--text-muted)' }}>ชื่อบัญชี: </span><strong>{w.account_name}</strong></div>
                          <div><span style={{ color: 'var(--text-muted)' }}>ขอถอนเมื่อ: </span>{fmt(w.created_at)}</div>
                          {w.resolved_at && <div><span style={{ color: 'var(--text-muted)' }}>ดำเนินการเมื่อ: </span>{fmt(w.resolved_at)}</div>}
                        </div>

                        {w.admin_note && (
                          <div style={{ padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)' }}>หมายเหตุแอดมิน: </span>{w.admin_note}
                          </div>
                        )}

                        {w.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                            <input
                              type="text"
                              placeholder="หมายเหตุ (ส่งถึงร้านค้า เช่น รหัสอ้างอิงการโอน)..."
                              value={adminNote[w.id] || ''}
                              onChange={e => setAdminNote(prev => ({ ...prev, [w.id]: e.target.value }))}
                              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
                            />
                            <button
                              disabled={actionLoading === w.id + 'approve'}
                              onClick={() => act(w.id, 'approve')}
                              style={{ padding: '8px 16px', borderRadius: 8, background: '#16A34A', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                            >
                              อนุมัติ
                            </button>
                            <button
                              disabled={actionLoading === w.id + 'reject'}
                              onClick={() => act(w.id, 'reject')}
                              style={{ padding: '8px 16px', borderRadius: 8, background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                            >
                              ปฏิเสธ
                            </button>
                          </div>
                        )}

                        {w.status === 'approved' && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                            <button
                              disabled={actionLoading === w.id + 'complete'}
                              onClick={() => act(w.id, 'complete')}
                              style={{ padding: '8px 16px', borderRadius: 8, background: '#2563EB', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                            >
                              ทำรายการโอนเงินเสร็จสิ้น (Complete)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PACKAGE PRICING & COMMISSION CONFIGURATION */}
      {activeTab === 'packages_config' && (
        <div style={{ maxWidth: 850 }}>
          {/* Rate Change Audit & Immutability Notice */}
          <div style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#F8FAFC',
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)'
          }}>
            <Clock size={15} color="var(--brand-dominant)" style={{ flexShrink: 0 }} />
            <div>
              <span>ปรับปรุงการตั้งค่าล่าสุดเมื่อ: <strong>{packagesUpdatedAt ? new Date(packagesUpdatedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.' : 'ตามรอบสัญญาปัจจุบัน'}</strong></span>
              <span style={{ color: 'var(--brand-dominant)', marginLeft: 8, fontWeight: 600 }}>• รายการจองและสัญญาย้อนหลังทั้งหมดถูกล็อกเรทถาวร ไม่มีการเปลี่ยนย้อนหลัง</span>
            </div>
          </div>

          {/* Information Shield Alert */}
          <div style={{
            background: '#ecfdf5',
            border: '1.5px solid #a7f3d0',
            borderRadius: 16,
            padding: 18,
            marginBottom: 24,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start'
          }}>
            <ShieldCheck size={26} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#065f46' }}>
                หลักการทำงานและสัญญาคุ้มครองพาร์ทเนอร์
              </div>
              <div style={{ fontSize: '0.82rem', color: '#047857', marginTop: 4, lineHeight: 1.5 }}>
                แอดมินสามารถปรับเปลี่ยนราคาค่าบริการและอัตราค่าคอมมิชชั่นของแต่ละแพ็กเกจได้ตามต้องการ โดยราคาใหม่จะมีผลต่อ <strong>การสมัครใหม่และการต่ออายุสัญญา</strong> ทันที<br />
                สำหรับร้านค้าที่ชำระเงินและมีสัญญาที่มีผลคุ้มครองอยู่แล้ว สัญญาจะคงอัตราเดิมตามที่ระบุไว้จนครบกำหนดสัญญา
              </div>
            </div>
          </div>

          <form onSubmit={handleSavePackages}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Starter Package Card */}
              <div style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      1. Starter Plan (แผนเริ่มต้น)
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>ไม่มีค่าบริการรายเดือน จ่ายเฉพาะค่าคอมมิชชั่นตามการใช้งานจริง</div>
                  </div>
                  <span style={{ fontSize: '0.75rem', padding: '4px 12px', background: '#F1F5F9', color: '#475569', borderRadius: 20, fontWeight: 700 }}>
                    ฟรีไม่มีรายเดือน
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      ค่าบริการรายเดือน (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={packages.starter?.monthly_fee ?? 0}
                      onChange={e => setPackages({
                        ...packages,
                        starter: { ...packages.starter, monthly_fee: Number(e.target.value) }
                      })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      ค่าบริการรายปี (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={packages.starter?.yearly_fee ?? 0}
                      onChange={e => setPackages({
                        ...packages,
                        starter: { ...packages.starter, yearly_fee: Number(e.target.value) }
                      })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      อัตราค่าคอมมิชชั่น (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={packages.starter?.commission_pct ?? 15}
                      onChange={e => setPackages({
                        ...packages,
                        starter: { ...packages.starter, commission_pct: Number(e.target.value) }
                      })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}
                    />
                  </div>
                </div>
              </div>

              {/* Pro Partner Package Card */}
              <div style={{ background: '#fff', border: '2px solid #3B82F6', borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#1D4ED8' }}>
                      2. Pro Partner Plan (แผนโปร)
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>เหมาะสำหรับร้านที่ต้องการขยายพื้นที่บริการ และลดต้นทุนค่าคอมมิชชั่นเหลือ 10%</div>
                  </div>
                  <span style={{ fontSize: '0.75rem', padding: '4px 12px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 20, fontWeight: 700 }}>
                    แนะนำ ยอดนิยม
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      ค่าบริการรายเดือน (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={packages.pro?.monthly_fee ?? 350}
                      onChange={e => setPackages({
                        ...packages,
                        pro: { ...packages.pro, monthly_fee: Number(e.target.value) }
                      })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: '#1D4ED8' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      ค่าบริการรายปี (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={packages.pro?.yearly_fee ?? 3500}
                      onChange={e => setPackages({
                        ...packages,
                        pro: { ...packages.pro, yearly_fee: Number(e.target.value) }
                      })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      อัตราค่าคอมมิชชั่น (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={packages.pro?.commission_pct ?? 10}
                      onChange={e => setPackages({
                        ...packages,
                        pro: { ...packages.pro, commission_pct: Number(e.target.value) }
                      })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontWeight: 800, color: '#1D4ED8' }}
                    />
                  </div>
                </div>
              </div>

              {/* Zero-Commission Enterprise Package Card */}
              <div style={{ background: '#fff', color: 'var(--text-primary)', border: '2px solid #F59E0B', borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#D97706' }}>
                      3. Enterprise 0% Plan (แผนธุรกิจคุ้มค่าสูงสุด)
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>ค่าคอมมิชชั่น 0% ตลอดอายุสัญญา ร้านค้ารับรายได้ค่าบริการเต็ม 100% ทุกคัน</div>
                  </div>
                  <span style={{ fontSize: '0.75rem', padding: '4px 12px', background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', borderRadius: 20, fontWeight: 800 }}>
                    คุ้มค่าสูงสุด (Best Value)
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      ค่าบริการรายเดือน (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={packages.enterprise?.monthly_fee ?? 790}
                      onChange={e => setPackages({
                        ...packages,
                        enterprise: { ...packages.enterprise, monthly_fee: Number(e.target.value) }
                      })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      ค่าบริการรายปี (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={packages.enterprise?.yearly_fee ?? 7900}
                      onChange={e => setPackages({
                        ...packages,
                        enterprise: { ...packages.enterprise, yearly_fee: Number(e.target.value) }
                      })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                      อัตราค่าคอมมิชชั่น (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={packages.enterprise?.commission_pct ?? 0}
                      onChange={e => setPackages({
                        ...packages,
                        enterprise: { ...packages.enterprise, commission_pct: Number(e.target.value) }
                      })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: '#D97706', fontSize: 13, fontWeight: 800 }}
                    />
                  </div>
                </div>
              </div>

              {pkgSaveSuccess && (
                <div style={{ padding: '12px 16px', borderRadius: 10, background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', fontWeight: 700, fontSize: '0.88rem' }}>
                  {pkgSaveSuccess}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={savingPackages}
                  style={{
                    padding: '12px 28px',
                    borderRadius: 12,
                    background: 'var(--brand, #3B82F6)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  <Save size={18} /> {savingPackages ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าราคาแพ็กเกจ'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
