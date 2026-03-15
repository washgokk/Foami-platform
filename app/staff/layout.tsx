'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import styles from './staff-layout.module.css'
import { 
    Home, 
    Calendar, 
    Wrench, 
    Settings, 
    LogOut 
} from 'lucide-react'

export default function StaffLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [staffName, setStaffName] = useState('')

    useEffect(() => {
        const token = localStorage.getItem('staff_token')
        const staff = localStorage.getItem('staff_data')
        if (!token && pathname !== '/staff/login') {
            router.replace('/staff/login')
        } else if (staff && staff !== 'undefined') {
            try { setStaffName(JSON.parse(staff).full_name || '') } catch (e) { }
        }
    }, [pathname, router])

    if (pathname === '/staff/login') return <>{children}</>

    const NAV = [
        { href: '/staff/dashboard', icon: Home, label: 'หน้าหลัก' },
        { href: '/staff/schedule', icon: Calendar, label: 'ตาราง' },
        { href: '/staff/jobs', icon: Wrench, label: 'งาน' },
        { href: '/staff/settings', icon: Settings, label: 'ตั้งค่า' },
    ]

    const handleLogout = () => {
        localStorage.removeItem('staff_token')
        localStorage.removeItem('staff_data')
        router.replace('/staff/login')
    }

    return (
        <div className={styles.shell}>
            {/* Top Bar */}
            <header className={styles.topbar}>
                <div className={styles.topbarLeft}>
                    <img 
                        src="/logo - lanscape.svg" 
                        alt="Foami" 
                        style={{ height: 26, width: 'auto' }} 
                    />
                </div>
                
                <div className={styles.topbarRight}>
                    <div className={styles.topbarGreeting}>
                        <span className={styles.topbarName}>สวัสดี, {staffName || 'พนักงาน'}</span>
                    </div>
                    <button className={styles.logoutBtn} onClick={handleLogout}>
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main className={styles.main}>{children}</main>

            {/* Bottom Nav */}
            <nav className={styles.bottomNav}>
                {NAV.map(item => {
                    const Icon = item.icon
                    const isActive = pathname.startsWith(item.href)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.bottomNavItem} ${isActive ? styles.active : ''}`}
                        >
                            <Icon size={22} className={styles.bottomNavIcon} />
                            <span>{item.label}</span>
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}
