-- ============================================================
-- Fix 1: Payment method check constraint (add 'cash')
-- ============================================================
ALTER TABLE bookings
    DROP CONSTRAINT IF EXISTS bookings_payment_method_check;

ALTER TABLE bookings
    ADD CONSTRAINT bookings_payment_method_check
    CHECK (payment_method IN ('stripe', 'transfer', 'cash', 'promptpay', 'other'));

-- ============================================================
-- Fix 2: Add promotion condition columns to discount_codes
-- ============================================================

-- usage_type: 'once' (single-use per promo) or 'recurring' (repeatable)
ALTER TABLE discount_codes
    ADD COLUMN IF NOT EXISTS usage_type TEXT DEFAULT 'once' CHECK (usage_type IN ('once', 'recurring')),
    ADD COLUMN IF NOT EXISTS valid_days TEXT[] DEFAULT NULL,        -- e.g. ['Mon','Tue'] for recurring
    ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS valid_until DATE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS allowed_branch_ids TEXT[] DEFAULT NULL,  -- NULL = all branches
    ADD COLUMN IF NOT EXISTS allowed_zone_ids TEXT[] DEFAULT NULL;     -- NULL = all zones

-- ============================================================
-- Fix 3: Add promotion condition columns to promotions table
--        (stores conditions alongside the campaign record)
-- ============================================================
ALTER TABLE promotions
    ADD COLUMN IF NOT EXISTS usage_type TEXT DEFAULT 'once' CHECK (usage_type IN ('once', 'recurring')),
    ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS valid_until DATE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS allowed_branch_ids TEXT[] DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS allowed_zone_ids TEXT[] DEFAULT NULL;

-- ============================================================
-- Fix 4: Add walkin_customer_id column to bookings for referencing
--        previous manual-booking customers (optional convenience)
-- ============================================================
-- (No schema change needed — we just search by phone in the UI)
