-- Report Card System Refactoring Migration
-- Enforces production-grade data integrity and eliminates UI-side calculations

-- ============================================================================
-- 1. Audit Trail: Results Publishing Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.results_publish_log (
    id SERIAL PRIMARY KEY,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    published_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    checksum TEXT,
    UNIQUE(term_id, academic_class_id, version)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_results_publish_log_term_class 
ON public.results_publish_log(term_id, academic_class_id);

-- Enable RLS
ALTER TABLE public.results_publish_log ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view publish logs
CREATE POLICY "Staff can view publish logs" ON public.results_publish_log
FOR SELECT USING (
    auth.uid() IN (
        SELECT id FROM public.user_profiles 
        WHERE role IN ('Principal', 'Vice Principal', 'Teacher', 'Super Admin', 'Admin')
    )
);

-- Policy: Authorized staff can insert publish logs
CREATE POLICY "Authorized staff can insert publish logs" ON public.results_publish_log
FOR INSERT WITH CHECK (
    auth.uid() IN (
        SELECT id FROM public.user_profiles 
        WHERE role IN ('Principal', 'Vice Principal', 'Teacher', 'Super Admin', 'Admin')
    )
);

-- ============================================================================
-- 2. Subject-Specific Grade Overrides
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.grading_scheme_overrides (
    id SERIAL PRIMARY KEY,
    grading_scheme_id INTEGER REFERENCES public.grading_schemes(id) ON DELETE CASCADE,
    subject_name TEXT NOT NULL,
    min_score NUMERIC NOT NULL,
    max_score NUMERIC NOT NULL,
    grade_label TEXT NOT NULL,
    remark TEXT,
    UNIQUE(grading_scheme_id, subject_name, min_score)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_grading_scheme_overrides_scheme 
ON public.grading_scheme_overrides(grading_scheme_id);

CREATE INDEX IF NOT EXISTS idx_grading_scheme_overrides_subject 
ON public.grading_scheme_overrides(grading_scheme_id, subject_name);

-- Enable RLS
ALTER TABLE public.grading_scheme_overrides ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view overrides
CREATE POLICY "Staff can view grading overrides" ON public.grading_scheme_overrides
FOR SELECT USING (
    auth.uid() IN (
        SELECT id FROM public.user_profiles 
        WHERE role IN ('Principal', 'Vice Principal', 'Teacher', 'Super Admin', 'Admin')
    )
);

-- Policy: Authorized staff can manage overrides
CREATE POLICY "Authorized staff can manage grading overrides" ON public.grading_scheme_overrides
FOR ALL USING (
    auth.uid() IN (
        SELECT id FROM public.user_profiles 
        WHERE role IN ('Principal', 'Vice Principal', 'Super Admin', 'Admin')
    )
);

-- ============================================================================
-- 3. Report Templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.report_templates (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    html_template TEXT,
    css_styles TEXT,
    supported_sections TEXT[] DEFAULT ARRAY['header', 'subjects', 'summary', 'comments', 'attendance'],
    max_subjects_per_page INTEGER DEFAULT 15,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_report_templates_school 
ON public.report_templates(school_id);

CREATE INDEX IF NOT EXISTS idx_report_templates_active 
ON public.report_templates(school_id, is_active);

-- Enable RLS
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view templates
CREATE POLICY "Staff can view report templates" ON public.report_templates
FOR SELECT USING (
    auth.uid() IN (
        SELECT id FROM public.user_profiles 
        WHERE role IN ('Principal', 'Vice Principal', 'Teacher', 'Super Admin', 'Admin')
    )
);

-- Policy: Authorized staff can manage templates
CREATE POLICY "Authorized staff can manage report templates" ON public.report_templates
FOR ALL USING (
    auth.uid() IN (
        SELECT id FROM public.user_profiles 
        WHERE role IN ('Principal', 'Vice Principal', 'Super Admin', 'Admin')
    )
);

-- ============================================================================
-- 4. Template Assignments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.template_assignments (
    id SERIAL PRIMARY KEY,
    campus_id INTEGER REFERENCES public.campuses(id) ON DELETE CASCADE,
    class_group_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES public.report_templates(id) ON DELETE CASCADE,
    UNIQUE(campus_id, class_group_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_template_assignments_campus 
ON public.template_assignments(campus_id);

CREATE INDEX IF NOT EXISTS idx_template_assignments_class 
ON public.template_assignments(class_group_id);

-- Enable RLS
ALTER TABLE public.template_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view assignments
CREATE POLICY "Staff can view template assignments" ON public.template_assignments
FOR SELECT USING (
    auth.uid() IN (
        SELECT id FROM public.user_profiles 
        WHERE role IN ('Principal', 'Vice Principal', 'Teacher', 'Super Admin', 'Admin')
    )
);

-- Policy: Authorized staff can manage assignments
CREATE POLICY "Authorized staff can manage template assignments" ON public.template_assignments
FOR ALL USING (
    auth.uid() IN (
        SELECT id FROM public.user_profiles 
        WHERE role IN ('Principal', 'Vice Principal', 'Super Admin', 'Admin')
    )
);

-- ============================================================================
-- 5. Enhance school_config with report card branding
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='school_config' AND column_name='report_card_branding'
    ) THEN
        ALTER TABLE public.school_config ADD COLUMN report_card_branding JSONB DEFAULT '{
            "watermark_url": null,
            "signature_principal": null,
            "signature_class_teacher": null,
            "primary_color": "#1e40af",
            "secondary_color": "#3b82f6",
            "show_school_logo": true,
            "footer_text": null
        }';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='school_config' AND column_name='default_template_id'
    ) THEN
        ALTER TABLE public.school_config ADD COLUMN default_template_id INTEGER 
        REFERENCES public.report_templates(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 6. RPC Function: Compute Grade (Single Source of Truth)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.compute_grade(
    p_score NUMERIC,
    p_grading_scheme_id INTEGER,
    p_subject_name TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_grade_label TEXT;
    v_remark TEXT;
    v_gpa_value NUMERIC;
BEGIN
    -- Check for subject-specific override first
    IF p_subject_name IS NOT NULL THEN
        SELECT grade_label, remark, NULL::NUMERIC
        INTO v_grade_label, v_remark, v_gpa_value
        FROM public.grading_scheme_overrides
        WHERE grading_scheme_id = p_grading_scheme_id
          AND subject_name = p_subject_name
          AND p_score >= min_score
          AND p_score <= max_score
        ORDER BY min_score DESC
        LIMIT 1;
        
        IF FOUND THEN
            RETURN jsonb_build_object(
                'grade_label', v_grade_label,
                'remark', v_remark,
                'gpa_value', v_gpa_value
            );
        END IF;
    END IF;
    
    -- Fall back to standard grading rules
    SELECT grade, remark, NULL::NUMERIC
    INTO v_grade_label, v_remark, v_gpa_value
    FROM public.grading_scheme_rules
    WHERE grading_scheme_id = p_grading_scheme_id
      AND p_score >= min_score
      AND p_score <= max_score
    ORDER BY min_score DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'grade_label', 'F',
            'remark', 'Fail',
            'gpa_value', 0.0
        );
    END IF;
    
    RETURN jsonb_build_object(
        'grade_label', v_grade_label,
        'remark', v_remark,
        'gpa_value', v_gpa_value
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. RPC Function: Validate and Compute Report Card Data
-- ============================================================================
CREATE OR REPLACE FUNCTION public.compute_report_card_data(
    p_student_id INTEGER,
    p_term_id INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_student JSONB;
    v_term JSONB;
    v_school JSONB;
    v_academic_class_id INTEGER;
    v_campus_id INTEGER;
    v_grading_scheme_id INTEGER;
    v_subjects JSONB;
    v_summary JSONB;
    v_comments JSONB;
    v_attendance JSONB;
    v_is_published BOOLEAN;
    v_missing_scores JSONB[] := ARRAY[]::JSONB[];
    v_validation_errors JSONB[] := ARRAY[]::JSONB[];
    v_total_score NUMERIC := 0;
    v_subject_count INTEGER := 0;
    v_average_score NUMERIC := 0;
    v_position_in_arm INTEGER;
    v_total_in_arm INTEGER;
    v_position_in_level INTEGER;
    v_total_in_level INTEGER;
BEGIN
    -- ========================================================================
    -- VALIDATION STEP 1: Check student enrollment
    -- ========================================================================
    SELECT 
        jsonb_build_object(
            'id', s.id,
            'fullName', s.name,
            'admissionNumber', s.admission_number
        ),
        acs.academic_class_id,
        s.campus_id
    INTO v_student, v_academic_class_id, v_campus_id
    FROM public.students s
    LEFT JOIN public.academic_class_students acs 
        ON acs.student_id = s.id AND acs.enrolled_term_id = p_term_id
    WHERE s.id = p_student_id;
    
    IF v_student IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'blocked',
            'reason', 'STUDENT_NOT_FOUND',
            'details', jsonb_build_array(
                jsonb_build_object('error', 'Student not found')
            )
        );
    END IF;
    
    IF v_academic_class_id IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'blocked',
            'reason', 'NOT_ENROLLED',
            'details', jsonb_build_array(
                jsonb_build_object(
                    'student_id', p_student_id,
                    'error', 'Student not enrolled in any class for this term'
                )
            )
        );
    END IF;
    
    -- ========================================================================
    -- VALIDATION STEP 2: Check if results are published
    -- ========================================================================
    SELECT is_published INTO v_is_published
    FROM public.student_term_reports
    WHERE student_id = p_student_id AND term_id = p_term_id;
    
    IF v_is_published IS NULL OR v_is_published = FALSE THEN
        RETURN jsonb_build_object(
            'status', 'blocked',
            'reason', 'RESULTS_NOT_PUBLISHED',
            'details', jsonb_build_array(
                jsonb_build_object(
                    'student_id', p_student_id,
                    'error', 'Results have not been published for this term'
                )
            )
        );
    END IF;
    
    -- ========================================================================
    -- VALIDATION STEP 3: Check grading scheme exists
    -- ========================================================================
    SELECT gs.id INTO v_grading_scheme_id
    FROM public.grading_schemes gs
    LEFT JOIN public.academic_classes ac ON ac.id = v_academic_class_id
    WHERE (
        -- Class-specific scheme
        gs.id = ac.grading_scheme_id
        -- Campus-specific scheme
        OR (gs.campus_id = v_campus_id AND ac.grading_scheme_id IS NULL)
        -- School-wide default
        OR (gs.is_default = TRUE AND ac.grading_scheme_id IS NULL AND gs.campus_id IS NULL)
    )
    ORDER BY 
        CASE WHEN gs.id = ac.grading_scheme_id THEN 1
             WHEN gs.campus_id = v_campus_id THEN 2
             ELSE 3 END
    LIMIT 1;
    
    IF v_grading_scheme_id IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'blocked',
            'reason', 'MISSING_GRADING_SCHEME',
            'details', jsonb_build_array(
                jsonb_build_object(
                    'student_id', p_student_id,
                    'error', 'No grading scheme configured for this class/campus'
                )
            )
        );
    END IF;
    
    -- ========================================================================
    -- VALIDATION STEP 4: Check for missing scores
    -- ========================================================================
    WITH expected_subjects AS (
        SELECT DISTINCT subject_name
        FROM public.class_subjects cs
        WHERE cs.academic_class_id = v_academic_class_id
    ),
    actual_scores AS (
        SELECT DISTINCT subject_name
        FROM public.score_entries
        WHERE student_id = p_student_id 
          AND term_id = p_term_id
          AND total_score IS NOT NULL
    ),
    missing AS (
        SELECT es.subject_name
        FROM expected_subjects es
        LEFT JOIN actual_scores acs ON es.subject_name = acs.subject_name
        WHERE acs.subject_name IS NULL
    )
    SELECT array_agg(
        jsonb_build_object(
            'student_id', p_student_id,
            'subject', subject_name,
            'missing', 'All assessment components'
        )
    )
    INTO v_missing_scores
    FROM missing;
    
    IF array_length(v_missing_scores, 1) > 0 THEN
        RETURN jsonb_build_object(
            'status', 'blocked',
            'reason', 'MISSING_SCORES',
            'details', v_missing_scores
        );
    END IF;
    
    -- ========================================================================
    -- DATA COMPUTATION: All validations passed, compute report data
    -- ========================================================================
    
    -- Get term info
    SELECT jsonb_build_object(
        'sessionLabel', session_label,
        'termLabel', term_label
    )
    INTO v_term
    FROM public.terms
    WHERE id = p_term_id;
    
    -- Get school info
    SELECT jsonb_build_object(
        'name', s.name,
        'displayName', s.name,
        'address', sc.address,
        'motto', sc.motto,
        'logoUrl', sc.logo_url
    )
    INTO v_school
    FROM public.schools s
    CROSS JOIN public.school_config sc
    LIMIT 1;
    
    -- Get subjects with grades computed server-side
    SELECT 
        jsonb_agg(
            jsonb_build_object(
                'subjectName', se.subject_name,
                'totalScore', se.total_score,
                'grade', grade_data->>'grade_label',
                'remark', grade_data->>'remark',
                'componentScores', se.component_scores,
                'subjectPosition', subject_rank
            ) ORDER BY se.subject_name
        ),
        SUM(se.total_score),
        COUNT(*)
    INTO v_subjects, v_total_score, v_subject_count
    FROM (
        SELECT 
            se.subject_name,
            se.total_score,
            se.component_scores,
            public.compute_grade(se.total_score, v_grading_scheme_id, se.subject_name) as grade_data,
            DENSE_RANK() OVER (
                PARTITION BY se.subject_name 
                ORDER BY se.total_score DESC
            ) as subject_rank
        FROM public.score_entries se
        WHERE se.student_id = p_student_id 
          AND se.term_id = p_term_id
          AND se.academic_class_id = v_academic_class_id
    ) se;
    
    -- Calculate average
    IF v_subject_count > 0 THEN
        v_average_score := ROUND(v_total_score / v_subject_count, 2);
    END IF;
    
    -- Compute arm ranking (dense rank)
    SELECT 
        DENSE_RANK() OVER (ORDER BY str.average_score DESC),
        COUNT(*) OVER ()
    INTO v_position_in_arm, v_total_in_arm
    FROM public.student_term_reports str
    JOIN public.academic_class_students acs 
        ON acs.student_id = str.student_id 
        AND acs.enrolled_term_id = str.term_id
    WHERE str.term_id = p_term_id
      AND acs.academic_class_id = v_academic_class_id
      AND str.student_id = p_student_id;
    
    -- Compute level ranking (across all arms in same level - dense rank)
    SELECT 
        DENSE_RANK() OVER (ORDER BY str.average_score DESC),
        COUNT(*) OVER ()
    INTO v_position_in_level, v_total_in_level
    FROM public.student_term_reports str
    JOIN public.academic_class_students acs 
        ON acs.student_id = str.student_id 
        AND acs.enrolled_term_id = str.term_id
    JOIN public.academic_classes ac 
        ON ac.id = acs.academic_class_id
    JOIN public.academic_classes my_class
        ON my_class.id = v_academic_class_id
    WHERE str.term_id = p_term_id
      AND ac.class_id = my_class.class_id  -- Same level
      AND str.student_id = p_student_id;
    
    -- Get comments
    SELECT jsonb_build_object(
        'teacher', str.teacher_comment,
        'principal', str.principal_comment
    )
    INTO v_comments
    FROM public.student_term_reports str
    WHERE str.student_id = p_student_id AND str.term_id = p_term_id;
    
    -- Get attendance (reuse existing RPC logic)
    SELECT jsonb_build_object(
        'present', 
            COALESCE((public.get_student_term_report_details(p_student_id, p_term_id)->>'attendance')::jsonb->>'present', '0')::INTEGER,
        'absent', 
            COALESCE((public.get_student_term_report_details(p_student_id, p_term_id)->>'attendance')::jsonb->>'absent', '0')::INTEGER,
        'late', 
            COALESCE((public.get_student_term_report_details(p_student_id, p_term_id)->>'attendance')::jsonb->>'late', '0')::INTEGER,
        'rate',
            COALESCE((public.get_student_term_report_details(p_student_id, p_term_id)->>'attendance')::jsonb->>'rate', '0')::NUMERIC
    )
    INTO v_attendance;
    
    -- Build summary
    v_summary := jsonb_build_object(
        'totalScore', v_total_score,
        'averageScore', v_average_score,
        'positionInArm', v_position_in_arm,
        'totalStudentsInArm', v_total_in_arm,
        'positionInLevel', v_position_in_level,
        'totalStudentsInLevel', v_total_in_level
    );
    
    -- Return complete report card data
    RETURN jsonb_build_object(
        'status', 'success',
        'data', jsonb_build_object(
            'student', v_student,
            'school', v_school,
            'term', v_term,
            'subjects', v_subjects,
            'summary', v_summary,
            'comments', v_comments,
            'attendance', v_attendance
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.compute_grade TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_report_card_data TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
