-- ============================================================
-- 🚀 FOAMI PLATFORM 2.0 — FULL COMPLETE DATABASE SCHEMA
-- ชุดคำสั่ง SQL สำหรับรันใน Supabase SQL Editor ของ Project ใหม่
-- รันครั้งเดียวเพื่อสร้างตารางทั้งหมด 29 ตาราง + Extensions + ข้อมูลตั้งต้น
-- ============================================================

-- ─── 0. EXTENSIONS ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 1. PLATFORM PLANS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (name = ANY (ARRAY['starter'::text, 'growth'::text, 'pro'::text, 'enterprise'::text])),
  price_monthly_thb integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT platform_plans_pkey PRIMARY KEY (id)
);

-- Seed Platform Plans
INSERT INTO public.platform_plans (name, price_monthly_thb, features)
VALUES
    ('starter',    0,    '{"crm":false,"push":false,"audit":false}'),
    ('growth',     299,  '{"crm":true,"push":true,"audit":false}'),
    ('pro',        790,  '{"crm":true,"push":true,"audit":true}'),
    ('enterprise', 1290, '{"crm":true,"push":true,"audit":true,"api":true}')
ON CONFLICT (name) DO NOTHING;

-- ─── 2. BRANCHES (SHOPS) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.branches (
  id text NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE,
  address text NOT NULL,
  phone text,
  browser_title text,
  logo_url text,
  primary_color text DEFAULT '#315EC3'::text,
  accent_color text DEFAULT '#A0D9F6'::text,
  lat double precision NOT NULL DEFAULT 16.4419,
  lng double precision NOT NULL DEFAULT 102.8360,
  is_active boolean DEFAULT true,
  price_group_id text,
  max_out_of_zone_km numeric DEFAULT 2,
  out_of_zone_type text DEFAULT 'per_km'::text,
  out_of_zone_fee numeric DEFAULT 0,
  labor_cost_per_job numeric DEFAULT 0,
  max_capital_per_job numeric DEFAULT 0,
  vehicle_rental_per_job numeric DEFAULT 0,
  fuel_cost_per_job numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branches_pkey PRIMARY KEY (id)
);

-- ─── 3. ZONES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.zones (
  id text NOT NULL DEFAULT uuid_generate_v4(),
  branch_id text,
  name text NOT NULL,
  description text DEFAULT ''::text,
  color text,
  extra_fee numeric DEFAULT 0,
  polygon_coords jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  CONSTRAINT zones_pkey PRIMARY KEY (id),
  CONSTRAINT zones_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE
);

-- ─── 4. STAFF (พนักงาน / ไรเดอร์ / แอดมินร้าน) ─────────────
CREATE TABLE IF NOT EXISTS public.staff (
  id uuid NOT NULL,
  branch_id text,
  full_name text NOT NULL,
  email text,
  password text,
  phone text DEFAULT ''::text,
  line_user_id text,
  image_url text,
  role text DEFAULT 'staff'::text CHECK (role = ANY (ARRAY['admin'::text, 'staff'::text])),
  bank_name text,
  bank_account_number text,
  promptpay_number text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_pkey PRIMARY KEY (id),
  CONSTRAINT staff_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT staff_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL
);

-- ─── 5. STAFF PAYOUTS (ประวัติจ่ายเงินพนักงาน) ──────────────
CREATE TABLE IF NOT EXISTS public.staff_payouts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  staff_id uuid,
  start_date date,
  end_date date,
  amount numeric NOT NULL DEFAULT 0,
  extra_costs numeric NOT NULL DEFAULT 0,
  notes text,
  slip_url text,
  booking_ids text[],
  status text DEFAULT 'completed'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_payouts_pkey PRIMARY KEY (id),
  CONSTRAINT staff_payouts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL
);

