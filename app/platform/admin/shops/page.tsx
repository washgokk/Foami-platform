'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  Store, CheckCircle2, XCircle, ChevronDown, Key, ExternalLink,
  Shield, MessageCircle, AlertCircle, Copy, Check, Eye, EyeOff,
  Search, ShieldCheck, Clock, Phone, Mail, MapPin, FileText,
  Upload, Trash2, X, Download, AlertTriangle, Building2, User
} from 'lucide-react'
import PlatformShopChatModal from '@/components/Chat/PlatformShopChatModal'

interface VerificationDoc {
  id: string
  name: string
  type: string
  data_url: string
  uploaded_at: string
  size_kb?: number
}

interface Shop {
  id: string
  name: string
  slug: string
  address: string
  phone: string | null
  lat: number
  lng: number
  is_active: boolean
  has_insurance: boolean
  is_verified: boolean
  verification_docs: VerificationDoc[]
  plan_tier: string
  monetization_mode: string
  owner_name: string
  owner_phone: string
  owner_email: string
  platform_fee_pct: number
  booking_count: number
  completed_count: number
  total_revenue: number
  created_at: string
  contract?: {
    plan?: string
    months?: number
    start_date?: string
    end_date?: string
  }
}

function getAdminToken() {
  if (typeof window === 'undefined') return 'foami_platform_admin_2025'
  return localStorage.getItem('platform_token') || 'foami_platform_admin_2025'
}

