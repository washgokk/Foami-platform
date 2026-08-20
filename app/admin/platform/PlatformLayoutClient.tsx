'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Store, Ticket, Wallet, BarChart3,
  Settings, LogOut, ChevronLeft, Shield
} from 'lucide-react'

const NAV = [
  { href: '/admin/platform', icon: LayoutDashboard, label: 'ภาพรวม' },
  { href: '/admin/platform/shops', icon: Store, label: 'ร้านพาร์ทเนอร์' },
  { href: '/admin/platform/invitations', icon: Ticket, label: 'Invitation Codes' },
  { href: '/admin/platform/finance', icon: Wallet, label: 'การเงิน' },
  { href: '/admin/platform/analytics', icon: BarChart3, label: 'Analytics' },
]

export default function PlatformLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('platform_token')
    if (!token && pathname !== '/admin/platform/login') {
      router.replace('/admin/platform/login')
    } else {
      setAuthed(true)
    }
  }, [pathname, router])

  if (pathname === '/admin/platform/login') return <>{children}</>
  if (!authed) return null

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        boxShadow: '2px 0 8px rgba(26,35,64,.04)'
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg,#214192,#315EC3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Shield size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Platform Admin</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>Foami Control Center</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/admin/platform' && pathname.startsWith(href))
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 12, textDecoration: 'none',
                fontSize: 13, fontWeight: 500, transition: 'all .2s',
                background: active ? 'var(--brand-ghost)' : 'transparent',
                color: active ? 'var(--brand)' : 'var(--text-secondary)',
                fontFamily: 'Kanit, sans-serif'
              }}>
                <Icon size={17} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button onClick={() => {
            localStorage.removeItem('platform_token')
            router.replace('/admin/platform/login')
          }} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
            borderRadius: 10, fontSize: 12, color: 'var(--danger)', background: 'none',
            border: 'none', cursor: 'pointer', fontFamily: 'Kanit, sans-serif', fontWeight: 500, width: '100%'
          }}>
            <LogOut size={14} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <header style={{
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          padding: '0 28px', height: 56, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexShrink: 0
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {NAV.find(n => n.href === pathname || (n.href !== '/admin/platform' && pathname.startsWith(n.href)))?.label || 'Platform Admin'}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--brand-ghost)', color: 'var(--brand)',
            borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700
          }}>
            <Shield size={12} /> Super Admin
          </div>
        </header>
        <main style={{ flex: 1, padding: 28 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
