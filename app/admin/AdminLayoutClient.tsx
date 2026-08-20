'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import styles from './admin.module.css'
import { 
    LayoutDashboard, 
    Calendar, 
    Users, 
    Store, 
    UserCircle2, 
    Wrench, 
    ClipboardList, 
    Ticket,
    LogOut,
    Menu,
    ChevronLeft,
    History,
    Bell,
    X,
    MessageCircle,
    CalendarPlus,
    Wallet,
    Shield
} from 'lucide-react'
import AuditLogModal from '@/components/Admin/AuditLogModal'
import NotificationTesterModal from '@/components/Admin/NotificationTesterModal'
import Logo from '@/components/Branding/Logo'
import ConfirmModal from '@/components/Global/ConfirmModal'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS = [
    { href: '/admin/dashboard', icon: LayoutDashboard, label: 'ภาพรวมแพลตฟอร์ม' },
    { href: '/admin/shops', icon: Store, label: 'ร้านพาร์ทเนอร์' },
    { href: '/admin/invitations', icon: Ticket, label: 'Invitation Codes' },
    { href: '/admin/finance', icon: Wallet, label: 'อนุมัติการถอนเงิน' },
    { href: '/admin/branches', icon: Store, label: 'จัดการสาขาในระบบ' },
    { href: '/admin/services', icon: Wrench, label: 'บริการ & ราคา' },
    { href: '/admin/bookings', icon: ClipboardList, label: 'การจองทั้งหมด' },
    { href: '/admin/crm', icon: Users, label: 'CRM & ลูกค้า' },
    { href: '/admin/discounts', icon: Ticket, label: 'โค้ดส่วนลด' },
    { href: '/admin/promotions', icon: Bell, label: 'แจ้งโปรโมชั่น' },
]

