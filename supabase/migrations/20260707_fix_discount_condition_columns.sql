-- Migration: Fix discount_codes condition columns to match UI values
-- usage_type must allow: 'all', 'specific_days', 'date_range'

-- Drop old constraint if it exists (from fix_payment_method_and_promo_conditions.sql)
ALTER TABLE public.discount_codes
    DROP CONSTRAINT IF EXISTS discount_codes_usage_type_check;

-- Re-add columns with correct allowed values
ALTER TABLE public.discount_codes
    ADD COLUMN IF NOT EXISTS usage_type TEXT DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS valid_days TEXT[],
    ADD COLUMN IF NOT EXISTS valid_from DATE,
    ADD COLUMN IF NOT EXISTS valid_until DATE,
    ADD COLUMN IF NOT EXISTS allowed_branch_ids TEXT[],
    ADD COLUMN IF NOT EXISTS allowed_zone_ids TEXT[],
    ADD COLUMN IF NOT EXISTS is_refund_code BOOLEAN DEFAULT FALSE;

-- Fix any rows that have old values ('once'/'recurring') to new values
UPDATE public.discount_codes
    SET usage_type = 'all'
    WHERE usage_type IS NULL OR usage_type NOT IN ('all', 'specific_days', 'date_range');

-- Add correct constraint
ALTER TABLE public.discount_codes
    DROP CONSTRAINT IF EXISTS discount_codes_usage_type_check2;

ALTER TABLE public.discount_codes
    ADD CONSTRAINT discount_codes_usage_type_check2
    CHECK (usage_type IN ('all', 'specific_days', 'date_range'));
