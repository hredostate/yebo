-- ============================================
-- Lesson Plan Workflow Enhancement Migration
-- ============================================

-- 1. Create lesson_plan_assignments junction table
-- Links one lesson plan to multiple teaching assignments
CREATE TABLE IF NOT EXISTS public.lesson_plan_assignments (
    id SERIAL PRIMARY KEY,
    lesson_plan_id INTEGER REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
    teaching_entity_id INTEGER REFERENCES public.academic_teaching_assignments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(lesson_plan_id, teaching_entity_id)
);

-- 2. Create lesson_plan_review_evidence table
-- Tracks evidence that reviews were actually conducted
CREATE TABLE IF NOT EXISTS public.lesson_plan_review_evidence (
    id SERIAL PRIMARY KEY,
    lesson_plan_id INTEGER REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES public.user_profiles(id),
    time_spent_seconds INTEGER NOT NULL,
    checklist_responses JSONB NOT NULL,
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
    feedback TEXT NOT NULL,
    decision VARCHAR(20) CHECK (decision IN ('approved', 'revision_required', 'rejected')),
    revision_notes TEXT,
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    decided_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update lesson_plans table - add subject field
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='subject') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN subject VARCHAR(255) DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='grade_level') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN grade_level VARCHAR(100) DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='sessions') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN sessions JSONB DEFAULT NULL;
    END IF;
END $$;

-- Make teaching_entity_id nullable for backward compatibility (plans now link via junction table)
DO $$ BEGIN
    ALTER TABLE public.lesson_plans ALTER COLUMN teaching_entity_id DROP NOT NULL;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 4. Update lesson_plan_coverage table structure
-- Ensure coverage is tracked per lesson_plan + teaching_entity combination
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plan_coverage' AND column_name='teaching_entity_id') THEN
        ALTER TABLE public.lesson_plan_coverage ADD COLUMN teaching_entity_id INTEGER REFERENCES public.academic_teaching_assignments(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plan_coverage' AND column_name='coverage_date') THEN
        ALTER TABLE public.lesson_plan_coverage ADD COLUMN coverage_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add unique constraint for lesson_plan + teaching_entity combination
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'lesson_plan_coverage_plan_entity_unique'
    ) THEN
        ALTER TABLE public.lesson_plan_coverage 
        ADD CONSTRAINT lesson_plan_coverage_plan_entity_unique 
        UNIQUE(lesson_plan_id, teaching_entity_id);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lesson_plan_assignments_plan_id 
    ON public.lesson_plan_assignments(lesson_plan_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plan_assignments_teaching_entity_id 
    ON public.lesson_plan_assignments(teaching_entity_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plan_review_evidence_plan_id 
    ON public.lesson_plan_review_evidence(lesson_plan_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plan_review_evidence_reviewer_id 
    ON public.lesson_plan_review_evidence(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plan_coverage_teaching_entity 
    ON public.lesson_plan_coverage(teaching_entity_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_subject 
    ON public.lesson_plans(subject);

-- 6. Enable RLS on new tables
ALTER TABLE public.lesson_plan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plan_review_evidence ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for lesson_plan_assignments
DO $$
BEGIN
    -- Allow teachers to view their own assignments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lesson_plan_assignments' AND policyname = 'Teachers can view their lesson plan assignments') THEN
        CREATE POLICY "Teachers can view their lesson plan assignments" ON public.lesson_plan_assignments
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.academic_teaching_assignments ata
                    WHERE ata.id = teaching_entity_id 
                    AND ata.teacher_user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.user_profiles up
                    WHERE up.id = auth.uid() 
                    AND up.role IN ('Admin', 'Principal', 'Team Lead')
                )
            );
    END IF;

    -- Allow teachers to insert their own assignments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lesson_plan_assignments' AND policyname = 'Teachers can insert their lesson plan assignments') THEN
        CREATE POLICY "Teachers can insert their lesson plan assignments" ON public.lesson_plan_assignments
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.academic_teaching_assignments ata
                    WHERE ata.id = teaching_entity_id 
                    AND ata.teacher_user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.user_profiles up
                    WHERE up.id = auth.uid() 
                    AND up.role IN ('Admin', 'Principal', 'Team Lead')
                )
            );
    END IF;

    -- Allow teachers to delete their own assignments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lesson_plan_assignments' AND policyname = 'Teachers can delete their lesson plan assignments') THEN
        CREATE POLICY "Teachers can delete their lesson plan assignments" ON public.lesson_plan_assignments
            FOR DELETE USING (
                EXISTS (
                    SELECT 1 FROM public.academic_teaching_assignments ata
                    WHERE ata.id = teaching_entity_id 
                    AND ata.teacher_user_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.user_profiles up
                    WHERE up.id = auth.uid() 
                    AND up.role IN ('Admin', 'Principal', 'Team Lead')
                )
            );
    END IF;
END $$;

-- 8. RLS Policies for lesson_plan_review_evidence
DO $$
BEGIN
    -- Allow team leads and admins to view reviews
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lesson_plan_review_evidence' AND policyname = 'Team leads can view review evidence') THEN
        CREATE POLICY "Team leads can view review evidence" ON public.lesson_plan_review_evidence
            FOR SELECT USING (
                reviewer_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.user_profiles up
                    WHERE up.id = auth.uid() 
                    AND up.role IN ('Admin', 'Principal', 'Team Lead')
                )
            );
    END IF;

    -- Allow team leads to insert reviews
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lesson_plan_review_evidence' AND policyname = 'Team leads can insert review evidence') THEN
        CREATE POLICY "Team leads can insert review evidence" ON public.lesson_plan_review_evidence
            FOR INSERT WITH CHECK (
                reviewer_id = auth.uid()
                AND EXISTS (
                    SELECT 1 FROM public.user_profiles up
                    WHERE up.id = auth.uid() 
                    AND up.role IN ('Admin', 'Principal', 'Team Lead')
                )
            );
    END IF;
