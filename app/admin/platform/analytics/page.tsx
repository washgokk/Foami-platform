'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  BarChart3, TrendingUp, Calendar, Store, ArrowUpRight,
  Filter, RefreshCw, DollarSign, Clock, Users, Shield,
  Layers, PieChart, CheckCircle2, ChevronDown, Download,
  SlidersHorizontal, CheckSquare, Square, Table as TableIcon,
  Sparkles, LineChart, FileSpreadsheet
} from 'lucide-react'

type DimensionKey = 'branch' | 'category' | 'vehicle_type' | 'day_of_week' | 'status'
type MetricKey = 'gross_revenue' | 'platform_fee' | 'net_payout' | 'job_count' | 'completed_count' | 'aov' | 'avg_rating'

const DIMENSIONS: { key: DimensionKey; label: string }[] = [
  { key: 'branch', label: 'สาขา (Branch)' },
  { key: 'category', label: 'หมวดหมู่บริการ (Service Category)' },
  { key: 'vehicle_type', label: 'ประเภทยานพาหนะ (Vehicle Type)' },
  { key: 'day_of_week', label: 'วันในสัปดาห์ (Day of Week)' },
  { key: 'status', label: 'สถานะงาน (Job Status)' },
]

const METRICS: { key: MetricKey; label: string; format: (v: number) => string }[] = [
  { key: 'gross_revenue', label: 'ยอดขายรวม (Gross ฿)', format: v => `฿${v.toLocaleString('th', { maximumFractionDigits: 0 })}` },
  { key: 'platform_fee', label: 'Platform Fee 20% (฿)', format: v => `฿${v.toLocaleString('th', { maximumFractionDigits: 0 })}` },
  { key: 'net_payout', label: 'ยอดสุทธิร้านค้า (฿)', format: v => `฿${v.toLocaleString('th', { maximumFractionDigits: 0 })}` },
  { key: 'job_count', label: 'จำนวนงานทั้งหมด', format: v => `${v} งาน` },
  { key: 'completed_count', label: 'งานที่สำเร็จ', format: v => `${v} งาน` },
  { key: 'aov', label: 'ยอดเฉลี่ย / บิล (AOV)', format: v => `฿${Math.round(v).toLocaleString('th')}` },
  { key: 'avg_rating', label: 'คะแนนรีวิวเฉลี่ย', format: v => `${v.toFixed(1)} ★` },
]

const DAYS_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

