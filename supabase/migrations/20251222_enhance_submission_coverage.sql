-- Lesson Plan Submission and Coverage Enhancement Migration
-- This migration adds configuration tables and analytics infrastructure for
-- managing lesson plan submission deadlines, reminders, and coverage tracking

-- 1. Create lesson_plan_submission_config table
CREATE TABLE IF NOT EXISTS public.lesson_plan_submission_config (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    submission_deadline_day VARCHAR(10) DEFAULT 'friday',
    submission_deadline_time TIME DEFAULT '17:00:00',
    grace_period_hours INTEGER DEFAULT 24,
    auto_mark_late_after_grace BOOLEAN DEFAULT true,
    require_coverage_before_new_plan BOOLEAN DEFAULT false,
    min_coverage_percentage_required INTEGER DEFAULT 80,
    enable_auto_reminders BOOLEAN DEFAULT true,
    reminder_days_before INTEGER[] DEFAULT ARRAY[3, 1, 0],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id)
);

-- 2. Add topic tracking arrays to coverage table
ALTER TABLE public.lesson_plan_coverage 
ADD COLUMN IF NOT EXISTS topics_covered_list TEXT[] DEFAULT '{}';

ALTER TABLE public.lesson_plan_coverage 
ADD COLUMN IF NOT EXISTS topics_pending_list TEXT[] DEFAULT '{}';

ALTER TABLE public.lesson_plan_coverage 
ADD COLUMN IF NOT EXISTS evidence_urls TEXT[] DEFAULT '{}';

-- 3. Create submission history tracking table
CREATE TABLE IF NOT EXISTS public.lesson_plan_submission_history (
    id SERIAL PRIMARY KEY,
    lesson_plan_id INTEGER NOT NULL REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create coverage analytics view
CREATE OR REPLACE VIEW public.coverage_analytics AS
SELECT 
    lp.school_id,
    lp.subject,
    lp.grade_level,
    COUNT(DISTINCT lp.id) as total_plans,
    COUNT(DISTINCT lpc.id) as coverage_records,
    AVG(lpc.coverage_percentage) as avg_coverage_percentage,
    COUNT(CASE WHEN lpc.coverage_status = 'Fully Covered' THEN 1 END) as fully_covered_count,
    COUNT(CASE WHEN lpc.coverage_status = 'Partially Covered' THEN 1 END) as partially_covered_count,
    COUNT(CASE WHEN lpc.coverage_status = 'Not Covered' THEN 1 END) as not_covered_count
FROM public.lesson_plans lp
LEFT JOIN public.lesson_plan_coverage lpc ON lp.id = lpc.lesson_plan_id
WHERE lp.status IN ('approved', 'published')
GROUP BY lp.school_id, lp.subject, lp.grade_level;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lesson_plan_coverage_status 
    ON public.lesson_plan_coverage(coverage_status);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_school_status 
    ON public.lesson_plans(school_id, status);
CREATE INDEX IF NOT EXISTS idx_submission_history_plan_id
    ON public.lesson_plan_submission_history(lesson_plan_id);

-- 6. Enable RLS on new tables
ALTER TABLE public.lesson_plan_submission_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plan_submission_history ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for submission config
CREATE POLICY "School admins can manage submission config" 
ON public.lesson_plan_submission_config
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() 
        AND up.school_id = lesson_plan_submission_config.school_id
        AND up.role IN ('Admin', 'Principal')
    )
);

CREATE POLICY "Staff can view submission config" 
ON public.lesson_plan_submission_config
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() 
        AND up.school_id = lesson_plan_submission_config.school_id
    )
);

-- 8. RLS Policies for submission history
CREATE POLICY "Staff can view submission history"
ON public.lesson_plan_submission_history
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.lesson_plans lp
        JOIN public.user_profiles up ON up.school_id = lp.school_id
        WHERE lp.id = lesson_plan_submission_history.lesson_plan_id
        AND up.id = auth.uid()
    )
);

CREATE POLICY "System can insert submission history"
ON public.lesson_plan_submission_history
FOR INSERT WITH CHECK (true);
