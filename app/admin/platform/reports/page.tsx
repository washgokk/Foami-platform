'use client'
import React, { useState, useEffect, useMemo } from 'react'
import {
  AlertTriangle, ShieldAlert, CheckCircle2, Clock, Search, Filter,
  RefreshCw, Download, Printer, ExternalLink, ChevronRight, X,
  Building2, ShoppingBag, User, Phone, MessageSquare, AlertCircle,
  FileText, Check, ChevronDown, Sparkles
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'

export interface IncidentReport {
  id: string
  report_number: string
  report_type: 'shop' | 'order' | 'customer_issue' | 'payment' | 'general'
  branch_id?: string | null
  shop_slug?: string | null
  shop_name?: string | null
  booking_id?: string | null
  booking_number?: string | null
  customer_id?: string | null
  customer_name: string
  customer_phone: string
  customer_email?: string | null
  customer_line_id?: string | null
  title: string
  category: string
  description: string
  evidence_photos: string[]
  severity: 'low' | 'normal' | 'high' | 'critical'
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed' | 'refunded'
  admin_notes?: string | null
  resolved_by?: string | null
  resolved_at?: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending: { label: 'รอดำเนินการ', bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' },
  investigating: { label: 'กำลังตรวจสอบ', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  resolved: { label: 'แก้ไขแล้ว', bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' },
  refunded: { label: 'คืนเงินแล้ว', bg: '#F3E8FF', text: '#7E22CE', border: '#D8B4FE' },
  dismissed: { label: 'ยกเลิก / ปฏิเสธ', bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' }
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; badgeBg: string }> = {
  low: { label: 'เล็กน้อย', color: '#64748B', badgeBg: '#F1F5F9' },
  normal: { label: 'ปกติ', color: '#2563EB', badgeBg: '#EFF6FF' },
  high: { label: 'เร่งด่วน', color: '#D97706', badgeBg: '#FEF3C7' },
  critical: { label: 'วิกฤต', color: '#DC2626', badgeBg: '#FEE2E2' }
}

const TYPE_LABELS: Record<string, { label: string; icon: any }> = {
  shop: { label: 'ปัญหาร้านค้า', icon: Building2 },
  order: { label: 'ปัญหาออเดอร์', icon: ShoppingBag },
  customer_issue: { label: 'ปัญหาทั่วไป', icon: MessageSquare },
  payment: { label: 'การชำระเงิน', icon: AlertCircle },
  general: { label: 'ข้อร้องเรียน', icon: FileText }
}

export default function PlatformReportsPage() {
  const [reports, setReports] = useState<IncidentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')

  // Case Detail & Management Modal
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null)
  const [updating, setUpdating] = useState(false)
  const [editStatus, setEditStatus] = useState<any>('pending')
  const [editAdminNotes, setEditAdminNotes] = useState('')
  const [editResolvedBy, setEditResolvedBy] = useState('Admin HQ')
  const [successToast, setSuccessToast] = useState('')

  const fetchReports = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reports')
      const data = await res.json()
      if (data.reports) {
        setReports(data.reports)
      }
    } catch (err) {
      console.error('Failed to load reports:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  // Open modal handler
  const handleOpenDetail = (r: IncidentReport) => {
    setSelectedReport(r)
    setEditStatus(r.status)
    setEditAdminNotes(r.admin_notes || '')
    setEditResolvedBy(r.resolved_by || 'Admin HQ')
  }

  // Update report handler
  const handleSaveResolution = async () => {
    if (!selectedReport) return
    setUpdating(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedReport.id,
          status: editStatus,
          admin_notes: editAdminNotes,
          resolved_by: editResolvedBy
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccessToast(`อัปเดตเคส ${selectedReport.report_number} เรียบร้อยแล้ว`)
        setSelectedReport(null)
        fetchReports()
        setTimeout(() => setSuccessToast(''), 3000)
      } else {
        alert(data.error || 'ไม่สามารถอัปเดตได้')
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setUpdating(false)
    }
  }

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (typeFilter !== 'all' && r.report_type !== typeFilter) return false
      if (severityFilter !== 'all' && r.severity !== severityFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchNum = r.report_number.toLowerCase().includes(q)
        const matchTitle = r.title.toLowerCase().includes(q)
        const matchCust = r.customer_name.toLowerCase().includes(q)
        const matchPhone = r.customer_phone.includes(q)
        const matchShop = r.shop_name && r.shop_name.toLowerCase().includes(q)
        const matchBooking = r.booking_number && r.booking_number.toLowerCase().includes(q)
        if (!matchNum && !matchTitle && !matchCust && !matchPhone && !matchShop && !matchBooking) {
          return false
        }
      }
      return true
    })
  }, [reports, statusFilter, typeFilter, severityFilter, search])

  // KPIs
  const stats = useMemo(() => {
    const total = reports.length
    const pending = reports.filter(r => r.status === 'pending').length
    const investigating = reports.filter(r => r.status === 'investigating').length
    const resolved = reports.filter(r => r.status === 'resolved' || r.status === 'refunded').length
    const shopIssues = reports.filter(r => r.report_type === 'shop').length
    const orderIssues = reports.filter(r => r.report_type === 'order').length
    return { total, pending, investigating, resolved, shopIssues, orderIssues }
  }, [reports])

  // Export CSV
  const handleExportCSV = () => {
    if (filteredReports.length === 0) {
      alert('ไม่มีข้อมูลสำหรับ Export')
      return
    }
    const headers = ['รหัสเคส', 'วันที่แจ้ง', 'ประเภท', 'ความเร่งด่วน', 'หัวข้อปัญหา', 'หมวดหมู่', 'รายละเอียด', 'ชื่อร้านค้า', 'รหัสการจอง', 'ชื่อผู้แจ้ง', 'เบอร์โทร', 'สถานะ', 'บันทึกแอดมิน', 'ผู้ดำเนินการ']
    const rows = filteredReports.map(r => [
      r.report_number,
      r.created_at,
      TYPE_LABELS[r.report_type]?.label || r.report_type,
      SEVERITY_CONFIG[r.severity]?.label || r.severity,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${(r.category || '').replace(/"/g, '""')}"`,
      `"${(r.description || '').replace(/"/g, '""')}"`,
      `"${(r.shop_name || '').replace(/"/g, '""')}"`,
      r.booking_number || '',
      `"${(r.customer_name || '').replace(/"/g, '""')}"`,
      r.customer_phone,
      STATUS_CONFIG[r.status]?.label || r.status,
      `"${(r.admin_notes || '').replace(/"/g, '""')}"`,
      r.resolved_by || ''
    ])
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `foami-incident-reports-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Print Summary
  const handlePrint = () => {
    window.print()
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto', fontFamily: 'Kanit, sans-serif' }}>
      {/* Toast */}
      {successToast && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          background: '#0F172A',
          color: '#FFF',
          padding: '12px 20px',
          borderRadius: 14,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13.5,
          fontWeight: 600
        }}>
          <CheckCircle2 size={18} color="#4ADE80" />
          {successToast}
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#DC2626'
            }}>
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#0F172A' }}>
                ศูนย์จัดการรายงาน & เรื่องร้องเรียน
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                ระบบตรวจสอบปัญหาร้านค้า, ความผิดพลาดของออเดอร์ และข้อร้องเรียนจากลูกค้าทั้งระบบ Foami
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={fetchReports}
            disabled={loading}
            style={{
              padding: '9px 14px',
              borderRadius: 12,
              background: '#FFF',
              border: '1.5px solid #E2E8F0',
              fontSize: 13,
              fontWeight: 700,
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> รีเฟรช
          </button>
          <button
            onClick={handleExportCSV}
            style={{
              padding: '9px 16px',
              borderRadius: 12,
              background: '#FFF',
              border: '1.5px solid #CBD5E1',
              fontSize: 13,
              fontWeight: 700,
              color: '#1E293B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            style={{
              padding: '9px 16px',
              borderRadius: 12,
              background: '#0F172A',
              color: '#FFF',
              border: 'none',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Printer size={14} /> พิมพ์รายงาน
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'เรื่องร้องเรียนทั้งหมด', val: stats.total, color: '#2563EB', bg: '#EFF6FF', icon: FileText },
          { label: 'รอดำเนินการ (Pending)', val: stats.pending, color: '#D97706', bg: '#FEF3C7', icon: Clock, highlight: stats.pending > 0 },
          { label: 'กำลังตรวจสอบ', val: stats.investigating, color: '#0284C7', bg: '#E0F2FE', icon: Search },
          { label: 'แก้ไขเสร็จสิ้น', val: stats.resolved, color: '#16A34A', bg: '#DCFCE7', icon: CheckCircle2 },
          { label: 'ปัญหาร้านค้า', val: stats.shopIssues, color: '#7C3AED', bg: '#F3E8FF', icon: Building2 },
          { label: 'ปัญหาออเดอร์', val: stats.orderIssues, color: '#EA580C', bg: '#FFEDD5', icon: ShoppingBag }
        ].map((item, i) => {
          const Icon = item.icon
          return (
            <div
              key={i}
              style={{
                background: '#FFFFFF',
                borderRadius: 18,
                padding: '16px 18px',
                border: item.highlight ? `2px solid ${item.color}` : '1.5px solid #E2E8F0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: item.color, lineHeight: 1 }}>
                  {item.val}
                </div>
              </div>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: item.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: item.color
              }}>
                <Icon size={18} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters Toolbar */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 18,
        padding: '16px 20px',
        border: '1.5px solid #E2E8F0',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap'
      }}>
        {/* Search */}
        <div style={{ flex: '1 1 260px', position: 'relative' }}>
          <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="ค้นหาเลขเคส, ลูกค้า, เบอร์โทร, ชื่อร้าน, หรือออเดอร์..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 14px 9px 38px',
              borderRadius: 12,
              border: '1.5px solid #CBD5E1',
              fontSize: 13,
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>สถานะ:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1.5px solid #CBD5E1',
              fontSize: 12.5,
              fontWeight: 600,
              outline: 'none',
              background: '#FFF'
            }}
          >
            <option value="all">ทั้งหมด</option>
            <option value="pending">รอดำเนินการ</option>
            <option value="investigating">กำลังตรวจสอบ</option>
            <option value="resolved">แก้ไขแล้ว</option>
            <option value="refunded">คืนเงินแล้ว</option>
            <option value="dismissed">ยกเลิก/ปฏิเสธ</option>
          </select>
        </div>

        {/* Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>ประเภท:</span>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1.5px solid #CBD5E1',
              fontSize: 12.5,
              fontWeight: 600,
              outline: 'none',
              background: '#FFF'
            }}
          >
            <option value="all">ทั้งหมด</option>
            <option value="shop">🏪 ปัญหาร้านค้า</option>
            <option value="order">📦 ปัญหาออเดอร์</option>
            <option value="customer_issue">💬 ปัญหาทั่วไป</option>
          </select>
        </div>

        {/* Severity Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>ความเร่งด่วน:</span>
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1.5px solid #CBD5E1',
              fontSize: 12.5,
              fontWeight: 600,
              outline: 'none',
              background: '#FFF'
            }}
          >
            <option value="all">ทั้งหมด</option>
            <option value="critical">🔴 วิกฤต</option>
            <option value="high">🟠 เร่งด่วน</option>
            <option value="normal">🔵 ปกติ</option>
            <option value="low">⚪ เล็กน้อย</option>
          </select>
        </div>

        {(search || statusFilter !== 'all' || typeFilter !== 'all' || severityFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all'); setSeverityFilter('all'); }}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: 'none',
              background: '#F1F5F9',
              color: '#64748B',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Reports Table / List */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 20,
        border: '1.5px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block', color: '#315EC3' }} />
            กำลังโหลดข้อมูลรายงานและเรื่องร้องเรียน...
          </div>
        ) : filteredReports.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#F1F5F9',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94A3B8',
              marginBottom: 12
            }}>
              <CheckCircle2 size={28} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1E293B' }}>
              ไม่พบรายงานปัญหาในขณะนี้
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>
              ไม่มีเคสที่ตรงกับเงื่อนไขการค้นหา หรือระบบยังไม่มีการแจ้งปัญหาเข้ามา
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 800, fontSize: 12 }}>
                  <th style={{ padding: '14px 18px' }}>รหัสเคส / เวลา</th>
                  <th style={{ padding: '14px 18px' }}>ประเภท & ความเร่งด่วน</th>
                  <th style={{ padding: '14px 18px' }}>หัวข้อปัญหา / รายละเอียด</th>
                  <th style={{ padding: '14px 18px' }}>ร้านค้า / ออเดอร์</th>
                  <th style={{ padding: '14px 18px' }}>ผู้แจ้ง & เบอร์ติดต่อ</th>
                  <th style={{ padding: '14px 18px' }}>สถานะ</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map(r => {
                  const statusInfo = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending
                  const sevInfo = SEVERITY_CONFIG[r.severity] || SEVERITY_CONFIG.normal
                  const typeInfo = TYPE_LABELS[r.report_type] || TYPE_LABELS.general
                  const TypeIcon = typeInfo.icon
                  let dateStr = r.created_at
                  try {
                    dateStr = format(parseISO(r.created_at), 'd MMM yyyy HH:mm', { locale: th })
                  } catch {}

                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Code & Time */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 800, color: '#1E293B', letterSpacing: '.03em' }}>
                          {r.report_number}
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                          {dateStr}
                        </div>
                      </td>

                      {/* Type & Severity */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 8, background: '#F1F5F9', fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          <TypeIcon size={12} />
                          {typeInfo.label}
                        </div>
                        <div>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: sevInfo.badgeBg,
                            color: sevInfo.color,
                            fontSize: 11,
                            fontWeight: 800
                          }}>
                            ● {sevInfo.label}
                          </span>
                        </div>
                      </td>

                      {/* Title & Description */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'top', maxWidth: 320 }}>
                        <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>
                          {r.title}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748B', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {r.description}
                        </div>
                        {r.category && (
                          <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10.5, color: '#94A3B8', background: '#F1F5F9', padding: '1px 6px', borderRadius: 4 }}>
                            {r.category}
                          </span>
                        )}
                      </td>

                      {/* Shop & Order */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                        {r.shop_name ? (
                          <div style={{ fontWeight: 700, color: '#2563EB', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Building2 size={13} /> {r.shop_name}
                          </div>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: 11.5 }}>- ไม่ระบุร้าน -</span>
                        )}
                        {r.booking_number && (
                          <div style={{ fontSize: 11.5, color: '#475569', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ShoppingBag size={12} /> ออเดอร์ #{r.booking_number}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, color: '#1E293B' }}>
                          {r.customer_name}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Phone size={11} /> {r.customer_phone}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: statusInfo.bg,
                          color: statusInfo.text,
                          border: `1px solid ${statusInfo.border}`,
                          fontSize: 11.5,
                          fontWeight: 800
                        }}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'top', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenDetail(r)}
                          style={{
                            padding: '7px 14px',
                            borderRadius: 10,
                            background: '#EFF6FF',
                            color: '#2563EB',
                            border: '1px solid #BFDBFE',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          จัดการเคส <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Case Management Modal */}
      {selectedReport && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          padding: 16
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 24,
            width: '100%',
            maxWidth: 680,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            position: 'relative'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#F8FAFC',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#2563EB', letterSpacing: '.05em' }}>
                    {selectedReport.report_number}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: SEVERITY_CONFIG[selectedReport.severity]?.badgeBg,
                    color: SEVERITY_CONFIG[selectedReport.severity]?.color,
                    fontSize: 11,
                    fontWeight: 800
                  }}>
                    ความเร่งด่วน: {SEVERITY_CONFIG[selectedReport.severity]?.label}
                  </span>
                </div>
                <h3 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                  {selectedReport.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                style={{
                  background: '#F1F5F9', border: 'none', borderRadius: '50%',
                  width: 34, height: 34, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: '#64748B'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, background: '#F8FAFC', padding: 14, borderRadius: 16, border: '1px solid #E2E8F0' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>ผู้ร้องเรียน</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>{selectedReport.customer_name}</div>
                  <div style={{ fontSize: 12, color: '#475569' }}>📞 {selectedReport.customer_phone}</div>
                  {selectedReport.customer_line_id && (
                    <div style={{ fontSize: 11.5, color: '#059669' }}>LINE: {selectedReport.customer_line_id}</div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>ร้านค้าที่เกี่ยวข้อง</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#2563EB' }}>
                    {selectedReport.shop_name || '-'}
                  </div>
                  {selectedReport.booking_number && (
                    <div style={{ fontSize: 12, color: '#475569' }}>
                      ออเดอร์: #{selectedReport.booking_number}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>หมวดหมู่ปัญหา</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>{selectedReport.category}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>
                    แจ้งเมื่อ: {format(parseISO(selectedReport.created_at), 'd MMM yyyy HH:mm', { locale: th })}
                  </div>
                </div>
              </div>

              {/* Description Box */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                  รายละเอียดเหตุการณ์ / ข้อร้องเรียน
                </div>
                <div style={{
                  padding: 14,
                  borderRadius: 14,
                  background: '#FFF1F2',
                  border: '1px solid #FECDD3',
                  color: '#9F1239',
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-line'
                }}>
                  {selectedReport.description}
                </div>
              </div>

              {/* Admin Resolution Controls */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: 16,
                padding: 18,
                border: '1.5px solid #CBD5E1',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldAlert size={16} color="#2563EB" /> ส่วนงานจัดการของแอดมิน (Admin Resolution)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                      สถานะเคส (Case Status)
                    </label>
                    <select
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1.5px solid #94A3B8',
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        outline: 'none',
                        background: '#FFF'
                      }}
                    >
                      <option value="pending">⏳ รอดำเนินการ (Pending)</option>
                      <option value="investigating">🔍 กำลังตรวจสอบ (Investigating)</option>
                      <option value="resolved">✅ แก้ไขเสร็จสิ้น (Resolved)</option>
                      <option value="refunded">💰 คืนเงินให้ลูกค้าเรียบร้อย (Refunded)</option>
                      <option value="dismissed">❌ ปฏิเสธเคส / ไม่เป็นความจริง (Dismissed)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                      ชื่อแอดมินผู้ดำเนินการ (Resolved By)
                    </label>
                    <input
                      type="text"
                      value={editResolvedBy}
                      onChange={e => setEditResolvedBy(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1.5px solid #94A3B8',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                    บันทึกการตรวจสอบและแก้ไข (Admin Resolution Notes)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="เช่น โทรประสานงานกับร้านค้าแล้ว ทางร้านยินดีล้างใหม่อีกรอบฟรี, หรือ ได้ทำการโอนเงินคืนลูกค้าเรียบร้อย..."
                    value={editAdminNotes}
                    onChange={e => setEditAdminNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1.5px solid #94A3B8',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      outline: 'none',
                      boxSizing: 'border-box',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 12,
                    border: '1.5px solid #CBD5E1',
                    background: '#FFF',
                    color: '#64748B',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  type="button"
                  onClick={handleSaveResolution}
                  disabled={updating}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 12,
                    border: 'none',
                    background: '#2563EB',
                    color: '#FFF',
                    fontSize: 13.5,
                    fontWeight: 800,
                    cursor: updating ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {updating ? 'กำลังบันทึก...' : (
                    <>
                      <Check size={16} /> บันทึกผลการดำเนินการ
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
