'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Store, Search, CheckCircle, XCircle, RefreshCw,
  ChevronDown, ExternalLink, Wallet, ClipboardList,
  Key, Mail, Lock, Eye, EyeOff, X, AlertCircle, CheckCircle2,
  TrendingUp, ArrowUpRight
} from 'lucide-react'

interface Shop {
  id: string
  name: string
  slug: string
  address: string
  is_active: boolean
  created_at: string
  booking_count: number
  completed_count?: number
  total_revenue: number
  wallet?: { balance_thb: number; total_earned_thb: number }
  platform_fee_pct?: number
}

function Badge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
      background: active ? '#DCFCE7' : '#FEE2E2',
      color: active ? '#15803D' : '#B91C1C',
      border: `1px solid ${active ? '#BBF7D0' : '#FECACA'}`
    }}>
      {active ? <CheckCircle size={12} /> : <XCircle size={12} />}
      {active ? 'เปิดใช้งาน' : 'ระงับบริการ'}
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
        setResult({ success: true, message: action === 'set' ? `ตั้งค่าบัญชีเรียบร้อยแล้ว (${data.email})` : 'รีเซ็ตรหัสผ่านเรียบร้อยแล้ว' })
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
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: 'var(--surface, #FFFFFF)', borderRadius: 24, padding: '28px',
        width: 440, maxWidth: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.18)', position: 'relative',
        border: '1.5px solid var(--border, #DDE3F5)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary, #1A2340)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={19} color="var(--brand-dominant, #315EC3)" /> จัดการบัญชีผู้ดูแลร้าน
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary, #5A6589)', marginTop: 4 }}>
              ร้าน: <strong>{shop.name}</strong> (/{shop.slug})
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface-2, #F0F3FC)', border: 'none', borderRadius: 10, cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Status */}
        {checking ? (
          <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>กำลังตรวจสอบสถานะบัญชี...</div>
        ) : (
          <div style={{
            padding: '12px 16px', borderRadius: 14, marginBottom: 18,
            background: existing.has_admin ? '#DCFCE7' : '#FEF3C7',
            color: existing.has_admin ? '#166534' : '#92400E',
            fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
          }}>
            {existing.has_admin ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {existing.has_admin
              ? `มีบัญชีผู้ดูแลร้านแล้ว: ${existing.email}`
              : 'ยังไม่มีบัญชีผู้ดูแลร้าน — กรอกอีเมลและรหัสผ่านเพื่อสร้างบัญชี'}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              อีเมลแอดมินสาขา
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                required
                placeholder="admin@foami.th"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={existing.has_admin}
                style={{
                  width: '100%', padding: '11px 14px 11px 38px', borderRadius: 12,
                  border: '1.5px solid var(--border, #DDE3F5)', fontSize: 13.5, fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box',
                  background: existing.has_admin ? 'var(--surface-2, #F0F3FC)' : 'var(--surface, #FFFFFF)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              {existing.has_admin ? 'รหัสผ่านใหม่ (เพื่อรีเซ็ต)' : 'รหัสผ่าน'}
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type={showPass ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%', padding: '11px 40px 11px 38px', borderRadius: 12,
                  border: '1.5px solid var(--border, #DDE3F5)', fontSize: 13.5, fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4
              }}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
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
                width: '100%', padding: '11px 14px', borderRadius: 12,
                border: `1.5px solid ${confirmPassword && password !== confirmPassword ? '#EF4444' : 'var(--border, #DDE3F5)'}`,
                fontSize: 13.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {result && (
            <div style={{
              padding: '12px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600,
              background: result.success ? '#DCFCE7' : '#FEE2E2',
              color: result.success ? '#15803D' : '#B91C1C',
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              {result.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {result.message || result.error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || checking}
            style={{
              marginTop: 6,
              padding: '13px', borderRadius: 14, background: 'var(--brand-dominant, #315EC3)', color: '#fff',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700,
              fontFamily: 'inherit', opacity: loading ? .7 : 1, display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 14px rgba(49, 94, 195, 0.25)'
            }}
          >
            <Key size={16} />
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
        body: JSON.stringify({ shop_id: shop.id, is_active: !shop.is_active })
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
      body: JSON.stringify({ shop_id: shopId, platform_fee_pct: pct / 100 })
    })
    setExpandedFee(null)
    await load()
  }

  const filtered = shops.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.slug?.toLowerCase().includes(search.toLowerCase())
  )

  const totalPlatformRevenue = shops.reduce((s, sh) => s + (sh.total_revenue || 0), 0)
  const totalCompletedBookings = shops.reduce((s, sh) => s + (sh.completed_count || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Credential Modal */}
      {credModal && (
        <CredentialModal shop={credModal} token={token} onClose={() => setCredModal(null)} />
      )}

      {/* Header & Quick Summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary, #1A2340)', margin: 0 }}>
            ร้านพาร์ทเนอร์ในระบบ
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-secondary, #5A6589)', marginTop: 4 }}>
            บริหารจัดการสาขา ตรวจสอบรายได้ กำหนดค่าธรรมเนียม และมอบสิทธิ์การเข้าใช้งาน
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/admin/platform/invitations" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
            borderRadius: 14, background: 'var(--brand-dominant, #315EC3)', color: '#fff',
            textDecoration: 'none', fontSize: 13.5, fontWeight: 700,
            boxShadow: '0 4px 14px rgba(49, 94, 195, 0.25)'
          }}>
            + สร้างเทียบเชิญร้านค้า
          </Link>
          <button onClick={load} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
            borderRadius: 14, border: '1.5px solid var(--border, #DDE3F5)', background: 'var(--surface, #FFFFFF)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            color: 'var(--text-secondary)'
          }}>
            <RefreshCw size={14} /> รีเฟรช
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16
      }}>
        <div style={{
          background: 'var(--surface, #FFFFFF)',
          border: '1.5px solid var(--border, #DDE3F5)',
          borderRadius: 20,
          padding: '18px 20px',
          boxShadow: '0 4px 14px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            จำนวนร้านทั้งหมด
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>
            {shops.length} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>สาขา</span>
          </div>
        </div>

        <div style={{
          background: 'var(--surface, #FFFFFF)',
          border: '1.5px solid var(--border, #DDE3F5)',
          borderRadius: 20,
          padding: '18px 20px',
          boxShadow: '0 4px 14px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            ยอดงานเสร็จสิ้นทั้งหมด
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--brand-dominant, #315EC3)', marginTop: 4 }}>
            {totalCompletedBookings} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>งาน</span>
          </div>
        </div>

        <div style={{
          background: 'var(--surface, #FFFFFF)',
          border: '1.5px solid var(--border, #DDE3F5)',
          borderRadius: 20,
          padding: '18px 20px',
          boxShadow: '0 4px 14px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            ยอดรายได้รวมทุกร้าน
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#16A34A', marginTop: 4 }}>
            ฿{totalPlatformRevenue.toLocaleString('th', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="ค้นหาชื่อร้าน หรือ slug..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '12px 16px 12px 42px', borderRadius: 16,
            border: '1.5px solid var(--border, #DDE3F5)', fontSize: 14, outline: 'none',
            fontFamily: 'inherit', color: 'var(--text-primary)', background: 'var(--surface, #FFFFFF)',
            boxSizing: 'border-box', boxShadow: '0 2px 8px rgba(49, 94, 195, 0.02)'
          }}
        />
      </div>

      {/* Shops Table */}
      <div style={{
        background: 'var(--surface, #FFFFFF)', border: '1.5px solid var(--border, #DDE3F5)',
        borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 16px rgba(49, 94, 195, 0.04)'
      }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} />
            กำลังโหลดข้อมูลร้านค้า...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            <Store size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: .4 }} />
            ไม่พบร้านค้าในระบบ
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2, #F0F3FC)', borderBottom: '1.5px solid var(--border, #DDE3F5)' }}>
                  <th style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>ชื่อร้าน / สาขา</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>งานทั้งหมด</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>รายได้รวม (เสร็จสิ้น)</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>ยอดเงินร้าน (Wallet)</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>ค่า Fee แพลตฟอร์ม</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>สถานะ</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>จัดการบัญชี</th>
                  <th style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(shop => (
                  <tr key={shop.id} style={{ borderBottom: '1px solid var(--border, #DDE3F5)', transition: 'background 0.15s' }}>
                    {/* Shop Info */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 12, background: 'var(--primary-ghost, #EFF3FD)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          border: '1px solid rgba(49, 94, 195, 0.15)'
                        }}>
                          <Store size={20} color="var(--brand-dominant, #315EC3)" />
                        </div>
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)' }}>{shop.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>/{shop.slug}</div>
                        </div>
                      </div>
                    </td>

                    {/* Bookings */}
                    <td style={{ padding: '16px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ClipboardList size={15} color="var(--text-muted)" />
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {shop.completed_count ?? shop.booking_count}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>งาน</span>
                      </div>
                    </td>

                    {/* Revenue */}
                    <td style={{ padding: '16px 16px' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#16A34A' }}>
                        ฿{(shop.total_revenue || 0).toLocaleString('th', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--brand-dominant, #315EC3)', fontWeight: 600 }}>
                        Fee {((shop.platform_fee_pct || 0.2) * 100).toFixed(0)}%: ฿{((shop.total_revenue || 0) * (shop.platform_fee_pct || 0.2)).toLocaleString('th', { maximumFractionDigits: 1 })}
                      </div>
                    </td>

                    {/* Wallet */}
                    <td style={{ padding: '16px 16px' }}>
                      {shop.wallet ? (
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                            ฿{(shop.wallet.balance_thb || 0).toLocaleString('th')}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>คงเหลือ</div>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
                    </td>

                    {/* Platform Fee Setting */}
                    <td style={{ padding: '16px 16px' }}>
                      {expandedFee === shop.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="number" min="0" max="100" step="1"
                            value={feeInput[shop.id] ?? ((shop.platform_fee_pct || 0.2) * 100).toString()}
                            onChange={e => setFeeInput(f => ({ ...f, [shop.id]: e.target.value }))}
                            style={{
                              width: 54, padding: '6px 8px', borderRadius: 8, border: '1.5px solid var(--brand-dominant, #315EC3)',
                              fontSize: 12.5, fontFamily: 'inherit', textAlign: 'center', outline: 'none'
                            }}
                          />
                          <button onClick={() => updateFee(shop.id)} style={{
                            padding: '6px 10px', borderRadius: 8, background: 'var(--brand-dominant, #315EC3)', color: '#fff',
                            border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700
                          }}>บันทึก</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setExpandedFee(shop.id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)',
                            background: 'var(--surface-2, #F0F3FC)', cursor: 'pointer', fontSize: 12.5,
                            fontWeight: 700, color: 'var(--text-primary)'
                          }}
                        >
                          {((shop.platform_fee_pct || 0.2) * 100).toFixed(0)}% <ChevronDown size={13} />
                        </button>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '16px 16px' }}>
                      <Badge active={shop.is_active} />
                    </td>

                    {/* Credential Action */}
                    <td style={{ padding: '16px 16px' }}>
                      <button
                        onClick={() => setCredModal(shop)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '7px 12px', borderRadius: 10,
                          background: 'var(--primary-ghost, #EFF3FD)',
                          color: 'var(--brand-dominant, #315EC3)',
                          border: '1px solid rgba(49, 94, 195, 0.2)',
                          cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                          fontFamily: 'inherit'
                        }}
                      >
                        <Key size={13} /> ตั้งรหัสแอดมิน
                      </button>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Link
                          href={`/${shop.slug}`}
                          target="_blank"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '7px 12px', borderRadius: 10,
                            background: 'var(--surface-2, #F0F3FC)', color: 'var(--text-secondary)',
                            textDecoration: 'none', fontSize: 12, fontWeight: 600
                          }}
                        >
                          หน้าร้าน <ExternalLink size={12} />
                        </Link>

                        <button
                          onClick={() => toggleActive(shop)}
                          disabled={actionLoading === shop.id}
                          style={{
                            padding: '7px 12px', borderRadius: 10,
                            background: shop.is_active ? '#FEE2E2' : '#DCFCE7',
                            color: shop.is_active ? '#B91C1C' : '#15803D',
                            border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                            fontFamily: 'inherit'
                          }}
                        >
                          {shop.is_active ? 'ระงับ' : 'เปิด'}
                        </button>
                      </div>
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
