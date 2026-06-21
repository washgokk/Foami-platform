-- ─── Fix: staff_payouts storage bucket ──────────────────────────
-- Run this in Supabase SQL editor OR create the bucket manually in the Supabase dashboard
-- Go to: Storage > Create new bucket > "staff_payouts" > Public: YES

-- If using Supabase Storage policies via SQL:
-- Note: Storage bucket creation must be done via Supabase Dashboard or Management API
-- The policy below assumes the bucket "staff_payouts" already exists

-- Allow service_role to upload slips (the API route uses service client)
-- This should work automatically with service role, but add anon fallback:
INSERT INTO storage.buckets (id, name, public)
VALUES ('staff_payouts', 'staff_payouts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anyone to read slip files (public bucket)
CREATE POLICY "Public read staff_payouts"
ON storage.objects FOR SELECT
USING (bucket_id = 'staff_payouts');

-- Allow service role to insert (upload)
CREATE POLICY "Service role upload staff_payouts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'staff_payouts');
