-- Payroll V2 Migration
-- Complete workflow with offline processing and staff payslip approval

-- Payroll Runs V2 table
CREATE TABLE IF NOT EXISTS public.payroll_runs_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id INTEGER NOT NULL REFERENCES public.schools(id),
    period_key TEXT NOT NULL, -- e.g., "2025-12" for December 2025
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PRE_RUN_PUBLISHED', 'FINALIZED', 'PROCESSING', 'PROCESSED_OFFLINE', 'PROCESSED_PAYSTACK', 'FAILED')),
    processing_method TEXT CHECK (processing_method IN ('OFFLINE', 'PAYSTACK')),
    created_by UUID REFERENCES auth.users(id),
    published_by UUID REFERENCES auth.users(id),
    finalized_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,
    meta JSONB DEFAULT '{}'::jsonb,
    -- Unique constraint prevents duplicate payroll runs for the same period
    -- If a run fails, delete it before creating a new one for the same period
    UNIQUE(school_id, period_key)
);

-- Payslips table (one per staff per run)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs_v2(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'QUERY_RAISED', 'RESOLVED', 'FINAL')),
    currency TEXT DEFAULT 'NGN',
    gross_pay NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
    net_pay NUMERIC(14,2) NOT NULL DEFAULT 0,
    checksum TEXT, -- For integrity verification
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(payroll_run_id, staff_id)
);

-- Payslip Line Items (earnings and deductions breakdown)
CREATE TABLE IF NOT EXISTS public.payslip_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'INFO')),
    label TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    ordering INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payslip Queries (staff questions/disputes)
CREATE TABLE IF NOT EXISTS public.payslip_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    raised_by_staff_id UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED')),
    message TEXT NOT NULL,
    admin_response TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.payroll_runs_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_queries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "payroll_runs_v2_select" ON public.payroll_runs_v2
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "payroll_runs_v2_manage" ON public.payroll_runs_v2
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('Admin', 'Principal', 'School Owner', 'Accountant'))
    );

CREATE POLICY "payslips_select_own" ON public.payslips
    FOR SELECT TO authenticated USING (
        staff_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('Admin', 'Principal', 'School Owner', 'Accountant'))
    );

CREATE POLICY "payslips_manage" ON public.payslips
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('Admin', 'Principal', 'School Owner', 'Accountant'))
    );

CREATE POLICY "payslip_line_items_select" ON public.payslip_line_items
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.payslips WHERE id = payslip_id AND (
            staff_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('Admin', 'Principal', 'School Owner', 'Accountant'))
        ))
    );

CREATE POLICY "payslip_queries_select" ON public.payslip_queries
    FOR SELECT TO authenticated USING (
        raised_by_staff_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('Admin', 'Principal', 'School Owner', 'Accountant'))
    );

CREATE POLICY "payslip_queries_insert" ON public.payslip_queries
    FOR INSERT TO authenticated WITH CHECK (
        raised_by_staff_id = auth.uid()
    );

CREATE POLICY "payslip_queries_update" ON public.payslip_queries
    FOR UPDATE TO authenticated USING (
        raised_by_staff_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('Admin', 'Principal', 'School Owner', 'Accountant'))
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payroll_runs_v2_school ON public.payroll_runs_v2(school_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_v2_status ON public.payroll_runs_v2(status);
CREATE INDEX IF NOT EXISTS idx_payslips_run ON public.payslips(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payslips_staff ON public.payslips(staff_id);
CREATE INDEX IF NOT EXISTS idx_payslip_line_items_payslip ON public.payslip_line_items(payslip_id);
CREATE INDEX IF NOT EXISTS idx_payslip_queries_payslip ON public.payslip_queries(payslip_id);
