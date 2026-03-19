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
    const syncLock = useRef(false)

    const addLog = (msg: string) => {
        console.log(`[Handshake] ${msg}`)
    }

    // v44: Singleton-like lock to handle Strict Mode and re-mounts
    if (typeof window !== 'undefined' && !(window as any).foami_sync_lock) {
        (window as any).foami_sync_lock = false;
    }

    // Detect standalone mode (PWA)
    const isStandalone = typeof window !== 'undefined' &&
        ((window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches);

    // v43: Strict URL-based Handshake Identification
    const bridgeParam = (typeof window !== 'undefined')
        ? (new URLSearchParams(window.location.search).get('bridgeId') ||
            new URLSearchParams(window.location.search).get('state') ||
            new URLSearchParams(window.location.hash.slice(1)).get('bridgeId'))
        : null;

    // Only identify as handshake if current URL has bridge_ prefix
    const isHandshakeFlow = !!bridgeParam?.startsWith('bridge_');

    const activeSafariBridgeId = (typeof window !== 'undefined')
        ? (isHandshakeFlow ? bridgeParam : localStorage.getItem('safari_bridge_id'))
        : null;

    // ─── Phase 1: Check existing session & Sync Logic ───
    useEffect(() => {
        const stored = localStorage.getItem('liff_customer')
        if (stored) {
            try {
                const customer = JSON.parse(stored);
                if (customer.last_branch_slug) {
                    router.replace(`/${customer.last_branch_slug}/menu`);
                } else {
                    router.replace('/search');
                }
            } catch (e) {
                router.replace('/search');
            }
            return
        }

        const searchParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.slice(1))

        // v39: Capture manual branch hint
        const branchHint = searchParams.get('branch');
        if (branchHint) {
            localStorage.setItem('last_branch_slug', branchHint);
        }

        if (bridgeParam?.startsWith('bridge_') && !isStandalone) {
            localStorage.setItem('safari_bridge_id', bridgeParam)
            addLog(`Captured Bridge ID: ${bridgeParam}`)
        }

        // ─── Phase 2: Handle Returning from Direct OAuth ───
        const handleDirectSync = async (code: string, state: string) => {
            if (!code || !state) return;
            
            // v44: Global instance lock to prevent race conditions (Strict Mode, re-mounts)
            if (typeof window !== 'undefined') {
                if ((window as any).foami_sync_active) return;
                (window as any).foami_sync_active = true;
            }

            // v43+: Persistent Code Guard
            const processedCodes = JSON.parse(localStorage.getItem('foami_processed_codes') || '[]')
            if (processedCodes.includes(code)) {
                addLog('Code already processed. Checking if we can redirect...')
                const storedCustomer = localStorage.getItem('liff_customer') || localStorage.getItem('foami_customer');
                if (storedCustomer) {
                    resolveAndRedirect(JSON.parse(storedCustomer));
                    return;
                }
                setSyncLoading(true);
                return;
            }

            setSyncLoading(true)
            addLog(`Auth code detected (ID: ${state}). Processing...`)
            
            try {
                const currentRedirectUri = window.location.origin + window.location.pathname
                const res = await fetch('/api/auth/bridge/sync-with-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, bridgeId: state, redirectUri: currentRedirectUri })
                })
                const result = await res.json()
                
                if (res.ok) {
                    processedCodes.push(code)
                    localStorage.setItem('foami_processed_codes', JSON.stringify(processedCodes))
                    localStorage.setItem('foami_login_success', 'true');
                    localStorage.setItem('foami_customer', JSON.stringify(result.customerData));
                    setIsBridgeSuccess(true)
                    
                    setTimeout(() => {
                        const isProbablyPopup = !isStandalone && (window.opener || window.history.length === 1);
                        if (isProbablyPopup) {
                            addLog(`Closing breakout tab...`)
                            try { window.open('', '_self'); window.close(); } catch (e) { }
                        }
                        resolveAndRedirect(result.customerData);
                    }, isHandshakeFlow ? 150 : 800)
                } else {
                    // v44: SILENT on transient errors. 
                    const errorMsg = (result.error || '').toLowerCase();
                    const isTransient = errorMsg.includes('invalid') || errorMsg.includes('used') || errorMsg.includes('code') || errorMsg.includes('already');
                    
                    if (isTransient) {
                        addLog(`Transient sync error silenced: ${errorMsg}`)
                        const storedCustomer = localStorage.getItem('liff_customer') || localStorage.getItem('foami_customer');
                        if (storedCustomer) {
                            resolveAndRedirect(JSON.parse(storedCustomer));
                        }
                        return;
                    }

                    addLog(`Handshake failed: ${result.error}`)
                    setError(`ผิดพลาด: ${result.error}`)
                    if (typeof window !== 'undefined') (window as any).foami_sync_active = false;
                }
            } catch (e: any) {
                addLog(`Network Error: ${e.message}`)
                if (typeof window !== 'undefined') (window as any).foami_sync_active = false;
            } finally {
                setSyncLoading(false)
            }
        }

        const code = searchParams.get('code')
        const state = searchParams.get('state')

        // Priority Logic: Don't do LIFF Init if sync is happening
        if (code && state && !isStandalone) {
            handleDirectSync(code, state)
            // No return here - let watchdog start
        } else {
            // Only auto-init LIFF if we are NOT at a direct callback step
            const autoInit = async () => {
                if (isStandalone) return;
                const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID
                if (!liffId || liffId === 'your_liff_id' || liffId === '') return;

                try {
                    addLog('Starting LIFF Init...')
                    const { default: liff } = await import('@line/liff')
                    await liff.init({ liffId })
                    if (liff.isLoggedIn()) {
                        const profile = await liff.getProfile()
                        const { data } = await supabase.from('customers').select('*').eq('line_user_id', profile.userId).maybeSingle()
                        const customerData = data || { line_user_id: profile.userId, full_name: profile.displayName };

                        if (activeSafariBridgeId) {
                            addLog(`Syncing active bridge: ${activeSafariBridgeId}`)
                            const res = await fetch('/api/auth/bridge/sync', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ bridgeId: activeSafariBridgeId, customerData })
                            })
                            if (res.ok) {
                                localStorage.removeItem('safari_bridge_id')
                                setTimeout(() => {
                                    try { window.open('', '_self'); window.close(); } catch (e) { }
                                    resolveAndRedirect(customerData);
                                }, 200);
                                return;
                            }
                        }
                        if (data && !activeSafariBridgeId) {
                            resolveAndRedirect(data);
                        } else if (!data && !activeSafariBridgeId) {
                            router.replace('/register')
                        }
                    } else if (searchParams.get('bridgeId') || searchParams.get('state')) {
                        addLog('Triggering Auto Login...')
                        const finalState = searchParams.get('bridgeId') || searchParams.get('state') || '';
                        (liff.login as any)({ redirectUri: window.location.origin + window.location.pathname, state: finalState })
                    }
                } catch (e: any) {
                    addLog(`LIFF Error: ${e.message}`)
                } finally {
                    setLoading(false)
                }
            }
            autoInit()
        }

        // ─── Watchdogs ───
        const loadingTimer = setTimeout(() => {
            const hasId = searchParams.has('bridgeId') || hashParams.has('bridgeId') || !!localStorage.getItem('safari_bridge_id')
            if (hasId && !isStandalone && !isBridgeSuccess) {
                if (!sessionStorage.getItem('sync_refresh_attempt')) {
                    sessionStorage.setItem('sync_refresh_attempt', '1');
                    window.location.reload();
                }
            }
        }, 5000)

        const watchdog = setInterval(() => {
            const hasSuccess = localStorage.getItem('foami_login_success') || localStorage.getItem('liff_login_success');
            const successUrl = localStorage.getItem('liff_login_success_url');
            const hasCustomer = localStorage.getItem('liff_customer') || localStorage.getItem('foami_customer');
            
            if (hasSuccess && hasCustomer) {
                addLog('Watchdog: Cross-tab success detected!')
                clearInterval(watchdog);
                resolveAndRedirect(JSON.parse(hasCustomer));
            }
        }, 1000);

        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'foami_login_success' || e.key === 'liff_login_success') {
                const customer = localStorage.getItem('liff_customer') || localStorage.getItem('foami_customer');
                if (customer) resolveAndRedirect(JSON.parse(customer));
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            clearTimeout(loadingTimer);
            clearInterval(watchdog);
            window.removeEventListener('storage', handleStorage);
        }
    }, [router, isStandalone, isHandshakeFlow, activeSafariBridgeId, isBridgeSuccess]);

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
                addLog(`Polling bridge status for: ${activeBridgeId}...`)
                const res = await fetch(`/api/auth/bridge/status?id=${activeBridgeId}`)
                const result = await res.json()
                if (result.status === 'completed' && result.customerData) {
                    addLog('Poll Detect Success! v44')
                    clearInterval(pollInterval)
                    localStorage.removeItem('pwa_bridge_id')
                    resolveAndRedirect(result.customerData);
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
                const bridgeId = 'bridge_' + ((typeof crypto !== 'undefined' && crypto.randomUUID)
                    ? crypto.randomUUID()
                    : Math.random().toString(36).substring(2) + Date.now().toString(36));

                // v36: Revert to Raw OAuth (access.line.me) to force iOS Breakout
                // This is more aggressive at forcing the "Open in Safari" behavior.
                const channelId = liffId.includes('-') ? liffId.split('-')[0] : liffId;
                const staticRedirectUri = encodeURIComponent(`${window.location.origin}/login`);
                const oauthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${staticRedirectUri}&state=${bridgeId}&scope=profile%20openid`;
                
                setIosPwaBridgeUrl(oauthUrl);
            }
        }
    }, [isIOS, isStandalone]);

    // v41: Centralized Destination Resolver
    const resolveAndRedirect = (data: any) => {
        const dbBranch = data?.last_branch_slug;
        const localBranch = localStorage.getItem('last_branch_slug');
        const targetBranch = dbBranch || localBranch;
        const finalUrl = targetBranch ? `/${targetBranch}/menu` : '/search';
        
        if (data) {
            localStorage.setItem('liff_customer', JSON.stringify(data));
            localStorage.setItem('liff_line_user_id', data.line_user_id);
        }
        
        localStorage.setItem('liff_login_success_url', finalUrl);
        localStorage.setItem('liff_login_success', Date.now().toString());

        addLog(`Redirecting to final target: ${finalUrl}`);
        router.replace(finalUrl);
    }

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
                resolveAndRedirect(data);
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
                resolveAndRedirect(data);
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
                            <div className="spinner-blue" style={{ width: 40, height: 40, margin: '0 auto 15px' }} />
                            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.3rem', marginBottom: 10 }}>เข้าสู่ระบบสำเร็จ!</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>กำลังพาคุณไปยังหน้าหลัก...</p>
                        </div>
                    ) : syncLoading ? (
                        <div className={styles.syncBox}>
                            <div className="spinner-blue" style={{ width: 40, height: 40, margin: '0 auto 15px' }} />
                            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.3rem', marginBottom: 10 }}>
                                {isHandshakeFlow ? 'กำลังส่งข้อมูลไปยังแอป...' : 'กำลังเข้าสู่ระบบ...'}
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>กรุณารอสักครู่ครับ</p>
                        </div>
                    ) : (typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('pwaBridgeId') || localStorage.getItem('pwa_bridge_id'))) ? (
                        <div className={styles.waitingBox}>
                            <div className="spinner-blue" style={{ width: 40, height: 40, margin: '0 auto 15px' }} />
                            <p style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600 }}>กำลังรอการเข้าสู่ระบบ...</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: 20 }}>กรุณาเข้าสู่ระบบใน Safari ที่เปิดขึ้นมา</p>

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
                {!(typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('pwaBridgeId') || localStorage.getItem('pwa_bridge_id'))) && !syncLoading && !isBridgeSuccess && !loading && (
                    iosPwaBridgeUrl ? (
                        <button
                            className={styles.lineBtn}
                            onClick={(e) => {
                                // v36.3: Programmatic jump often breaks out of PWA more cleanly than <a>
                                e.preventDefault();
                                const url = new URL(iosPwaBridgeUrl);
                                const bId = url.searchParams.get('state') || url.searchParams.get('bridgeId');

                                if (bId) {
                                    localStorage.setItem('pwa_bridge_id', bId);
                                    setLoading(true);
                                    const nextUrl = new URL(window.location.href);
                                    nextUrl.searchParams.set('pwaBridgeId', bId);
                                    window.history.replaceState({}, '', nextUrl.toString());
                                }
                                
                                // FORCE JUMP to Safari
                                window.location.href = iosPwaBridgeUrl;
                            }}
                        >
                            <div className={styles.lineIconWrapper}>
                                <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" alt="LINE" className={styles.lineIcon} />
                            </div>
                            <span>เข้าสู่ระบบด้วย LINE</span>
                        </button>
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
