'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { usePushNotifications } from '@/lib/hooks/usePushNotifications'
import { Bell, X, Gift, Truck, Droplets, CheckCircle, Sparkles, ShieldAlert } from 'lucide-react'

/**
 * NotificationPermission - Premium Centered Modal (v3)
 * - Centered modal design matching Foami theme.
 * - Staff Mandatory: If platform is 'staff', dismissal is disabled.
 * - Replaced all emojis with Lucide icons for a cleaner look.
 * - Shows after 4 seconds if not yet decided.
 */
export default function NotificationPermission() {
    const pathname = usePathname()
    const [userId, setUserId] = useState<string | undefined>(undefined)
    const [platform, setPlatform] = useState<'customer' | 'staff' | 'admin'>('customer')
    const [show, setShow] = useState(false)
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)

    // Staff needs this to work. No skipping.
    const isStaff = platform === 'staff'

    const scope = platform === 'admin' ? '/admin/' : platform === 'staff' ? '/staff/' : '/'
    const { subscribe, isSubscribed } = usePushNotifications(userId, platform, scope)

    // Detect current user type
    useEffect(() => {
        const staff = localStorage.getItem('staff_data')
        const admin = localStorage.getItem('admin_token')
        const customer = localStorage.getItem('liff_customer')

        // Prioritize by URL path for better context
        if (pathname.startsWith('/admin')) {
            setUserId('admin_user')
            setPlatform('admin')
        } else if (pathname.startsWith('/staff')) {
            if (staff) {
                try { 
                    const s = JSON.parse(staff)
                    setUserId(s.id)
                    setPlatform('staff') 
                } catch(e) { setUserId(undefined) }
            } else { setUserId(undefined) }
        } else {
            // Default to customer logic for everything else
            if (customer) {
                try { 
                    const c = JSON.parse(customer)
                    setUserId(c.id)
                    setPlatform('customer') 
                } catch(e) { setUserId(undefined) }
            } else { setUserId(undefined) }
        }
    }, [pathname])

    // Decide whether to show the banner
    useEffect(() => {
        if (!userId) return
        if (typeof window === 'undefined') return
        if (!('Notification' in window)) return

        // Already subscribed → no need to ask again
        if (Notification.permission === 'granted' && isSubscribed) return

        // Already permanently dismissed by user → don't show (unless staff or unsubscribed!)
        const dismissed = localStorage.getItem('foami_notif_dismissed')
        if (dismissed && !isStaff) return

        // Force show for staff if not subscribed
        if (isStaff && !isSubscribed) {
            setShow(true)
            return
        }

        // Show banner after delay for others
        const timer = setTimeout(() => setShow(true), 4000)
        return () => clearTimeout(timer)
    }, [userId, isStaff, isSubscribed])

    // Hide if already subscribed
    useEffect(() => {
        if (isSubscribed) setShow(false)
    }, [isSubscribed])

    const handleAccept = async () => {
        setLoading(true)
        try {
            const permission = await Notification.requestPermission()
            localStorage.setItem('foami_notif_requested', 'true')

            if (permission === 'granted' && userId) {
                await subscribe()
                setDone(true)
                setTimeout(() => setShow(false), 2000)
            } else {
                // Denied or Dismissed
                if (!isStaff) {
                    localStorage.setItem('foami_notif_dismissed', 'true')
                    setShow(false)
                }
            }
        } catch (e) {
            console.error('Notification permission error:', e)
            if (!isStaff) setShow(false)
        } finally {
            setLoading(false)
        }
    }

    const handleDismiss = () => {
        if (isStaff) return // Staff cannot dismiss
        localStorage.setItem('foami_notif_dismissed', 'true')
        setShow(false)
    }

    if (!show) return null

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={handleDismiss}
                style={{
                    position: 'fixed', inset: 0, zIndex: 9990,
                    background: 'rgba(26, 35, 64, 0.4)',
                    backdropFilter: 'blur(10px)',
                    animation: 'fadeIn 0.4s ease',
                    cursor: isStaff ? 'default' : 'pointer'
                }}
            />

            {/* Centered Modal */}
            <div style={{
                position: 'fixed',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 9999,
                width: 'calc(100% - 40px)',
                maxWidth: 420,
                animation: 'modalEntrance 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
                <div style={{
                    background: '#FFFFFF',
                    borderRadius: 32,
                    padding: '40px 28px',
                    boxShadow: '0 25px 60px -12px rgba(26, 35, 64, 0.15), 0 0 40px rgba(49, 94, 195, 0.1)',
                    color: '#1A2340',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    border: '1px solid #DDE3F5',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Brand Glows (Subtle) */}
                    <div style={{
                        position: 'absolute', top: '-20%', right: '-20%',
                        width: 250, height: 250, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(160, 217, 246, 0.15) 0%, transparent 70%)',
                        pointerEvents: 'none'
                    }} />
                    <div style={{
                        position: 'absolute', bottom: '-15%', left: '-15%',
                        width: 200, height: 200, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(241, 191, 219, 0.2) 0%, transparent 70%)',
                        pointerEvents: 'none'
                    }} />

                    {/* Exit Button (Hidden for Staff) */}
                    {!isStaff && !done && (
                        <button
                            onClick={handleDismiss}
                            style={{
                                position: 'absolute', top: 24, right: 24,
                                background: '#F0F3FC', border: 'none',
                                borderRadius: 12, padding: 8, color: '#9AA5C4',
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >
                            <X size={20} />
                        </button>
                    )}

                    {/* Main Icon Container */}
                    <div style={{
                        width: 96, height: 96, borderRadius: 32,
                        background: done 
                            ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
                            : 'linear-gradient(135deg, #315EC3 0%, #214192 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 28,
                        boxShadow: done 
                            ? '0 12px 28px rgba(34, 197, 94, 0.25)' 
                            : '0 12px 28px rgba(49, 94, 195, 0.3)',
                        position: 'relative',
                        animation: 'iconPulse 2s infinite ease-in-out'
                    }}>
                        {/* Accent Glow */}
                        <div style={{
                            position: 'absolute', inset: -4, borderRadius: 36,
                            border: '2.5px solid #F1BFDB',
                            opacity: done ? 0 : 0.4,
                            transition: 'opacity 0.3s'
                        }} />

                        {done ? (
                            <CheckCircle size={48} color="white" />
                        ) : isStaff ? (
                            <ShieldAlert size={48} color="white" />
                        ) : (
                            <Bell size={48} color="white" />
                        )}
                    </div>

                    <h2 style={{ 
                        fontWeight: 800, fontSize: '1.6rem', 
                        marginBottom: 12, letterSpacing: '-0.02em',
                        color: '#1A2340'
                    }}>
                        {done ? 'เปิดการแจ้งเตือนสำเร็จ!' : isStaff ? 'พนักงานต้องเปิดแจ้งเตือน' : 'รับการแจ้งเตือนจาก Foami'}
                    </h2>

                    <p style={{ 
                        fontSize: '1.05rem', color: '#5A6589', 
                        lineHeight: 1.6, marginBottom: 32,
                        padding: '0 10px'
                    }}>
                        {done
                            ? 'ขอบคุณที่เปิดรับข่าวสารครับ คุณจะไม่พลาดทุกความเคลื่อนไหวจากเรา'
                            : isStaff 
                                ? 'เพื่อไม่ให้พลาดงานใหม่และการอัพเดทสถานะแบบเรียลไทม์ กรุณากดปุ่มด้านล่างครับ'
                                : 'ติดตามสถานะการล้าง รับโปรโมชั่นพิเศษ และอัพเดทก่อนใครผ่านหน้าจอคุณ'}
                    </p>

                    {/* Benefit List */}
                    {!done && (
                        <div style={{
                            width: '100%',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 12,
                            marginBottom: 36
                        }}>
                            {[
                                { icon: Truck, text: 'แจ้งรับรถ', color: '#315EC3' },
                                { icon: Droplets, text: 'เริ่มล้างรถ', color: '#A0D9F6' },
                                { icon: CheckCircle, text: 'เสร็จแล้ว', color: '#22C55E' },
                                { icon: isStaff ? Sparkles : Gift, text: isStaff ? 'อัพเดทงาน' : 'รับของขวัญ', color: '#F1BFDB' }
                            ].map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    background: '#F6F8FF',
                                    padding: '12px 16px', borderRadius: 20,
                                    fontSize: '0.9rem', fontWeight: 600, color: '#1A2340',
                                    border: '1px solid #DDE3F5',
                                    boxShadow: '0 2px 6px rgba(26, 35, 64, 0.02)'
                                }}>
                                    <item.icon size={18} color={item.color} strokeWidth={2.5} />
                                    <span>{item.text}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    {!done && (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <button
                                onClick={handleAccept}
                                disabled={loading}
                                style={{
                                    width: '100%', height: 68,
                                    background: 'linear-gradient(135deg, #315EC3, #214192)',
                                    border: 'none',
                                    borderRadius: 24,
                                    color: 'white', fontWeight: 800, fontSize: '1.2rem',
                                    cursor: 'pointer', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', gap: 12,
                                    boxShadow: '0 12px 28px rgba(49, 94, 195, 0.3)',
                                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                    opacity: loading ? 0.8 : 1
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)'
                                    e.currentTarget.style.boxShadow = '0 18px 35px rgba(49, 94, 195, 0.35)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1) translateY(0)'
                                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(49, 94, 195, 0.3)'
                                }}
                            >
                                {loading ? (
                                    <div className="spinner-white" style={{ width: 28, height: 28 }} />
                                ) : (
                                    <><Bell size={22} fill="white" /> เปิดการแจ้งเตือน</>
                                )}
                            </button>

                            {!isStaff && (
                                <button
                                    onClick={handleDismiss}
                                    style={{
                                        width: '100%', height: 56,
                                        background: 'transparent',
                                        border: '1.5px solid #DDE3F5',
                                        borderRadius: 24,
                                        color: '#5A6589', cursor: 'pointer',
                                        fontSize: '0.95rem', fontWeight: 600,
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#F6F8FF'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    ไว้วันหลัง
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes modalEntrance {
                    from { transform: translate(-50%, -40%); opacity: 0; }
                    to   { transform: translate(-50%, -50%); opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes iconPulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                .spinner-white {
                    width: 20px;
                    height: 20px;
                    border: 3px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    )
}
