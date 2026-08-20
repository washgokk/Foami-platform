'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './login.module.css'
import Logo from '@/components/Branding/Logo'
import { Crown, ArrowRight } from 'lucide-react'

export default function AdminLoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const isMockForced = typeof window !== 'undefined' && localStorage.getItem('foami_mock_db_enabled') === 'true' && process.env.NODE_ENV !== 'production'
            if (isMockForced) {
                if (email === 'admin@foami.th' && password === 'admin123') {
                    localStorage.setItem('admin_token', 'mock_admin_token')
                    router.replace('/admin/dashboard')
                    return
                } else {
                    throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง (Mock DB: ใช้ admin@foami.th / admin123)')
                }
            }

            const res = await fetch('/api/auth/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Login failed')
            localStorage.setItem('admin_token', data.token || 'admin_token_' + Date.now())
            router.replace('/admin/dashboard')
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.logoWrapper}>
                    <Logo width={160} />
                </div>
                <h1 className={styles.title}>Shop Admin Portal</h1>
                <p className={styles.sub}>ระบบจัดการร้านและคิวงานบริการ Foami</p>

                <form onSubmit={handleLogin} className={styles.form}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>อีเมลแอดมิน</label>
                        <input
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="admin@foami.th"
                            required
                        />
                    </div>
                    <div className="form-group" style={{ marginTop: 12 }}>
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>รหัสผ่าน</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    {error && <div className="alert alert-error" style={{ fontSize: '0.85rem', marginTop: 12 }}>{error}</div>}
                    <button type="submit" className="btn btn-primary btn-full btn-lg" style={{ marginTop: 16, height: 50, fontWeight: 800 }} disabled={loading}>
                        {loading ? <span className="spinner" /> : 'เข้าสู่ระบบ'}
                    </button>
                </form>

                <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <Link 
                        href="/admin/platform/login" 
                        style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 6, 
                            fontSize: 13, 
                            color: '#D97706', 
                            fontWeight: 600,
                            textDecoration: 'none' 
                        }}
                    >
                        <Crown size={15} /> เข้าสู่ระบบ Platform Super Admin <ArrowRight size={13} />
                    </Link>
                </div>
            </div>
        </div>
    )
}