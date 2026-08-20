'use client'
import { useState, useEffect } from 'react'
import {
  Store, ClipboardList, Wallet, TrendingUp, Users,
  Clock, CheckCircle, AlertTriangle, ArrowUpRight, RefreshCw
} from 'lucide-react'

interface Stats {
  total_shops: number
  active_shops: number
  total_bookings: number
  completed_bookings: number
  platform_revenue: number
  pending_withdrawals: number
  pending_withdrawal_amount: number
  active_bookings: number
  recent_shops: any[]
}

function StatCard({ label, value, sub, icon: Icon, color = '#315EC3', bg = '#EFF3FD' }: {
  label: string, value: string | number, sub?: string,
  icon: any, color?: string, bg?: string
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 20, padding: '20px 22px', boxShadow: 'var(--shadow-card)',
      display: 'flex', alignItems: 'flex-start', gap: 16
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 13, background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <Icon size={20} color={color} strokeWidth={2} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          {label}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function PlatformOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('platform_token') || ''
      const [shopsRes, bookingsRes, withdrawalsRes] = await Promise.all([
        fetch('/api/platform/shops', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/bookings?limit=1000', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/platform/withdrawals?status=pending', { headers: { Authorization: `Bearer ${token}` } }),
      ])

      const shopsData = await shopsRes.json()
      const bookingsData = await bookingsRes.json()
      const withdrawalsData = await withdrawalsRes.json()

      const shops: any[] = shopsData.shops || []
      const bookings: any[] = bookingsData.bookings || []
      const withdrawals: any[] = withdrawalsData.withdrawals || []

      setStats({
        total_shops: shops.length,
        active_shops: shops.filter(s => s.is_active !== false).length,
        total_bookings: bookings.length,
        completed_bookings: bookings.filter(b => b.status === 'completed').length,
        platform_revenue: bookings.filter(b => b.payment_status === 'paid')
          .reduce((s, b) => s + (b.total_price || 0) * 0.20, 0),
        pending_withdrawals: withdrawals.length,
        pending_withdrawal_amount: withdrawals.reduce((s: number, w: any) => s + (w.amount_thb || 0), 0),
        active_bookings: bookings.filter(b => ['confirmed', 'picking_up', 'washing', 'delivering'].includes(b.status)).length,
        recent_shops: shops.slice(0, 5),
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
        <div style={{ fontSize: 13 }}>กำลังโหลด...</div>
      </div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>ภาพรวม Platform</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Foami Wash &amp; Delivery — Control Center</div>
        </div>
        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 12, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text-secondary)',
          cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Kanit, sans-serif'
        }}>
          <RefreshCw size={13} /> รีเฟรช
        </button>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard
          label="ร้านพาร์ทเนอร์ทั้งหมด"
          value={stats?.total_shops ?? 0}
          sub={`${stats?.active_shops ?? 0} ร้าน Active`}
          icon={Store}
          color="#315EC3" bg="#EFF3FD"
        />
        <StatCard
          label="งานทั้งหมด"
          value={stats?.total_bookings ?? 0}
          sub={`${stats?.completed_bookings ?? 0} เสร็จสิ้น`}
          icon={ClipboardList}
          color="#22C55E" bg="#DCFCE7"
        />
        <StatCard
          label="Platform Revenue"
          value={`฿${((stats?.platform_revenue ?? 0)).toLocaleString('th', { minimumFractionDigits: 0 })}`}
          sub="Platform fee 20% (ประมาณการ)"
          icon={TrendingUp}
          color="#F59E0B" bg="#FEF3C7"
        />
        <StatCard
          label="งาน Active ขณะนี้"
          value={stats?.active_bookings ?? 0}
          sub="กำลังดำเนินการ"
          icon={Clock}
          color="#8B5CF6" bg="#EDE9FE"
        />
      </div>

      {/* Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        {/* Pending Withdrawals Alert */}
        <div style={{
          background: stats?.pending_withdrawals ? '#FEF3C7' : 'var(--success-light)',
          border: `1px solid ${stats?.pending_withdrawals ? '#FCD34D' : '#86EFAC'}`,
          borderRadius: 20, padding: '20px 22px',
          display: 'flex', alignItems: 'center', gap: 16
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13,
            background: stats?.pending_withdrawals ? '#FCD34D' : '#86EFAC',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            {stats?.pending_withdrawals
              ? <AlertTriangle size={20} color="#92400E" />
              : <CheckCircle size={20} color="#14532D" />}
          </div>
          <div>
            <div style={{ fontSize: 11, color: stats?.pending_withdrawals ? '#92400E' : '#14532D', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
              Withdrawal Requests
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: stats?.pending_withdrawals ? '#92400E' : '#14532D' }}>
              {stats?.pending_withdrawals ?? 0} รายการ
            </div>
            <div style={{ fontSize: 11, color: stats?.pending_withdrawals ? '#92400E' : '#14532D', marginTop: 2, opacity: .8 }}>
              ยอดรวม ฿{(stats?.pending_withdrawal_amount ?? 0).toLocaleString('th')}
            </div>
          </div>
          <a href="/admin/platform/finance" style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 700, color: '#92400E', textDecoration: 'none'
          }}>
            จัดการ <ArrowUpRight size={12} />
          </a>
        </div>

        {/* Quick Links */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '20px 22px', boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Quick Actions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { href: '/admin/platform/invitations', label: '+ สร้าง Invitation Code', color: '#315EC3', bg: '#EFF3FD' },
              { href: '/admin/platform/shops', label: 'จัดการร้านพาร์ทเนอร์', color: '#22C55E', bg: '#DCFCE7' },
              { href: '/admin/platform/finance', label: 'อนุมัติการถอนเงิน', color: '#F59E0B', bg: '#FEF3C7' },
            ].map(({ href, label, color, bg }) => (
              <a key={href} href={href} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 12, background: bg,
                color, textDecoration: 'none', fontSize: 13, fontWeight: 600
              }}>
                {label}
                <ArrowUpRight size={14} />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Shops */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '20px 22px', boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          ร้านล่าสุด
          <a href="/admin/platform/shops" style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
            ดูทั้งหมด <ArrowUpRight size={11} />
          </a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {(stats?.recent_shops || []).map((shop: any) => (
            <div key={shop.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0', borderBottom: '1px solid var(--border)'
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: 'var(--brand-ghost)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0
              }}>
                🏪
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{shop.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{shop.address || shop.slug}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>{shop.booking_count || 0} งาน</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>฿{((shop.total_revenue || 0) * 0.2).toLocaleString()} fee</div>
              </div>
            </div>
          ))}
          {(!stats?.recent_shops || stats.recent_shops.length === 0) && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              ยังไม่มีร้านพาร์ทเนอร์
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
