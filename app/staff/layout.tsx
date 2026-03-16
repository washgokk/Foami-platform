'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import styles from './staff-layout.module.css'
import Logo from '@/components/Branding/Logo'
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

    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

    const handleLogout = () => {
        localStorage.removeItem('staff_token')
        localStorage.removeItem('staff_data')
        window.location.href = '/staff/login'
    }

    return (
        <div className={styles.shell}>
            {/* Top Bar */}
            <header className={styles.topbar}>
                <div className={styles.topbarLeft}>
                    <Logo width={100} variant="landscape" />
                </div>
                
                <div className={styles.topbarRight}>
                    <div className={styles.topbarGreeting}>
                        <span className={styles.topbarName}>สวัสดี, {staffName || 'พนักงาน'}</span>
                    </div>
                    <button className={styles.logoutBtn} onClick={() => setShowLogoutConfirm(true)}>
                        <LogOut size={18} strokeWidth={2.5} />
                    </button>
                </div>
            </header>

            {showLogoutConfirm && (
                <div className={styles.logoutOverlay} onClick={() => setShowLogoutConfirm(false)}>
                    <div className={styles.logoutModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.logoutIcon}>
                            <LogOut size={32} />
                        </div>
                        <h3>ยืนยันการออกจากระบบ</h3>
                        <p>คุณต้องการออกจากระบบใช่หรือไม่?</p>
                        <div className={styles.logoutActions}>
                            <button className="btn btn-ghost" onClick={() => setShowLogoutConfirm(false)}>ยกเลิก</button>
                            <button className="btn btn-danger" onClick={handleLogout}>ออกจากระบบ</button>
                        </div>
                    </div>
                </div>
            )}

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
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={styles.bottomNavIcon} />
                            <span>{item.label}</span>
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}
