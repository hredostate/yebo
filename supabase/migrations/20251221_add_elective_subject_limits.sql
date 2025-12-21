-- ============================================
-- STUDENT SUBJECT SELECTION LOCK SYSTEM & ELECTIVE LIMITS
-- Migration: Add lock tracking and elective subject capacity management
-- ============================================

-- 1. Add lock tracking columns to student_subject_choices
DO $$ 
BEGIN 
    -- Ensure locked column exists (should already be there from base schema)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='student_subject_choices' AND column_name='locked'
    ) THEN
        ALTER TABLE public.student_subject_choices 
        ADD COLUMN locked BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add locked_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='student_subject_choices' AND column_name='locked_at'
    ) THEN
        ALTER TABLE public.student_subject_choices 
        ADD COLUMN locked_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
    
    -- Add locked_by column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='student_subject_choices' AND column_name='locked_by'
    ) THEN
        ALTER TABLE public.student_subject_choices 
        ADD COLUMN locked_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Create elective_subject_limits table for optional capacity management
CREATE TABLE IF NOT EXISTS public.elective_subject_limits (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    arm_id INTEGER REFERENCES public.arms(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    max_students INTEGER DEFAULT NULL,  -- NULL means no limit (unlimited)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, class_id, arm_id, subject_id)
);

-- 3. Add helpful comment
COMMENT ON TABLE public.elective_subject_limits IS 'Optional capacity limits for elective subjects only. NULL max_students means unlimited enrollment.';
COMMENT ON COLUMN public.elective_subject_limits.max_students IS 'Maximum number of students allowed to select this elective. NULL = unlimited.';
COMMENT ON COLUMN public.student_subject_choices.locked_at IS 'When the student choices were locked. NULL = not locked.';
COMMENT ON COLUMN public.student_subject_choices.locked_by IS 'Admin user who locked/unlocked. NULL means auto-locked by student.';

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_subject_choices_locked 
    ON public.student_subject_choices(student_id, locked);
    
CREATE INDEX IF NOT EXISTS idx_student_subject_choices_locked_at 
    ON public.student_subject_choices(locked_at);

CREATE INDEX IF NOT EXISTS idx_elective_subject_limits_lookup 
    ON public.elective_subject_limits(school_id, class_id, arm_id, subject_id);
    
CREATE INDEX IF NOT EXISTS idx_elective_subject_limits_subject 
    ON public.elective_subject_limits(subject_id);

-- 5. Create function to get current enrollment count for an elective subject
CREATE OR REPLACE FUNCTION public.get_elective_enrollment_count(
    p_subject_id INTEGER,
    p_class_id INTEGER,
    p_arm_id INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    enrollment_count INTEGER;
BEGIN
    -- Count students who have selected this subject in the given class/arm
    SELECT COUNT(DISTINCT ssc.student_id)
    INTO enrollment_count
    FROM public.student_subject_choices ssc
    INNER JOIN public.students s ON s.id = ssc.student_id
    WHERE ssc.subject_id = p_subject_id
      AND s.class_id = p_class_id
      AND (p_arm_id IS NULL OR s.arm_id = p_arm_id)
      AND COALESCE(s.status, 'Active') = 'Active';  -- Only count active students
      
    RETURN COALESCE(enrollment_count, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Create function to check if an elective subject is at capacity
CREATE OR REPLACE FUNCTION public.is_elective_at_capacity(
    p_subject_id INTEGER,
    p_class_id INTEGER,
    p_arm_id INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_limit INTEGER;
    v_current INTEGER;
BEGIN
    -- Get the limit for this subject/class/arm combination
    SELECT esl.max_students
    INTO v_limit
    FROM public.elective_subject_limits esl
    WHERE esl.subject_id = p_subject_id
      AND esl.class_id = p_class_id
      AND (esl.arm_id = p_arm_id OR (esl.arm_id IS NULL AND p_arm_id IS NULL))
    LIMIT 1;
    
    -- If no limit exists (NULL), it's never at capacity (unlimited)
    IF v_limit IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get current enrollment count
    v_current := public.get_elective_enrollment_count(p_subject_id, p_class_id, p_arm_id);
    
    -- Check if at or over capacity
    RETURN v_current >= v_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Enable RLS on new table
ALTER TABLE public.elective_subject_limits ENABLE ROW LEVEL SECURITY;

-- Create policies for elective_subject_limits
DO $$
BEGIN
    -- Read policy for authenticated users
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'elective_subject_limits' 
        AND policyname = 'Auth read elective_subject_limits'
    ) THEN
        CREATE POLICY "Auth read elective_subject_limits" 
        ON public.elective_subject_limits 
        FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;
    
    -- Write policy for authenticated users (admins should control via application logic)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'elective_subject_limits' 
        AND policyname = 'Auth write elective_subject_limits'
    ) THEN
        CREATE POLICY "Auth write elective_subject_limits" 
        ON public.elective_subject_limits 
        FOR ALL 
        TO authenticated 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- 8. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_elective_subject_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_elective_subject_limits_updated_at 
    ON public.elective_subject_limits;
    
CREATE TRIGGER trigger_update_elective_subject_limits_updated_at
    BEFORE UPDATE ON public.elective_subject_limits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_elective_subject_limits_updated_at();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
