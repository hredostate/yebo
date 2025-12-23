-- Migration: Add student_fee_balances table
-- Date: 2025-12-23
-- Description: Create the student_fee_balances table used by BulkReportCardSender

-- Create the student_fee_balances table
CREATE TABLE IF NOT EXISTS public.student_fee_balances (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    balance NUMERIC DEFAULT 0,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_student_fee_balances_student ON public.student_fee_balances(student_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_balances_school ON public.student_fee_balances(school_id);

-- Enable Row Level Security
ALTER TABLE public.student_fee_balances ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view student fee balances
CREATE POLICY "Staff can view student fee balances" ON public.student_fee_balances
FOR SELECT USING (
    auth.uid() IN (
        SELECT id FROM public.user_profiles 
        WHERE role IN ('Super Admin', 'Admin', 'Principal', 'Vice Principal', 'Teacher', 'Bursar', 'Accountant')
    )
);

-- Policy: Authorized staff can insert/update fee balances
CREATE POLICY "Authorized staff can manage fee balances" ON public.student_fee_balances
FOR ALL USING (
    auth.uid() IN (
        SELECT id FROM public.user_profiles 
        WHERE role IN ('Super Admin', 'Admin', 'Bursar', 'Accountant')
    )
);

-- Add comment for documentation
COMMENT ON TABLE public.student_fee_balances IS 'Stores the current fee balance for each student, used for fee tracking and report card generation';