export default function PlatformShopsPage() {


  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [credModal, setCredModal] = useState<Shop | null>(null)
  const [activeChatShop, setActiveChatShop] = useState<Shop | null>(null)
  const [chatUnreadMap, setChatUnreadMap] = useState<Record<string, number>>({})
  const [expandedFee, setExpandedFee] = useState<string | null>(null)
  const [feeInput, setFeeInput] = useState<string>('')

  // Verification & Profile Drawer state
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [drawerTab, setDrawerTab] = useState<'profile' | 'docs' | 'plan'>('profile')
  const [docUploadType, setDocUploadType] = useState('id_card')
  const [docUploadName, setDocUploadName] = useState('')
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<VerificationDoc | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Drawer plan edits
  const [drawerPlanTier, setDrawerPlanTier] = useState('starter')
  const [drawerMonetization, setDrawerMonetization] = useState('commission')
  const [drawerFeePct, setDrawerFeePct] = useState(15)
  const [savingPlan, setSavingPlan] = useState(false)

  const loadShops = useCallback(async () => {
    try {
      const token = getAdminToken()
      const res = await fetch('/api/platform/shops', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.shops) {
        setShops(data.shops)
        // If drawer is open, keep selectedShop synced
        if (selectedShop) {
          const updated = data.shops.find((s: Shop) => s.id === selectedShop.id)
          if (updated) setSelectedShop(updated)
        }
      }
    } catch (err) {
      console.error('Failed to load shops:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedShop])

  useEffect(() => {
    loadShops()
  }, [])

  // Sync drawer fields when a shop is selected
  useEffect(() => {
    if (selectedShop) {
      setDrawerPlanTier(selectedShop.plan_tier || 'starter')
      setDrawerMonetization(selectedShop.monetization_mode || 'commission')
      setDrawerFeePct(Math.round((selectedShop.platform_fee_pct ?? 0.15) * 100))
    }
  }, [selectedShop?.id])

  const loadChatUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/chat/unread-counts')
      const data = await res.json()
      if (data.counts) setChatUnreadMap(data.counts)
    } catch (err) {
      console.warn('Failed to load unread chat counts:', err)
    }
  }, [])

  useEffect(() => {
    loadChatUnread()
    const timer = setInterval(loadChatUnread, 30000)
    return () => clearInterval(timer)
  }, [loadChatUnread])

  const filteredShops = useMemo(() => {
    return shops.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.slug.toLowerCase().includes(search.toLowerCase()) ||
      (s.owner_name && s.owner_name.toLowerCase().includes(search.toLowerCase())) ||
      (s.address && s.address.toLowerCase().includes(search.toLowerCase()))
    )
  }, [shops, search])

  const toggleActive = async (shop: Shop) => {
    setActionLoading(shop.id)
    try {
      await fetch('/api/platform/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ shop_id: shop.id, is_active: !shop.is_active })
      })
      await loadShops()
    } finally {
      setActionLoading(null)
    }
  }

  const toggleInsurance = async (shop: Shop) => {
    setActionLoading(shop.id)
    try {
      await fetch('/api/platform/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ shop_id: shop.id, has_insurance: !shop.has_insurance })
      })
      await loadShops()
    } finally {
      setActionLoading(null)
    }
  }

  const toggleVerified = async (shop: Shop) => {
    setActionLoading(shop.id)
    const nextVal = !shop.is_verified
    try {
      await fetch('/api/platform/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ shop_id: shop.id, is_verified: nextVal })
      })
      await loadShops()
      if (selectedShop && selectedShop.id === shop.id) {
        setSelectedShop(prev => prev ? { ...prev, is_verified: nextVal } : null)
      }
    } finally {
      setActionLoading(null)
    }
  }

  const saveFee = async (shopId: string) => {
    const parsed = parseFloat(feeInput) / 100
    if (isNaN(parsed) || parsed < 0 || parsed > 0.5) {
      alert('กรุณาระบุเปอร์เซ็นต์ระหว่าง 0% ถึง 50%')
      return
    }
    setActionLoading(shopId)
    try {
      await fetch('/api/platform/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ shop_id: shopId, platform_fee_pct: parsed })
      })
      setExpandedFee(null)
      await loadShops()
    } finally {
      setActionLoading(null)
    }
  }

  const saveDrawerPlanSettings = async () => {
    if (!selectedShop) return
    setSavingPlan(true)
    try {
      await fetch('/api/platform/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({
          shop_id: selectedShop.id,
          plan_tier: drawerPlanTier,
          monetization_mode: drawerMonetization,
          platform_fee_pct: drawerFeePct / 100
        })
      })
      alert('บันทึกการตั้งค่าแพ็กเกจสำเร็จ')
      await loadShops()
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSavingPlan(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedShop) return

    if (file.size > 10 * 1024 * 1024) {
      alert('ไฟล์มีขนาดใหญ่เกิน 10MB กรุณาเลือกไฟล์ที่เล็กลง')
      return
    }

    setUploadingDoc(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = reader.result as string
        const newDoc: VerificationDoc = {
          id: 'doc_' + Date.now(),
          name: docUploadName.trim() || file.name,
          type: docUploadType,
          data_url: dataUrl,
          uploaded_at: new Date().toISOString(),
          size_kb: Math.round(file.size / 1024)
        }

        const existingDocs = selectedShop.verification_docs || []
        const nextDocs = [newDoc, ...existingDocs]

        await fetch('/api/platform/shops', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
          body: JSON.stringify({
            shop_id: selectedShop.id,
            verification_docs: nextDocs
          })
        })

        setDocUploadName('')
        setSelectedShop(prev => prev ? { ...prev, verification_docs: nextDocs } : null)
        await loadShops()
        alert('อัปโหลดและบันทึกเอกสารเรียบร้อยแล้ว')
      }
      reader.readAsDataURL(file)
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการอัปโหลด: ' + err.message)
    } finally {
      setUploadingDoc(false)
      e.target.value = ''
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    if (!selectedShop || !confirm('ยืนยันลบเอกสารนี้?')) return
    const nextDocs = (selectedShop.verification_docs || []).filter(d => d.id !== docId)

    await fetch('/api/platform/shops', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
      body: JSON.stringify({
        shop_id: selectedShop.id,
        verification_docs: nextDocs
      })
    })
    setSelectedShop(prev => prev ? { ...prev, verification_docs: nextDocs } : null)
    await loadShops()
  }

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const getDocTypeLabel = (type: string) => {
    switch (type) {
      case 'id_card': return 'สำเนาบัตรประชาชน'
      case 'business_reg': return 'ทะเบียนพาณิชย์ / นิติบุคคล'
      case 'storefront': return 'รูปถ่ายหน้าร้าน / อุปกรณ์'
      case 'contract': return 'สัญญาพาร์ทเนอร์ลงนาม'
      default: return 'เอกสารยืนยันตัวตน'
    }
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px', fontFamily: 'var(--font-sans, system-ui)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary, #0F172A)', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <Building2 size={28} color="#315EC3" /> จัดการร้านค้าพาร์ทเนอร์ (Platform Shops)
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary, #64748B)', fontSize: 14 }}>
            ตรวจสอบข้อมูล KYC, อนุมัติเครื่องหมายร้านค้าปลอดภัย, บริหารค่าคอมมิชชั่น GP และจัดการสิทธิ์สาขา
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', minWidth: 320 }}>
          <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="ค้นหาชื่อร้าน, สลัก, เจ้าของ, ที่อยู่..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '9px 14px 9px 38px', borderRadius: 12,
              border: '1.5px solid var(--border, #E2E8F0)', fontSize: 13.5,
              background: 'var(--surface-card, #fff)', outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Info Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)',
        border: '1px solid #BFDBFE',
        borderRadius: 14,
        padding: '14px 18px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShieldCheck size={24} color="#2563EB" />
          <div style={{ fontSize: 13.5, color: '#1E40AF' }}>
            <span style={{ fontWeight: 700 }}>ขั้นตอนการยืนยันร้านค้า (KYC):</span> ร้านค้าส่งเอกสารมาที่ <strong>washgo.kk@gmail.com</strong> แอดมินตรวจสอบความถูกต้อง และกด <strong>&ldquo;ดูข้อมูล & ตรวจสอบ&rdquo;</strong> เพื่ออัปโหลดเอกสารเก็บเป็นประวัติและเปิดป้าย <strong>Verified Partner ✓</strong>
          </div>
        </div>
        <Link
          href="/platform/admin/invitations"
          style={{
            padding: '7px 14px', borderRadius: 10, background: '#315EC3', color: '#fff',
            textDecoration: 'none', fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6
          }}
        >
          + สร้าง Invitation Code เชิญร้าน
        </Link>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface-card, #fff)',
        borderRadius: 16,
        border: '1px solid var(--border, #E2E8F0)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>กำลังโหลดข้อมูลร้านค้า...</div>
        ) : filteredShops.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>ไม่พบข้อมูลร้านค้าตามที่ค้นหา</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: 12, fontWeight: 700 }}>
                  <th style={{ padding: '14px 18px' }}>ร้าน / สาขา</th>
                  <th style={{ padding: '14px 16px' }}>สถานะความปลอดภัย (Verified)</th>
                  <th style={{ padding: '14px 16px' }}>แพ็กเกจ & GP</th>
                  <th style={{ padding: '14px 16px' }}>สิทธิ์ พ.ร.บ.</th>
                  <th style={{ padding: '14px 16px' }}>สถานะเปิดร้าน</th>
                  <th style={{ padding: '14px 16px' }}>ข้อมูลติดต่อ & ตรวจสอบ</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredShops.map(shop => {
                  const isVerified = Boolean(shop.is_verified)
                  return (
                    <tr key={shop.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}>
                      {/* Name & Slug */}
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: 14 }}>{shop.name}</div>
                        <div style={{ color: '#64748B', fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>/{shop.slug}</span>
                          {shop.contract?.months && (
                            <span style={{ padding: '1px 6px', background: '#F1F5F9', borderRadius: 6, fontSize: 11 }}>
                              สัญญา {shop.contract.months} ด.
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Verified Status */}
                      <td style={{ padding: '16px 16px' }}>
                        <button
                          type="button"
                          onClick={() => toggleVerified(shop)}
                          disabled={actionLoading === shop.id}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                            border: isVerified ? '1.5px solid #86EFAC' : '1.5px solid #FDE68A',
                            background: isVerified ? '#DCFCE7' : '#FEF3C7',
                            color: isVerified ? '#15803D' : '#B45309',
                            cursor: 'pointer'
                          }}
                          title="คลิกเพื่อสลับสถานะยืนยันร้านค้าปลอดภัย"
                        >
                          {isVerified ? <ShieldCheck size={14} /> : <Clock size={14} />}
                          <span>{isVerified ? '✓ ยืนยันแล้ว ปลอดภัย' : 'รอตรวจสอบ KYC'}</span>
                        </button>
                      </td>

                      {/* Plan & Fee */}
                      <td style={{ padding: '16px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                            background: shop.plan_tier === 'enterprise' ? '#ECFDF5' : shop.plan_tier === 'pro' ? '#EDE9FE' : '#F1F5F9',
                            color: shop.plan_tier === 'enterprise' ? '#065F46' : shop.plan_tier === 'pro' ? '#6D28D9' : '#475569'
                          }}>
                            {shop.plan_tier === 'enterprise' ? 'ENTERPRISE' : shop.plan_tier === 'pro' ? 'PRO' : 'STARTER'}
                          </span>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>
                            {((shop.platform_fee_pct !== undefined && shop.platform_fee_pct !== null ? (shop.platform_fee_pct > 1 ? shop.platform_fee_pct / 100 : shop.platform_fee_pct) : 0.15) * 100).toFixed(0)}% GP
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                          {shop.monetization_mode === 'subscription' ? 'เหมาจ่ายรายเดือน' : 'หักคอมมิชชั่น GP'}
                        </div>
                      </td>

                      {/* Insurance Toggle */}
                      <td style={{ padding: '16px 16px' }}>
                        <button
                          type="button"
                          onClick={() => toggleInsurance(shop)}
                          disabled={actionLoading === shop.id}
                          style={{
                            padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                            cursor: 'pointer',
                            border: shop.has_insurance ? '1.5px solid #86EFAC' : '1.5px solid #E2E8F0',
                            background: shop.has_insurance ? '#DCFCE7' : '#F8FAFC',
                            color: shop.has_insurance ? '#15803D' : '#64748B',
                            display: 'inline-flex', alignItems: 'center', gap: 5
                          }}
                        >
                          <Shield size={12} />
                          <span>{shop.has_insurance ? 'เปิดสิทธิ์' : 'ปิดอยู่'}</span>
                        </button>
                      </td>

                      {/* Active Status */}
                      <td style={{ padding: '16px 16px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                          background: shop.is_active ? '#DCFCE7' : '#FEE2E2',
                          color: shop.is_active ? '#15803D' : '#B91C1C'
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: shop.is_active ? '#16A34A' : '#DC2626' }} />
                          {shop.is_active ? 'เปิดบริการ' : 'ระงับการใช้งาน'}
                        </span>
                      </td>

                      {/* View & Verify Action */}
                      <td style={{ padding: '16px 16px' }}>
                        <button
                          type="button"
                          onClick={() => { setSelectedShop(shop); setDrawerTab('profile') }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '6px 12px', borderRadius: 9,
                            background: '#EFF6FF', color: '#1D4ED8',
                            border: '1px solid #BFDBFE', cursor: 'pointer',
                            fontSize: 12.5, fontWeight: 700
                          }}
                        >
                          <FileText size={13} /> ดูข้อมูล & ตรวจเอกสาร
                          {shop.verification_docs?.length > 0 && (
                            <span style={{ background: '#2563EB', color: '#fff', borderRadius: 999, padding: '0 5px', fontSize: 10 }}>
                              {shop.verification_docs.length}
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveChatShop(shop)
                              setChatUnreadMap(prev => ({ ...prev, [shop.id]: 0 }))
                            }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '6px 10px', borderRadius: 9,
                              background: chatUnreadMap[shop.id] > 0 ? '#EFF6FF' : '#F1F5F9',
                              color: '#315EC3', border: '1px solid #DDE3F5',
                              cursor: 'pointer', fontSize: 12, fontWeight: 700
                            }}
                          >
                            <MessageCircle size={13} />
                            <span>แชท</span>
                            {chatUnreadMap[shop.id] > 0 && (
                              <span style={{ background: '#EF4444', color: '#fff', borderRadius: 999, padding: '0 5px', fontSize: 10 }}>
                                {chatUnreadMap[shop.id]}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setCredModal(shop)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '6px 10px', borderRadius: 9,
                              background: '#F8FAFC', color: '#475569',
                              border: '1px solid #E2E8F0', cursor: 'pointer',
                              fontSize: 12, fontWeight: 600
                            }}
                            title="ตั้งรหัสผ่านแอดมินสาขา"
                          >
                            <Key size={13} />
                          </button>

                          <Link
                            href={`/${shop.slug}`}
                            target="_blank"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '6px 10px', borderRadius: 9,
                              background: '#F8FAFC', color: '#475569',
                              border: '1px solid #E2E8F0', textDecoration: 'none',
                              fontSize: 12, fontWeight: 600
                            }}
                          >
                            หน้าร้าน <ExternalLink size={11} />
                          </Link>

                          <button
                            type="button"
                            onClick={() => toggleActive(shop)}
                            disabled={actionLoading === shop.id}
                            style={{
                              padding: '6px 10px', borderRadius: 9,
                              background: shop.is_active ? '#FEE2E2' : '#DCFCE7',
                              color: shop.is_active ? '#B91C1C' : '#15803D',
                              border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700
                            }}
                          >
                            {shop.is_active ? 'ระงับ' : 'เปิด'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shop Profile & KYC Verification Drawer */}
      {selectedShop && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', justifyContent: 'flex-end', zIndex: 9999
        }}>
          <div style={{
            width: '100%', maxWidth: 640, background: '#fff', height: '100%',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex',
            flexDirection: 'column', overflow: 'hidden'
          }}>
            {/* Drawer Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
                    {selectedShop.name}
                  </h2>
                  <span style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    background: selectedShop.is_verified ? '#DCFCE7' : '#FEF3C7',
                    color: selectedShop.is_verified ? '#15803D' : '#B45309',
                    display: 'inline-flex', alignItems: 'center', gap: 5
                  }}>
                    {selectedShop.is_verified ? <ShieldCheck size={13} /> : <Clock size={13} />}
                    {selectedShop.is_verified ? 'Verified Partner' : 'รอตรวจสอบ KYC'}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 13 }}>
                  URL ร้านค้า: <strong>foami.app/{selectedShop.slug}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShop(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Drawer Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', padding: '0 24px', background: '#F8FAFC' }}>
              <button
                type="button"
                onClick={() => setDrawerTab('profile')}
                style={{
                  padding: '12px 18px', border: 'none', background: 'none',
                  fontSize: 13.5, fontWeight: drawerTab === 'profile' ? 700 : 500,
                  color: drawerTab === 'profile' ? '#2563EB' : '#64748B',
                  borderBottom: drawerTab === 'profile' ? '2.5px solid #2563EB' : '2.5px solid transparent',
                  cursor: 'pointer'
                }}
              >
                ข้อมูลติดต่อ & สัญญา
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('docs')}
                style={{
                  padding: '12px 18px', border: 'none', background: 'none',
                  fontSize: 13.5, fontWeight: drawerTab === 'docs' ? 700 : 500,
                  color: drawerTab === 'docs' ? '#2563EB' : '#64748B',
                  borderBottom: drawerTab === 'docs' ? '2.5px solid #2563EB' : '2.5px solid transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                เอกสารยืนยัน KYC ({selectedShop.verification_docs?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('plan')}
                style={{
                  padding: '12px 18px', border: 'none', background: 'none',
                  fontSize: 13.5, fontWeight: drawerTab === 'plan' ? 700 : 500,
                  color: drawerTab === 'plan' ? '#2563EB' : '#64748B',
                  borderBottom: drawerTab === 'plan' ? '2.5px solid #2563EB' : '2.5px solid transparent',
                  cursor: 'pointer'
                }}
              >
                แพ็กเกจ & รูปแบบคิดเงิน
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              {/* TAB 1: Profile & Contact */}
              {drawerTab === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Verified Badge Toggle Box */}
                  <div style={{
                    padding: '16px 20px', borderRadius: 12,
                    background: selectedShop.is_verified ? '#F0FDF4' : '#FFFBEB',
                    border: selectedShop.is_verified ? '1px solid #BBF7D0' : '1px solid #FDE68A',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16
                  }}>
                    <div>
                      <div style={{ fontWeight: 800, color: selectedShop.is_verified ? '#166534' : '#92400E', fontSize: 14 }}>
                        สถานะเครื่องหมาย Verified Partner ✓
                      </div>
                      <div style={{ fontSize: 12.5, color: selectedShop.is_verified ? '#15803D' : '#B45309', marginTop: 2 }}>
                        {selectedShop.is_verified
                          ? 'ร้านค้านี้ได้รับป้ายร้านค้าปลอดภัยและจะแสดงสัญลักษณ์ ShieldCheck ให้ลูกค้าเห็น'
                          : 'ร้านนี้ยังไม่ได้รับการอนุมัติ ลูกค้าจะยังไม่เห็นป้ายความปลอดภัย'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleVerified(selectedShop)}
                      style={{
                        padding: '8px 16px', borderRadius: 10,
                        background: selectedShop.is_verified ? '#EF4444' : '#16A34A',
                        color: '#fff', border: 'none', cursor: 'pointer',
                        fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap'
                      }}
                    >
                      {selectedShop.is_verified ? 'ยกเลิกสถานะ Verified' : 'อนุมัติ Verified Partner ✓'}
                    </button>
                  </div>

                  {/* Contact Details Card */}
                  <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 18, border: '1px solid #E2E8F0' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: '#1E293B' }}>
                      ข้อมูลติดต่อผู้ประกอบการ
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>ชื่อเจ้าของ / ผู้ติดต่อ</div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                          {selectedShop.owner_name || selectedShop.name}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>เบอร์โทรศัพท์</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <a
                            href={selectedShop.phone ? `tel:${selectedShop.phone}` : '#'}
                            style={{ fontSize: 13.5, fontWeight: 700, color: '#2563EB', textDecoration: 'none' }}
                          >
                            {selectedShop.phone || 'ยังไม่ระบุ'}
                          </a>
                          {selectedShop.phone && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(selectedShop.phone || '', 'phone')}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 2 }}
                              title="คัดลอกเบอร์"
                            >
                              {copiedField === 'phone' ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>อีเมล</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <a
                            href={selectedShop.owner_email && selectedShop.owner_email !== '-' ? `mailto:${selectedShop.owner_email}` : '#'}
                            style={{ fontSize: 13, fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}
                          >
                            {selectedShop.owner_email || 'ยังไม่ระบุ'}
                          </a>
                          {selectedShop.owner_email && selectedShop.owner_email !== '-' && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(selectedShop.owner_email, 'email')}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 2 }}
                            >
                              {copiedField === 'email' ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>พิกัดที่ตั้ง (Lat, Lng)</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>
                          {selectedShop.lat?.toFixed(4)}, {selectedShop.lng?.toFixed(4)}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 12, color: '#64748B' }}>ที่อยู่หน้าร้าน</div>
                      <div style={{ fontSize: 13, color: '#0F172A', marginTop: 2 }}>
                        {selectedShop.address || 'ไม่ระบุที่อยู่'}
                      </div>
                      <a
                        href={`https://www.google.com/maps?q=${selectedShop.lat},${selectedShop.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 12, color: '#2563EB', marginTop: 6, textDecoration: 'none', fontWeight: 600
                        }}
                      >
                        <MapPin size={13} /> ดูบน Google Maps <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  {/* Contract Card */}
                  <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 18, border: '1px solid #E2E8F0' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: '#1E293B' }}>
                      สัญญาพาร์ทเนอร์
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>ระยะเวลาสัญญา</div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                          {selectedShop.contract?.months ? `${selectedShop.contract.months} เดือน` : '12 เดือน (เริ่มต้น)'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>สิ้นสุดสัญญา</div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                          {selectedShop.contract?.end_date
                            ? new Date(selectedShop.contract.end_date).toLocaleDateString('th-TH')
                            : 'ไม่ระบุ'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Documents (KYC) */}
              {drawerTab === 'docs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Upload Box */}
                  <div style={{
                    padding: 18, borderRadius: 12, background: '#F8FAFC',
                    border: '1.5px dashed #CBD5E1', display: 'flex', flexDirection: 'column', gap: 12
                  }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Upload size={16} color="#2563EB" /> เพิ่มเอกสารยืนยันร้านค้า
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 4 }}>ประเภทเอกสาร</label>
                        <select
                          value={docUploadType}
                          onChange={e => setDocUploadType(e.target.value)}
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                        >
                          <option value="id_card">สำเนาบัตรประชาชน</option>
                          <option value="business_reg">ทะเบียนพาณิชย์ / นิติบุคคล</option>
                          <option value="storefront">รูปถ่ายหน้าร้าน / อุปกรณ์</option>
                          <option value="contract">สัญญาพาร์ทเนอร์ลงนาม</option>
                          <option value="other">เอกสารอื่นๆ</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 4 }}>ชื่อ / หมายเหตุเอกสาร</label>
                        <input
                          type="text"
                          placeholder="เช่น สำเนาบัตรเจ้าของร้าน"
                          value={docUploadName}
                          onChange={e => setDocUploadName(e.target.value)}
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '8px 16px', borderRadius: 8, background: '#315EC3',
                        color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                      }}>
                        <Upload size={14} /> เลือกไฟล์เอกสาร (รูปภาพหรือ PDF)
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleFileUpload}
                          disabled={uploadingDoc}
                          style={{ display: 'none' }}
                        />
                      </label>
                      {uploadingDoc && <span style={{ marginLeft: 10, fontSize: 12, color: '#2563EB' }}>กำลังอัปโหลด...</span>}
                    </div>
                  </div>

                  {/* Documents List */}
                  <div>
                    <h4 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 800, color: '#334155' }}>
                      เอกสารที่บันทึกไว้ ({selectedShop.verification_docs?.length || 0})
                    </h4>

                    {(!selectedShop.verification_docs || selectedShop.verification_docs.length === 0) ? (
                      <div style={{
                        padding: 36, textAlign: 'center', background: '#F8FAFC',
                        borderRadius: 12, border: '1px solid #E2E8F0', color: '#64748B', fontSize: 13
                      }}>
                        ยังไม่มีเอกสารยืนยันสำหรับร้านนี้
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {selectedShop.verification_docs.map(doc => (
                          <div
                            key={doc.id}
                            style={{
                              padding: '12px 16px', borderRadius: 10, border: '1px solid #E2E8F0',
                              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 8, background: '#EFF6FF',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB'
                              }}>
                                <FileText size={18} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A' }}>
                                  {doc.name}
                                </div>
                                <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2, display: 'flex', gap: 8 }}>
                                  <span>{getDocTypeLabel(doc.type)}</span>
                                  <span>•</span>
                                  <span>{new Date(doc.uploaded_at).toLocaleDateString('th-TH')}</span>
                                  {doc.size_kb && <span>• {doc.size_kb} KB</span>}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(doc)}
                                style={{
                                  padding: '5px 10px', borderRadius: 8, background: '#EFF6FF',
                                  color: '#2563EB', border: '1px solid #BFDBFE',
                                  fontSize: 12, fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                ดูเอกสาร
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDoc(doc.id)}
                                style={{
                                  padding: '5px 8px', borderRadius: 8, background: '#FEE2E2',
                                  color: '#B91C1C', border: 'none', cursor: 'pointer'
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Plan & Monetization */}
              {drawerTab === 'plan' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Tier Choice */}
                  <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 18, border: '1px solid #E2E8F0' }}>
                    <label style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: 10 }}>
                      ระดับแพ็กเกจ (Plan Tier)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div
                        onClick={() => setDrawerPlanTier('starter')}
                        style={{
                          padding: 14, borderRadius: 10, cursor: 'pointer',
                          border: drawerPlanTier === 'starter' ? '2px solid #315EC3' : '1px solid #CBD5E1',
                          background: drawerPlanTier === 'starter' ? '#EFF6FF' : '#fff'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Starter</div>
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                          • พนักงานไม่เกิน 3 คน<br />
                          • รัศมีไม่เกิน 10 กม. (2 โซน)<br />
                          • ใช้งานฟรีทุกฟีเจอร์
                        </div>
                      </div>

                      <div
                        onClick={() => setDrawerPlanTier('pro')}
                        style={{
                          padding: 14, borderRadius: 10, cursor: 'pointer',
                          border: drawerPlanTier === 'pro' ? '2px solid #7C3AED' : '1px solid #CBD5E1',
                          background: drawerPlanTier === 'pro' ? '#F5F3FF' : '#fff'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Pro</div>
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                          • พนักงานไม่จำกัด<br />
                          • รัศมีบริการสูงสุด 25 กม.<br />
                          • ไม่จำกัดจำนวนโซน
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Monetization Model Choice */}
                  <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 18, border: '1px solid #E2E8F0' }}>
                    <label style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: 10 }}>
                      รูปแบบการคิดค่าบริการ (Monetization Model)
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12,
                        borderRadius: 10, border: '1px solid #CBD5E1', background: '#fff', cursor: 'pointer'
                      }}>
                        <input
                          type="radio"
                          name="monetization"
                          checked={drawerMonetization === 'commission'}
                          onChange={() => { setDrawerMonetization('commission'); setDrawerFeePct(15) }}
                          style={{ marginTop: 3 }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A' }}>
                            หักคอมมิชชั่นตามออเดอร์ (GP %)
                          </div>
                          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                            ไม่มีค่าบริการรายเดือน คิดเฉพาะเปอร์เซ็นต์ส่วนแบ่งตามงานที่สำเร็จ (เช่น 15-20%)
                          </div>
                        </div>
                      </label>

                      <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12,
                        borderRadius: 10, border: '1px solid #CBD5E1', background: '#fff', cursor: 'pointer'
                      }}>
                        <input
                          type="radio"
                          name="monetization"
                          checked={drawerMonetization === 'subscription'}
                          onChange={() => { setDrawerMonetization('subscription'); setDrawerFeePct(0) }}
                          style={{ marginTop: 3 }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A' }}>
                            เหมาจ่ายรายเดือน (Subscription / 0% - 5% GP)
                          </div>
                          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                            จ่ายเหมาเป็นรายเดือน เพื่อลดค่าคอมมิชชั่น GP เหลือ 0% หรือ 5%
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Fee % input */}
                    <div style={{ marginTop: 14 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                        อัตราค่าบริการ Platform Fee (GP %)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={drawerFeePct}
                          onChange={e => setDrawerFeePct(parseInt(e.target.value) || 0)}
                          style={{ width: 100, padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 700 }}>%</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={saveDrawerPlanSettings}
                    disabled={savingPlan}
                    style={{
                      padding: '12px 20px', borderRadius: 10, background: '#315EC3',
                      color: '#fff', border: 'none', cursor: 'pointer',
                      fontWeight: 800, fontSize: 14
                    }}
                  >
                    {savingPlan ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าแพ็กเกจ & ค่าคอมมิชชั่น'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, width: '100%', maxWidth: 800,
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>
                {previewDoc.name} ({getDocTypeLabel(previewDoc.type)})
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 20, textAlign: 'center' }}>
              {previewDoc.data_url.startsWith('data:image/') ? (
                <img
                  src={previewDoc.data_url}
                  alt={previewDoc.name}
                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }}
                />
              ) : (
                <iframe
                  src={previewDoc.data_url}
                  title={previewDoc.name}
                  style={{ width: '100%', height: '70vh', border: 'none' }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Credential Modal */}
      {credModal && (
        <AdminCredentialsModal
          shop={credModal}
          onClose={() => setCredModal(null)}
        />
      )}

      {/* Chat Modal */}
      {activeChatShop && (
        <PlatformShopChatModal
          branchId={activeChatShop.id}
          branchName={activeChatShop.name}
          branchSlug={activeChatShop.slug}
          currentUserRole="platform_admin"
          currentUserName="Platform HQ (Super Admin)"
          onClose={() => {
            setActiveChatShop(null)
            loadChatUnread()
          }}
        />
      )}
    </div>
  )
}

function AdminCredentialsModal({ shop, onClose }: { shop: Shop; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEmail(`admin@${shop.slug}.foami.local`)
  }, [shop.slug])

  const handleSave = async () => {
    if (!email || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน')
      return
    }
    if (password.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/platform/shops/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ shop_id: shop.id, email, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')
      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 20
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440,
        padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
            ตั้งรหัสผ่านแอดมินสาขา
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748B' }}>
          กำหนดบัญชีเข้าใช้งานแอดมินสำหรับร้าน <strong>{shop.name}</strong>
        </p>

        {error && (
          <div style={{ padding: 10, borderRadius: 8, background: '#FEE2E2', color: '#B91C1C', fontSize: 12.5, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {success ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <CheckCircle2 size={40} color="#16A34A" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 800, color: '#166534', fontSize: 15 }}>ตั้งรหัสผ่านสำเร็จ</div>
            <p style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
              เจ้าของร้านสามารถใช้บัญชีนี้เข้าสู่ระบบแอดมินสาขาได้ทันที
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                marginTop: 14, padding: '8px 20px', borderRadius: 8,
                background: '#315EC3', color: '#fff', border: 'none',
                fontWeight: 700, cursor: 'pointer'
              }}
            >
              ปิดหน้าต่าง
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                อีเมลเข้าใช้งาน
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13.5 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                รหัสผ่านใหม่
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  style={{ width: '100%', padding: '8px 36px 8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13.5 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              style={{
                marginTop: 6, padding: '10px', borderRadius: 8,
                background: '#315EC3', color: '#fff', border: 'none',
                fontWeight: 800, fontSize: 13.5, cursor: 'pointer'
              }}
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่าน'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
