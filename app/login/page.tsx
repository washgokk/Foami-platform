'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './login.module.css'
import Logo from '@/components/Branding/Logo'

/**
 * GlobalLogin Page
 * Renders a premium welcome screen with a "Login with LINE" button.
 * Authenticaton is only triggered upon user interaction.
 */
export default function GlobalLogin() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [isBridgeSuccess, setIsBridgeSuccess] = useState(false)

    // ─── Phase 1: Check existing session ───
    useEffect(() => {
        const stored = localStorage.getItem('liff_customer')
        if (stored) {
            router.replace('/search')
            return
        }

        const searchParams = new URLSearchParams(window.location.search)
        const bridgeIdParam = searchParams.get('bridgeId')

        // ─── Phase 2: Auto-init LIFF to handle returning from redirect ───
        const autoInit = async () => {
            const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID
            if (!liffId || liffId === 'your_liff_id' || liffId === '') return
            
            try {
                const { default: liff } = await import('@line/liff')
                await liff.init({ liffId })
                
                if (liff.isLoggedIn()) {
                    console.log('User is logged in via LINE. Fetching profile...')
                    const profile = await liff.getProfile()
                    localStorage.setItem('liff_line_user_id', profile.userId)
                    localStorage.setItem('liff_display_name', profile.displayName)

                    const { data } = await supabase
                        .from('customers')
                        .select('*')
                        .eq('line_user_id', profile.userId)
                        .single()

                    const customerData = data || { line_user_id: profile.userId, full_name: profile.displayName };

                    // IF returned with bridgeId, sync to backend and show success
                    if (bridgeIdParam) {
                        try {
                            await fetch('/api/auth/bridge/sync', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ bridgeId: bridgeIdParam, customerData })
                            })
                            setIsBridgeSuccess(true)
                        } catch (e) { console.error('Bridge sync error:', e) }
                    }

                    if (data) {
                        localStorage.setItem('liff_customer', JSON.stringify(data))
                        // Only redirect if NOT in bridge mode (or if we want to also close Safari)
                        if (!bridgeIdParam) router.replace('/search')
                    } else {
                        if (!bridgeIdParam) router.replace('/register')
                    }
                }
            } catch (err) {
                console.error('LIFF Auto-init Error:', err)
            }
        }

        autoInit()
    }, [router])

    // ─── Phase 3: PWA Polling (for iOS) ───
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        const urlId = searchParams.get('pwaBridgeId')
        const storageId = localStorage.getItem('pwa_bridge_id')
        const activeBridgeId = urlId || storageId
        
        if (!activeBridgeId) return

        // If we have it in URL but not storage, sync it
        if (urlId && !storageId) localStorage.setItem('pwa_bridge_id', urlId)

        let pollInterval: any = setInterval(async () => {
            try {
                const res = await fetch(`/api/auth/bridge/status?id=${activeBridgeId}`)
                const result = await res.json()
                if (result.status === 'completed' && result.customerData) {
                    clearInterval(pollInterval)
                    localStorage.removeItem('pwa_bridge_id')
                    localStorage.setItem('liff_customer', JSON.stringify(result.customerData))
                    localStorage.setItem('liff_line_user_id', result.customerData.line_user_id)
                    router.replace('/search')
                }
            } catch (e) {
                console.error('Polling error:', e)
            }
        }, 2000)

        return () => clearInterval(pollInterval)
    }, [router])

    const handleLineLogin = async () => {
        setLoading(true)
        setError('')

        const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID

        // ─── Development Mock Mode ───
        const isProd = process.env.NODE_ENV === 'production'
        const isMockForced = typeof window !== 'undefined' && localStorage.getItem('foami_mock_db_enabled') === 'true'

        if (!liffId || liffId === 'your_liff_id' || liffId === '') {
            if (isProd && !isMockForced) {
                setError('ระบบขัดข้อง: ไม่พบการตั้งค่า LINE Login กรุณาติดต่อผู้ดูแลระบบ')
                setLoading(false)
                return
            }
            console.log('LIFF ID not found. Using Mock Login...')
            // Simulate delay
            await new Promise(r => setTimeout(r, 800))
            
            // Use a stable mock ID so developer can test 'Existing User' flow too
            const mockId = 'mock_user_123' 
            localStorage.setItem('liff_line_user_id', mockId)
            localStorage.setItem('liff_display_name', 'Mock User')

            // Check if mock user in DB
            const { data } = await supabase.from('customers').select('*').eq('line_user_id', mockId).single()
            if (data) {
                localStorage.setItem('liff_customer', JSON.stringify(data))
                router.replace('/search')
            } else {
                router.replace('/register')
            }
            setLoading(false)
            return
        }

        // Detect iOS PWA session isolation
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
        
        if (isIOS && isStandalone) {
            console.log('iOS PWA detected. Using Bridge Login...')
            const bridgeId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
                ? crypto.randomUUID() 
                : Math.random().toString(36).substring(2) + Date.now().toString(36);
                
            const loginUrl = `${window.location.origin}/login?bridgeId=${bridgeId}`;
            
            // Set polling state in URL and localStorage for persistence
            localStorage.setItem('pwa_bridge_id', bridgeId);
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('pwaBridgeId', bridgeId);
            window.history.replaceState({}, '', newUrl.toString());
            
            // Open Safari for login
            window.open(loginUrl, '_blank');
            setLoading(false); 
            return;
        }

        // ─── Real LIFF Mode ───
        try {
            const { default: liff } = await import('@line/liff')
            // Note: liff.init might have already run in useEffect, but calling it again is safe or cached
            await liff.init({ liffId })

            if (!liff.isLoggedIn()) {
                liff.login()
                return // Page will redirect
            }

            // If already logged in here (e.g. click after auto-init finished)
            const profile = await liff.getProfile()
            localStorage.setItem('liff_line_user_id', profile.userId)
            localStorage.setItem('liff_display_name', profile.displayName)

            const { data } = await supabase
                .from('customers')
                .select('*')
                .eq('line_user_id', profile.userId)
                .single()

            if (data) {
                localStorage.setItem('liff_customer', JSON.stringify(data))
                router.replace('/search')
            } else {
                router.replace('/register')
            }
        } catch (err: any) {
            console.error('LIFF Login Error:', err)
            setError('ไม่สามารถเชื่อมต่อกับ LINE ได้ในขณะนี้ กรุณาลองใหม่ภายหลัง')
            setLoading(false)
        }
    }

    return (
        <div className={styles.page}>
            {/* Background Glows */}
            <div className={styles.bgGlow}>
                <div className={styles.glow1} />
                <div className={styles.glow2} />
            </div>

            <div className={styles.content}>
                <div className={styles.logoBox}>
                    <Logo width={180} />
                </div>

                <div className={styles.welcomeSection}>
                    <h1 className={styles.headline}>ยินดีต้อนรับสู่ Foami</h1>
                    {isBridgeSuccess ? (
                        <div className={styles.successBox}>
                            <div className={styles.checkIcon}>✅</div>
                            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', marginBottom: 10 }}>เข้าสู่ระบบสำเร็จ!</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>กรุณากลับไปที่แอป Foami เพื่อใช้งานต่อครับ</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 20 }}>คุณสามารถปิดหน้านี้ได้ทันที</p>
                        </div>
                    ) : (typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('pwaBridgeId') || localStorage.getItem('pwa_bridge_id'))) ? (
                         <div className={styles.waitingBox}>
                            <div className="spinner-blue" style={{ width: 40, height: 40, margin: '0 auto 15px' }} />
                            <p style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600 }}>กำลังรอการเข้าสู่ระบบ...</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 10 }}>กรุณาเข้าสู่ระบบใน Safari ที่เปิดขึ้นมา</p>
                            <button 
                                className={styles.retryBtn} 
                                onClick={() => {
                                    localStorage.removeItem('pwa_bridge_id');
                                    const url = new URL(window.location.href);
                                    url.searchParams.delete('pwaBridgeId');
                                    window.location.href = url.toString();
                                }}
                                style={{ marginTop: 20 }}
                            >
                                ยกเลิกและลองใหม่
                            </button>
                         </div>
                    ) : (
                        <p className={styles.subheadline}>
                            บริการล้างรถและดูแลรักษาพรีเมียม<br />
                            จองง่าย สะดวก รวดเร็ว ถึงที่บ้านคุณ
                        </p>
                    )}
                </div>

                {!(typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('pwaBridgeId') || localStorage.getItem('pwa_bridge_id'))) && (
                    <button 
                        className={styles.lineBtn} 
                        onClick={handleLineLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="spinner-white" style={{ width: 24, height: 24 }} />
                        ) : (
                            <>
                                <div className={styles.lineIconWrapper}>
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" alt="LINE" className={styles.lineIcon} />
                                </div>
                                <span>เข้าสู่ระบบด้วย LINE</span>
                            </>
                        )}
                    </button>
                )}

                {error && <div className={styles.errorBox}>{error}</div>}

                <p className={styles.footerHint}>
                    การล็อคอินหมายถึงคุณยอมรับข้อตกลงการใช้งาน
                </p>
            </div>
        </div>
    )
}
