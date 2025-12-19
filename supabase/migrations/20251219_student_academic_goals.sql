-- Migration: Student Academic Goals Feature
-- Description: Adds support for students to set academic goals and track achievement

-- Create student_academic_goals table
CREATE TABLE IF NOT EXISTS public.student_academic_goals (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    goal_text TEXT NOT NULL,
    target_average NUMERIC,
    target_position INTEGER,
    target_subjects JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, term_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_student_academic_goals_student_term 
ON public.student_academic_goals(student_id, term_id);

-- Add columns to student_term_reports table
ALTER TABLE public.student_term_reports
ADD COLUMN IF NOT EXISTS academic_goal_id INTEGER REFERENCES public.student_academic_goals(id),
ADD COLUMN IF NOT EXISTS goal_analysis_report TEXT,
ADD COLUMN IF NOT EXISTS goal_achievement_rating TEXT CHECK (goal_achievement_rating IN ('exceeded', 'met', 'partially_met', 'not_met')),
ADD COLUMN IF NOT EXISTS goal_analysis_generated_at TIMESTAMP WITH TIME ZONE;

-- Create index on academic_goal_id for faster joins
CREATE INDEX IF NOT EXISTS idx_student_term_reports_academic_goal 
ON public.student_term_reports(academic_goal_id);

-- RLS Policies for student_academic_goals
-- Enable RLS
ALTER TABLE public.student_academic_goals ENABLE ROW LEVEL SECURITY;

-- Policy: Students can view their own goals
CREATE POLICY "Students can view their own goals"
ON public.student_academic_goals
FOR SELECT
USING (
    auth.uid() IN (
        SELECT user_id 
        FROM public.students 
        WHERE id = student_academic_goals.student_id
    )
);

-- Policy: Students can insert their own goals
CREATE POLICY "Students can insert their own goals"
ON public.student_academic_goals
FOR INSERT
WITH CHECK (
    auth.uid() IN (
        SELECT user_id 
        FROM public.students 
        WHERE id = student_academic_goals.student_id
    )
);

-- Policy: Students can update their own goals
CREATE POLICY "Students can update their own goals"
ON public.student_academic_goals
FOR UPDATE
USING (
    auth.uid() IN (
        SELECT user_id 
        FROM public.students 
        WHERE id = student_academic_goals.student_id
    )
)
WITH CHECK (
    auth.uid() IN (
        SELECT user_id 
        FROM public.students 
        WHERE id = student_academic_goals.student_id
    )
);

-- Policy: Staff can view all goals in their school
CREATE POLICY "Staff can view goals in their school"
ON public.student_academic_goals
FOR SELECT
USING (
    auth.uid() IN (
        SELECT id 
        FROM public.user_profiles 
        WHERE school_id = student_academic_goals.school_id
        AND role IN ('Admin', 'Principal', 'Teacher', 'Team Lead', 'Counselor')
    )
);

-- Policy: Staff can update goals in their school (for analysis)
CREATE POLICY "Staff can update goals in their school"
ON public.student_academic_goals
FOR UPDATE
USING (
    auth.uid() IN (
        SELECT id 
        FROM public.user_profiles 
        WHERE school_id = student_academic_goals.school_id
        AND role IN ('Admin', 'Principal', 'Teacher', 'Team Lead')
    )
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_student_academic_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_student_academic_goals_updated_at
BEFORE UPDATE ON public.student_academic_goals
FOR EACH ROW
EXECUTE FUNCTION update_student_academic_goals_updated_at();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