-- ─── 6. SERVICES (บริการหลัก) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.services (
  id text NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text DEFAULT ''::text,
  image_url text,
  price_s numeric NOT NULL DEFAULT 0,
  price_m numeric NOT NULL DEFAULT 0,
  price_l numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  is_addon_required boolean DEFAULT false,
  branch_settings jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT services_pkey PRIMARY KEY (id)
);

-- ─── 7. SERVICE ADDONS (บริการเสริม) ────────────────────────
CREATE TABLE IF NOT EXISTS public.service_addons (
  id text NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text DEFAULT ''::text,
  image_url text,
  price numeric NOT NULL DEFAULT 0,
  pricing_type text DEFAULT 'fixed'::text,
  sub_options jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  branch_settings jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT service_addons_pkey PRIMARY KEY (id)
);

-- ─── 8. CUSTOMERS (ลูกค้า) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id text NOT NULL DEFAULT uuid_generate_v4(),
  line_user_id text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text NOT NULL,
  gender text,
  birthdate date,
  occupation text,
  vehicle_brand text DEFAULT ''::text,
  vehicle_model text DEFAULT ''::text,
  vehicle_color text DEFAULT ''::text,
  license_plate text DEFAULT ''::text,
  vehicle_size text DEFAULT 'M'::text CHECK (vehicle_size = ANY (ARRAY['S'::text, 'M'::text, 'L'::text])),
  saved_locations jsonb DEFAULT '[]'::jsonb,
  saved_vehicles jsonb DEFAULT '[]'::jsonb,
  interests jsonb DEFAULT '[]'::jsonb,
  is_profile_complete boolean DEFAULT false,
  reward_claimed boolean DEFAULT false,
  last_branch_slug text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);

-- ─── 9. CC PRICE GROUPS (กลุ่มราคาตามขนาด CC) ───────────────
CREATE TABLE IF NOT EXISTS public.cc_price_groups (
  id text NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  branch_ids uuid[] DEFAULT '{}'::uuid[],
  service_ids uuid[] DEFAULT '{}'::uuid[],
  prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cc_price_groups_pkey PRIMARY KEY (id)
);

-- ─── 10. DISCOUNT CODES (โค้ดส่วนลด) ───────────────────────
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id text NOT NULL DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type = ANY (ARRAY['percent'::text, 'fixed'::text])),
  discount_value numeric NOT NULL DEFAULT 0,
  max_discount_amount numeric,
  max_uses integer DEFAULT 100,
  used_count integer DEFAULT 0,
  max_uses_per_customer integer,
  target_segment text,
  usage_type text DEFAULT 'once'::text CHECK (usage_type = ANY (ARRAY['once'::text, 'all'::text, 'specific_days'::text, 'date_range'::text])),
  valid_days text[],
  valid_from date,
  valid_until date,
  allowed_branch_ids text[],
  allowed_zone_ids text[],
  is_refund_code boolean DEFAULT false,
  is_active boolean DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT discount_codes_pkey PRIMARY KEY (id)
);

-- ─── 11. CRM SEGMENTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_segments (
  id text NOT NULL,
  name text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT crm_segments_pkey PRIMARY KEY (id)
);

-- ─── 12. STAFF SCHEDULES (ตารางเวรพนักงาน) ──────────────────
CREATE TABLE IF NOT EXISTS public.staff_schedules (
  id text NOT NULL DEFAULT uuid_generate_v4(),
  staff_id uuid,
  zone_id text,
  date date NOT NULL,
  time_slot time without time zone NOT NULL,
  work_type text DEFAULT 'in_zone'::text,
  is_booked boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT staff_schedules_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE,
  CONSTRAINT staff_schedules_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL
);

