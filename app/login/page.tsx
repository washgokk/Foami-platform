'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './login.module.css'
import Logo from '@/components/Branding/Logo'

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
        <div className={`${styles.page} animate-fade`}>
            <div className={styles.content}>
                <Logo width={180} />
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <p className={styles.text}>กำลังเข้าสู่ระบบทาง LINE...</p>
                </div>
            </div>
        </div>
    )
}
