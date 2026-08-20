'use client'
import Link from 'next/link'
import { 
    Store,
    UserCircle, 
    ShieldCheck, 
    Crown,
    ArrowRight,
    Sparkles,
    Smartphone
} from 'lucide-react'

import Logo from '@/components/Branding/Logo'

export default function PortalPage() {
    const portals = [
        {
            title: 'Customer App',
            subtitle: 'Marketplace & Booking',
            description: 'ระบบจองบริการล้างรถ ค้นหาร้านใกล้เคียง และติดตามสถานะเรียลไทม์',
            href: '/search',
            icon: Smartphone,
            badge: 'ผู้ใช้งาน',
            badgeColor: '#D946EF',
            badgeBg: 'var(--accent-pink-ghost)',
            themeColor: 'var(--accent-pink-dark)',
            themeBg: 'var(--accent-pink-ghost)',
            borderColor: 'var(--accent-pink)',
        },
        {
            title: 'Staff Dashboard',
            subtitle: 'Rider & Cleaner App',
            description: 'สำหรับพนักงานและไรเดอร์ รับงาน อัปเดตรูปถ่าย และดูกะงานประจำวัน',
            href: '/staff/dashboard',
            icon: UserCircle,
            badge: 'ทีมงาน',
            badgeColor: '#0284C7',
            badgeBg: 'var(--accent-blue-ghost)',
            themeColor: '#0284C7',
            themeBg: 'var(--accent-blue-ghost)',
            borderColor: 'var(--brand-subordinate)',
        },
        {
            title: 'Shop Admin',
            subtitle: 'Branch Management',
            description: 'ระบบจัดการร้าน คิวงาน ทีมงาน บริการ ราคา ส่วนลด และยอดเงินสาขา',
            href: '/admin/dashboard',
            icon: Store,
            badge: 'เจ้าของร้าน',
            badgeColor: 'var(--brand-dominant)',
            badgeBg: 'var(--primary-ghost)',
            themeColor: 'var(--brand-dominant)',
            themeBg: 'var(--primary-ghost)',
            borderColor: 'var(--border)',
        },
        {
            title: 'Platform Admin',
            subtitle: 'Super Admin HQ',
            description: 'ศูนย์ควบคุมแพลตฟอร์ม Foami ดูภาพรวมทุกร้าน อนุมัติถอนเงิน และเทียบเชิญ',
            href: '/admin/platform',
            icon: Crown,
            badge: 'Super Admin',
            badgeColor: '#D97706',
            badgeBg: '#FFFBEB',
            themeColor: '#D97706',
            themeBg: '#FFFBEB',
            borderColor: '#FDE68A',
        },
    ]

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(180deg, #F0F4FC 0%, var(--bg) 100%)',
            padding: '48px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-kanit, "Kanit", sans-serif)'
        }}>
            <div style={{ maxWidth: 500, width: '100%' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                        <Logo width={170} />
                    </div>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'var(--primary-ghost)',
                        border: '1px solid var(--border)',
                        padding: '4px 14px',
                        borderRadius: 9999,
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--brand-dominant)',
                        marginBottom: 10
                    }}>
                        <Sparkles size={13} color="var(--brand-dominant)" /> Foami Platform 2.0
                    </div>
                    <h1 style={{ 
                        fontSize: '1.85rem', 
                        fontWeight: 800, 
                        color: 'var(--text-primary)', 
                        letterSpacing: '-0.02em', 
                        margin: '0 0 6px 0' 
                    }}>
                        Foami Operations Portal
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 400, margin: 0 }}>
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
                                className="card"
                                style={{ 
                                    padding: '18px 20px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 16,
                                    background: 'var(--surface)',
                                    border: '1.5px solid var(--border)',
                                    borderRadius: 18,
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 14px rgba(49, 94, 195, 0.05)'
                                }} 
                                onMouseOver={e => {
                                    e.currentTarget.style.transform = 'translateY(-3px)'
                                    e.currentTarget.style.borderColor = item.borderColor
                                    e.currentTarget.style.boxShadow = '0 10px 24px rgba(49, 94, 195, 0.12)'
                                }} 
                                onMouseOut={e => {
                                    e.currentTarget.style.transform = 'translateY(0)'
                                    e.currentTarget.style.borderColor = 'var(--border)'
                                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(49, 94, 195, 0.05)'
                                }}
                            >
                                <div style={{ 
                                    width: 50, 
                                    height: 50, 
                                    background: item.themeBg, 
                                    color: item.themeColor, 
                                    borderRadius: 14, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <Icon size={24} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                                            {item.title}
                                        </span>
                                        <span style={{ 
                                            fontSize: 11, 
                                            fontWeight: 600, 
                                            padding: '2px 8px', 
                                            borderRadius: 9999,
                                            background: item.badgeBg,
                                            color: item.badgeColor,
                                            border: `1px solid ${item.badgeColor}25`
                                        }}>
                                            {item.badge}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                        {item.description}
                                    </div>
                                </div>
                                <ArrowRight size={18} color="var(--border-dark)" style={{ flexShrink: 0 }} />
                            </Link>
                        )
                    })}
                </div>

                {/* Footer */}
                <div style={{ textAlign: 'center', marginTop: 32 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Foami Multi-Tenant Platform &copy; 2026 &bull; All Rights Reserved
                    </p>
                </div>
            </div>
        </div>
    )
}
