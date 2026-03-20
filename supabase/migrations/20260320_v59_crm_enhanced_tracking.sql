-- Migration v59: Enhanced Transaction Tracking for CRM
-- Snapshots specific markups and costs at booking time

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_markup_amount NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS original_base_price NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS labor_cost NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS capital_cost NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rental_cost NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fuel_cost NUMERIC DEFAULT 0;

-- Optional: Update existing records if defaults are known (using standard branch defaults for now)
-- This is hard to do perfectly without a join, but for new bookings it will be accurate.
