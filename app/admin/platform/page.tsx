'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Store, ClipboardList, Wallet, TrendingUp, Users,
  Clock, CheckCircle, AlertTriangle, ArrowUpRight, RefreshCw,
  Ticket, BarChart3, ChevronRight, CheckCircle2, AlertCircle
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

function StatCard({ label, value, sub, icon: Icon, valueColor = '#1A2340' }: {
  label: string, value: string | number, sub?: string,
  icon: any, valueColor?: string
}) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1.5px solid #E8EEF8',
      borderRadius: 20,
      padding: '22px',
      boxShadow: '0 4px 18px rgba(49, 94, 195, 0.04)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: '#5A6589', fontWeight: 700 }}>
          {label}
        </div>
        <div style={{
          width: 38, height: 38, borderRadius: 12,
          background: '#EFF3FD',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(49, 94, 195, 0.12)'
        }}>
          <Icon size={19} color="#315EC3" strokeWidth={2.2} />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 28, fontWeight: 900, color: valueColor, lineHeight: 1.1 }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 12, color: '#7E8BAA', marginTop: 6, fontWeight: 500 }}>
            {sub}
          </div>
        )}
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

      const [shopsData, bookingsData, withdrawalsData] = await Promise.all([
        shopsRes.json(), bookingsRes.json(), withdrawalsRes.json()
      ])

      const shops: any[] = shopsData.shops || []
      const bookings: any[] = bookingsData.bookings || []
      const withdrawals: any[] = withdrawalsData.withdrawals || []

      const completed = bookings.filter((b: any) => b.status === 'completed')
      const active = bookings.filter((b: any) => ['pending', 'confirmed', 'in_progress', 'washing'].includes(b.status))
      const platformRev = shops.reduce((s: number, sh: any) => {
        const fee = sh.platform_fee_pct ?? 0.2
        return s + (sh.total_revenue || 0) * fee
      }, 0)
      const pendingAmount = withdrawals.reduce((s: number, w: any) => s + (w.amount_thb || 0), 0)

      setStats({
        total_shops: shops.length,
        active_shops: shops.filter((s: any) => s.is_active).length,
        total_bookings: bookings.length,
        completed_bookings: completed.length,
        platform_revenue: platformRev,
        pending_withdrawals: withdrawals.length,
        pending_withdrawal_amount: pendingAmount,
        active_bookings: active.length,
        recent_shops: shops.slice(0, 5),
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320, color: '#7E8BAA' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginRight: 10 }} />
        <span>กำลังโหลดข้อมูลภาพรวมระบบ...</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A2340', margin: 0 }}>
            ภาพรวมระบบ Platform
          </h1>
          <div style={{ fontSize: 13.5, color: '#5A6589', marginTop: 4 }}>
            Foami Wash & Delivery — Control Center
          </div>
        </div>
        <button onClick={load} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
          borderRadius: 12, border: '1.5px solid #E8EEF8', background: '#FFFFFF',
          cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
          color: '#5A6589', boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <RefreshCw size={14} /> รีเฟรช
        </button>
      </div>

      {/* KPI Cards (Clean White with Navy Accents) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: 16
      }}>
        <StatCard
          label="ร้านพาร์ทเนอร์ทั้งหมด"
          value={stats?.total_shops || 0}
          sub={`เปิดบริการ ${stats?.active_shops || 0} ร้าน`}
          icon={Store}
          valueColor="#1A2340"
        />
        <StatCard
          label="งานทั้งหมดในระบบ"
          value={stats?.total_bookings || 0}
          sub={`เสร็จสิ้น ${stats?.completed_bookings || 0} งาน`}
          icon={ClipboardList}
          valueColor="#1A2340"
        />
        <StatCard
          label="Platform Revenue (Fee)"
          value={`฿${(stats?.platform_revenue || 0).toLocaleString('th', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="Platform fee 20% (ประมาณการ)"
          icon={TrendingUp}
          valueColor="#315EC3"
        />
        <StatCard
          label="งาน Active ขณะนี้"
          value={stats?.active_bookings || 0}
          sub="กำลังดำเนินการ"
          icon={Clock}
          valueColor="#1A2340"
        />
      </div>

      {/* Action & Status Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 20
      }}>
        {/* Withdrawal Status Box */}
        <div style={{
          background: '#FFFFFF',
          border: '1.5px solid #E8EEF8',
          borderRadius: 20,
          padding: '24px',
          boxShadow: '0 4px 18px rgba(49, 94, 195, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              คำขอถอนเงิน (Withdrawal Requests)
            </div>
            <Link href="/admin/platform/finance" style={{ fontSize: 12.5, color: '#315EC3', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
              จัดการ <ArrowUpRight size={13} />
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: (stats?.pending_withdrawals || 0) > 0 ? '#FEF3C7' : '#DCFCE7',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              {(stats?.pending_withdrawals || 0) > 0 ? (
                <AlertCircle size={26} color="#D97706" />
              ) : (
                <CheckCircle2 size={26} color="#16A34A" />
              )}
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#1A2340', lineHeight: 1.1 }}>
                {stats?.pending_withdrawals || 0} รายการ
              </div>
              <div style={{ fontSize: 13, color: '#7E8BAA', marginTop: 4 }}>
                ยอดรวม ฿{(stats?.pending_withdrawal_amount || 0).toLocaleString('th')} บาท
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions List */}
        <div style={{
          background: '#FFFFFF',
          border: '1.5px solid #E8EEF8',
          borderRadius: 20,
          padding: '24px',
          boxShadow: '0 4px 18px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 16 }}>
            เมนูลัดสำหรับผู้ดูแลระบบ
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href="/admin/platform/invitations" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 12, background: '#EFF3FD',
              color: '#315EC3', textDecoration: 'none', fontWeight: 700, fontSize: 13.5,
              border: '1px solid rgba(49, 94, 195, 0.12)'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ticket size={16} /> + สร้าง Invitation Code
              </span>
              <ArrowUpRight size={14} />
            </Link>

            <Link href="/admin/platform/shops" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 12, background: '#FFFFFF',
              color: '#1A2340', textDecoration: 'none', fontWeight: 700, fontSize: 13.5,
              border: '1.5px solid #E8EEF8'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Store size={16} color="#315EC3" /> จัดการร้านพาร์ทเนอร์
              </span>
              <ArrowUpRight size={14} />
            </Link>

            <Link href="/admin/platform/finance" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 12, background: '#FFFFFF',
              color: '#1A2340', textDecoration: 'none', fontWeight: 700, fontSize: 13.5,
              border: '1.5px solid #E8EEF8'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wallet size={16} color="#315EC3" /> อนุมัติการถอนเงิน
              </span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Shops List */}
      <div style={{
        background: '#FFFFFF',
        border: '1.5px solid #E8EEF8',
        borderRadius: 20,
        padding: '24px',
        boxShadow: '0 4px 18px rgba(49, 94, 195, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A2340' }}>
            ร้านล่าสุด
          </div>
          <Link href="/admin/platform/shops" style={{ fontSize: 13, color: '#315EC3', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            ดูทั้งหมด <ArrowUpRight size={14} />
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(stats?.recent_shops || []).map((shop: any) => (
            <div key={shop.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: 14, background: '#F8FAFC',
              border: '1px solid #E8EEF8'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  border: '1.5px solid #E8EEF8'
                }}>
                  <Store size={18} color="#315EC3" />
                </div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: '#1A2340' }}>{shop.name}</div>
                  <div style={{ fontSize: 12, color: '#7E8BAA' }}>{shop.address || shop.slug}</div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1A2340' }}>
                  {shop.booking_count || 0} งาน
                </div>
                <div style={{ fontSize: 11.5, color: '#315EC3', fontWeight: 600 }}>
                  ฿{((shop.total_revenue || 0) * (shop.platform_fee_pct || 0.2)).toLocaleString('th', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} fee
                </div>
              </div>
            </div>
          ))}

          {(!stats?.recent_shops || stats.recent_shops.length === 0) && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#7E8BAA', fontSize: 13.5 }}>
              ยังไม่มีร้านพาร์ทเนอร์ในระบบ
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
