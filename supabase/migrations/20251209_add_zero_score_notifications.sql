-- Migration: Add zero score notifications tracking
-- This table tracks when zero scores are entered, allowing admins and team leaders to monitor and follow up

-- Create zero_score_entries table to track zero score submissions
CREATE TABLE IF NOT EXISTS public.zero_score_entries (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    subject_name TEXT NOT NULL,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    teacher_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    component_name TEXT, -- Which component had zero (CA, Exam, etc.)
    total_score NUMERIC NOT NULL, -- Explicitly record zero, no default
    teacher_comment TEXT,
    entry_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_zero_score_entries_school_term ON public.zero_score_entries(school_id, term_id);
CREATE INDEX IF NOT EXISTS idx_zero_score_entries_teacher ON public.zero_score_entries(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_zero_score_entries_student ON public.zero_score_entries(student_id);
CREATE INDEX IF NOT EXISTS idx_zero_score_entries_reviewed ON public.zero_score_entries(reviewed);
CREATE INDEX IF NOT EXISTS idx_zero_score_entries_entry_date ON public.zero_score_entries(entry_date DESC);

-- RLS Policies for zero_score_entries
ALTER TABLE public.zero_score_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and Team Leads can view all zero score entries in their school
CREATE POLICY "Admins and Team Leads can view zero score entries"
ON public.zero_score_entries
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND up.school_id = zero_score_entries.school_id
        AND up.role IN ('Admin', 'Team Lead', 'Principal')
    )
);

-- Policy: Admins and Team Leads can mark entries as reviewed
CREATE POLICY "Admins and Team Leads can update zero score entries"
ON public.zero_score_entries
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND up.school_id = zero_score_entries.school_id
        AND up.role IN ('Admin', 'Team Lead', 'Principal')
    )
);

-- Policy: System can insert zero score entries (triggered by score entry)
CREATE POLICY "System can insert zero score entries"
ON public.zero_score_entries
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND up.school_id = zero_score_entries.school_id
    )
);

-- Add comment to table
COMMENT ON TABLE public.zero_score_entries IS 'Tracks instances where zero scores are entered, allowing admins and team leaders to monitor and follow up with teachers';
COMMENT ON COLUMN public.zero_score_entries.component_name IS 'Which assessment component had zero score (e.g., CA, Exam)';
COMMENT ON COLUMN public.zero_score_entries.reviewed IS 'Whether an admin or team leader has reviewed this entry';
COMMENT ON COLUMN public.zero_score_entries.review_notes IS 'Notes from admin/team leader review';
