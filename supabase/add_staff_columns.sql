-- ============================================================
-- ADD MISSING COLUMNS TO STAFF TABLE
-- Run this in Supabase SQL Editor to support images and bank info.
-- ============================================================

-- Add image_url for profile photos
ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add bank details for payouts
ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS promptpay_number TEXT;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'staff' AND table_schema = 'public';
