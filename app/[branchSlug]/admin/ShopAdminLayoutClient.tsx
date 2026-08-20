'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useParams } from 'next/navigation'
import styles from '@/app/admin/admin.module.css'
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
    History,
    Bell,
    X,
    MessageCircle,
    CalendarPlus,
    Wallet,
    Star,
    Settings
} from 'lucide-react'
import Logo from '@/components/Branding/Logo'
import ConfirmModal from '@/components/Global/ConfirmModal'
import { supabase } from '@/lib/supabase'

export default function ShopAdminLayoutClient({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const params = useParams()
    const branchSlug = (params?.branchSlug as string) || 'main'

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
    const [toasts, setToasts] = useState<any[]>([])
    const [unreadCount, setUnreadCount] = useState(0)

    const NAV_ITEMS = [
        { href: `/${branchSlug}/admin/dashboard`, icon: LayoutDashboard, label: 'ภาพรวม' },
        { href: `/${branchSlug}/admin/schedule`, icon: Calendar, label: 'ตารางงาน' },
        { href: `/${branchSlug}/admin/crm`, icon: Users, label: 'CRM & ลูกค้า' },
        { href: `/${branchSlug}/admin/branches`, icon: Store, label: 'ข้อมูลสาขา & โซน' },
        { href: `/${branchSlug}/admin/staff`, icon: UserCircle2, label: 'พนักงาน' },
        { href: `/${branchSlug}/admin/services`, icon: Wrench, label: 'บริการ & ราคา' },
        { href: `/${branchSlug}/admin/bookings`, icon: ClipboardList, label: 'การจอง' },
        { href: `/${branchSlug}/admin/reviews`, icon: Star, label: 'รีวิวลูกค้า' },
        { href: `/${branchSlug}/admin/discounts`, icon: Ticket, label: 'โค้ดส่วนลด' },
        { href: `/${branchSlug}/admin/finance`, icon: Wallet, label: 'กระเป๋าเงิน' },
        { href: `/${branchSlug}/admin/settings`, icon: Settings, label: 'ตั้งค่าร้าน' },
    ]

    const addToast = useCallback((toast: any) => {
        const id = Date.now().toString()
        setToasts(prev => [...prev.slice(-4), { ...toast, id, at: new Date() }])
        setUnreadCount(c => c + 1)
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000)
    }, [])

    const [shopInfo, setShopInfo] = useState<{ name: string; logo_url: string }>({ name: '', logo_url: '' })

    // Fetch branch settings & tab title
    const loadShopInfo = useCallback(async () => {
        if (!branchSlug) return
        const [{ data: branch }, { data: appSetting }] = await Promise.all([
            supabase.from('branches').select('name, browser_title, logo_url').eq('slug', branchSlug).maybeSingle(),
            supabase.from('app_settings').select('value').eq('key', `shop_settings:${branchSlug}`).maybeSingle()
        ])

        const s = appSetting?.value || {}
        const name = branch?.name || s.name || branchSlug
        const logo = s.logo_url ?? branch?.logo_url ?? ''
        const title = s.browser_title || branch?.browser_title || name || `Foami — สาขา ${name}`

        setShopInfo({ name, logo_url: logo })
        if (title) document.title = title
    }, [branchSlug])

    useEffect(() => {
        loadShopInfo()

        const handleUpdate = (e: any) => {
            const s = e.detail || {}
            if (s.name) setShopInfo(prev => ({ ...prev, name: s.name, logo_url: s.logo_url ?? prev.logo_url }))
            if (s.browser_title) document.title = s.browser_title
        }

        window.addEventListener('foami:shop-settings-updated', handleUpdate)
        return () => window.removeEventListener('foami:shop-settings-updated', handleUpdate)
    }, [branchSlug, loadShopInfo, pathname])

    // ─── Auth Guard ───────────────────────────────────────────────
    const [authChecked, setAuthChecked] = useState(false)

    useEffect(() => {
        if (pathname.includes('/login')) {
            setAuthChecked(true)
            return
        }
        const token = typeof window !== 'undefined' ? localStorage.getItem('shop_admin_token') : null
        if (!token) {
            router.replace(`/${branchSlug}/admin/login`)
        } else {
            setAuthChecked(true)
        }
    }, [pathname, branchSlug, router])

    // ─── Realtime notifications ───────────────────────────────────
    useEffect(() => {
        if (pathname.includes('/login')) return

        const bookingChannel = supabase
            .channel(`shop_bookings_${branchSlug}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, () => {
                addToast({ type: 'booking', message: '📋 มีการจองใหม่เข้ามา' })
            })
            .subscribe()

        return () => { supabase.removeChannel(bookingChannel) }
    }, [pathname, branchSlug, addToast])

    if (pathname.endsWith('/login')) return <>{children}</>

    // Block render until auth is verified (prevents flash of protected content)
    if (!authChecked) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
            <div style={{ width: 36, height: 36, border: '3px solid var(--brand-dominant)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )

    const confirmLogout = () => {
        setLogoutConfirmOpen(false)
        localStorage.removeItem('shop_admin_token')
        router.replace(`/${branchSlug}/admin/login`)
    }

    return (
        <div className={styles.shell}>
            {/* Sidebar */}
            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
                <div className={styles.brand} style={{ flexDirection: 'column', gap: 6, textAlign: 'center', padding: '16px 20px 24px' }}>
                    {shopInfo.logo_url ? (
                        <img
                            src={shopInfo.logo_url}
                            alt={shopInfo.name || 'Shop Logo'}
                            style={{ maxHeight: 52, maxWidth: 190, objectFit: 'contain', margin: '0 auto' }}
                        />
                    ) : (
                        <div style={{
                            fontSize: '1.35rem',
                            fontWeight: 900,
                            color: 'var(--brand-dominant)',
                            letterSpacing: '-0.02em',
                            lineHeight: 1.2,
                            padding: '4px 0'
                        }}>
                            {shopInfo.name || branchSlug}
                        </div>
                    )}
                </div>
                <nav className={styles.nav}>
                    {NAV_ITEMS.map(item => {
                        const Icon = item.icon
                        const active = pathname === item.href || pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${active ? styles.navActive : ''}`}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <Icon size={20} className={styles.navIcon} />
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>
                <div className={styles.sidebarFooter}>
                    <button className={styles.logoutBtn} onClick={() => setLogoutConfirmOpen(true)}>
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
                        {NAV_ITEMS.find(i => pathname.startsWith(i.href))?.label || 'Shop Admin'}
                    </span>
                    <div className={styles.topbarRight}>
                        <div className={styles.adminBadge}>Shop Admin</div>
                    </div>
                </header>
                <main className={styles.content}>{children}</main>
            </div>

            <ConfirmModal 
                isOpen={logoutConfirmOpen}
                onClose={() => setLogoutConfirmOpen(false)}
                onConfirm={confirmLogout}
                title="ยืนยันการออกจากระบบ"
                message="คุณต้องการออกจากระบบ Shop Admin ใช่หรือไม่?"
                confirmText="ออกจากระบบ"
                variant="danger"
            />
        </div>
    )
}
