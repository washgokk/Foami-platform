'use client'
import React, { useState, useEffect } from 'react'
import {
  X, AlertTriangle, ShieldAlert, CheckCircle2, MessageSquare, Store, Package,
  Building2, ShoppingBag, Phone, User, Send, ChevronRight, Copy, Check
} from 'lucide-react'

export interface ReportIssueModalProps {
  isOpen: boolean
  onClose: () => void
  initialType?: 'shop' | 'order' | 'customer_issue' | 'payment' | 'general'
  shopSlug?: string
  shopName?: string
  bookingId?: string
  bookingNumber?: string
  defaultCustomerName?: string
  defaultCustomerPhone?: string
  onSuccess?: (reportNumber: string) => void
}

const SHOP_CATEGORIES = [
  'ข้อมูลร้านไม่ถูกต้อง / ไม่ตรงปก',
  'ร้านไม่เปิดบริการตามเวลาที่ระบุ',
  'ติดต่อร้านค้าไม่ได้',
  'คิดราคาไม่ตรงกับที่แสดงในระบบ',
  'พฤติกรรมผู้ให้บริการไม่เหมาะสม',
  'ปฏิเสธการให้บริการโดยไม่มีเหตุผล',
  'อื่นๆ เกี่ยวกับร้านค้า'
]

const ORDER_CATEGORIES = [
  'ช่างมาสาย / ไม่มาตามเวลานัด',
  'งานล้างไม่สะอาด / งานไม่เรียบร้อย',
  'พบรอยขีดข่วนหรือความเสียหายกับรถ',
  'คิดค่าบริการไม่ตรง / ชำระเงินซ้ำซ้อน',
  'พนักงานพูดจาไม่สุภาพ',
  'ไม่ได้รับบริการเสริมตามที่สั่ง (Add-ons)',
  'อื่นๆ เกี่ยวกับออเดอร์'
]

const GENERAL_CATEGORIES = [
  'ปัญหาการใช้งานระบบ / หน้าเว็บ',
  'ปัญหาการชำระเงินออนไลน์',
  'ปัญหาการเข้าสู่ระบบ',
  'ข้อเสนอแนะการให้บริการ',
  'อื่นๆ'
]

