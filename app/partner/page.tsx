'use client'

import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Branding/Logo'
import {
  Calendar,
  Users,
  TrendingUp,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Store,
  ShieldCheck,
  Clock,
  Sparkles,
  Send,
  HelpCircle,
  ExternalLink
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
  success: '#10B981',
}

const PARTNER_BENEFITS = [
  {
    icon: Calendar,
    title: 'ระบบการจองที่เป็นระบบยิ่งขึ้น',
    subtitle: 'Smart Booking & Queue System',
    desc: 'จัดการรอบคิวงานได้อย่างมีแบบแผน ลดปัญหาลูกค้าแออัดหน้าร้าน สามารถตรวจสอบตารางนัดหมายล่วงหน้าแบบเรียลไทม์ และบริหารจัดการคิวช่างได้อย่างมีประสิทธิภาพ',
  },
  {
    icon: TrendingUp,
    title: 'มีลูกค้าเห็นร้านมากขึ้น',
    subtitle: 'Higher Visibility & Reach',
    desc: 'ปักหมุดร้านค้าของคุณบนระบบค้นหาศูนย์บริการของ Foami เพื่อให้ผู้ขับขี่และเจ้าของรถในละแวกใกล้เคียงค้นพบร้านของคุณได้ง่ายผ่าน GPS พร้อมกดจองคิวเข้ารับบริการได้ทันที',
  },
  {
    icon: ShieldCheck,
    title: 'ยกระดับภาพลักษณ์ด้วยมาตรฐาน Foami',
    subtitle: 'Brand & Quality Guidelines',
    desc: 'นำคู่มือมาตรฐาน Brand Guidelines ที่พัฒนาขึ้นโดยทีมงาน มาปรับใช้เพื่อสร้างความน่าเชื่อถือ ความเป็นมืออาชีพ และสร้างความมั่นใจให้แก่ลูกค้าที่มาใช้บริการ',
  },
  {
    icon: Users,
    title: 'ทีมงานดูแลและให้คำปรึกษาใกล้ชิด',
    subtitle: 'Dedicated Partner Support',
    desc: 'ทีมนักศึกษาและผู้พัฒนาระบบพร้อมช่วยตั้งค่าข้อมูลร้าน ดูแลการใช้งานระบบ และร่วมวางแผนโปรโมตร้านค้าของคุณอย่างต่อเนื่อง',
  },
]

