-- Fix: normalize empty slip_url to NULL in staff_payouts
-- Records saved before the fix had slip_url = '' (empty string) instead of NULL
-- This causes the slip button to not appear in the UI

UPDATE staff_payouts
SET slip_url = NULL
WHERE slip_url = '';

-- Also ensure the booking_ids column exists (for fallback detail lookup)
ALTER TABLE staff_payouts
ADD COLUMN IF NOT EXISTS booking_ids TEXT[];

-- Add payout_id column to bookings if not exists (needed for detail modal)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES staff_payouts(id) ON DELETE SET NULL;
