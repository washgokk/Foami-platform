-- ==============================================================================
-- FOAMI UNIFIED DATABASE MIGRATION SCRIPT
-- รวมคำสั่ง SQL ทั้งหมดที่ต้องรันใน Supabase SQL Editor
-- ทุกคำสั่งปลอดภัย มี IF NOT EXISTS สามารถกด Run ซ้ำได้ ไม่กระทบข้อมูลเดิม
-- วันที่สร้าง: 11 กันยายน 2026
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. เพิ่มคอลัมน์ในตาราง branches (สาขา)
--    - delivery_rate_per_km: คำนวณค่าส่งรถไป-กลับแยกตามระยะทางจริง
--    - features: JSON กำหนดการเปิด-ปิดฟีเจอร์ เช่น ต่อ พ.ร.บ.
--    - shop_description: คำอธิบายร้านค้า
--    - cover_photo_url / shop_photos: รูปร้านค้าสำหรับแสดงใน Marketplace
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.branches
    ADD COLUMN IF NOT EXISTS delivery_rate_per_km NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{"insurance_renewal": false}'::JSONB,
    ADD COLUMN IF NOT EXISTS shop_description TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS cover_photo_url TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS shop_photos TEXT[] DEFAULT '{}'::TEXT[];

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. เพิ่มคอลัมน์ในตาราง zones (โซนบริการ)
--    - radius_km: ควบคุมรัศมีบริการ (ไม่เกิน 20 กม. ตามเงื่อนไขใหม่)
--    - center_lat / center_lng: จุดศูนย์กลางของโซน
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.zones
    ADD COLUMN IF NOT EXISTS radius_km NUMERIC DEFAULT 20,
    ADD COLUMN IF NOT EXISTS center_lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS center_lng DOUBLE PRECISION;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. สร้างตาราง incident_reports (ระบบรายงานปัญหาและข้อร้องเรียน)
--    - ปัญหาร้านค้า (shop), ปัญหาออเดอร์ (order), ปัญหาทั่วไป (customer_issue)
--    - ระบบติดตามสถานะเคสของแอดมิน (pending, investigating, resolved, refunded)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_number TEXT NOT NULL UNIQUE,
    report_type TEXT NOT NULL CHECK (report_type IN ('shop', 'order', 'customer_issue', 'payment', 'general')),
    branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    shop_slug TEXT,
    shop_name TEXT,
    booking_id TEXT REFERENCES public.bookings(id) ON DELETE SET NULL,
    booking_number TEXT,
    customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    customer_line_id TEXT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_photos TEXT[] DEFAULT '{}'::TEXT[],
    severity TEXT NOT NULL DEFAULT 'normal' CHECK (severity IN ('low', 'normal', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed', 'refunded')),
    admin_notes TEXT,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes สำหรับสปีดการค้นหาและการกรองใน Admin
CREATE INDEX IF NOT EXISTS idx_incident_reports_branch_id ON public.incident_reports(branch_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_booking_id ON public.incident_reports(booking_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON public.incident_reports(status);
CREATE INDEX IF NOT EXISTS idx_incident_reports_created_at ON public.incident_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_reports_type ON public.incident_reports(report_type);

-- กำหนดสิทธิ์ RLS
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on incident_reports" ON public.incident_reports;
CREATE POLICY "Service role full access on incident_reports"
    ON public.incident_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public insert on incident_reports" ON public.incident_reports;
CREATE POLICY "Allow public insert on incident_reports"
    ON public.incident_reports FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read access on incident_reports" ON public.incident_reports;
CREATE POLICY "Allow read access on incident_reports"
    ON public.incident_reports FOR SELECT TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. สร้างตาราง vehicle_insurance_renewals (ระบบบริการต่อภาษี & พ.ร.บ.)
--    - รองรับการคำนวณราคาตามอายุรถ (>5 ปี 150 บาท / <=5 ปี 100 บาท)
--    - ระบบมัดจำก่อน และชำระส่วนที่เหลือหลังตรวจสภาพ/ต่อเสร็จ
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicle_insurance_renewals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT REFERENCES public.customers(id) ON DELETE CASCADE,
    branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    booking_id TEXT,
    license_plate TEXT NOT NULL,
    vehicle_brand TEXT NOT NULL DEFAULT '',
    vehicle_model TEXT NOT NULL DEFAULT '',
    vehicle_year INTEGER,
    vehicle_age_over_5 BOOLEAN DEFAULT FALSE,
    insurance_type TEXT DEFAULT 'compulsory' CHECK (insurance_type IN ('compulsory','voluntary','both')),
    current_expiry DATE,
    tax_expired BOOLEAN DEFAULT FALSE,
    tax_expired_years NUMERIC DEFAULT 0,
    needs_inspection BOOLEAN DEFAULT FALSE,
    pickup_address TEXT DEFAULT '',
    pickup_lat DOUBLE PRECISION,
    pickup_lng DOUBLE PRECISION,
    scheduled_date DATE,
    scheduled_time TIME WITHOUT TIME ZONE,
    service_fee NUMERIC NOT NULL DEFAULT 0,
    deposit_amount NUMERIC NOT NULL DEFAULT 0,
    deposit_paid BOOLEAN DEFAULT FALSE,
    deposit_payment_id TEXT,
    deposit_slip_url TEXT,
    remaining_amount NUMERIC NOT NULL DEFAULT 0,
    remaining_paid BOOLEAN DEFAULT FALSE,
    remaining_payment_id TEXT,
    remaining_slip_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'picked_up', 'inspecting', 'renewed', 'delivered', 'completed', 'cancelled')),
    customer_note TEXT DEFAULT '',
    admin_note TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes สำหรับระบบต่อ พ.ร.บ.
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_branch_id ON public.vehicle_insurance_renewals(branch_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_customer_id ON public.vehicle_insurance_renewals(customer_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_status ON public.vehicle_insurance_renewals(status);

-- กำหนดสิทธิ์ RLS
ALTER TABLE public.vehicle_insurance_renewals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on vehicle_insurance_renewals" ON public.vehicle_insurance_renewals;
CREATE POLICY "Service role full access on vehicle_insurance_renewals"
    ON public.vehicle_insurance_renewals FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access on vehicle_insurance_renewals" ON public.vehicle_insurance_renewals;
CREATE POLICY "Allow public access on vehicle_insurance_renewals"
    ON public.vehicle_insurance_renewals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- สิ้นสุดสคริปต์
-- ─────────────────────────────────────────────────────────────────────────────
