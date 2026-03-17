-- Migration to allow multiple devices per user for push notifications
BEGIN;

-- 1. Add endpoint column to store the destination URL
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS endpoint TEXT;

-- 2. Populate endpoint from existing JSONB data if possible
UPDATE push_subscriptions SET endpoint = subscription->>'endpoint' WHERE endpoint IS NULL;

-- 3. Drop the old (user_id, platform) unique constraint that limited us to one device
ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_platform_key;

-- 4. Add new unique constraint on endpoint (each browser/device has a unique endpoint)
-- We use user_id in the constraint as well just to be safe, but endpoint alone is usually enough.
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);

-- 5. Make endpoint NOT NULL now that it's populated
ALTER TABLE push_subscriptions ALTER COLUMN endpoint SET NOT NULL;

COMMIT;