interface AdminToast {
    id: string
    type: 'booking' | 'chat'
    message: string
    at: Date
}

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [auditOpen, setAuditOpen] = useState(false)
    const [testNotiOpen, setTestNotiOpen] = useState(false)
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
    const [toasts, setToasts] = useState<AdminToast[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    // Request notification permission once
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission()
            }
        }
    }, [])

    const addToast = useCallback((toast: Omit<AdminToast, 'id' | 'at'>) => {
        const id = Date.now().toString()
        setToasts(prev => [...prev.slice(-4), { ...toast, id, at: new Date() }])
        setUnreadCount(c => c + 1)

        // Browser notification (if permitted and tab is not focused)
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
            new Notification('Foami Admin', {
                body: toast.message,
                icon: '/logo.svg',
                tag: id
            })
        }

        // Auto-dismiss after 8s
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 8000)
    }, [])

    // Realtime subscriptions — new bookings & new chat messages
    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
        if (!token || pathname === '/admin/login') return

        const bookingChannel = supabase
            .channel('admin_new_bookings')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'bookings'
            }, () => {
                addToast({ type: 'booking', message: '📋 มีการจองใหม่เข้ามา' })
            })
            .subscribe()

        const chatChannel = supabase
            .channel('admin_new_chats')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'booking_messages',
            }, (payload) => {
                const msg = payload.new as any
                // Only notify for customer messages (not staff/admin sending)
                if (msg.sender_type === 'customer') {
                    addToast({ type: 'chat', message: '💬 ลูกค้าส่งข้อความใหม่' })
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(bookingChannel)
            supabase.removeChannel(chatChannel)
        }
    }, [pathname, addToast])

    useEffect(() => {
        const token = localStorage.getItem('admin_token')
        if (!token && pathname !== '/admin/login') {
            router.replace('/admin/login')
        }
    }, [pathname, router])

    if (pathname === '/admin/login') return <>{children}</>

    const handleLogout = () => {
        setLogoutConfirmOpen(true)
    }

    const confirmLogout = () => {
        setLogoutConfirmOpen(false)
        localStorage.removeItem('admin_token')
        window.location.href = '/admin/login'
    }

    const dismissToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }

    return (
        <div className={styles.shell}>
            {/* Sidebar */}
            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
                <div className={styles.brand}>
                    <Logo width={140} variant="landscape" />
                </div>
                <nav className={styles.nav}>
                    {NAV_ITEMS.map(item => {
                        const Icon = item.icon
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${pathname.startsWith(item.href) ? styles.navActive : ''}`}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <Icon size={22} className={styles.navIcon} />
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>
                <div className={styles.sidebarFooter}>
                    <button 
                        onClick={() => setTestNotiOpen(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            width: '100%',
                            padding: '10px 0',
                            marginBottom: 0,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            opacity: 0.8,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8' }}
                    >
                        <Bell size={14} /> ทดสอบแจ้งเตือน
                    </button>
                    <button 
                        onClick={() => setAuditOpen(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            width: '100%',
                            padding: '10px 0',
                            marginBottom: 8,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            opacity: 0.8,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8' }}
                    >
                        <History size={14} /> ประวัติการแก้ไข
                    </button>
                    <button className={styles.logoutBtn} onClick={handleLogout}>
                        <LogOut size={18} /> ออกจากระบบ
                    </button>
                </div>
            </aside>

            {/* Overlay */}
            {sidebarOpen && (
                <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
            )}

            {/* Main */}
            <div className={styles.main}>
                <header className={styles.topbar}>
                    <button className={styles.menuBtn} onClick={() => setSidebarOpen(!sidebarOpen)}>
                        <Menu size={24} />
                    </button>
                    <span className={styles.topbarTitle}>
                        {NAV_ITEMS.find(i => pathname.startsWith(i.href))?.label || 'Foami Admin'}
                    </span>
                    <div className={styles.topbarRight}>
                        {/* Notification bell with badge */}
                        {unreadCount > 0 && (
                            <button
                                onClick={() => setUnreadCount(0)}
                                style={{
                                    position: 'relative',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--brand-dominant)',
                                    padding: 6,
                                    borderRadius: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginRight: 8
                                }}
                            >
                                <Bell size={22} />
                                <span style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    background: '#EF4444',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: 18,
                                    height: 18,
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    lineHeight: 1
                                }}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            </button>
                        )}
                        <div className={styles.adminBadge}>Super Admin</div>
                    </div>
                </header>
                <main className={styles.content}>{children}</main>
            </div>

            <AuditLogModal isOpen={auditOpen} onClose={() => setAuditOpen(false)} />
            <NotificationTesterModal isOpen={testNotiOpen} onClose={() => setTestNotiOpen(false)} />
            
            <ConfirmModal 
                isOpen={logoutConfirmOpen}
                onClose={() => setLogoutConfirmOpen(false)}
                onConfirm={confirmLogout}
                title="ยืนยันการออกจากระบบ"
                message="คุณต้องการออกจากระบบ Foami Admin ใช่หรือไม่?"
                confirmText="ออกจากระบบ"
                variant="danger"
            />

            {/* Toast Notifications — bottom right */}
            <div style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                pointerEvents: 'none'
            }}>
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        style={{
                            pointerEvents: 'all',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            background: 'white',
                            border: '2px solid',
                            borderColor: toast.type === 'booking' ? 'var(--brand-dominant)' : '#7C3AED',
                            borderRadius: 16,
                            padding: '14px 16px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                            minWidth: 260,
                            maxWidth: 340,
                            animation: 'slideInRight 0.3s cubic-bezier(0.16,1,0.3,1)'
                        }}
                    >
                        <div style={{
                            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                            background: toast.type === 'booking' ? 'var(--brand-dominant-ghost)' : '#EDE9FE',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: toast.type === 'booking' ? 'var(--brand-dominant)' : '#7C3AED'
                        }}>
                            {toast.type === 'booking'
                                ? <CalendarPlus size={20} />
                                : <MessageCircle size={20} />
                            }
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                {toast.message}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                {toast.at.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                        <button
                            onClick={() => dismissToast(toast.id)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--text-muted)', padding: 4, borderRadius: 6,
                                flexShrink: 0
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}

