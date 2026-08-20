'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  BarChart3, TrendingUp, Calendar, Store, ArrowUpRight,
  Filter, RefreshCw, DollarSign, Clock, Users, Shield,
  Layers, PieChart, CheckCircle2, ChevronDown
} from 'lucide-react'

export default function PlatformAnalyticsPage() {
  const [bookings, setBookings] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'this_month' | 'this_year' | 'all'>('30d')
  const [selectedBranch, setSelectedBranch] = useState<string>('all')

  const load = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('platform_token') || ''
      const [bksRes, brsRes] = await Promise.all([
        fetch('/api/bookings?limit=3000', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/platform/shops', { headers: { Authorization: `Bearer ${token}` } })
      ])

      const [bksData, brsData] = await Promise.all([bksRes.json(), brsRes.json()])
      setBookings(bksData.bookings || [])
      setBranches(brsData.shops || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Filter Bookings by Date Range and Branch
  const filteredBookings = useMemo(() => {
    const now = new Date()
    return bookings.filter(b => {
      const bDate = new Date(b.scheduled_date || b.created_at)

      // Date Range Filter
      let matchesDate = true
      if (dateRange === 'today') {
        const todayStr = now.toISOString().split('T')[0]
        matchesDate = (b.scheduled_date === todayStr) || (b.created_at && b.created_at.startsWith(todayStr))
      } else if (dateRange === '7d') {
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        matchesDate = bDate >= d7
      } else if (dateRange === '30d') {
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        matchesDate = bDate >= d30
      } else if (dateRange === 'this_month') {
        matchesDate = bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear()
      } else if (dateRange === 'this_year') {
        matchesDate = bDate.getFullYear() === now.getFullYear()
      }

      // Branch Filter
      const matchesBranch = selectedBranch === 'all' ||
        b.branch_id === selectedBranch ||
        b.branches?.name === selectedBranch ||
        b.branch_name === selectedBranch

      return matchesDate && matchesBranch
    })
  }, [bookings, dateRange, selectedBranch])

  // Completed bookings in range
  const completed = useMemo(() => filteredBookings.filter(b => b.status === 'completed'), [filteredBookings])

  // Total Gross Revenue & Platform Fee
  const totalGross = useMemo(() => {
    return completed.reduce((s, b) => {
      const price = Number(b.total_price) || 0
      const additional = Number(b.additional_price) || 0
      return s + price + additional
    }, 0)
  }, [completed])

  const platformFee = totalGross * 0.2
  const netShopEarnings = totalGross * 0.8

  // Service Category Breakdown
  const categoryStats = useMemo(() => {
    const counts: Record<string, { count: number; revenue: number }> = {
      'ล้างสี / ดูดฝุ่น': { count: 0, revenue: 0 },
      'เคลือบสี / เคลือบแก้ว': { count: 0, revenue: 0 },
      'ซักเบาะ / พรม / อบโอโซน': { count: 0, revenue: 0 },
      'มอเตอร์ไซค์': { count: 0, revenue: 0 },
      'บริการอื่นๆ': { count: 0, revenue: 0 },
    }

    completed.forEach(b => {
      const sName = (b.service_name || '').toLowerCase()
      const rev = Number(b.total_price) || 0

      if (sName.includes('มอเตอร์ไซค์') || sName.includes('bike')) {
        counts['มอเตอร์ไซค์'].count++
        counts['มอเตอร์ไซค์'].revenue += rev
      } else if (sName.includes('เคลือบ') || sName.includes('wax') || sName.includes('glass')) {
        counts['เคลือบสี / เคลือบแก้ว'].count++
        counts['เคลือบสี / เคลือบแก้ว'].revenue += rev
      } else if (sName.includes('ซัก') || sName.includes('โอโซน') || sName.includes('spa')) {
        counts['ซักเบาะ / พรม / อบโอโซน'].count++
        counts['ซักเบาะ / พรม / อบโอโซน'].revenue += rev
      } else if (sName.includes('ล้าง') || sName.includes('ดูดฝุ่น')) {
        counts['ล้างสี / ดูดฝุ่น'].count++
        counts['ล้างสี / ดูดฝุ่น'].revenue += rev
      } else {
        counts['บริการอื่นๆ'].count++
        counts['บริการอื่นๆ'].revenue += rev
      }
    })

    return counts
  }, [completed])

  // Hourly Breakdown (Peak Hours)
  const hourlyStats = useMemo(() => {
    const hours: Record<string, number> = {}
    for (let h = 8; h <= 18; h++) {
      const slot = `${h.toString().padStart(2, '0')}:00`
      hours[slot] = 0
    }

    filteredBookings.forEach(b => {
      const time = b.scheduled_time || (b.created_at ? new Date(b.created_at).getHours() + ':00' : '')
      const hourKey = time.slice(0, 2) + ':00'
      if (hours[hourKey] !== undefined) {
        hours[hourKey]++
      }
    })

    return hours
  }, [filteredBookings])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header & Filter Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A2340', margin: 0 }}>
            Analytics & แดชบอร์ดวิเคราะห์ระบบ
          </h1>
          <div style={{ fontSize: 13.5, color: '#5A6589', marginTop: 4 }}>
            สรุปข้อมูลรายได้ สถิติการจอง และวิเคราะห์แนวโน้มบริการทั้งแพลตฟอร์ม
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={load} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px',
            borderRadius: 12, border: '1.5px solid #E8EEF8', background: '#FFFFFF',
            cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            color: '#5A6589'
          }}>
            <RefreshCw size={14} /> รีเฟรช
          </button>
        </div>
      </div>

      {/* Date & Branch Filter Bar */}
      <div style={{
        background: '#FFFFFF', border: '1.5px solid #E8EEF8',
        borderRadius: 18, padding: '14px 18px',
        display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between'
      }}>
        {/* Date Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5A6589', marginRight: 4 }}>ช่วงเวลา:</span>
          {[
            { label: 'วันนี้', value: 'today' },
            { label: '7 วันที่ผ่านมา', value: '7d' },
            { label: '30 วันที่ผ่านมา', value: '30d' },
            { label: 'เดือนนี้', value: 'this_month' },
            { label: 'ปีนี้', value: 'this_year' },
            { label: 'ทั้งหมด', value: 'all' },
          ].map(opt => {
            const active = dateRange === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value as any)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 10,
                  border: `1.5px solid ${active ? '#315EC3' : '#E8EEF8'}`,
                  background: active ? '#EFF3FD' : '#FFFFFF',
                  color: active ? '#315EC3' : '#5A6589',
                  fontSize: 12.5,
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s'
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Branch Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5A6589' }}>สาขา:</span>
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E8EEF8',
              background: '#FFFFFF', fontSize: 12.5, fontWeight: 600, color: '#1A2340',
              fontFamily: 'inherit', outline: 'none'
            }}
          >
            <option value="all">ทุกสาขา ({branches.length} สาขา)</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main KPI Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16
      }}>
        <div style={{
          background: '#FFFFFF', border: '1.5px solid #E8EEF8',
          borderRadius: 20, padding: '20px', boxShadow: '0 4px 16px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 12, color: '#5A6589', fontWeight: 700, textTransform: 'uppercase' }}>
            ยอดขายรวมทั้งระบบ (Gross Revenue)
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#16A34A', marginTop: 4 }}>
            ฿{totalGross.toLocaleString('th', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{
          background: '#FFFFFF', border: '1.5px solid #E8EEF8',
          borderRadius: 20, padding: '20px', boxShadow: '0 4px 16px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 12, color: '#5A6589', fontWeight: 700, textTransform: 'uppercase' }}>
            Platform Fee (20%)
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#315EC3', marginTop: 4 }}>
            ฿{platformFee.toLocaleString('th', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{
          background: '#FFFFFF', border: '1.5px solid #E8EEF8',
          borderRadius: 20, padding: '20px', boxShadow: '0 4px 16px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 12, color: '#5A6589', fontWeight: 700, textTransform: 'uppercase' }}>
            ยอดงานสำเร็จ / ทั้งหมด
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#1A2340', marginTop: 4 }}>
            {completed.length} <span style={{ fontSize: 14, color: '#7E8BAA', fontWeight: 600 }}>/ {filteredBookings.length} งาน</span>
          </div>
        </div>

        <div style={{
          background: '#FFFFFF', border: '1.5px solid #E8EEF8',
          borderRadius: 20, padding: '20px', boxShadow: '0 4px 16px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 12, color: '#5A6589', fontWeight: 700, textTransform: 'uppercase' }}>
            ยอดบิลเฉลี่ย / งาน (AOV)
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#1A2340', marginTop: 4 }}>
            ฿{completed.length > 0 ? Math.round(totalGross / completed.length).toLocaleString('th') : 0}
          </div>
        </div>
      </div>

      {/* Analytics Sections: Categories & Peak Hours */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: 20
      }}>
        {/* Service Category Breakdown */}
        <div style={{
          background: '#FFFFFF', border: '1.5px solid #E8EEF8',
          borderRadius: 20, padding: '22px', boxShadow: '0 4px 16px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1A2340', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} color="#315EC3" /> สัดส่วนยอดขายตามหมวดหมู่บริการ
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Object.entries(categoryStats).map(([cat, stat]) => {
              const pct = totalGross > 0 ? Math.round((stat.revenue / totalGross) * 100) : 0
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: '#1A2340' }}>{cat} ({stat.count} งาน)</span>
                    <span style={{ fontWeight: 800, color: '#315EC3' }}>฿{stat.revenue.toLocaleString('th')} ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #315EC3, #60A5FA)', borderRadius: 999 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Peak Hours Breakdown */}
        <div style={{
          background: '#FFFFFF', border: '1.5px solid #E8EEF8',
          borderRadius: 20, padding: '22px', boxShadow: '0 4px 16px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1A2340', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} color="#315EC3" /> ช่วงเวลาการจองยอดนิยม (Peak Hours)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(hourlyStats).map(([time, count]) => {
              const maxCount = Math.max(...Object.values(hourlyStats), 1)
              const pct = Math.round((count / maxCount) * 100)
              return (
                <div key={time} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                  <span style={{ width: 44, color: '#5A6589', fontWeight: 600 }}>{time}</span>
                  <div style={{ flex: 1, height: 18, background: '#F1F5F9', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: count > 0 ? '#315EC3' : 'transparent',
                      borderRadius: 6
                    }} />
                  </div>
                  <span style={{ width: 40, textAlign: 'right', fontWeight: 800, color: count > 0 ? '#1A2340' : '#9AA5C4' }}>
                    {count} งาน
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
