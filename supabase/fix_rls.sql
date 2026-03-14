-- Add missing RLS policies for Admin management
-- These were missing in the original migration, causing updates from the Admin UI to fail.

-- Branches
DROP POLICY IF EXISTS "Public manage branches" ON branches;
CREATE POLICY "Public manage branches" ON branches FOR ALL USING (true);

-- Services
DROP POLICY IF EXISTS "Public manage services" ON services;
CREATE POLICY "Public manage services" ON services FOR ALL USING (true);

-- Service Addons
DROP POLICY IF EXISTS "Public manage addons" ON service_addons;
CREATE POLICY "Public manage addons" ON service_addons FOR ALL USING (true);

-- Ensure CC Price Groups has full access (already in apply_refactor but double check)
DROP POLICY IF EXISTS "Admin manage cc_price_groups" ON cc_price_groups;
CREATE POLICY "Admin manage cc_price_groups" ON cc_price_groups FOR ALL USING (true);