export default function PartnerPage() {
  const [formData, setFormData] = useState({
    shop_name: '',
    contact_name: '',
    phone: '',
    line_id: '',
    email: '',
    location: '',
    current_services: '',
    notes: '',
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!formData.shop_name || !formData.contact_name || !formData.phone) {
      setErrorMsg('กรุณากรอกชื่อร้าน, ชื่อผู้ติดต่อ และเบอร์โทรศัพท์')
      return
    }

    setIsSubmitting(true)

    try {
      // 1. Submit to internal API to safely store in Supabase
      const res = await fetch('/api/partner/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
      }

      // 2. Prepare direct mailto URL to washgo.kk@gmail.com
      const mailSubject = encodeURIComponent(`[Foami Partner] สนใจเข้าร่วมเป็นพาร์ทเนอร์ - ${formData.shop_name}`)
      const mailBody = encodeURIComponent(
        `เรียน ทีมงาน Foami Wash & Delivery,

` +
        `มีร้านค้า/ศูนย์บริการติดต่อสนใจเข้าร่วมเป็น Partner กับทางระบบ Foami โดยมีรายละเอียดดังนี้:

` +
        `• ชื่อร้านค้า / ศูนย์บริการ: ${formData.shop_name}
` +
        `• ชื่อผู้ติดต่อ: ${formData.contact_name}
` +
        `• เบอร์โทรศัพท์: ${formData.phone}
` +
        `• LINE ID / อีเมล: ${formData.line_id || '-'} / ${formData.email || '-'}
` +
        `• ที่ตั้งร้าน / พิกัด: ${formData.location || '-'}
` +
        `• บริการปัจจุบันของร้าน: ${formData.current_services || '-'}
` +
        `• ข้อความเพิ่มเติม: ${formData.notes || '-'}

` +
        `วันที่ส่งข้อมูล: ${new Date().toLocaleString('th-TH')}
`
      )

      const mailtoUrl = `mailto:washgo.kk@gmail.com?subject=${mailSubject}&body=${mailBody}`
      
      // Automatically attempt to trigger mailto
      try {
        window.open(mailtoUrl, '_blank')
      } catch { }

      setIsSubmitted(true)
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsSubmitting(false)
    }
  }

  const generateMailtoLink = () => {
    const mailSubject = encodeURIComponent(`[Foami Partner] สนใจเข้าร่วมเป็นพาร์ทเนอร์ - ${formData.shop_name || 'ร้านค้า'}`)
    const mailBody = encodeURIComponent(
      `เรียน ทีมงาน Foami,

สนใจเข้าร่วมเป็นร้านค้าพาร์ทเนอร์
` +
      `ชื่อร้าน: ${formData.shop_name}
ชื่อผู้ติดต่อ: ${formData.contact_name}
เบอร์โทร: ${formData.phone}
LINE: ${formData.line_id}
`
    )
    return `mailto:washgo.kk@gmail.com?subject=${mailSubject}&body=${mailBody}`
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
          <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <Logo variant="landscape" width={130} />
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link
              href="/"
              style={{
                color: C.textSecondary,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500
              }}
            >
              หน้าแรก
            </Link>
            <Link
              href="/search"
              style={{
                color: C.textSecondary,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500
              }}
            >
              ค้นหาร้าน
            </Link>
            <Link
              href="/admin/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 10,
                border: `1.5px solid ${C.primary}`,
                color: C.primary,
                background: C.surface,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              <Store size={15} />
              <span>เข้าสู่ระบบร้านค้า</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION ─── */}
      <section style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '52px 20px 36px',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            borderRadius: 24,
            background: C.primaryLight,
            border: `1px solid ${C.subordinate}`,
            color: C.primary,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 20
          }}>
            <Sparkles size={14} />
            <span>Foami Partner Network · ร่วมเติบโตไปกับเรา</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(28px, 4vw, 42px)',
            lineHeight: 1.25,
            fontWeight: 700,
            color: C.textPrimary,
            margin: '0 0 16px',
            letterSpacing: '-0.02em'
          }}>
            ยกระดับศูนย์บริการของคุณด้วยระบบดิจิทัล <br />
            <span style={{ color: C.primary }}>เพิ่มลูกค้าใหม่ จัดการคิวงานอย่างเป็นระบบ</span>
          </h1>

          <p style={{
            fontSize: 'clamp(15px, 2vw, 17px)',
            lineHeight: 1.6,
            color: C.textSecondary,
            margin: '0 0 28px'
          }}>
            เปิดรับสมัครศูนย์บริการล้างและดูแลรักษายานยนต์เข้าร่วมเป็นพาร์ทเนอร์ เพื่อเชื่อมต่อกับลูกค้าในพื้นที่ และบริหารงานจองคิวได้อย่างมืออาชีพ
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            <a
              href="#apply-form"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 28px',
                borderRadius: 12,
                background: C.primary,
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(49, 94, 195, 0.25)'
              }}
            >
              <Send size={16} />
              <span>กรอกข้อมูลสนใจเป็น Partner</span>
            </a>

            <a
              href="mailto:washgo.kk@gmail.com"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 24px',
                borderRadius: 12,
                background: C.surface,
                border: `1.5px solid ${C.border}`,
                color: C.textPrimary,
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              <Mail size={16} style={{ color: C.primary }} />
              <span>อีเมล: washgo.kk@gmail.com</span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── BENEFITS SECTION (WHAT PARTNERS GET) ─── */}
      <section style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '48px 20px 64px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 44px' }}>
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
            สิ่งที่ร้านค้าจะได้รับ
          </div>
          <h2 style={{ fontSize: 'clamp(24px, 3.2vw, 34px)', fontWeight: 700, color: C.textPrimary, margin: '0 0 12px' }}>
            ทำไมศูนย์บริการควรเข้าร่วมเป็น Partner กับ Foami
          </h2>
          <p style={{ fontSize: 15, color: C.textSecondary, margin: 0, lineHeight: 1.6 }}>
            ช่วยให้ร้านค้าก้าวข้ามข้อจำกัดเดิมๆ เพิ่มยอดการเข้าถึง และบริหารเวลาการให้บริการได้ราบรื่น
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
          gap: 24
        }}>
          {PARTNER_BENEFITS.map((item, idx) => {
            const IconComp = item.icon
            return (
              <div
                key={idx}
                style={{
                  background: C.surface,
                  borderRadius: 18,
                  border: `1.5px solid ${C.border}`,
                  padding: 28,
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 6px 18px rgba(49, 94, 195, 0.04)'
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: C.primaryLight,
                  border: `1.5px solid ${C.subordinate}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: C.primary,
                  marginBottom: 18
                }}>
                  <IconComp size={24} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, margin: '0 0 4px' }}>
                  {item.title}
                </h3>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.primary, marginBottom: 12 }}>
                  {item.subtitle}
                </span>
                <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ─── CONTACT & REGISTRATION FORM ─── */}
      <section id="apply-form" style={{
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: '64px 20px'
      }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
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
              แบบฟอร์มติดต่อสนใจเป็น Partner
            </div>
            <h2 style={{ fontSize: 'clamp(24px, 3.2vw, 32px)', fontWeight: 700, color: C.textPrimary, margin: '0 0 10px' }}>
              ทิ้งข้อมูลเพื่อให้ทีมงานติดต่อกลับ
            </h2>
            <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>
              ข้อมูลของท่านจะถูกจัดเก็บในระบบและส่งแจ้งเตือนไปยังอีเมล <strong>washgo.kk@gmail.com</strong> โดยอัตโนมัติ
            </p>
          </div>

          {isSubmitted ? (
            <div style={{
              background: C.subordinateLight,
              borderRadius: 20,
              border: `2px solid ${C.subordinate}`,
              padding: '40px 28px',
              textAlign: 'center'
            }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: C.success,
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 18px'
              }}>
                <CheckCircle2 size={32} />
              </div>

              <h3 style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, margin: '0 0 8px' }}>
                ส่งข้อมูลสนใจเป็น Partner เรียบร้อยแล้ว!
              </h3>
              <p style={{ fontSize: 15, color: C.textSecondary, maxWidth: 520, margin: '0 auto 24px', lineHeight: 1.6 }}>
                ทีมงาน Foami ได้รับข้อมูลของท่านแล้ว และระบบได้ส่งข้อมูลไปยังอีเมล <strong>washgo.kk@gmail.com</strong> โดยทีมงานจะติดต่อกลับผ่านเบอร์โทรหรือ LINE ภายใน 24 ชั่วโมง
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                <a
                  href={generateMailtoLink()}
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
                    textDecoration: 'none'
                  }}
                >
                  <Mail size={16} />
                  <span>เปิดส่งอีเมลไปยัง washgo.kk@gmail.com</span>
                </a>

                <Link
                  href="/"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 20px',
                    borderRadius: 10,
                    background: C.surface,
                    border: `1.5px solid ${C.border}`,
                    color: C.textPrimary,
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  <span>กลับสู่หน้าแรก</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{
              background: C.bg,
              borderRadius: 20,
              border: `1.5px solid ${C.border}`,
              padding: '36px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20
            }}>
              {errorMsg && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: '#FEE2E2',
                  border: '1px solid #F87171',
                  color: '#B91C1C',
                  fontSize: 14
                }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
                    ชื่อร้านค้า / ศูนย์บริการ *
                  </label>
                  <input
                    type="text"
                    name="shop_name"
                    value={formData.shop_name}
                    onChange={handleChange}
                    placeholder="เช่น สมาร์ทไบค์ วอช แอนด์ แคร์"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: `1.5px solid ${C.border}`,
                      background: C.surface,
                      fontSize: 14,
                      color: C.textPrimary,
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
                    ชื่อผู้ติดต่อ / เจ้าของร้าน *
                  </label>
                  <input
                    type="text"
                    name="contact_name"
                    value={formData.contact_name}
                    onChange={handleChange}
                    placeholder="เช่น คุณกฤษณะ สุขใจ"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: `1.5px solid ${C.border}`,
                      background: C.surface,
                      fontSize: 14,
                      color: C.textPrimary,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
                    เบอร์โทรศัพท์สำหรับติดต่อกลับ *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="เช่น 081-234-5678"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: `1.5px solid ${C.border}`,
                      background: C.surface,
                      fontSize: 14,
                      color: C.textPrimary,
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
                    LINE ID หรือ อีเมล
                  </label>
                  <input
                    type="text"
                    name="line_id"
                    value={formData.line_id}
                    onChange={handleChange}
                    placeholder="เช่น line_id หรือ email@domain.com"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: `1.5px solid ${C.border}`,
                      background: C.surface,
                      fontSize: 14,
                      color: C.textPrimary,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
                  ที่ตั้งร้านค้า / พื้นที่ให้บริการ (จังหวัด, อำเภอ/เขต)
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="เช่น อ.เมือง จ.ขอนแก่น (ใกล้ ม.ขอนแก่น)"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `1.5px solid ${C.border}`,
                    background: C.surface,
                    fontSize: 14,
                    color: C.textPrimary,
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
                  ประเภทบริการที่มีในร้านปัจจุบัน
                </label>
                <input
                  type="text"
                  name="current_services"
                  value={formData.current_services}
                  onChange={handleChange}
                  placeholder="เช่น ล้างโฟม, เคลือบสี, ถ่ายน้ำมันเครื่อง, ล้างโซ่"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `1.5px solid ${C.border}`,
                    background: C.surface,
                    fontSize: 14,
                    color: C.textPrimary,
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>
                  ข้อความเพิ่มเติม / คำถามถึงทีมงาน
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="ระบุคำถามหรือรายละเอียดเพิ่มเติมที่ต้องการสอบถาม..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `1.5px solid ${C.border}`,
                    background: C.surface,
                    fontSize: 14,
                    color: C.textPrimary,
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
                paddingTop: 8
              }}>
                <div style={{ fontSize: 12, color: C.textMuted }}>
                  * ข้อมูลจะถูกจัดเก็บในระบบและส่งตรงถึง washgo.kk@gmail.com
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '14px 32px',
                    borderRadius: 12,
                    background: C.primary,
                    color: '#FFFFFF',
                    fontSize: 15,
                    fontWeight: 600,
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                    boxShadow: '0 4px 14px rgba(49, 94, 195, 0.25)'
                  }}
                >
                  <Send size={16} />
                  <span>{isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งข้อมูลสนใจเป็น Partner'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Direct Email Callout Card */}
          <div style={{
            marginTop: 32,
            padding: '20px 24px',
            borderRadius: 16,
            background: C.surface,
            border: `1px solid ${C.border}`,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: C.primaryLight,
                color: C.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Mail size={20} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
                  ติดต่อโดยตรงผ่านอีเมล
                </div>
                <div style={{ fontSize: 13, color: C.textSecondary }}>
                  ส่งข้อความหรือเอกสารแนะนำร้านมาที่ <strong>washgo.kk@gmail.com</strong>
                </div>
              </div>
            </div>

            <a
              href="mailto:washgo.kk@gmail.com?subject=[Foami%20Partner]%20สอบถามการร่วมเป็นพาร์ทเนอร์"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                borderRadius: 8,
                background: C.primaryLight,
                color: C.primary,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                border: `1px solid ${C.subordinate}`
              }}
            >
              <span>ส่งอีเมลทันที</span>
              <ExternalLink size={14} />
            </a>
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
            <Link href="/" style={{ color: C.textSecondary, textDecoration: 'none' }}>
              หน้าแรก
            </Link>
            <Link href="/search" style={{ color: C.textSecondary, textDecoration: 'none' }}>
              ค้นหาร้านค้า
            </Link>
            <Link href="/admin/login" style={{ color: C.textSecondary, textDecoration: 'none' }}>
              เข้าสู่ระบบร้านค้า
            </Link>
            <a href="mailto:washgo.kk@gmail.com" style={{ color: C.primary, textDecoration: 'none', fontWeight: 600 }}>
              washgo.kk@gmail.com
            </a>
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

    </div>
  )
}
