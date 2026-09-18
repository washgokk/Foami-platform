'use client'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Ticket, Mail, Lock, User, Eye, EyeOff,
  CheckCircle2, ChevronRight, Droplets, AlertTriangle,
  Store, MapPin, Compass, Palette, Sparkles, ArrowLeft,
  Calendar, Shield, Phone, ExternalLink
} from 'lucide-react'

interface InvitationDetails {
  id: string
  code: string
  email: string | null
  shop_name: string | null
  base_plan: string
  contract_months: number
  expires_at: string
}

const COLOR_OPTIONS = [
  { label: 'Foami Blue', hex: '#315EC3' },
  { label: 'Royal Indigo', hex: '#4F46E5' },
  { label: 'Emerald Green', hex: '#059669' },
  { label: 'Crimson Red', hex: '#DC2626' },
  { label: 'Amber Gold', hex: '#D97706' },
  { label: 'Midnight Slate', hex: '#1E293B' },
]

function RegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [code, setCode] = useState('')
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [locating, setLocating] = useState(false)

  // Form State
  const [form, setForm] = useState({
    // Account
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    // Shop
    shopName: '',
    slug: '',
    address: '',
    lat: 16.4722,
    lng: 102.8265,
    // Branding & Options
    themeColor: '#315EC3',
    enableStarterServices: true,
  })

  // Success result
  const [registeredShop, setRegisteredShop] = useState<{
    shop_name: string
    slug: string
    token: string
    email: string
  } | null>(null)

  // Check code from URL query parameter on mount
  useEffect(() => {
    const queryCode = searchParams.get('code')
    if (queryCode) {
      const clean = queryCode.toUpperCase().trim()
      setCode(clean)
      handleValidateCode(clean)
    }
  }, [searchParams])

  // Auto generate slug from shop name
  const handleShopNameChange = (val: string) => {
    setForm(prev => {
      const autoSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      return {
        ...prev,
        shopName: val,
        slug: prev.slug === '' || prev.slug === autoSlug.slice(0, -1) ? autoSlug : prev.slug
      }
    })
  }

  const handleValidateCode = async (targetCode?: string) => {
    const c = (targetCode || code).toUpperCase().trim()
    if (!c) {
      setError('กรุณากรอก Invitation Code')
      return
    }
    setValidating(true)
    setError('')
    try {
      const res = await fetch(`/api/platform/invitations?code=${encodeURIComponent(c)}`)
      const data = await res.json()
      if (!res.ok || !data.valid) {
        setError(data.error || 'Invitation Code ไม่ถูกต้อง หมดอายุ หรือถูกใช้ไปแล้ว')
        setInvitation(null)
      } else {
        setInvitation(data.invitation)
        if (data.invitation.email) {
          setForm(prev => ({ ...prev, email: data.invitation.email }))
        }
        if (data.invitation.shop_name) {
          setForm(prev => ({ ...prev, shopName: data.invitation.shop_name }))
        }
        setStep(2)
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setValidating(false)
    }
  }

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('เบราว์เซอร์ไม่รองรับการระบุพิกัดอัตโนมัติ')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(prev => ({
          ...prev,
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6))
        }))
        setLocating(false)
      },
      err => {
        console.warn('Geolocation error:', err)
        alert('ไม่สามารถดึงพิกัดปัจจุบันได้ กรุณาใส่พิกัดหรือใช้ค่าเริ่มต้น')
        setLocating(false)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (form.password !== form.confirmPassword) {
      setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน')
      return
    }
    if (form.password.length < 8) {
      setError('รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร')
      return
    }
    if (!form.shopName.trim()) {
      setError('กรุณากรอกชื่อร้านค้า')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/platform/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.toUpperCase().trim(),
          email: form.email.trim(),
          password: form.password,
          full_name: form.fullName.trim(),
          phone: form.phone.trim(),
          shop_name: form.shopName.trim(),
          slug: form.slug.trim(),
          address: form.address.trim(),
          lat: form.lat,
          lng: form.lng,
          theme_color: form.themeColor,
          enable_starter_services: form.enableStarterServices
        })
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาดในการสร้างร้านค้า')
      } else {
        setRegisteredShop({
          shop_name: data.shop_name,
          slug: data.slug,
          token: data.token,
          email: form.email
        })
        // Save admin token for instant login
        if (data.token) {
          localStorage.setItem('admin_token', data.token)
        }
        setStep(5)
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  const STEPS_NAV = [
    { n: 1, label: 'โค้ดเชิญ' },
    { n: 2, label: 'บัญชีร้าน' },
    { n: 3, label: 'ข้อมูลร้าน & พิกัด' },
    { n: 4, label: 'อัตลักษณ์ & บริการ' },
  ]

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      fontFamily: 'Kanit, sans-serif',
      background: '#F8FAFC'
    }}>
      {/* Left Brand Showcase */}
      <div style={{
        width: 420,
        background: 'linear-gradient(155deg, #0F1E4A 0%, #1A367C 45%, #2B57B8 100%)',
        padding: '48px 40px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0
      }}>
        <div style={{ position: 'absolute', top: -70, right: -70, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: -50, left: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

        <div style={{ position: 'relative', flex: 1 }}>
          {/* Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 44 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Droplets size={20} color="#93C5FD" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', letterSpacing: '.02em' }}>Foami Partner</div>
              <div style={{ fontSize: 11, color: '#93C5FD', fontWeight: 600 }}>Partner Onboarding Portal</div>
            </div>
          </div>

          <h2 style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.25, margin: '0 0 12px' }}>
            เปิดร้านค้าพาร์ทเนอร์<br />พร้อมระบบจัดการครบวงจร
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginBottom: 32 }}>
            ใช้ Invitation Code จากทีมงาน Foami เพื่อปลดล็อกร้านค้าใหม่ พร้อมระบบจองคิวออนไลน์ แผนที่ และบริการพรีเมียม
          </p>

          {/* Value props */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              'ระบบจองคิวและรับงานล้างรถอัจฉริยะ',
              'หน้าร้านค้าออนไลน์ส่วนตัว (foami.app/[slug])',
              'ปักหมุดพิกัดร้านบนแผนที่ให้ลูกค้าค้นพบได้ทันที',
              'รายงานรายได้ กระเป๋าเงิน และสถิติงานบริการ',
              'ระบบรองรับบริการ พ.ร.บ. & ประกันภัยรถยนต์',
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle2 size={13} color="#86EFAC" />
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Active invitation banner */}
          {invitation && (
            <div style={{
              marginTop: 36,
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 16,
              padding: '16px 18px'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                โค้ดเชิญที่กำลังเปิดใช้
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF', fontFamily: 'monospace' }}>
                {invitation.code}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={13} color="#86EFAC" />
                <span>แพ็กเกจ {invitation.base_plan?.toUpperCase()} · สัญญา {invitation.contract_months} เดือน</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
          © 2026 Foami Wash & Delivery · Partner Network
        </div>
      </div>

      {/* Right Form Area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '36px 24px' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>

          {/* Stepper (Steps 1-4) */}
          {step < 5 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
              {STEPS_NAV.map((s, idx) => {
                const isCurrent = step === s.n
                const isPassed = step > s.n
                return (
                  <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 8, fontSize: 11, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isPassed ? '#22C55E' : isCurrent ? '#315EC3' : '#E2E8F0',
                      color: isPassed || isCurrent ? '#FFFFFF' : '#64748B',
                      transition: 'all .2s'
                    }}>
                      {isPassed ? <CheckCircle2 size={13} /> : s.n}
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: isCurrent ? 700 : 500,
                      color: isCurrent ? '#1E293B' : '#64748B'
                    }}>
                      {s.label}
                    </span>
                    {idx < STEPS_NAV.length - 1 && <ChevronRight size={13} color="#CBD5E1" />}
                  </div>
                )
              })}
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, background: '#FEE2E2', border: '1px solid #FECACA', marginBottom: 18 }}>
              <AlertTriangle size={16} color="#B91C1C" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#B91C1C', fontWeight: 600 }}>{error}</span>
            </div>
          )}

          {/* STEP 1: VERIFY CODE */}
          {step === 1 && (
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1E293B', margin: '0 0 6px' }}>
                ใส่ Invitation Code ของคุณ
              </h1>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>
                รับ Invitation Code ได้จากทีมงาน Foami หรือตัวแทน เพื่อเริ่มต้นเปิดร้านค้า
              </p>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Invitation Code (รหัสเชิญ)
                </label>
                <div style={{ position: 'relative' }}>
                  <Ticket size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="FOAMI-XXXXXX"
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleValidateCode()}
                    style={{
                      width: '100%', padding: '13px 14px 13px 44px',
                      border: '2px solid #CBD5E1', borderRadius: 14, fontSize: 16,
                      fontFamily: 'monospace', outline: 'none', color: '#1E293B', letterSpacing: '.08em',
                      boxSizing: 'border-box', fontWeight: 700, textTransform: 'uppercase'
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleValidateCode()}
                disabled={!code || validating}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 14, fontSize: 14, fontWeight: 700,
                  background: code ? 'linear-gradient(135deg,#214192,#315EC3)' : '#CBD5E1',
                  color: '#FFFFFF', border: 'none', cursor: code && !validating ? 'pointer' : 'not-allowed',
                  fontFamily: 'Kanit, sans-serif', transition: 'all .2s'
                }}
              >
                {validating ? 'กำลังตรวจสอบโค้ด...' : 'ยืนยันโค้ดเชิญ →'}
              </button>

              <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#64748B' }}>
                มีบัญชีร้านค้าอยู่แล้ว?{' '}
                <Link href="/admin/login" style={{ color: '#315EC3', fontWeight: 700, textDecoration: 'none' }}>
                  เข้าสู่ระบบหลังบ้าน
                </Link>
              </p>
            </div>
          )}

          {/* STEP 2: SHOP ADMIN ACCOUNT */}
          {step === 2 && (
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1E293B', margin: '0 0 6px' }}>
                สร้างบัญชีผู้ดูแลร้าน
              </h1>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
                ใช้อีเมลและรหัสผ่านนี้เพื่อล็อกอินจัดการระบบหลังบ้านของร้านคุณ
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    อีเมลล็อกอิน (Admin Email) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                    <input
                      type="email"
                      required
                      placeholder="owner@mycarcare.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      style={{
                        width: '100%', padding: '12px 14px 12px 42px', border: '1.5px solid #CBD5E1',
                        borderRadius: 12, fontSize: 14, fontFamily: 'Kanit, sans-serif', outline: 'none',
                        color: '#1E293B', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      ชื่อผู้ดูแลร้าน *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                      <input
                        type="text"
                        placeholder="ชื่อ-นามสกุล"
                        value={form.fullName}
                        onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                        style={{
                          width: '100%', padding: '12px 12px 12px 38px', border: '1.5px solid #CBD5E1',
                          borderRadius: 12, fontSize: 14, fontFamily: 'Kanit, sans-serif', outline: 'none',
                          color: '#1E293B', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      เบอร์โทรศัพท์ติดต่อ *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Phone size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                      <input
                        type="tel"
                        placeholder="08X-XXX-XXXX"
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        style={{
                          width: '100%', padding: '12px 12px 12px 38px', border: '1.5px solid #CBD5E1',
                          borderRadius: 12, fontSize: 14, fontFamily: 'Kanit, sans-serif', outline: 'none',
                          color: '#1E293B', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    รหัสผ่าน (อย่างน้อย 8 ตัวอักษร) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      placeholder="ตั้งรหัสผ่านสำหรับล็อกอิน"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      style={{
                        width: '100%', padding: '12px 42px 12px 42px', border: '1.5px solid #CBD5E1',
                        borderRadius: 12, fontSize: 14, fontFamily: 'Kanit, sans-serif', outline: 'none',
                        color: '#1E293B', boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    ยืนยันรหัสผ่าน *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      placeholder="กรอกรหัสผ่านอีกครั้ง"
                      value={form.confirmPassword}
                      onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      style={{
                        width: '100%', padding: '12px 14px 12px 42px', border: '1.5px solid #CBD5E1',
                        borderRadius: 12, fontSize: 14, fontFamily: 'Kanit, sans-serif', outline: 'none',
                        color: '#1E293B', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{
                      padding: '12px 18px', borderRadius: 12, background: '#F1F5F9',
                      color: '#475569', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      fontFamily: 'Kanit, sans-serif', display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <ArrowLeft size={14} /> ย้อนกลับ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!form.email || !form.password) {
                        setError('กรุณากรอกอีเมลและรหัสผ่าน')
                        return
                      }
                      if (form.password !== form.confirmPassword) {
                        setError('รหัสผ่านไม่ตรงกัน')
                        return
                      }
                      if (form.password.length < 8) {
                        setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
                        return
                      }
                      setError('')
                      setStep(3)
                    }}
                    style={{
                      flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 700,
                      background: 'linear-gradient(135deg,#214192,#315EC3)', color: '#FFFFFF',
                      border: 'none', cursor: 'pointer', fontFamily: 'Kanit, sans-serif'
                    }}
                  >
                    ถัดไป: ข้อมูลร้านค้า & พิกัด →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SHOP PROFILE & LOCATION */}
          {step === 3 && (
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1E293B', margin: '0 0 6px' }}>
                ข้อมูลร้านค้า & พิกัดแผนที่
              </h1>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
                ข้อมูลนี้จะแสดงให้ลูกค้าเห็นเมื่อค้นหาร้านและคลิกเข้ามาจองบริการ
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    ชื่อร้านค้า (Shop Name) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Store size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                    <input
                      type="text"
                      required
                      placeholder="เช่น เอกชัย คาร์แคร์ ขอนแก่น"
                      value={form.shopName}
                      onChange={e => handleShopNameChange(e.target.value)}
                      style={{
                        width: '100%', padding: '12px 14px 12px 42px', border: '1.5px solid #CBD5E1',
                        borderRadius: 12, fontSize: 14, fontFamily: 'Kanit, sans-serif', outline: 'none',
                        color: '#1E293B', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    URL หน้าร้าน (Slug)
                  </label>
                  <div style={{
                    display: 'flex', alignItems: 'center', background: '#F8FAFC',
                    border: '1.5px solid #CBD5E1', borderRadius: 12, overflow: 'hidden'
                  }}>
                    <span style={{ padding: '0 12px', fontSize: 13, color: '#64748B', background: '#E2E8F0', height: 44, display: 'flex', alignItems: 'center', borderRight: '1px solid #CBD5E1' }}>
                      foami.app/
                    </span>
                    <input
                      type="text"
                      placeholder="ekkachai-carcare"
                      value={form.slug}
                      onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                      style={{
                        flex: 1, padding: '12px 14px', border: 'none', fontSize: 14,
                        fontFamily: 'monospace', outline: 'none', color: '#1E293B', background: 'transparent'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    ที่อยู่หน้าร้าน (Address)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={16} style={{ position: 'absolute', left: 14, top: 14, color: '#94A3B8' }} />
                    <textarea
                      rows={2}
                      placeholder="เลขที่ ถนน ตำบล อำเภอ จังหวัด"
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      style={{
                        width: '100%', padding: '12px 14px 12px 42px', border: '1.5px solid #CBD5E1',
                        borderRadius: 12, fontSize: 14, fontFamily: 'Kanit, sans-serif', outline: 'none',
                        color: '#1E293B', boxSizing: 'border-box', resize: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* GPS Location helpers */}
                <div style={{ background: '#F1F5F9', borderRadius: 14, padding: '14px 16px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Compass size={14} color="#315EC3" />
                      พิกัดร้านค้าบนแผนที่ (GPS Lat / Lng)
                    </div>
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={locating}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                        borderRadius: 8, background: '#315EC3', color: '#FFFFFF', border: 'none',
                        cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'Kanit, sans-serif'
                      }}
                    >
                      <MapPin size={12} />
                      {locating ? 'กำลังดึงพิกัด...' : 'ใช้พิกัดปัจจุบัน'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Latitude</span>
                      <input
                        type="number"
                        step="0.000001"
                        value={form.lat}
                        onChange={e => setForm(f => ({ ...f, lat: parseFloat(e.target.value) || 0 }))}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1',
                          fontSize: 13, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Longitude</span>
                      <input
                        type="number"
                        step="0.000001"
                        value={form.lng}
                        onChange={e => setForm(f => ({ ...f, lng: parseFloat(e.target.value) || 0 }))}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1',
                          fontSize: 13, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    style={{
                      padding: '12px 18px', borderRadius: 12, background: '#F1F5F9',
                      color: '#475569', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      fontFamily: 'Kanit, sans-serif', display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <ArrowLeft size={14} /> ย้อนกลับ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!form.shopName.trim()) {
                        setError('กรุณากรอกชื่อร้านค้า')
                        return
                      }
                      setError('')
                      setStep(4)
                    }}
                    style={{
                      flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 700,
                      background: 'linear-gradient(135deg,#214192,#315EC3)', color: '#FFFFFF',
                      border: 'none', cursor: 'pointer', fontFamily: 'Kanit, sans-serif'
                    }}
                  >
                    ถัดไป: อัตลักษณ์ & บริการเริ่มต้น →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: BRANDING & STARTER SERVICES */}
          {step === 4 && (
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1E293B', margin: '0 0 6px' }}>
                อัตลักษณ์ & บริการเริ่มต้น
              </h1>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
                เลือกโทนสีประจำร้าน และเปิดใช้งานบริการเริ่มต้นทันทีเพื่อให้พร้อมรับงาน
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Theme Color Selection */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    เลือกโทนสีร้านค้า (Theme Color)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {COLOR_OPTIONS.map(c => {
                      const isSelected = form.themeColor === c.hex
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, themeColor: c.hex }))}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                            borderRadius: 12, border: isSelected ? `2px solid ${c.hex}` : '1.5px solid #E2E8F0',
                            background: isSelected ? '#F8FAFC' : '#FFFFFF', cursor: 'pointer',
                            transition: 'all .2s'
                          }}
                        >
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: c.hex, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, color: '#1E293B' }}>{c.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Starter Services checklist */}
                <div style={{
                  background: '#FFFFFF', border: '1.5px solid #E2E8F0',
                  borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={15} color="#D97706" />
                      เปิดใช้งานแพ็กเกจบริการตั้งต้นอัตโนมัติ
                    </div>
                    <input
                      type="checkbox"
                      checked={form.enableStarterServices}
                      onChange={e => setForm(f => ({ ...f, enableStarterServices: e.target.checked }))}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </div>

                  <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5, margin: 0 }}>
                    ระบบจะเปิดแพ็กเกจพื้นฐาน (ล้างสีธรรมดา, ล้างเคลือบเงา, ล้างรถดีเทลลิ่ง) ให้อัตโนมัติ เพื่อให้หน้าร้านพร้อมเปิดรับจองได้ทันที และสามารถแก้ไขราคาหรือเพิ่มแพ็กเกจใหม่เองได้ตลอดเวลา
                  </p>
                </div>

                {/* Summary Card */}
                <div style={{
                  background: '#EFF6FF', border: '1px solid #BFDBFE',
                  borderRadius: 14, padding: '16px 18px'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                    สรุปข้อมูลร้านค้า
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#1E293B' }}>
                    <div><strong>ชื่อร้าน:</strong> {form.shopName}</div>
                    <div><strong>URL:</strong> foami.app/{form.slug}</div>
                    <div><strong>อีเมล:</strong> {form.email}</div>
                    <div><strong>สัญญา:</strong> {invitation?.contract_months || 12} เดือน</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    style={{
                      padding: '12px 18px', borderRadius: 12, background: '#F1F5F9',
                      color: '#475569', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      fontFamily: 'Kanit, sans-serif', display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <ArrowLeft size={14} /> ย้อนกลับ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      flex: 1, padding: '14px 0', borderRadius: 12, fontSize: 14, fontWeight: 700,
                      background: 'linear-gradient(135deg,#059669,#10B981)', color: '#FFFFFF',
                      border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                      fontFamily: 'Kanit, sans-serif', boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                      opacity: submitting ? 0.7 : 1
                    }}
                  >
                    {submitting ? 'กำลังสร้างร้านค้า...' : 'ยืนยัน & เปิดร้านค้าทันที'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 5: SUCCESS / ACTIVATION COMPLETE */}
          {step === 5 && registeredShop && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 24, background: '#DCFCE7',
                color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', boxShadow: '0 10px 25px rgba(34,197,94,0.2)'
              }}>
                <CheckCircle2 size={38} />
              </div>

              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1E293B', margin: '0 0 8px' }}>
                เปิดร้านค้าพาร์ทเนอร์สำเร็จ!
              </h1>
              <p style={{ fontSize: 14, color: '#64748B', maxWidth: 420, margin: '0 auto 24px', lineHeight: 1.6 }}>
                ยินดีต้อนรับสู่เครือข่ายพาร์ทเนอร์ Foami ร้านของคุณได้รับการตั้งค่าและพร้อมรับงานบริการแล้ว
              </p>

              {/* Shop info box */}
              <div style={{
                background: '#FFFFFF', border: '1.5px solid #E2E8F0',
                borderRadius: 16, padding: '20px 24px', textAlign: 'left',
                marginBottom: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #F1F5F9' }}>
                  <Store size={18} color="#315EC3" />
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#1E293B' }}>{registeredShop.shop_name}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>อีเมลสำหรับเข้าใช้งาน:</span>
                    <strong style={{ color: '#1E293B' }}>{registeredShop.email}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>ลิงก์หน้าร้านของคุณ:</span>
                    <strong style={{ color: '#315EC3', fontFamily: 'monospace' }}>foami.app/{registeredShop.slug}</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push('/admin/dashboard')}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 14, fontSize: 15, fontWeight: 700,
                  background: 'linear-gradient(135deg,#214192,#315EC3)', color: '#FFFFFF',
                  border: 'none', cursor: 'pointer', fontFamily: 'Kanit, sans-serif',
                  boxShadow: '0 4px 14px rgba(49,94,195,0.3)', marginBottom: 12
                }}
              >
                เข้าสู่หน้า Dashboard จัดการร้านค้าทันที →
              </button>

              <p style={{ fontSize: 12, color: '#94A3B8' }}>
                ระบบได้บันทึกการเข้าสู่ระบบของคุณเรียบร้อยแล้ว
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Kanit, sans-serif' }}>
        <div style={{ fontSize: 14, color: '#64748B' }}>กำลังโหลดหน้าลงทะเบียน...</div>
      </div>
    }>
      <RegisterContent />
    </Suspense>
  )
}
