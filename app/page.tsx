'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Branding/Logo'
import {
  MapPin, Star, ChevronRight, Clock,
  CheckCircle, Sparkles, Bike, Shield, Navigation2
} from 'lucide-react'

const STATS = [
  { value: '500+', label: 'ร้านค้า', hasStar: false },
  { value: '4.9', label: 'คะแนนเฉลี่ย', hasStar: true },
  { value: '10K+', label: 'ผู้ใช้งาน', hasStar: false },
]

const FEATURES = [
  {
    icon: <Navigation2 size={19} />,
    title: 'ค้นหาร้านใกล้บ้าน',
    desc: 'ระบบ GPS หาร้านที่ใกล้ที่สุดทันที',
  },
  {
    icon: <Clock size={19} />,
    title: 'จองง่าย ไม่กี่วินาที',
    desc: 'เลือกเวลา จอง เสร็จ ไม่ต้องโทรถาม',
  },
  {
    icon: <Bike size={19} />,
    title: 'รับ-ส่งถึงที่',
    desc: 'ช่างมาถึงบ้าน ไม่ต้องออกจากบ้าน',
  },
  {
    icon: <Shield size={19} />,
    title: 'การันตีคุณภาพ',
    desc: 'ตรวจสอบได้ทุกขั้นตอน ปลอดภัย 100%',
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
        window.location.href = branch ? `/${branch}/menu` : '/search'
        return
      }
    } catch { }
    setSessionChecked(true)
  }, [])

  if (!sessionChecked) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#F6F8FF',
        fontFamily: 'Kanit, sans-serif',
      }}>
        <div className="spinner-blue" style={{ width: 36, height: 36 }} />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F6F8FF',
      fontFamily: 'Kanit, sans-serif',
      overflowX: 'hidden',
      position: 'relative',
    }}>
      {/* Ambient bg blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -140, right: -120,
          width: 520, height: 520, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(49,94,195,0.09) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -80,
          width: 380, height: 380, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(160,217,246,0.12) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', top: '45%', right: -60,
          width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(241,191,219,0.08) 0%, transparent 70%)',
        }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto', padding: '0 20px 52px' }}>

        {/* ──────── HERO ──────── */}
        <div style={{ paddingTop: 52, textAlign: 'center', marginBottom: 28 }}>
          <div style={{ marginBottom: 24 }}>
            <Logo width={165} />
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 900, color: '#1A2340',
            margin: '0 0 10px', lineHeight: 1.35, letterSpacing: '-0.3px',
          }}>
            ล้างรถสะอาด<br />
            <span style={{ color: '#315EC3' }}>ส่งถึงบ้านคุณ</span>
          </h1>
          <p style={{
            fontSize: 14.5, color: '#5A6589', margin: 0, lineHeight: 1.75,
          }}>
            บริการดูแลมอเตอร์ไซค์พรีเมียม<br />
            จองง่าย ช่างมาถึงที่ ไม่ต้องเสียเวลา
          </p>
        </div>

        {/* ──────── STATS ──────── */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 8,
          marginBottom: 32, flexWrap: 'wrap',
        }}>
          {STATS.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#fff', border: '1px solid #DDE3F5',
              borderRadius: 100, padding: '7px 14px',
              boxShadow: '0 2px 8px rgba(49,94,195,0.06)',
            }}>
              {s.hasStar && (
                <Star size={13} fill="#F59E0B" strokeWidth={0} style={{ color: '#F59E0B' }} />
              )}
              <span style={{ fontWeight: 800, fontSize: 14, color: '#1A2340' }}>{s.value}</span>
              <span style={{ fontSize: 12, color: '#5A6589' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* ──────── CTA BUTTONS ──────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {/* Primary — Search nearby (no login) */}
          <Link href="/search" style={{ textDecoration: 'none' }}>
            <button
              id="btn-search-nearby"
              style={{
                width: '100%',
                padding: '16px 20px',
                borderRadius: 18,
                border: 'none',
                background: '#315EC3',
                color: '#fff',
                fontSize: 15.5,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: '0 8px 24px rgba(49,94,195,0.30)',
                fontFamily: 'Kanit, sans-serif',
                letterSpacing: '0.2px',
              }}
            >
              <MapPin size={18} />
              ค้นหาร้านใกล้ฉัน
              <ChevronRight size={18} style={{ opacity: 0.75 }} />
            </button>
          </Link>

          {/* Secondary — Login first */}
          <Link href="/login" style={{ textDecoration: 'none' }}>
            <button
              id="btn-login-line"
              style={{
                width: '100%',
                padding: '15px 20px',
                borderRadius: 18,
                border: '2px solid #DDE3F5',
                background: '#fff',
                color: '#315EC3',
                fontSize: 14.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
                fontFamily: 'Kanit, sans-serif',
              }}
            >
              <img
                src="https://cdnjs.cloudflare.com/ajax/libs/simple-icons/11.10.0/line.svg"
                alt="LINE"
                style={{
                  width: 18, height: 18,
                  filter: 'invert(25%) sepia(100%) saturate(500%) hue-rotate(100deg)',
                }}
              />
              เข้าสู่ระบบด้วย LINE ก่อน
            </button>
          </Link>
        </div>

        {/* ──────── INFO HINT ──────── */}
        <div style={{
          background: '#EFF3FD',
          border: '1px solid #DDE3F5',
          borderRadius: 16,
          padding: '13px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          marginBottom: 32,
        }}>
          <Sparkles size={16} style={{ color: '#315EC3', marginTop: 2, flexShrink: 0 }} />
          <p style={{ fontSize: 12.5, color: '#315EC3', margin: 0, lineHeight: 1.75, fontWeight: 500 }}>
            <strong>สำหรับผู้ใช้ใหม่:</strong> ดูร้านใกล้บ้านก่อนได้เลย ไม่ต้องล็อกอิน
            เมื่อจะจองค่อยล็อกอินด้วย LINE ได้ครับ
          </p>
        </div>

        {/* ──────── FEATURES LIST ──────── */}
        <div style={{
          background: '#fff',
          borderRadius: 20,
          border: '1px solid #DDE3F5',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(49,94,195,0.04)',
          marginBottom: 32,
        }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '15px 20px',
              borderBottom: i < FEATURES.length - 1 ? '1px solid #F0F3FC' : 'none',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11,
                background: '#EFF3FD',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#315EC3', flexShrink: 0,
              }}>
                {f.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1A2340', marginBottom: 1 }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 11.5, color: '#5A6589' }}>
                  {f.desc}
                </div>
              </div>
              <CheckCircle size={15} style={{ color: '#22C55E', flexShrink: 0 }} />
            </div>
          ))}
        </div>

        {/* ──────── FOOTER ──────── */}
        <p style={{
          textAlign: 'center',
          fontSize: 11.5,
          color: '#9AA5C4',
          lineHeight: 1.8,
          margin: 0,
        }}>
          การใช้งานถือว่ายอมรับข้อตกลงการใช้บริการ<br />
          © 2024 Foami Wash &amp; Delivery
        </p>
      </div>
    </div>
  )
}
