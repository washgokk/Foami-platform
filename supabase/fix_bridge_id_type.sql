-- Fix pwa_auth_bridges ID type mismatch
BEGIN;

-- 1. Create a temporary column
ALTER TABLE pwa_auth_bridges ADD COLUMN id_new TEXT;

-- 2. Copy data (though user says it's empty, better safe)
UPDATE pwa_auth_bridges SET id_new = id::text;

-- 3. Drop primary key and old column
ALTER TABLE pwa_auth_bridges DROP CONSTRAINT pwa_auth_bridges_pkey;
ALTER TABLE pwa_auth_bridges DROP COLUMN id;

-- 4. Rename new column and set as primary key
ALTER TABLE pwa_auth_bridges RENAME COLUMN id_new TO id;
ALTER TABLE pwa_auth_bridges ADD PRIMARY KEY (id);

-- 5. Add index back
CREATE INDEX IF NOT EXISTS idx_pwa_auth_bridges_id ON pwa_auth_bridges(id);

COMMIT;
