-- CC-based Pricing Refactor Migration
-- Drop old tables
DROP TABLE IF EXISTS service_price_group_items;
DROP TABLE IF EXISTS service_price_groups;
DROP TABLE IF EXISTS service_size_adjustments;

-- Create new CC price groups table
CREATE TABLE cc_price_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  branch_ids UUID[] DEFAULT '{}',
  service_ids UUID[] DEFAULT '{}',
  prices JSONB NOT NULL DEFAULT '{}', -- e.g., {"S": 100, "M": 130, "L": 160, "XL": 190}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE cc_price_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read cc_price_groups" ON cc_price_groups FOR SELECT USING (true);
CREATE POLICY "Admin manage cc_price_groups" ON cc_price_groups FOR ALL USING (true);

-- Update branches to point to the new table (old column was price_group_id, we can keep it but rename in logic or just leave as is)
-- For now, let's just make sure price_group_id is reset since we deleted the parent table
UPDATE branches SET price_group_id = NULL;
