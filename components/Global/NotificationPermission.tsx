'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { usePushNotifications } from '@/lib/hooks/usePushNotifications'
import { Bell, X, Gift } from 'lucide-react'

/**
 * NotificationPermission - Floating Banner (v2)
 * Shows a slide-up bottom sheet asking user to enable push notifications.
 * - Shows on all pages after 4 seconds if not yet decided
 * - Only shows if user is logged in (liff_customer)
 * - On iOS PWA: Notification.requestPermission() must be triggered by user gesture
 *   so this banner provides that gesture-based trigger
 * - Permanently dismissed with localStorage flag
 */
export default function NotificationPermission() {
    const pathname = usePathname()
    const [userId, setUserId] = useState<string | undefined>(undefined)
    const [platform, setPlatform] = useState<'customer' | 'staff' | 'admin'>('customer')
    const [show, setShow] = useState(false)
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)

    const scope = platform === 'admin' ? '/admin/' : platform === 'staff' ? '/staff/' : '/'
    const { subscribe, isSubscribed } = usePushNotifications(userId, platform, scope)

    // Detect current user type
    useEffect(() => {
        const staff = localStorage.getItem('staff_data')
        const admin = localStorage.getItem('admin_token')
        const customer = localStorage.getItem('liff_customer')

        if (admin) {
            setUserId('admin_user')
            setPlatform('admin')
        } else if (staff) {
            try { const s = JSON.parse(staff); setUserId(s.id); setPlatform('staff') } catch {}
        } else if (customer) {
            try { const c = JSON.parse(customer); setUserId(c.id); setPlatform('customer') } catch {}
        } else {
            setUserId(undefined)
        }
    }, [pathname])

    // Decide whether to show the banner
    useEffect(() => {
        if (!userId) return
        if (typeof window === 'undefined') return
        if (!('Notification' in window)) return
        if (!('serviceWorker' in navigator)) return

        // Already decided → don't show
        const dismissed = localStorage.getItem('foami_notif_dismissed')
        const requested = localStorage.getItem('foami_notif_requested')
        if (dismissed || requested) return

        // Already granted or denied → no need to ask
        if (Notification.permission !== 'default') return

        // Show banner after 4 seconds
        const timer = setTimeout(() => setShow(true), 4000)
        return () => clearTimeout(timer)
    }, [userId])

    // Hide if already subscribed
    useEffect(() => {
        if (isSubscribed) setShow(false)
    }, [isSubscribed])

    const handleAccept = async () => {
        setLoading(true)
        try {
            // This is the user gesture needed for iOS PWA to allow permission request
            const permission = await Notification.requestPermission()
            localStorage.setItem('foami_notif_requested', 'true')

            if (permission === 'granted' && userId) {
                await subscribe()
                setDone(true)
                setTimeout(() => setShow(false), 2000)
            } else {
                // Denied — don't show again
                localStorage.setItem('foami_notif_dismissed', 'true')
                setShow(false)
            }
        } catch (e) {
            console.error('Notification permission error:', e)
            setShow(false)
        } finally {
            setLoading(false)
        }
    }

    const handleDismiss = () => {
        localStorage.setItem('foami_notif_dismissed', 'true')
        setShow(false)
    }

    if (!show) return null

    return (
        <>
            {/* Backdrop (subtle) */}
            <div
                onClick={handleDismiss}
                style={{
                    position: 'fixed', inset: 0, zIndex: 9990,
                    background: 'rgba(26, 35, 64, 0.15)',
                    backdropFilter: 'blur(2px)',
                    animation: 'fadeIn 0.3s ease'
                }}
            />

            {/* Floating Banner */}
            <div style={{
                position: 'fixed',
                bottom: 0, left: 0, right: 0,
                zIndex: 9999,
                padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
                animation: 'slideUpBanner 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #1A2340 0%, #2D3E7A 100%)',
                    borderRadius: 24,
                    padding: '20px 20px 20px',
                    boxShadow: '0 -4px 40px rgba(26, 35, 64, 0.2), 0 8px 32px rgba(49, 94, 195, 0.3)',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    maxWidth: 480,
                    margin: '0 auto',
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        {/* Icon */}
                        <div style={{
                            width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                            background: 'linear-gradient(135deg, #06C755 0%, #04a845 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 16px rgba(6, 199, 85, 0.4)'
                        }}>
                            {done ? (
                                <span style={{ fontSize: 26 }}>✅</span>
                            ) : (
                                <Bell size={26} strokeWidth={2} color="white" />
                            )}
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 4 }}>
                                {done ? 'เปิดแจ้งเตือนสำเร็จ! 🎉' : 'รับแจ้งเตือนจาก Foami'}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                                {done
                                    ? 'คุณจะไม่พลาดทุกสถานะการล้างรถของคุณแล้วครับ'
                                    : 'รับโปรโมชั่น ติดตามสถานะล้างรถ และอัพเดทจาก Foami แบบเรียลไทม์'}
                            </div>
                        </div>

                        {!done && (
                            <button
                                onClick={handleDismiss}
                                style={{
                                    background: 'rgba(255,255,255,0.1)', border: 'none',
                                    borderRadius: 10, padding: 8, color: 'rgba(255,255,255,0.6)',
                                    cursor: 'pointer', flexShrink: 0, display: 'flex'
                                }}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Benefits */}
                    {!done && (
                        <div style={{
                            display: 'flex', gap: 8, flexWrap: 'wrap'
                        }}>
                            {['🛵 แจ้งรับรถ', '🫧 เริ่มล้างรถ', '✅ ล้างเสร็จแล้ว', '🎁 โปรโมชั่น'].map(item => (
                                <span key={item} style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    borderRadius: 20, padding: '4px 10px',
                                    fontSize: '0.75rem', fontWeight: 600,
                                    color: 'rgba(255,255,255,0.85)'
                                }}>{item}</span>
                            ))}
                        </div>
                    )}

                    {/* Buttons */}
                    {!done && (
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={handleAccept}
                                disabled={loading}
                                style={{
                                    flex: 1, height: 50,
                                    background: 'linear-gradient(135deg, #06C755, #04a845)',
                                    border: 'none', borderRadius: 14,
                                    color: 'white', fontWeight: 800, fontSize: '0.95rem',
                                    cursor: 'pointer', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', gap: 6,
                                    boxShadow: '0 4px 20px rgba(6, 199, 85, 0.35)',
                                    fontFamily: 'var(--font-main)',
                                    opacity: loading ? 0.8 : 1,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {loading ? (
                                    <div style={{
                                        width: 20, height: 20, border: '2.5px solid rgba(255,255,255,0.3)',
                                        borderTopColor: 'white', borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite'
                                    }} />
                                ) : (
                                    <><Bell size={18} /> เปิดแจ้งเตือน</>
                                )}
                            </button>
                            <button
                                onClick={handleDismiss}
                                style={{
                                    width: 50, height: 50,
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none', borderRadius: 14,
                                    color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                                    fontFamily: 'var(--font-main)', fontSize: '0.8rem', fontWeight: 600
                                }}
                            >
                                ไว้ก่อน
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes slideUpBanner {
                    from { transform: translateY(100%); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
            `}</style>
        </>
    )
}
