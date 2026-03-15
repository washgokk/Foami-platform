'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function GlobalLogin() {
    const router = useRouter()

    useEffect(() => {
        // Check if using real LIFF or mock mode
        const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID

        if (!liffId || liffId === 'your_liff_id') {
            // Development mock
            const stored = localStorage.getItem('liff_customer')
            if (stored) {
                router.replace('/search')
            } else {
                localStorage.setItem('liff_line_user_id', 'mock_user_dev_' + Date.now())
                router.replace('/register')
            }
            return
        }

        // Real LIFF initialization
        import('@line/liff').then(({ default: liff }) => {
            liff.init({ liffId }).then(async () => {
                if (!liff.isLoggedIn()) {
                    liff.login()
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

                if (data) {
                    localStorage.setItem('liff_customer', JSON.stringify(data))
                    router.replace('/search')
                } else {
                    router.replace('/register')
                }
            })
        })
    }, [router])

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
                style={{ width: '100%', maxWidth: '240px', height: 'auto' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)', width: 32, height: 32 }} />
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.05em' }}>กำลังเข้าสู่ระบบทาง LINE...</p>
            </div>

            <Link 
                href="/portal" 
                style={{ 
                    marginTop: 'var(--space-8)', 
                    color: 'rgba(255,255,255,0.6)', 
                    fontSize: '0.75rem', 
                    textDecoration: 'underline',
                    textUnderlineOffset: '4px'
                }}
            >
                Foami Operations Portal (Admin/Staff)
            </Link>
        </div>
    )
}
