'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import {
  AlertTriangle, ShieldAlert, CheckCircle2, Clock, Search,
  RefreshCw, Download, ChevronRight, X, Building2, ShoppingBag,
  Phone, MessageSquare, AlertCircle, FileText, Check
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { IncidentReport } from '@/app/admin/platform/reports/page'

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

export default function ShopReportsPage() {
  const params = useParams()
  const branchSlug = (params?.branchSlug as string) || 'kku'

  const [reports, setReports] = useState<IncidentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null)
  const [updating, setUpdating] = useState(false)
  const [editStatus, setEditStatus] = useState<any>('pending')
  const [editAdminNotes, setEditAdminNotes] = useState('')
  const [successToast, setSuccessToast] = useState('')

  const fetchReports = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports?shop_slug=${branchSlug}`)
      const data = await res.json()
      if (data.reports) {
        setReports(data.reports)
      }
    } catch (err) {
      console.error('Failed to load shop reports:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [branchSlug])

  const handleOpenDetail = (r: IncidentReport) => {
    setSelectedReport(r)
    setEditStatus(r.status)
    setEditAdminNotes(r.admin_notes || '')
  }

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
          resolved_by: `Shop Manager (${branchSlug})`
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccessToast(`อัปเดตเคส #${selectedReport.report_number} เรียบร้อย`)
        setSelectedReport(null)
        fetchReports()
        setTimeout(() => setSuccessToast(''), 3000)
      } else {
        alert(data.error || 'ไม่สามารถอัปเดตได้')
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setUpdating(false)
    }
  }

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchNum = r.report_number.toLowerCase().includes(q)
        const matchTitle = r.title.toLowerCase().includes(q)
        const matchCust = r.customer_name.toLowerCase().includes(q)
        const matchPhone = r.customer_phone.includes(q)
        const matchBooking = r.booking_number && r.booking_number.toLowerCase().includes(q)
        if (!matchNum && !matchTitle && !matchCust && !matchPhone && !matchBooking) return false
      }
      return true
    })
  }, [reports, statusFilter, search])

  const pendingCount = reports.filter(r => r.status === 'pending').length

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto', fontFamily: 'Kanit, sans-serif' }}>
      {successToast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          background: '#0F172A', color: '#FFF', padding: '12px 20px',
          borderRadius: 14, boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 600
        }}>
          <CheckCircle2 size={18} color="#4ADE80" />
          {successToast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, background: '#FEE2E2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626'
          }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0F172A' }}>
              รายงานปัญหา & ข้อร้องเรียนประจำร้าน
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
              ข้อร้องเรียนและปัญหาจากลูกค้าที่เกี่ยวข้องกับสาขานี้ เพื่อการปรับปรุงการบริการที่รวดเร็ว
            </p>
          </div>
        </div>

        <button
          onClick={fetchReports}
          disabled={loading}
          style={{
            padding: '9px 16px', borderRadius: 12, background: '#FFF',
            border: '1.5px solid #CBD5E1', fontSize: 13, fontWeight: 700,
            color: '#1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> รีเฟรชข้อมูล
        </button>
      </div>

      {/* Stats Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ background: '#FFF', borderRadius: 16, padding: '16px 20px', border: '1.5px solid #E2E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>เคสทั้งหมดของสาขา</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#2563EB' }}>{reports.length}</div>
        </div>
        <div style={{
          background: '#FFF', borderRadius: 16, padding: '16px 20px',
          border: pendingCount > 0 ? '2px solid #F59E0B' : '1.5px solid #E2E8F0'
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>รอดำเนินการ (Pending)</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#D97706' }}>{pendingCount}</div>
        </div>
        <div style={{ background: '#FFF', borderRadius: 16, padding: '16px 20px', border: '1.5px solid #E2E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>แก้ไขเสร็จสิ้น</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#16A34A' }}>
            {reports.filter(r => r.status === 'resolved' || r.status === 'refunded').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: '#FFF', borderRadius: 16, padding: '14px 18px',
        border: '1.5px solid #E2E8F0', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
      }}>
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="ค้นหาเคส, ลูกค้า, เบอร์โทร, ออเดอร์..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 34px', borderRadius: 10,
              border: '1.5px solid #CBD5E1', fontSize: 12.5, outline: 'none',
              fontFamily: 'inherit', boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>สถานะ:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 12px', borderRadius: 10, border: '1.5px solid #CBD5E1',
              fontSize: 12, fontWeight: 600, outline: 'none', background: '#FFF'
            }}
          >
            <option value="all">ทั้งหมด</option>
            <option value="pending">รอดำเนินการ</option>
            <option value="investigating">กำลังตรวจสอบ</option>
            <option value="resolved">แก้ไขแล้ว</option>
            <option value="refunded">คืนเงินแล้ว</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div style={{ background: '#FFF', borderRadius: 20, border: '1.5px solid #E2E8F0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
            <RefreshCw size={26} className="animate-spin" style={{ margin: '0 auto 10px', display: 'block', color: '#315EC3' }} />
            กำลังโหลดข้อมูลปัญหา...
          </div>
        ) : filteredReports.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#DCFCE7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A', marginBottom: 12 }}>
              <CheckCircle2 size={26} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1E293B' }}>
              ยอดเยี่ยม! ไม่มีรายงานปัญหาค้างอยู่
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>
              สาขาของคุณให้บริการได้ตามมาตรฐาน ลูกค้าไม่มีข้อร้องเรียนที่ยังไม่ได้แก้ไข
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 800, fontSize: 12 }}>
                  <th style={{ padding: '14px 18px' }}>รหัสเคส / เวลา</th>
                  <th style={{ padding: '14px 18px' }}>หัวข้อปัญหา</th>
                  <th style={{ padding: '14px 18px' }}>ออเดอร์</th>
                  <th style={{ padding: '14px 18px' }}>ลูกค้า</th>
                  <th style={{ padding: '14px 18px' }}>สถานะ</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map(r => {
                  const statusInfo = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending
                  const sevInfo = SEVERITY_CONFIG[r.severity] || SEVERITY_CONFIG.normal
                  let dateStr = r.created_at
                  try {
                    dateStr = format(parseISO(r.created_at), 'd MMM yyyy HH:mm', { locale: th })
                  } catch {}

                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 800, color: '#1E293B' }}>{r.report_number}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{dateStr}</div>
                      </td>
                      <td style={{ padding: '14px 18px', maxWidth: 300 }}>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{r.title}</div>
                        <div style={{ fontSize: 11.5, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.description}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {r.booking_number ? `#${r.booking_number}` : '-'}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#1E293B' }}>{r.customer_name}</div>
                        <div style={{ fontSize: 11.5, color: '#64748B' }}>📞 {r.customer_phone}</div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 999, background: statusInfo.bg,
                          color: statusInfo.text, border: `1px solid ${statusInfo.border}`,
                          fontSize: 11.5, fontWeight: 800
                        }}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenDetail(r)}
                          style={{
                            padding: '6px 12px', borderRadius: 8, background: '#EFF6FF',
                            color: '#2563EB', border: '1px solid #BFDBFE', fontSize: 12,
                            fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          จัดการเคส
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

      {/* Detail Modal */}
      {selectedReport && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)', padding: 16
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 580,
            maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>เคส {selectedReport.report_number}</h3>
              <button onClick={() => setSelectedReport(null)} style={{ border: 'none', background: '#F1F5F9', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: '#FFF1F2', padding: 14, borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, color: '#9F1239', fontSize: 14 }}>{selectedReport.title}</div>
              <div style={{ color: '#BE123C', fontSize: 13, marginTop: 4 }}>{selectedReport.description}</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>สถานะการแก้ไข</label>
              <select
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontSize: 13 }}
              >
                <option value="pending">⏳ รอดำเนินการ</option>
                <option value="investigating">🔍 กำลังตรวจสอบ</option>
                <option value="resolved">✅ แก้ไขเรียบร้อยแล้ว</option>
                <option value="refunded">💰 ดำเนินการคืนเงินแล้ว</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>บันทึกการแก้ปัญหาของร้านค้า</label>
              <textarea
                rows={3}
                placeholder="ระบุการดำเนินการ เช่น ติดต่อขอโทษลูกค้าแล้ว, ได้ส่งช่างไปแก้ไขงานเรียบร้อย..."
                value={editAdminNotes}
                onChange={e => setEditAdminNotes(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedReport(null)}
                style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer' }}
              >
                ปิด
              </button>
              <button
                onClick={handleSaveResolution}
                disabled={updating}
                style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#FFF', fontWeight: 800, cursor: 'pointer' }}
              >
                {updating ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
