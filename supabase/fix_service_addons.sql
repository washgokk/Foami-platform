-- Add missing columns to service_addons table
ALTER TABLE service_addons ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE service_addons ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'fixed';
ALTER TABLE service_addons ADD COLUMN IF NOT EXISTS sub_options JSONB DEFAULT '[]';

-- Add missing columns to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Ensure RLS allows full access for these tables (usually already handled but good for safety)
CREATE POLICY "Full access for service role" ON service_addons FOR ALL USING (true);
CREATE POLICY "Full access for service role" ON services FOR ALL USING (true);
