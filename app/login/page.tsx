'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { sendPhoneOtp, signInWithGoogle, isFirebaseConfigured } from '@/lib/firebase'
import styles from './login.module.css'
import Logo from '@/components/Branding/Logo'
import { Phone, ArrowRight, ShieldCheck, RefreshCw, CheckCircle2 } from 'lucide-react'

const LIFF_ID = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.NEXT_PUBLIC_LIFF_ID || ''

type Phase = 'idle' | 'syncing' | 'otp_sent' | 'success' | 'error'

export default function LoginPage() {
    const router = useRouter()
    const didInit = useRef(false)

    const [phase, setPhase] = useState<Phase>('idle')
    const [errorMsg, setErrorMsg] = useState('')
    const [infoMsg, setInfoMsg] = useState('')

    // Phone Auth State
    const [phone, setPhone] = useState('')
    const [otpCode, setOtpCode] = useState('')
    const [confirmationResult, setConfirmationResult] = useState<any>(null)
    const [isSendingOtp, setIsSendingOtp] = useState(false)
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
    const [resendTimer, setResendTimer] = useState(0)

    // Environment detection
    const [isLineClient, setIsLineClient] = useState(false)

    useEffect(() => {
        if (typeof navigator !== 'undefined') {
            const isLine = /Line/i.test(navigator.userAgent)
            setIsLineClient(isLine)
        }
    }, [])

    // Timer countdown
    useEffect(() => {
        if (resendTimer <= 0) return
        const t = setInterval(() => setResendTimer(prev => prev - 1), 1000)
        return () => clearInterval(t)
    }, [resendTimer])

    // ─── Central Redirect ───
    const resolveAndRedirect = (data: any) => {
        if (data) {
            localStorage.setItem('liff_customer', JSON.stringify(data))
            if (data.line_user_id) localStorage.setItem('liff_line_user_id', data.line_user_id)
            if (data.phone) localStorage.setItem('customer_phone', data.phone)
        }
        const branch = data?.last_branch_slug || localStorage.getItem('last_branch_slug')
        window.location.href = branch ? `/${branch}/menu` : '/search'
    }

    // ─── Phase Detection (runs ONCE on mount) ───
    useEffect(() => {
        if (didInit.current) return
        didInit.current = true

        // Case A: Already has session
        const stored = localStorage.getItem('liff_customer')
        if (stored) {
            try {
                resolveAndRedirect(JSON.parse(stored))
                return
            } catch {
                localStorage.removeItem('liff_customer')
            }
        }

        const sp = new URLSearchParams(window.location.search)
        const branch = sp.get('branch')
        if (branch) localStorage.setItem('last_branch_slug', branch)

        // Check if returning from Google OAuth (Supabase)
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                setPhase('syncing')
                const googleUser = session.user
                const email = googleUser.email
                const fullName = googleUser.user_metadata?.full_name || googleUser.user_metadata?.name || 'ลูกค้า Google'

                // Check customer DB
                const { data: matchedCust } = await supabase
                    .from('customers')
                    .select('*')
                    .or(`google_id.eq.${googleUser.id},email.eq.${email}`)
                    .maybeSingle()

                if (matchedCust) {
                    resolveAndRedirect(matchedCust)
                } else {
                    // Create customer linked to Google
                    const res = await fetch('/api/auth/phone-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phone: googleUser.phone || `G-${googleUser.id.slice(0, 8)}`,
                            fullName,
                            googleId: googleUser.id
                        })
                    })
                    const resData = await res.json()
                    if (resData.customer) {
                        resolveAndRedirect(resData.customer)
                    }
                }
            }
        })

        // Case C: LINE LIFF (Only inside LINE In-App Browser)
        const isLine = typeof navigator !== 'undefined' && /Line/i.test(navigator.userAgent)
        if (isLine && LIFF_ID) {
            handleLIFFSilentLogin()
        }
    }, [])

    // ─── LINE LIFF Handler (Inside LINE Browser Only) ───
    const handleLIFFSilentLogin = async () => {
        try {
            const { default: liff } = await import('@line/liff')
            await liff.init({ liffId: LIFF_ID })
            if (liff.isLoggedIn()) {
                setPhase('syncing')
                const profile = await liff.getProfile()
                localStorage.setItem('liff_line_user_id', profile.userId)
                localStorage.setItem('liff_display_name', profile.displayName)

                const { data } = await supabase
                    .from('customers').select('*')
                    .eq('line_user_id', profile.userId).maybeSingle()

                if (data) {
                    resolveAndRedirect(data)
                } else {
                    window.location.href = '/register'
                }
            }
        } catch (e: any) {
            console.error('[Login] LIFF error:', e)
        }
    }

    const handleLineLogin = async () => {
        setPhase('syncing')
        setErrorMsg('')
        try {
            const { default: liff } = await import('@line/liff')
            await liff.init({ liffId: LIFF_ID })
            if (!liff.isLoggedIn()) {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
                liff.login({ redirectUri: `${appUrl}/login` })
                return
            }
            const profile = await liff.getProfile()
            const { data } = await supabase.from('customers').select('*')
                .eq('line_user_id', profile.userId).maybeSingle()
            if (data) resolveAndRedirect(data)
            else window.location.href = '/register'
        } catch (e: any) {
            console.error('[Login] LINE error:', e)
            setPhase('idle')
            setErrorMsg('ไม่สามารถเชื่อมต่อกับ LINE ได้ กรุณาลองใหม่')
        }
    }

    // ─── Phone OTP Authentication ───
    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        const clean = phone.replace(/\D/g, '')
        if (clean.length < 9 || clean.length > 10) {
            setErrorMsg('กรุณากรอกหมายเลขโทรศัพท์ให้ถูกต้อง (เช่น 0812345678)')
            return
        }

        setIsSendingOtp(true)
        setErrorMsg('')
        setInfoMsg('')

        try {
            const result = await sendPhoneOtp(clean, 'recaptcha-container')
            setConfirmationResult(result)
            setPhase('otp_sent')
            setResendTimer(60)
            if ((result as any).mock) {
                setInfoMsg('💡 โหมดทดสอบ: กรุณากรอกรหัส OTP 123456')
            }
        } catch (err: any) {
            console.error('[Phone Auth] Send OTP error:', err)
            setErrorMsg(err.message || 'ไม่สามารถส่งรหัส OTP ได้ กรุณาลองใหม่อีกครั้ง')
        } finally {
            setIsSendingOtp(false)
        }
    }

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        if (otpCode.length !== 6) {
            setErrorMsg('กรุณากรอกรหัส OTP 6 หลัก')
            return
        }

        setIsVerifyingOtp(true)
        setErrorMsg('')

        try {
            // If live Firebase confirmation result
            if (confirmationResult && typeof confirmationResult.confirm === 'function') {
                await confirmationResult.confirm(otpCode)
            } else if (confirmationResult?.mock && otpCode !== '123456') {
                throw new Error('รหัส OTP ทดสอบไม่ถูกต้อง (กรุณากรอก 123456)')
            }

            setPhase('syncing')

            // Call universal account linking API
            const res = await fetch('/api/auth/phone-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            })

            const json = await res.json()
            if (!res.ok || !json.customer) {
                throw new Error(json.error || 'ไม่สามารถสร้างเซสชันการใช้งานได้')
            }

            setPhase('success')
            setTimeout(() => {
                resolveAndRedirect(json.customer)
            }, 600)
        } catch (err: any) {
            console.error('[Phone Auth] Verify error:', err)
            setErrorMsg(err.message || 'รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')
            setPhase('otp_sent')
        } finally {
            setIsVerifyingOtp(false)
        }
    }

    // ─── Google Sign-In ───
    const handleGoogleLogin = async () => {
        setErrorMsg('')
        setPhase('syncing')

        try {
            if (isFirebaseConfigured()) {
                const userCred = await signInWithGoogle()
                const googleUser = userCred.user
                const res = await fetch('/api/auth/phone-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: googleUser.phoneNumber || `G-${googleUser.uid.slice(0, 8)}`,
                        fullName: googleUser.displayName || 'ลูกค้า Google',
                        googleId: googleUser.uid
                    })
                })
                const resData = await res.json()
                if (resData.customer) {
                    resolveAndRedirect(resData.customer)
                    return
                }
            }

            // Supabase fallback
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${appUrl}/login`
                }
            })
            if (error) throw error
        } catch (err: any) {
            console.error('[Google Auth] error:', err)
            setPhase('idle')
            setErrorMsg('เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google: ' + err.message)
        }
    }

    return (
        <div className={styles.page}>
            {/* Background Glow */}
            <div className={styles.bgGlow}>
                <div className={styles.glow1} />
                <div className={styles.glow2} />
            </div>

            {/* Invisible Recaptcha Anchor */}
            <div id="recaptcha-container"></div>

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

                {/* Loading / Syncing State */}
                {phase === 'syncing' && (
                    <div className={styles.successBox} style={{ width: '100%' }}>
                        <div className="spinner-blue" style={{ width: 40, height: 40, margin: '0 auto 15px' }} />
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>กำลังเข้าสู่ระบบ...</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>กรุณารอสักครู่ ระบบกำลังเชื่อมต่อข้อมูลของคุณ</p>
                    </div>
                )}

                {/* Success State */}
                {phase === 'success' && (
                    <div className={styles.successBox} style={{ width: '100%' }}>
                        <CheckCircle2 size={42} color="var(--success)" style={{ margin: '0 auto 10px' }} />
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>เข้าสู่ระบบสำเร็จ!</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>กำลังพาคุณไปยังหน้าบริการ...</p>
                    </div>
                )}

                {/* Primary Auth Form (when idle, error, or otp_sent) */}
                {phase !== 'syncing' && phase !== 'success' && (
                    <div className={styles.authCard}>
                        {/* CASE 1: INSIDE LINE IN-APP BROWSER */}
                        {isLineClient ? (
                            <div>
                                <button className={styles.lineBtn} onClick={handleLineLogin}>
                                    <div className={styles.lineIconWrapper}>
                                        <img
                                            src="https://cdnjs.cloudflare.com/ajax/libs/simple-icons/11.10.0/line.svg"
                                            alt="LINE"
                                            className={styles.lineIcon}
                                        />
                                    </div>
                                    <span>เข้าสู่ระบบด้วย LINE</span>
                                </button>
                                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
                                    เปิดใช้งานผ่าน LINE ได้ทันทีโดยไม่ต้องจำรหัสผ่าน
                                </p>
                            </div>
                        ) : (
                            /* CASE 2: OUTSIDE LINE (Safari, Chrome, iOS PWA, Android, Web) — ZERO-COST PHONE OTP + GOOGLE */
                            <div>
                                {phase !== 'otp_sent' ? (
                                    <form onSubmit={handleRequestOtp}>
                                        <label className={styles.inputLabel}>
                                            <Phone size={16} color="var(--primary)" /> หมายเลขโทรศัพท์
                                        </label>
                                        <div className={styles.phoneInputWrapper}>
                                            <div className={styles.countryCode}>
                                                <span>🇹🇭</span> +66
                                            </div>
                                            <input
                                                type="tel"
                                                className={styles.phoneInput}
                                                placeholder="081-234-5678"
                                                value={phone}
                                                onChange={e => setPhone(e.target.value)}
                                                autoFocus
                                                required
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            className={styles.actionBtn}
                                            style={{ marginTop: 16 }}
                                            disabled={isSendingOtp || !phone.trim()}
                                        >
                                            {isSendingOtp ? <span className="spinner" /> : (
                                                <>ขอรหัส OTP ทาง SMS <ArrowRight size={18} /></>
                                            )}
                                        </button>
                                    </form>
                                ) : (
                                    <form onSubmit={handleVerifyOtp}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <label className={styles.inputLabel} style={{ marginBottom: 0 }}>
                                                <ShieldCheck size={16} color="var(--primary)" /> รหัสยืนยัน OTP (6 หลัก)
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => { setPhase('idle'); setOtpCode('') }}
                                                style={{ border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                                            >
                                                เปลี่ยนเบอร์
                                            </button>
                                        </div>

                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            className={styles.otpInput}
                                            placeholder="------"
                                            value={otpCode}
                                            onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                            autoFocus
                                            required
                                        />

                                        <button
                                            type="submit"
                                            className={styles.actionBtn}
                                            style={{ marginTop: 16 }}
                                            disabled={isVerifyingOtp || otpCode.length !== 6}
                                        >
                                            {isVerifyingOtp ? <span className="spinner" /> : 'ยืนยันรหัส OTP'}
                                        </button>

                                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
                                            <button
                                                type="button"
                                                disabled={resendTimer > 0 || isSendingOtp}
                                                onClick={handleRequestOtp}
                                                style={{
                                                    border: 'none', background: 'transparent',
                                                    color: resendTimer > 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                                                    fontSize: '0.8rem', fontWeight: 600, cursor: resendTimer > 0 ? 'not-allowed' : 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: 6
                                                }}
                                            >
                                                <RefreshCw size={13} /> {resendTimer > 0 ? `ขอรหัสใหม่ใน (${resendTimer}s)` : 'ส่งรหัส OTP ใหม่อีกครั้ง'}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* Divider */}
                                <div className={styles.divider} style={{ margin: '20px 0 16px' }}>
                                    <span>หรือเข้าใช้งานด้วย</span>
                                </div>

                                {/* Google Sign-In */}
                                <button
                                    type="button"
                                    className={styles.googleBtn}
                                    onClick={handleGoogleLogin}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                    </svg>
                                    <span>เข้าสู่ระบบด้วย Google</span>
                                </button>
                            </div>
                        )}

                        {infoMsg && (
                            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', padding: '10px 14px', borderRadius: 12, fontSize: '0.82rem', fontWeight: 600 }}>
                                {infoMsg}
                            </div>
                        )}

                        {errorMsg && <div className={styles.errorBox}>{errorMsg}</div>}
                    </div>
                )}

                <p className={styles.footerHint}>
                    การเข้าใช้งานหมายถึงคุณยอมรับข้อตกลงการให้บริการของ Foami
                </p>
            </div>
        </div>
    )
}
