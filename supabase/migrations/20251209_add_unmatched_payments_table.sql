-- ============================================
-- Unmatched Payments Table for Manual Review
-- ============================================
-- This table stores payments that couldn't be automatically matched to a school/student
-- Admins can manually review and associate these payments

CREATE TABLE IF NOT EXISTS public.unmatched_payments (
    id SERIAL PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    amount NUMERIC NOT NULL,
    payment_date TIMESTAMPTZ,
    payment_method TEXT,
    customer_email TEXT,
    raw_data JSONB,
    verified BOOLEAN DEFAULT true,
    manually_matched BOOLEAN DEFAULT false,
    matched_school_id INTEGER REFERENCES public.schools(id) ON DELETE SET NULL,
    matched_invoice_id INTEGER,
    matched_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    matched_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.unmatched_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Only Super Admins and Accountants can view/manage unmatched payments
DROP POLICY IF EXISTS "Admins can manage unmatched payments" ON public.unmatched_payments;
CREATE POLICY "Admins can manage unmatched payments" ON public.unmatched_payments
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (role = 'Admin' OR role = 'Accountant')
    )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_unmatched_payments_reference ON public.unmatched_payments(reference);
CREATE INDEX IF NOT EXISTS idx_unmatched_payments_manually_matched ON public.unmatched_payments(manually_matched);
CREATE INDEX IF NOT EXISTS idx_unmatched_payments_created_at ON public.unmatched_payments(created_at DESC);

-- Add comment
COMMENT ON TABLE public.unmatched_payments IS 'Stores payments that could not be automatically matched to a school/student and require manual review';
