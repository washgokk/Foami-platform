-- Verify and fix push_subscriptions for multi-device support
BEGIN;

-- 1. Check if endpoint column exists, if not add it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='push_subscriptions' AND column_name='endpoint') THEN
        ALTER TABLE push_subscriptions ADD COLUMN endpoint TEXT;
    END IF;
END $$;

-- 2. Populate endpoint from existing JSON data
UPDATE push_subscriptions 
SET endpoint = subscription->>'endpoint' 
WHERE endpoint IS NULL;

-- 3. Remove old unique constraint if it exists
-- It might be named push_subscriptions_user_id_platform_key
ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_platform_key;

-- 4. Add new unique constraint on endpoint
-- Each device has its own unique endpoint
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_endpoint_key') THEN
        ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
    END IF;
END $$;

-- 5. Ensure endpoint is NOT NULL
ALTER TABLE push_subscriptions ALTER COLUMN endpoint SET NOT NULL;

COMMIT;

-- Query to verify (Run this to see your devices)
-- SELECT user_id, platform, endpoint FROM push_subscriptions;
