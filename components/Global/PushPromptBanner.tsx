'use client'
import { useState, useEffect } from 'react'
import { Bell, X, Gift, Wrench } from 'lucide-react'
import { usePushNotifications } from '@/lib/hooks/usePushNotifications'

interface PushPromptBannerProps {
    userId?: string
    platform?: 'customer' | 'staff' | 'admin'
}

const DISMISS_KEY = 'push_prompt_dismissed_at'
const DISMISS_DAYS = 7 // Show again after 7 days if dismissed

export default function PushPromptBanner({ userId, platform = 'customer' }: PushPromptBannerProps) {
    const [visible, setVisible] = useState(false)
    const [success, setSuccess] = useState(false)
    const { subscribe, isSubscribed, loading } = usePushNotifications(userId, platform)

    useEffect(() => {
        if (!userId) return
        if (isSubscribed) return // Already subscribed, no need to show

        // Check if Push API is supported
        if (!('Notification' in window) || !('serviceWorker' in navigator)) return

        // Check if permission already granted/denied
        if (Notification.permission === 'denied') return

        // Check if already subscribed (Notification.permission === granted)
        if (Notification.permission === 'granted') return

        // Check dismiss cooldown
        const dismissedAt = localStorage.getItem(DISMISS_KEY)
        if (dismissedAt) {
            const daysSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24)
            if (daysSince < DISMISS_DAYS) return
        }

        // Delay slightly for UX (don't show immediately on page load)
        const timer = setTimeout(() => setVisible(true), 2500)
        return () => clearTimeout(timer)
    }, [userId, isSubscribed])

    const handleDismiss = () => {
        localStorage.setItem(DISMISS_KEY, Date.now().toString())
        setVisible(false)
    }

    const handleEnable = async () => {
        const ok = await subscribe(() => setSuccess(true))
        if (ok) {
            setSuccess(true)
            setTimeout(() => setVisible(false), 2000)
        }
    }

    if (!visible) return null

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={handleDismiss}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(26,35,64,0.4)',
                    zIndex: 998, backdropFilter: 'blur(4px)',
                    animation: 'fadeIn 0.3s ease'
                }}
            />

            {/* Banner */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                background: '#fff', borderRadius: '28px 28px 0 0',
                padding: '28px 24px 40px',
                zIndex: 999,
                boxShadow: '0 -8px 40px rgba(26,35,64,0.15)',
                animation: 'slideUpSheet 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                maxWidth: 520, margin: '0 auto',
            }}>
                {/* Drag Handle */}
                <div style={{
                    width: 40, height: 4, background: 'var(--border)',
                    borderRadius: 999, margin: '0 auto 24px'
                }} />

                {/* Dismiss */}
                <button
                    onClick={handleDismiss}
                    style={{
                        position: 'absolute', top: 20, right: 20,
                        background: 'var(--surface-2)', border: 'none',
                        borderRadius: '50%', width: 32, height: 32,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--text-muted)'
                    }}
                >
                    <X size={16} />
                </button>

                {success ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
                        <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: 6 }}>
                            เปิดการแจ้งเตือนแล้ว!
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            คุณจะไม่พลาดโปรโมชั่นและสถานะงานครับ
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Icon */}
                        <div style={{
                            width: 64, height: 64,
                            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
                            borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: 20, boxShadow: '0 8px 20px rgba(49,94,195,0.25)'
                        }}>
                            <Bell size={30} color="#fff" />
                        </div>

                        <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: 8 }}>
                            เปิดการแจ้งเตือนเลยไหม?
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
                            รับแจ้งเตือนเมื่อพนักงานรับงาน ล้างรถเสร็จ และโปรโมชั่นพิเศษจาก Foami ก่อนใคร!
                        </div>

                        {/* Benefits */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                            {[
                                { icon: Wrench, text: 'แจ้งเตือนสถานะงานล้างรถแบบ Real-time' },
                                { icon: Gift, text: 'รับโปรโมชั่นและส่วนลดพิเศษก่อนใคร' },
                                { icon: Bell, text: 'แจ้งเตือนเมื่อมีการจองสำเร็จ' },
                            ].map(({ icon: Icon, text }) => (
                                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 12,
                                        background: 'var(--primary-ghost)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <Icon size={16} color="var(--primary)" />
                                    </div>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{text}</span>
                                </div>
                            ))}
                        </div>

                        {/* CTA */}
                        <button
                            onClick={handleEnable}
                            disabled={loading}
                            style={{
                                width: '100%', height: 56, border: 'none', borderRadius: 18,
                                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
                                color: '#fff', fontWeight: 800, fontSize: '1rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                                boxShadow: '0 8px 24px rgba(49,94,195,0.3)',
                                marginBottom: 10, fontFamily: 'var(--font-main)'
                            }}
                        >
                            {loading ? (
                                <div className="spinner" style={{ width: 22, height: 22, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
                            ) : (
                                <><Bell size={20} /> เปิดการแจ้งเตือน</>
                            )}
                        </button>

                        <button
                            onClick={handleDismiss}
                            style={{
                                width: '100%', background: 'none', border: 'none',
                                color: 'var(--text-muted)', fontSize: '0.85rem',
                                fontWeight: 600, padding: '8px', cursor: 'pointer',
                                fontFamily: 'var(--font-main)'
                            }}
                        >
                            ไม่ขอบคุณ
                        </button>
                    </>
                )}
            </div>

            <style>{`
                @keyframes slideUpSheet {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            `}</style>
        </>
    )
}
