'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Users, Search, RefreshCw, Phone, MessageSquare,
  Store, Calendar, ChevronRight, X, UserCheck, Star,
  TrendingUp, Award, ArrowUpRight
} from 'lucide-react'

interface Customer {
  customer_name: string
  customer_phone: string
  customer_line_id?: string
  total_bookings: number
  completed_bookings: number
  total_spent: number
  branches: string[]
  last_booking_date: string
  bookings: any[]
}

export default function PlatformCRMPage() {
  const [bookings, setBookings] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('platform_token') || ''
      const [bksRes, brsRes] = await Promise.all([
        fetch('/api/bookings?limit=2000', { headers: { Authorization: `Bearer ${token}` } }),
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

  // Aggregate bookings into unique customers
  const customers = useMemo(() => {
    const map = new Map<string, Customer>()

    bookings.forEach(b => {
      const phone = (b.customer_phone || '').trim()
      const name = (b.customer_name || 'ลูกค้าทั่วไป').trim()
      const key = phone || name

      if (!key) return

      const branchName = b.branches?.name || b.branch_name || b.branch_id || 'สาขา Foami'
      const price = Number(b.total_price) || 0
      const isCompleted = b.status === 'completed'

      if (!map.has(key)) {
        map.set(key, {
          customer_name: name,
          customer_phone: phone || '-',
          customer_line_id: b.customer_line_id || undefined,
          total_bookings: 1,
          completed_bookings: isCompleted ? 1 : 0,
          total_spent: isCompleted ? price : 0,
          branches: [branchName],
          last_booking_date: b.scheduled_date || b.created_at,
          bookings: [b]
        })
      } else {
        const item = map.get(key)!
        item.total_bookings += 1
        if (isCompleted) {
          item.completed_bookings += 1
          item.total_spent += price
        }
        if (!item.branches.includes(branchName)) {
          item.branches.push(branchName)
        }
        if (new Date(b.scheduled_date || b.created_at) > new Date(item.last_booking_date)) {
          item.last_booking_date = b.scheduled_date || b.created_at
        }
        item.bookings.push(b)
      }
    })

    return Array.from(map.values())
  }, [bookings])

  // Filter & Search
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = !search ||
        c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        c.customer_phone.includes(search) ||
        (c.customer_line_id && c.customer_line_id.toLowerCase().includes(search.toLowerCase()))

      const matchesBranch = selectedBranch === 'all' ||
        c.branches.some(b => b === selectedBranch || b.includes(selectedBranch))

      return matchesSearch && matchesBranch
    }).sort((a, b) => b.total_spent - a.total_spent)
  }, [customers, search, selectedBranch])

  // Summary Metrics
  const totalCustomers = customers.length
  const repeatCustomers = customers.filter(c => c.total_bookings > 1).length
  const totalSpentAll = customers.reduce((s, c) => s + c.total_spent, 0)
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
            ฐานข้อมูลลูกค้าและประวัติการใช้บริการข้ามสาขาทั่วประเทศ
          </div>
        </div>

        <button onClick={load} style={{
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
            ลูกค้าทั้งหมดในระบบ
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
            ลูกค้าใช้บริการซ้ำ (Repeat)
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
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9AA5C4' }} />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร หรือ LINE ID..."
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
            <option value="all">ทุกสาขา ({branches.length} สาขา)</option>
            {branches.map(b => (
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
            กำลังโหลดข้อมูลลูกค้า...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#7E8BAA', fontSize: 14 }}>
            <Users size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: .4 }} />
            ไม่พบข้อมูลลูกค้า
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 760 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E8EEF8' }}>
                  <th style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>ลูกค้า</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>การติดต่อ</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>งานทั้งหมด</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>ยอดใช้จ่ายรวม</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>สาขาที่เคยใช้บริการ</th>
                  <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase' }}>ใช้งานล่าสุด</th>
                  <th style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: '#5A6589', textTransform: 'uppercase', textAlign: 'right' }}>ประวัติ</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #E8EEF8', transition: 'background 0.15s' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: '#EFF3FD', color: '#315EC3',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 14, flexShrink: 0
                        }}>
                          {c.customer_name[0] || 'C'}
                        </div>
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#1A2340' }}>{c.customer_name}</div>
                          {c.total_bookings > 1 && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: 10.5, fontWeight: 700, color: '#16A34A', background: '#DCFCE7',
                              padding: '2px 6px', borderRadius: 4, marginTop: 2
                            }}>
                              <Star size={10} fill="#16A34A" /> VIP ({c.total_bookings} ครั้ง)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '16px 16px' }}>
                      <div style={{ fontSize: 13, color: '#1A2340', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Phone size={12} color="#7E8BAA" /> {c.customer_phone}
                      </div>
                      {c.customer_line_id && (
                        <div style={{ fontSize: 11.5, color: '#06C755', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <MessageSquare size={11} /> {c.customer_line_id}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '16px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1A2340' }}>
                        {c.completed_bookings} <span style={{ fontSize: 12, fontWeight: 500, color: '#7E8BAA' }}>/ {c.total_bookings} งาน</span>
                      </div>
                    </td>

                    <td style={{ padding: '16px 16px' }}>
                      <div style={{ fontSize: 14.5, fontWeight: 900, color: '#16A34A' }}>
                        ฿{c.total_spent.toLocaleString('th')}
                      </div>
                    </td>

                    <td style={{ padding: '16px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {c.branches.map((bName, bi) => (
                          <span key={bi} style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: '#F1F5F9', color: '#475569'
                          }}>
                            {bName}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td style={{ padding: '16px 16px', fontSize: 12.5, color: '#7E8BAA' }}>
                      {c.last_booking_date ? new Date(c.last_booking_date).toLocaleDateString('th-TH') : '-'}
                    </td>

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
                        ดูประวัติ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Booking History Modal */}
      {selectedCustomer && (
        <>
          <div
            onClick={() => setSelectedCustomer(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 100, backdropFilter: 'blur(2px)' }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 101, background: '#FFFFFF', borderRadius: 24, padding: '28px',
            width: 580, maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.18)', border: '1.5px solid #E8EEF8'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#1A2340', margin: 0 }}>
                  ประวัติการใช้บริการ: {selectedCustomer.customer_name}
                </h2>
                <div style={{ fontSize: 13, color: '#5A6589', marginTop: 4 }}>
                  เบอร์โทร: {selectedCustomer.customer_phone} • ยอดใช้จ่ายสะสม ฿{selectedCustomer.total_spent.toLocaleString('th')}
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 10, padding: 6, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedCustomer.bookings.map((b, bi) => (
                <div key={bi} style={{
                  padding: '14px', borderRadius: 14, background: '#F8FAFC',
                  border: '1px solid #E8EEF8'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
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

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: '#7E8BAA' }}>
                    <span>วันที่: {b.scheduled_date || new Date(b.created_at).toLocaleDateString('th-TH')}</span>
                    <span style={{ fontWeight: 800, color: '#16A34A', fontSize: 13.5 }}>฿{(Number(b.total_price) || 0).toLocaleString('th')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
