'use client'
import { useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LiffEntry() {
    const { branchSlug } = useParams<{ branchSlug: string }>()
    const router = useRouter()

    const syncLock = useRef(false)
    const isBridgeSuccess = useRef(false) // Use ref for polling check

    // Detect standalone mode (PWA)
    const isStandalone = typeof window !== 'undefined' &&
        ((window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches);

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const bridgeId = state || searchParams.get('bridgeId')
        const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID

        // ─── Phase 1: Handle Direct OAuth Sync (Manual Handshake) ───
        const handleDirectSync = async (targetCode: string, targetBridgeId: string) => {
            const processedCodes = JSON.parse(sessionStorage.getItem('processed_line_codes') || '[]')
            if (processedCodes.includes(targetCode)) return true

            if (syncLock.current) return true
            syncLock.current = true

            try {
                // v22: Use the current page URL as redirectUri
                const currentRedirectUri = window.location.origin + window.location.pathname
                const res = await fetch('/api/auth/bridge/sync-with-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: targetCode, bridgeId: targetBridgeId, redirectUri: currentRedirectUri })
                })
                const result = await res.json()
                if (res.ok) {
                    processedCodes.push(targetCode)
                    sessionStorage.setItem('processed_line_codes', JSON.stringify(processedCodes))

                    // v35: Notify original tab (Auto-Refresh)
                    localStorage.setItem('liff_login_success', Date.now().toString());

                    setTimeout(() => {
                        try { window.close() } catch (e) { }
                        window.location.href = `/${branchSlug}/menu`
                    }, 2000)
                    return true
                } else {
                    console.error('Handshake failed:', result.error)
                    if (result.error?.includes('invalid authorization code')) {
                        processedCodes.push(targetCode)
                        sessionStorage.setItem('processed_line_codes', JSON.stringify(processedCodes))
                    }
                    syncLock.current = false
                    return true
                }
            } catch (e) {
                console.error('Handshake error:', e)
                syncLock.current = false
                return false
            }
        }

        // Stuck Watchdog
        const loadingTimer = setTimeout(() => {
            if (bridgeId && !sessionStorage.getItem('sync_refresh_attempt')) {
                sessionStorage.setItem('sync_refresh_attempt', '1')
                window.location.reload()
            }
        }, 3000)

        // ─── Phase 2: Execution Logic ───
        const main = async () => {
            const pwaBridgeId = typeof window !== 'undefined' ? localStorage.getItem('pwa_bridge_id') : null

            // v25: STRICT condition. Only hijack if this is a breakout return.
            if (code && state && state === pwaBridgeId) {
                await handleDirectSync(code, pwaBridgeId)
                return
            }

            if (!liffId || liffId === 'your_liff_id' || liffId === '') {
                const stored = localStorage.getItem('liff_customer')
                if (stored) router.replace(`/${branchSlug}/menu`)
                else router.replace('/login')
                return
            }

            try {
                const { default: liff } = await import('@line/liff')
                await liff.init({ liffId })

                if (!liff.isLoggedIn()) {
                    if (isStandalone) return; // Wait for breakout button click 

                    if (bridgeId) liff.login({ redirectUri: window.location.href })
                    else liff.login()
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

                const customerData = data || { line_user_id: profile.userId, full_name: profile.displayName };

                if (bridgeId) {
                    try {
                        await fetch('/api/auth/bridge/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ bridgeId, customerData })
                        })

                        // v36.4: Save locally then notify
                        const targetUrl = `/${branchSlug}/menu`;
                        if (customerData) {
                            localStorage.setItem('liff_customer', JSON.stringify(customerData));
                            localStorage.setItem('liff_line_user_id', customerData.line_user_id);
                            localStorage.setItem('last_branch_slug', branchSlug);
                        }

                        // v37: Signal specific branch destination
                        localStorage.setItem('liff_login_success_url', targetUrl);
                        localStorage.setItem('liff_login_success', Date.now().toString());

                        console.log(`[Handshake] Sync success! Closing and signaling target: ${targetUrl}`)
                        setTimeout(() => {
                            // v37.2: Safe closure
                            const isProbablyPopup = (window.opener || window.history.length === 1);
                            
                            if (!isStandalone && isProbablyPopup) {
                                try { 
                                    window.open('', '_self');
                                    window.close(); 
                                } catch (e) { }
                            }

                            setTimeout(() => {
                                // Fallback redirect
                                window.location.href = targetUrl;
                            }, 500);
                        }, 1000)
                    } catch (e) {
                        console.error('Bridge sync error:', e)
                    }
                }

                if (data) {
                    localStorage.setItem('liff_customer', JSON.stringify(data))
                    if (!bridgeId) router.replace(`/${branchSlug}/menu`)
                } else {
                    localStorage.setItem('last_branch_slug', branchSlug)
                    if (!bridgeId) router.replace('/register')
                }
            } catch (err) {
                console.error('LIFF Init error:', err)
            }
        }

        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'liff_login_success') {
                window.location.href = `/${branchSlug}/menu`;
            }
        };
        window.addEventListener('storage', handleStorage);

        // v36: Universal Watchdog (1s)
        const watchdog = setInterval(() => {
            if (localStorage.getItem('liff_login_success') || localStorage.getItem('liff_customer')) {
                localStorage.removeItem('liff_login_success');
                window.location.href = `/${branchSlug}/menu`;
            }
        }, 1000);

        main()
        return () => {
            clearTimeout(loadingTimer);
            clearInterval(watchdog);
            window.removeEventListener('storage', handleStorage);
        }
    }, [router, branchSlug])

    // ─── Phase 3: PWA Polling (Ported from login/page.tsx) ───
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
                    clearInterval(pollInterval)
                    localStorage.removeItem('pwa_bridge_id')
                    localStorage.setItem('liff_customer', JSON.stringify(result.customerData))
                    localStorage.setItem('liff_line_user_id', result.customerData.line_user_id)
                    router.replace(`/${branchSlug}/menu`)
                }
            } catch (e) {
                console.error('Polling error:', e)
            }
        }, 2000)

        return () => clearInterval(pollInterval)
    }, [router, isStandalone, branchSlug])

    // --- iPad Breakout Prep (Ported from login/page.tsx) ---
    const [iosPwaBridgeUrl, setIosPwaBridgeUrl] = (typeof window !== 'undefined') ? (() => {
        const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isIOS && isStandalone && liffId && liffId !== 'your_liff_id') {
            const bridgeId = Math.random().toString(36).substring(2) + Date.now().toString(36);
            // v36: Revert to Raw OAuth for breakout
            const channelId = liffId.includes('-') ? liffId.split('-')[0] : liffId;
            const staticRedirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
            const oauthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${staticRedirectUri}&state=${bridgeId}&scope=profile%20openid`;
            return [oauthUrl, bridgeId];
        }
        return [null, null];
    })() : [null, null];

    const isWaiting = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('pwaBridgeId') || localStorage.getItem('pwa_bridge_id'));

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-blue) 100%)',
            gap: '24px',
            padding: 'var(--space-6)'
        }}>
            <img
                src="/logo - lanscape.svg"
                alt="Foami Logo"
                style={{ width: '100%', maxWidth: '240px', height: 'auto', filter: 'brightness(0) invert(1)' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                {isWaiting ? (
                    <>
                        <div className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)', width: 32, height: 32 }} />
                        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.05em' }}>กำลังรอการเข้าสู่ระบบ...</p>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginTop: '10px', textAlign: 'center' }}>
                            หาก Safari ไม่เด้งขึ้นมา <br /> กรุณาลองกดล็อคอินที่หน้า Safari ปกติครับ
                        </p>
                        <button
                            onClick={() => {
                                localStorage.removeItem('pwa_bridge_id');
                                window.location.reload();
                            }}
                            style={{
                                marginTop: '15px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
                                color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '0.75rem'
                            }}
                        >ยกเลิก</button>
                    </>
                ) : (iosPwaBridgeUrl && isStandalone) ? (
                    <a
                        href={iosPwaBridgeUrl[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                            if (iosPwaBridgeUrl && iosPwaBridgeUrl[1]) {
                                localStorage.setItem('pwa_bridge_id', iosPwaBridgeUrl[1]);
                                const nextUrl = new URL(window.location.href);
                                nextUrl.searchParams.set('pwaBridgeId', iosPwaBridgeUrl[1]);
                                window.history.replaceState({}, '', nextUrl.toString());
                            }
                        }}
                        style={{
                            background: '#06C755', color: '#fff', border: 'none', padding: '12px 24px',
                            borderRadius: '30px', fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px',
                            textDecoration: 'none'
                        }}
                    >
                        <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" alt="LINE" style={{ width: 20 }} />
                        เข้าสู่ระบบด้วย LINE
                    </a>
                ) : (
                    <>
                        <div className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)', width: 32, height: 32 }} />
                        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.05em' }}>กำลังโหลด...</p>
                    </>
                )}
            </div>
        </div>
    )
}
