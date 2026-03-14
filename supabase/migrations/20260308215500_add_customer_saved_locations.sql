-- Add saved_locations column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS saved_locations JSONB DEFAULT '[]'::jsonb;
