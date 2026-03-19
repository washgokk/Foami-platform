'use client'
import { useState, useEffect, useRef } from 'react'
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

    // Logging for iPad Debugging
    const [syncStatus, setSyncStatus] = useState<'initial' | 'init_liff' | 'liff_done' | 'fetching_profile' | 'syncing' | 'completed' | 'error'>('initial')
    const [syncLogs, setSyncLogs] = useState<string[]>([])
    const syncLock = useRef(false)

    const addLog = (msg: string) => {
        console.log(`[Handshake] ${msg}`)
        setSyncLogs(prev => [...prev.slice(-3), `${new Date().toLocaleTimeString()}: ${msg}`])
    }

    // Detect standalone mode (PWA)
    const isStandalone = typeof window !== 'undefined' &&
        ((window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches);

    // Detect active bridge for Safari-side (syncing phase)
    const activeSafariBridgeId = typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('bridgeId') ||
            new URLSearchParams(window.location.search).get('state') ||
            new URLSearchParams(window.location.hash.slice(1)).get('bridgeId') ||
            localStorage.getItem('safari_bridge_id'))
        : null;

    // ─── Phase 1: Check existing session ───
    useEffect(() => {
        const stored = localStorage.getItem('liff_customer')
        if (stored) {
            router.replace('/search')
            return
        }

        const searchParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.slice(1)) // Check fragment too

        // Priority: URL Param > State > Hash > Storage
        const bridgeIdParam = searchParams.get('bridgeId') || searchParams.get('state') || hashParams.get('bridgeId')

        if (bridgeIdParam && !isStandalone) {
            localStorage.setItem('safari_bridge_id', bridgeIdParam)
            addLog(`Captured Bridge ID from URL: ${bridgeIdParam}`)
        }

        if (activeSafariBridgeId && !isStandalone) {
            setDebugInfo(`Active Bridge: ${activeSafariBridgeId}`)
        }

        // ─── Phase 2: Handle Returning from Direct OAuth (Code + State) ───
        const handleDirectSync = async (code: string, state: string) => {
            // Check if this specific code was already processed in this session
            const processedCodes = JSON.parse(sessionStorage.getItem('processed_line_codes') || '[]')
            if (processedCodes.includes(code)) {
                addLog(`Code already processed. Skipping redundant attempt.`)
                return
            }

            if (syncLock.current) return
            syncLock.current = true

            setSyncStatus('syncing')
            setSyncLoading(true)
            addLog(`Code detected. Exchanging for profile...`)
            try {
                const currentRedirectUri = window.location.origin + window.location.pathname
                const res = await fetch('/api/auth/bridge/sync-with-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code,
                        bridgeId: state,
                        redirectUri: currentRedirectUri
                    })
                })
                const result = await res.json()
                if (res.ok) {
                    // Mark this code as processed
                    processedCodes.push(code)
                    sessionStorage.setItem('processed_line_codes', JSON.stringify(processedCodes))

                    addLog(`Handshake complete for: ${result.displayName}`)
                    setSyncStatus('completed')
                    setIsBridgeSuccess(true)
                    localStorage.removeItem('safari_bridge_id')
                    
                    // v35: Notify other tabs (Auto-Refresh)
                    localStorage.setItem('liff_login_success', Date.now().toString());

                    setTimeout(() => {
                        try { window.close() } catch (e) { }
                        window.location.href = '/search'
                    }, 2500)
                } else {
                    // If it was already invalid, we might have succeeded in a previous render
                    if (result.error?.includes('invalid authorization code')) {
                        processedCodes.push(code)
                        sessionStorage.setItem('processed_line_codes', JSON.stringify(processedCodes))
                    }

                    addLog(`Handshake failed: ${result.error}`)
                    setError(`ผิดพลาด: ${result.error}`)
                    syncLock.current = false
                }
            } catch (e: any) {
                addLog(`Network Error: ${e.message}`)
                syncLock.current = false
            } finally {
                setSyncLoading(false)
            }
        }

        // ─── Phase 2.5: Auto-init LIFF (Only if NOT doing direct sync) ───
        const autoInit = async () => {
            if (isStandalone) return;

            const code = searchParams.get('code')
            const state = searchParams.get('state')
            const pwaBridgeId = typeof window !== 'undefined' ? localStorage.getItem('pwa_bridge_id') : null

            // v25: STRICT condition. Only hijack if the state matches our PWA Bridge ID.
            // This prevents hijacking standard LIFF logins that use their own state.
            if (code && state && state === pwaBridgeId) {
                handleDirectSync(code, state)
                return
            }

            const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID
            if (!liffId || liffId === 'your_liff_id' || liffId === '') {
                addLog('No LIFF ID found in env')
                return
            }

            try {
                setSyncStatus('init_liff')
                addLog('Starting LIFF Init...')
                const { default: liff } = await import('@line/liff')

                // Add Timeout for LIFF Init (Sometimes iPad hangs here)
                const initPromise = liff.init({ liffId })
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('LIFF_TIMEOUT')), 10000))

                await Promise.race([initPromise, timeoutPromise])
                addLog('LIFF Init Success')
                setSyncStatus('liff_done')

                if (liff.isLoggedIn()) {
                    setSyncStatus('fetching_profile')
                    addLog('Fetching LINE Profile...')
                    const profile = await liff.getProfile()
                    localStorage.setItem('liff_line_user_id', profile.userId)
                    localStorage.setItem('liff_display_name', profile.displayName)

                    const { data } = await supabase
                        .from('customers')
                        .select('*')
                        .eq('line_user_id', profile.userId)
                        .maybeSingle()

                    const customerData = data || { line_user_id: profile.userId, full_name: profile.displayName };
                    addLog(`Profile Loaded: ${profile.displayName}`)

                    // IF returned with bridgeId, sync to backend
                    if (activeSafariBridgeId) {
                        setSyncStatus('syncing')
                        setSyncLoading(true)
                        addLog(`Attempting DB Sync for ${activeSafariBridgeId}...`)

                        try {
                            let success = false;
                            for (let i = 0; i < 3; i++) {
                                try {
                                    const res = await fetch('/api/auth/bridge/sync', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ bridgeId: activeSafariBridgeId, customerData })
                                    })
                                    if (res.ok) {
                                        success = true;
                                        break;
                                    }
                                    addLog(`Sync Attempt ${i + 1} failed, retrying...`)
                                    await new Promise(r => setTimeout(r, 1000));
                                } catch (e) {
                                    if (i === 2) throw e;
                                }
                            }

                            if (success) {
                                setSyncStatus('completed')
                                setIsBridgeSuccess(true)
                                addLog('SYNC SUCCESS! Closing in 2s...')
                                localStorage.removeItem('safari_bridge_id')
                                setTimeout(() => {
                                    try { window.close(); } catch (e) { }
                                    window.location.href = '/search';
                                }, 2500);
                            } else {
                                setSyncStatus('error')
                                addLog('Database Sync Failed')
                                setError('การซิงค์ข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง')
                            }
                        } catch (e: any) {
                            setSyncStatus('error')
                            addLog(`Sync Error: ${e.message}`)
                            console.error('[Bridge] Sync Error:', e)
                        } finally {
                            setSyncLoading(false)
                        }
                    }

                    if (data && !activeSafariBridgeId) {
                        localStorage.setItem('liff_customer', JSON.stringify(data))
                        router.replace('/search')
                    } else if (!data && !activeSafariBridgeId) {
                        router.replace('/register')
                    }
                } else {
                    addLog('LIFF Not Logged In')
                    if (searchParams.get('bridgeId') || searchParams.get('state')) {
                        // v33: Only auto-login if we just arrived from PWA (params present)
                        addLog('PWA Breakout detected. Forcing Login Redirect...')
                        liff.login()
                    } else {
                        addLog('Direct browsing. Waiting for button click.')
                    }
                }
            } catch (err: any) {
                setSyncStatus('error')
                addLog(`LIFF Error: ${err.message}`)
                console.error('[LIFF] Error during auto-init:', err)
                // If it's a timeout or init error on iPad, user might need a reload
            } finally {
                setLoading(false)
            }
        }

        autoInit()

        // --- STUCK LOADING WATCHDOG ---
        // As requested by user: reload if stuck on loading for ~3 seconds
        const loadingTimer = setTimeout(() => {
            const hasId = searchParams.has('bridgeId') || hashParams.has('bridgeId') || !!localStorage.getItem('safari_bridge_id')
            if (hasId && !isStandalone && syncStatus !== 'completed' && syncStatus !== 'error' && !isBridgeSuccess) {
                addLog('Watchdog: Still loading after 5s - refreshing once...')
                if (!sessionStorage.getItem('sync_refresh_attempt')) {
                    sessionStorage.setItem('sync_refresh_attempt', '1');
                    window.location.reload();
                }
            }
        }, 5000)

        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'liff_login_success') {
                // v35.3: Use full redirect for better reliability in Safari
                addLog('Cross-tab success detected! Redirecting...')
                window.location.href = '/search';
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            clearTimeout(loadingTimer);
            window.removeEventListener('storage', handleStorage);
        }
    }, [router, isBridgeSuccess, activeSafariBridgeId])

    // ─── Phase 3: PWA Polling (for iOS) ───
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        const urlId = searchParams.get('pwaBridgeId')
        const storageId = localStorage.getItem('pwa_bridge_id')
        const activeBridgeId = urlId || storageId

        if (!activeBridgeId || !isStandalone) return

        if (urlId && !storageId) localStorage.setItem('pwa_bridge_id', urlId)

        let pollInterval: any = setInterval(async () => {
            try {
                const res = await fetch(`/api/auth/bridge/status?id=${activeBridgeId}`)
                const result = await res.json()
                if (result.status === 'completed' && result.customerData) {
                    addLog('Poll Detect Success!')
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
    }, [router, isStandalone])

    // --- iPad/iOS PWA Specific ---
    const [iosPwaBridgeUrl, setIosPwaBridgeUrl] = useState<string | null>(null);
    const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    useEffect(() => {
        const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID;
        
        if (isIOS && isStandalone) {
            if (liffId && liffId !== 'your_liff_id') {
                const bridgeId = (typeof crypto !== 'undefined' && crypto.randomUUID)
                    ? crypto.randomUUID()
                    : Math.random().toString(36).substring(2) + Date.now().toString(36);

                // v35.3: Use DIRECT liff.line.me URL to force breakout from PWA
                // Using our own API domain traps the flow inside the PWA internal webview.
                const liffUrl = `https://liff.line.me/${liffId}?pwaBridgeId=${bridgeId}`;
                
                setIosPwaBridgeUrl(liffUrl);
            }
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
                .maybeSingle()

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
                            <div className={styles.checkIcon}>
                                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="11" stroke="var(--primary)" strokeWidth="1.5" />
                                    <path d="M7 12.5L10.5 16L17 9" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
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
                                    sessionStorage.removeItem('sync_refresh_attempt');
                                    window.location.href = '/login';
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

                {/* --- Action Buttons --- */}
                {!(typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('pwaBridgeId') || localStorage.getItem('pwa_bridge_id'))) && !syncLoading && !loading && (
                    iosPwaBridgeUrl ? (
                        <a
                            href={iosPwaBridgeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.lineBtn}
                            onClick={() => {
                                // v25: Preparation for breakout
                                const url = new URL(iosPwaBridgeUrl);
                                const bId = url.searchParams.get('state') || url.searchParams.get('bridgeId');

                                if (bId) {
                                    localStorage.setItem('pwa_bridge_id', bId);
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
