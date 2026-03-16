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
    const [error, setError] = useState('')

    // Reset customer stored data if entering login page explicitly
    useEffect(() => {
        const stored = localStorage.getItem('liff_customer')
        if (stored) {
            router.replace('/search')
        }
    }, [router])

    const handleLineLogin = async () => {
        setLoading(true)
        setError('')

        const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID

        // ─── Development Mock Mode ───
        if (!liffId || liffId === 'your_liff_id' || liffId === '') {
            console.log('LIFF ID not found. Using Mock Login...')
            // Simulate delay
            await new Promise(r => setTimeout(r, 800))
            
            // Use a stable mock ID so developer can test 'Existing User' flow too
            const mockId = 'mock_user_123' 
            localStorage.setItem('liff_line_user_id', mockId)
            localStorage.setItem('liff_display_name', 'Mock User')

            // Check if mock user in DB
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
                return // Page will redirect
            }

            const profile = await liff.getProfile()
            localStorage.setItem('liff_line_user_id', profile.userId)
            localStorage.setItem('liff_display_name', profile.displayName)

            // Check database for existing customer
            const { data, error: dbErr } = await supabase
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
                    <p className={styles.subheadline}>
                        บริการล้างรถและดูแลรักษาพรีเมียม<br />
                        จองง่าย สะดวก รวดเร็ว ถึงที่บ้านคุณ
                    </p>
                </div>

                <button 
                    className={styles.lineBtn} 
                    onClick={handleLineLogin}
                    disabled={loading}
                >
                    {loading ? (
                        <div className="spinner" style={{ width: 24, height: 24, borderTopColor: '#fff', opacity: 0.8 }} />
                    ) : (
                        <>
                            <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" alt="LINE" className={styles.lineIcon} />
                            เข้าสู่ระบบด้วย LINE
                        </>
                    )}
                </button>

                {error && <div className={styles.errorBox}>{error}</div>}

                <p className={styles.footerHint}>
                    การล็อคอินหมายถึงคุณยอมรับข้อตกลงการใช้งาน
                </p>
            </div>
        </div>
    )
}
