'use client'
import { useState, useEffect, useRef } from 'react'
import {
  Ticket, Plus, Copy, Check, Trash2, RefreshCw,
  Clock, CheckCircle2, XCircle, Mail
} from 'lucide-react'

interface Invitation {
  id: string
  code: string
  email: string | null
  plan_name: string
  is_used: boolean
  expires_at: string
  used_at: string | null
  shop_name: string | null
  created_at: string
  created_by: string | null
}

const PLAN_COLORS: Record<string, { bg: string; color: string }> = {
  starter: { bg: '#F3F4F6', color: '#374151' },
  growth: { bg: '#DCFCE7', color: '#15803D' },
  pro: { bg: '#EDE9FE', color: '#6D28D9' },
  enterprise: { bg: '#FEF3C7', color: '#92400E' },
}

function CodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '5px 12px', borderRadius: 10, fontSize: 13, fontWeight: 700,
      background: 'var(--brand-ghost)', color: 'var(--brand)',
      border: '1.5px solid #BDD0F9', cursor: 'pointer', fontFamily: 'monospace',
      letterSpacing: '.06em', transition: 'all .2s'
    }}>
      {code}
      {copied ? <Check size={12} color="#22C55E" /> : <Copy size={12} />}
    </button>
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
  const [form, setForm] = useState({ email: '', plan_name: 'starter', expires_days: 7 })
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
      setForm({ email: '', plan_name: 'starter', expires_days: 7 })
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
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Invitation Codes</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {invitations.filter(i => !i.is_used && new Date(i.expires_at) > new Date()).length} codes ที่ยังใช้ได้
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowForm(!showForm)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
            borderRadius: 12, background: 'var(--brand)', color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: 'Kanit, sans-serif', boxShadow: 'var(--shadow-brand)'
          }}>
            <Plus size={15} /> สร้าง Code ใหม่
          </button>
          <button onClick={load} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
            borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)',
            cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Kanit, sans-serif',
            color: 'var(--text-secondary)'
          }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div style={{
          background: 'var(--surface)', border: '2px solid var(--brand)',
          borderRadius: 20, padding: '22px 24px', marginBottom: 20, boxShadow: '0 0 0 4px var(--brand-ghost)'
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ticket size={16} /> สร้าง Invitation Code ใหม่
          </div>
          <form onSubmit={create} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Email ร้าน (ไม่บังคับ)
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="email" placeholder="shop@email.com"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px 12px 10px 34px', borderRadius: 12,
                    border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'Kanit, sans-serif',
                    outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
            <div style={{ flex: '0 1 140px' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Plan
              </label>
              <select value={form.plan_name} onChange={e => setForm(f => ({ ...f, plan_name: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 12,
                  border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'Kanit, sans-serif',
                  outline: 'none', background: 'var(--surface)', cursor: 'pointer'
                }}>
                <option value="starter">Starter (ฟรี)</option>
                <option value="growth">Growth (฿299/เดือน)</option>
                <option value="pro">Pro (฿790/เดือน)</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div style={{ flex: '0 1 140px' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                หมดอายุใน (วัน)
              </label>
              <input
                type="number" min="1" max="90" value={form.expires_days}
                onChange={e => setForm(f => ({ ...f, expires_days: parseInt(e.target.value) }))}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 12,
                  border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'Kanit, sans-serif',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <button type="submit" disabled={creating} style={{
              padding: '10px 20px', borderRadius: 12, background: 'var(--brand)', color: '#fff',
              border: 'none', cursor: creating ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700,
              fontFamily: 'Kanit, sans-serif', opacity: creating ? .7 : 1
            }}>
              {creating ? 'กำลังสร้าง...' : 'สร้าง Code'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{
              padding: '10px 16px', borderRadius: 12, background: 'var(--surface-2)',
              color: 'var(--text-muted)', border: '1.5px solid var(--border)',
              cursor: 'pointer', fontSize: 13, fontFamily: 'Kanit, sans-serif'
            }}>
              ยกเลิก
            </button>
          </form>
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--shadow-card)'
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block' }} />
            กำลังโหลด...
          </div>
        ) : invitations.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            <Ticket size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: .3 }} />
            ยังไม่มี Invitation Codes
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Code', 'Email ร้าน', 'Plan', 'สถานะ', 'หมดอายุ', 'สร้างเมื่อ', ''].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em',
                    borderBottom: '1px solid var(--border)'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invitations.map(inv => (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px' }}><CodeBadge code={inv.code} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    {inv.email
                      ? <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{inv.email}</span>
                      : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: PLAN_COLORS[inv.plan_name]?.bg || '#F3F4F6',
                      color: PLAN_COLORS[inv.plan_name]?.color || '#374151'
                    }}>
                      {inv.plan_name}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge inv={inv} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{fmt(inv.expires_at)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{fmt(inv.created_at)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {!inv.is_used && (
                      deleteId === inv.id ? (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => deleteCode(inv.id)} style={{
                            padding: '4px 10px', borderRadius: 8, background: '#FEE2E2',
                            color: '#B91C1C', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700
                          }}>ลบ</button>
                          <button onClick={() => setDeleteId(null)} style={{
                            padding: '4px 8px', borderRadius: 8, background: 'var(--surface-2)',
                            color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 11
                          }}>ยกเลิก</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteId(inv.id)} style={{
                          padding: '4px 9px', borderRadius: 8, background: 'transparent',
                          color: 'var(--text-muted)', border: '1.5px solid var(--border)', cursor: 'pointer'
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
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
