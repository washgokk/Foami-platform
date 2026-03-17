-- ============================================================
-- FOAMI — DISCOUNT SCHEMA FIX
-- This script adds missing advanced discount columns 
-- and ensures IDs match the TEXT format from id_migration.sql
-- ============================================================

-- 1. DROP CONSTRAINTS (To allow altering columns)
ALTER TABLE IF EXISTS discount_usage DROP CONSTRAINT IF EXISTS discount_usage_discount_code_id_fkey;
ALTER TABLE IF EXISTS discount_usage DROP CONSTRAINT IF EXISTS discount_usage_customer_id_fkey;

-- 2. ADD MISSING COLUMNS TO discount_codes (If they don't exist)
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(10,2);
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS max_uses_per_customer INTEGER;
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS target_segment TEXT;

-- 3. ENSURE ID TYPES MATCH (TEXT)
-- If id_migration.sql was run, discount_codes.id is already TEXT.
-- But discount_usage might still be UUID.
ALTER TABLE discount_codes ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- Convert discount_usage columns to TEXT (if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'discount_usage') THEN
        ALTER TABLE discount_usage ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE discount_usage ALTER COLUMN discount_code_id TYPE TEXT USING discount_code_id::TEXT;
        ALTER TABLE discount_usage ALTER COLUMN customer_id TYPE TEXT USING customer_id::TEXT;
        ALTER TABLE discount_usage ALTER COLUMN booking_id TYPE TEXT USING booking_id::TEXT;
    ELSE
        -- Create the table if it doesn't exist (from migration 20260308023000)
        CREATE TABLE discount_usage (
            id TEXT PRIMARY KEY,
            discount_code_id TEXT,
            customer_id TEXT,
            booking_id TEXT,
            discount_amount NUMERIC(10,2) NOT NULL,
            used_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- 4. RESTORE CONSTRAINTS
ALTER TABLE discount_usage ADD CONSTRAINT discount_usage_discount_code_id_fkey FOREIGN KEY (discount_code_id) REFERENCES discount_codes(id) ON DELETE CASCADE;
ALTER TABLE discount_usage ADD CONSTRAINT discount_usage_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- 5. RE-ENABLE RLS (Safety)
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Full access" ON discount_codes;
CREATE POLICY "Full access" ON discount_codes FOR ALL USING (true);

-- SUCCESS: Discount system should now be synchronized with the new ID format!
