-- ============================================================
-- FOAMI — ID MIGRATION (UUID to TEXT)
-- This script converts Primary and Foreign keys to TEXT
-- to support Scalable Industrial IDs (e.g. BK-..., CU-...)
-- ============================================================

-- 1. DROP CONSTRAINTS (Foreign Keys)
ALTER TABLE IF EXISTS zones DROP CONSTRAINT IF EXISTS zones_branch_id_fkey;
ALTER TABLE IF EXISTS staff DROP CONSTRAINT IF EXISTS staff_branch_id_fkey;
ALTER TABLE IF EXISTS staff_schedules DROP CONSTRAINT IF EXISTS staff_schedules_zone_id_fkey;
ALTER TABLE IF EXISTS bookings DROP CONSTRAINT IF EXISTS bookings_customer_id_fkey;
ALTER TABLE IF EXISTS bookings DROP CONSTRAINT IF EXISTS bookings_service_id_fkey;
ALTER TABLE IF EXISTS bookings DROP CONSTRAINT IF EXISTS bookings_zone_id_fkey;
ALTER TABLE IF EXISTS bookings DROP CONSTRAINT IF EXISTS bookings_branch_id_fkey;
ALTER TABLE IF EXISTS job_photos DROP CONSTRAINT IF EXISTS job_photos_booking_id_fkey;
ALTER TABLE IF EXISTS push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_platform_key;

-- 2. ALTER TABLE COLUMNS (Change UUID -> TEXT)

-- Branches
ALTER TABLE branches ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE branches ALTER COLUMN price_group_id TYPE TEXT USING price_group_id::TEXT;

-- Zones
ALTER TABLE zones ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE zones ALTER COLUMN branch_id TYPE TEXT USING branch_id::TEXT;

-- Staff (PK stays UUID as it follows Auth.Users, but branch_id changes)
ALTER TABLE staff ALTER COLUMN branch_id TYPE TEXT USING branch_id::TEXT;

-- Services & Addons
ALTER TABLE services ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE service_addons ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- Customers
ALTER TABLE customers ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- CC Price Groups
ALTER TABLE cc_price_groups ALTER COLUMN id TYPE TEXT USING id::TEXT;
-- Convert UUID arrays to TEXT arrays
ALTER TABLE cc_price_groups ALTER COLUMN branch_ids TYPE TEXT[] USING branch_ids::TEXT[];
ALTER TABLE cc_price_groups ALTER COLUMN service_ids TYPE TEXT[] USING service_ids::TEXT[];

-- Staff Schedules
ALTER TABLE staff_schedules ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE staff_schedules ALTER COLUMN zone_id TYPE TEXT USING zone_id::TEXT;

-- Bookings
ALTER TABLE bookings ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE bookings ALTER COLUMN customer_id TYPE TEXT USING customer_id::TEXT;
ALTER TABLE bookings ALTER COLUMN service_id TYPE TEXT USING service_id::TEXT;
ALTER TABLE bookings ALTER COLUMN zone_id TYPE TEXT USING zone_id::TEXT;
ALTER TABLE bookings ALTER COLUMN branch_id TYPE TEXT USING branch_id::TEXT;

-- Job Photos
ALTER TABLE job_photos ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE job_photos ALTER COLUMN booking_id TYPE TEXT USING booking_id::TEXT;

-- Push Subscriptions
ALTER TABLE push_subscriptions ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE push_subscriptions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Discount Codes
ALTER TABLE discount_codes ALTER COLUMN id TYPE TEXT USING id::TEXT;


-- 3. RESTORE CONSTRAINTS (Foreign Keys)
ALTER TABLE zones ADD CONSTRAINT zones_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE staff ADD CONSTRAINT staff_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE;
ALTER TABLE staff_schedules ADD CONSTRAINT staff_schedules_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES zones(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE bookings ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE CASCADE;
ALTER TABLE bookings ADD CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON UPDATE CASCADE;
ALTER TABLE bookings ADD CONSTRAINT bookings_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES zones(id) ON UPDATE CASCADE;
ALTER TABLE bookings ADD CONSTRAINT bookings_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE;
ALTER TABLE job_photos ADD CONSTRAINT job_photos_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_platform_key UNIQUE (user_id, platform);

-- 4. CLEANUP DEFAULTS (Optional: Remove standard UUID generation if you strictly want BK-)
-- ALTER TABLE bookings ALTER COLUMN id DROP DEFAULT;
-- ALTER TABLE customers ALTER COLUMN id DROP DEFAULT;

-- SUCCESS: Database is now ready for Professional Scalable IDs!
