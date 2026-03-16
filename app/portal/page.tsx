'use client'
import Link from 'next/link'
import { 
    LayoutDashboard, 
    UserCircle, 
    ShieldCheck, 
    ArrowRight,
    Sparkles,
    Smartphone
} from 'lucide-react'

import Logo from '@/components/Branding/Logo'

export default function PortalPage() {
    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'var(--bg)', 
            padding: 'var(--space-8) var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
        }}>
            <div style={{ maxWidth: 400, width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
                    <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'center' }}>
                        <Logo width={160} />
                    </div>
                    <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Foami Portal</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-2)', fontWeight: 500 }}>
                        เลือกเวอร์ชันแอปเพื่อเข้าใช้งาน
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Customer App */}
                    <Link href="/login" className="card" style={{ 
                        padding: 'var(--space-6)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 'var(--space-4)',
                        transition: 'transform 0.2s',
                        cursor: 'pointer'
                    }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                        <div style={{ 
                            width: 56, 
                            height: 56, 
                            background: 'var(--accent-pink-ghost)', 
                            color: 'var(--accent-pink-dark)', 
                            borderRadius: 16, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                        }}>
                            <Smartphone size={28} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Customer App</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Main booking app for customers</div>
                        </div>
                        <ArrowRight size={20} color="var(--border-dark)" />
                    </Link>

                    {/* Staff App */}
                    <Link href="/staff/dashboard" className="card" style={{ 
                        padding: 'var(--space-6)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 'var(--space-4)',
                        transition: 'transform 0.2s',
                        cursor: 'pointer'
                    }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                        <div style={{ 
                            width: 56, 
                            height: 56, 
                            background: 'var(--accent-blue-ghost)', 
                            color: 'var(--accent-blue-dark)', 
                            borderRadius: 16, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                        }}>
                            <UserCircle size={28} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Staff Dashboard</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>For Foami riders & cleaners</div>
                        </div>
                        <ArrowRight size={20} color="var(--border-dark)" />
                    </Link>

                    {/* Admin App */}
                    <Link href="/admin/dashboard" className="card" style={{ 
                        padding: 'var(--space-6)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 'var(--space-4)',
                        transition: 'transform 0.2s',
                        cursor: 'pointer'
                    }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                        <div style={{ 
                            width: 56, 
                            height: 56, 
                            background: 'var(--primary-ghost)', 
                            color: 'var(--primary)', 
                            borderRadius: 16, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                        }}>
                            <ShieldCheck size={28} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Admin Console</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Full system management</div>
                        </div>
                        <ArrowRight size={20} color="var(--border-dark)" />
                    </Link>
                </div>

                <div style={{ textAlign: 'center', marginTop: 'var(--space-12)' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.6 }}>
                        Foami Operations Portal &copy; 2026
                    </p>
                </div>
            </div>
        </div>
    )
}
