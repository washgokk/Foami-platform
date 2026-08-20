'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ClipboardList, TrendingUp, CheckCircle, Clock, Star, MapPin,
  Calendar, Layers, Filter, RefreshCw, AlertCircle
} from 'lucide-react'
import styles from '@/app/admin/dashboard/dashboard.module.css'

interface ShopStats {
  total_bookings: number
  today_bookings: number
  pending_bookings: number
  completed_bookings: number
  total_revenue: number
  today_revenue: number
  avg_rating: number
  total_reviews: number
}

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#FEF3C7', color: '#92400E', label: 'รอยืนยัน' },
  confirmed: { bg: '#DBEAFE', color: '#1E40AF', label: 'ยืนยันแล้ว' },
  picking_up: { bg: '#EDE9FE', color: '#5B21B6', label: 'กำลังไปรับ' },
  washing: { bg: '#CFFAFE', color: '#155E75', label: 'กำลังล้าง' },
  delivering: { bg: '#FFEDD5', color: '#9A3412', label: 'กำลังไปส่ง' },
  completed: { bg: '#DCFCE7', color: '#166534', label: 'เสร็จสิ้น' },
  cancelled: { bg: '#FEE2E2', color: '#991B1B', label: 'ยกเลิก' },
}

export default function ShopAdminDashboardPage() {
  const params = useParams()
  const branchSlug = (params?.branchSlug as string) || 'kku'

  const [stats, setStats] = useState<ShopStats>({
    total_bookings: 0, today_bookings: 0, pending_bookings: 0,
    completed_bookings: 0, total_revenue: 0, today_revenue: 0,
    avg_rating: 0, total_reviews: 0
  })
  const [popularZones, setPopularZones] = useState<any[]>([])
  const [recentBookings, setRecentBookings] = useState<any[]>([])
  const [branch, setBranch] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Get branch by slug
      const { data: bData } = await supabase
        .from('branches')
        .select('*')
        .eq('slug', branchSlug)
        .maybeSingle()

      setBranch(bData || { name: branchSlug, slug: branchSlug })
      const branchId = bData?.id

      // 2. Fetch bookings for this branch (by branch_id or fallback)
      let query = supabase.from('bookings').select('*').order('created_at', { ascending: false })
      if (branchId) query = query.eq('branch_id', branchId)

      const [{ data: booksData }, { data: zonesData }] = await Promise.all([
        query,
        supabase.from('zones').select('*').eq('is_active', true)
      ])

      const bookings = booksData || []
      const todayStr = new Date().toISOString().split('T')[0]

      let totalRev = 0
      let todayRev = 0
      let todayCount = 0
      let pendingCount = 0
      let completedCount = 0
      let ratingSum = 0
      let ratingCount = 0

      // Zone booking count tracker
      const zoneCounts: Record<string, { name: string; count: number; fee: number }> = {}
      ;(zonesData || []).forEach(z => {
        zoneCounts[z.id] = { name: z.name, count: 0, fee: z.extra_fee || 0 }
      })

      // Revenue calculation helper — matches platform admin formula exactly
      const calcBookingRevenue = (b: any) => {
        const isRebooking = b.discount_code && /rebook|refund/i.test(b.discount_code)
        const gross = Number(b.total_price) > 0 ? Number(b.total_price) : (Number(b.base_price) || 0)
        const additional = Number(b.additional_price) || 0
        const discount = Number(b.discount_amount) || 0
        // Rebooking = full price (service rendered, customer used free entitlement)
        return isRebooking ? (gross + additional) : Math.max(0, gross - discount + additional)
      }

      bookings.forEach(b => {
        // FIXED: only count revenue for COMPLETED bookings (matches platform admin)
        const isCompleted = b.status === 'completed'
        const rev = isCompleted ? calcBookingRevenue(b) : 0
        if (isCompleted) totalRev += rev

        const bDate = b.scheduled_date || (b.created_at ? b.created_at.split('T')[0] : '')
        if (bDate === todayStr) {
          todayCount++
          if (isCompleted) todayRev += rev
        }

        if (b.status === 'pending') pendingCount++
        if (b.status === 'completed') completedCount++

        if (b.rating && b.rating > 0) {
          ratingSum += b.rating
          ratingCount++
        }

        if (b.zone_id && zoneCounts[b.zone_id]) {
          zoneCounts[b.zone_id].count++
        }
      })

      setStats({
        total_bookings: bookings.length,
        today_bookings: todayCount,
        pending_bookings: pendingCount,
        completed_bookings: completedCount,
        total_revenue: totalRev,
        today_revenue: todayRev,
        avg_rating: ratingCount > 0 ? ratingSum / ratingCount : 0,
        total_reviews: ratingCount
      })

      setRecentBookings(bookings.slice(0, 8))

      // Sorted popular zones
      const sortedZones = Object.values(zoneCounts)
        .sort((a, b) => b.count - a.count)
        .filter(z => z.count > 0 || Object.keys(zoneCounts).length <= 4)
        .slice(0, 5)

      setPopularZones(sortedZones)
    } finally {
      setLoading(false)
    }
  }, [branchSlug])

  useEffect(() => { load() }, [load])

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            ภาพรวมสาขา {branch?.name || `/${branchSlug}`}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            แดชบอร์ดสรุปรายได้และงานจองย่อยสำหรับสาขา /{branchSlug}
          </div>
        </div>
        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 15px',
          borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)',
          cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Kanit, sans-serif',
          color: 'var(--text-secondary)'
        }}>
          <RefreshCw size={13} /> รีเฟรช
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 22px', boxShadow: 'var(--shadow-card)', display: 'flex', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: '#EFF3FD', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ClipboardList size={20} color="#315EC3" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>งานจองทั้งหมด</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{loading ? '...' : stats.total_bookings}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>วันนี้ {stats.today_bookings} งาน</div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 22px', boxShadow: 'var(--shadow-card)', display: 'flex', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={20} color="#22C55E" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>รายได้รวม</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
              {loading ? '...' : `฿${stats.total_revenue.toLocaleString('th')}`}
            </div>
            <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600, marginTop: 2 }}>เสร็จ {stats.completed_bookings} งาน</div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 22px', boxShadow: 'var(--shadow-card)', display: 'flex', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={20} color="#F59E0B" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>รอยืนยันงาน</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: stats.pending_bookings > 0 ? '#D97706' : 'var(--text-primary)', marginTop: 2 }}>
              {loading ? '...' : stats.pending_bookings}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>ต้องตรวจสอบ</div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 22px', boxShadow: 'var(--shadow-card)', display: 'flex', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Star size={20} color="#7C3AED" fill="#7C3AED" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>คะแนนรีวิวเฉลี่ย</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#7C3AED', marginTop: 2 }}>
              {loading ? '...' : (stats.avg_rating > 0 ? stats.avg_rating.toFixed(1) + ' ⭐' : '—')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{stats.total_reviews} รีวิวทั้งหมด</div>
          </div>
        </div>
      </div>

      {/* Grid Row 2: Popular Zones & Recent Bookings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 18 }}>
        {/* Popular Zones Component */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '20px 22px', boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} color="var(--brand)" /> โซนยอดนิยม (Popular Zones)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {popularZones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                ยังไม่มีข้อมูลโซน
              </div>
            ) : popularZones.map((z, idx) => (
              <div key={z.name + idx} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 12, background: 'var(--surface-2)',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 8, background: idx === 0 ? '#F59E0B' : 'var(--brand-ghost)',
                    color: idx === 0 ? '#fff' : 'var(--brand)', fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {idx + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{z.name}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)' }}>{z.count} งาน</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Bookings */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '20px 22px', boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>งานจองล่าสุดของสาขา</span>
            <a href={`/${branchSlug}/admin/bookings`} style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>
              ดูทั้งหมด →
            </a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentBookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                ยังไม่มีรายการจอง
              </div>
            ) : recentBookings.map((b: any) => {
              const st = STATUS_MAP[b.status] || { bg: '#F3F4F6', color: '#374151', label: b.status }
              return (
                <div key={b.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)',
                  border: '1px solid var(--border)'
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      BK-{b.id.substring(0, 8)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {b.pickup_address ? b.pickup_address.slice(0, 30) + '...' : 'ไม่ระบุที่อยู่'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                      ฿{(b.total_price || b.base_price || 0).toLocaleString('th')}
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      background: st.bg, color: st.color
                    }}>
                      {st.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
