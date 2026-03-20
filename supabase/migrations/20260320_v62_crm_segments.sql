-- Migration: Create crm_segments table
-- Description: Stores custom customer segments created in the CRM tool for use in promotions.

CREATE TABLE IF NOT EXISTS public.crm_segments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;

-- Allow all for now (Admin tool)
CREATE POLICY "Allow all for authenticated users" ON public.crm_segments
    FOR ALL USING (auth.role() = 'authenticated');

-- Add comment
COMMENT ON TABLE public.crm_segments IS 'Stores customer targeting segments for CRM and Promotions.';
