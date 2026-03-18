'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LiffEntry() {
    const { branchSlug } = useParams<{ branchSlug: string }>()
    const router = useRouter()

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        const bridgeId = searchParams.get('state') || searchParams.get('bridgeId')
        const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID

        // Stuck Watchdog
        const loadingTimer = setTimeout(() => {
            if (bridgeId && !sessionStorage.getItem('sync_refresh_attempt')) {
                sessionStorage.setItem('sync_refresh_attempt', '1')
                window.location.reload()
            }
        }, 5000)

        // Mock mode handling
        if (!liffId || liffId === 'your_liff_id' || liffId === '') {
            const stored = localStorage.getItem('liff_customer')
            if (stored) {
                router.replace(`/${branchSlug}/menu`)
            } else {
                router.replace('/login')
            }
            return
        }

        // Real LIFF initialization
        import('@line/liff').then(({ default: liff }) => {
            liff.init({ liffId }).then(async () => {
                if (!liff.isLoggedIn()) {
                    // If we have a bridgeId, we should force login so it returns with the code
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

                // ─── Bridge Sync ───
                if (bridgeId) {
                    try {
                        await fetch('/api/auth/bridge/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ bridgeId, customerData })
                        })
                        // Give some time for sync to finish before closing/redirecting
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
            })
        })

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
