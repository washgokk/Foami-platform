'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './login.module.css'

import Logo from '@/components/Branding/Logo'

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
            if (localStorage.getItem('foami_mock_db_enabled') === 'true') {
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
            localStorage.setItem('admin_token', data.token)
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
                <h1 className={styles.title}>Admin Portal</h1>
                <p className={styles.sub}>Management & Analytics</p>

                <form onSubmit={handleLogin} className={styles.form}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>อีเมล</label>
                        <input
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="admin@foami.th"
                            required
                        />
                    </div>
                    <div className="form-group" style={{ marginTop: 8 }}>
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
                    {error && <div className="alert alert-error" style={{ fontSize: '0.85rem' }}>{error}</div>}
                    <button type="submit" className="btn btn-primary btn-full btn-lg" style={{ marginTop: 12, height: 54, fontWeight: 800 }} disabled={loading}>
                        {loading ? <span className="spinner" /> : 'เข้าสู่ระบบ'}
                    </button>
                </form>
                <p className={styles.hint}>Internal access only. Restricted for authorized personnel.</p>
            </div>
        </div>
    )
}
