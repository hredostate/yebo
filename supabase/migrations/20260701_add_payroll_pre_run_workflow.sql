-- Payroll Pre-Run workflow schema
-- Adds normalized payslip, query, and processing state tracking

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums for payroll run status and processing method
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_run_status_v2') THEN
        CREATE TYPE payroll_run_status_v2 AS ENUM (
            'DRAFT',
            'PRE_RUN_PUBLISHED',
            'FINALIZED',
            'PROCESSING',
            'PROCESSED_OFFLINE',
            'PROCESSED_PAYSTACK',
            'FAILED'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_processing_method') THEN
        CREATE TYPE payroll_processing_method AS ENUM ('OFFLINE', 'PAYSTACK');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payslip_status') THEN
        CREATE TYPE payslip_status AS ENUM (
            'DRAFT',
            'AWAITING_APPROVAL',
            'APPROVED',
            'QUERY_RAISED',
            'RESOLVED',
            'FINAL'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payslip_line_item_type') THEN
        CREATE TYPE payslip_line_item_type AS ENUM ('EARNING', 'DEDUCTION', 'INFO');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payslip_query_status') THEN
        CREATE TYPE payslip_query_status AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');
    END IF;
END $$;

-- Main payroll run table
CREATE TABLE IF NOT EXISTS public.payroll_runs_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    period_key TEXT NOT NULL,
    status payroll_run_status_v2 NOT NULL DEFAULT 'DRAFT',
    processing_method payroll_processing_method,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    published_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    finalized_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,
    meta JSONB DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_runs_v2_period ON public.payroll_runs_v2 (school_id, period_key);

-- Payslips table
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id UUID REFERENCES public.payroll_runs_v2(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    status payslip_status NOT NULL DEFAULT 'DRAFT',
    currency TEXT DEFAULT 'NGN',
    gross_pay NUMERIC NOT NULL DEFAULT 0,
    total_deductions NUMERIC NOT NULL DEFAULT 0,
    net_pay NUMERIC NOT NULL DEFAULT 0,
    checksum TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payslip_run_staff ON public.payslips (payroll_run_id, staff_id);
CREATE INDEX IF NOT EXISTS idx_payslips_staff ON public.payslips (staff_id);

-- Line items
CREATE TABLE IF NOT EXISTS public.payslip_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payslip_id UUID REFERENCES public.payslips(id) ON DELETE CASCADE,
    type payslip_line_item_type NOT NULL,
    label TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    ordering INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payslip_line_items_payslip ON public.payslip_line_items (payslip_id);

-- Queries raised by staff
CREATE TABLE IF NOT EXISTS public.payslip_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payslip_id UUID REFERENCES public.payslips(id) ON DELETE CASCADE,
    raised_by_staff_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    status payslip_query_status NOT NULL DEFAULT 'OPEN',
    message TEXT NOT NULL,
    admin_response TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payslip_queries_payslip ON public.payslip_queries (payslip_id);

-- Trigger helpers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_payslip_updated_at'
    ) THEN
        CREATE TRIGGER set_payslip_updated_at
        BEFORE UPDATE ON public.payslips
        FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_payslip_line_item_updated_at'
    ) THEN
        CREATE TRIGGER set_payslip_line_item_updated_at
        BEFORE UPDATE ON public.payslip_line_items
        FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_payslip_query_updated_at'
    ) THEN
        CREATE TRIGGER set_payslip_query_updated_at
        BEFORE UPDATE ON public.payslip_queries
        FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

-- Prevent edits to line items once run is finalized/processed
CREATE OR REPLACE FUNCTION public.prevent_finalized_payslip_edits()
RETURNS TRIGGER AS $$
DECLARE
    run_state payroll_run_status_v2;
BEGIN
    SELECT pr.status INTO run_state
    FROM public.payslips ps
    JOIN public.payroll_runs_v2 pr ON pr.id = ps.payroll_run_id
    WHERE ps.id = COALESCE(NEW.payslip_id, OLD.payslip_id)
    LIMIT 1;

    IF run_state IN ('FINALIZED', 'PROCESSING', 'PROCESSED_OFFLINE', 'PROCESSED_PAYSTACK') THEN
        RAISE EXCEPTION 'Cannot modify payslip line items after payroll is finalized or processing';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'block_finalized_line_item_update'
    ) THEN
        CREATE TRIGGER block_finalized_line_item_update
        BEFORE UPDATE OR DELETE ON public.payslip_line_items
        FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_payslip_edits();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'block_finalized_line_item_insert'
    ) THEN
        CREATE TRIGGER block_finalized_line_item_insert
        BEFORE INSERT ON public.payslip_line_items
        FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_payslip_edits();
    END IF;
END $$;

-- Reset approvals when line items change
CREATE OR REPLACE FUNCTION public.reset_payslip_approval()
RETURNS TRIGGER AS $$
DECLARE
    current_status payslip_status;
BEGIN
    SELECT status INTO current_status FROM public.payslips WHERE id = COALESCE(NEW.payslip_id, OLD.payslip_id);
    IF current_status IN ('APPROVED', 'RESOLVED', 'FINAL') THEN
        UPDATE public.payslips
        SET status = 'AWAITING_APPROVAL', updated_at = NOW()
        WHERE id = COALESCE(NEW.payslip_id, OLD.payslip_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'reset_payslip_approval_on_change'
    ) THEN
        CREATE TRIGGER reset_payslip_approval_on_change
        AFTER INSERT OR UPDATE OR DELETE ON public.payslip_line_items
        FOR EACH ROW EXECUTE FUNCTION public.reset_payslip_approval();
    END IF;
END $$;

-- Basic RLS to keep payslips scoped to owners
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_queries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payslips' AND policyname = 'payslips_staff_select') THEN
        CREATE POLICY payslips_staff_select ON public.payslips
            FOR SELECT USING (staff_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payslips' AND policyname = 'payslips_staff_update') THEN
        CREATE POLICY payslips_staff_update ON public.payslips
            FOR UPDATE USING (staff_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payslip_queries' AND policyname = 'payslip_queries_staff_rw') THEN
        CREATE POLICY payslip_queries_staff_rw ON public.payslip_queries
            FOR ALL USING (raised_by_staff_id = auth.uid()) WITH CHECK (raised_by_staff_id = auth.uid());
    END IF;
END $$;
