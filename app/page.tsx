'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Branding/Logo'
import {
  MapPin,
  Calendar,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  Search,
  CheckCircle2,
  Layers,
  Store,
  ChevronRight,
  LogIn,
  Users,
  Compass,
  Award,
  GraduationCap,
  Lightbulb,
  HeartHandshake
} from 'lucide-react'

// Foami Brand CI Design Tokens
const C = {
  bg: '#F6F8FF',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F4FC',
  border: '#DDE3F5',
  borderLight: '#EEF2FA',
  primary: '#315EC3',
  primaryHover: '#2449A3',
  primaryLight: '#EDF3FF',
  subordinate: '#A0D9F6',
  subordinateLight: '#F0F9FE',
  textPrimary: '#1A2340',
  textSecondary: '#5A6589',
  textMuted: '#8A96B2',
}

const STEPS = [
  {
    step: '01',
    title: 'ค้นหาศูนย์บริการ',
    desc: 'ค้นหาศูนย์บริการในพื้นที่ของคุณผ่านระบบแผนที่ ระบุระยะทาง และตำแหน่งที่ตั้งที่ชัดเจน',
    icon: Compass,
  },
  {
    step: '02',
    title: 'เลือกบริการและเวลานัดหมาย',
    desc: 'เลือกรายการบริการที่ต้องการ พร้อมตรวจสอบตารางเวลาว่างของศูนย์บริการได้แบบเรียลไทม์',
    icon: Calendar,
  },
  {
    step: '03',
    title: 'เข้ารับบริการตรงตามนัด',
    desc: 'นำรถเข้ารับบริการตามเวลาที่จองไว้ ช่างผู้เชี่ยวชาญพร้อมให้บริการทันทีโดยไม่ต้องรอคิว',
    icon: CheckCircle2,
  },
]

const STANDARDS = [
  {
    icon: ShieldCheck,
    title: 'ศูนย์บริการผ่านการตรวจสอบ',
    desc: 'พาร์ทเนอร์ในระบบ Foami ผ่านการตรวจเช็คมาตรฐานเครื่องมือ ผลิตภัณฑ์ และขั้นตอนการปฏิบัติงาน',
  },
  {
    icon: Clock,
    title: 'บริหารเวลาอย่างแม่นยำ',
    desc: 'ระบบจัดการคิวมาตรฐาน ช่วยให้คุณวางแผนเวลาได้แน่นอน ไม่ต้องเสียเวลานั่งรอคิวหน้าร้าน',
  },
  {
    icon: Layers,
    title: 'ระบบบันทึกประวัติการดูแลรถ',
    desc: 'จัดเก็บข้อมูลประวัติการรับบริการผ่านบัญชีของคุณ เพื่อการดูแลและติดตามสภาพยานยนต์อย่างต่อเนื่อง',
  },
  {
    icon: Users,
    title: 'ทีมงานประสานงานช่วยเหลือ',
    desc: 'มีทีมงานสนับสนุนพร้อมให้คำปรึกษาและดูแลความสะดวกตลอดการใช้งานระบบ',
  },
]

