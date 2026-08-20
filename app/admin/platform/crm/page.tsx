'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Users, Search, RefreshCw, Phone, MessageSquare,
  Store, Calendar, ChevronRight, X, Car, Bike,
  TrendingUp, Award, ArrowUpRight, MapPin, FileText,
  AlertCircle, CheckCircle2, Clock
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Vehicle {
  license_plate?: string
  vehicle_brand?: string
  vehicle_model?: string
  vehicle_color?: string
  vehicle_size?: string
  vehicle_type?: 'car' | 'motorcycle'
  motorcycle_cc?: string
  act_expiry_date?: string
  tax_expiry_date?: string
  insurance_company?: string
  insurance_type?: string
}

interface CustomerProfile {
  id: string
  full_name: string
  phone: string
  line_user_id?: string
  customer_line_id?: string
  gender?: string
  occupation?: string
  interests?: string[]
  notes?: string
  tags?: string[]
  saved_vehicles?: Vehicle[]
  saved_locations?: any[]
  home_branch?: string
  created_at?: string
  // Aggregated fields
  total_bookings: number
  completed_bookings: number
  total_spent: number
  branches_visited: string[]
  last_booking_date: string | null
  bookings: any[]
}

export default function PlatformCRMPage() {
  const [customersData, setCustomersData] = useState<any[]>([])
  const [bookingsData, setBookingsData] = useState<any[]>([])
  const [branchesList, setBranchesList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('platform_token') || ''
      const [custRes, bksRes, brsRes] = await Promise.all([
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        fetch('/api/bookings?limit=3000', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/platform/shops', { headers: { Authorization: `Bearer ${token}` } })
      ])

      const [bksJson, brsJson] = await Promise.all([bksRes.json(), brsRes.json()])
      setCustomersData(custRes.data || [])
      setBookingsData(bksJson.bookings || [])
      setBranchesList(brsJson.shops || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Aggregate Customer Data
  const enrichedCustomers = useMemo(() => {
    const branchesMap = new Map(branchesList.map(b => [b.id, b.name]))

    return customersData.map(c => {
      // Find all bookings for this customer
      const cBookings = bookingsData.filter((b: any) =>
        b.customer_id === c.id ||
        (b.customer_phone && b.customer_phone === c.phone) ||
        (b.customer_name && b.customer_name === c.full_name && c.phone && b.customer_phone === c.phone)
      )

      const completed = cBookings.filter((b: any) => b.status === 'completed')

      const totalSpent = completed.reduce((sum: number, b: any) => {
        const price = Number(b.total_price) || 0
        const additional = Number(b.additional_price) || 0
        return sum + price + additional
      }, 0)

      const branchesVisitedSet = new Set<string>()
      cBookings.forEach((b: any) => {
        const bName = b.branches?.name || branchesMap.get(b.branch_id) || b.branch_name || 'สาขา Foami'
        branchesVisitedSet.add(bName)
      })

      // Home branch (first visited or branch where registered)
      const homeBranch = cBookings.length > 0
        ? (cBookings[cBookings.length - 1].branches?.name || branchesMap.get(cBookings[cBookings.length - 1].branch_id) || 'สาขาหลัก')
        : (c.branch_id ? branchesMap.get(c.branch_id) || 'สาขาหลัก' : 'สาขาทั่วไป')

      const sortedArrivals = [...cBookings].sort((a: any, b: any) =>
        new Date(b.scheduled_date || b.created_at).getTime() - new Date(a.scheduled_date || a.created_at).getTime()
      )

      const lastDate = sortedArrivals.length > 0 ? (sortedArrivals[0].scheduled_date || sortedArrivals[0].created_at) : null

      return {
        ...c,
        home_branch: homeBranch,
        total_bookings: cBookings.length,
        completed_bookings: completed.length,
        total_spent: totalSpent,
        branches_visited: Array.from(branchesVisitedSet),
        last_booking_date: lastDate,
        bookings: sortedArrivals
      } as CustomerProfile
    })
  }, [customersData, bookingsData, branchesList])

  // Filter & Search
  const filteredCustomers = useMemo(() => {
    return enrichedCustomers.filter(c => {
      const q = search.toLowerCase()
      const matchesSearch = !search ||
        (c.full_name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.line_user_id || '').toLowerCase().includes(q) ||
        (c.customer_line_id || '').toLowerCase().includes(q) ||
        (Array.isArray(c.saved_vehicles) && c.saved_vehicles.some((v: any) => (v.license_plate || '').toLowerCase().includes(q)))

      const matchesBranch = selectedBranch === 'all' ||
        c.home_branch === selectedBranch ||
        c.branches_visited.includes(selectedBranch)

      return matchesSearch && matchesBranch
    }).sort((a, b) => b.total_spent - a.total_spent)
  }, [enrichedCustomers, search, selectedBranch])

  // Summary Metrics
  const totalCustomers = enrichedCustomers.length
  const repeatCustomers = enrichedCustomers.filter(c => c.total_bookings > 1).length
  const totalSpentAll = enrichedCustomers.reduce((s, c) => s + c.total_spent, 0)
  const avgSpent = totalCustomers > 0 ? totalSpentAll / totalCustomers : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A2340', margin: 0 }}>
            CRM ลูกค้าทั้งระบบ (Platform CRM)
          </h1>
          <div style={{ fontSize: 13.5, color: '#5A6589', marginTop: 4 }}>
            ซิงค์ตรงกับฐานข้อมูลลูกค้าของร้านค้าทั่วประเทศ
          </div>
        </div>

        <button onClick={loadData} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
          borderRadius: 12, border: '1.5px solid #E8EEF8', background: '#FFFFFF',
          cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
          color: '#5A6589', boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <RefreshCw size={14} /> รีเฟรชข้อมูล
        </button>
      </div>

      {/* KPI Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16
      }}>
        <div style={{
          background: '#FFFFFF', border: '1.5px solid #E8EEF8',
          borderRadius: 20, padding: '20px', boxShadow: '0 4px 16px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 12.5, color: '#5A6589', fontWeight: 700, textTransform: 'uppercase' }}>
            ลูกค้าในฐานข้อมูลทั้งหมด
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#1A2340', marginTop: 6 }}>
            {totalCustomers.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 600, color: '#7E8BAA' }}>คน</span>
          </div>
        </div>

        <div style={{
          background: '#FFFFFF', border: '1.5px solid #E8EEF8',
          borderRadius: 20, padding: '20px', boxShadow: '0 4px 16px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 12.5, color: '#5A6589', fontWeight: 700, textTransform: 'uppercase' }}>
            ลูกค้าที่กลับมาใช้ซ้ำ (Repeat)
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#315EC3', marginTop: 6 }}>
            {repeatCustomers.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 600, color: '#7E8BAA' }}>({totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0}%)</span>
          </div>
        </div>

        <div style={{
          background: '#FFFFFF', border: '1.5px solid #E8EEF8',
          borderRadius: 20, padding: '20px', boxShadow: '0 4px 16px rgba(49, 94, 195, 0.04)'
        }}>
          <div style={{ fontSize: 12.5, color: '#5A6589', fontWeight: 700, textTransform: 'uppercase' }}>
            ยอดใช้จ่ายเฉลี่ย / คน
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#16A34A', marginTop: 6 }}>
            ฿{Math.round(avgSpent).toLocaleString('th')}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9AA5C4' }} />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, ทะเบียนรถ หรือ LINE ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '11px 16px 11px 44px', borderRadius: 14,
              border: '1.5px solid #E8EEF8', fontSize: 13.5, outline: 'none',
              fontFamily: 'inherit', color: '#1A2340', background: '#FFFFFF',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Branch Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#5A6589' }}>สาขา:</span>
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            style={{
              padding: '10px 14px', borderRadius: 12, border: '1.5px solid #E8EEF8',
              background: '#FFFFFF', fontSize: 13, fontWeight: 600, color: '#1A2340',
              fontFamily: 'inherit', outline: 'none'
            }}
          >
            <option value="all">ทุกสาขา ({branchesList.length} สาขา)</option>
            {branchesList.map(b => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div style={{
        background: '#FFFFFF', border: '1.5px solid #E8EEF8',
        borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 18px rgba(49, 94, 195, 0.04)'
      }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#7E8BAA' }}>
            <RefreshCw size={26} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} />
            กำลังโหลดข้อมูลลูกค้าจากฐานข้อมูลร้านค้า...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#7E8BAA', fontSize: 14 }}>
            <Users size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: .4 }} />
            ไม่พบข้อมูลลูกค้า
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 840 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E8EEF8' }}>
                  <th style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>ข้อมูลลูกค้า</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>สาขาหลักที่สังกัด</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>รถที่บันทึกไว้</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>งานสำเร็จ</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>ยอดใช้จ่ายสะสม</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>สาขาที่เคยใช้บริการ</th>
                  <th style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase', textAlign: 'right' }}>รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c, i) => (
                  <tr key={c.id || i} style={{ borderBottom: '1px solid #E8EEF8', transition: 'background 0.15s' }}>
                    {/* Customer Info */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: '#EFF3FD', color: '#315EC3',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 14, flexShrink: 0
                        }}>
                          {(c.full_name || 'C')[0]}
                        </div>
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#1A2340' }}>{c.full_name || 'ลูกค้าทั่วไป'}</div>
                          <div style={{ fontSize: 12, color: '#7E8BAA', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Phone size={11} /> {c.phone || '-'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Home Branch */}
                    <td style={{ padding: '16px 16px' }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 8, background: '#EFF3FD',
                        color: '#315EC3', fontSize: 12, fontWeight: 700
                      }}>
                        <Store size={12} /> {c.home_branch}
                      </div>
                    </td>

                    {/* Vehicles */}
                    <td style={{ padding: '16px 16px' }}>
                      {Array.isArray(c.saved_vehicles) && c.saved_vehicles.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {c.saved_vehicles.slice(0, 2).map((v, vi) => (
                            <div key={vi} style={{ fontSize: 12, color: '#1A2340', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {v.vehicle_type === 'motorcycle' ? <Bike size={12} color="#315EC3" /> : <Car size={12} color="#315EC3" />}
                              <span>{v.license_plate || v.vehicle_brand || 'รถยนต์'}</span>
                            </div>
                          ))}
                          {c.saved_vehicles.length > 2 && (
                            <span style={{ fontSize: 11, color: '#7E8BAA' }}>+{c.saved_vehicles.length - 2} คัน</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#9AA5C4' }}>—</span>
                      )}
                    </td>

                    {/* Bookings count */}
                    <td style={{ padding: '16px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1A2340' }}>
                        {c.completed_bookings} <span style={{ fontSize: 12, fontWeight: 500, color: '#7E8BAA' }}>/ {c.total_bookings} งาน</span>
                      </div>
                    </td>

                    {/* Total spent */}
                    <td style={{ padding: '16px 16px' }}>
                      <div style={{ fontSize: 14.5, fontWeight: 900, color: '#16A34A' }}>
                        ฿{c.total_spent.toLocaleString('th')}
                      </div>
                    </td>

                    {/* Branches Visited */}
                    <td style={{ padding: '16px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {c.branches_visited.map((bName, bi) => (
                          <span key={bi} style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: '#F1F5F9', color: '#475569'
                          }}>
                            {bName}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Details button */}
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedCustomer(c)}
                        style={{
                          padding: '7px 12px', borderRadius: 10,
                          background: '#EFF3FD', color: '#315EC3',
                          border: '1px solid rgba(49, 94, 195, 0.15)',
                          cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                          fontFamily: 'inherit'
                        }}
                      >
                        ดูข้อมูลเต็ม
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Full Detail Modal */}
      {selectedCustomer && (
        <>
          <div
            onClick={() => setSelectedCustomer(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 100, backdropFilter: 'blur(2px)' }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 101, background: '#FFFFFF', borderRadius: 24, padding: '28px',
            width: 640, maxWidth: '95vw', maxHeight: '88vh', overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.18)', border: '1.5px solid #E8EEF8'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1A2340', margin: 0 }}>
                  {selectedCustomer.full_name}
                </h2>
                <div style={{ fontSize: 13, color: '#5A6589', marginTop: 4 }}>
                  สาขาหลัก: <strong>{selectedCustomer.home_branch}</strong> • เบอร์โทร: {selectedCustomer.phone}
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 10, padding: 6, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Profile Info Cards */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20
            }}>
              <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: 12, border: '1px solid #E8EEF8' }}>
                <div style={{ fontSize: 11, color: '#7E8BAA', fontWeight: 600 }}>ยอดใช้จ่ายสะสม</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#16A34A', marginTop: 2 }}>฿{selectedCustomer.total_spent.toLocaleString('th')}</div>
              </div>
              <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: 12, border: '1px solid #E8EEF8' }}>
                <div style={{ fontSize: 11, color: '#7E8BAA', fontWeight: 600 }}>จำนวนงานสำเร็จ</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#315EC3', marginTop: 2 }}>{selectedCustomer.completed_bookings} ครั้ง</div>
              </div>
              <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: 12, border: '1px solid #E8EEF8' }}>
                <div style={{ fontSize: 11, color: '#7E8BAA', fontWeight: 600 }}>อาชีพ / เพศ</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2340', marginTop: 4 }}>{selectedCustomer.occupation || '-'} ({selectedCustomer.gender || '-'})</div>
              </div>
            </div>

            {/* Vehicles section */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1A2340', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Car size={16} color="#315EC3" /> รถที่บันทึกไว้ ({selectedCustomer.saved_vehicles?.length || 0} คัน)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.isArray(selectedCustomer.saved_vehicles) && selectedCustomer.saved_vehicles.map((v, vi) => (
                  <div key={vi} style={{
                    padding: '12px 14px', borderRadius: 12, background: '#F8FAFC',
                    border: '1px solid #E8EEF8', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#1A2340' }}>
                        {v.license_plate} - {v.vehicle_brand} {v.vehicle_model}
                      </div>
                      <div style={{ fontSize: 12, color: '#7E8BAA', marginTop: 2 }}>
                        {v.vehicle_type === 'motorcycle' ? `มอเตอร์ไซค์ (${v.motorcycle_cc || 'ทั่วไป'})` : `รถยนต์ (${v.vehicle_size || '-'})`} | สี: {v.vehicle_color || '-'}
                      </div>
                    </div>
                    {v.act_expiry_date && (
                      <div style={{ textAlign: 'right', fontSize: 11.5, color: '#5A6589' }}>
                        <div>พ.ร.บ. หมดอายุ:</div>
                        <strong style={{ color: new Date(v.act_expiry_date) < new Date() ? '#DC2626' : '#16A34A' }}>
                          {new Date(v.act_expiry_date).toLocaleDateString('th-TH')}
                        </strong>
                      </div>
                    )}
                  </div>
                ))}
                {(!selectedCustomer.saved_vehicles || selectedCustomer.saved_vehicles.length === 0) && (
                  <div style={{ padding: 14, textAlign: 'center', color: '#9AA5C4', fontSize: 13, background: '#F8FAFC', borderRadius: 12 }}>
                    ไม่มีข้อมูลรถที่บันทึกไว้
                  </div>
                )}
              </div>
            </div>

            {/* Bookings History */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1A2340', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={16} color="#315EC3" /> ประวัติการใช้บริการย้อนหลัง ({selectedCustomer.bookings.length} รายการ)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedCustomer.bookings.map((b, bi) => (
                  <div key={bi} style={{
                    padding: '12px 14px', borderRadius: 12, background: '#F8FAFC',
                    border: '1px solid #E8EEF8'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#315EC3' }}>
                        {b.branches?.name || b.branch_name || 'สาขา Foami'}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: b.status === 'completed' ? '#DCFCE7' : '#FEF3C7',
                        color: b.status === 'completed' ? '#166534' : '#92400E'
                      }}>
                        {b.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2340' }}>
                      {b.service_name || 'บริการล้างรถ'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#7E8BAA' }}>
                      <span>วันที่: {b.scheduled_date || new Date(b.created_at).toLocaleDateString('th-TH')}</span>
                      <span style={{ fontWeight: 800, color: '#16A34A', fontSize: 13 }}>฿{(Number(b.total_price) || 0).toLocaleString('th')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
