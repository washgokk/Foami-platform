'use client'
import { useState, useEffect } from 'react'
import {
  Store, Search, CheckCircle, XCircle, RefreshCw,
  ChevronDown, ExternalLink, Wallet, ClipboardList,
  Key, Mail, Lock, Eye, EyeOff, X, AlertCircle, CheckCircle2
} from 'lucide-react'

interface Shop {
  id: string
  name: string
  slug: string
  address: string
  is_active: boolean
  created_at: string
  booking_count: number
  total_revenue: number
  wallet?: { balance_thb: number; total_earned_thb: number }
  platform_fee_pct?: number
}

function Badge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: active ? '#DCFCE7' : '#FEE2E2',
      color: active ? '#15803D' : '#B91C1C'
    }}>
      {active ? <CheckCircle size={11} /> : <XCircle size={11} />}
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

interface CredentialModalProps {
  shop: Shop
  token: string
  onClose: () => void
}

function CredentialModal({ shop, token, onClose }: CredentialModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [existing, setExisting] = useState<{ email: string | null; has_admin: boolean }>({ email: null, has_admin: false })
  const [result, setResult] = useState<{ success?: boolean; error?: string; message?: string } | null>(null)

  useEffect(() => {
    setChecking(true)
    fetch('/api/platform/partner-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'get', branch_slug: shop.slug })
    })
      .then(r => r.json())
      .then(d => {
        setExisting({ email: d.email, has_admin: d.has_admin })
        if (d.email) setEmail(d.email)
      })
      .finally(() => setChecking(false))
  }, [shop.slug, token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setResult({ error: 'รหัสผ่านไม่ตรงกัน' })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const action = existing.has_admin && !email ? 'reset' : 'set'
      const res = await fetch('/api/platform/partner-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, branch_slug: shop.slug, email, password })
      })
      const data = await res.json()
      if (data.success) {
        setResult({ success: true, message: action === 'set' ? `ตั้งค่า credential เรียบร้อยแล้ว (${data.email})` : 'รีเซ็ตรหัสผ่านเรียบร้อยแล้ว' })
        setExisting({ email: data.email || email, has_admin: true })
        setPassword('')
        setConfirmPassword('')
      } else {
        setResult({ error: data.error || 'เกิดข้อผิดพลาด' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 22, padding: '28px 30px',
        width: 440, maxWidth: '95vw', boxShadow: 'var(--shadow-lg)', position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={18} color="var(--brand)" /> จัดการรหัสเข้าระบบ
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              ร้าน: <strong>{shop.name}</strong> (/{shop.slug})
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Current Status */}
        {checking ? (
          <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>กำลังตรวจสอบ...</div>
        ) : (
          <div style={{
            padding: '10px 14px', borderRadius: 12, marginBottom: 18,
            background: existing.has_admin ? '#DCFCE7' : '#FEF3C7',
            color: existing.has_admin ? '#166534' : '#92400E',
            fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7
          }}>
            {existing.has_admin ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {existing.has_admin
              ? `มีบัญชีอยู่แล้ว: ${existing.email}`
              : 'ยังไม่มีบัญชีผู้ดูแลร้านนี้ — กรอกข้อมูลเพื่อสร้างบัญชีใหม่'}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Email */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              อีเมล (Email)
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                required
                placeholder="shop@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={existing.has_admin}
                style={{
                  width: '100%', padding: '10px 12px 10px 34px', borderRadius: 12,
                  border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'Kanit, sans-serif',
                  outline: 'none', boxSizing: 'border-box',
                  background: existing.has_admin ? 'var(--surface-2)' : 'var(--surface)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
            {existing.has_admin && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                ไม่สามารถเปลี่ยนอีเมลได้ หากต้องการเปลี่ยน ให้ลบบัญชีเดิมและสร้างใหม่
              </div>
            )}
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {existing.has_admin ? 'รหัสผ่านใหม่ (Reset Password)' : 'รหัสผ่าน (Password)'}
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type={showPass ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%', padding: '10px 36px 10px 34px', borderRadius: 12,
                  border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'Kanit, sans-serif',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
              }}>
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              ยืนยันรหัสผ่าน
            </label>
            <input
              type={showPass ? 'text' : 'password'}
              required
              minLength={6}
              placeholder="ยืนยันรหัสผ่านอีกครั้ง"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 12,
                border: `1.5px solid ${confirmPassword && password !== confirmPassword ? '#EF4444' : 'var(--border)'}`,
                fontSize: 13, fontFamily: 'Kanit, sans-serif', outline: 'none', boxSizing: 'border-box'
              }}
            />
            {confirmPassword && password !== confirmPassword && (
              <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>รหัสผ่านไม่ตรงกัน</div>
            )}
          </div>

          {/* Result message */}
          {result && (
            <div style={{
              padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 600,
              background: result.success ? '#DCFCE7' : '#FEE2E2',
              color: result.success ? '#15803D' : '#B91C1C',
              display: 'flex', alignItems: 'center', gap: 7
            }}>
              {result.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {result.message || result.error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || checking}
            style={{
              padding: '11px 20px', borderRadius: 14, background: 'var(--brand)', color: '#fff',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700,
              fontFamily: 'Kanit, sans-serif', opacity: loading ? .7 : 1, display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 7
            }}
          >
            <Key size={14} />
            {loading ? 'กำลังบันทึก...' : existing.has_admin ? 'รีเซ็ตรหัสผ่าน' : 'สร้างบัญชีผู้ดูแลร้าน'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function PlatformShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedFee, setExpandedFee] = useState<string | null>(null)
  const [feeInput, setFeeInput] = useState<Record<string, string>>({})
  const [credModal, setCredModal] = useState<Shop | null>(null)
  const [token, setToken] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') setToken(localStorage.getItem('platform_token') || '')
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const t = typeof window !== 'undefined' ? localStorage.getItem('platform_token') || '' : ''
      const res = await fetch('/api/platform/shops', { headers: { Authorization: `Bearer ${t}` } })
      const data = await res.json()
      setShops(data.shops || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggleActive = async (shop: Shop) => {
    setActionLoading(shop.id)
    try {
      const t = localStorage.getItem('platform_token') || ''
      await fetch('/api/platform/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ id: shop.id, is_active: !shop.is_active })
      })
      await load()
    } finally {
      setActionLoading(null)
    }
  }

  const updateFee = async (shopId: string) => {
    const pct = parseFloat(feeInput[shopId])
    if (isNaN(pct)) return
    const t = localStorage.getItem('platform_token') || ''
    await fetch('/api/platform/shops', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ id: shopId, platform_fee_pct: pct / 100 })
    })
    setExpandedFee(null)
    await load()
  }

  const filtered = shops.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.slug?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      {/* Credential Modal */}
      {credModal && (
        <CredentialModal shop={credModal} token={token} onClose={() => setCredModal(null)} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>ร้านพาร์ทเนอร์</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{shops.length} ร้านทั้งหมด</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/admin/invitations" style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
            borderRadius: 12, background: 'var(--brand)', color: '#fff',
            textDecoration: 'none', fontSize: 13, fontWeight: 600,
            boxShadow: 'var(--shadow-brand)'
          }}>
            + Invite Shop
          </a>
          <button onClick={load} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
            borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)',
            cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Kanit, sans-serif',
            color: 'var(--text-secondary)'
          }}>
            <RefreshCw size={13} /> รีเฟรช
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 18 }}>
        <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="ค้นหาชื่อร้าน หรือ slug..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px 10px 38px', borderRadius: 14,
            border: '1.5px solid var(--border)', fontSize: 13, outline: 'none',
            fontFamily: 'Kanit, sans-serif', color: 'var(--text-primary)', background: 'var(--surface)',
            boxSizing: 'border-box'
          }}
        />
      </div>

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
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            <Store size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: .3 }} />
            ไม่พบร้าน
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['ชื่อร้าน', 'งาน', 'รายได้', 'Wallet', 'Fee %', 'สถานะ', 'Credential', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em',
                    borderBottom: '1px solid var(--border)'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(shop => (
                <tr key={shop.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Shop Name */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10, background: 'var(--brand-ghost)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Store size={16} color="var(--brand)" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{shop.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>/{shop.slug}</div>
                      </div>
                    </div>
                  </td>
                  {/* Bookings */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <ClipboardList size={13} color="var(--text-muted)" />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{shop.booking_count}</span>
                    </div>
                  </td>
                  {/* Revenue */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      ฿{(shop.total_revenue || 0).toLocaleString('th')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 500 }}>
                      fee: ฿{((shop.total_revenue || 0) * (shop.platform_fee_pct || 0.2)).toLocaleString('th', { maximumFractionDigits: 0 })}
                    </div>
                  </td>
                  {/* Wallet */}
                  <td style={{ padding: '14px 16px' }}>
                    {shop.wallet ? (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#22C55E' }}>
                          ฿{(shop.wallet.balance_thb || 0).toLocaleString('th')}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>คงเหลือ</div>
                      </div>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                  </td>
                  {/* Fee */}
                  <td style={{ padding: '14px 16px' }}>
                    {expandedFee === shop.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="number" min="0" max="100" step="1"
                          value={feeInput[shop.id] ?? ((shop.platform_fee_pct || 0.2) * 100).toString()}
                          onChange={e => setFeeInput(f => ({ ...f, [shop.id]: e.target.value }))}
                          style={{
                            width: 54, padding: '5px 8px', borderRadius: 8, border: '1.5px solid var(--border)',
                            fontSize: 12, fontFamily: 'Kanit, sans-serif', textAlign: 'center'
                          }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>%</span>
                        <button onClick={() => updateFee(shop.id)} style={{
                          padding: '4px 8px', borderRadius: 7, background: 'var(--brand)', color: '#fff',
                          border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'Kanit, sans-serif'
                        }}>บันทึก</button>
                        <button onClick={() => setExpandedFee(null)} style={{
                          padding: '4px 7px', borderRadius: 7, background: 'var(--surface-2)',
                          color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 11
                        }}>ยกเลิก</button>
                      </div>
                    ) : (
                      <button onClick={() => { setExpandedFee(shop.id); setFeeInput(f => ({ ...f, [shop.id]: ((shop.platform_fee_pct || 0.2) * 100).toString() })) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                          borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)',
                          cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Kanit, sans-serif',
                          color: 'var(--text-primary)'
                        }}>
                        {((shop.platform_fee_pct || 0.2) * 100).toFixed(0)}% <ChevronDown size={11} />
                      </button>
                    )}
                  </td>
                  {/* Status */}
                  <td style={{ padding: '14px 16px' }}>
                    <Badge active={shop.is_active !== false} />
                  </td>
                  {/* Credential button */}
                  <td style={{ padding: '14px 16px' }}>
                    <button
                      onClick={() => setCredModal(shop)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px',
                        borderRadius: 9, border: '1.5px solid #DDD6FE', background: '#EDE9FE',
                        color: '#6D28D9', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        fontFamily: 'Kanit, sans-serif'
                      }}
                    >
                      <Key size={12} /> ตั้งรหัส
                    </button>
                  </td>
                  {/* Actions */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => toggleActive(shop)}
                        disabled={actionLoading === shop.id}
                        style={{
                          padding: '5px 11px', borderRadius: 9, fontSize: 11, fontWeight: 600,
                          border: '1.5px solid', cursor: 'pointer', fontFamily: 'Kanit, sans-serif',
                          background: shop.is_active !== false ? '#FEE2E2' : '#DCFCE7',
                          borderColor: shop.is_active !== false ? '#FCA5A5' : '#86EFAC',
                          color: shop.is_active !== false ? '#B91C1C' : '#15803D',
                          opacity: actionLoading === shop.id ? 0.5 : 1
                        }}>
                        {actionLoading === shop.id ? '...' : shop.is_active !== false ? 'Suspend' : 'Activate'}
                      </button>
                      <a href={`/${shop.slug}`} target="_blank" rel="noreferrer" style={{
                        padding: '5px 9px', borderRadius: 9, border: '1.5px solid var(--border)',
                        background: 'var(--surface)', color: 'var(--text-muted)', display: 'flex',
                        alignItems: 'center', gap: 3
                      }}>
                        <ExternalLink size={11} />
                      </a>
                    </div>
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
