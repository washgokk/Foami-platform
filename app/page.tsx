'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Logo from '@/components/Branding/Logo'
import {
  MapPin, Star, ChevronRight, Clock,
  CheckCircle, Sparkles, Shield, Navigation2,
  TrendingUp, Award
} from 'lucide-react'

/* ─── Mock nearby shops ─────────────────────────────── */
const MOCK_SHOPS = [
  {
    name: 'Spartan Bike Wash',
    area: 'พระโขนง, กทม.',
    rating: 4.9,
    reviews: 312,
    price: 150,
    distance: '0.8 กม.',
    open: true,
    tag: 'ยอดนิยม',
    img: '/landing-shop.jpg',
  },
  {
    name: 'SpeedClean Express',
    area: 'อ่อนนุช, กทม.',
    rating: 4.7,
    reviews: 185,
    price: 120,
    distance: '1.4 กม.',
    open: true,
    tag: 'ใกล้สุด',
    img: '/landing-hero.jpg',
  },
  {
    name: 'ProWash Garage',
    area: 'บางนา, กทม.',
    rating: 4.8,
    reviews: 240,
    price: 180,
    distance: '2.1 กม.',
    open: false,
    tag: '',
    img: '/landing-moto.jpg',
  },
]

const REVIEWS = [
  { name: 'ณัฐพล จ.', rating: 5, text: 'ช่างใจดี ล้างสะอาดมากครับ รอบนี้แวะอีกแน่ๆ', time: '2 ชม. ที่แล้ว' },
  { name: 'วิมล ส.', rating: 5, text: 'สะดวกมาก จองได้เลย ช่างมาตรงเวลาสุดๆ', time: 'เมื่อวาน' },
  { name: 'ธนภัทร พ.', rating: 5, text: 'รถสะอาดเหมือนใหม่ บริการดีมากครับ', time: '3 วันที่แล้ว' },
]

