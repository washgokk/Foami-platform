'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Calendar, LayoutDashboard, Briefcase, Settings, LogOut,
  Store, User, ShieldAlert
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function StaffBranchLayoutClient({
  branchSlug,
  children
}: {
  branchSlug: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [branch, setBranch] = useState<any>(null)
  const [staff, setStaff] = useState<any>(null)
  const [sessionConflict, setSessionConflict] = useState(false)
  const [loading, setLoading] = useState(true)

  const isLoginPage = pathname?.includes('/staff/login')

  // Load branch info and inject theme colors
  useEffect(() => {
    supabase
      .from('branches')
      .select('*')
      .eq('slug', branchSlug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBranch(data)
          const primary = data.primary_color || '#315EC3'
          const accent = data.accent_color || '#A0D9F6'
          document.documentElement.style.setProperty('--brand-dominant', primary)
          document.documentElement.style.setProperty('--brand-dominant-ghost', `${primary}18`)
          document.documentElement.style.setProperty('--brand-accent', accent)
        }
      })
  }, [branchSlug])

  // Auth & Single Session check (prevent concurrent logins)
  useEffect(() => {
    if (isLoginPage) {
      setLoading(false)
      return
    }

    const token = localStorage.getItem('staff_token')
    const staffData = localStorage.getItem('staff_data')
    const localSession = localStorage.getItem('staff_session_token')

    if (!token || !staffData) {
      router.replace(`/${branchSlug}/staff/login`)
      return
    }

    const parsed = JSON.parse(staffData)
    setStaff(parsed)
    setLoading(false)

    // Verify session token against DB
    const checkSession = async () => {
      if (!parsed.id) return
      try {
        const res = await fetch(`/api/auth/staff-session?staff_id=${parsed.id}`)
        const data = await res.json()
        if (data.active_session_token && localSession && data.active_session_token !== localSession) {
          setSessionConflict(true)
          localStorage.removeItem('staff_token')
          localStorage.removeItem('staff_session_token')
        }
      } catch (err) {
        console.warn('Session check failed:', err)
      }
    }

    checkSession()
    const timer = setInterval(checkSession, 30000) // check every 30s
    return () => clearInterval(timer)
  }, [pathname, branchSlug, isLoginPage, router])

  const handleLogout = () => {
    localStorage.removeItem('staff_token')
    localStorage.removeItem('staff_data')
    localStorage.removeItem('staff_session_token')
    router.replace(`/${branchSlug}/staff/login`)
  }

  if (isLoginPage) return <>{children}</>

  if (sessionConflict) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F8FAFC', padding: 24, fontFamily: 'Kanit, sans-serif'
      }}>
        <div style={{
          background: '#FFFFFF', border: '1.5px solid #FCA5A5', borderRadius: 20,
          padding: 32, maxWidth: 440, width: '100%', textAlign: 'center',
          boxShadow: '0 10px 30px rgba(220, 38, 38, 0.1)'
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ShieldAlert size={28} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#991B1B', marginBottom: 8 }}>
            ออกจากระบบอัตโนมัติ
          </h2>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, marginBottom: 24 }}>
            มีการเข้าสู่ระบบด้วยบัญชีนี้จากอุปกรณ์อื่น เพื่อความปลอดภัยและเงื่อนไขการใช้งาน ระบบไม่อนุญาตให้ล็อกอินซ้อนกันหลายเครื่อง
          </p>
          <button
            onClick={() => { setSessionConflict(false); router.replace(`/${branchSlug}/staff/login`) }}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 12, background: 'var(--brand-dominant, #315EC3)',
              color: '#FFFFFF', border: 'none', fontWeight: 700, cursor: 'pointer', fontFamily: 'Kanit, sans-serif'
            }}
          >
            เข้าสู่ระบบใหม่อีกครั้ง
          </button>
        </div>
      </div>
    )
  }

  const NAV_ITEMS = [
    { href: `/${branchSlug}/staff/dashboard`, label: 'ภาพรวม', icon: LayoutDashboard },
    { href: `/${branchSlug}/staff/schedule`, label: 'ตารางงาน & โซน', icon: Calendar },
    { href: `/${branchSlug}/staff/jobs`, label: 'รายการงาน', icon: Briefcase },
    { href: `/${branchSlug}/staff/settings`, label: 'โปรไฟล์', icon: Settings },
  ]

  const brandColor = branch?.primary_color || '#315EC3'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F8FAFC', fontFamily: 'Kanit, sans-serif' }}>
      {/* Top Bar with Branch Branding */}
      <header style={{
        background: '#FFFFFF', borderBottom: '1.5px solid #E2E8F0', padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: `${brandColor}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: brandColor
          }}>
            <Store size={20} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              {branch?.name || branchSlug}
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: `${brandColor}18`, color: brandColor }}>
                STAFF
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#64748B' }}>พนักงาน: {staff?.full_name || staff?.email}</div>
          </div>
        </div>

        {/* Desktop Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  borderRadius: 10, fontSize: 13, fontWeight: isActive ? 700 : 500,
                  textDecoration: 'none',
                  background: isActive ? `${brandColor}18` : 'transparent',
                  color: isActive ? brandColor : '#475569',
                  transition: 'all .2s'
                }}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </Link>
            )
          })}
          <button
            onClick={handleLogout}
            title="ออกจากระบบ"
            style={{
              padding: '7px 12px', borderRadius: 10, background: '#FEE2E2',
              color: '#DC2626', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit', marginLeft: 8
            }}
          >
            <LogOut size={13} />
            <span>ออก</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '24px 20px', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav style={{
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        background: '#FFFFFF', borderTop: '1px solid #E2E8F0', padding: '8px 0',
        position: 'sticky', bottom: 0, zIndex: 30
      }}>
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                fontSize: 11, fontWeight: isActive ? 700 : 500, textDecoration: 'none',
                color: isActive ? brandColor : '#94A3B8', padding: '4px 12px'
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
