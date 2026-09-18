'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Store, Mail, Lock, LogIn, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function StaffBranchLoginPage() {
  const { branchSlug } = useParams() as { branchSlug: string }
  const router = useRouter()

  const [branch, setBranch] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('branches')
      .select('*')
      .eq('slug', branchSlug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setBranch(data)
      })
  }, [branchSlug])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, branch_slug: branchSlug })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ')

      localStorage.setItem('staff_token', data.token)
      localStorage.setItem('staff_data', JSON.stringify(data.staff))
      if (data.session_token) {
        localStorage.setItem('staff_session_token', data.session_token)
      }

      router.replace(`/${branchSlug}/staff/dashboard`)
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  const brandColor = branch?.primary_color || '#315EC3'

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2F6 100%)', padding: 20,
      fontFamily: 'Kanit, sans-serif'
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: 24, border: '1.5px solid #E2E8F0',
        padding: '36px 32px', width: 420, maxWidth: '100%',
        boxShadow: '0 12px 32px rgba(0,0,0,0.06)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, background: `${brandColor}18`,
            color: brandColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px'
          }}>
            <Store size={26} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1E293B', margin: '0 0 6px' }}>
            {branch?.name || branchSlug}
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
            เข้าสู่ระบบสำหรับพนักงาน (Staff Portal)
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
            borderRadius: 12, background: '#FEE2E2', border: '1px solid #FECACA',
            color: '#B91C1C', fontSize: 13, fontWeight: 500, marginBottom: 18
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
              อีเมลพนักงาน
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="email"
                required
                placeholder="staff@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px 12px 42px', borderRadius: 12,
                  border: '1.5px solid #CBD5E1', fontSize: 14, fontFamily: 'Kanit, sans-serif',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
              รหัสผ่าน
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px 12px 42px', borderRadius: 12,
                  border: '1.5px solid #CBD5E1', fontSize: 14, fontFamily: 'Kanit, sans-serif',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 10, padding: '13px 0', borderRadius: 12, border: 'none',
              background: brandColor, color: '#FFFFFF', fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Kanit, sans-serif',
              boxShadow: `0 4px 14px ${brandColor}40`, opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 22, fontSize: 11, color: '#94A3B8' }}>
          * ระบบจะตรวจสอบอุปกรณ์เพื่อป้องกันการล็อกอินซ้อนกันหลายเครื่อง
        </p>
      </div>
    </div>
  )
}
