ALTER TABLE services ADD COLUMN IF NOT EXISTS branch_settings JSONB DEFAULT '{}'::jsonb; ALTER TABLE service_addons ADD COLUMN IF NOT EXISTS branch_settings JSONB DEFAULT '{}'::jsonb;
