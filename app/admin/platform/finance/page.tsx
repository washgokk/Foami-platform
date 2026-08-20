'use client'
import { useState, useEffect } from 'react'
import {
  Wallet, Clock, CheckCircle, XCircle, RefreshCw,
  ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp
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
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = async (status?: string) => {
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

  useEffect(() => { load(filter === 'all' ? undefined : filter) }, [filter])

  // BUG-05 FIX: added 'complete' action for approved withdrawals
  const act = async (id: string, action: 'approve' | 'reject' | 'complete') => {
    setActionLoading(id + action)
    try {
      const token = localStorage.getItem('platform_token') || ''
      await fetch('/api/platform/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action, admin_note: adminNote[id] || '' })
      })
      await load(filter === 'all' ? undefined : filter)
    } finally {
      setActionLoading(null)
    }
  }

  const total = withdrawals.reduce((s, w) => s + w.amount_thb, 0)
  const pending = withdrawals.filter(w => w.status === 'pending')

  const fmt = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>การเงิน &amp; Withdrawals</h1>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>อนุมัติการถอนเงินของร้านพาร์ทเนอร์</div>
      </div>

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
                {pending.length} รายการรอดำเนินการ
              </div>
              <div style={{ fontSize: 12, color: '#B45309' }}>
                ยอดรวม ฿{pending.reduce((s, w) => s + w.amount_thb, 0).toLocaleString('th')}
              </div>
            </div>
          </div>
          <button onClick={() => setFilter('pending')} style={{
            padding: '7px 14px', borderRadius: 10, background: '#92400E', color: '#FEF3C7',
            border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Kanit, sans-serif'
          }}>
            ดูรายการ Pending
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 16px', borderRadius: 12, border: '1.5px solid',
            borderColor: filter === f ? 'var(--brand)' : 'var(--border)',
            background: filter === f ? 'var(--brand-ghost)' : 'var(--surface)',
            color: filter === f ? 'var(--brand)' : 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Kanit, sans-serif'
          }}>
            {{ all: 'ทั้งหมด', pending: 'รอดำเนินการ', approved: 'อนุมัติ', rejected: 'ปฏิเสธ' }[f]}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block' }} />
          </div>
        ) : withdrawals.length === 0 ? (
          <div style={{
            padding: 48, textAlign: 'center', color: 'var(--text-muted)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20
          }}>
            <Wallet size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: .3 }} />
            <div style={{ fontSize: 14 }}>ไม่มีรายการ</div>
          </div>
        ) : withdrawals.map(wr => {
          const cfg = STATUS_CONFIG[wr.status]
          const Icon = cfg.icon
          const expanded = expandedId === wr.id
          return (
            <div key={wr.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-card)'
            }}>
              {/* Row */}
              <div style={{
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                cursor: 'pointer'
              }} onClick={() => setExpandedId(expanded ? null : wr.id)}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: cfg.bg, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Icon size={18} color={cfg.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {wr.shop_name || wr.shop_id}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                      background: cfg.bg, color: cfg.color
                    }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {wr.bank_name} — {wr.account_number} ({wr.account_name})
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                    ฿{wr.amount_thb.toLocaleString('th')}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmt(wr.created_at)}</div>
                </div>
                {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
              </div>

              {/* Expand */}
              {expanded && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', background: 'var(--surface-2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    {[
                      { label: 'ธนาคาร', value: wr.bank_name },
                      { label: 'เลขบัญชี', value: wr.account_number },
                      { label: 'ชื่อบัญชี', value: wr.account_name },
                    ].map(f => (
                      <div key={f.label}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{f.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{f.value}</div>
                      </div>
                    ))}
                  </div>

                  {wr.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>
                          หมายเหตุ (ไม่บังคับ)
                        </label>
                        <input
                          type="text" placeholder="เช่น: โอนแล้ว 14:30 น."
                          value={adminNote[wr.id] || ''}
                          onChange={e => setAdminNote(n => ({ ...n, [wr.id]: e.target.value }))}
                          style={{
                            width: '100%', padding: '9px 12px', borderRadius: 10,
                            border: '1.5px solid var(--border)', fontSize: 13,
                            fontFamily: 'Kanit, sans-serif', outline: 'none', boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <button
                        onClick={() => act(wr.id, 'approve')}
                        disabled={!!actionLoading}
                        style={{
                          padding: '9px 18px', borderRadius: 12, background: '#22C55E', color: '#fff',
                          border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                          fontFamily: 'Kanit, sans-serif', display: 'flex', alignItems: 'center', gap: 6,
                          opacity: actionLoading ? .6 : 1
                        }}>
                        <CheckCircle size={14} /> อนุมัติ
                      </button>
                      <button
                        onClick={() => act(wr.id, 'reject')}
                        disabled={!!actionLoading}
                        style={{
                          padding: '9px 18px', borderRadius: 12, background: '#FEE2E2', color: '#B91C1C',
                          border: '1.5px solid #FCA5A5', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                          fontFamily: 'Kanit, sans-serif', display: 'flex', alignItems: 'center', gap: 6,
                          opacity: actionLoading ? .6 : 1
                        }}>
                        <XCircle size={14} /> ปฏิเสธ
                      </button>
                    </div>
                  )}

                  {wr.admin_note && (
                    <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
                      <strong>หมายเหตุ:</strong> {wr.admin_note}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
