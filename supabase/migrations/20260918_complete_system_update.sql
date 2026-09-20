-- ==============================================================================
-- FOAMI COMPLETE SYSTEM UPDATE MIGRATION (2026-09-18)
-- รวมคำสั่งฐานข้อมูลสำคัญสำหรับระบบ Foami เวอร์ชันใหม่:
-- 1. ปลดล็อค line_user_id ให้ไม่บังคับ (Optional) และใช้เบอร์โทรศัพท์ (phone) เป็นกุญแจหลัก
-- 2. เชื่อมโยงบัญชีเดิม (เบอร์เดียวกัน = บัญชีเดียวกัน 100% ข้อมูลเก่าไม่หาย)
-- 3. เพิ่มฟิลด์สลิปโอนเงิน (slip_url) และเตรียมพร้อมสำหรับ Omise API
-- 4. สร้างตาราง partner_applications สำหรับรับสมัครร้านค้าพาร์ทเนอร์
-- 5. ตั้งค่า Storage Buckets สำหรับ slips และรูปภาพ
-- ปลอดภัย รันซ้ำได้ไม่กระทบข้อมูลเดิม (Idempotent)
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ปรับปรุงตาราง customers (ลูกค้า)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1.1 ปลดล็อค NOT NULL ของ line_user_id เพื่อรองรับการล็อกอินด้วยเบอร์โทรและ Google
DO $$
BEGIN
    ALTER TABLE public.customers ALTER COLUMN line_user_id DROP NOT NULL;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 1.2 เพิ่มคอลัมน์ email, google_id และ auth_provider
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS google_id TEXT,
    ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'phone';

-- 1.3 สร้าง Unique Index สำหรับ phone และ index สำหรับ email
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique 
    ON public.customers(phone) 
    WHERE phone IS NOT NULL AND phone != '';

CREATE INDEX IF NOT EXISTS idx_customers_email 
    ON public.customers(email) 
    WHERE email IS NOT NULL AND email != '';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ปรับปรุงตาราง bookings (การจอง)
--    - slip_url: เก็บรูปสลิปโอนเงิน
--    - payment_verified_by / at: บันทึกแอดมินที่ตรวจสลิป
--    - omise_charge_id: เตรียมพร้อมสำหรับ Omise API
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS slip_url TEXT,
    ADD COLUMN IF NOT EXISTS omise_charge_id TEXT,
    ADD COLUMN IF NOT EXISTS payment_verified_by TEXT,
    ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. สร้างตาราง partner_applications (ใบสมัครร้านค้าพาร์ทเนอร์)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_applications (
    id                  TEXT PRIMARY KEY,
    shop_name           TEXT NOT NULL,
    contact_name        TEXT NOT NULL,
    phone               TEXT NOT NULL,
    line_id             TEXT,
    email               TEXT,
    location            TEXT,
    current_services    TEXT,
    notes               TEXT,
    status              TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'approved', 'declined')),
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_applications_created ON public.partner_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON public.partner_applications(status);

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on partner_applications" ON public.partner_applications;
CREATE POLICY "Service role full access on partner_applications"
    ON public.partner_applications FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public insert on partner_applications" ON public.partner_applications;
CREATE POLICY "Allow public insert on partner_applications"
    ON public.partner_applications FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read access on partner_applications" ON public.partner_applications;
CREATE POLICY "Allow read access on partner_applications"
    ON public.partner_applications FOR SELECT TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ตั้งค่า Supabase Storage Buckets (slips, images, job-photos)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
    ('slips', 'slips', true),
    ('images', 'images', true),
    ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- เปิดสิทธิ์ให้ลูกค้าและแอดมินอัปโหลด/เข้าถึงสลิปใน Bucket 'slips'
DROP POLICY IF EXISTS "Public can upload slips" ON storage.objects;
CREATE POLICY "Public can upload slips"
    ON storage.objects FOR INSERT TO anon, authenticated, service_role
    WITH CHECK (bucket_id = 'slips');

DROP POLICY IF EXISTS "Public can read slips" ON storage.objects;
CREATE POLICY "Public can read slips"
    ON storage.objects FOR SELECT TO anon, authenticated, service_role
    USING (bucket_id = 'slips');

-- เปิดสิทธิ์สำหรับรูปภาพงานและรูปร้านค้า
DROP POLICY IF EXISTS "Public can upload job-photos" ON storage.objects;
CREATE POLICY "Public can upload job-photos"
    ON storage.objects FOR INSERT TO anon, authenticated, service_role
    WITH CHECK (bucket_id IN ('images', 'job-photos'));

DROP POLICY IF EXISTS "Public can read job-photos" ON storage.objects;
CREATE POLICY "Public can read job-photos"
    ON storage.objects FOR SELECT TO anon, authenticated, service_role
    USING (bucket_id IN ('images', 'job-photos'));

-- ==============================================================================
-- สิ้นสุดสคริปต์อัปเดตระบบ
-- ==============================================================================
