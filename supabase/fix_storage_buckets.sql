-- Ensure storage bucket "job-photos" exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Ensure storage bucket "slips" exists and is public (for additional expense receipts)
INSERT INTO storage.buckets (id, name, public)
VALUES ('slips', 'slips', true)
ON CONFLICT (id) DO NOTHING;

-- Ensure RLS allows public uploads/downloads if not already set
-- These are broad policies for development; refine for production.
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR ALL USING (true) WITH CHECK (true);
