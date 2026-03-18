'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './login.module.css'
import Logo from '@/components/Branding/Logo'

/**
 * GlobalLogin Page (v20 - Ultimate Simplicity)
 * Robust iPad PWA Handshake + Standard LIFF Login
 */
export default function GlobalLogin() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [syncLoading, setSyncLoading] = useState(false)
    const [error, setError] = useState('')
    const [isBridgeSuccess, setIsBridgeSuccess] = useState(false)
    const [assignedPwaBridgeId, setAssignedPwaBridgeId] = useState<string | null>(null)
    const syncLock = useRef(false)

    // Detect environment
    const isStandalone = typeof window !== 'undefined' && 
        ((window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches);
    
    const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    // ─── Phase 1: Initialize ───
    useEffect(() => {
        // Redirect if already logged in
        if (localStorage.getItem('liff_customer')) {
            router.replace('/search')
            return
        }

        // PWA Mode: Prepare Bridge ID
        if (isStandalone) {
            let pwaId = localStorage.getItem('pwa_bridge_id')
            if (!pwaId) {
                pwaId = crypto.randomUUID()
                localStorage.setItem('pwa_bridge_id', pwaId)
            }
            setAssignedPwaBridgeId(pwaId)
        }
    }, [router, isStandalone])

    // ─── Phase 2: Safari Sync Logic (Direct OAuth) ───
    const handleDirectSync = async (code: string, state: string) => {
        const processedCodes = JSON.parse(sessionStorage.getItem('processed_line_codes') || '[]')
        if (processedCodes.includes(code)) return

        if (syncLock.current) return
        syncLock.current = true
        setSyncLoading(true)

        try {
            const currentRedirectUri = `${window.location.origin}/login`
            const res = await fetch('/api/auth/bridge/sync-with-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, bridgeId: state, redirectUri: currentRedirectUri })
            })
            
            if (res.ok) {
                processedCodes.push(code)
                sessionStorage.setItem('processed_line_codes', JSON.stringify(processedCodes))
                setIsBridgeSuccess(true)
                setTimeout(() => {
                    try { window.close() } catch (e) {}
                    window.location.href = '/'
                }, 2000)
            } else {
                const result = await res.json()
                if (result.error?.includes('invalid authorization code')) {
                    processedCodes.push(code)
                    sessionStorage.setItem('processed_line_codes', JSON.stringify(processedCodes))
                }
                setError(`ข้อผิดพลาด: ${result.error || 'Sync failed'}`)
                syncLock.current = false
            }
        } catch (e) {
            setError('Network error during sync')
            syncLock.current = false
        } finally {
            setSyncLoading(false)
        }
    }

    // ─── Phase 3: PWA Polling (Wait for Safari) ───
    useEffect(() => {
        if (!isStandalone || !assignedPwaBridgeId) return
        
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/auth/bridge/status?id=${assignedPwaBridgeId}`)
                const data = await res.json()
                if (data.status === 'completed' && data.customerData) {
                    localStorage.setItem('liff_customer', JSON.stringify(data.customerData))
                    localStorage.removeItem('pwa_bridge_id')
                    clearInterval(interval)
                    router.replace('/search')
                }
            } catch (e) {}
        }, 2000)
        
        return () => clearInterval(interval)
    }, [isStandalone, assignedPwaBridgeId, router])

    // ─── Phase 4: Landing Logic (Safari Sync Start or LIFF) ───
    useEffect(() => {
        if (isStandalone) return // PWA ONLY POLLS

        const searchParams = new URLSearchParams(window.location.search)
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        
        // Return from OAuth
        if (code && state) {
            handleDirectSync(code, state)
            return
        }

        // Standard Web Mode: Init LIFF softly
        const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID
        if (!liffId || liffId.includes('your_')) return

        import('@line/liff').then(({ default: liff }) => {
            liff.init({ liffId }).catch(() => {})
        })
    }, [isStandalone])

    // ─── Event Handlers ───
    const handleLoginClick = async () => {
        setLoading(true)
        setError('')

        if (isStandalone && isIOS) {
            // PWA Breakout Mode
            const bridgeId = assignedPwaBridgeId || crypto.randomUUID()
            const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID
            const channelId = (liffId && liffId.includes('-')) ? liffId.split('-')[0] : liffId;
            const staticRedirectUri = encodeURIComponent(`${window.location.origin}/login`);
            
            const oauthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${staticRedirectUri}&state=${bridgeId}&scope=profile%20openid`;
            
            // Just open and wait
            window.open(oauthUrl, '_blank')
            return
        }

        // Standard Web Mode
        const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID
        if (!liffId) return setError('Configuration error: LIFF ID missing')

        try {
            const { default: liff } = await import('@line/liff')
            await liff.init({ liffId })
            liff.login()
        } catch (err: any) {
            setError('ไม่สามารถเชื่อมต่อ LINE ได้ กรุณาลองใหม่')
            setLoading(false)
        }
    }

    return (
        <div className={styles.page}>
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
                            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', marginBottom: 10 }}>สำเร็จ!</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>กรุณากลับไปที่แอป Foami เพื่อใช้งานต่อครับ</p>
                        </div>
                    ) : syncLoading ? (
                        <div className={styles.syncBox}>
                            <div className="spinner-blue" style={{ width: 40, height: 40, margin: '0 auto 15px' }} />
                            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.2rem' }}>กำลังซิงค์ข้อมูล...</h2>
                        </div>
                    ) : (isStandalone && assignedPwaBridgeId) ? (
                        <div className={styles.waitingBox}>
                             <div className="spinner-blue" style={{ width: 40, height: 40, margin: '0 auto 15px' }} />
                             <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>กำลังรอ Safari ล็อคอิน...</p>
                             <button 
                                className={styles.retryBtn} 
                                onClick={() => { localStorage.clear(); window.location.href = '/login' }}
                                style={{ marginTop: 20 }}
                             >
                                หรือลองใหม่
                             </button>
                        </div>
                    ) : (
                        <p className={styles.subheadline}>
                            บริการล้างรถและดูแลรักษาพรีเมียม<br />
                            จองง่าย สะดวก รวดเร็ว ถึงที่บ้านคุณ
                        </p>
                    )}
                </div>

                {/* Main Action Button */}
                {!isBridgeSuccess && !syncLoading && !(isStandalone && assignedPwaBridgeId) && (
                    <button className={styles.lineBtn} onClick={handleLoginClick} disabled={loading}>
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
