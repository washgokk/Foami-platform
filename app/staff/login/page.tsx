'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './login.module.css'

export default function StaffLoginPage() {
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
                const staffs = JSON.parse(localStorage.getItem('foami_mock_db_staff') || '[]')
                const staff = staffs.find((s: any) => s.email === email)
                if (staff) {
                    localStorage.setItem('staff_token', 'mock_staff_token_' + staff.id)
                    localStorage.setItem('staff_data', JSON.stringify(staff))
                    router.replace('/staff/dashboard')
                    return
                } else {
                    throw new Error('ไม่พบบัญชีอีเมลนี้ใน Mock DB (ต้องไปเพิ่มพนักงานในหน้า Admin ก่อน)')
                }
            }

            const res = await fetch('/api/auth/staff-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            localStorage.setItem('staff_token', data.token)
            localStorage.setItem('staff_data', JSON.stringify(data.staff))
            router.replace('/staff/dashboard')
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.logo}>🫧</div>
                <h1 className={styles.title}>Foami Staff</h1>
                <p className={styles.sub}>ระบบพนักงาน</p>
                <form onSubmit={handleLogin} className={styles.form}>
                    <div className="form-group">
                        <label className="form-label">อีเมล</label>
                        <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@foami.th" required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">รหัสผ่าน</label>
                        <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                    </div>
                    {error && <div className="alert alert-error">{error}</div>}
                    <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                        {loading ? <span className="spinner" /> : '🔐 เข้าสู่ระบบ'}
                    </button>
                </form>
            </div>
        </div>
    )
}
