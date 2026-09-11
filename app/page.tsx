'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Logo from '@/components/Branding/Logo'
import {
  MapPin, Star, ChevronRight, Clock,
  Shield, Navigation2, Award, TrendingUp
} from 'lucide-react'

/*
  Theme = same as booking page:
  --bg:               #F6F8FF
  --surface:          #FFFFFF
  --border:           #DDE3F5
  --brand-dominant:   #315EC3
  --brand-subordinate:#A0D9F6  ← accent light blue
  --text-primary:     #1A2340
  --text-secondary:   #5A6589
*/

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

/* CI tokens (inline so no CSS module needed) */
const C = {
  bg: '#F6F8FF',
  surface: '#FFFFFF',
  border: '#DDE3F5',
  borderDark: '#BFC8E8',
  primary: '#315EC3',
  primaryLight: '#5A7FD0',
  subordinate: '#A0D9F6',
  subordinateGhost: '#EFF7FD',
  textPrimary: '#1A2340',
  textSecondary: '#5A6589',
  textMuted: '#9AA5C4',
}

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div className="spinner-blue" style={{ width: 36, height: 36 }} />
      </div>
    )
  }

  const review = REVIEWS[reviewIdx]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Kanit, sans-serif', overflowX: 'hidden' }}>

      {/* ─── TOPBAR (same style as booking topbar) ─── */}
      <div style={{
        background: C.surface,
        borderBottom: `2.5px solid ${C.subordinate}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        height: 64,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 8px rgba(49,94,195,0.04)',
      }}>
        <Logo width={110} style={{ margin: 0 }} />
        <Link href="/login">
          <button style={{
            background: C.primary,
            border: 'none',
            borderRadius: 12,
            padding: '9px 18px',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'Kanit, sans-serif',
            boxShadow: '0 4px 12px rgba(49,94,195,0.25)',
          }}>
            เข้าสู่ระบบ
          </button>
        </Link>
      </div>

      {/* ─── HERO CARD (white surface, same as booking content cards) ─── */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{
          background: C.surface,
          borderRadius: 24,
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(49,94,195,0.07)',
        }}>
          {/* Team photo */}
          <div style={{ position: 'relative' }}>
            <img
              src="/landing-team.jpg"
              alt="ทีมงาน Foami"
              style={{ width: '100%', height: 220, objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(26,35,64,0.05) 0%, rgba(26,35,64,0.55) 100%)',
            }} />
            {/* Overlay text on photo */}
            <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '6px 12px',
                boxShadow: '0 4px 12px rgba(49,94,195,0.12)',
              }}>
                <Award size={14} style={{ color: C.primary }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>ทีมงาน Foami พร้อมบริการคุณ</span>
              </div>
            </div>
          </div>

          {/* Hero content */}
          <div style={{ padding: '20px 20px 22px' }}>
            <h1 style={{
              fontSize: 25, fontWeight: 900, color: C.textPrimary,
              margin: '0 0 8px', lineHeight: 1.3,
            }}>
              ล้างรถสะอาด<br />
              <span style={{ color: C.primary }}>ส่งถึงบ้านคุณ</span>
            </h1>
            <p style={{ fontSize: 14, color: C.textSecondary, margin: '0 0 20px', lineHeight: 1.7 }}>
              จองร้านล้างมอเตอร์ไซค์ใกล้บ้าน<br />
              ช่างมาถึงที่ ไม่ต้องออกไปเอง
            </p>

            {/* Stats — same pill style as booking page info rows */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap',
            }}>
              {[
                { val: '500+', lbl: 'ร้านค้า', star: false },
                { val: '4.9', lbl: 'คะแนน', star: true },
                { val: '10K+', lbl: 'ผู้ใช้งาน', star: false },
              ].map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: C.subordinateGhost,
                  border: `1px solid ${C.subordinate}`,
                  borderRadius: 100, padding: '6px 14px',
                }}>
                  {s.star && <Star size={12} fill="#F59E0B" strokeWidth={0} style={{ color: '#F59E0B' }} />}
                  <span style={{ fontWeight: 800, fontSize: 13.5, color: C.textPrimary }}>{s.val}</span>
                  <span style={{ fontSize: 11.5, color: C.textSecondary }}>{s.lbl}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link href="/search" style={{ textDecoration: 'none' }}>
                <button id="btn-search-nearby" style={{
                  width: '100%', padding: '15px 20px', borderRadius: 16,
                  border: 'none', background: C.primary, color: '#fff',
                  fontSize: 15.5, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  boxShadow: '0 8px 24px rgba(49,94,195,0.28)',
                  fontFamily: 'Kanit, sans-serif',
                }}>
                  <MapPin size={18} />
                  ค้นหาร้านใกล้ฉัน
                  <ChevronRight size={18} style={{ marginLeft: 'auto' }} />
                </button>
              </Link>

              <Link href="/login" style={{ textDecoration: 'none' }}>
                <button id="btn-login-line" style={{
                  width: '100%', padding: '13px 20px', borderRadius: 16,
                  border: `1.5px solid ${C.border}`, background: C.bg, color: C.primary,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'Kanit, sans-serif',
                }}>
                  <img
                    src="https://cdnjs.cloudflare.com/ajax/libs/simple-icons/11.10.0/line.svg"
                    alt="LINE"
                    style={{ width: 17, height: 17, filter: 'invert(25%) sepia(100%) saturate(500%) hue-rotate(100deg)' }}
                  />
                  เข้าสู่ระบบด้วย LINE
                </button>
              </Link>
            </div>

            {/* Hint */}
            <p style={{ fontSize: 11.5, color: C.textMuted, margin: '14px 0 0', textAlign: 'center' }}>
              ไม่ต้องล็อกอิน ดูร้านได้ทันที
            </p>
          </div>
        </div>
      </div>

      {/* ─── NEARBY SHOPS ─── */}
      <div style={{ padding: '22px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, margin: 0 }}>ร้านใกล้คุณตอนนี้</h2>
            <p style={{ fontSize: 11.5, color: C.textMuted, margin: '2px 0 0' }}>ตัวอย่างข้อมูล — กดดูร้านจริงพร้อมแผนที่</p>
          </div>
          <Link href="/search" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: 12.5, color: C.primary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
              ดูทั้งหมด <ChevronRight size={14} />
            </span>
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MOCK_SHOPS.map((shop, i) => (
            <Link key={i} href="/search" style={{ textDecoration: 'none' }}>
              <div style={{
                background: C.surface, borderRadius: 16,
                border: `1px solid ${C.border}`,
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(49,94,195,0.04)',
                display: 'flex',
                opacity: shop.open ? 1 : 0.60,
              }}>
                <div style={{ width: 90, flexShrink: 0, position: 'relative' }}>
                  <img
                    src={shop.img}
                    alt={shop.name}
                    style={{ width: '100%', height: '100%', minHeight: 82, objectFit: 'cover', display: 'block' }}
                  />
                  {!shop.open && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(26,35,64,0.50)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>ปิดแล้ว</span>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, padding: '11px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 5 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: C.textPrimary }}>{shop.name}</div>
                      <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 1 }}>{shop.area}</div>
                    </div>
                    {shop.tag && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: C.primary,
                        background: C.subordinateGhost, borderRadius: 6, padding: '2px 8px',
                        border: `1px solid ${C.subordinate}`, flexShrink: 0,
                      }}>{shop.tag}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Star size={12} fill="#F59E0B" strokeWidth={0} style={{ color: '#F59E0B' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary }}>{shop.rating}</span>
                      <span style={{ fontSize: 10.5, color: C.textMuted }}>({shop.reviews})</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Navigation2 size={11} style={{ color: C.textSecondary }} />
                      <span style={{ fontSize: 11, color: C.textSecondary }}>{shop.distance}</span>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: C.primary }}>฿{shop.price}+</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <Link href="/search" style={{ textDecoration: 'none' }}>
          <div style={{
            marginTop: 10,
            padding: '12px 18px',
            borderRadius: 14,
            background: C.subordinateGhost,
            border: `1px solid ${C.subordinate}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <MapPin size={16} style={{ color: C.primary, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: C.primary, fontWeight: 600, flex: 1 }}>
              เปิดดูร้านจริงใกล้คุณ พร้อมแผนที่
            </span>
            <ChevronRight size={16} style={{ color: C.primary }} />
          </div>
        </Link>
      </div>

      {/* ─── REVIEW CAROUSEL ─── */}
      <div style={{ padding: '22px 20px 0' }}>
        <div style={{
          background: C.surface, borderRadius: 18,
          border: `1px solid ${C.border}`,
          padding: '16px 18px',
          boxShadow: '0 2px 12px rgba(49,94,195,0.04)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${C.primary} 0%, ${C.subordinate} 100%)`,
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <TrendingUp size={15} style={{ color: C.primary }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.primary }}>รีวิวจากผู้ใช้จริง</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
              {REVIEWS.map((_, i) => (
                <span key={i} style={{
                  width: i === reviewIdx ? 16 : 6, height: 6,
                  borderRadius: 3,
                  background: i === reviewIdx ? C.primary : C.border,
                  transition: 'all 0.3s ease', display: 'inline-block',
                }} />
              ))}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
            {[1,2,3,4,5].map(s => (
              <Star key={s} size={14} fill="#F59E0B" strokeWidth={0} style={{ color: '#F59E0B' }} />
            ))}
          </div>
          <p style={{ fontSize: 13.5, color: C.textPrimary, margin: '0 0 10px', lineHeight: 1.65, fontStyle: 'italic' }}>
            "{review.text}"
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.textSecondary }}>{review.name}</span>
            <span style={{ fontSize: 11, color: C.textMuted }}>{review.time}</span>
          </div>
        </div>
      </div>

      {/* ─── FEATURES GRID ─── */}
      <div style={{ padding: '22px 20px 0' }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, margin: '0 0 12px' }}>
          ทำไมต้องเลือก Foami?
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { icon: <Navigation2 size={20} />, title: 'ใกล้บ้านคุณ', desc: 'GPS หาร้านอัตโนมัติ' },
            { icon: <Clock size={20} />, title: 'จองเร็ว', desc: 'ไม่กี่คลิก ไม่ต้องโทร' },
            { icon: <Shield size={20} />, title: 'ปลอดภัย', desc: 'ช่างผ่านการตรวจสอบ' },
            { icon: <Award size={20} />, title: 'รับประกัน', desc: 'ไม่พอใจ แก้ไขให้ฟรี' },
          ].map((f, i) => (
            <div key={i} style={{
              background: C.surface, borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: '14px',
              boxShadow: '0 2px 10px rgba(49,94,195,0.03)',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11,
                background: C.subordinateGhost,
                border: `1px solid ${C.subordinate}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.primary, marginBottom: 10,
              }}>
                {f.icon}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: C.textPrimary, marginBottom: 3 }}>{f.title}</div>
              <div style={{ fontSize: 11.5, color: C.textSecondary }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── BOTTOM CTA ─── */}
      <div style={{ padding: '24px 20px 44px' }}>
        <Link href="/search" style={{ textDecoration: 'none' }}>
          <button style={{
            width: '100%', padding: '16px 20px', borderRadius: 18,
            border: 'none', background: C.primary, color: '#fff',
            fontSize: 15.5, fontWeight: 800, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 8px 24px rgba(49,94,195,0.28)',
            fontFamily: 'Kanit, sans-serif',
          }}>
            <MapPin size={18} />
            ค้นหาร้านใกล้ฉันเดี๋ยวนี้
            <ChevronRight size={18} />
          </button>
        </Link>
        <p style={{ textAlign: 'center', fontSize: 11.5, color: C.textMuted, margin: '12px 0 0', lineHeight: 1.8 }}>
          ไม่ต้องล็อกอิน ดูร้านได้ทันที &nbsp;|&nbsp; © 2024 Foami Wash &amp; Delivery
        </p>
      </div>
    </div>
  )
}