export default function LandingPage() {
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('liff_customer')
      if (raw) {
        const data = JSON.parse(raw)
        const branch = data?.last_branch_slug
        if (branch) {
          window.location.href = `/${branch}/menu`
          return
        }
      }
    } catch { }
    setSessionChecked(true)
  }, [])

  if (!sessionChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{
          width: 38,
          height: 38,
          border: `3.5px solid ${C.border}`,
          borderTopColor: C.primary,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Kanit, sans-serif', color: C.textPrimary, overflowX: 'hidden' }}>
      
      {/* ─── TOPBAR ─── */}
      <header style={{
        background: C.surface,
        borderBottom: `2.5px solid ${C.subordinate}`,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 2px 10px rgba(49, 94, 195, 0.05)'
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}>
          {/* Brand Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <Logo variant="landscape" width={130} />
          </Link>

          {/* Desktop Navigation Links */}
          <nav style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }} className="desktop-nav">
            <a href="#how-it-works" style={{ color: C.textSecondary, textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'color 0.2s' }}>
              ขั้นตอนการใช้งาน
            </a>
            <a href="#standards" style={{ color: C.textSecondary, textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'color 0.2s' }}>
              มาตรฐาน Foami
            </a>
            <a href="#team-project" style={{ color: C.primary, textDecoration: 'none', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <GraduationCap size={16} />
              <span>โปรเจกต์นักศึกษา KKU</span>
            </a>
            <Link href="/partner" style={{ color: C.textSecondary, textDecoration: 'none', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Store size={15} style={{ color: C.primary }} />
              <span>ติดต่อสนใจเป็น Partner</span>
            </Link>
          </nav>

          {/* Action CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link
              href="/search"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 16px',
                borderRadius: 10,
                border: `1.5px solid ${C.primary}`,
                color: C.primary,
                background: C.surface,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.15s'
              }}
            >
              <Search size={15} />
              <span>ค้นหาร้าน</span>
            </Link>

            <Link
              href="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 18px',
                borderRadius: 10,
                border: 'none',
                background: C.primary,
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(49, 94, 195, 0.25)',
                transition: 'all 0.15s'
              }}
            >
              <LogIn size={15} />
              <span>เข้าสู่ระบบ</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION ─── */}
      <section style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '48px 20px 36px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 40,
          alignItems: 'center'
        }}>
          {/* Left Column: Value Prop */}
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 24,
              background: C.primaryLight,
              border: `1px solid ${C.subordinate}`,
              color: C.primary,
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 20
            }}>
              <GraduationCap size={15} />
              <span>KKU Digital Entrepreneurship Project · KKBS</span>
            </div>

            <h1 style={{
              fontSize: 'clamp(28px, 4.2vw, 44px)',
              lineHeight: 1.25,
              fontWeight: 700,
              color: C.textPrimary,
              margin: '0 0 16px',
              letterSpacing: '-0.02em'
            }}>
              ยกระดับการดูแลรถของคุณ <br />
              <span style={{ color: C.primary }}>สะดวกรวดเร็ว ไม่ต้องรอคิว</span>
            </h1>

            <p style={{
              fontSize: 'clamp(15px, 2vw, 17px)',
              lineHeight: 1.6,
              color: C.textSecondary,
              margin: '0 0 32px',
              maxWidth: 520
            }}>
              เชื่อมโยงคุณเข้ากับศูนย์บริการยานยนต์ที่ได้มาตรฐาน ตรวจสอบช่วงเวลาว่าง นัดหมายเข้ารับบริการล่วงหน้า และติดตามสถานะได้ทันที
            </p>

            {/* Main Action Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              <Link
                href="/search"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '14px 28px',
                  borderRadius: 12,
                  background: C.primary,
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: 600,
                  textDecoration: 'none',
                  boxShadow: '0 4px 16px rgba(49, 94, 195, 0.3)',
                  transition: 'background 0.2s'
                }}
              >
                <MapPin size={18} />
                <span>ค้นหาร้านใกล้ฉัน</span>
                <ArrowRight size={16} />
              </Link>

              <Link
                href="/partner"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '14px 24px',
                  borderRadius: 12,
                  background: C.surface,
                  border: `1.5px solid ${C.border}`,
                  color: C.textPrimary,
                  fontSize: 16,
                  fontWeight: 600,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s'
                }}
              >
                <Store size={18} style={{ color: C.primary }} />
                <span>ติดต่อสนใจเป็น Partner</span>
              </Link>
            </div>

            {/* Trust Points */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 20,
              marginTop: 32,
              paddingTop: 24,
              borderTop: `1px solid ${C.border}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textSecondary, fontWeight: 500 }}>
                <CheckCircle2 size={16} style={{ color: C.primary }} />
                <span>ไม่ต้องดาวน์โหลดแอปพลิเคชัน</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textSecondary, fontWeight: 500 }}>
                <CheckCircle2 size={16} style={{ color: C.primary }} />
                <span>จองคิวออนไลน์ได้ทันที</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textSecondary, fontWeight: 500 }}>
                <CheckCircle2 size={16} style={{ color: C.primary }} />
                <span>มาตรฐาน Foami CI</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual - Foami App Mockup */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <div style={{
              background: 'linear-gradient(180deg, #FFFFFF 0%, #F0F6FD 100%)',
              borderRadius: 24,
              padding: '24px 20px 18px',
              border: `2px solid ${C.subordinate}`,
              boxShadow: '0 16px 36px rgba(49, 94, 195, 0.12)',
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
              maxWidth: 480,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <img
                src="/landing-hero.png"
                alt="ระบบแอปพลิเคชัน Foami Wash & Delivery บนสมาร์ทโฟน"
                style={{
                  width: '100%',
                  maxWidth: 400,
                  height: 'auto',
                  display: 'block',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 14px 28px rgba(49, 94, 195, 0.16))'
                }}
              />
              <div style={{
                width: '100%',
                paddingTop: 16,
                borderTop: `1px solid ${C.border}`,
                marginTop: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
                    Foami Web Application
                  </div>
                  <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                    จองง่ายผ่านสมาร์ทโฟน ไม่ต้องดาวน์โหลดแอปพลิเคชัน
                  </div>
                </div>
                <div style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  background: C.subordinateLight,
                  border: `1px solid ${C.subordinate}`,
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.primary,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <Sparkles size={13} />
                  <span>Mobile First</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SEARCH GATEWAY BAR ─── */}
      <section style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 20px 48px',
      }}>
        <div style={{
          background: C.surface,
          borderRadius: 18,
          border: `1.5px solid ${C.border}`,
          padding: '24px 28px',
          boxShadow: '0 6px 20px rgba(49, 94, 195, 0.06)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20
        }}>
          <div style={{ flex: '1 1 300px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              สำรวจศูนย์บริการใกล้คุณ
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary }}>
              ค้นหาร้านล้างและดูแลมอเตอร์ไซค์ในพื้นที่ของคุณ
            </div>
            <div style={{ fontSize: 14, color: C.textSecondary, marginTop: 4 }}>
              ตรวจสอบศูนย์บริการที่เปิดให้บริการ รอบคิวว่าง และรายละเอียดการบริการได้ทันที
            </div>
          </div>

          <div>
            <Link
              href="/search"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 28px',
                borderRadius: 12,
                background: C.primary,
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(49, 94, 195, 0.25)',
                transition: 'background 0.2s'
              }}
            >
              <Search size={17} />
              <span>เปิดระบบค้นหาร้านค้า</span>
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" style={{
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: '64px 20px'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 48px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 20,
              background: C.primaryLight,
              color: C.primary,
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 12
            }}>
              ขั้นตอนการใช้งาน
            </div>
            <h2 style={{ fontSize: 'clamp(24px, 3.2vw, 34px)', fontWeight: 700, color: C.textPrimary, margin: '0 0 12px' }}>
              จองคิวสะดวกใน 3 ขั้นตอน
            </h2>
            <p style={{ fontSize: 15, color: C.textSecondary, margin: 0, lineHeight: 1.6 }}>
              ระบบถูกออกแบบมาเพื่อให้การเข้ารับบริการยานยนต์ของคุณเป็นเรื่องง่าย รวดเร็ว และเป็นระบบ
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24
          }}>
            {STEPS.map((item, idx) => {
              const IconComp = item.icon
              return (
                <div
                  key={idx}
                  style={{
                    background: C.bg,
                    borderRadius: 16,
                    border: `1.5px solid ${C.border}`,
                    padding: 28,
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 20
                  }}>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: C.surface,
                      border: `1.5px solid ${C.subordinate}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: C.primary
                    }}>
                      <IconComp size={22} />
                    </div>
                    <span style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: C.subordinate,
                      letterSpacing: '-0.02em'
                    }}>
                      {item.step}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, margin: '0 0 8px' }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, margin: 0, flex: 1 }}>
                    {item.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── FOAMI QUALITY STANDARDS ─── */}
      <section id="standards" style={{
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: '64px 20px'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 48px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 20,
              background: C.primaryLight,
              color: C.primary,
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 12
            }}>
              ความมั่นใจในบริการ
            </div>
            <h2 style={{ fontSize: 'clamp(24px, 3.2vw, 34px)', fontWeight: 700, color: C.textPrimary, margin: '0 0 12px' }}>
              มาตรฐานการทำงานของ Foami
            </h2>
            <p style={{ fontSize: 15, color: C.textSecondary, margin: 0, lineHeight: 1.6 }}>
              มุ่งเน้นการสร้างระบบการดูแลยานยนต์ที่โปร่งใส ตรวจสอบได้ และส่งมอบงานคุณภาพในทุกขั้นตอน
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 24
          }}>
            {STANDARDS.map((std, idx) => {
              const IconComp = std.icon
              return (
                <div
                  key={idx}
                  style={{
                    background: C.bg,
                    borderRadius: 16,
                    border: `1.5px solid ${C.border}`,
                    padding: 24
                  }}
                >
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: C.surface,
                    border: `1.5px solid ${C.subordinate}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: C.primary,
                    marginBottom: 16
                  }}>
                    <IconComp size={22} />
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary, margin: '0 0 8px' }}>
                    {std.title}
                  </h3>
                  <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>
                    {std.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── ABOUT KKU STUDENT PROJECT & FOUNDER TEAM ─── */}
      <section id="team-project" style={{ padding: '72px 20px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          background: C.surface,
          borderRadius: 24,
          border: `1.5px solid ${C.border}`,
          padding: '44px 36px',
          boxShadow: '0 12px 32px rgba(49, 94, 195, 0.06)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 40,
            alignItems: 'center'
          }}>
            {/* Left Column: Inspiring Profile & Student Innovation Story */}
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 14px',
                borderRadius: 20,
                background: C.primaryLight,
                color: C.primary,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 16,
                border: `1px solid ${C.subordinate}`
              }}>
                <GraduationCap size={16} />
                <span>นักศึกษาชั้นปีที่ 4 มหาวิทยาลัยขอนแก่น</span>
              </div>

              <h2 style={{ fontSize: 'clamp(22px, 3.2vw, 32px)', fontWeight: 700, color: C.textPrimary, margin: '0 0 16px', lineHeight: 1.3 }}>
                จากโปรเจกต์ผู้ประกอบการดิจิทัล <br />
                <span style={{ color: C.primary }}>สู่แพลตฟอร์มยกระดับการดูแลยานยนต์จริง</span>
              </h2>

              <p style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.7, margin: '0 0 16px' }}>
                <strong>Foami</strong> เริ่มต้นขึ้นจากพลังความมุ่งมั่นของ <strong>กลุ่มนักศึกษาชั้นปีที่ 4 สาขาผู้ประกอบการดิจิทัล คณะบริหารธุรกิจและการบัญชี (KKBS) มหาวิทยาลัยขอนแก่น</strong> ที่ตั้งใจนำองค์ความรู้ด้านธุรกิจ การจัดการระบบการเงิน และเทคโนโลยีดิจิทัล มาแก้ไขปัญหาที่เกิดขึ้นจริงในชีวิตประจำวัน
              </p>

              {/* 3 Value Pillars of the Project */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '20px 0 28px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: C.bg,
                  border: `1px solid ${C.borderLight}`
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: C.primaryLight,
                    color: C.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Lightbulb size={17} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>การแก้ปัญหาจากชีวิตจริง (Real-world Problem)</div>
                    <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
                      สำรวจ Pain Point ของผู้ใช้รถที่เสียเวลารอคิวหน้าร้าน และศูนย์บริการขนาดเล็กที่ขาดระบบจัดการคิวมาตรฐาน
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: C.bg,
                  border: `1px solid ${C.borderLight}`
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: C.subordinateLight,
                    color: C.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Award size={17} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>การสร้าง Brand & Service Guidelines</div>
                    <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
                      วางแผนคู่มือมาตรฐานการปฏิบัติงาน Foami ทั้งด้านเอกลักษณ์แบรนด์ ขั้นตอนล้างรถ และการบริการรับ-ส่ง
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: C.bg,
                  border: `1px solid ${C.borderLight}`
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: C.primaryLight,
                    color: C.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <HeartHandshake size={17} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>สนับสนุนผู้ประกอบการท้องถิ่น</div>
                    <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
                      ช่วยให้ร้านค้ารายย่อยมีเครื่องมือดิจิทัลบริหารคิว เพิ่มความน่าเชื่อถือ และขยายฐานลูกค้าได้อย่างยั่งยืน
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <Link
                  href="/search"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 22px',
                    borderRadius: 10,
                    background: C.primary,
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: 'none',
                    boxShadow: '0 2px 10px rgba(49, 94, 195, 0.2)'
                  }}
                >
                  <MapPin size={16} />
                  <span>ค้นหาศูนย์บริการ</span>
                </Link>
                
                <Link
                  href="/partner"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 20px',
                    borderRadius: 10,
                    background: C.bg,
                    border: `1.5px solid ${C.border}`,
                    color: C.textPrimary,
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  <Store size={16} style={{ color: C.primary }} />
                  <span>ติดต่อสนใจเป็น Partner</span>
                </Link>
              </div>
            </div>

            {/* Right Column: Cropped Team Photo Focused on People & Brand Guidelines */}
            <div>
              <div style={{
                borderRadius: 20,
                overflow: 'hidden',
                border: `2px solid ${C.subordinate}`,
                boxShadow: '0 12px 32px rgba(49, 94, 195, 0.12)',
                background: C.surface
              }}>
                <img
                  src="/landing-team-cropped.jpg"
                  alt="ทีมนักศึกษาผู้พัฒนา Foami สาขาผู้ประกอบการดิจิทัล คณะบริหารธุรกิจและการบัญชี มหาวิทยาลัยขอนแก่น"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    objectFit: 'cover'
                  }}
                />
                <div style={{
                  padding: '16px 18px',
                  background: C.surface,
                  borderTop: `1px solid ${C.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
                      ทีมผู้พัฒนาโครงการ Foami
                    </div>
                    <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                      สาขาผู้ประกอบการดิจิทัล คณะบริหารธุรกิจและการบัญชี ม.ขอนแก่น
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: C.subordinateLight,
                    border: `1px solid ${C.subordinate}`,
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.primary,
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <GraduationCap size={13} />
                    <span>KKBS KKU</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FINAL CALL TO ACTION ─── */}
      <section style={{ padding: '0 20px 64px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.primary} 0%, #204597 100%)`,
          borderRadius: 24,
          padding: '48px 32px',
          textAlign: 'center',
          color: '#FFFFFF',
          boxShadow: '0 16px 36px rgba(49, 94, 195, 0.25)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 2, maxWidth: 640, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 700, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
              พร้อมสัมผัสประสบการณ์การดูแลรถที่สะดวกกว่าเดิมหรือยัง?
            </h2>
            <p style={{ fontSize: 16, color: C.subordinateLight, margin: '0 0 32px', lineHeight: 1.6, opacity: 0.95 }}>
              ค้นหาศูนย์บริการใกล้คุณ ตรวจสอบเวลาว่าง หรือติดต่อร่วมเป็นร้านค้าพาร์ทเนอร์ได้ทันที
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14 }}>
              <Link
                href="/search"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 30px',
                  borderRadius: 12,
                  background: '#FFFFFF',
                  color: C.primary,
                  fontSize: 16,
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
                }}
              >
                <MapPin size={18} />
                <span>ค้นหาร้านใกล้ฉัน</span>
                <ArrowRight size={16} />
              </Link>

              <Link
                href="/partner"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 26px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.12)',
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                <Store size={18} />
                <span>ติดต่อสนใจเป็น Partner</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        padding: '40px 20px 28px'
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 24,
          paddingBottom: 28,
          borderBottom: `1px solid ${C.borderLight}`
        }}>
          <div>
            <Logo variant="landscape" width={120} />
            <p style={{ fontSize: 13, color: C.textSecondary, margin: '10px 0 0', maxWidth: 420, lineHeight: 1.5 }}>
              แพลตฟอร์มค้นหาและนัดหมายบริการดูแลยานยนต์ · ผลงานพัฒนานวัตกรรมโดยนักศึกษาชั้นปีที่ 4 สาขาผู้ประกอบการดิจิทัล คณะบริหารธุรกิจและการบัญชี มหาวิทยาลัยขอนแก่น
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 14 }}>
            <Link href="/search" style={{ color: C.textSecondary, textDecoration: 'none' }}>
              ค้นหาร้านค้า
            </Link>
            <Link href="/partner" style={{ color: C.primary, textDecoration: 'none', fontWeight: 600 }}>
              ติดต่อสนใจเป็น Partner
            </Link>
            <Link href="/admin/login" style={{ color: C.textSecondary, textDecoration: 'none' }}>
              เข้าสู่ระบบร้านค้า
            </Link>
            <Link href="/login" style={{ color: C.textSecondary, textDecoration: 'none' }}>
              เข้าสู่ระบบสมาชิก
            </Link>
          </div>
        </div>

        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          paddingTop: 20,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          fontSize: 12,
          color: C.textMuted
        }}>
          <div>
            © 2026 Foami Wash & Delivery · KKBS Khon Kaen University
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
            <span>ระบบเปิดให้บริการตามปกติ</span>
          </div>
        </div>
      </footer>

      {/* Mobile Nav Media Query */}
      <style jsx>{`
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
        }
      `}</style>

    </div>
  )
}
