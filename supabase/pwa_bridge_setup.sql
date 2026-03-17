-- Create PWA Auth Bridge table
CREATE TABLE IF NOT EXISTS pwa_auth_bridges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE pwa_auth_bridges ENABLE ROW LEVEL SECURITY;

-- Allow public to insert (the Safari browser will insert)
CREATE POLICY "Allow public insert" ON pwa_auth_bridges
    FOR INSERT WITH CHECK (true);

-- Allow anyone to select by ID (the PWA will poll)
CREATE POLICY "Allow public select by id" ON pwa_auth_bridges
    FOR SELECT USING (true);

-- Optional: Index for cleanup
CREATE INDEX IF NOT EXISTS idx_pwa_auth_bridges_created_at ON pwa_auth_bridges(created_at);

-- Rule to delete old bridges (older than 30 mins)
-- This is a manual reminder to run a cron or just leave it for now
-- DELETE FROM pwa_auth_bridges WHERE created_at < NOW() - INTERVAL '30 minutes';
