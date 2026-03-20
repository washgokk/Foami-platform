-- Migration: Add reschedule tracking to bookings
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS reschedule_count INTEGER DEFAULT 0;
