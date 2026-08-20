'use client'
import Link from 'next/link'
import { 
    Store,
    UserCircle, 
    ShieldCheck, 
    Crown,
    ArrowRight,
    Sparkles,
    Smartphone,
    Layers,
    BadgePercent
} from 'lucide-react'

import Logo from '@/components/Branding/Logo'

export default function PortalPage() {
    const portals = [
        {
            title: 'Customer App',
            subtitle: 'Marketplace & Booking',
            description: 'ระบบจองบริการล้างรถ ค้นหาร้านใกล้เคียง และติดตามสถานะ',
            href: '/search',
            icon: Smartphone,
            badge: 'ผู้ใช้งาน',
            badgeColor: '#10B981',
            badgeBg: 'rgba(16, 185, 129, 0.1)',
            themeColor: '#0ea5e9',
            themeBg: 'rgba(14, 165, 233, 0.1)',
            borderColor: 'rgba(14, 165, 233, 0.25)',
        },
        {
            title: 'Staff Dashboard',
            subtitle: 'Rider & Cleaner App',
            description: 'สำหรับพนักงานและไรเดอร์ รับงาน อัปเดตรูปถ่าย และดูกะงาน',
            href: '/staff/dashboard',
            icon: UserCircle,
            badge: 'ทีมงาน',
            badgeColor: '#3B82F6',
            badgeBg: 'rgba(59, 130, 246, 0.1)',
            themeColor: '#3b82f6',
            themeBg: 'rgba(59, 130, 246, 0.1)',
            borderColor: 'rgba(59, 130, 246, 0.25)',
        },
        {
            title: 'Shop Admin',
            subtitle: 'Branch Management',
            description: 'ระบบจัดการร้าน คิวงาน ทีมงาน ราคา ส่วนลด และยอดเงินร้าน',
            href: '/admin/dashboard',
            icon: Store,
            badge: 'เจ้าของร้าน',
            badgeColor: '#8B5CF6',
            badgeBg: 'rgba(139, 92, 246, 0.1)',
            themeColor: '#8b5cf6',
            themeBg: 'rgba(139, 92, 246, 0.1)',
            borderColor: 'rgba(139, 92, 246, 0.25)',
        },
        {
            title: 'Platform Admin',
            subtitle: 'Super Admin HQ',
            description: 'ศูนย์ควบคุมแพลตฟอร์ม Foami ดูภาพรวมทุกร้าน อนุมัติถอนเงิน และเทียบเชิญ',
            href: '/admin/platform',
            icon: Crown,
            badge: 'Super Admin',
            badgeColor: '#F59E0B',
            badgeBg: 'rgba(245, 158, 11, 0.12)',
            themeColor: '#f59e0b',
            themeBg: 'rgba(245, 158, 11, 0.1)',
            borderColor: 'rgba(245, 158, 11, 0.3)',
        },
    ]

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)',
            color: '#f8fafc',
            padding: '40px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            <div style={{ maxWidth: 520, width: '100%' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                        <Logo width={160} />
                    </div>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        padding: '4px 12px',
                        borderRadius: 9999,
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#38bdf8',
                        marginBottom: 12,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase'
                    }}>
                        <Sparkles size={13} /> Foami Platform 2.0
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>
                        Foami Operations Portal
                    </h1>
                    <p style={{ color: '#94a3b8', marginTop: 8, fontSize: 14, fontWeight: 400 }}>
                        เลือกพอร์ทัลเพื่อเข้าสู่ระบบตามบทบาทการทำงาน
                    </p>
                </div>

                {/* Grid of 4 Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {portals.map((item, idx) => {
                        const Icon = item.icon
                        return (
                            <Link 
                                key={idx}
                                href={item.href} 
                                style={{ 
                                    padding: '18px 20px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 16,
                                    background: 'rgba(30, 41, 59, 0.7)',
                                    backdropFilter: 'blur(12px)',
                                    border: `1px solid ${item.borderColor}`,
                                    borderRadius: 16,
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.25)'
                                }} 
                                onMouseOver={e => {
                                    e.currentTarget.style.transform = 'translateY(-3px)'
                                    e.currentTarget.style.background = 'rgba(30, 41, 59, 0.95)'
                                    e.currentTarget.style.boxShadow = `0 12px 28px -4px ${item.themeBg}`
                                }} 
                                onMouseOut={e => {
                                    e.currentTarget.style.transform = 'translateY(0)'
                                    e.currentTarget.style.background = 'rgba(30, 41, 59, 0.7)'
                                    e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(0, 0, 0, 0.25)'
                                }}
                            >
                                <div style={{ 
                                    width: 48, 
                                    height: 48, 
                                    background: item.themeBg, 
                                    color: item.themeColor, 
                                    borderRadius: 12, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <Icon size={24} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                        <span style={{ fontWeight: 800, fontSize: 16, color: '#f8fafc' }}>
                                            {item.title}
                                        </span>
                                        <span style={{ 
                                            fontSize: 11, 
                                            fontWeight: 700, 
                                            padding: '2px 8px', 
                                            borderRadius: 9999,
                                            background: item.badgeBg,
                                            color: item.badgeColor,
                                            border: `1px solid ${item.badgeColor}33`
                                        }}>
                                            {item.badge}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                                        {item.description}
                                    </div>
                                </div>
                                <ArrowRight size={18} color="#64748b" style={{ flexShrink: 0 }} />
                            </Link>
                        )
                    })}
                </div>

                {/* Footer */}
                <div style={{ textAlign: 'center', marginTop: 32 }}>
                    <p style={{ fontSize: 12, color: '#64748b' }}>
                        Foami Multi-Tenant Platform &copy; 2026 &bull; All Rights Reserved
                    </p>
                </div>
            </div>
        </div>
    )
}