export default function LandingPage() {
  const [sessionChecked, setSessionChecked] = useState(false)
  const [reviewIdx, setReviewIdx] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

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

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setReviewIdx(i => (i + 1) % REVIEWS.length)
    }, 3500)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  if (!sessionChecked) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0D1B3E',
      }}>
        <div className="spinner-blue" style={{ width: 36, height: 36 }} />
      </div>
    )
  }

  const review = REVIEWS[reviewIdx]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F6F8FF',
      fontFamily: 'Kanit, sans-serif',
      overflowX: 'hidden',
    }}>

      {/* ══════════════════════════════════════
          HERO — dark navy gradient + hero photo
      ══════════════════════════════════════ */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(170deg, #0D1B3E 0%, #1A2E6B 55%, #2B4599 100%)',
        overflow: 'hidden',
        paddingBottom: 52,
      }}>
        {/* subtle grid texture overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
        }} />

        {/* glow blobs */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(49,94,195,0.45) 0%, transparent 65%)',
          filter: 'blur(60px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, left: -40,
          width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(160,217,246,0.20) 0%, transparent 65%)',
          filter: 'blur(40px)', pointerEvents: 'none',
        }} />

        {/* Nav Bar */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px',
        }}>
          <Logo width={120} style={{ margin: 0, filter: 'brightness(0) invert(1)' }} />
          <Link href="/login">
            <button style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.20)',
              borderRadius: 100,
              padding: '7px 18px',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              fontFamily: 'Kanit, sans-serif',
            }}>
              เข้าสู่ระบบ
            </button>
          </Link>
        </div>

        {/* Hero Content */}
        <div style={{ position: 'relative', zIndex: 2, padding: '12px 24px 0' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 100,
            padding: '5px 14px',
            marginBottom: 18,
            backdropFilter: 'blur(6px)',
          }}>
            <Sparkles size={13} style={{ color: '#A0D9F6' }} />
            <span style={{ fontSize: 12, color: '#A0D9F6', fontWeight: 600 }}>
              บริการล้างมอเตอร์ไซค์พรีเมียม
            </span>
          </div>

          <h1 style={{
            fontSize: 32, fontWeight: 900, color: '#FFFFFF',
            margin: '0 0 12px', lineHeight: 1.2, letterSpacing: '-0.5px',
          }}>
            ล้างรถสะอาด<br />
            <span style={{ color: '#A0D9F6' }}>ส่งถึงบ้านคุณ</span>
          </h1>
          <p style={{
            fontSize: 14.5, color: 'rgba(255,255,255,0.70)',
            margin: '0 0 24px', lineHeight: 1.7,
          }}>
            จองร้านล้างมอเตอร์ไซค์ใกล้บ้าน<br />
            ช่างมาถึงที่ ไม่ต้องออกไปเอง
          </p>

          {/* CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href="/search" style={{ textDecoration: 'none' }}>
              <button id="btn-search-nearby" style={{
                width: '100%',
                padding: '16px 20px',
                borderRadius: 16,
                border: 'none',
                background: '#FFFFFF',
                color: '#315EC3',
                fontSize: 15.5,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
                boxShadow: '0 8px 32px rgba(0,0,0,0.20)',
                fontFamily: 'Kanit, sans-serif',
              }}>
                <MapPin size={18} />
                ค้นหาร้านใกล้ฉัน
                <ChevronRight size={18} style={{ marginLeft: 'auto' }} />
              </button>
            </Link>

            <Link href="/login" style={{ textDecoration: 'none' }}>
              <button id="btn-login-line" style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 16,
                border: '1.5px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.10)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backdropFilter: 'blur(8px)',
                fontFamily: 'Kanit, sans-serif',
              }}>
                <img
                  src="https://cdnjs.cloudflare.com/ajax/libs/simple-icons/11.10.0/line.svg"
                  alt="LINE"
                  style={{ width: 17, height: 17, filter: 'invert(1)' }}
                />
                เข้าสู่ระบบด้วย LINE
              </button>
            </Link>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'flex', gap: 0,
            marginTop: 28,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16,
            overflow: 'hidden',
            backdropFilter: 'blur(8px)',
          }}>
            {[
              { val: '500+', lbl: 'ร้านค้า' },
              { val: '4.9', lbl: 'คะแนน', star: true },
              { val: '10K+', lbl: 'ผู้ใช้งาน' },
            ].map((s, i, arr) => (
              <div key={i} style={{
                flex: 1, textAlign: 'center', padding: '14px 8px',
                borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.10)' : 'none',
              }}>
                <div style={{
                  fontSize: 20, fontWeight: 900, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                  {s.star && <Star size={14} fill="#F59E0B" strokeWidth={0} style={{ color: '#F59E0B' }} />}
                  {s.val}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Image — large photo of technician */}
        <div style={{
          position: 'relative', zIndex: 1, marginTop: 28, padding: '0 24px',
        }}>
          <div style={{
            borderRadius: 20, overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.40)',
            position: 'relative',
          }}>
            <img
              src="/landing-hero.jpg"
              alt="Professional motorcycle wash service"
              style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
            />
            {/* overlay badge */}
            <div style={{
              position: 'absolute', bottom: 12, left: 12,
              background: 'rgba(13,27,62,0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 12,
              padding: '8px 12px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Award size={16} style={{ color: '#A0D9F6' }} />
              <span style={{ fontSize: 12.5, color: '#fff', fontWeight: 600 }}>
                บริการมาตรฐาน พรีเมียม
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          NEARBY SHOPS — mock data cards
      ══════════════════════════════════════ */}
      <div style={{ padding: '28px 20px 0' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1A2340', margin: 0 }}>
              ร้านใกล้คุณตอนนี้
            </h2>
            <p style={{ fontSize: 12, color: '#5A6589', margin: '2px 0 0' }}>
              จากตำแหน่งโดยประมาณ — เข้าสู่ระบบเพื่อดูที่แน่นอน
            </p>
          </div>
          <Link href="/search" style={{ textDecoration: 'none' }}>
            <span style={{
              fontSize: 12.5, color: '#315EC3', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              ดูทั้งหมด <ChevronRight size={14} />
            </span>
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MOCK_SHOPS.map((shop, i) => (
            <Link key={i} href="/search" style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#fff',
                borderRadius: 18,
                border: '1px solid #DDE3F5',
                overflow: 'hidden',
                boxShadow: '0 2px 16px rgba(49,94,195,0.05)',
                display: 'flex',
                opacity: shop.open ? 1 : 0.65,
              }}>
                {/* Shop thumbnail */}
                <div style={{ width: 100, flexShrink: 0, position: 'relative' }}>
                  <img
                    src={shop.img}
                    alt={shop.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {!shop.open && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(0,0,0,0.45)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}>ปิดแล้ว</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1A2340' }}>{shop.name}</div>
                      <div style={{ fontSize: 11.5, color: '#5A6589', marginTop: 1 }}>{shop.area}</div>
                    </div>
                    {shop.tag && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#315EC3',
                        background: '#EFF3FD', borderRadius: 6, padding: '2px 8px',
                        border: '1px solid #DDE3F5', flexShrink: 0,
                      }}>{shop.tag}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                    {/* Rating */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Star size={12} fill="#F59E0B" strokeWidth={0} style={{ color: '#F59E0B' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1A2340' }}>{shop.rating}</span>
                      <span style={{ fontSize: 11, color: '#9AA5C4' }}>({shop.reviews})</span>
                    </div>

                    {/* Distance */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Navigation2 size={11} style={{ color: '#5A6589' }} />
                      <span style={{ fontSize: 11.5, color: '#5A6589' }}>{shop.distance}</span>
                    </div>

                    {/* Price */}
                    <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: '#315EC3' }}>
                      ฿{shop.price}+
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA hint below shops */}
        <Link href="/search" style={{ textDecoration: 'none' }}>
          <div style={{
            marginTop: 14,
            padding: '13px 18px',
            borderRadius: 16,
            background: '#EFF3FD',
            border: '1px solid #DDE3F5',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <MapPin size={16} style={{ color: '#315EC3', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#315EC3', fontWeight: 600, flex: 1 }}>
              เปิดดูร้านจริงใกล้คุณ พร้อมแผนที่
            </span>
            <ChevronRight size={16} style={{ color: '#315EC3' }} />
          </div>
        </Link>
      </div>

      {/* ══════════════════════════════════════
          LIVE REVIEW CAROUSEL
      ══════════════════════════════════════ */}
      <div style={{ padding: '28px 20px 0' }}>
        <div style={{
          background: '#fff',
          borderRadius: 20,
          border: '1px solid #DDE3F5',
          padding: '18px 20px',
          boxShadow: '0 4px 20px rgba(49,94,195,0.04)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: 3,
            background: 'linear-gradient(90deg, #315EC3, #A0D9F6)',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <TrendingUp size={15} style={{ color: '#315EC3' }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#315EC3' }}>รีวิวจากผู้ใช้จริง</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {REVIEWS.map((_, i) => (
                <span key={i} style={{
                  width: i === reviewIdx ? 16 : 6, height: 6,
                  borderRadius: 3,
                  background: i === reviewIdx ? '#315EC3' : '#DDE3F5',
                  transition: 'all 0.3s ease',
                  display: 'inline-block',
                }} />
              ))}
            </span>
          </div>
          <div style={{ transition: 'opacity 0.3s' }}>
            <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
              {[1,2,3,4,5].map(s => (
                <Star key={s} size={14} fill="#F59E0B" strokeWidth={0} style={{ color: '#F59E0B' }} />
              ))}
            </div>
            <p style={{ fontSize: 13.5, color: '#1A2340', margin: '0 0 10px', lineHeight: 1.65, fontStyle: 'italic' }}>
              "{review.text}"
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#5A6589' }}>{review.name}</span>
              <span style={{ fontSize: 11, color: '#9AA5C4' }}>{review.time}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          FEATURES
      ══════════════════════════════════════ */}
      <div style={{ padding: '28px 20px 0' }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1A2340', margin: '0 0 16px' }}>
          ทำไมต้องเลือก Foami?
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { icon: <Navigation2 size={20} />, title: 'ใกล้บ้านคุณ', desc: 'GPS หาร้านอัตโนมัติ' },
            { icon: <Clock size={20} />, title: 'จองเร็ว', desc: 'ไม่กี่คลิก ไม่ต้องโทร' },
            { icon: <Shield size={20} />, title: 'ปลอดภัย', desc: 'ช่างผ่านการตรวจสอบ' },
            { icon: <Award size={20} />, title: 'รับประกัน', desc: 'ไม่พอใจ แก้ไขให้ฟรี' },
          ].map((f, i) => (
            <div key={i} style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #DDE3F5',
              padding: '16px',
              boxShadow: '0 2px 12px rgba(49,94,195,0.04)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: '#EFF3FD',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#315EC3',
                marginBottom: 10,
              }}>
                {f.icon}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1A2340', marginBottom: 3 }}>
                {f.title}
              </div>
              <div style={{ fontSize: 11.5, color: '#5A6589' }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════
          BOTTOM CTA STICKY
      ══════════════════════════════════════ */}
      <div style={{
        padding: '28px 20px',
        background: 'linear-gradient(to top, #F6F8FF 85%, transparent)',
      }}>
        <Link href="/search" style={{ textDecoration: 'none' }}>
          <button style={{
            width: '100%',
            padding: '17px 20px',
            borderRadius: 18,
            border: 'none',
            background: '#315EC3',
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            boxShadow: '0 8px 28px rgba(49,94,195,0.32)',
            fontFamily: 'Kanit, sans-serif',
          }}>
            <MapPin size={18} />
            ค้นหาร้านใกล้ฉันเดี๋ยวนี้
            <ChevronRight size={18} />
          </button>
        </Link>
        <p style={{
          textAlign: 'center',
          fontSize: 11.5,
          color: '#9AA5C4',
          margin: '12px 0 0',
          lineHeight: 1.8,
        }}>
          ไม่ต้องล็อกอิน ดูร้านได้ทันที &nbsp;|&nbsp; © 2024 Foami
        </p>
      </div>
    </div>
  )
}
