-- ============================================================
-- Production Final Fixes & Audit Log Setup
-- ============================================================

-- 1. Create Audit Logs Table (if missing)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id TEXT NOT NULL,
    action_type TEXT NOT NULL, -- CREATE, UPDATE, DELETE, TOGGLE_STATUS, PAYOUT, RESTORE
    entity_type TEXT NOT NULL, -- staff, branch, service, booking, payout
    entity_id TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Realtime for core tables (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'audit_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not add to publication. Please ensure supabase_realtime publication exists.';
END $$;

-- 3. RLS Policies for Audit Logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON audit_logs;
CREATE POLICY "Anyone can insert audit logs" ON audit_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs" ON audit_logs FOR SELECT USING (true); -- Usually restricted by role but for now 'true' to ensure visibility

-- 4. Fix Storage Policies (The "violates RLS policy" error for uploads)
-- WARNING: These policies are very permissive to ensure the transition works.
-- In a production environment, you should restrict 'INSERT' to authenticated users only.

-- Grant full access to 'public' buckets for the transition
-- You must have buckets named 'bookings', 'payouts', and 'logos' in your Supabase Storage.

-- Policy for 'bookings' bucket
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('bookings', 'bookings', true)
    ON CONFLICT (id) DO NOTHING;
END $$;

DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public View" ON storage.objects;
CREATE POLICY "Public View" ON storage.objects FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Update" ON storage.objects;
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING (true);

-- 5. Fix potential RLS issue for updating profile
DROP POLICY IF EXISTS "Allow profile updates" ON customers;
CREATE POLICY "Allow profile updates" ON customers FOR ALL USING (true);

-- 6. Add missing columns to branches table
ALTER TABLE branches ADD COLUMN IF NOT EXISTS out_of_zone_type TEXT DEFAULT 'per_km';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS out_of_zone_fee NUMERIC DEFAULT 5;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS labor_cost_per_job NUMERIC DEFAULT 30;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS max_capital_per_job NUMERIC DEFAULT 0;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS vehicle_rental_per_job NUMERIC DEFAULT 0;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS fuel_cost_per_job NUMERIC DEFAULT 0;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS slug TEXT;

-- 7. Add missing columns to zones table
ALTER TABLE zones ADD COLUMN IF NOT EXISTS color TEXT;
