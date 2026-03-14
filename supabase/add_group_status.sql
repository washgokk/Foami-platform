-- Add is_active column to cc_price_groups
-- This allows admins to enable/disable price groups for consistency with other tabs.

ALTER TABLE cc_price_groups ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update existing records to be active by default if they were newly created without this column
UPDATE cc_price_groups SET is_active = TRUE WHERE is_active IS NULL;
