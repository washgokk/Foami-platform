-- Add vehicle_data column to bookings table to store the vehicle snapshot at booking time
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_data JSONB;
