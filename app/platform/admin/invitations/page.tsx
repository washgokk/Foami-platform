'use client'
import { useState, useEffect } from 'react'
import {
  Ticket, Plus, Copy, Check, Trash2, RefreshCw,
  Clock, CheckCircle2, XCircle, Mail, Calendar, Link2, Store
} from 'lucide-react'

interface Invitation {
  id: string
  code: string
  email: string | null
  plan_name: string
  base_plan?: string
  contract_months?: number
  is_used: boolean
  expires_at: string
  used_at: string | null
  shop_name: string | null
  created_at: string
  created_by: string | null
}

const PLAN_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  starter: { bg: '#F3F4F6', color: '#374151', label: 'Starter' },
  growth: { bg: '#DCFCE7', color: '#15803D', label: 'Growth' },
  pro: { bg: '#EDE9FE', color: '#6D28D9', label: 'Pro' },
  enterprise: { bg: '#FEF3C7', color: '#92400E', label: 'Enterprise' },
}

function CodeBadge({ code }: { code: string }) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const copyLink = () => {
    const url = `${window.location.origin}/register?code=${code}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button
        onClick={copyCode}
        title="คลิกเพื่อคัดลอกเฉพาะ Code"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700,
          background: '#EFF3FD', color: '#315EC3',
          border: '1.5px solid #BDD0F9', cursor: 'pointer', fontFamily: 'monospace',
          letterSpacing: '.06em', transition: 'all .2s'
        }}
      >
        {code}
        {copiedCode ? <Check size={12} color="#22C55E" /> : <Copy size={12} />}
      </button>

      <button
        onClick={copyLink}
        title="คัดลอกลิงก์เปิดใช้งาน (foami.app/register?code=...)"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
          background: copiedLink ? '#DCFCE7' : '#FFFFFF',
          color: copiedLink ? '#15803D' : '#475569',
          border: copiedLink ? '1px solid #86EFAC' : '1px solid #CBD5E1',
          cursor: 'pointer', transition: 'all .2s'
        }}
      >
        {copiedLink ? <Check size={11} color="#15803D" /> : <Link2 size={11} />}
        <span>{copiedLink ? 'คัดลอกลิงก์แล้ว' : 'ลิงก์เชิญ'}</span>
      </button>
    </div>
  )
}

function StatusBadge({ inv }: { inv: Invitation }) {
  const now = new Date()
  const expired = new Date(inv.expires_at) < now && !inv.is_used
  if (inv.is_used) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#DCFCE7', color: '#15803D' }}>
      <CheckCircle2 size={11} /> ใช้แล้ว
    </span>
  )
  if (expired) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#FEE2E2', color: '#B91C1C' }}>
      <XCircle size={11} /> หมดอายุ
    </span>
  )
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#EFF3FD', color: '#315EC3' }}>
      <Clock size={11} /> ยังใช้ได้
    </span>
  )
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ shop_name: '', email: '', plan_name: 'pro', contract_months: 12, expires_days: 7 })
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('platform_token') || ''
      const res = await fetch('/api/platform/invitations', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setInvitations(data.invitations || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const token = localStorage.getItem('platform_token') || ''
      await fetch('/api/platform/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, created_by: 'platform_admin' })
      })
      setShowForm(false)
      setForm({ shop_name: '', email: '', plan_name: 'pro', contract_months: 12, expires_days: 7 })
      await load()
    } finally {
      setCreating(false)
    }
  }

  const deleteCode = async (id: string) => {
    const token = localStorage.getItem('platform_token') || ''
    await fetch('/api/platform/invitations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id })
    })
    setDeleteId(null)
    await load()
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A2340', margin: 0 }}>Invitation Codes (โค้ดเชิญร้านค้า)</h1>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
            สร้างโค้ดเชิญและส่งลิงก์ Onboarding ให้พาร์ทเนอร์ลงทะเบียนเปิดร้านและตั้งค่าสาขา ({invitations.filter(i => !i.is_used && new Date(i.expires_at) > new Date()).length} โค้ดที่พร้อมใช้งาน)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px',
              borderRadius: 14, background: '#315EC3', color: '#FFFFFF',
              border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 700,
              fontFamily: 'Kanit, sans-serif', boxShadow: '0 4px 14px rgba(49, 94, 195, 0.28)',
              transition: 'all .2s'
            }}
          >
            <Plus size={16} /> สร้างโค้ดเชิญใหม่
          </button>
          <button
            onClick={load}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
              borderRadius: 14, border: '1.5px solid #DDE3F5', background: '#FFFFFF',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Kanit, sans-serif',
              color: '#5A6589', transition: 'all .2s'
            }}
          >
            <RefreshCw size={14} /> รีเฟรช
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div style={{
          background: '#FFFFFF', border: '2px solid #315EC3',
          borderRadius: 20, padding: '22px 24px', marginBottom: 22, boxShadow: '0 6px 24px rgba(49, 94, 195, 0.09)'
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#315EC3', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ticket size={17} /> สร้าง Invitation Code สำหรับพาร์ทเนอร์ร้านค้า
          </div>
          <form onSubmit={create} style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                ชื่อร้านเป้าหมาย / บันทึกช่วยจำ (ไม่บังคับ)
              </label>
              <div style={{ position: 'relative' }}>
                <Store size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="text" placeholder="เช่น ร้านสมศักดิ์ ขอนแก่น (หรือเว้นว่างไว้)"
                  value={form.shop_name} onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px 12px 10px 34px', borderRadius: 12,
                    border: '1.5px solid #DDE3F5', fontSize: 13, fontFamily: 'Kanit, sans-serif',
                    outline: 'none', boxSizing: 'border-box', color: '#1A2340'
                  }}
                />
              </div>
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                อีเมลจำกัดสิทธิ์ (ไม่บังคับ)
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="email" placeholder="shop@email.com (เว้นว่างเพื่อให้ใครก็ได้ที่มีโค้ดเปิดใช้)"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px 12px 10px 34px', borderRadius: 12,
                    border: '1.5px solid #DDE3F5', fontSize: 13, fontFamily: 'Kanit, sans-serif',
                    outline: 'none', boxSizing: 'border-box', color: '#1A2340'
                  }}
                />
              </div>
            </div>

            <div style={{ flex: '0 1 140px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                แพ็กเกจ (Plan)
              </label>
              <select value={form.plan_name} onChange={e => setForm(f => ({ ...f, plan_name: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 12,
                  border: '1.5px solid #DDE3F5', fontSize: 13, fontFamily: 'Kanit, sans-serif',
                  outline: 'none', background: '#FFFFFF', cursor: 'pointer', color: '#1A2340'
                }}>
                <option value="starter">Starter (ฟรี)</option>
                <option value="growth">Growth</option>
                <option value="pro">Pro (แนะนำ)</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div style={{ flex: '0 1 160px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                ระยะสัญญาใช้งาน
              </label>
              <select
                value={form.contract_months}
                onChange={e => setForm(f => ({ ...f, contract_months: parseInt(e.target.value) }))}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 12,
                  border: '1.5px solid #DDE3F5', fontSize: 13, fontFamily: 'Kanit, sans-serif',
                  outline: 'none', background: '#FFFFFF', cursor: 'pointer', color: '#1A2340'
                }}
              >
                <option value={1}>1 เดือน (ทดลอง)</option>
                <option value={3}>3 เดือน</option>
                <option value={6}>6 เดือน</option>
                <option value={12}>12 เดือน (1 ปี)</option>
                <option value={24}>24 เดือน (2 ปี)</option>
              </select>
            </div>

            <div style={{ flex: '0 1 130px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                อายุโค้ด (วัน)
              </label>
              <select
                value={form.expires_days}
                onChange={e => setForm(f => ({ ...f, expires_days: parseInt(e.target.value) }))}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 12,
                  border: '1.5px solid #DDE3F5', fontSize: 13, fontFamily: 'Kanit, sans-serif',
                  outline: 'none', background: '#FFFFFF', cursor: 'pointer', color: '#1A2340'
                }}
              >
                <option value={7}>7 วัน</option>
                <option value={14}>14 วัน</option>
                <option value={30}>30 วัน</option>
                <option value={60}>60 วัน</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                type="submit"
                disabled={creating}
                style={{
                  padding: '10px 22px', borderRadius: 12, background: '#315EC3', color: '#FFFFFF',
                  border: 'none', cursor: creating ? 'not-allowed' : 'pointer', fontSize: 13.5, fontWeight: 700,
                  fontFamily: 'Kanit, sans-serif', opacity: creating ? .7 : 1,
                  boxShadow: '0 4px 12px rgba(49, 94, 195, 0.25)'
                }}
              >
                {creating ? 'กำลังสร้าง...' : 'สร้างโค้ด'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  padding: '10px 16px', borderRadius: 12, background: '#F1F5F9',
                  color: '#475569', border: '1px solid #CBD5E1',
                  cursor: 'pointer', fontSize: 13, fontFamily: 'Kanit, sans-serif'
                }}
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div style={{
        background: '#FFFFFF', border: '1.5px solid #DDE3F5',
        borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748B' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block', color: '#315EC3' }} />
            กำลังโหลดข้อมูล...
          </div>
        ) : invitations.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#64748B', fontSize: 14 }}>
            <Ticket size={36} style={{ margin: '0 auto 14px', display: 'block', color: '#94A3B8' }} />
            ยังไม่มี Invitation Codes — กดปุ่ม &quot;+ สร้างโค้ดเชิญใหม่&quot; ด้านบนเพื่อสร้างโค้ดสำหรับร้านพาร์ทเนอร์
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['โค้ดเชิญ & ลิงก์เปิดร้าน', 'ร้านเป้าหมาย / ผู้สมัคร', 'แพ็กเกจ', 'ระยะเวลาสัญญา', 'สถานะ', 'หมดอายุ', 'สร้างเมื่อ', ''].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 700,
                      color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em',
                      borderBottom: '1.5px solid #DDE3F5', whiteSpace: 'nowrap'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invitations.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #EEF2F6' }}>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <CodeBadge code={inv.code} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {inv.is_used && inv.shop_name ? (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2340', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Store size={13} style={{ color: '#315EC3' }} />
                            {inv.shop_name}
                          </div>
                          {inv.email && <div style={{ fontSize: 11, color: '#64748B' }}>{inv.email}</div>}
                        </div>
                      ) : inv.shop_name ? (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2340' }}>{inv.shop_name}</div>
                          {inv.email && <div style={{ fontSize: 11, color: '#64748B' }}>{inv.email}</div>}
                        </div>
                      ) : inv.email ? (
                        <span style={{ fontSize: 13, color: '#1A2340' }}>{inv.email}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#64748B' }}>เปิดกว้าง (ใครก็ได้ที่มีโค้ด)</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        background: PLAN_COLORS[inv.base_plan || inv.plan_name]?.bg || '#F3F4F6',
                        color: PLAN_COLORS[inv.base_plan || inv.plan_name]?.color || '#374151',
                        textTransform: 'uppercase'
                      }}>
                        {inv.base_plan || inv.plan_name}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE'
                      }}>
                        <Calendar size={12} />
                        {inv.contract_months ? `${inv.contract_months} เดือน` : '12 เดือน'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}><StatusBadge inv={inv} /></td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>{fmt(inv.expires_at)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>{fmt(inv.created_at)}</td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      {!inv.is_used && (
                        deleteId === inv.id ? (
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => deleteCode(inv.id)} style={{
                              padding: '4px 10px', borderRadius: 8, background: '#FEE2E2',
                              color: '#B91C1C', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700
                            }}>ลบ</button>
                            <button onClick={() => setDeleteId(null)} style={{
                              padding: '4px 8px', borderRadius: 8, background: '#F1F5F9',
                              color: '#64748B', border: 'none', cursor: 'pointer', fontSize: 11
                            }}>ยกเลิก</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteId(inv.id)} title="ลบโค้ดนี้" style={{
                            padding: '4px 9px', borderRadius: 8, background: 'transparent',
                            color: '#64748B', border: '1.5px solid #DDE3F5', cursor: 'pointer'
                          }}>
                            <Trash2 size={13} />
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
