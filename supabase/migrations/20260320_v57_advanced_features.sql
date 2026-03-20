-- Migration v57: Advanced Booking & Staff Capacity

-- 1. Add max_out_of_zone_km to branches
ALTER TABLE branches ADD COLUMN IF NOT EXISTS max_out_of_zone_km NUMERIC DEFAULT 2;

-- 2. Add work_type to staff_schedules
-- Options: 'in_zone', 'cross_zone', 'out_of_zone'
ALTER TABLE staff_schedules ADD COLUMN IF NOT EXISTS work_type TEXT DEFAULT 'in_zone';

-- 3. Add fee tracking and staff split to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS different_spot_fee NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_surcharge NUMERIC DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS staff_extra_payout NUMERIC DEFAULT 0;
