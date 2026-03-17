-- Migration: Create staff_payouts and link to bookings
-- Description: This script creates the staff_payouts table to track payments made to staff
-- and adds a payout_id column to the bookings table to link them.

-- 1. Create staff_payouts table
CREATE TABLE IF NOT EXISTS staff_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  extra_costs NUMERIC NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  slip_url TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add payout_id to bookings to track which payout a booking belongs to
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES staff_payouts(id) ON DELETE SET NULL;

-- 3. Enable RLS
ALTER TABLE staff_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access staff_payouts" ON staff_payouts FOR ALL USING (true);
