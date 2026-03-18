-- Final fix for pwa_auth_bridges policies
-- Ensures that the API and client-side can properly interact with the bridge table

BEGIN;

-- 1. Ensure RLS is active
ALTER TABLE pwa_auth_bridges ENABLE ROW LEVEL SECURITY;

-- 2. Drop any old potentially conflicting policies
DROP POLICY IF EXISTS "Allow public insert" ON pwa_auth_bridges;
DROP POLICY IF EXISTS "Allow public select by id" ON pwa_auth_bridges;
DROP POLICY IF EXISTS "Allow all for authenticated" ON pwa_auth_bridges;

-- 3. Create clean policies
-- Allow everyone to insert (Safari-side sync)
CREATE POLICY "Bridge Insert" ON pwa_auth_bridges 
    FOR INSERT WITH CHECK (true);

-- Allow everyone to select by ID (PWA-side polling)
CREATE POLICY "Bridge Select" ON pwa_auth_bridges 
    FOR SELECT USING (true);

-- Allow everyone to update (for completion status)
CREATE POLICY "Bridge Update" ON pwa_auth_bridges 
    FOR UPDATE USING (true);

COMMIT;