export default function PlatformAnalyticsPage() {
  const [bookings, setBookings] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'this_month' | 'this_year' | 'all'>('30d')
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all')

  // Looker Studio Custom Dimensions & Metrics
  const [activeDimension, setActiveDimension] = useState<DimensionKey>('branch')
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(['gross_revenue', 'platform_fee', 'completed_count', 'aov'])
  const [chartType, setChartType] = useState<'table' | 'bar' | 'donut'>('table')
  const [sortByMetric, setSortByMetric] = useState<MetricKey>('gross_revenue')
  const [sortAsc, setSortAsc] = useState<boolean>(false)

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
      const matchesBranch = selectedBranchFilter === 'all' ||
        b.branch_id === selectedBranchFilter ||
        b.branches?.name === selectedBranchFilter ||
        b.branch_name === selectedBranchFilter

      return matchesDate && matchesBranch
    })
  }, [bookings, dateRange, selectedBranchFilter])

  // Helper to get dimension value for a booking
  const getDimensionValue = (b: any, dim: DimensionKey): string => {
    if (dim === 'branch') {
      return b.branches?.name || b.branch_name || b.branch_id || 'สาขา Foami'
    }
    if (dim === 'category') {
      const sName = (b.service_name || '').toLowerCase()
      if (sName.includes('มอเตอร์ไซค์') || sName.includes('bike')) return 'มอเตอร์ไซค์'
      if (sName.includes('เคลือบ') || sName.includes('wax') || sName.includes('glass')) return 'เคลือบสี / แก้ว'
      if (sName.includes('ซัก') || sName.includes('โอโซน') || sName.includes('spa')) return 'ซักเบาะ / พรม'
      if (sName.includes('ห้องเครื่อง')) return 'ล้างห้องเครื่อง'
      return 'ล้างสีดูดฝุ่น'
    }
    if (dim === 'vehicle_type') {
      const sName = (b.service_name || '').toLowerCase()
      if (sName.includes('มอเตอร์ไซค์') || sName.includes('bike')) return 'มอเตอร์ไซค์ (Bike)'
      const vSize = b.vehicle_size || b.vehicle_data?.vehicle_size || 'M'
      return `รถยนต์ Size ${vSize}`
    }
    if (dim === 'day_of_week') {
      const d = new Date(b.scheduled_date || b.created_at)
      return DAYS_TH[d.getDay()] || 'ไม่ระบุ'
    }
    if (dim === 'status') {
      return b.status || 'pending'
    }
    return 'อื่นๆ'
  }

  // Looker Studio Style Pivot Aggregation
  const reportData = useMemo(() => {
    const groups = new Map<string, {
      dimension: string
      gross_revenue: number
      platform_fee: number
      net_payout: number
      job_count: number
      completed_count: number
      aov: number
      avg_rating: number
      ratingsSum: number
      ratingsCount: number
    }>()

    filteredBookings.forEach(b => {
      const dimVal = getDimensionValue(b, activeDimension)
      const isCompleted = b.status === 'completed'
      const price = Number(b.total_price) || 0
      const additional = Number(b.additional_price) || 0
      const rev = isCompleted ? (price + additional) : 0
      const fee = rev * 0.2
      const net = rev * 0.8
      const rating = Number(b.rating) || 0

      if (!groups.has(dimVal)) {
        groups.set(dimVal, {
          dimension: dimVal,
          gross_revenue: rev,
          platform_fee: fee,
          net_payout: net,
          job_count: 1,
          completed_count: isCompleted ? 1 : 0,
          aov: 0,
          avg_rating: rating > 0 ? rating : 0,
          ratingsSum: rating > 0 ? rating : 0,
          ratingsCount: rating > 0 ? 1 : 0
        })
      } else {
        const g = groups.get(dimVal)!
        g.gross_revenue += rev
        g.platform_fee += fee
        g.net_payout += net
        g.job_count += 1
        if (isCompleted) g.completed_count += 1
        if (rating > 0) {
          g.ratingsSum += rating
          g.ratingsCount += 1
        }
      }
    })

    // Calculate AOV and Avg Rating for each group
    const rows = Array.from(groups.values()).map(g => {
      g.aov = g.completed_count > 0 ? g.gross_revenue / g.completed_count : 0
      g.avg_rating = g.ratingsCount > 0 ? g.ratingsSum / g.ratingsCount : 5.0
      return g
    })

    // Sort
    return rows.sort((a, b) => {
      const valA = a[sortByMetric] || 0
      const valB = b[sortByMetric] || 0
      return sortAsc ? valA - valB : valB - valA
    })
  }, [filteredBookings, activeDimension, sortByMetric, sortAsc])

  // Total Summary
  const grandTotal = useMemo(() => {
    const totalGross = reportData.reduce((s, r) => s + r.gross_revenue, 0)
    const totalFee = reportData.reduce((s, r) => s + r.platform_fee, 0)
    const totalNet = reportData.reduce((s, r) => s + r.net_payout, 0)
    const totalJobs = reportData.reduce((s, r) => s + r.job_count, 0)
    const totalCompleted = reportData.reduce((s, r) => s + r.completed_count, 0)
    const totalAOV = totalCompleted > 0 ? totalGross / totalCompleted : 0
    const ratingsCount = reportData.reduce((s, r) => s + r.ratingsCount, 0)
    const ratingsSum = reportData.reduce((s, r) => s + r.ratingsSum, 0)
    const totalRating = ratingsCount > 0 ? ratingsSum / ratingsCount : 5.0

    return {
      dimension: 'รวมทั้งหมด (Grand Total)',
      gross_revenue: totalGross,
      platform_fee: totalFee,
      net_payout: totalNet,
      job_count: totalJobs,
      completed_count: totalCompleted,
      aov: totalAOV,
      avg_rating: totalRating
    }
  }, [reportData])

  // Export to CSV Function
  const exportToCSV = () => {
    const headers = [
      DIMENSIONS.find(d => d.key === activeDimension)?.label || 'Dimension',
      ...selectedMetrics.map(m => METRICS.find(met => met.key === m)?.label || m)
    ]

    const rows = reportData.map(r => [
      `"${r.dimension}"`,
      ...selectedMetrics.map(m => r[m])
    ])

    rows.push([
      `"รวมทั้งหมด"`,
      ...selectedMetrics.map(m => grandTotal[m])
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `foami_analytics_${activeDimension}_${dateRange}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const toggleMetric = (key: MetricKey) => {
    if (selectedMetrics.includes(key)) {
      if (selectedMetrics.length > 1) {
        setSelectedMetrics(selectedMetrics.filter(m => m !== key))
      }
    } else {
      setSelectedMetrics([...selectedMetrics, key])
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Title & Top Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A2340', margin: 0 }}>
            Analytics & รายงานวิเคราะห์ระบบ (Looker Studio BI)
          </h1>
          <div style={{ fontSize: 13.5, color: '#5A6589', marginTop: 4 }}>
            เลือกมิติข้อมูล (Dimensions) และตัวชี้วัด (Metrics) เพื่อวิเคราะห์เชิงลึกได้อิสระ
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={exportToCSV}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
              borderRadius: 12, border: '1.5px solid #E8EEF8', background: '#FFFFFF',
              cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              color: '#315EC3', boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}
          >
            <Download size={14} /> ส่งออก CSV (Looker/Excel)
          </button>
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

      {/* Date & Branch Global Filters */}
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

        {/* Branch Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5A6589' }}>สาขา:</span>
          <select
            value={selectedBranchFilter}
            onChange={e => setSelectedBranchFilter(e.target.value)}
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

      {/* Looker Studio Custom Builder Toolbar (Dimensions & Metrics Selector) */}
      <div style={{
        background: '#FFFFFF', border: '1.5px solid #E8EEF8',
        borderRadius: 20, padding: '20px', boxShadow: '0 4px 16px rgba(49, 94, 195, 0.04)',
        display: 'flex', flexDirection: 'column', gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SlidersHorizontal size={18} color="#315EC3" />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#1A2340' }}>
              Looker Studio Report Configurator
            </span>
          </div>

          {/* Chart View Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F8FAFC', padding: 4, borderRadius: 10, border: '1px solid #E8EEF8' }}>
            <button
              onClick={() => setChartType('table')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8,
                border: 'none', background: chartType === 'table' ? '#FFFFFF' : 'transparent',
                color: chartType === 'table' ? '#315EC3' : '#5A6589', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                boxShadow: chartType === 'table' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <TableIcon size={13} /> ตาราง Pivot
            </button>
            <button
              onClick={() => setChartType('bar')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8,
                border: 'none', background: chartType === 'bar' ? '#FFFFFF' : 'transparent',
                color: chartType === 'bar' ? '#315EC3' : '#5A6589', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                boxShadow: chartType === 'bar' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <BarChart3 size={13} /> กราฟแท่ง
            </button>
            <button
              onClick={() => setChartType('donut')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8,
                border: 'none', background: chartType === 'donut' ? '#FFFFFF' : 'transparent',
                color: chartType === 'donut' ? '#315EC3' : '#5A6589', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                boxShadow: chartType === 'donut' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <PieChart size={13} /> สัดส่วน %
            </button>
          </div>
        </div>

        {/* 1. Dimension Selector (กลุ่มข้อมูล) */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase', marginBottom: 8 }}>
            1. เลือกมิติข้อมูลหลัก (Primary Dimension)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DIMENSIONS.map(d => {
              const active = activeDimension === d.key
              return (
                <button
                  key={d.key}
                  onClick={() => setActiveDimension(d.key)}
                  style={{
                    padding: '7px 14px', borderRadius: 10,
                    border: `1.5px solid ${active ? '#315EC3' : '#E8EEF8'}`,
                    background: active ? '#EFF3FD' : '#FFFFFF',
                    color: active ? '#315EC3' : '#1A2340',
                    fontSize: 13, fontWeight: active ? 800 : 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s'
                  }}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. Metrics Selector (ตัวชี้วัด) */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase', marginBottom: 8 }}>
            2. เลือกตัวชี้วัดที่ต้องการแสดง (Metrics & Columns)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {METRICS.map(m => {
              const selected = selectedMetrics.includes(m.key)
              return (
                <button
                  key={m.key}
                  onClick={() => toggleMetric(m.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 10,
                    border: `1.5px solid ${selected ? '#315EC3' : '#E8EEF8'}`,
                    background: selected ? '#FFFFFF' : '#F8FAFC',
                    color: selected ? '#315EC3' : '#7E8BAA',
                    fontSize: 12.5, fontWeight: selected ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'inherit'
                  }}
                >
                  {selected ? <CheckSquare size={14} color="#315EC3" /> : <Square size={14} color="#9AA5C4" />}
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Report Visualizer */}
      {chartType === 'table' ? (
        <div style={{
          background: '#FFFFFF', border: '1.5px solid #E8EEF8',
          borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 18px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E8EEF8' }}>
                  <th style={{ padding: '14px 20px', fontSize: 12.5, fontWeight: 800, color: '#1A2340', textTransform: 'uppercase' }}>
                    {DIMENSIONS.find(d => d.key === activeDimension)?.label}
                  </th>
                  {selectedMetrics.map(mKey => {
                    const met = METRICS.find(m => m.key === mKey)!
                    const isSorted = sortByMetric === mKey
                    return (
                      <th
                        key={mKey}
                        onClick={() => {
                          if (sortByMetric === mKey) setSortAsc(!sortAsc)
                          else { setSortByMetric(mKey); setSortAsc(false) }
                        }}
                        style={{
                          padding: '14px 16px', fontSize: 12, fontWeight: 700, color: isSorted ? '#315EC3' : '#5A6589',
                          textTransform: 'uppercase', textAlign: 'right', cursor: 'pointer', userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {met.label}
                          {isSorted && <span>{sortAsc ? '▲' : '▼'}</span>}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #E8EEF8', transition: 'background 0.15s' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 800, fontSize: 14, color: '#1A2340' }}>
                      {row.dimension}
                    </td>
                    {selectedMetrics.map(mKey => {
                      const met = METRICS.find(m => m.key === mKey)!
                      return (
                        <td key={mKey} style={{ padding: '16px 16px', textAlign: 'right', fontSize: 13.5, fontWeight: 700, color: mKey === 'gross_revenue' ? '#16A34A' : mKey === 'platform_fee' ? '#315EC3' : '#1A2340' }}>
                          {met.format(row[mKey])}
                        </td>
                      )
                    })}
                  </tr>
                ))}

                {/* Grand Total Row */}
                <tr style={{ background: '#EFF3FD', fontWeight: 900, borderTop: '2px solid #315EC3' }}>
                  <td style={{ padding: '16px 20px', fontSize: 14, color: '#315EC3' }}>
                    {grandTotal.dimension}
                  </td>
                  {selectedMetrics.map(mKey => {
                    const met = METRICS.find(m => m.key === mKey)!
                    return (
                      <td key={mKey} style={{ padding: '16px 16px', textAlign: 'right', fontSize: 14, color: '#315EC3' }}>
                        {met.format(grandTotal[mKey])}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : chartType === 'bar' ? (
        /* Bar Chart Mode */
        <div style={{
          background: '#FFFFFF', border: '1.5px solid #E8EEF8',
          borderRadius: 20, padding: '24px', boxShadow: '0 4px 18px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1A2340', marginBottom: 20 }}>
            เปรียบเทียบตาม {DIMENSIONS.find(d => d.key === activeDimension)?.label}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {reportData.map((row, idx) => {
              const maxVal = Math.max(...reportData.map(r => r[sortByMetric]), 1)
              const pct = Math.round(((row[sortByMetric] || 0) / maxVal) * 100)
              const met = METRICS.find(m => m.key === sortByMetric)!

              return (
                <div key={idx}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 6 }}>
                    <span style={{ fontWeight: 800, color: '#1A2340' }}>{row.dimension}</span>
                    <span style={{ fontWeight: 900, color: '#315EC3' }}>{met.format(row[sortByMetric])}</span>
                  </div>
                  <div style={{ width: '100%', height: 14, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #315EC3, #60A5FA)', borderRadius: 999 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Donut Share Breakdown Mode */
        <div style={{
          background: '#FFFFFF', border: '1.5px solid #E8EEF8',
          borderRadius: 20, padding: '24px', boxShadow: '0 4px 18px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1A2340', marginBottom: 20 }}>
            สัดส่วน % ตาม {DIMENSIONS.find(d => d.key === activeDimension)?.label}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {reportData.map((row, idx) => {
              const totalVal = grandTotal[sortByMetric] || 1
              const pct = Math.round(((row[sortByMetric] || 0) / totalVal) * 100)
              const met = METRICS.find(m => m.key === sortByMetric)!

              return (
                <div key={idx} style={{ padding: '16px', borderRadius: 14, background: '#F8FAFC', border: '1px solid #E8EEF8' }}>
                  <div style={{ fontSize: 13, color: '#5A6589', fontWeight: 600 }}>{row.dimension}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#315EC3', marginTop: 4 }}>
                    {pct}%
                  </div>
                  <div style={{ fontSize: 12.5, color: '#16A34A', fontWeight: 700, marginTop: 4 }}>
                    {met.format(row[sortByMetric])}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
