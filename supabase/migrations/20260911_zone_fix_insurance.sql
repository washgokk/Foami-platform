-- ==========================================================================
-- Migration: Zone Fix + Insurance System
-- ==========================================================================

-- BUG-Z4: แยก delivery_rate_per_km ออกจาก out_of_zone_fee
-- out_of_zone_fee = ค่า/กม. สำหรับ staff เดินทางออกนอกโซน
-- delivery_rate_per_km = ค่า/กม. สำหรับ pickup→delivery (ค่าส่งรถ)
ALTER TABLE public.branches
    ADD COLUMN IF NOT EXISTS delivery_rate_per_km NUMERIC DEFAULT 0;
-- ถ้าไม่ได้ตั้ง delivery_rate_per_km → ใช้ out_of_zone_fee เป็น fallback (backward compatible)

-- ==========================================================================
-- Insurance Renewal System (สำหรับสาขาที่ features.insurance_renewal = true)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_insurance_renewals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         TEXT REFERENCES public.customers(id) ON DELETE CASCADE,
    branch_id           TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    booking_id          TEXT,                   -- booking หลักที่เชื่อม (ถ้ามี)

    -- ข้อมูลรถ
    license_plate       TEXT NOT NULL,
    vehicle_brand       TEXT NOT NULL DEFAULT '',
    vehicle_model       TEXT NOT NULL DEFAULT '',
    vehicle_year        INTEGER,                -- ปีผลิต
    vehicle_age_over_5  BOOLEAN DEFAULT FALSE,  -- รถอายุเกิน 5 ปี

    -- สถานะภาษี/พรบ
    insurance_type      TEXT DEFAULT 'compulsory'
                        CHECK (insurance_type IN ('compulsory','voluntary','both')),
    current_expiry      DATE,                   -- วันพรบหมดอายุปัจจุบัน
    tax_expired         BOOLEAN DEFAULT FALSE,  -- ขาดต่อภาษีไหม
    tax_expired_years   NUMERIC DEFAULT 0,      -- ขาดกี่ปี (อาจเป็นทศนิยม)
    -- ต้องนำรถไปตรวจที่ขนส่ง: รถ>5ปี หรือ ขาดต่อ>=1ปี
    needs_inspection    BOOLEAN DEFAULT FALSE,

    -- จุดนัดรับเอกสาร/รถ
    pickup_address      TEXT DEFAULT '',
    pickup_lat          DOUBLE PRECISION,
    pickup_lng          DOUBLE PRECISION,
    scheduled_date      DATE,
    scheduled_time      TIME WITHOUT TIME ZONE,

    -- ราคา (tier จาก branch หรือ platform)
    service_fee         NUMERIC NOT NULL DEFAULT 0,   -- ค่าบริการรวม
    deposit_amount      NUMERIC NOT NULL DEFAULT 0,   -- ชำระก่อน (มัดจำ)
    deposit_paid        BOOLEAN DEFAULT FALSE,
    deposit_payment_id  TEXT,
    deposit_slip_url    TEXT,
    remaining_amount    NUMERIC NOT NULL DEFAULT 0,   -- ส่วนที่เหลือ
    remaining_paid      BOOLEAN DEFAULT FALSE,
    remaining_payment_id TEXT,
    remaining_slip_url  TEXT,

    -- สถานะงาน
    status              TEXT DEFAULT 'pending'
                        CHECK (status IN (
                            'pending',           -- รอยืนยัน
                            'confirmed',         -- ยืนยันแล้ว
                            'picked_up',         -- รับเอกสาร/รถแล้ว
                            'at_transport',      -- กำลังไปขนส่ง (เฉพาะรถต้องตรวจ)
                            'processing',        -- กำลังดำเนินการ
                            'completed',         -- เสร็จสิ้น
                            'cancelled'          -- ยกเลิก
                        )),

    -- หมายเหตุ
    customer_note       TEXT,
    staff_note          TEXT,
    document_urls       JSONB DEFAULT '[]',      -- รูปเอกสารที่รับมา

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_insurance_branch_id   ON public.vehicle_insurance_renewals(branch_id);
CREATE INDEX IF NOT EXISTS idx_insurance_customer_id  ON public.vehicle_insurance_renewals(customer_id);
CREATE INDEX IF NOT EXISTS idx_insurance_status       ON public.vehicle_insurance_renewals(status);
CREATE INDEX IF NOT EXISTS idx_insurance_scheduled    ON public.vehicle_insurance_renewals(scheduled_date);

-- RLS
ALTER TABLE public.vehicle_insurance_renewals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_insurance" ON public.vehicle_insurance_renewals
    TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ตั้งค่า updated_at อัตโนมัติ
CREATE OR REPLACE FUNCTION public.fn_update_insurance_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insurance_updated_at ON public.vehicle_insurance_renewals;
CREATE TRIGGER trg_insurance_updated_at
    BEFORE UPDATE ON public.vehicle_insurance_renewals
    FOR EACH ROW EXECUTE FUNCTION public.fn_update_insurance_timestamp();

-- ==========================================================================
-- เพิ่ม features column ใน branches (สำหรับ toggle insurance_renewal และอื่นๆ)
-- ==========================================================================
ALTER TABLE public.branches
    ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';
-- ตัวอย่าง: { "insurance_renewal": true }

-- Insurance Pricing ตาม branch (เก็บใน features หรือ app_settings)
-- Default: { insurance_fee_standard: 100, insurance_fee_inspection: 150 }
-- รถ<=5ปี ไม่ต้องตรวจ = 100 บาท
-- รถ>5ปี หรือ ขาดต่อ>=1ปี ต้องตรวจ = 150 บาท

COMMENT ON TABLE public.vehicle_insurance_renewals IS
    'ระบบต่อพรบ/ประกัน เฉพาะสาขาที่มี features.insurance_renewal = true';