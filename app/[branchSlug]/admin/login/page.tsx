'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import styles from '@/app/admin/login/login.module.css'
import Logo from '@/components/Branding/Logo'

export default function ShopAdminLoginPage() {
    const router = useRouter()
    const params = useParams()
    const branchSlug = (params?.branchSlug as string) || ''

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const res = await fetch('/api/auth/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, branch_slug: branchSlug }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Login failed')

            localStorage.setItem('shop_admin_token', data.token)
            if (data.staff) {
                localStorage.setItem('shop_admin_info', JSON.stringify(data.staff))
            }
            router.replace(`/${branchSlug}/admin/dashboard`)
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
                <p className={styles.sub} style={{ marginBottom: 4 }}>สาขา: <strong style={{ color: 'var(--brand-dominant)' }}>{branchSlug.toUpperCase()}</strong></p>

                <form onSubmit={handleLogin} className={styles.form}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>อีเมล</label>
                        <input
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="washgo.kk@gmail.com"
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
                    <button
                        type="submit"
                        className="btn btn-primary btn-full btn-lg"
                        style={{ marginTop: 12, height: 54, fontWeight: 800 }}
                        disabled={loading}
                    >
                        {loading ? <span className="spinner" /> : 'เข้าสู่ระบบ'}
                    </button>
                </form>
            </div>
        </div>
    )
}
