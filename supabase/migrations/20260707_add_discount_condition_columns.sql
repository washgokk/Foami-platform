-- Migration: Add discount condition columns to discount_codes table
-- These columns are required by the discount conditions UI

ALTER TABLE public.discount_codes
ADD COLUMN IF NOT EXISTS usage_type TEXT DEFAULT 'all',
ADD COLUMN IF NOT EXISTS valid_days TEXT[],
ADD COLUMN IF NOT EXISTS valid_from DATE,
ADD COLUMN IF NOT EXISTS valid_until DATE,
ADD COLUMN IF NOT EXISTS allowed_branch_ids TEXT[],
ADD COLUMN IF NOT EXISTS allowed_zone_ids TEXT[],
ADD COLUMN IF NOT EXISTS is_refund_code BOOLEAN DEFAULT FALSE;

-- Update existing records to have the default usage_type
UPDATE public.discount_codes 
SET usage_type = 'all' 
WHERE usage_type IS NULL;
