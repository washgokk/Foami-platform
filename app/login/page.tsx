'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './login.module.css'
import Logo from '@/components/Branding/Logo'

/**
 * GlobalLogin Page - v43 Clean Rewrite
 *
 * State Machine: idle → syncing → success/error
 *                idle → waiting_safari (iPad PWA only)
 *
 * 4 Exclusive Cases (detected once on mount):
 *   A. Session exists        → resolveAndRedirect() immediately
 *   B. code + UUID state     → handleBridgeSync() [iPad PWA returning from Safari]
 *   C. code + non-UUID state → handleLIFFReturn() [Chrome/Safari LIFF flow]
 *   D. Fresh page            → show login button
 */

const LIFF_ID = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID || ''

/** Bridge IDs we generate are always UUIDs. LIFF's own state is never a UUID. */
const isUUID = (s: string | null | undefined) =>
    !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

type Phase = 'idle' | 'syncing' | 'waiting_safari' | 'success' | 'error'

export default function LoginPage() {
    const router = useRouter()
    const didInit = useRef(false)

    const [phase, setPhase] = useState<Phase>('idle')
    const [errorMsg, setErrorMsg] = useState('')
    const [iosBridgeUrl, setIosBridgeUrl] = useState<string | null>(null)

    // Environment detection (safe on SSR)
    const isStandalone = typeof window !== 'undefined' &&
        ((window.navigator as any).standalone === true ||
            window.matchMedia('(display-mode: standalone)').matches)
    const isIOS = typeof navigator !== 'undefined' &&
        (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    const isIOSPWA = isIOS && isStandalone

    // ─── Central Redirect ───
    const resolveAndRedirect = (data: any) => {
        if (data) {
            localStorage.setItem('liff_customer', JSON.stringify(data))
            localStorage.setItem('liff_line_user_id', data.line_user_id || '')
        }
        const branch = data?.last_branch_slug || localStorage.getItem('last_branch_slug')
        router.replace(branch ? `/${branch}/menu` : '/search')
    }

    // ─── Case B: Bridge Sync (iPad PWA Safari OAuth return) ───
    const handleBridgeSync = async (code: string, bridgeId: string) => {
        setPhase('syncing')
        try {
            const res = await fetch('/api/auth/bridge/sync-with-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    bridgeId,
                    redirectUri: `${window.location.origin}/login`
                })
            })
            const result = await res.json()
            if (res.ok && result.customerData) {
                setPhase('success')
                // Try to close Safari tab (iOS PWA opened this as a breakout)
                setTimeout(() => { try { window.close() } catch { } }, 800)
                // Fallback redirect if tab doesn't close (desktop or main tab)
                setTimeout(() => resolveAndRedirect(result.customerData), 1500)
            } else {
                setPhase('error')
                setErrorMsg(result.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
            }
        } catch {
            setPhase('error')
            setErrorMsg('ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่')
        }
    }

    // ─── Case C: LIFF Return (Chrome / Safari / Android PWA) ───
    const handleLIFFReturn = async () => {
        setPhase('syncing')
        try {
            const { default: liff } = await import('@line/liff')
            await liff.init({ liffId: LIFF_ID })
            if (!liff.isLoggedIn()) { setPhase('idle'); return }

            const profile = await liff.getProfile()
            localStorage.setItem('liff_line_user_id', profile.userId)
            localStorage.setItem('liff_display_name', profile.displayName)

            const { data } = await supabase
                .from('customers').select('*')
                .eq('line_user_id', profile.userId).maybeSingle()

            if (data) resolveAndRedirect(data)
            else router.replace('/register')
        } catch (e: any) {
            console.error('[Login] LIFF return error:', e)
            setPhase('idle')
        }
    }

    // ─── Phase Detection (runs ONCE on mount) ───
    useEffect(() => {
        if (didInit.current) return
        didInit.current = true

        // Case A: Already has session
        const stored = localStorage.getItem('liff_customer')
        if (stored) {
            try { resolveAndRedirect(JSON.parse(stored)) } catch { router.replace('/search') }
            return
        }

        const sp = new URLSearchParams(window.location.search)
        const code = sp.get('code')
        const state = sp.get('state')
        const branch = sp.get('branch')
        const pwaBridgeId = sp.get('pwaBridgeId') || localStorage.getItem('pwa_bridge_id')

        if (branch) localStorage.setItem('last_branch_slug', branch)

        // Case B: iOS PWA breakout returning (code + UUID state = our bridgeId)
        if (code && isUUID(state) && !isStandalone) {
            handleBridgeSync(code, state!)
            return
        }

        // Case C: LIFF returning (code + non-UUID state = LIFF's own state)
        if (code && state && !isUUID(state) && !isStandalone) {
            handleLIFFReturn()
            return
        }

        // Case D-wait: iOS PWA already opened Safari, now back in PWA waiting
        if (isIOSPWA && pwaBridgeId) {
            setPhase('waiting_safari')
            return
        }

        // Case D-fresh: Show login button
        // For iOS PWA: pre-generate the OAuth breakout URL
        if (isIOSPWA && LIFF_ID) {
            const channelId = LIFF_ID.includes('-') ? LIFF_ID.split('-')[0] : LIFF_ID
            const bridgeId = crypto.randomUUID()
            const redirectUri = encodeURIComponent(`${window.location.origin}/login`)
            const url = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${redirectUri}&state=${bridgeId}&scope=profile%20openid`
            localStorage.setItem('pwa_bridge_id', bridgeId)
            setIosBridgeUrl(url)
        }
        // Non-iOS: just show button (handleNormalLogin uses LIFF SDK)
    }, [])

    // ─── PWA Polling: Only active in waiting_safari phase ───
    useEffect(() => {
        if (phase !== 'waiting_safari') return
        const bridgeId = new URLSearchParams(window.location.search).get('pwaBridgeId')
            || localStorage.getItem('pwa_bridge_id')
        if (!bridgeId) return

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/auth/bridge/status?id=${bridgeId}`)
                const result = await res.json()
                if (result.status === 'completed' && result.customerData) {
                    clearInterval(interval)
                    localStorage.removeItem('pwa_bridge_id')
                    resolveAndRedirect(result.customerData)
                }
            } catch { }
        }, 2000)

        return () => clearInterval(interval)
    }, [phase])

    // ─── Button Handlers ───
    const handleNormalLogin = async () => {
        setPhase('syncing')
        setErrorMsg('')
        try {
            const { default: liff } = await import('@line/liff')
            await liff.init({ liffId: LIFF_ID })
            if (!liff.isLoggedIn()) {
                liff.login() // in-tab redirect → page reloads with code+state (Case C)
                return
            }
            // Edge case: LIFF session still active, no redirect needed
            const profile = await liff.getProfile()
            const { data } = await supabase.from('customers').select('*')
                .eq('line_user_id', profile.userId).maybeSingle()
            if (data) resolveAndRedirect(data)
            else router.replace('/register')
        } catch (e: any) {
            console.error('[Login] Button error:', e)
            setPhase('error')
            setErrorMsg('ไม่สามารถเชื่อมต่อกับ LINE ได้ กรุณาลองใหม่')
        }
    }

    const handleIOSPWALogin = () => {
        if (!iosBridgeUrl) return
        const bridgeId = localStorage.getItem('pwa_bridge_id') || ''
        // Stamp URL so if user returns to this tab before PWA polling kicks in
        // the page knows to go into waiting_safari state
        const next = new URL(window.location.href)
        next.searchParams.set('pwaBridgeId', bridgeId)
        window.history.replaceState({}, '', next.toString())
        setPhase('waiting_safari')
        window.location.href = iosBridgeUrl // Jump to Safari
    }

    const showButton = phase === 'idle' || phase === 'error'

    // ─── Render ───
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

                    {phase === 'syncing' && (
                        <div className={styles.syncBox}>
                            <div className="spinner-blue" style={{ width: 40, height: 40, margin: '0 auto 15px' }} />
                            <p style={{ color: 'var(--text-secondary)' }}>กำลังเข้าสู่ระบบ...</p>
                        </div>
                    )}

                    {phase === 'success' && (
                        <div className={styles.successBox}>
                            <div className="spinner-blue" style={{ width: 40, height: 40, margin: '0 auto 15px' }} />
                            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.3rem', marginBottom: 10 }}>เข้าสู่ระบบสำเร็จ!</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>กำลังพาคุณไปยังหน้าหลัก...</p>
                        </div>
                    )}

                    {phase === 'waiting_safari' && (
                        <div className={styles.waitingBox}>
                            <div className="spinner-blue" style={{ width: 40, height: 40, margin: '0 auto 15px' }} />
                            <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.1rem' }}>กำลังรอการเข้าสู่ระบบ...</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: 20 }}>กรุณาเข้าสู่ระบบใน Safari ที่เปิดขึ้นมา</p>
                            <button className={styles.retryBtn} onClick={() => {
                                localStorage.removeItem('pwa_bridge_id')
                                window.location.href = '/login'
                            }}>ยกเลิกและลองใหม่</button>
                        </div>
                    )}

                    {phase === 'idle' && (
                        <p className={styles.subheadline}>
                            บริการล้างรถและดูแลรักษาพรีเมียม<br />
                            จองง่าย สะดวก รวดเร็ว ถึงที่บ้านคุณ
                        </p>
                    )}
                </div>

                {showButton && (
                    <button
                        className={styles.lineBtn}
                        onClick={isIOSPWA ? handleIOSPWALogin : handleNormalLogin}
                    >
                        <div className={styles.lineIconWrapper}>
                            <img
                                src="https://cdnjs.cloudflare.com/ajax/libs/simple-icons/11.10.0/line.svg"
                                alt="LINE Login"
                                className={styles.lineIcon}
                            />
                        </div>
                        <span>เข้าสู่ระบบด้วย LINE</span>
                    </button>
                )}

                {errorMsg && <div className={styles.errorBox}>{errorMsg}</div>}

                <p className={styles.footerHint}>
                    การล็อคอินหมายถึงคุณยอมรับข้อตกลงการใช้งาน
                </p>
            </div>
        </div>
    )
}
