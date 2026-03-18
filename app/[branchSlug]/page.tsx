'use client'
import { useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LiffEntry() {
    const { branchSlug } = useParams<{ branchSlug: string }>()
    const router = useRouter()

    const syncLock = useRef(false)

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const bridgeId = state || searchParams.get('bridgeId')
        const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID

        // ─── Phase 1: Handle Direct OAuth Sync (Manual Handshake) ───
        const handleDirectSync = async (code: string, bridgeId: string) => {
            // sessionStorage lock to prevent double-processing
            const processedCodes = JSON.parse(sessionStorage.getItem('processed_line_codes') || '[]')
            if (processedCodes.includes(code)) return

            if (syncLock.current) return
            syncLock.current = true

            try {
                // IMPORTANT: Use /login as the redirectUri because that's where the breakout was authorized
                const currentRedirectUri = `${window.location.origin}/login`
                const res = await fetch('/api/auth/bridge/sync-with-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, bridgeId, redirectUri: currentRedirectUri })
                })
                const result = await res.json()
                if (res.ok) {
                    processedCodes.push(code)
                    sessionStorage.setItem('processed_line_codes', JSON.stringify(processedCodes))
                    
                    // On success, close window and return to PWA
                    setTimeout(() => {
                        try { window.close() } catch (e) {}
                        window.location.href = `/${branchSlug}/menu`
                    }, 2000)
                } else {
                    console.error('Handshake failed:', result.error)
                    // If it was already invalid, we might have succeeded in a previous render
                    if (result.error?.includes('invalid authorization code')) {
                        processedCodes.push(code)
                        sessionStorage.setItem('processed_line_codes', JSON.stringify(processedCodes))
                    }
                    syncLock.current = false
                }
            } catch (e) {
                console.error('Handshake error:', e)
                syncLock.current = false
            }
        }

        // Stuck Watchdog
        const loadingTimer = setTimeout(() => {
            if (bridgeId && !sessionStorage.getItem('sync_refresh_attempt')) {
                sessionStorage.setItem('sync_refresh_attempt', '1')
                window.location.reload()
            }
        }, 8000) // Slightly longer timeout for insurance

        // ─── Phase 2: Execution Logic ───
        const main = async () => {
            // Check for direct sync first
            if (code && bridgeId) {
                await handleDirectSync(code, bridgeId)
                return
            }

            // Normal LIFF logic
            if (!liffId || liffId === 'your_liff_id' || liffId === '') {
                const stored = localStorage.getItem('liff_customer')
                if (stored) {
                    router.replace(`/${branchSlug}/menu`)
                } else {
                    router.replace('/login')
                }
                return
            }

            try {
                const { default: liff } = await import('@line/liff')
                await liff.init({ liffId })
                
                if (!liff.isLoggedIn()) {
                    if (bridgeId) liff.login({ redirectUri: window.location.href })
                    else liff.login()
                    return
                }
                const profile = await liff.getProfile()
                localStorage.setItem('liff_line_user_id', profile.userId)
                localStorage.setItem('liff_display_name', profile.displayName)

                // Check if customer exists
                const { data } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('line_user_id', profile.userId)
                    .single()

                const customerData = data || { line_user_id: profile.userId, full_name: profile.displayName };

                // If somehow we land here with a bridgeId but no code (standard LIFF login)
                if (bridgeId) {
                    try {
                        await fetch('/api/auth/bridge/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ bridgeId, customerData })
                        })
                        setTimeout(() => {
                            try { window.close() } catch (e) {}
                            window.location.href = `/${branchSlug}/menu`
                        }, 2000)
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

        main()
        return () => clearTimeout(loadingTimer)
    }, [router, branchSlug])

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
                <div className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)', width: 32, height: 32 }} />
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.05em' }}>กำลังโหลด...</p>
            </div>
        </div>
    )
}
