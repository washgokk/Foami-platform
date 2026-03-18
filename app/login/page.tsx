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
    const [syncLoading, setSyncLoading] = useState(false)
    const [error, setError] = useState('')
    const [isBridgeSuccess, setIsBridgeSuccess] = useState(false)
    const [debugInfo, setDebugInfo] = useState('')

    // Detect standalone mode (PWA)
    const isStandalone = typeof window !== 'undefined' && 
        ((window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches);

    // ─── Phase 1: Check existing session ───
    useEffect(() => {
        const stored = localStorage.getItem('liff_customer')
        if (stored) {
            router.replace('/search')
            return
        }

        const searchParams = new URLSearchParams(window.location.search)
        const bridgeIdParam = searchParams.get('bridgeId')
        
        // --- Persistence for Safari-side bridge ---
        // If we are in Safari (not PWA) and entered with a bridgeId, save it.
        // This is crucial because LINE might strip URL params during redirect.
        if (bridgeIdParam && !isStandalone) {
            localStorage.setItem('safari_bridge_id', bridgeIdParam)
        }
        const activeSafariBridgeId = bridgeIdParam || localStorage.getItem('safari_bridge_id')

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
                    if (activeSafariBridgeId) {
                        try {
                            console.log('--- Bridge Sync Debug ---')
                            console.log('Bridge ID Found:', activeSafariBridgeId)
                            console.log('Customer Data ready for sync')
                            
                            setSyncLoading(true)
                            
                            // Retry logic (up to 3 times)
                            let success = false;
                            for (let i = 0; i < 3; i++) {
                                try {
                                    console.log(`Sync attempt ${i+1}...`)
                                    const res = await fetch('/api/auth/bridge/sync', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ bridgeId: activeSafariBridgeId, customerData })
                                    })
                                    
                                    if (res.ok) {
                                        console.log('Sync Successful on attempt', i+1)
                                        success = true;
                                        break;
                                    } else {
                                        const errData = await res.json()
                                        console.error('Sync Attempt Failed:', errData)
                                        if (i === 2) setError(`การเชื่อมต่อล้มเหลว: ${errData.error || 'ถอดรหัสล้มเหลว'}`)
                                    }
                                } catch (e) {
                                    console.warn(`Attempt ${i+1} exception:`, e)
                                    if (i === 2) throw e;
                                    await new Promise(r => setTimeout(r, 1000));
                                }
                            }

                            if (success) {
                                setIsBridgeSuccess(true)
                                localStorage.removeItem('safari_bridge_id')
                                
                                // AUTO-JUMP
                                setTimeout(() => {
                                    try { window.close(); } catch (e) {}
                                    window.location.href = '/';
                                }, 1500);
                            }
                        } catch (e: any) { 
                            console.error('Final bridge sync error:', e)
                            setError(`เกิดข้อผิดพลาดในการเชื่อมต่อ: ${e.message}`)
                        } finally {
                            setSyncLoading(false)
                        }
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

    // --- iPad/iOS PWA Specific ---
    const [iosPwaBridgeUrl, setIosPwaBridgeUrl] = useState<string | null>(null);
    const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    useEffect(() => {
        if (isIOS && isStandalone) {
            const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID;
            
            // Pre-generate a bridge ID
            const bridgeId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
                ? crypto.randomUUID() 
                : Math.random().toString(36).substring(2) + Date.now().toString(36);
            
            if (liffId && liffId !== 'your_liff_id') {
                // Using liff.line.me domain FORCES Safari to open because it's an external domain
                setIosPwaBridgeUrl(`https://liff.line.me/${liffId}?bridgeId=${bridgeId}`);
                console.log('iPad Breakout URL (External):', `https://liff.line.me/${liffId}?bridgeId=${bridgeId}`);
            } else {
                // Fallback to internal if no LIFF ID
                setIosPwaBridgeUrl(`${window.location.origin}/login?bridgeId=${bridgeId}`);
            }
            setDebugInfo(`Prepared Bridge ID: ${bridgeId}`);
        }
    }, [isIOS, isStandalone]);

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
            await new Promise(r => setTimeout(r, 800))
            const mockId = 'mock_user_123' 
            localStorage.setItem('liff_line_user_id', mockId)
            localStorage.setItem('liff_display_name', 'Mock User')

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

        // ─── Real LIFF Mode ───
        try {
            const { default: liff } = await import('@line/liff')
            await liff.init({ liffId })

            if (!liff.isLoggedIn()) {
                liff.login()
                return 
            }

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
                    ) : syncLoading ? (
                        <div className={styles.syncBox}>
                            <div className="spinner-blue" style={{ width: 40, height: 40, margin: '0 auto 15px' }} />
                            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.3rem', marginBottom: 10 }}>กำลังซิงค์ข้อมูลกับแอป...</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>กรุณารอสักครู่ครับ</p>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: 15 }}>
                                [Debug ID: {typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('bridgeId') || localStorage.getItem('safari_bridge_id')) : ''}]
                            </p>
                        </div>
                    ) : (typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('pwaBridgeId') || localStorage.getItem('pwa_bridge_id'))) ? (
                         <div className={styles.waitingBox}>
                            <div className="spinner-blue" style={{ width: 40, height: 40, margin: '0 auto 15px' }} />
                            <p style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600 }}>กำลังรอการเข้าสู่ระบบ...</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: 20 }}>กรุณาเข้าสู่ระบบใน Safari ที่เปิดขึ้นมา</p>
                            
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginBottom: 15 }}>
                                [Session ID: {typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('pwaBridgeId') || localStorage.getItem('pwa_bridge_id')) : ''}]
                            </p>
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
                    iosPwaBridgeUrl ? (
                        <a 
                            href={iosPwaBridgeUrl}
                            target="_blank" 
                            className={styles.lineBtn}
                            onClick={() => {
                                // Extract bridgeId from url to set polling state
                                // The ID is in the query param of the LIFF URL or internal URL
                                const url = new URL(iosPwaBridgeUrl);
                                const bId = url.searchParams.get('bridgeId');
                                if (bId) {
                                    localStorage.setItem('pwa_bridge_id', bId);
                                    // Set loading to true locally to show spinner/waiting UI immediately
                                    setLoading(true); 
                                    const nextUrl = new URL(window.location.href);
                                    nextUrl.searchParams.set('pwaBridgeId', bId);
                                    window.history.replaceState({}, '', nextUrl.toString());
                                }
                            }}
                        >
                            <div className={styles.lineIconWrapper}>
                                <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" alt="LINE" className={styles.lineIcon} />
                            </div>
                            <span>เข้าสู่ระบบด้วย LINE</span>
                        </a>
                    ) : (
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
                    )
                )}

                {error && <div className={styles.errorBox}>{error}</div>}

                <p className={styles.footerHint}>
                    การล็อคอินหมายถึงคุณยอมรับข้อตกลงการใช้งาน
                </p>
            </div>
        </div>
    )
}
