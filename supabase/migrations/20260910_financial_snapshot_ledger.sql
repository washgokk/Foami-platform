-- ==========================================================================
-- Migration: Financial Snapshot + Transaction Ledger
-- เพิ่ม snapshot fields ในตาราง bookings เพื่อบันทึกราคา ณ เวลาที่จอง
-- ถ้าเปลี่ยนเรทราคาทีหลัง ยอดเก่ายังคงถูกต้องตามราคาเดิม
-- ==========================================================================

-- 1. เพิ่ม Snapshot fields ในตาราง bookings
ALTER TABLE public.bookings
    -- ราคาบริการ ณ เวลาที่จอง (snapshot ก่อนที่ admin จะเปลี่ยนราคา)
    ADD COLUMN IF NOT EXISTS snapshot_base_price          NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS snapshot_service_name        TEXT,    -- ชื่อบริการ ณ เวลาจอง
    ADD COLUMN IF NOT EXISTS snapshot_service_price       NUMERIC DEFAULT 0,  -- ราคาบริการจาก services table
    ADD COLUMN IF NOT EXISTS snapshot_addon_details       JSONB DEFAULT '[]', -- [{name, price}, ...] addon ณ เวลาจอง
    ADD COLUMN IF NOT EXISTS snapshot_platform_fee_pct    NUMERIC DEFAULT 0.20, -- % platform fee ณ เวลาจอง
    ADD COLUMN IF NOT EXISTS snapshot_platform_fee_thb    NUMERIC DEFAULT 0,  -- จำนวนเงิน platform fee (คำนวณแล้ว)
    ADD COLUMN IF NOT EXISTS snapshot_net_to_shop_thb     NUMERIC DEFAULT 0;  -- ยอดสุทธิที่ร้านได้รับ

-- 2. Backfill snapshot สำหรับ booking เก่าที่มีอยู่แล้ว
UPDATE public.bookings
SET
    snapshot_base_price       = COALESCE(base_price, 0),
    snapshot_service_price    = COALESCE(base_price, 0),
    snapshot_platform_fee_pct = 0.20,
    snapshot_platform_fee_thb = GREATEST(0, COALESCE(total_price, 0) - COALESCE(discount_amount, 0) + COALESCE(additional_price, 0)) * 0.20,
    snapshot_net_to_shop_thb  = GREATEST(0, COALESCE(total_price, 0) - COALESCE(discount_amount, 0) + COALESCE(additional_price, 0)) * 0.80
WHERE snapshot_base_price = 0 OR snapshot_base_price IS NULL;

