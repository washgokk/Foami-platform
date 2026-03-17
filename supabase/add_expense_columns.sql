-- Migration: Add missing columns for Additional Expenses
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS additional_price_slips JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS additional_history JSONB DEFAULT '[]';

-- Update RLS if necessary (usually handled by existing policies)
COMMENT ON COLUMN bookings.additional_price_slips IS 'Store array of public URLs for additional cost receipts';
COMMENT ON COLUMN bookings.additional_history IS 'Store history of cost changes for transparency';
