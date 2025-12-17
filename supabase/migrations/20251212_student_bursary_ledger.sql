-- Student bursary & fees ledger overhaul
-- Introduces ledger-based invoices, payments, adjustments, and derived balance views

-- Core reference tables
CREATE TABLE IF NOT EXISTS public.fee_structures (
    id BIGSERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    term_id INTEGER NOT NULL,
    class_group_id INTEGER,
    title TEXT NOT NULL,
    currency TEXT DEFAULT 'NGN',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fee_structures_unique_scope UNIQUE (session_id, term_id, class_group_id, title)
);

CREATE TABLE IF NOT EXISTS public.fee_items (
    id BIGSERIAL PRIMARY KEY,
    fee_structure_id BIGINT REFERENCES public.fee_structures(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_required BOOLEAN DEFAULT TRUE,
    due_date DATE,
    ordering INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fee_items_unique_code UNIQUE (fee_structure_id, code),
    CONSTRAINT fee_items_amount_non_negative CHECK (amount >= 0)
);

CREATE TYPE public.invoice_status AS ENUM ('DRAFT','ISSUED','PARTIALLY_PAID','PAID','VOID');
CREATE TYPE public.payment_method AS ENUM ('OFFLINE','PAYSTACK','TRANSFER','CASH','POS');
CREATE TYPE public.payment_status AS ENUM ('PENDING','SUCCESS','FAILED','REVERSED');
CREATE TYPE public.adjustment_type AS ENUM ('DISCOUNT','WAIVER','SCHOLARSHIP','SURCHARGE','CORRECTION');

CREATE TABLE IF NOT EXISTS public.student_invoices (
    id BIGSERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    term_id INTEGER NOT NULL,
    invoice_no TEXT NOT NULL,
    status public.invoice_status NOT NULL DEFAULT 'DRAFT',
    issued_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT student_invoices_unique_no UNIQUE (invoice_no)
);

CREATE TABLE IF NOT EXISTS public.student_invoice_lines (
    id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT REFERENCES public.student_invoices(id) ON DELETE CASCADE,
    fee_item_code TEXT NOT NULL,
    description TEXT,
    qty NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit_amount NUMERIC(12,2) NOT NULL,
    line_total NUMERIC(14,2) GENERATED ALWAYS AS (qty * unit_amount) STORED,
    ordering INTEGER DEFAULT 1,
    CONSTRAINT student_invoice_lines_amount_positive CHECK (unit_amount >= 0)
);

CREATE TABLE IF NOT EXISTS public.student_payments (
    id BIGSERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    term_id INTEGER NOT NULL,
    payment_ref TEXT NOT NULL,
    method public.payment_method NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status public.payment_status NOT NULL DEFAULT 'PENDING',
    recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    receipt_no TEXT,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT student_payments_unique_ref UNIQUE (payment_ref),
    CONSTRAINT student_payments_amount_positive CHECK (amount >= 0)
);

CREATE TABLE IF NOT EXISTS public.student_payment_allocations (
    id BIGSERIAL PRIMARY KEY,
    payment_id BIGINT REFERENCES public.student_payments(id) ON DELETE CASCADE,
    invoice_id BIGINT REFERENCES public.student_invoices(id) ON DELETE CASCADE,
    allocated_amount NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT student_payment_allocations_non_negative CHECK (allocated_amount >= 0)
);

CREATE TABLE IF NOT EXISTS public.student_adjustments (
    id BIGSERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    term_id INTEGER NOT NULL,
    type public.adjustment_type NOT NULL,
    reason TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    applied_to_invoice_id BIGINT REFERENCES public.student_invoices(id) ON DELETE SET NULL,
    external_ref TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT student_adjustments_amount_non_zero CHECK (amount <> 0),
    CONSTRAINT student_adjustments_external_ref UNIQUE (external_ref)
);

-- Derived totals and balances
CREATE OR REPLACE VIEW public.v_student_invoice_totals AS
SELECT
    inv.id AS invoice_id,
    inv.student_id,
    inv.session_id,
    inv.term_id,
    inv.invoice_no,
    inv.status,
    COALESCE(SUM(lines.line_total),0) AS invoice_total,
    COALESCE(SUM(CASE WHEN adj.type IN ('SURCHARGE','CORRECTION') THEN adj.amount ELSE 0 END),0) AS surcharges,
    COALESCE(SUM(CASE WHEN adj.type IN ('DISCOUNT','WAIVER','SCHOLARSHIP') THEN adj.amount ELSE 0 END),0) AS reliefs,
    COALESCE(SUM(CASE WHEN pay.status = 'SUCCESS' THEN alloc.allocated_amount ELSE 0 END),0) AS total_allocated
FROM public.student_invoices inv
LEFT JOIN public.student_invoice_lines lines ON lines.invoice_id = inv.id
LEFT JOIN public.student_adjustments adj ON adj.applied_to_invoice_id = inv.id
LEFT JOIN public.student_payment_allocations alloc ON alloc.invoice_id = inv.id
LEFT JOIN public.student_payments pay ON pay.id = alloc.payment_id
GROUP BY inv.id;

CREATE OR REPLACE VIEW public.v_student_balances AS
SELECT
    inv.student_id,
    inv.session_id,
    inv.term_id,
    SUM(t.invoice_total) AS total_invoiced,
    SUM(t.surcharges) AS total_surcharges,
    SUM(t.reliefs) AS total_reliefs,
    SUM(t.total_allocated) AS total_paid,
    SUM(t.invoice_total + t.surcharges - t.reliefs - t.total_allocated) AS balance
FROM public.student_invoices inv
JOIN public.v_student_invoice_totals t ON t.invoice_id = inv.id
GROUP BY inv.student_id, inv.session_id, inv.term_id;

-- Guardrail: prevent allocating more than payment amount (across all allocations)
CREATE OR REPLACE FUNCTION public.enforce_allocation_budget()
RETURNS TRIGGER AS $$
DECLARE
    payment_total NUMERIC(14,2);
    allocated NUMERIC(14,2);
BEGIN
    SELECT amount INTO payment_total FROM public.student_payments WHERE id = NEW.payment_id;
    IF payment_total IS NULL THEN
        RAISE EXCEPTION 'Payment % does not exist', NEW.payment_id;
    END IF;

    SELECT COALESCE(SUM(allocated_amount),0) INTO allocated
    FROM public.student_payment_allocations
    WHERE payment_id = NEW.payment_id AND id <> COALESCE(NEW.id,-1);

    IF allocated + NEW.allocated_amount > payment_total THEN
        RAISE EXCEPTION 'Allocations (%.2f) exceed payment %.2f', allocated + NEW.allocated_amount, payment_total;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_allocation_budget ON public.student_payment_allocations;
CREATE CONSTRAINT TRIGGER trg_enforce_allocation_budget
AFTER INSERT OR UPDATE ON public.student_payment_allocations
FOR EACH ROW
DEFERRABLE INITIALLY DEFERRED
EXECUTE FUNCTION public.enforce_allocation_budget();

-- Guardrail: prevent negative invoice lines
ALTER TABLE public.student_invoice_lines
    ADD CONSTRAINT student_invoice_lines_qty_positive CHECK (qty > 0);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_student_invoices_student ON public.student_invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_student_payments_student ON public.student_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_adjustments_student ON public.student_adjustments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_payment_allocations_invoice ON public.student_payment_allocations(invoice_id);

-- Audit comments
COMMENT ON VIEW public.v_student_balances IS 'Derived balances per student/session/term including surcharges, reliefs, and allocations';
COMMENT ON VIEW public.v_student_invoice_totals IS 'Invoice totals with attached adjustments and allocations';
