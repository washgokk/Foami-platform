'use client'
import { useState, useEffect } from 'react'
import {
  Wallet, ArrowDownLeft, TrendingUp, Clock, CheckCircle,
  XCircle, RefreshCw, Plus, Building2, Phone, AlertTriangle, ChevronDown, ChevronUp,
  ShieldCheck, Lock, Shield, Check, Percent, CreditCard, Sparkles, Award, ArrowRight, Info
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
  const [activeTab, setActiveTab] = useState<'withdrawals' | 'ledger' | 'compensation' | 'packages'>('withdrawals')
  const [compensationBranch, setCompensationBranch] = useState<any>(null)
  const [compensationModel, setCompensationModel] = useState<'per_job' | 'daily' | 'monthly' | 'disabled'>('per_job')
  const [laborCostPerJob, setLaborCostPerJob] = useState<number>(50)
  const [savingComp, setSavingComp] = useState(false)
  const [compSuccessMsg, setCompSuccessMsg] = useState('')

  // Package & Immutable Contract state
  const MIN_WITHDRAWAL_THB = 2500
  const [packageData, setPackageData] = useState<any>(null)
  const [selectedPkg, setSelectedPkg] = useState<'starter' | 'pro' | 'enterprise'>('pro')
  const [selectedDuration, setSelectedDuration] = useState<number>(12)
  const [subscribingPkg, setSubscribingPkg] = useState(false)
  const [pkgSuccessMsg, setPkgSuccessMsg] = useState('')
  const [pkgErrorMsg, setPkgErrorMsg] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [walletRes, withdrawRes, ledgerRes] = await Promise.all([
        branchId ? supabase.from('shop_wallets').select('*').eq('shop_id', branchId).maybeSingle() : supabase.from('shop_wallets').select('*').limit(1).single(),
        supabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('wallet_ledger').select('*').order('created_at', { ascending: false }).limit(100),
      ])
      setWallet(walletRes.data)
      setWithdrawals(withdrawRes.data || [])
      setLedger(ledgerRes.data || [])

      const bQuery = branchId ? supabase.from('branches').select('*').eq('id', branchId).maybeSingle() : supabase.from('branches').select('*').limit(1).maybeSingle()
      const { data: bData } = await bQuery
      if (bData) {
        setCompensationBranch(bData)
        setCompensationModel(bData.settings?.compensation_model || 'per_job')
        setLaborCostPerJob(Number(bData.labor_cost_per_job) || 50)

        // Load package & contract info
        try {
          const pRes = await fetch(`/api/shops/package?branch_id=${bData.id}`)
          const pData = await pRes.json()
          if (pData.success) {
            setPackageData(pData)
          }
        } catch (e) {
          console.error('Failed to load packages', e)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [branchId])

  const submitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) {
      setFormError('กรุณาระบุจำนวนเงินที่ถูกต้อง')
      return
    }
    if (amt < MIN_WITHDRAWAL_THB) {
      setFormError(`ยอดถอนขั้นต่ำคือ ฿${MIN_WITHDRAWAL_THB.toLocaleString('th')} บาท (หลังหักค่าคอมมิชชั่นเข้าแพลตฟอร์มแล้ว)`)
      return
    }
    if (wallet && amt > wallet.balance_thb) {
      setFormError(`ยอดเงินไม่พอ (ถอนได้สูงสุด ฿${wallet.balance_thb.toLocaleString('th')})`)
      return
    }
    if (!form.bank_name) {
      setFormError('กรุณาเลือกธนาคาร')
      return
    }
    if (!form.account_number.trim()) {
      setFormError('กรุณาระบุเลขบัญชี')
      return
    }
    if (!form.account_name.trim()) {
      setFormError('กรุณาระบุชื่อบัญชี')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/platform/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: compensationBranch?.id,
          amount_thb: amt,
          bank_name: form.bank_name,
          account_number: form.account_number.trim(),
          account_name: form.account_name.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการส่งคำขอ')

      setForm({ amount: '', bank_name: '', account_number: '', account_name: '' })
      setShowForm(false)
      load()
      alert('ส่งคำขอถอนเงินเรียบร้อยแล้ว แอดมินจะดำเนินการโอนเงินผ่านระบบ')
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubscribePackage = async (tier: 'starter' | 'pro' | 'enterprise') => {
    if (!compensationBranch?.id) return alert('ไม่พบข้อมูลร้านค้า')
    setSubscribingPkg(true)
    setPkgSuccessMsg('')
    setPkgErrorMsg('')
    try {
      const res = await fetch('/api/shops/package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: compensationBranch.id,
          plan_tier: tier,
          duration_months: selectedDuration
        })
      })
      const data = await res.json()
      if (data.success) {
        setPkgSuccessMsg(`สมัครแพ็กเกจ ${data.contract.package_name} สำเร็จ! อัตราค่าคอมมิชชั่น ${data.contract.commission_pct}% ได้รับการล็อกในสัญญาแล้ว`)
        load()
      } else {
        setPkgErrorMsg(data.error || 'เกิดข้อผิดพลาดในการสมัครแพ็กเกจ')
      }
    } catch (e: any) {
      setPkgErrorMsg(e.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubscribingPkg(false)
    }
  }

  const fmt = (d: string) => {
    const dt = new Date(d)
    return `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getFullYear()} ${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`
  }

  const availableBalance = wallet?.balance_thb || 0
  const isWithdrawable = availableBalance >= MIN_WITHDRAWAL_THB
  const progressToMin = Math.min(100, Math.round((availableBalance / MIN_WITHDRAWAL_THB) * 100))

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px', fontFamily: 'Kanit, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            การเงิน &amp; บัญชีร้าน
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            กระเป๋าเงิน เบิกถอนเงินผ่าน Stripe และแพ็กเกจสัญญาคุ้มครองค่าคอมมิชชั่น
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={!isWithdrawable && !showForm}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
              borderRadius: 12,
              background: isWithdrawable || showForm ? 'var(--brand)' : '#94a3b8',
              color: '#fff',
              border: 'none',
              cursor: isWithdrawable || showForm ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 700, fontFamily: 'Kanit, sans-serif',
              boxShadow: isWithdrawable ? 'var(--shadow-brand)' : 'none'
            }}
          >
            <Plus size={14} /> {isWithdrawable || showForm ? 'ขอถอนเงิน' : 'ขอถอนเงิน (ขั้นต่ำ ฿2,500)'}
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

      {/* Minimum Withdrawal Progress Banner */}
      <div style={{
        background: isWithdrawable ? '#ecfdf5' : '#f8fafc',
        border: `1.5px solid ${isWithdrawable ? '#a7f3d0' : '#e2e8f0'}`,
        borderRadius: 14,
        padding: '14px 18px',
        marginBottom: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} color={isWithdrawable ? '#059669' : 'var(--brand-dominant)'} />
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: isWithdrawable ? '#065f46' : 'var(--text-primary)' }}>
              เกณฑ์ถอนเงินขั้นต่ำหลังหักค่าคอมมิชชั่นแพลตฟอร์ม: ฿2,500
            </span>
          </div>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isWithdrawable ? '#059669' : 'var(--text-muted)' }}>
            {isWithdrawable ? 'พร้อมถอนเงินได้ทันที' : `ขาดอีก ฿${(MIN_WITHDRAWAL_THB - availableBalance).toLocaleString('th')} ถึงจะถอนได้`}
          </span>
        </div>
        <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{
            width: `${progressToMin}%`,
            height: '100%',
            background: isWithdrawable ? '#059669' : 'var(--brand-dominant)',
            borderRadius: 10,
            transition: 'width 0.3s ease'
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>฿{availableBalance.toLocaleString('th')}</span>
          <span>เป้าหมาย ฿2,500</span>
        </div>
      </div>

      {/* Wallet Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        {[
          {
            label: 'ยอดคงเหลือสุทธิ',
            value: `฿${((wallet?.balance_thb || 0)).toLocaleString('th', { minimumFractionDigits: 0 })}`,
            sub: 'พร้อมถอน (หลังหักค่าคอม)',
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
            sub: 'สะสมเข้าบัญชี',
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
            <ArrowDownLeft size={16} /> ขอถอนเงินผ่าน Stripe Payout
          </div>
          <form onSubmit={submitWithdrawal}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  จำนวนเงินที่ต้องการถอน (฿) *ขั้นต่ำ ฿2,500
                </label>
                <input type="number" min={MIN_WITHDRAWAL_THB} max={wallet?.balance_thb || 0} placeholder="เช่น 2500"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'Kanit, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
                {wallet && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>ยอดพร้อมถอนสูงสุด ฿{wallet.balance_thb.toLocaleString('th')}</div>}
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  ธนาคารปลายทาง
                </label>
                <select value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'Kanit, sans-serif', outline: 'none', background: 'var(--surface)', cursor: 'pointer', boxSizing: 'border-box' }}>
                  <option value="">เลือกธนาคาร</option>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  เลขบัญชี / พร้อมเพย์
                </label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="text" placeholder="xxx-x-xxxxx-x"
                    value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px 10px 30px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'Kanit, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>

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
          { id: 'packages', label: 'แพ็กเกจ & สัญญาคุ้มครอง' },
          { id: 'compensation', label: 'รูปแบบการจ่ายค่าแรงพนักงาน' },
          { id: 'ledger', label: `ประวัติ (${ledger.length})` },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '7px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: 'Kanit, sans-serif',
            background: activeTab === t.id ? 'var(--brand)' : 'transparent',
            color: activeTab === t.id ? '#fff' : 'var(--text-secondary)',
            transition: 'all .15s'
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: PACKAGES & IMMUTABLE CONTRACT */}
      {activeTab === 'packages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Contract Shield Status Banner */}
          {packageData?.contract?.is_locked ? (
            <div style={{
              background: '#ecfdf5',
              border: '2px solid #059669',
              borderRadius: 18,
              padding: '24px',
              display: 'flex',
              gap: 16,
              alignItems: 'flex-start',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.1)'
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#059669', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={28} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#065f46', margin: 0 }}>
                    สัญญาคุ้มครองพาร์ทเนอร์ (Contract Sealed &amp; Locked)
                  </h3>
                  <span style={{ fontSize: '0.75rem', padding: '3px 10px', background: '#059669', color: 'var(--text-primary)', borderRadius: 20, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={12} /> สัญญามีผลคุ้มครอง
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 14 }}>
                  <div style={{ background: 'white', padding: 12, borderRadius: 10, border: '1px solid #a7f3d0' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>แพ็กเกจปัจจุบัน</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{packageData.contract.package_name}</div>
                  </div>
                  <div style={{ background: 'white', padding: 12, borderRadius: 10, border: '1px solid #a7f3d0' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>อัตราค่าคอมมิชชั่นคงที่</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}>{packageData.contract.commission_pct}% ตลอดอายุสัญญา</div>
                  </div>
                  <div style={{ background: 'white', padding: 12, borderRadius: 10, border: '1px solid #a7f3d0' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ระยะเวลาคุ้มครองถึง</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {new Date(packageData.contract.end_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#065f46', marginTop: 14, lineHeight: 1.5 }}>
                  <strong>การันตีความโปร่งใส:</strong> อัตราค่าคอมมิชชั่นนี้ได้รับการล็อกในระบบอย่างถาวร แอดมินและผู้ดูแลระบบจะไม่สามารถปรับขึ้นค่าคอมมิชชั่นหรือแก้ไขข้อตกลงใดๆ ในระหว่างที่สัญญาใช้งานอยู่
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 14,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <Shield size={24} color="#2563eb" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.88rem', color: '#1e40af' }}>
                <strong>ระบบล็อกสัญญาคุ้มครองพาร์ทเนอร์:</strong> เมื่อร้านค้าเลือกแพ็กเกจและชำระเงินเรียบร้อยแล้ว อัตราค่าคอมมิชชั่นและระยะเวลาสัญญาจะถูกล็อกทันที แอดมินจะไม่สามารถแก้ไขค่าคอมมิชชั่นของร้านค้าได้
              </div>
            </div>
          )}

          {/* Duration Selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', padding: '14px 20px', borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>เลือกระยะเวลาสัญญา</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setSelectedDuration(1)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: selectedDuration === 1 ? '2px solid var(--brand)' : '1px solid var(--border)',
                  background: selectedDuration === 1 ? 'var(--primary-ghost)' : 'white',
                  fontWeight: selectedDuration === 1 ? 800 : 500,
                  color: selectedDuration === 1 ? 'var(--brand)' : 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                รายเดือน (1 เดือน)
              </button>
              <button
                type="button"
                onClick={() => setSelectedDuration(12)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: selectedDuration === 12 ? '2px solid var(--brand)' : '1px solid var(--border)',
                  background: selectedDuration === 12 ? 'var(--primary-ghost)' : 'white',
                  fontWeight: selectedDuration === 12 ? 800 : 500,
                  color: selectedDuration === 12 ? 'var(--brand)' : 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                รายปี (12 เดือน - ประหยัด 2 เดือน)
              </button>
            </div>
          </div>

          {/* Package Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Starter */}
            <div style={{
              background: 'white',
              border: '1.5px solid var(--border)',
              borderRadius: 18,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>แพ็กเกจเริ่มต้น</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>Starter Plan</div>
                <div style={{ marginTop: 14, fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                  ฿0 <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ เดือน</span>
                </div>
                <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, marginTop: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Percent size={16} color="var(--brand-dominant)" /> ค่าคอมมิชชั่น {packageData?.packages?.starter?.commission_pct ?? 15}%
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 0', display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} color="#059669" /> รับงานผ่านระบบ Foami</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} color="#059669" /> รองรับระบบจ่ายค่าแรงพนักงาน</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} color="#059669" /> ถอนเงินขั้นต่ำ ฿2,500</li>
                </ul>
              </div>
              <button
                type="button"
                disabled={subscribingPkg}
                onClick={() => handleSubscribePackage('starter')}
                style={{
                  marginTop: 24,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1.5px solid var(--border)',
                  background: 'white',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                เลือกแผน Starter
              </button>
            </div>

            {/* Pro */}
            {(() => {
              const proMonthly = packageData?.packages?.pro?.monthly_fee ?? 350
              const proYearly = packageData?.packages?.pro?.yearly_fee ?? 3500
              const proComm = packageData?.packages?.pro?.commission_pct ?? 10
              return (
                <div style={{
                  background: 'white',
                  border: '2.5px solid var(--brand)',
                  borderRadius: 18,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  boxShadow: '0 8px 24px rgba(49, 94, 195, 0.12)'
                }}>
                  <div style={{ position: 'absolute', top: -12, right: 20, background: 'var(--brand)', color: 'var(--text-primary)', fontSize: '0.7rem', fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
                    แนะนำ ยอดนิยม
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase' }}>แผนยอดนิยม</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>Pro Partner Plan</div>
                    <div style={{ marginTop: 14, fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                      {selectedDuration === 12 ? `฿${proYearly.toLocaleString('th')}` : `฿${proMonthly.toLocaleString('th')}`}
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                        {selectedDuration === 12 ? ' / ปี (ลด 2 เดือน)' : ' / เดือน'}
                      </span>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 8, marginTop: 12, fontWeight: 800, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Percent size={16} /> ค่าคอมมิชชั่นลดเหลือ {proComm}%
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 0', display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} color="#059669" /> <strong>ล็อกสัญญาคุ้มครองคอมมิชชั่น {proComm}% ถาวร</strong></li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} color="#059669" /> แอดมินไม่สามารถปรับแก้ค่าคอมมิชชั่นได้</li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} color="#059669" /> ป้ายสัญลักษณ์ Pro Partner บนหน้าร้าน</li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} color="#059669" /> เข้าร่วมแคมเปญสนับสนุนจาก Foami</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    disabled={subscribingPkg}
                    onClick={() => handleSubscribePackage('pro')}
                    style={{
                      marginTop: 24,
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'var(--brand)',
                      color: 'var(--text-primary)',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <Lock size={15} /> ชำระเงินและล็อกสัญญา Pro
                  </button>
                </div>
              )
            })()}

            {/* Enterprise (Zero Commission) */}
            {(() => {
              const entMonthly = packageData?.packages?.enterprise?.monthly_fee ?? 790
              const entYearly = packageData?.packages?.enterprise?.yearly_fee ?? 7900
              const entComm = packageData?.packages?.enterprise?.commission_pct ?? 0
              return (
                <div style={{
                  background: '#fff',
                  color: 'var(--text-primary)',
                  border: '2px solid #F59E0B',
                  borderRadius: 18,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Award size={14} /> คุ้มค่าสูงสุด (Best Value)
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>Enterprise 0% Plan</div>
                    <div style={{ marginTop: 14, fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                      {selectedDuration === 12 ? `฿${entYearly.toLocaleString('th')}` : `฿${entMonthly.toLocaleString('th')}`}
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                        {selectedDuration === 12 ? ' / ปี' : ' / เดือน'}
                      </span>
                    </div>
                    <div style={{ padding: '8px 12px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', borderRadius: 8, marginTop: 12, fontWeight: 900, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Percent size={16} /> ค่าคอมมิชชั่น {entComm}% (ร้านรับเงิน 100% เต็ม)
                    </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 0', display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} color="#10b981" /> <strong>ไม่มีการหักค่าคอมมิชชั่นใดๆ ตลอดสัญญา</strong></li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} color="#10b981" /> สัญญาล็อกแน่นหนา แอดมินแก้ไขไม่ได้</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} color="#10b981" /> สิทธิ์ความสำคัญสูงสุดในการจัดสรรงาน</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} color="#10b981" /> ดูแลพิเศษตลอด 24 ชั่วโมง</li>
                </ul>
              </div>
              <button
                type="button"
                disabled={subscribingPkg}
                onClick={() => handleSubscribePackage('enterprise')}
                style={{
                  marginTop: 24,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#f59e0b',
                  color: '#0f172a',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Lock size={15} /> ชำระเงินและล็อกสัญญา 0%
              </button>
            </div>
          )
        })()}
          </div>

          {pkgSuccessMsg && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', fontWeight: 700 }}>
              {pkgSuccessMsg}
            </div>
          )}

          {pkgErrorMsg && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontWeight: 700 }}>
              {pkgErrorMsg}
            </div>
          )}
        </div>
      )}

      {/* Withdrawals List */}
      {activeTab === 'withdrawals' && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-card)'
        }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block' }} />
            </div>
          ) : withdrawals.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              ยังไม่มีคำขอถอนเงิน
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['วันที่ส่งคำขอ', 'จำนวนเงิน', 'ธนาคาร / บัญชี', 'สถานะ', 'วันที่เสร็จสิ้น', 'หมายเหตุ'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withdrawals.map(w => {
                  const s = STATUS_MAP[w.status] || STATUS_MAP.pending
                  const SIcon = s.icon
                  return (
                    <tr key={w.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>{fmt(w.created_at)}</td>
                      <td style={{ padding: '11px 16px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>฿{w.amount_thb.toLocaleString('th')}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{w.bank_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{w.account_number} · {w.account_name}</div>
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
                          borderRadius: 7, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color
                        }}>
                          <SIcon size={11} /> {s.label}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{w.resolved_at ? fmt(w.resolved_at) : '—'}</td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{w.admin_note || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Staff Compensation Model */}
      {activeTab === 'compensation' && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 18, padding: '24px', boxShadow: 'var(--shadow-card)', maxWidth: 680
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            การจ่ายค่าแรงพนักงาน
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            เลือกระบบการจ่ายค่าแรงพนักงานของร้าน หากร้านจ่ายเป็นรายวัน/รายเดือน สามารถปิดการคิดค่าแรงต่อรอบได้
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {[
              { id: 'per_job', label: 'จ่ายเป็นรายรอบงาน (Per Job)', desc: 'ระบบจะคำนวณค่าแรงพนักงานแยกตามแต่ละออเดอร์ที่ทำสำเร็จ' },
              { id: 'daily', label: 'จ่ายเป็นรายวัน (Daily Wages)', desc: 'ร้านค้าเหมาจ่ายพนักงานรายวัน ปิดการหักค่าแรงต่อรอบงาน' },
              { id: 'monthly', label: 'จ่ายเป็นเงินเดือน (Monthly Salary)', desc: 'ร้านค้าจ่ายเงินเดือนประจำ ปิดการหักค่าแรงต่อรอบงาน' },
              { id: 'disabled', label: 'ไม่คิดค่าแรงในระบบ (Disabled)', desc: 'ปิดการคำนวณค่าแรงพนักงานทั้งหมดในระบบบัญชีร้าน' },
            ].map(m => (
              <label key={m.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                borderRadius: 12, border: compensationModel === m.id ? '2px solid var(--brand)' : '1px solid var(--border)',
                background: compensationModel === m.id ? 'var(--primary-ghost)' : 'transparent',
                cursor: 'pointer'
              }}>
                <input
                  type="radio"
                  name="compModel"
                  value={m.id}
                  checked={compensationModel === m.id}
                  onChange={() => setCompensationModel(m.id as any)}
                  style={{ marginTop: 3, accentColor: 'var(--brand)' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{m.label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{m.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {compensationModel === 'per_job' && (
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                ค่าแรงพนักงานต่อรอบงาน (บาท/รอบ)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={laborCostPerJob}
                  onChange={e => setLaborCostPerJob(Number(e.target.value))}
                  style={{ width: 140, padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: '1.05rem', fontWeight: 800 }}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>พนักงานจะได้รับยอดนี้ทุกครั้งที่ทำงานเสร็จ</span>
              </div>
            </div>
          )}

          {compSuccessMsg && (
            <div style={{ padding: '10px 16px', borderRadius: 10, background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', fontSize: '0.875rem', fontWeight: 700, marginBottom: 18 }}>
              {compSuccessMsg}
            </div>
          )}

          <button
            type="button"
            disabled={savingComp}
            onClick={async () => {
              if (!compensationBranch?.id) return alert('ไม่พบข้อมูลสาขา')
              setSavingComp(true)
              setCompSuccessMsg('')
              try {
                const currentSettings = compensationBranch.settings || {}
                const updatedSettings = { ...currentSettings, compensation_model: compensationModel }
                const { error } = await supabase.from('branches').update({
                  settings: updatedSettings,
                  labor_cost_per_job: compensationModel === 'per_job' ? laborCostPerJob : 0
                }).eq('id', compensationBranch.id)

                if (error) throw error
                setCompSuccessMsg('บันทึกรูปแบบการจ่ายค่าแรงพนักงานเรียบร้อยแล้ว')
                setTimeout(() => setCompSuccessMsg(''), 4000)
              } catch (err: any) {
                alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message)
              } finally {
                setSavingComp(false)
              }
            }}
            style={{
              padding: '12px 28px',
              borderRadius: 12,
              background: 'var(--brand)',
              color: '#fff',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.95rem',
              cursor: 'pointer',
              opacity: savingComp ? 0.7 : 1
            }}
          >
            {savingComp ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าค่าแรง'}
          </button>
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
