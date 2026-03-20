-- Migration: Add missing reporting and fee columns to bookings table
-- Created to fix "Could not find column" errors during booking submission

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS travel_surcharge NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS different_spot_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS staff_extra_payout NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS additional_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS additional_price_note TEXT,
ADD COLUMN IF NOT EXISTS is_additional_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS package_markup_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_base_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS capital_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS rental_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS fuel_cost NUMERIC DEFAULT 0;

-- Optional: Update existing records if needed (will default to 0 for numeric)
