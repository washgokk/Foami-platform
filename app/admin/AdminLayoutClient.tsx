'use client'
import { useState, useEffect } from 'react'
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
    History
} from 'lucide-react'
import AuditLogModal from '@/components/Admin/AuditLogModal'
import Logo from '@/components/Branding/Logo'
import ConfirmModal from '@/components/Global/ConfirmModal'

const NAV_ITEMS = [
    { href: '/admin/dashboard', icon: LayoutDashboard, label: 'ภาพรวม' },
    { href: '/admin/schedule', icon: Calendar, label: 'ตารางงาน' },
    { href: '/admin/crm', icon: Users, label: 'CRM & ลูกค้า' },
    { href: '/admin/branches', icon: Store, label: 'สาขา & โซน' },
    { href: '/admin/staff', icon: UserCircle2, label: 'พนักงาน' },
    { href: '/admin/services', icon: Wrench, label: 'บริการ & ราคา' },
    { href: '/admin/bookings', icon: ClipboardList, label: 'การจอง' },
    { href: '/admin/discounts', icon: Ticket, label: 'โค้ดส่วนลด' },
]

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [auditOpen, setAuditOpen] = useState(false)
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

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
                        <div className={styles.adminBadge}>Super Admin</div>
                    </div>
                </header>
                <main className={styles.content}>{children}</main>
            </div>

            <AuditLogModal isOpen={auditOpen} onClose={() => setAuditOpen(false)} />
            
            <ConfirmModal 
                isOpen={logoutConfirmOpen}
                onClose={() => setLogoutConfirmOpen(false)}
                onConfirm={confirmLogout}
                title="ยืนยันการออกจากระบบ"
                message="คุณต้องการออกจากระบบ Foami Admin ใช่หรือไม่?"
                confirmText="ออกจากระบบ"
                variant="danger"
            />
        </div>
    )
}
