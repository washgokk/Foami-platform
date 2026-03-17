-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- Flexible for customer, staff, or admin IDs
    platform TEXT NOT NULL CHECK (platform IN ('customer', 'staff', 'admin')),
    subscription JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, platform)
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Full access for service role (used in API)
CREATE POLICY "Full access for service role" ON push_subscriptions 
FOR ALL USING (true);

-- Ensure staff_schedules has the combined unique constraint if not already there
-- We saw a migration for this, but let's make sure it's correct for upsert
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'staff_schedules_staff_date_time_zone_key'
    ) THEN
        -- Drop old one if exists
        ALTER TABLE staff_schedules DROP CONSTRAINT IF EXISTS staff_schedules_staff_id_date_time_slot_key;
        -- Add new one
        ALTER TABLE staff_schedules ADD CONSTRAINT staff_schedules_staff_date_time_zone_key UNIQUE (staff_id, date, time_slot, zone_id);
    END IF;
END $$;
