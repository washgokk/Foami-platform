-- ==============================================================================
-- Foami Incident Reports & Customer Complaints Migration
-- Migration: 20260911_incident_reports.sql
-- Description: Creates table and indexes for tracking customer reports,
-- shop issues, order complaints, and admin resolution workflows.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_number TEXT NOT NULL UNIQUE,
    report_type TEXT NOT NULL CHECK (report_type IN ('shop', 'order', 'customer_issue', 'payment', 'general')),
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    shop_slug TEXT,
    shop_name TEXT,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    booking_number TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    customer_line_id TEXT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_photos TEXT[] DEFAULT '{}'::TEXT[],
    severity TEXT NOT NULL DEFAULT 'normal' CHECK (severity IN ('low', 'normal', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed', 'refunded')),
    admin_notes TEXT,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for high-performance querying
CREATE INDEX IF NOT EXISTS idx_incident_reports_branch_id ON public.incident_reports(branch_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_booking_id ON public.incident_reports(booking_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON public.incident_reports(status);
CREATE INDEX IF NOT EXISTS idx_incident_reports_created_at ON public.incident_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_reports_type ON public.incident_reports(report_type);

-- Enable RLS
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access on incident_reports" ON public.incident_reports;
CREATE POLICY "Service role full access on incident_reports"
    ON public.incident_reports
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow public insert (customers reporting issues)
DROP POLICY IF EXISTS "Allow public insert on incident_reports" ON public.incident_reports;
CREATE POLICY "Allow public insert on incident_reports"
    ON public.incident_reports
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow authenticated read for shop and platform admins
DROP POLICY IF EXISTS "Allow read access on incident_reports" ON public.incident_reports;
CREATE POLICY "Allow read access on incident_reports"
    ON public.incident_reports
    FOR SELECT
    TO anon, authenticated
    USING (true);
