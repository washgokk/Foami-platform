'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Store, ClipboardList, Wallet, TrendingUp, Users,
  Clock, CheckCircle, AlertTriangle, ArrowUpRight, RefreshCw,
  DollarSign, ArrowDownLeft
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
      background: 'var(--surface, #FFFFFF)', 
      border: '1.5px solid var(--border, #DDE3F5)',
      borderRadius: 20, 
      padding: '20px', 
      boxShadow: '0 4px 14px rgba(49, 94, 195, 0.04)',
      display: 'flex', 
      alignItems: 'flex-start', 
      gap: 16
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <Icon size={22} color={color} strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #5A6589)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          {label}
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary, #1A2340)', lineHeight: 1.1 }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted, #9AA5C4)', marginTop: 4, fontWeight: 500 }}>{sub}</div>}
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
      const totalRev = shops.reduce((s: number, sh: any) => s + (sh.total_revenue || 0), 0)
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginRight: 10 }} />
        <span>กำลังโหลดข้อมูลภาพรวม...</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary, #1A2340)', margin: 0 }}>
            ภาพรวมระบบ Platform
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-secondary, #5A6589)', marginTop: 4 }}>
            ศูนย์ควบคุมระบบ Foami Multitenant Platform Super Admin
          </div>
        </div>
        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
          borderRadius: 12, border: '1.5px solid var(--border, #DDE3F5)', background: 'var(--surface, #FFFFFF)',
          cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
          color: 'var(--text-secondary)'
        }}>
          <RefreshCw size={14} /> รีเฟรชข้อมูล
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16
      }}>
        <StatCard
          label="ร้านพาร์ทเนอร์ทั้งหมด"
          value={`${stats?.total_shops || 0}`}
          sub={`เปิดบริการ ${stats?.active_shops || 0} ร้าน`}
          icon={Store}
          color="#315EC3"
          bg="#EFF3FD"
        />
        <StatCard
          label="งานทั้งหมดในระบบ"
          value={`${stats?.total_bookings || 0}`}
          sub={`เสร็จสิ้นแล้ว ${stats?.completed_bookings || 0} งาน`}
          icon={ClipboardList}
          color="#22C55E"
          bg="#DCFCE7"
        />
        <StatCard
          label="รายได้ Platform Fee"
          value={`฿${(stats?.platform_revenue || 0).toLocaleString('th', { maximumFractionDigits: 0 })}`}
          sub="ส่วนแบ่งค่าธรรมเนียมรวม"
          icon={TrendingUp}
          color="#8B5CF6"
          bg="#EDE9FE"
        />
        <StatCard
          label="คำขอถอนเงินรออนุมัติ"
          value={`${stats?.pending_withdrawals || 0} รายการ`}
          sub={`รวม ฿${(stats?.pending_withdrawal_amount || 0).toLocaleString('th')} บาท`}
          icon={Clock}
          color={stats?.pending_withdrawals ? '#F59E0B' : '#9AA5C4'}
          bg={stats?.pending_withdrawals ? '#FEF3C7' : '#F3F4F6'}
        />
      </div>

      {/* Quick Links & Summary Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 20
      }}>
        {/* Recent Shops */}
        <div style={{
          background: 'var(--surface, #FFFFFF)',
          border: '1.5px solid var(--border, #DDE3F5)',
          borderRadius: 20,
          padding: '22px',
          boxShadow: '0 4px 14px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #1A2340)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Store size={18} color="var(--brand-dominant, #315EC3)" /> ร้านค้าในระบบ
            </div>
            <Link href="/admin/platform/shops" style={{ fontSize: 12.5, color: 'var(--brand-dominant, #315EC3)', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              ดูทั้งหมด <ArrowUpRight size={13} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(stats?.recent_shops || []).map((shop: any) => (
              <div key={shop.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: 14, background: 'var(--bg, #F6F8FF)',
                border: '1px solid var(--border, #DDE3F5)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    border: '1px solid var(--border)'
                  }}>
                    <Store size={18} color="#315EC3" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{shop.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>/{shop.slug}</div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#16A34A' }}>
                    ฿{(shop.total_revenue || 0).toLocaleString('th', { maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {shop.booking_count || 0} งาน
                  </div>
                </div>
              </div>
            ))}
            {(!stats?.recent_shops || stats.recent_shops.length === 0) && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                ยังไม่มีร้านพาร์ทเนอร์ในระบบ
              </div>
            )}
          </div>
        </div>

        {/* Action Shortcuts */}
        <div style={{
          background: 'var(--surface, #FFFFFF)',
          border: '1.5px solid var(--border, #DDE3F5)',
          borderRadius: 20,
          padding: '22px',
          boxShadow: '0 4px 14px rgba(49, 94, 195, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #1A2340)', marginBottom: 16 }}>
              เมนูลัดสำหรับผู้ดูแลระบบ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link href="/admin/platform/invitations" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 14, background: 'var(--primary-ghost, #EFF3FD)',
                color: 'var(--brand-dominant, #315EC3)', textDecoration: 'none', fontWeight: 700, fontSize: 13.5,
                border: '1px solid rgba(49, 94, 195, 0.15)'
              }}>
                <span>+ สร้างรหัสเทียบเชิญพาร์ทเนอร์ใหม่ (Invitation)</span>
                <ArrowUpRight size={16} />
              </Link>

              <Link href="/admin/platform/finance" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 14, background: 'var(--bg, #F6F8FF)',
                color: 'var(--text-primary, #1A2340)', textDecoration: 'none', fontWeight: 700, fontSize: 13.5,
                border: '1px solid var(--border, #DDE3F5)'
              }}>
                <span>ตรวจสอบและอนุมัติคำขอถอนเงิน ({stats?.pending_withdrawals || 0} รายการ)</span>
                <ArrowUpRight size={16} />
              </Link>

              <Link href="/portal" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 14, background: 'var(--bg, #F6F8FF)',
                color: 'var(--text-secondary, #5A6589)', textDecoration: 'none', fontWeight: 600, fontSize: 13.5,
                border: '1px solid var(--border, #DDE3F5)'
              }}>
                <span>ไปที่หน้าพอร์ทัลกลาง Foami (/portal)</span>
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
