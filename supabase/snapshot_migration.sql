-- Migration: Add snapshot columns to bookings table
-- To prevent price calculation changes if branch settings are updated later.

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS labor_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS capital_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS rental_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS fuel_cost NUMERIC DEFAULT 0;

-- Optional: Update existing completed bookings with current branch values if possible
-- (This is a simplified guess, user should verify before running if they want to backfill)
-- UPDATE bookings b
-- SET 
--   labor_cost = br.labor_cost_per_job,
--   capital_cost = br.max_capital_per_job,
--   rental_cost = br.vehicle_rental_per_job,
--   fuel_cost = br.fuel_cost_per_job
-- FROM branches br
-- WHERE b.branch_id = br.id AND b.labor_cost = 0;
