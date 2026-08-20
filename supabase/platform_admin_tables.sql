-- ============================================================
-- Foami Platform 2.0 — New Tables (สร้างต่อจากของเดิม)
-- ============================================================

-- ─── 1. Platform Plans ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL UNIQUE CHECK (name IN ('starter','growth','pro','enterprise')),
    price_monthly_thb   INT  NOT NULL DEFAULT 0,
    features            JSONB NOT NULL DEFAULT '{}',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_plans (name, price_monthly_thb, features)
VALUES
    ('starter',    0,    '{"crm":false,"push":false,"audit":false}'),
    ('growth',     299,  '{"crm":true,"push":true,"audit":false}'),
    ('pro',        790,  '{"crm":true,"push":true,"audit":true}'),
    ('enterprise', 1290, '{"crm":true,"push":true,"audit":true,"api":true}')
ON CONFLICT (name) DO NOTHING;

-- ─── 2. Platform Admins ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_admins (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL DEFAULT 'super_admin',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. Shop Invitations ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_invitations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by  TEXT,  -- platform admin email
    code        TEXT NOT NULL UNIQUE,
    email       TEXT,
    plan_name   TEXT NOT NULL DEFAULT 'starter',
    is_used     BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    used_at     TIMESTAMPTZ,
    shop_name   TEXT,  -- filled when shop is created via this code
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. Shop Wallets ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_wallets (
    id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    shop_id              TEXT NOT NULL UNIQUE,  -- matches existing branches table concept
    balance_thb          NUMERIC NOT NULL DEFAULT 0,
    pending_thb          NUMERIC NOT NULL DEFAULT 0,
    total_earned_thb     NUMERIC NOT NULL DEFAULT 0,
    total_withdrawn_thb  NUMERIC NOT NULL DEFAULT 0,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. Withdrawal Requests ───────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         TEXT NOT NULL,
    amount_thb      NUMERIC NOT NULL,
    bank_name       TEXT NOT NULL,
    account_number  TEXT NOT NULL,
    account_name    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','completed','rejected')),
    admin_note      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

-- ─── 6. Marketplace Listings ──────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_slug       TEXT NOT NULL UNIQUE,  -- matches branch slug
    shop_name       TEXT NOT NULL,
    description     TEXT,
    categories      TEXT[] DEFAULT '{}',
    featured_photos JSONB DEFAULT '[]',
    avg_rating      NUMERIC DEFAULT 0,
    review_count    INT DEFAULT 0,
    booking_count   INT DEFAULT 0,
    is_featured     BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    address         TEXT,
    logo_url        TEXT,
    price_from      NUMERIC DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 7. Wallet Ledger ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_ledger (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id       TEXT NOT NULL,
    type          TEXT NOT NULL CHECK (type IN ('credit','debit')),
    amount        NUMERIC NOT NULL,
    description   TEXT,
    balance_after NUMERIC NOT NULL DEFAULT 0,
    booking_id    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