-- ─── 13. BOOKINGS (รายการจองบริการ) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id text NOT NULL DEFAULT uuid_generate_v4(),
  branch_id text,
  customer_id text,
  staff_id uuid,
  service_id text,
  zone_id text,
  payout_id uuid,
  scheduled_date date NOT NULL,
  scheduled_time time without time zone NOT NULL,
  pickup_address text DEFAULT ''::text,
  pickup_lat double precision,
  pickup_lng double precision,
  delivery_address text DEFAULT ''::text,
  delivery_lat double precision,
  delivery_lng double precision,
  different_spot_fee numeric DEFAULT 0,
  travel_surcharge numeric DEFAULT 0,
  extra_fee numeric DEFAULT 0,
  base_price numeric NOT NULL DEFAULT 0,
  original_base_price numeric DEFAULT 0,
  package_markup_amount numeric DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  discount_code text,
  discount_amount numeric DEFAULT 0,
  addon_ids jsonb DEFAULT '[]'::jsonb,
  vehicle_data jsonb,
  vehicle_photos jsonb DEFAULT '[]'::jsonb,
  customer_note text,
  additional_price numeric DEFAULT 0,
  additional_price_note text,
  additional_price_slips jsonb DEFAULT '[]'::jsonb,
  additional_history jsonb DEFAULT '[]'::jsonb,
  is_additional_paid boolean DEFAULT false,
  additional_payment_stripe_id text,
  payment_method text DEFAULT 'stripe'::text CHECK (payment_method = ANY (ARRAY['stripe'::text, 'transfer'::text, 'cash'::text, 'promptpay'::text, 'other'::text])),
  payment_status text DEFAULT 'pending'::text CHECK (payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'refunded'::text])),
  stripe_payment_id text,
  slip_url text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'picking_up'::text, 'washing'::text, 'delivering'::text, 'completed'::text, 'cancelled'::text])),
  auto_assigned boolean DEFAULT false,
  staff_extra_payout numeric DEFAULT 0,
  labor_cost numeric DEFAULT 0,
  capital_cost numeric DEFAULT 0,
  rental_cost numeric DEFAULT 0,
  fuel_cost numeric DEFAULT 0,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  review_comment text,
  reminder_sent boolean DEFAULT false,
  reschedule_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL,
  CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL,
  CONSTRAINT bookings_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL,
  CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL,
  CONSTRAINT bookings_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL,
  CONSTRAINT bookings_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.staff_payouts(id) ON DELETE SET NULL
);

-- ─── 14. JOB PHOTOS (รูปถ่ายงานก่อน-หลัง) ────────────────────
CREATE TABLE IF NOT EXISTS public.job_photos (
  id text NOT NULL DEFAULT uuid_generate_v4(),
  booking_id text,
  type text CHECK (type = ANY (ARRAY['before'::text, 'after'::text])),
  photo_urls jsonb DEFAULT '[]'::jsonb,
  uploaded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT job_photos_pkey PRIMARY KEY (id),
  CONSTRAINT job_photos_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE
);

-- ─── 15. DISCOUNT USAGE (ประวัติการใช้ส่วนลด) ─────────────────
CREATE TABLE IF NOT EXISTS public.discount_usage (
  id text NOT NULL,
  discount_code_id text,
  customer_id text,
  booking_id text,
  discount_amount numeric NOT NULL,
  used_at timestamp with time zone DEFAULT now(),
  CONSTRAINT discount_usage_pkey PRIMARY KEY (id),
  CONSTRAINT discount_usage_discount_code_id_fkey FOREIGN KEY (discount_code_id) REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  CONSTRAINT discount_usage_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE
);

-- ─── 16. AUDIT LOGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  admin_id text NOT NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

-- ─── 17. PUSH SUBSCRIPTIONS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id text NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  platform text NOT NULL CHECK (platform = ANY (ARRAY['customer'::text, 'staff'::text, 'admin'::text])),
  endpoint text NOT NULL UNIQUE,
  subscription jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id)
);

-- ─── 18. PWA AUTH BRIDGES ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pwa_auth_bridges (
  id text NOT NULL,
  customer_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pwa_auth_bridges_pkey PRIMARY KEY (id)
);

