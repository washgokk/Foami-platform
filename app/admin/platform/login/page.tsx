'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Eye, EyeOff } from 'lucide-react'

export default function PlatformLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/platform/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      const data = await res.json()
      if (!res.ok || !data.token) {
        setError('รหัสผ่านไม่ถูกต้อง')
      } else {
        localStorage.setItem('platform_token', data.token)
        router.replace('/admin/platform')
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#0f1e4a 0%,#1e3d8f 50%,#315EC3 100%)'
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, padding: '40px 36px',
        width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,.25)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'linear-gradient(135deg,#214192,#315EC3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px'
          }}>
            <Shield size={24} color="#fff" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1A2340' }}>Platform Admin</div>
          <div style={{ fontSize: 13, color: '#9AA5C4', marginTop: 4 }}>Foami Control Center</div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <input
              type={show ? 'text' : 'password'}
              placeholder="รหัสผ่าน Platform Admin"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px 44px 12px 16px',
                border: '2px solid #DDE3F5', borderRadius: 16, fontSize: 14,
                fontFamily: 'Kanit, sans-serif', outline: 'none', color: '#1A2340',
                boxSizing: 'border-box'
              }}
            />
            <button type="button" onClick={() => setShow(!show)} style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#9AA5C4', padding: 0
            }}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div style={{
              background: '#FEE2E2', color: '#B91C1C', borderRadius: 10,
              padding: '10px 14px', fontSize: 13, fontWeight: 500
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            background: loading ? '#BFC8E8' : 'linear-gradient(135deg,#214192,#315EC3)',
            color: '#fff', border: 'none', borderRadius: 14, padding: '13px 0',
            fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'Kanit, sans-serif', transition: 'all .2s'
          }}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  )
}