export default function ReportIssueModal({
  isOpen,
  onClose,
  initialType = 'customer_issue',
  shopSlug,
  shopName,
  bookingId,
  bookingNumber,
  defaultCustomerName = '',
  defaultCustomerPhone = '',
  onSuccess
}: ReportIssueModalProps) {
  const [reportType, setReportType] = useState(initialType)
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<'low' | 'normal' | 'high' | 'critical'>('normal')
  const [customerName, setCustomerName] = useState(defaultCustomerName)
  const [customerPhone, setCustomerPhone] = useState(defaultCustomerPhone)
  const [customerLineId, setCustomerLineId] = useState('')
  const [evidencePhotoUrl, setEvidencePhotoUrl] = useState('')
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [createdCaseNumber, setCreatedCaseNumber] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setReportType(initialType)
      const cats = initialType === 'shop'
        ? SHOP_CATEGORIES
        : initialType === 'order'
        ? ORDER_CATEGORIES
        : GENERAL_CATEGORIES
      setCategory(cats[0])
      setCustomerName(defaultCustomerName || '')
      setCustomerPhone(defaultCustomerPhone || '')
      setErrorMsg('')
      setCreatedCaseNumber(null)
      setCopied(false)
    }
  }, [isOpen, initialType, defaultCustomerName, defaultCustomerPhone])

  if (!isOpen) return null

  const handleAddPhoto = () => {
    if (evidencePhotoUrl.trim() && !evidencePhotos.includes(evidencePhotoUrl.trim())) {
      setEvidencePhotos([...evidencePhotos, evidencePhotoUrl.trim()])
      setEvidencePhotoUrl('')
    }
  }

  const handleRemovePhoto = (idx: number) => {
    setEvidencePhotos(evidencePhotos.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!customerName.trim() || !customerPhone.trim()) {
      setErrorMsg('กรุณากรอกชื่อและเบอร์โทรศัพท์สำหรับให้เจ้าหน้าที่ติดต่อกลับ')
      return
    }

    if (!title.trim() || !description.trim()) {
      setErrorMsg('กรุณากรอกหัวข้อปัญหาและรายละเอียดที่ต้องการแจ้ง')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: reportType,
          shop_slug: shopSlug || null,
          shop_name: shopName || null,
          booking_id: bookingId || null,
          booking_number: bookingNumber || null,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_line_id: customerLineId || null,
          title,
          category,
          description,
          evidence_photos: evidencePhotos,
          severity
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการส่งข้อมูล')
      }

      const caseNum = data.report?.report_number || 'RPT-SUCCESS'
      setCreatedCaseNumber(caseNum)
      if (onSuccess) onSuccess(caseNum)
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถส่งเรื่องได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyCase = () => {
    if (createdCaseNumber) {
      navigator.clipboard.writeText(createdCaseNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const categoryOptions = reportType === 'shop'
    ? SHOP_CATEGORIES
    : reportType === 'order'
    ? ORDER_CATEGORIES
    : GENERAL_CATEGORIES

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      padding: 16,
      fontFamily: 'Kanit, sans-serif'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 24,
        width: '100%',
        maxWidth: 540,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FEF2F2',
          borderBottom: '1px solid #FEE2E2',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#DC2626'
            }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                {reportType === 'shop' ? 'รายงานปัญหาร้านค้า' : reportType === 'order' ? 'แจ้งปัญหาเกี่ยวกับออเดอร์' : 'แจ้งปัญหา / ข้อร้องเรียน'}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
                {shopName ? `ร้าน: ${shopName}` : bookingNumber ? `ออเดอร์: #${bookingNumber}` : 'ระบบรับเรื่องร้องเรียนและแก้ไขปัญหา Foami'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '50%',
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748B'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24 }}>
          {createdCaseNumber ? (
            /* Success State */
            <div style={{ textAlign: 'center', padding: '24px 8px' }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#DCFCE7',
                color: '#16A34A',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
              }}>
                <CheckCircle2 size={36} />
              </div>
              <h4 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                ส่งเรื่องร้องเรียนเรียบร้อยแล้ว
              </h4>
              <p style={{ margin: '0 0 20px', fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
                ทีมงานแอดมิน Foami ได้รับเรื่องของท่านแล้ว และจะตรวจสอบร่วมกับผู้เกี่ยวข้องโดยเร็วที่สุด
              </p>

              <div style={{
                background: '#F6F8FF',
                border: '1.5px dashed #315EC3',
                borderRadius: 16,
                padding: '14px 18px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 24
              }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>หมายเลขติดตามเคส (Case Ticket)</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#315EC3', letterSpacing: '.05em' }}>
                    {createdCaseNumber}
                  </div>
                </div>
                <button
                  onClick={handleCopyCase}
                  style={{
                    background: copied ? '#DCFCE7' : '#EFF6FF',
                    color: copied ? '#16A34A' : '#2563EB',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                </button>
              </div>

              <div>
                <button
                  onClick={onClose}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    borderRadius: 14,
                    background: '#315EC3',
                    color: '#FFF',
                    border: 'none',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  เสร็จสิ้นและปิดหน้าต่าง
                </button>
              </div>
            </div>
          ) : (
            /* Form State */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {errorMsg && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#B91C1C',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Type Switcher if not locked */}
              <div style={{ display: 'flex', gap: 8, background: '#EFF3FD', padding: 4, borderRadius: 14, border: '1px solid #DDE3F5' }}>
                <button
                  type="button"
                  onClick={() => setReportType('shop')}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: reportType === 'shop' ? '#FFFFFF' : 'transparent',
                    color: reportType === 'shop' ? '#1A2340' : '#4B5E86',
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: reportType === 'shop' ? '0 1px 4px rgba(49, 94, 195, 0.12)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Store size={15} style={{ color: reportType === 'shop' ? '#315EC3' : '#64748B' }} />
                  <span>ปัญหาร้านค้า</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('order')}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: reportType === 'order' ? '#FFFFFF' : 'transparent',
                    color: reportType === 'order' ? '#1A2340' : '#4B5E86',
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: reportType === 'order' ? '0 1px 4px rgba(49, 94, 195, 0.12)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Package size={15} style={{ color: reportType === 'order' ? '#315EC3' : '#64748B' }} />
                  <span>ปัญหาออเดอร์</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('customer_issue')}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: reportType === 'customer_issue' ? '#FFFFFF' : 'transparent',
                    color: reportType === 'customer_issue' ? '#1A2340' : '#4B5E86',
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: reportType === 'customer_issue' ? '0 1px 4px rgba(49, 94, 195, 0.12)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <MessageSquare size={15} style={{ color: reportType === 'customer_issue' ? '#315EC3' : '#64748B' }} />
                  <span>ปัญหาทั่วไป</span>
                </button>
              </div>

              {/* Related Info Display */}
              {(shopName || bookingNumber) && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: '#F6F8FF',
                  border: '1px solid #DDE3F5',
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}>
                  {shopName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#334155' }}>
                      <Building2 size={14} color="#64748B" />
                      <span><strong>ร้าน:</strong> {shopName}</span>
                    </div>
                  )}
                  {bookingNumber && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#334155' }}>
                      <ShoppingBag size={14} color="#64748B" />
                      <span><strong>รหัสการจอง:</strong> #{bookingNumber}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Category */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  หมวดหมู่ของปัญหา <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1.5px solid #DDE3F5',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                    color: '#0F172A',
                    background: '#FFFFFF'
                  }}
                >
                  {categoryOptions.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  หัวข้อปัญหา / สรุปสั้นๆ <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น ช่างมาสายเกิน 30 นาที, ล้างไม่สะอาดมีคราบตกค้าง"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1.5px solid #DDE3F5',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                    color: '#0F172A',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  รายละเอียดปัญหา <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="อธิบายเหตุการณ์ที่เกิดขึ้น เช่น เวลาที่นัดหมาย พฤติกรรม หรือจุดที่พบปัญหา..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1.5px solid #DDE3F5',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Severity */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  ระดับความเร่งด่วน
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { id: 'low', label: 'เล็กน้อย', color: '#64748B' },
                    { id: 'normal', label: 'ปกติ', color: '#315EC3' },
                    { id: 'high', label: 'เร่งด่วน', color: '#D97706' },
                    { id: 'critical', label: 'วิกฤต / เสียหายหนัก', color: '#DC2626' }
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSeverity(s.id as any)}
                      style={{
                        flex: 1,
                        padding: '8px 6px',
                        borderRadius: 10,
                        border: severity === s.id ? `2px solid ${s.color}` : '1.5px solid #E2E8F0',
                        background: severity === s.id ? `${s.color}10` : '#FFF',
                        color: severity === s.id ? s.color : '#64748B',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Contact */}
              <div style={{ background: '#F6F8FF', padding: 14, borderRadius: 14, border: '1px solid #DDE3F5' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#1E293B', marginBottom: 8 }}>
                  ข้อมูลผู้แจ้ง (สำหรับเจ้าหน้าที่ติดต่อประสานงาน)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#64748B', marginBottom: 4 }}>
                      ชื่อผู้แจ้ง <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ชื่อ-นามสกุล"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 10,
                        border: '1px solid #DDE3F5', fontSize: 12.5, fontFamily: 'inherit',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#64748B', marginBottom: 4 }}>
                      เบอร์โทรศัพท์ <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="08X-XXX-XXXX"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 10,
                        border: '1px solid #DDE3F5', fontSize: 12.5, fontFamily: 'inherit',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#64748B', marginBottom: 4 }}>
                    LINE ID หรือ Email (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น @line_id หรือ email@example.com"
                    value={customerLineId}
                    onChange={e => setCustomerLineId(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 10,
                      border: '1px solid #DDE3F5', fontSize: 12.5, fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 14,
                    border: '1.5px solid #DDE3F5',
                    background: '#FFF',
                    color: '#64748B',
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 2,
                    padding: '12px 16px',
                    borderRadius: 14,
                    border: 'none',
                    background: '#DC2626',
                    color: '#FFF',
                    fontSize: 13.5,
                    fontWeight: 800,
                    cursor: submitting ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)'
                  }}
                >
                  {submitting ? 'กำลังส่งข้อมูล...' : (
                    <>
                      <Send size={15} /> ยืนยันการส่งเรื่องร้องเรียน
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