-- ─── 19. PROMOTIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['promo'::text, 'general'::text])),
  target_segment text,
  discount_code_id text,
  flex_message_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text])),
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT promotions_pkey PRIMARY KEY (id),
  CONSTRAINT promotions_discount_code_id_fkey FOREIGN KEY (discount_code_id) REFERENCES public.discount_codes(id) ON DELETE SET NULL
);

-- ─── 20. NOTIFICATION TEMPLATES ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_templates (
  slug text NOT NULL,
  name text NOT NULL,
  line_type text NOT NULL CHECK (line_type = ANY (ARRAY['text'::text, 'flex'::text, 'sticker'::text])),
  line_content jsonb NOT NULL,
  push_title text,
  push_body text,
  push_image text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_templates_pkey PRIMARY KEY (slug)
);

-- ─── 21. BOOKING MESSAGES (Realtime Chat) ───────────────────
CREATE TABLE IF NOT EXISTS public.booking_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id text NOT NULL,
  sender_type text NOT NULL CHECK (sender_type = ANY (ARRAY['customer'::text, 'staff'::text, 'admin'::text])),
  sender_id text NOT NULL,
  sender_name text,
  message text,
  image_url text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT booking_messages_pkey PRIMARY KEY (id)
);

-- ─── 22. SETTINGS TABLES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT system_settings_pkey PRIMARY KEY (key)
);

-- ─── 23. PLATFORM ADMINS (Super Admins) ─────────────────────
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'super_admin'::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT platform_admins_pkey PRIMARY KEY (id),
  CONSTRAINT platform_admins_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ─── 24. SHOP INVITATIONS (เทียบเชิญร้านค้า) ────────────────
CREATE TABLE IF NOT EXISTS public.shop_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  email text,
  shop_name text,
  plan_name text NOT NULL DEFAULT 'starter'::text,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  created_by text,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '7 days'::interval),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shop_invitations_pkey PRIMARY KEY (id)
);

-- ─── 25. SHOP WALLETS (กระเป๋าเงินแต่ละร้าน) ───────────────
CREATE TABLE IF NOT EXISTS public.shop_wallets (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  shop_id text NOT NULL UNIQUE,
  balance_thb numeric NOT NULL DEFAULT 0,
  pending_thb numeric NOT NULL DEFAULT 0,
  total_earned_thb numeric NOT NULL DEFAULT 0,
  total_withdrawn_thb numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shop_wallets_pkey PRIMARY KEY (id)
);

-- ─── 26. WITHDRAWAL REQUESTS (คำขอถอนเงินของร้าน) ───────────
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  amount_thb numeric NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'completed'::text, 'rejected'::text])),
  admin_note text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id)
);

-- ─── 27. MARKETPLACE LISTINGS ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  shop_slug text NOT NULL UNIQUE,
  shop_name text NOT NULL,
  description text,
  address text,
  logo_url text,
  lat double precision,
  lng double precision,
  categories text[] DEFAULT '{}'::text[],
  featured_photos jsonb DEFAULT '[]'::jsonb,
  price_from numeric DEFAULT 0,
  avg_rating numeric DEFAULT 0,
  review_count integer DEFAULT 0,
  booking_count integer DEFAULT 0,
  is_featured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_listings_pkey PRIMARY KEY (id)
);

-- ─── 28. WALLET LEDGER (สมุดบัญชีรายรับ-รายจ่ายร้าน) ───────
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['credit'::text, 'debit'::text])),
  amount numeric NOT NULL,
  balance_after numeric NOT NULL DEFAULT 0,
  description text,
  booking_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT wallet_ledger_pkey PRIMARY KEY (id)
);

-- ─── 29. INDEXES (เพิ่มความเร็วการค้นหา) ───────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_branch_id ON public.bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_date ON public.bookings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_date ON public.staff_schedules(date, time_slot);
CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_id ON public.booking_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_branches_slug ON public.branches(slug);
