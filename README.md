# 🫧 Foami Wash & Delivery

> **Wash & Delivery** — บริการรับ-ล้าง-ส่ง จักรยานยนต์รอบมหาวิทยาลัยขอนแก่น


## 📌 ภาพรวมโปรเจค

**Foami** คือแพลตฟอร์ม Wash Delivery ที่เชื่อมต่อเจ้าของรถจักรยานยนต์เข้ากับบริการล้างรถระดับมืออาชีพถึงที่ พร้อมระบบจัดการที่แม่นยำและตรวจสอบได้ — *สะอาด สะดวก และล้ำสมัย*

### ปัญหาที่แก้ไข

- **ข้อจำกัดด้านเวลาและพื้นที่** — นักศึกษาและบุคลากรใน มข. ไม่มีเวลาหรือสถานที่สะดวกในการล้างรถ
- **การล้างรถด้วยตนเองไม่สะดวก** — ขาดอุปกรณ์ ขาดทักษะ และใช้เวลานาน
- **ภาพลักษณ์ของผู้ใช้รถ** — ต้องการรถที่สะอาดเพื่อความมั่นใจในการใช้งาน

### โซลูชัน (WashGO → Foami)

เริ่มต้นในชื่อ **WashGO** และผ่านการ Rebranding เป็น **Foami Wash & Delivery** พร้อมแพลตฟอร์มออนไลน์ครบวงจร:

1. **BOOK** — จองคิวล้างรถล่วงหน้าผ่านระบบออนไลน์ได้ทันที
2. **TRACK** — อัปเดตสถานะงานทั้งฝั่งลูกค้าและพนักงาน
3. **MANAGE** — ระบบหลังบ้านอัจฉริยะ ควบคุมงานและจัดการคิวอย่างเป็นระบบ

---

## 🛠️ Tech Stack

| หมวด | เทคโนโลยี |
|---|---|
| Framework | Next.js 16.1.6 (App Router), React 19 |
| Language | TypeScript |
| Styling | Vanilla CSS + Design Tokens (`globals.css`) |
| Database | Supabase |
| Auth/Integration | LINE LIFF (`@line/liff`) |
| Payment | Stripe (`@stripe/react-stripe-js`, `@stripe/stripe-js`) |
| Icons | Lucide React |
| Maps | Leaflet + React-Leaflet + Turf.js |
| Push Notification | Web Push |
| PWA | `@ducanh2912/next-pwa` |
| Deployment | Vercel |

---

## 🗂️ โครงสร้างโปรเจค

```
Foami-WashAndDelivery/
├── app/                    # Next.js App Router (pages & API routes)
├── components/             # Reusable UI components
├── lib/                    # Utilities, helpers, Supabase client
├── public/                 # Static assets (logo, images)
├── supabase/               # Database migrations & config
├── worker/                 # Service worker / background jobs
├── tmp/                    # Temporary files
├── CLAUDE.md               # Design & technical guidelines
├── next.config.ts          # Next.js configuration
├── vercel.json             # Vercel deployment config
└── package.json
```

---

## 🚀 เริ่มต้นพัฒนา

### ความต้องการ

- Node.js 18+
- npm / yarn / pnpm / bun
- Supabase project (สร้างได้ที่ [supabase.com](https://supabase.com))
- LINE LIFF App ID
- Stripe API Keys

### ติดตั้งและรัน

```bash
# Clone repository
git clone https://github.com/washgokk/Foami-WashAndDelivery.git
cd Foami-WashAndDelivery

# ติดตั้ง dependencies
npm install

# สร้างไฟล์ environment variables
cp .env.example .env.local
# แก้ไข .env.local ใส่ค่า Supabase, LINE LIFF, Stripe

# รัน development server
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) ในเบราว์เซอร์

### Scripts

```bash
npm run dev      # รัน development server
npm run build    # Build สำหรับ production
npm run start    # รัน production server
npm run lint     # ตรวจสอบ code quality
```

---

## 🎨 Design System

### Color Palette (50/35/15 Rule)

| บทบาท | สี | Hex |
|---|---|---|
| Dominant (50%) | Primary Blue | `#315EC3` |
| Subordinate (35%) | Light Blue | `#A0D9F6` |
| Accent (15%) | Soft Pink | `#F1BFDB` |

### Brand Personality

**"Impeccable, Efficient, Delightful"**

- **Style**: Clean, premium, high-quality typography พร้อม smooth micro-interactions
- **Font**: Kanit (รองรับ Thai/English)
- **Icons**: Lucide React (ไม่ใช้ emoji ใน UI)
- **Logo**: ขนาดขั้นต่ำ 110px บนทุกหน้าหลัก

### ผู้ใช้งาน 3 กลุ่ม

| กลุ่ม | ความต้องการ |
|---|---|
| **ลูกค้า** | จองบริการผ่าน LINE LIFF — ใช้งานง่าย, น่าเชื่อถือ |
| **พนักงาน** | จัดการงานและตารางเวลา — ชัดเจน, มีประสิทธิภาพ |
| **Admin** | บริหารระบบทั้งหมด (CRM, operations) — ข้อมูลหนาแน่น, ควบคุมได้ทุกมิติ |

---

## 🔗 ลิงก์

- **เว็บแอป**: [foami-wash-and-delivery.vercel.app](https://foami-wash-and-delivery.vercel.app)
- **GitHub**: [github.com/washgokk/Foami-WashAndDelivery](https://github.com/washgokk/Foami-WashAndDelivery)

---

> *Foami Wash & Delivery — สะอาด สะดวก และล้ำสมัย* 🫧