-- ==========================================================================
-- 3. ตาราง transaction_ledger — บันทึกทุก transaction แบบ immutable
--    หลัก: ห้ามลบ, ห้ามแก้ไข — append only
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.transaction_ledger (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id          TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    branch_id           TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    customer_id         TEXT,

    -- ราคา snapshot ณ เวลาเกิด transaction
    service_name        TEXT NOT NULL DEFAULT '',
    service_id          TEXT,
    base_price          NUMERIC NOT NULL DEFAULT 0,   -- ราคาบริการที่ลูกค้าเห็น
    addon_total         NUMERIC NOT NULL DEFAULT 0,   -- ค่า add-on รวม
    extra_fees          NUMERIC NOT NULL DEFAULT 0,   -- ค่าเพิ่ม (out of zone, etc.)
    gross_amount        NUMERIC NOT NULL DEFAULT 0,   -- ยอดรวมก่อนส่วนลด
    discount_code       TEXT,
    discount_amount     NUMERIC NOT NULL DEFAULT 0,
    net_amount          NUMERIC NOT NULL DEFAULT 0,   -- ยอดสุทธิหลังส่วนลด (= gross - discount + additional)
    additional_amount   NUMERIC NOT NULL DEFAULT 0,   -- ค่าเพิ่มเติมหลังจอง (เช่น ค่าบริการเพิ่ม)
    total_collected     NUMERIC NOT NULL DEFAULT 0,   -- ยอดที่รับจริง (net + additional)

    -- Platform fee snapshot
    platform_fee_pct    NUMERIC NOT NULL DEFAULT 0.20,
    platform_fee_thb    NUMERIC NOT NULL DEFAULT 0,
    net_to_shop_thb     NUMERIC NOT NULL DEFAULT 0,

    -- Payment info
    payment_method      TEXT,
    payment_status      TEXT,
    stripe_payment_id   TEXT,
    slip_url            TEXT,

    -- Event type
    event_type          TEXT NOT NULL CHECK (event_type IN (
                            'booking_created',    -- สร้างการจอง
                            'payment_received',   -- ชำระเงินแล้ว
                            'additional_charge',  -- เพิ่มค่าบริการ
                            'refund_issued',      -- คืนเงิน
                            'rebooking',          -- จองซ้ำ
                            'cancelled',          -- ยกเลิก
                            'completed'           -- เสร็จสิ้น
                        )),
    notes               TEXT,          -- หมายเหตุ
    created_by          TEXT,          -- staff_id หรือ 'customer' หรือ 'system'
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Index สำหรับ query บ่อย
CREATE INDEX IF NOT EXISTS idx_txn_ledger_booking_id   ON public.transaction_ledger(booking_id);
CREATE INDEX IF NOT EXISTS idx_txn_ledger_branch_id    ON public.transaction_ledger(branch_id);
CREATE INDEX IF NOT EXISTS idx_txn_ledger_created_at   ON public.transaction_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_ledger_event_type   ON public.transaction_ledger(event_type);

-- RLS: service role ใช้ได้เต็ม, อ่านอย่างเดียวสำหรับ role อื่น
ALTER TABLE public.transaction_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_transaction_ledger" ON public.transaction_ledger
    TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ==========================================================================
-- 4. Backfill transaction_ledger จาก bookings ที่มีอยู่แล้ว
-- ==========================================================================
INSERT INTO public.transaction_ledger (
    booking_id, branch_id, customer_id,
    service_id, base_price, gross_amount, discount_code, discount_amount,
    net_amount, additional_amount, total_collected,
    platform_fee_pct, platform_fee_thb, net_to_shop_thb,
    payment_method, payment_status, stripe_payment_id, slip_url,
    event_type, created_at
)
SELECT
    b.id,
    b.branch_id,
    b.customer_id,
    b.service_id,
    COALESCE(b.base_price, 0),
    COALESCE(b.total_price, 0),  -- gross (before discount in DB = net in DB)
    b.discount_code,
    COALESCE(b.discount_amount, 0),
    GREATEST(0, COALESCE(b.total_price, 0) - COALESCE(b.discount_amount, 0)),
    COALESCE(b.additional_price, 0),
    GREATEST(0, COALESCE(b.total_price, 0) - COALESCE(b.discount_amount, 0)) + COALESCE(b.additional_price, 0),
    0.20,
    (GREATEST(0, COALESCE(b.total_price, 0) - COALESCE(b.discount_amount, 0)) + COALESCE(b.additional_price, 0)) * 0.20,
    (GREATEST(0, COALESCE(b.total_price, 0) - COALESCE(b.discount_amount, 0)) + COALESCE(b.additional_price, 0)) * 0.80,
    b.payment_method,
    b.payment_status,
    b.stripe_payment_id,
    b.slip_url,
    CASE WHEN b.status = 'completed' THEN 'completed'
         WHEN b.status = 'cancelled' THEN 'cancelled'
         ELSE 'booking_created'
    END,
    b.created_at
FROM public.bookings b
ON CONFLICT DO NOTHING;

-- ==========================================================================
-- 5. Function: สร้าง ledger entry อัตโนมัติเมื่อ booking เปลี่ยนสถานะ
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.fn_booking_status_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
    _net NUMERIC;
    _fee NUMERIC;
    _pct NUMERIC;
BEGIN
    -- เฉพาะเมื่อ status เปลี่ยนเป็น completed หรือ cancelled
    IF OLD.status = NEW.status THEN RETURN NEW; END IF;
    IF NEW.status NOT IN ('completed', 'cancelled') THEN RETURN NEW; END IF;

    _pct  := COALESCE(NEW.snapshot_platform_fee_pct, 0.20);
    _net  := GREATEST(0, COALESCE(NEW.total_price, 0) - COALESCE(NEW.discount_amount, 0)) + COALESCE(NEW.additional_price, 0);
    _fee  := _net * _pct;

    INSERT INTO public.transaction_ledger (
        booking_id, branch_id, customer_id, service_id,
        base_price, gross_amount, discount_code, discount_amount,
        net_amount, additional_amount, total_collected,
        platform_fee_pct, platform_fee_thb, net_to_shop_thb,
        payment_method, payment_status, stripe_payment_id, slip_url,
        event_type, notes, created_at
    ) VALUES (
        NEW.id, NEW.branch_id, NEW.customer_id, NEW.service_id,
        COALESCE(NEW.snapshot_base_price, NEW.base_price, 0),
        COALESCE(NEW.total_price, 0),
        NEW.discount_code, COALESCE(NEW.discount_amount, 0),
        _net - COALESCE(NEW.additional_price, 0),
        COALESCE(NEW.additional_price, 0),
        _net,
        _pct, _fee, _net - _fee,
        NEW.payment_method, NEW.payment_status, NEW.stripe_payment_id, NEW.slip_url,
        NEW.status,
        'Auto-recorded on status change: ' || OLD.status || ' → ' || NEW.status,
        NOW()
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger ถ้ามีอยู่แล้วแล้วสร้างใหม่
DROP TRIGGER IF EXISTS trg_booking_status_ledger ON public.bookings;
CREATE TRIGGER trg_booking_status_ledger
    AFTER UPDATE OF status ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_booking_status_to_ledger();

-- ==========================================================================
-- 6. View: transaction_summary_by_branch — ดูยอดรวมต่อสาขา
-- ==========================================================================
CREATE OR REPLACE VIEW public.vw_transaction_summary AS
SELECT
    tl.branch_id,
    b.name AS branch_name,
    COUNT(*) FILTER (WHERE tl.event_type = 'completed') AS completed_count,
    SUM(tl.total_collected) FILTER (WHERE tl.event_type = 'completed') AS gross_revenue,
    SUM(tl.platform_fee_thb) FILTER (WHERE tl.event_type = 'completed') AS platform_fee,
    SUM(tl.net_to_shop_thb) FILTER (WHERE tl.event_type = 'completed') AS net_to_shop,
    COUNT(*) FILTER (WHERE tl.event_type = 'cancelled') AS cancelled_count,
    COUNT(*) FILTER (WHERE tl.event_type = 'refund_issued') AS refund_count,
    SUM(tl.total_collected) FILTER (WHERE tl.event_type = 'refund_issued') AS refund_amount
FROM public.transaction_ledger tl
LEFT JOIN public.branches b ON b.id = tl.branch_id
GROUP BY tl.branch_id, b.name;