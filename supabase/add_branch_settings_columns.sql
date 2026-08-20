-- ============================================================
-- Migration: Add customization and brand settings to branches
-- ============================================================

ALTER TABLE branches
    ADD COLUMN IF NOT EXISTS browser_title TEXT,
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#315EC3',
    ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#A0D9F6',
    ADD COLUMN IF NOT EXISTS phone TEXT;
