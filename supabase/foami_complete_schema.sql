-- ================================================================
-- FOAMI PLATFORM 2.0 — COMPLETE CONSOLIDATED DATABASE SCHEMA
-- ================================================================
-- รันไฟล์นี้ครั้งเดียวใน Supabase SQL Editor (Fresh Project)
-- สร้างตารางทั้งหมด 29 ตาราง + RLS + Storage + Realtime + Indexes
-- ================================================================

-- SECTION 0: EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────────────────────
-- SECTION 1: PLATFORM ADMINISTRATION
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.platform_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL UNIQUE CHECK (name IN ('starter','growth','pro','enterprise')),
    price_monthly_thb   INTEGER NOT NULL DEFAULT 0,
    features            JSONB NOT NULL DEFAULT '{}',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.platform_plans (name, price_monthly_thb, features) VALUES
    ('starter', 0, '{"crm":false,"push":false,"audit":false}'),
    ('growth', 299, '{"crm":true,"push":true,"audit":false}'),
    ('pro', 790, '{"crm":true,"push":true,"audit":true}'),
    ('enterprise', 1290, '{"crm":true,"push":true,"audit":true,"api":true}')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.platform_admins (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL DEFAULT 'super_admin',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shop_invitations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by  TEXT,
    code        TEXT NOT NULL UNIQUE,
    email       TEXT,
    plan_name   TEXT NOT NULL DEFAULT 'starter',
    is_used     BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    used_at     TIMESTAMPTZ,
    shop_name   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- SECTION 2: BRANCH & ZONE
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.branches (
    id                      TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name                    TEXT NOT NULL,
    slug                    TEXT UNIQUE,
    address                 TEXT NOT NULL,
    phone                   TEXT,
    browser_title           TEXT,
    logo_url                TEXT,
    primary_color           TEXT DEFAULT '#315EC3',
    accent_color            TEXT DEFAULT '#A0D9F6',
    lat                     DOUBLE PRECISION NOT NULL DEFAULT 16.4419,
    lng                     DOUBLE PRECISION NOT NULL DEFAULT 102.8360,
    is_active               BOOLEAN DEFAULT TRUE,
    price_group_id          TEXT,
    max_out_of_zone_km      NUMERIC DEFAULT 2,
    out_of_zone_type        TEXT DEFAULT 'per_km',
    out_of_zone_fee         NUMERIC DEFAULT 0,
    labor_cost_per_job      NUMERIC DEFAULT 0,
    max_capital_per_job     NUMERIC DEFAULT 0,
    vehicle_rental_per_job  NUMERIC DEFAULT 0,
    fuel_cost_per_job       NUMERIC DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.zones (
    id              TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    branch_id       TEXT REFERENCES public.branches(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    color           TEXT,
    extra_fee       NUMERIC DEFAULT 0,
    polygon_coords  JSONB DEFAULT '[]',
    is_active       BOOLEAN DEFAULT TRUE
);

-- ──────────────────────────────────────────────────────────────
-- SECTION 3: STAFF
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id           TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    full_name           TEXT NOT NULL,
    email               TEXT,
    password            TEXT,
    phone               TEXT DEFAULT '',
    line_user_id        TEXT,
    image_url           TEXT,
    role                TEXT DEFAULT 'staff' CHECK (role IN ('admin','staff')),
    bank_name           TEXT,
    bank_account_number TEXT,
    promptpay_number    TEXT,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_schedules (
    id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    staff_id    UUID REFERENCES public.staff(id) ON DELETE CASCADE,
    zone_id     TEXT REFERENCES public.zones(id) ON DELETE SET NULL,
    date        DATE NOT NULL,
    time_slot   TIME WITHOUT TIME ZONE NOT NULL,
    work_type   TEXT DEFAULT 'in_zone',
    is_booked   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_payouts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id    UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    start_date  DATE,
    end_date    DATE,
    amount      NUMERIC NOT NULL DEFAULT 0,
    extra_costs NUMERIC NOT NULL DEFAULT 0,
    notes       TEXT,
    slip_url    TEXT,
    booking_ids TEXT[],
    status      TEXT DEFAULT 'completed' CHECK (status IN ('pending','completed','cancelled')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- SECTION 4: SERVICES
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.services (
    id                  TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name                TEXT NOT NULL,
    description         TEXT DEFAULT '',
    image_url           TEXT,
    price_s             NUMERIC NOT NULL DEFAULT 0,
    price_m             NUMERIC NOT NULL DEFAULT 0,
    price_l             NUMERIC NOT NULL DEFAULT 0,
    is_active           BOOLEAN DEFAULT TRUE,
    is_addon_required   BOOLEAN DEFAULT FALSE,
    branch_settings     JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.service_addons (
    id              TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    image_url       TEXT,
    price           NUMERIC NOT NULL DEFAULT 0,
    pricing_type    TEXT DEFAULT 'fixed',
    sub_options     JSONB DEFAULT '[]',
    is_active       BOOLEAN DEFAULT TRUE,
    branch_settings JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.cc_price_groups (
    id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name        TEXT NOT NULL,
    branch_ids  UUID[] DEFAULT '{}',
    service_ids UUID[] DEFAULT '{}',
    prices      JSONB NOT NULL DEFAULT '{}',
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- SECTION 5: CUSTOMERS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customers (
    id                  TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    line_user_id        TEXT NOT NULL UNIQUE,
    full_name           TEXT NOT NULL,
    phone               TEXT NOT NULL,
    gender              TEXT,
    birthdate           DATE,
    occupation          TEXT,
    vehicle_brand       TEXT DEFAULT '',
    vehicle_model       TEXT DEFAULT '',
    vehicle_color       TEXT DEFAULT '',
    license_plate       TEXT DEFAULT '',
    vehicle_size        TEXT DEFAULT 'M' CHECK (vehicle_size IN ('S','M','L')),
    saved_locations     JSONB DEFAULT '[]',
    saved_vehicles      JSONB DEFAULT '[]',
    interests           JSONB DEFAULT '[]',
    is_profile_complete BOOLEAN DEFAULT FALSE,
    reward_claimed      BOOLEAN DEFAULT FALSE,
    last_branch_slug    TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- SECTION 6: DISCOUNTS & CRM
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.discount_codes (
    id                      TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    code                    TEXT NOT NULL UNIQUE,
    discount_type           TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
    discount_value          NUMERIC NOT NULL DEFAULT 0,
    max_discount_amount     NUMERIC,
    max_uses                INTEGER DEFAULT 100,
    used_count              INTEGER DEFAULT 0,
    max_uses_per_customer   INTEGER,
    target_segment          TEXT,
    usage_type              TEXT DEFAULT 'once' CHECK (usage_type IN ('once','all','specific_days','date_range')),
    valid_days              TEXT[],
    valid_from              DATE,
    valid_until             DATE,
    allowed_branch_ids      TEXT[],
    allowed_zone_ids        TEXT[],
    is_refund_code          BOOLEAN DEFAULT FALSE,
    is_active               BOOLEAN DEFAULT TRUE,
    expires_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.discount_usage (
    id                  TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    discount_code_id    TEXT REFERENCES public.discount_codes(id) ON DELETE CASCADE,
    customer_id         TEXT REFERENCES public.customers(id) ON DELETE CASCADE,
    booking_id          TEXT,
    discount_amount     NUMERIC NOT NULL,
    used_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promotions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    type                TEXT NOT NULL CHECK (type IN ('promo','general')),
    target_segment      TEXT,
    discount_code_id    TEXT REFERENCES public.discount_codes(id) ON DELETE SET NULL,
    flex_message_json   JSONB NOT NULL DEFAULT '{}',
    status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent')),
    sent_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_segments (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    conditions  JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- SECTION 7: BOOKINGS (ตารางหลัก)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bookings (
    id                          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    branch_id                   TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    customer_id                 TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    staff_id                    UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    service_id                  TEXT REFERENCES public.services(id) ON DELETE SET NULL,
    zone_id                     TEXT REFERENCES public.zones(id) ON DELETE SET NULL,
    payout_id                   UUID REFERENCES public.staff_payouts(id) ON DELETE SET NULL,
    scheduled_date              DATE NOT NULL,
    scheduled_time              TIME WITHOUT TIME ZONE NOT NULL,
    pickup_address              TEXT DEFAULT '',
    pickup_lat                  DOUBLE PRECISION,
    pickup_lng                  DOUBLE PRECISION,
    delivery_address            TEXT DEFAULT '',
    delivery_lat                DOUBLE PRECISION,
    delivery_lng                DOUBLE PRECISION,
    base_price                  NUMERIC NOT NULL DEFAULT 0,
    original_base_price         NUMERIC DEFAULT 0,
    package_markup_amount       NUMERIC DEFAULT 0,
    extra_fee                   NUMERIC DEFAULT 0,
    travel_surcharge            NUMERIC DEFAULT 0,
    different_spot_fee          NUMERIC DEFAULT 0,
    total_price                 NUMERIC NOT NULL DEFAULT 0,
    discount_code               TEXT,
    discount_amount             NUMERIC DEFAULT 0,
    addon_ids                   JSONB DEFAULT '[]',
    vehicle_data                JSONB,
    vehicle_photos              JSONB DEFAULT '[]',
    customer_note               TEXT,
    additional_price            NUMERIC DEFAULT 0,
    additional_price_note       TEXT,
    additional_price_slips      JSONB DEFAULT '[]',
    additional_history          JSONB DEFAULT '[]',
    is_additional_paid          BOOLEAN DEFAULT FALSE,
    additional_payment_stripe_id TEXT,
    payment_method              TEXT DEFAULT 'stripe' CHECK (payment_method IN ('stripe','transfer','cash','promptpay','other')),
    payment_status              TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded')),
    stripe_payment_id           TEXT,
    slip_url                    TEXT,
    status                      TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','picking_up','washing','delivering','completed','cancelled')),
    auto_assigned               BOOLEAN DEFAULT FALSE,
    staff_extra_payout          NUMERIC DEFAULT 0,
    labor_cost                  NUMERIC DEFAULT 0,
    capital_cost                NUMERIC DEFAULT 0,
    rental_cost                 NUMERIC DEFAULT 0,
    fuel_cost                   NUMERIC DEFAULT 0,
    rating                      INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_comment              TEXT,
    reminder_sent               BOOLEAN DEFAULT FALSE,
    reschedule_count            INTEGER DEFAULT 0,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- SECTION 8: PHOTOS & CHAT
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.job_photos (
    id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    booking_id  TEXT REFERENCES public.bookings(id) ON DELETE CASCADE,
    type        TEXT CHECK (type IN ('before','after')),
    photo_urls  JSONB DEFAULT '[]',
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.booking_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id  TEXT NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer','staff','admin')),
    sender_id   TEXT NOT NULL,
    sender_name TEXT,
    message     TEXT,
    image_url   TEXT,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- SECTION 9: PLATFORM FINANCE
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_wallets (
    id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    shop_id              TEXT NOT NULL UNIQUE,
    balance_thb          NUMERIC NOT NULL DEFAULT 0,
    pending_thb          NUMERIC NOT NULL DEFAULT 0,
    total_earned_thb     NUMERIC NOT NULL DEFAULT 0,
    total_withdrawn_thb  NUMERIC NOT NULL DEFAULT 0,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         TEXT NOT NULL,
    amount_thb      NUMERIC NOT NULL,
    bank_name       TEXT NOT NULL,
    account_number  TEXT NOT NULL,
    account_name    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','completed','rejected')),
    admin_note      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.wallet_ledger (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id       TEXT NOT NULL,
    type          TEXT NOT NULL CHECK (type IN ('credit','debit')),
    amount        NUMERIC NOT NULL,
    description   TEXT,
    balance_after NUMERIC NOT NULL DEFAULT 0,
    booking_id    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- SECTION 10: AUDIT, NOTIFICATIONS & MISC
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id    TEXT NOT NULL,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    old_data    JSONB,
    new_data    JSONB,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id     TEXT NOT NULL,
    platform    TEXT NOT NULL CHECK (platform IN ('customer','staff','admin')),
    endpoint    TEXT NOT NULL UNIQUE,
    subscription JSONB NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_templates (
    slug        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    line_type   TEXT NOT NULL CHECK (line_type IN ('text','flex','sticker')),
    line_content JSONB NOT NULL,
    push_title  TEXT,
    push_body   TEXT,
    push_image  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pwa_auth_bridges (
    id              TEXT PRIMARY KEY,
    customer_data   JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_slug       TEXT NOT NULL UNIQUE,
    shop_name       TEXT NOT NULL,
    description     TEXT,
    address         TEXT,
    logo_url        TEXT,
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    categories      TEXT[] DEFAULT '{}',
    featured_photos JSONB DEFAULT '[]',
    price_from      NUMERIC DEFAULT 0,
    avg_rating      NUMERIC DEFAULT 0,
    review_count    INTEGER DEFAULT 0,
    booking_count   INTEGER DEFAULT 0,
    is_featured     BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT timezone('utc', NOW())
);

-- ──────────────────────────────────────────────────────────────
-- SECTION 11: INDEXES
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_bookings_branch_id        ON public.bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id      ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_staff_id         ON public.bookings(staff_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status           ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_date   ON public.bookings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status   ON public.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_staff_branch_id           ON public.staff(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_date      ON public.staff_schedules(date, time_slot);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff     ON public.staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_zones_branch_id           ON public.zones(branch_id);
CREATE INDEX IF NOT EXISTS idx_booking_messages_booking  ON public.booking_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_branches_slug             ON public.branches(slug);
CREATE INDEX IF NOT EXISTS idx_customers_line_user_id    ON public.customers(line_user_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code       ON public.discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_shop_id     ON public.wallet_ledger(shop_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_shop_id        ON public.withdrawal_requests(shop_id);

-- ──────────────────────────────────────────────────────────────
-- SECTION 12: RLS POLICIES
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.bookings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_wallets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger       ENABLE ROW LEVEL SECURITY;

-- Service Role bypass (API routes use service key — bypasses RLS automatically)
CREATE POLICY "service_bypass" ON public.bookings            FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_bypass" ON public.staff               FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_bypass" ON public.customers           FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_bypass" ON public.shop_wallets        FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_bypass" ON public.withdrawal_requests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_bypass" ON public.wallet_ledger       FOR ALL USING (auth.role() = 'service_role');

-- ──────────────────────────────────────────────────────────────
-- SECTION 13: REALTIME
-- ──────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_messages;

-- ──────────────────────────────────────────────────────────────
-- SECTION 14: STORAGE BUCKETS
-- ──────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public) VALUES
    ('booking-photos', 'booking-photos', TRUE),
    ('staff_payouts',  'staff_payouts',  FALSE),
    ('shop-logos',     'shop-logos',     TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_booking_photos"  ON storage.objects FOR SELECT USING (bucket_id = 'booking-photos');
CREATE POLICY "auth_upload_booking_photos"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'booking-photos');
CREATE POLICY "service_staff_payouts"       ON storage.objects FOR ALL   USING (bucket_id = 'staff_payouts' AND auth.role() = 'service_role');
CREATE POLICY "public_read_shop_logos"      ON storage.objects FOR SELECT USING (bucket_id = 'shop-logos');
CREATE POLICY "auth_upload_shop_logos"      ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'shop-logos');

-- ──────────────────────────────────────────────────────────────
-- SECTION 15: SEED DATA
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.app_settings (key, value) VALUES
    ('platform_fee_percent', '10'),
    ('booking_advance_days', '14'),
    ('auto_assign_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- ================================================================
-- COMPLETE: 29 Tables, 17 Indexes, RLS, Realtime, Storage, Seeds
-- ================================================================