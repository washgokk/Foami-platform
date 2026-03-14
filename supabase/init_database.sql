-- ============================================================
-- FOAMI — Master Database Initialization
-- ============================================================

-- 1. Prerequisites
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Core Tables
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL DEFAULT 16.4419,
  lng DOUBLE PRECISION NOT NULL DEFAULT 102.8360,
  is_active BOOLEAN DEFAULT TRUE,
  price_group_id UUID, -- Placeholder for CC groups navigation
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  extra_fee NUMERIC DEFAULT 0,
  polygon_coords JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE staff (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  full_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  line_user_id TEXT,
  email TEXT,
  role TEXT DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  password TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price_s NUMERIC NOT NULL DEFAULT 0,
  price_m NUMERIC NOT NULL DEFAULT 0,
  price_l NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE service_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_brand TEXT DEFAULT '',
  vehicle_model TEXT DEFAULT '',
  vehicle_color TEXT DEFAULT '',
  license_plate TEXT DEFAULT '',
  vehicle_size TEXT DEFAULT 'M' CHECK (vehicle_size IN ('S', 'M', 'L')),
  saved_locations JSONB DEFAULT '[]',
  saved_vehicles JSONB DEFAULT '[]',
  gender TEXT,
  birthdate DATE,
  occupation TEXT,
  interests JSONB DEFAULT '[]',
  is_profile_complete BOOLEAN DEFAULT FALSE,
  reward_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cc_price_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  branch_ids UUID[] DEFAULT '{}',
  service_ids UUID[] DEFAULT '{}',
  prices JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES
  ('profile_reward', '{
    "is_active": true,
    "title": "🎁 ของขวัญพิเศษสำหรับคุณ!",
    "description": "เพียงกรอกข้อมูลโปรไฟล์ให้ครบถ้วน รับทันทีส่วนลดสำหรับการล้างรถครั้งถัดไป",
    "reward_code": "PROCOMP10",
    "button_text": "ไปที่ตั้งค่า"
  }');

CREATE TABLE staff_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_slot TIME NOT NULL,
  is_booked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (staff_id, date, time_slot)
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  staff_id UUID REFERENCES staff(id),
  service_id UUID REFERENCES services(id),
  addon_ids JSONB DEFAULT '[]',
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  pickup_address TEXT DEFAULT '',
  delivery_lat DOUBLE PRECISION,
  delivery_lng DOUBLE PRECISION,
  delivery_address TEXT DEFAULT '',
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  zone_id UUID REFERENCES zones(id),
  extra_fee NUMERIC DEFAULT 0,
  base_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  discount_code TEXT,
  discount_amount NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'stripe' CHECK (payment_method IN ('stripe', 'transfer')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  stripe_payment_id TEXT,
  additional_price NUMERIC DEFAULT 0,
  additional_price_note TEXT,
  is_additional_paid BOOLEAN DEFAULT FALSE,
  additional_payment_stripe_id TEXT,
  slip_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'picking_up', 'washing', 'delivering', 'completed', 'cancelled')),
  auto_assigned BOOLEAN DEFAULT FALSE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_comment TEXT,
  vehicle_photos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  vehicle_data JSONB,
  branch_id UUID REFERENCES branches(id),
  customer_note TEXT
);

CREATE TABLE job_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('before', 'after')),
  photo_urls JSONB DEFAULT '[]',
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (booking_id, type)
);

CREATE TABLE discount_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT CHECK (discount_type IN ('percent', 'fixed')) NOT NULL,
  discount_value NUMERIC NOT NULL DEFAULT 0,
  max_uses INTEGER DEFAULT 100,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Row Level Security (RLS) - Master Policies
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_price_groups ENABLE ROW LEVEL SECURITY;

-- Unified "Manage Everything" for Simplicity (Admin Logic is already in the app)
CREATE POLICY "Full access" ON branches FOR ALL USING (true);
CREATE POLICY "Full access" ON zones FOR ALL USING (true);
CREATE POLICY "Full access" ON staff FOR ALL USING (true);
CREATE POLICY "Full access" ON services FOR ALL USING (true);
CREATE POLICY "Full access" ON service_addons FOR ALL USING (true);
CREATE POLICY "Full access" ON customers FOR ALL USING (true);
CREATE POLICY "Full access" ON staff_schedules FOR ALL USING (true);
CREATE POLICY "Full access" ON bookings FOR ALL USING (true);
CREATE POLICY "Full access" ON job_photos FOR ALL USING (true);
CREATE POLICY "Full access" ON discount_codes FOR ALL USING (true);
CREATE POLICY "Full access" ON cc_price_groups FOR ALL USING (true);

-- 4. Seed Data
INSERT INTO branches (name, address, lat, lng) VALUES
  ('สาขา มข.', 'มหาวิทยาลัยขอนแก่น, ขอนแก่น', 16.4419, 102.8360),
  ('สาขาในเมือง', 'ใจกลางเมืองขอนแก่น', 16.4322, 102.8333);

INSERT INTO services (name, description, price_s, price_m, price_l) VALUES
  ('ล้างสี (Basic)', 'ล้างทำความสะอาดทั่วไป', 80, 100, 130),
  ('ล้างสีพร้อมเคลือบ (Premium)', 'ล้างและเคลือบสีให้เงางาม', 150, 180, 220),
  ('ล้างเครื่อง + สี (Full Service)', 'ล้างทำความสะอาดทั้งภายนอกและเครื่องยนต์', 200, 240, 290);

INSERT INTO service_addons (name, description, price) VALUES
  ('เคลือบแก้ว', 'ปกป้องสีรถด้วยน้ำยาเคลือบแก้ว', 80),
  ('ล้างโซ่ + หล่อลื่น', 'ทำความสะอาดและหล่อลื่นโซ่ขับ', 50),
  ('ขัดสี (Polishing)', 'ขัดสีให้ขึ้นเงาสวย', 120),
  ('ฉีดยาง / แว็กซ์', 'เคลือบยางดำเงา', 40);

INSERT INTO discount_codes (code, discount_type, discount_value, max_uses) VALUES
  ('FOAMI2025', 'fixed', 50, 500),
  ('WELCOME10', 'percent', 10, 200);
