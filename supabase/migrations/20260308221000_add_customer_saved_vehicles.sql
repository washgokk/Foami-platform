-- Add saved_vehicles column to customers table for multiple vehicles support
ALTER TABLE customers ADD COLUMN IF NOT EXISTS saved_vehicles JSONB DEFAULT '[]'::jsonb;
