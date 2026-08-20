'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Ticket, Mail, Lock, User, Eye, EyeOff,
  CheckCircle2, ChevronRight, Droplets, AlertTriangle
} from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<'code' | 'account'>('code')
  const [form, setForm] = useState({ code: '', email: '', password: '', confirmPassword: '', shopName: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [codeValid, setCodeValid] = useState(false)

  const validateCode = async () => {
    if (!form.code.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/platform/invitations')
      const data = await res.json()
      const found = (data.invitations || []).find((inv: any) =>
        inv.code === form.code.toUpperCase().trim() &&
        !inv.is_used &&
        new Date(inv.expires_at) > new Date()
      )
      if (found) {
        setCodeValid(true)
        setStep('account')
      } else {
        setError('Code ไม่ถูกต้อง หมดอายุ หรือถูกใช้ไปแล้ว')
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน')
      return
    }
    if (form.password.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/platform/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          email: form.email,
          password: form.password,
          shop_name: form.shopName
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด')
      } else {
        router.push('/admin/login?registered=1')
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const BENEFITS = [
    'ระบบจองออนไลน์ครบวงจร',
    'แผนที่และโซนบริการ',
    'จัดการทีมและตารางงาน',
    'รายงานรายได้แบบ real-time',
    'Chat กับลูกค้าในระบบ',
  ]

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      fontFamily: 'Kanit, sans-serif',
      background: '#F6F8FF'
    }}>
      {/* Left Panel */}
      <div style={{
        width: 420, background: 'linear-gradient(150deg,#0f1e4a 0%,#1e3d8f 50%,#315EC3 100%)',
        padding: '48px 40px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
        flexShrink: 0
      }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />

        <div style={{ position: 'relative', flex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 52 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Droplets size={18} color="#93C5FD" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Foami</div>
          </div>

          <h2 style={{ fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1.2, margin: '0 0 12px' }}>
            เปิดร้านบน<br />Foami Platform
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', lineHeight: 1.6, marginBottom: 36 }}>
            รับ Invitation Code จากทีม Foami เพื่อเริ่มต้นใช้งาน ฟรี ไม่มีค่าใช้จ่ายขั้นต้น
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {BENEFITS.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle2 size={12} color="#86EFAC" />
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>{b}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
          © 2025 Foami Wash & Delivery
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          {/* Steps indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
            {[
              { n: 1, label: 'ยืนยัน Code', done: codeValid },
              { n: 2, label: 'สร้างบัญชี', done: false }
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 9, fontSize: 12, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: s.done ? '#22C55E' : step === (i === 0 ? 'code' : 'account') ? '#315EC3' : '#E8EEF8',
                  color: s.done || step === (i === 0 ? 'code' : 'account') ? '#fff' : '#9AA5C4'
                }}>
                  {s.done ? <CheckCircle2 size={14} /> : s.n}
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: step === (i === 0 ? 'code' : 'account') ? '#1A2340' : '#9AA5C4'
                }}>{s.label}</span>
                {i === 0 && <ChevronRight size={12} color="#9AA5C4" />}
              </div>
            ))}
          </div>

          {/* Step 1 — Code */}
          {step === 'code' && (
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A2340', margin: '0 0 6px' }}>ใส่ Invitation Code</h1>
              <p style={{ fontSize: 13, color: '#9AA5C4', marginBottom: 28 }}>
                รับ Code จากทีม Foami ผ่าน LINE หรือ Email ก่อนเริ่มสมัคร
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#555E7A', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Invitation Code
                </label>
                <div style={{ position: 'relative' }}>
                  <Ticket size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9AA5C4' }} />
                  <input
                    type="text"
                    placeholder="FOAMI-XXXXXX"
                    value={form.code}
                    onChange={e => { setForm(f => ({ ...f, code: e.target.value.toUpperCase() })); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && validateCode()}
                    style={{
                      width: '100%', padding: '13px 14px 13px 42px',
                      border: '2px solid #DDE3F5', borderRadius: 16, fontSize: 16,
                      fontFamily: 'monospace', outline: 'none', color: '#1A2340', letterSpacing: '.08em',
                      boxSizing: 'border-box', fontWeight: 700, textTransform: 'uppercase'
                    }}
                  />
                </div>
              </div>

              {error && (
                <div style={{ display: 'flex', gap: 8, padding: '11px 14px', borderRadius: 12, background: '#FEE2E2', marginBottom: 14 }}>
                  <AlertTriangle size={15} color="#B91C1C" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: '#B91C1C', fontWeight: 500 }}>{error}</span>
                </div>
              )}

              <button onClick={validateCode} disabled={!form.code || loading} style={{
                width: '100%', padding: '14px 0', borderRadius: 16, fontSize: 14, fontWeight: 700,
                background: form.code ? 'linear-gradient(135deg,#214192,#315EC3)' : '#BFC8E8',
                color: '#fff', border: 'none', cursor: form.code ? 'pointer' : 'not-allowed',
                fontFamily: 'Kanit, sans-serif', transition: 'all .2s'
              }}>
                {loading ? 'กำลังตรวจสอบ...' : 'ยืนยัน Code →'}
              </button>

              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#9AA5C4' }}>
                มีบัญชีแล้ว?{' '}
                <Link href="/admin/login" style={{ color: '#315EC3', fontWeight: 700, textDecoration: 'none' }}>เข้าสู่ระบบ</Link>
              </p>
            </div>
          )}

          {/* Step 2 — Account */}
          {step === 'account' && (
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A2340', margin: '0 0 6px' }}>สร้างบัญชีร้านค้า</h1>
              <p style={{ fontSize: 13, color: '#9AA5C4', marginBottom: 28 }}>
                Code: <strong style={{ color: '#315EC3', fontFamily: 'monospace' }}>{form.code}</strong> ✓
              </p>

              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Shop name */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#555E7A', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    ชื่อร้าน
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9AA5C4' }} />
                    <input type="text" placeholder="เช่น ร้านล้างรถโนฟท" required
                      value={form.shopName} onChange={e => setForm(f => ({ ...f, shopName: e.target.value }))}
                      style={{
                        width: '100%', padding: '12px 14px 12px 40px', border: '2px solid #DDE3F5',
                        borderRadius: 14, fontSize: 14, fontFamily: 'Kanit, sans-serif', outline: 'none',
                        color: '#1A2340', boxSizing: 'border-box'
                      }} />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#555E7A', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9AA5C4' }} />
                    <input type="email" placeholder="shop@email.com" required
                      value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      style={{
                        width: '100%', padding: '12px 14px 12px 40px', border: '2px solid #DDE3F5',
                        borderRadius: 14, fontSize: 14, fontFamily: 'Kanit, sans-serif', outline: 'none',
                        color: '#1A2340', boxSizing: 'border-box'
                      }} />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#555E7A', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    รหัสผ่าน
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9AA5C4' }} />
                    <input type={showPass ? 'text' : 'password'} placeholder="อย่างน้อย 8 ตัวอักษร" required
                      value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      style={{
                        width: '100%', padding: '12px 44px 12px 40px', border: '2px solid #DDE3F5',
                        borderRadius: 14, fontSize: 14, fontFamily: 'Kanit, sans-serif', outline: 'none',
                        color: '#1A2340', boxSizing: 'border-box'
                      }} />
                    <button type="button" onClick={() => setShowPass(!showPass)} style={{
                      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#9AA5C4', padding: 0
                    }}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#555E7A', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    ยืนยันรหัสผ่าน
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9AA5C4' }} />
                    <input type={showPass ? 'text' : 'password'} placeholder="กรอกรหัสผ่านอีกครั้ง" required
                      value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      style={{
                        width: '100%', padding: '12px 14px 12px 40px', border: '2px solid #DDE3F5',
                        borderRadius: 14, fontSize: 14, fontFamily: 'Kanit, sans-serif', outline: 'none',
                        color: '#1A2340', boxSizing: 'border-box'
                      }} />
                  </div>
                </div>

                {error && (
                  <div style={{ display: 'flex', gap: 8, padding: '11px 14px', borderRadius: 12, background: '#FEE2E2' }}>
                    <AlertTriangle size={15} color="#B91C1C" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 13, color: '#B91C1C', fontWeight: 500 }}>{error}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => { setStep('code'); setError(''); setCodeValid(false) }} style={{
                    padding: '13px 16px', borderRadius: 14, background: '#F3F4F6',
                    color: '#374151', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'Kanit, sans-serif', fontWeight: 600
                  }}>← ย้อนกลับ</button>
                  <button type="submit" disabled={loading} style={{
                    flex: 1, padding: '13px 0', borderRadius: 14, fontSize: 14, fontWeight: 700,
                    background: 'linear-gradient(135deg,#214192,#315EC3)', color: '#fff',
                    border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'Kanit, sans-serif', opacity: loading ? .7 : 1
                  }}>
                    {loading ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชีร้าน →'}
                  </button>
                </div>

                <p style={{ textAlign: 'center', fontSize: 11, color: '#9AA5C4', lineHeight: 1.5, margin: 0 }}>
                  การสมัครถือว่าคุณยอมรับ{' '}
                  <Link href="/terms" style={{ color: '#315EC3', textDecoration: 'none' }}>เงื่อนไขการใช้งาน</Link>
                  {' '}และ{' '}
                  <Link href="/privacy" style={{ color: '#315EC3', textDecoration: 'none' }}>นโยบายความเป็นส่วนตัว</Link>
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
