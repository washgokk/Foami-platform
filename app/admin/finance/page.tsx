'use client'
import { useState, useEffect } from 'react'
import {
  Wallet, ArrowDownLeft, TrendingUp, Clock, CheckCircle,
  XCircle, RefreshCw, Plus, Building2, Phone, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface WalletData {
  balance_thb: number
  pending_thb: number
  total_earned_thb: number
  total_withdrawn_thb: number
}

interface Withdrawal {
  id: string
  amount_thb: number
  bank_name: string
  account_number: string
  account_name: string
  status: 'pending' | 'approved' | 'completed' | 'rejected'
  admin_note: string | null
  created_at: string
  resolved_at: string | null
}

interface LedgerEntry {
  id: string
  type: 'credit' | 'debit'
  amount: number
  description: string
  balance_after: number
  created_at: string
}

const STATUS_MAP = {
  pending: { bg: '#FEF3C7', color: '#92400E', label: 'รอดำเนินการ', icon: Clock },
  approved: { bg: '#DCFCE7', color: '#15803D', label: 'อนุมัติแล้ว', icon: CheckCircle },
  completed: { bg: '#EFF3FD', color: '#315EC3', label: 'โอนแล้ว', icon: CheckCircle },
  rejected: { bg: '#FEE2E2', color: '#B91C1C', label: 'ปฏิเสธ', icon: XCircle },
}

const BANKS = [
  'ธนาคารกสิกรไทย', 'ธนาคารไทยพาณิชย์', 'ธนาคารกรุงเทพ',
  'ธนาคารกรุงไทย', 'ธนาคารกรุงศรีอยุธยา', 'ธนาคารออมสิน',
  'ธนาคารทหารไทยธนชาต', 'PromptPay'
]

// B7 FIX: Accept optional branchId
export default function AdminFinancePage(props: any) {
    const branchId: string | undefined = props?.branchId
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ amount: '', bank_name: '', account_number: '', account_name: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [activeTab, setActiveTab] = useState<'withdrawals' | 'ledger'>('withdrawals')

  const load = async () => {
    setLoading(true)
    try {
      // Get wallet \u2014 filtered by branchId when in shop admin context
      const [walletRes, withdrawRes, ledgerRes] = await Promise.all([
        branchId ? supabase.from('shop_wallets').select('*').eq('shop_id', branchId).maybeSingle() : supabase.from('shop_wallets').select('*').limit(1).single(),
        supabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('wallet_ledger').select('*').order('created_at', { ascending: false }).limit(100),
      ])
      setWallet(walletRes.data)
      setWithdrawals(withdrawRes.data || [])
      setLedger(ledgerRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const submitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) { setFormError('กรอกจำนวนเงินที่ถูกต้อง'); return }
    if (wallet && amount > wallet.balance_thb) { setFormError(`ยอดคงเหลือไม่เพียงพอ (มี ฿${wallet.balance_thb.toLocaleString('th')})`); return }
    if (!form.bank_name || !form.account_number || !form.account_name) { setFormError('กรอกข้อมูลธนาคารให้ครบ'); return }

    setSubmitting(true)
    try {
      const { error } = await supabase.from('withdrawal_requests').insert({
        shop_id: 'main', // single-shop
        amount_thb: amount,
        bank_name: form.bank_name,
        account_number: form.account_number,
        account_name: form.account_name,
        status: 'pending',
      })
      if (error) throw error
      setShowForm(false)
      setForm({ amount: '', bank_name: '', account_number: '', account_name: '' })
      await load()
    } catch (err: any) {
      setFormError(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>กระเป๋าเงิน</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>ยอดเงินและการถอนเงิน</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowForm(!showForm)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
            borderRadius: 12, background: 'var(--brand)', color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Kanit, sans-serif',
            boxShadow: 'var(--shadow-brand)'
          }}>
            <Plus size={14} /> ขอถอนเงิน
          </button>
          <button onClick={load} style={{
            padding: '9px 12px', borderRadius: 12, border: '1px solid var(--border)',
            background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center'
          }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Wallet Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        {[
          {
            label: 'ยอดคงเหลือ',
            value: `฿${((wallet?.balance_thb || 0)).toLocaleString('th', { minimumFractionDigits: 0 })}`,
            sub: 'พร้อมถอน',
            icon: Wallet, color: '#315EC3', bg: '#EFF3FD'
          },
          {
            label: 'ค้างรับ (กำลังดำเนินการ)',
            value: `฿${((wallet?.pending_thb || 0)).toLocaleString('th', { minimumFractionDigits: 0 })}`,
            sub: 'รอยืนยันงาน',
            icon: Clock, color: '#F59E0B', bg: '#FEF3C7'
          },
          {
            label: 'รายได้รวมทั้งหมด',
            value: `฿${((wallet?.total_earned_thb || 0)).toLocaleString('th', { minimumFractionDigits: 0 })}`,
            sub: 'ตลอดช่วงเวลา',
            icon: TrendingUp, color: '#22C55E', bg: '#DCFCE7'
          },
          {
            label: 'ถอนออกทั้งหมด',
            value: `฿${((wallet?.total_withdrawn_thb || 0)).toLocaleString('th', { minimumFractionDigits: 0 })}`,
            sub: 'สะสม',
            icon: ArrowDownLeft, color: '#8B5CF6', bg: '#EDE9FE'
          },
        ].map(c => (
          <div key={c.label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow-card)',
            display: 'flex', alignItems: 'flex-start', gap: 14
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <c.icon size={19} color={c.color} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{loading ? '...' : c.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Withdrawal Form */}
      {showForm && (
        <div style={{
          background: 'var(--surface)', border: '2px solid var(--brand)',
          borderRadius: 20, padding: '22px 24px', marginBottom: 20,
          boxShadow: '0 0 0 4px var(--brand-ghost)'
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowDownLeft size={16} /> ขอถอนเงิน
          </div>
          <form onSubmit={submitWithdrawal}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
              {/* Amount */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  จำนวนเงิน (฿)
                </label>
                <input type="number" min="1" max={wallet?.balance_thb || 0} placeholder="เช่น 1000"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'Kanit, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
                {wallet && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>สูงสุด ฿{wallet.balance_thb.toLocaleString('th')}</div>}
              </div>

              {/* Bank */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  ธนาคาร
                </label>
                <select value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'Kanit, sans-serif', outline: 'none', background: 'var(--surface)', cursor: 'pointer', boxSizing: 'border-box' }}>
                  <option value="">เลือกธนาคาร</option>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              {/* Account number */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  เลขบัญชี / เบอร์ PromptPay
                </label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="text" placeholder="xxx-x-xxxxx-x"
                    value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px 10px 30px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'Kanit, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>

            {/* Account name */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                ชื่อบัญชี
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" placeholder="ชื่อ-นามสกุล หรือชื่อกิจการ"
                  value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px 10px 30px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'Kanit, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            {formError && (
              <div style={{ display: 'flex', gap: 7, padding: '10px 14px', borderRadius: 10, background: '#FEE2E2', marginBottom: 12 }}>
                <AlertTriangle size={14} color="#B91C1C" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#B91C1C' }}>{formError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={submitting} style={{
                padding: '10px 20px', borderRadius: 12, background: 'var(--brand)', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                fontFamily: 'Kanit, sans-serif', opacity: submitting ? .7 : 1
              }}>
                {submitting ? 'กำลังส่งคำขอ...' : 'ส่งคำขอถอนเงิน'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setFormError('') }} style={{
                padding: '10px 16px', borderRadius: 12, background: 'var(--surface-2)',
                color: 'var(--text-muted)', border: '1.5px solid var(--border)',
                cursor: 'pointer', fontSize: 13, fontFamily: 'Kanit, sans-serif'
              }}>ยกเลิก</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, border: '1.5px solid var(--border)', borderRadius: 14, padding: 4, background: 'var(--surface)', width: 'fit-content' }}>
        {([
          { id: 'withdrawals', label: `คำขอถอนเงิน (${withdrawals.length})` },
          { id: 'ledger', label: `ประวัติ (${ledger.length})` }
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '7px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: 'Kanit, sans-serif',
            background: activeTab === t.id ? 'var(--brand)' : 'transparent',
            color: activeTab === t.id ? '#fff' : 'var(--text-secondary)',
            transition: 'all .2s'
          }}>{t.label}</button>
        ))}
      </div>

      {/* Withdrawals List */}
      {activeTab === 'withdrawals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block' }} />
            </div>
          ) : withdrawals.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, fontSize: 13 }}>
              ยังไม่มีคำขอถอนเงิน
            </div>
          ) : withdrawals.map(wr => {
            const cfg = STATUS_MAP[wr.status]
            const Icon = cfg.icon
            return (
              <div key={wr.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '16px 18px', boxShadow: 'var(--shadow-card)',
                display: 'flex', alignItems: 'center', gap: 14
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={17} color={cfg.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {wr.bank_name} — {wr.account_number}
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {wr.account_name} · {fmt(wr.created_at)}
                    {wr.admin_note && ` · หมายเหตุ: ${wr.admin_note}`}
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', flexShrink: 0 }}>
                  ฿{wr.amount_thb.toLocaleString('th')}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Ledger */}
      {activeTab === 'ledger' && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-card)'
        }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block' }} />
            </div>
          ) : ledger.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>ยังไม่มีรายการ</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['ประเภท', 'รายละเอียด', 'จำนวน', 'คงเหลือหลัง', 'วันที่'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledger.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
                        borderRadius: 7, fontSize: 11, fontWeight: 700,
                        background: entry.type === 'credit' ? '#DCFCE7' : '#FEE2E2',
                        color: entry.type === 'credit' ? '#15803D' : '#B91C1C'
                      }}>
                        {entry.type === 'credit' ? '+ รับ' : '- จ่าย'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>{entry.description || '—'}</td>
                    <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 700, color: entry.type === 'credit' ? '#22C55E' : '#EF4444' }}>
                      {entry.type === 'credit' ? '+' : '-'}฿{entry.amount.toLocaleString('th')}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-muted)' }}>฿{entry.balance_after.toLocaleString('th')}</td>
                    <td style={{ padding: '11px 16px', fontSize: 11, color: 'var(--text-muted)' }}>{fmt(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