END $$;

-- 9. Migrate existing lesson plans to use junction table
-- Copy existing teaching_entity_id relationships to the junction table
INSERT INTO public.lesson_plan_assignments (lesson_plan_id, teaching_entity_id, created_at)
SELECT id, teaching_entity_id, created_at
FROM public.lesson_plans
WHERE teaching_entity_id IS NOT NULL
ON CONFLICT (lesson_plan_id, teaching_entity_id) DO NOTHING;

-- 10. Update learning_materials table if needed
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_materials' AND column_name='is_shared') THEN
        ALTER TABLE public.learning_materials ADD COLUMN is_shared BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_materials' AND column_name='is_published') THEN
        ALTER TABLE public.learning_materials ADD COLUMN is_published BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_materials' AND column_name='uploaded_by') THEN
        ALTER TABLE public.learning_materials ADD COLUMN uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_materials' AND column_name='tags') THEN
        ALTER TABLE public.learning_materials ADD COLUMN tags TEXT[];
    END IF;
END $$;

-- 11. Create student_material_access table for tracking
CREATE TABLE IF NOT EXISTS public.student_material_access (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    material_id INTEGER REFERENCES public.learning_materials(id) ON DELETE CASCADE,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_material_access_student_id 
    ON public.student_material_access(student_id);
CREATE INDEX IF NOT EXISTS idx_student_material_access_material_id 
    ON public.student_material_access(material_id);

ALTER TABLE public.student_material_access ENABLE ROW LEVEL SECURITY;

-- RLS for student_material_access
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_material_access' AND policyname = 'Students can view their own access') THEN
        CREATE POLICY "Students can view their own access" ON public.student_material_access
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.students s
                    WHERE s.id = student_id 
                    AND s.user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_material_access' AND policyname = 'Students can insert their own access') THEN
        CREATE POLICY "Students can insert their own access" ON public.student_material_access
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.students s
                    WHERE s.id = student_id 
                    AND s.user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_material_access' AND policyname = 'Teachers can view material access') THEN
        CREATE POLICY "Teachers can view material access" ON public.student_material_access
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.user_profiles up
                    WHERE up.id = auth.uid() 
                    AND up.role IN ('Admin', 'Principal', 'Team Lead', 'Teacher')
                )
            );
    END IF;
END $$;

-- 12. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plan_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plan_review_evidence TO authenticated;
GRANT SELECT, INSERT ON public.student_material_access TO authenticated;
GRANT USAGE ON SEQUENCE lesson_plan_assignments_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE lesson_plan_review_evidence_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE student_material_access_id_seq TO authenticated;
