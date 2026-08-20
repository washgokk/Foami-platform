'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Store, Ticket, Wallet, BarChart3, Users,
  Settings, LogOut, ChevronLeft, ChevronRight, Shield, Menu, X, Crown, ExternalLink
} from 'lucide-react'
import Logo from '@/components/Branding/Logo'
import ConfirmModal from '@/components/Global/ConfirmModal'

const NAV = [
  { href: '/admin/platform', icon: LayoutDashboard, label: 'ภาพรวมระบบ' },
  { href: '/admin/platform/shops', icon: Store, label: 'ร้านพาร์ทเนอร์' },
  { href: '/admin/platform/crm', icon: Users, label: 'CRM ลูกค้าทั้งระบบ' },
  { href: '/admin/platform/analytics', icon: BarChart3, label: 'Analytics & รายงาน' },
  { href: '/admin/platform/finance', icon: Wallet, label: 'การเงิน & ถอนเงิน' },
  { href: '/admin/platform/invitations', icon: Ticket, label: 'Invitation Codes' },
]

export default function PlatformLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('platform_token')
    if (!token && pathname !== '/admin/platform/login') {
      router.replace('/admin/platform/login')
    } else {
      setAuthed(true)
    }
  }, [pathname, router])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  if (pathname === '/admin/platform/login') return <>{children}</>
  if (!authed) return null

  const handleLogout = () => {
    localStorage.removeItem('platform_token')
    router.replace('/admin/platform/login')
  }

  const currentNav = NAV.find(n => n.href === pathname || (n.href !== '/admin/platform' && pathname.startsWith(n.href)))

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      background: 'var(--bg, #F6F8FF)', 
      overflow: 'hidden',
      fontFamily: 'var(--font-kanit, "Kanit", sans-serif)'
    }}>
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 40,
            display: 'block'
          }}
        />
      )}

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside style={{
        width: 240, 
        background: 'var(--surface, #FFFFFF)', 
        borderRight: '1.5px solid var(--border, #DDE3F5)',
        display: 'flex', 
        flexDirection: 'column', 
        flexShrink: 0,
        boxShadow: '2px 0 12px rgba(49, 94, 195, 0.04)',
        zIndex: 50,
        position: mobileMenuOpen ? 'fixed' : 'relative',
        top: 0,
        bottom: 0,
        left: 0,
        transform: mobileMenuOpen ? 'translateX(0)' : undefined,
        transition: 'transform 0.3s ease'
      }} className="platform-sidebar">
        {/* Logo Header */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1.5px solid var(--border, #DDE3F5)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, 
              height: 36, 
              borderRadius: 10,
              background: 'linear-gradient(135deg, #214192, #315EC3)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(49, 94, 195, 0.3)'
            }}>
              <Crown size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #1A2340)', lineHeight: 1.2 }}>
                Platform HQ
              </div>
              <div style={{ fontSize: 10, color: '#D97706', fontWeight: 700, letterSpacing: '0.04em' }}>
                SUPER ADMIN
              </div>
            </div>
          </div>

          {/* Close button on mobile */}
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="mobile-close-btn"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 4,
              display: 'none'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/admin/platform' && pathname.startsWith(href))
            return (
              <Link 
                key={href} 
                href={href} 
                style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12,
                  padding: '11px 14px', 
                  borderRadius: 14, 
                  textDecoration: 'none',
                  fontSize: 13.5, 
                  fontWeight: active ? 700 : 500, 
                  transition: 'all .15s ease',
                  background: active ? 'var(--primary-ghost, #EFF3FD)' : 'transparent',
                  color: active ? 'var(--brand-dominant, #315EC3)' : 'var(--text-secondary, #5A6589)',
                  border: active ? '1px solid rgba(49, 94, 195, 0.15)' : '1px solid transparent'
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} color={active ? 'var(--brand-dominant, #315EC3)' : '#5A6589'} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer actions */}
        <div style={{ 
          padding: '14px 12px', 
          borderTop: '1.5px solid var(--border, #DDE3F5)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 6 
        }}>
          <Link 
            href="/portal"
            style={{
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '9px 12px',
              borderRadius: 10, 
              fontSize: 12, 
              color: 'var(--text-secondary)', 
              background: 'var(--bg, #F6F8FF)',
              textDecoration: 'none',
              fontWeight: 600
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ExternalLink size={13} color="var(--brand-dominant, #315EC3)" />
              สลับพอร์ทัล
            </span>
            <ChevronRight size={13} />
          </Link>

          <button 
            onClick={() => setLogoutModalOpen(true)} 
            style={{
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              padding: '10px 12px',
              borderRadius: 10, 
              fontSize: 12.5, 
              color: 'var(--danger, #EF4444)', 
              background: 'none',
              border: 'none', 
              cursor: 'pointer', 
              fontFamily: 'inherit', 
              fontWeight: 600, 
              width: '100%',
              textAlign: 'left'
            }}
          >
            <LogOut size={15} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <header style={{
          background: 'var(--surface, #FFFFFF)', 
          borderBottom: '1.5px solid var(--border, #DDE3F5)',
          padding: '0 24px', 
          height: 60, 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between', 
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(49, 94, 195, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="mobile-hamburger-btn"
              style={{
                background: 'var(--primary-ghost, #EFF3FD)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '6px 8px',
                cursor: 'pointer',
                color: 'var(--brand-dominant, #315EC3)',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Menu size={20} />
            </button>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #1A2340)' }}>
              {currentNav?.label || 'Platform Admin'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 6,
              background: 'rgba(245, 158, 11, 0.1)', 
              color: '#D97706',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 9999, 
              padding: '4px 12px', 
              fontSize: 11, 
              fontWeight: 700
            }}>
              <Crown size={13} /> Super Admin
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, padding: '24px', maxWidth: 1400, width: '100%', boxSizing: 'border-box' }}>
          {children}
        </main>
      </div>

      <ConfirmModal
        isOpen={logoutModalOpen}
        title="ออกจากระบบ Super Admin"
        message="คุณต้องการออกจากระบบ Platform Admin ใช่หรือไม่?"
        confirmText="ออกจากระบบ"
        cancelText="ยกเลิก"
        variant="danger"
        onConfirm={handleLogout}
        onClose={() => setLogoutModalOpen(false)}
      />

      <style jsx global>{`
        @media (max-width: 768px) {
          .platform-sidebar {
            position: fixed !important;
            transform: translateX(${mobileMenuOpen ? '0' : '-100%'}) !important;
          }
          .mobile-hamburger-btn {
            display: flex !important;
          }
          .mobile-close-btn {
            display: block !important;
          }
        }
      `}</style>
    </div>
  )
}
