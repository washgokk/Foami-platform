-- Add is_addon_required column to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_addon_required BOOLEAN DEFAULT FALSE;
