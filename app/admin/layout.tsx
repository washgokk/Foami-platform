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
    ChevronLeft
} from 'lucide-react'

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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    useEffect(() => {
        const token = localStorage.getItem('admin_token')
        if (!token && pathname !== '/admin/login') {
            router.replace('/admin/login')
        }
    }, [pathname, router])

    if (pathname === '/admin/login') return <>{children}</>

    const handleLogout = () => {
        localStorage.removeItem('admin_token')
        router.replace('/admin/login')
    }

    return (
        <div className={styles.shell}>
            {/* Sidebar */}
            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
                <div className={styles.brand}>
                    <img 
                        src="/logo - lanscape.svg" 
                        alt="Foami" 
                        style={{ height: 32, width: 'auto' }} 
                    />
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
                                <Icon size={20} className={styles.navIcon} />
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>
                <div className={styles.sidebarFooter}>
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
                    <span className={styles.topbarTitle}>Admin Panel</span>
                    <div className={styles.topbarRight}>
                        <span className={styles.adminBadge}>Super Admin</span>
                    </div>
                </header>
                <main className={styles.content}>{children}</main>
            </div>
        </div>
    )
}
