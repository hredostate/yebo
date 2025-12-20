
export const DICTIONARY_FIX_SQL = `
-- Policy updates for shared tables (Non-destructive)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subjects' AND policyname = 'Public can view subjects') THEN
        CREATE POLICY "Public can view subjects" ON public.subjects FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'classes' AND policyname = 'Public can view classes') THEN
        CREATE POLICY "Public can view classes" ON public.classes FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'arms' AND policyname = 'Public can view arms') THEN
        CREATE POLICY "Public can view arms" ON public.arms FOR SELECT USING (true);
    END IF;

    -- Add new columns for Subject Limits on Academic Classes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='academic_classes' AND column_name='min_subjects') THEN
        ALTER TABLE public.academic_classes ADD COLUMN min_subjects INTEGER DEFAULT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='academic_classes' AND column_name='max_subjects') THEN
        ALTER TABLE public.academic_classes ADD COLUMN max_subjects INTEGER DEFAULT NULL;
    END IF;
    
    -- Add campus_id column to academic_classes for campus assignment at class level
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='academic_classes' AND column_name='campus_id') THEN
        ALTER TABLE public.academic_classes ADD COLUMN campus_id INTEGER REFERENCES public.campuses(id);
        CREATE INDEX IF NOT EXISTS idx_academic_classes_campus ON public.academic_classes(campus_id);
    END IF;

    -- Add compulsory flag to class_subjects
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='class_subjects' AND column_name='is_compulsory') THEN
        ALTER TABLE public.class_subjects ADD COLUMN is_compulsory BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add archived flag to reports for strike resetting
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reports' AND column_name='archived') THEN
        ALTER TABLE public.reports ADD COLUMN archived BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add social_accounts to schools for the Social Media Hub
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='social_accounts') THEN
        ALTER TABLE public.schools ADD COLUMN social_accounts JSONB DEFAULT '{}';
    END IF;
    
    -- Add total_school_days to terms for global attendance calculation
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='terms' AND column_name='total_school_days') THEN
        ALTER TABLE public.terms ADD COLUMN total_school_days INTEGER DEFAULT NULL;
    END IF;
    
    -- Create student_subject_enrollments table for managing which students take which subjects
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='student_subject_enrollments') THEN
        CREATE TABLE public.student_subject_enrollments (
            id SERIAL PRIMARY KEY,
            school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
            student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
            subject_id INTEGER REFERENCES public.subjects(id) ON DELETE CASCADE,
            academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
            term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
            is_enrolled BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(student_id, subject_id, academic_class_id, term_id)
        );
    END IF;
    
    -- Update Math and English to be compulsory by default (for demonstration)
    UPDATE public.class_subjects 
    SET is_compulsory = true 
    WHERE subject_id IN (
        SELECT id FROM public.subjects WHERE name ILIKE '%Mathematics%' OR name ILIKE '%English%'
    );
END $$;

-- Make sure to reload schema
NOTIFY pgrst, 'reload config';
`;

export const RESEED_DATA_SQL = `
INSERT INTO public.classes (name) VALUES 
('JSS 1'), ('JSS 2'), ('JSS 3'),
('SS 1'), ('SS 2'), ('SS 3')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.arms (name) VALUES 
('Gold'), ('Silver'), ('Diamond'), ('Blue'), ('Red')
ON CONFLICT (name) DO NOTHING;

-- Insert subjects with school_id (requires at least one school to exist)
INSERT INTO public.subjects (name, school_id) 
SELECT t.name, s.id
FROM (VALUES 
    ('Mathematics'), 
    ('English Language'), 
    ('Basic Science'), 
    ('Civic Education'), 
    ('ICT')
) AS t(name)
CROSS JOIN (SELECT id FROM public.schools ORDER BY id LIMIT 1) AS s
ON CONFLICT (name) DO NOTHING;
`;

export const ATTENDANCE_FIX_SQL = `
DROP FUNCTION IF EXISTS public.get_daily_teacher_attendance(date,integer);
CREATE OR REPLACE FUNCTION public.get_daily_teacher_attendance(p_date date, p_campus_id int DEFAULT NULL)
RETURNS TABLE (
    teacher_id uuid,
    teacher_name text,
    teacher_role text,
    campus_name text,
    status text,
    checkin_time timestamptz,
    checkout_time timestamptz,
    notes text,
    photo_url text,
    is_late boolean,
    on_time boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as teacher_id,
        u.name as teacher_name,
        u.role as teacher_role,
        COALESCE(c.name, 'Main Campus') as campus_name,
        tc.status,
        tc.created_at as checkin_time,
        tc.checkout_time,
        tc.notes,
        tc.photo_url,
        CASE WHEN tc.status = 'Late' THEN true ELSE false END as is_late,
        CASE WHEN tc.status = 'Present' THEN true ELSE false END as on_time
    FROM public.user_profiles u
    LEFT JOIN public.campuses c ON u.campus_id = c.id
    LEFT JOIN public.teacher_checkins tc ON u.id = tc.teacher_id AND date(tc.checkin_date) = p_date
    WHERE (u.role = 'Teacher' OR u.role = 'Team Lead')
    AND (p_campus_id IS NULL OR u.campus_id = p_campus_id);
END;
$$ LANGUAGE plpgsql;

-- Function to get a user's assigned campus geofence info for debugging
CREATE OR REPLACE FUNCTION public.get_user_campus_geofence(p_user_id uuid)
RETURNS TABLE (
    user_name text,
    user_campus_id int,
    campus_name text,
    geofence_lat numeric,
    geofence_lng numeric,
    geofence_radius_meters numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.name as user_name,
        u.campus_id as user_campus_id,
        c.name as campus_name,
        c.geofence_lat,
        c.geofence_lng,
        c.geofence_radius_meters
    FROM public.user_profiles u
    LEFT JOIN public.campuses c ON u.campus_id = c.id
    WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

// NEW: Quiz and Survey Logic
export const QUIZ_RPC_SQL = `
-- Function to submit quiz answers
CREATE OR REPLACE FUNCTION public.submit_quiz_answers(p_answers JSONB)
RETURNS VOID AS $$
DECLARE
    answer_record JSONB;
    q_id INT;
    qz_id INT;
BEGIN
    FOR answer_record IN SELECT * FROM jsonb_array_elements(p_answers)
    LOOP
        q_id := (answer_record->>'question_id')::INT;
        SELECT quiz_id INTO qz_id FROM public.quiz_questions WHERE id = q_id;
        
        INSERT INTO public.quiz_responses (quiz_id, user_id, question_id, answer_text, selected_option_index, ranking_value)
        VALUES (
            qz_id,
            auth.uid(),
            q_id,
            answer_record->>'answer_text',
            (answer_record->>'selected_option')::INT,
            (answer_record->>'ranking_value')::INT
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get quiz results (aggregated)
CREATE OR REPLACE FUNCTION public.get_quiz_results(p_quiz_id INT)
RETURNS TABLE (
    question_id INT,
    question_text TEXT,
    question_type TEXT,
    results JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.question_text,
        q.question_type,
        CASE 
            WHEN q.question_type = 'multiple_choice' OR q.question_type = 'true_false' THEN
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'option_text', opt->>'text', 
                            'count', (SELECT COUNT(*) FROM public.quiz_responses r WHERE r.question_id = q.id AND r.selected_option_index = (idx::int - 1))
                        )
                    )
                    FROM jsonb_array_elements(q.options) WITH ORDINALITY AS o(opt, idx)
                )
            WHEN q.question_type = 'ranking' THEN
                jsonb_build_object(
                    'average', (SELECT AVG(ranking_value) FROM public.quiz_responses r WHERE r.question_id = q.id),
                    'distribution', (
                        SELECT jsonb_object_agg(rv, cnt)
                        FROM (
                            SELECT ranking_value as rv, COUNT(*) as cnt 
                            FROM public.quiz_responses r 
                            WHERE r.question_id = q.id 
                            GROUP BY ranking_value
                        ) t
                    )
                )
            WHEN q.question_type = 'short_answer' THEN
                 (SELECT jsonb_agg(answer_text) FROM public.quiz_responses r WHERE r.question_id = q.id AND answer_text IS NOT NULL)
            ELSE NULL
        END
    FROM public.quiz_questions q
    WHERE q.quiz_id = p_quiz_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get detailed responses (row level)
CREATE OR REPLACE FUNCTION public.get_detailed_quiz_responses(p_quiz_id INT)
RETURNS TABLE (
    student_name TEXT,
    student_id UUID,
    question_id INT,
    question_text TEXT,
    response_value TEXT,
    response_timestamp TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(u.name, 'Anonymous'),
        r.user_id,
        r.question_id,
        q.question_text,
        CASE 
            WHEN r.answer_text IS NOT NULL THEN r.answer_text
            WHEN r.selected_option_index IS NOT NULL THEN (q.options->r.selected_option_index)->>'text'
            WHEN r.ranking_value IS NOT NULL THEN r.ranking_value::TEXT
            ELSE ''
        END,
        r.created_at
    FROM public.quiz_responses r
    LEFT JOIN public.user_profiles u ON r.user_id = u.id
    JOIN public.quiz_questions q ON r.question_id = q.id
    WHERE r.quiz_id = p_quiz_id
    ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to generate report details via RPC (for performance)
CREATE OR REPLACE FUNCTION public.get_student_term_report_details(p_student_id INT, p_term_id INT)
RETURNS JSONB AS $$
DECLARE
    v_student JSONB;
    v_term JSONB;
    v_school_config JSONB;
    v_subjects JSONB;
    v_report_row public.student_term_reports%ROWTYPE;
    v_attendance JSONB;
    v_term_start DATE;
    v_term_end DATE;
    v_term_total_school_days INTEGER;
    v_present_count INTEGER;
    v_absent_count INTEGER;
    v_late_count INTEGER;
    v_excused_count INTEGER;
    v_unexcused_count INTEGER;
    v_total_count INTEGER;
    v_attendance_rate NUMERIC;
    v_present_computed INTEGER;
    v_absent_computed INTEGER;
    v_late_computed INTEGER;
    v_excused_computed INTEGER;
    v_unexcused_computed INTEGER;
    v_total_computed INTEGER;
    v_attendance_rate_computed NUMERIC;
    v_class_group_id INTEGER;
    v_override public.attendance_overrides%ROWTYPE;
    v_computed_attendance JSONB;
    v_attendance_source TEXT;
    v_override_found BOOLEAN := false;
    v_cohort_rank INTEGER;
    v_cohort_size INTEGER;
    v_campus_percentile NUMERIC;
    v_academic_goal JSONB;
    v_goal_analysis JSONB;
BEGIN
    -- 1. Student Info scoped with campus/class/arm for cohort filters
    SELECT jsonb_build_object(
        'id', s.id,
        'fullName', s.name,
        'className', ac.name,
        'classId', ac.id,
        'armName', ac.arm,
        'campusId', s.campus_id
    )
    INTO v_student
    FROM public.students s
    LEFT JOIN public.academic_class_students acs ON acs.student_id = s.id AND acs.enrolled_term_id = p_term_id
    LEFT JOIN public.academic_classes ac ON ac.id = acs.academic_class_id
    WHERE s.id = p_student_id;

    -- 2. Term Info with date range
    SELECT jsonb_build_object('sessionLabel', session_label, 'termLabel', term_label),
           start_date, end_date, total_school_days
    INTO v_term, v_term_start, v_term_end, v_term_total_school_days
    FROM public.terms WHERE id = p_term_id;

    -- 3. Config
    SELECT to_jsonb(sc.*) INTO v_school_config
    FROM public.school_config sc LIMIT 1;

    -- 4. Report Meta
    SELECT * INTO v_report_row
    FROM public.student_term_reports
    WHERE student_id = p_student_id AND term_id = p_term_id;

    -- 5. Cohort-level ranking (campus + session + term + class + arm)
    WITH cohort AS (
        SELECT
            str.student_id,
            DENSE_RANK() OVER (
                PARTITION BY s.campus_id, t.session_label, str.term_id, str.academic_class_id, ac.arm
                ORDER BY COALESCE(str.average_score, 0) DESC
            ) AS cohort_rank,
            COUNT(*) OVER (
                PARTITION BY s.campus_id, t.session_label, str.term_id, str.academic_class_id, ac.arm
            ) AS cohort_size,
            DENSE_RANK() OVER (
                PARTITION BY s.campus_id, t.session_label, str.term_id
                ORDER BY COALESCE(str.average_score, 0) DESC
            ) AS campus_rank,
            COUNT(*) OVER (
                PARTITION BY s.campus_id, t.session_label, str.term_id
            ) AS campus_total
        FROM public.student_term_reports str
        JOIN public.students s ON str.student_id = s.id
        JOIN public.terms t ON t.id = str.term_id
        LEFT JOIN public.academic_classes ac ON ac.id = str.academic_class_id
        WHERE str.term_id = p_term_id
          AND COALESCE(s.status, 'Active') NOT IN ('Withdrawn', 'Graduated', 'Expelled', 'Inactive')
    )
    SELECT
        c.cohort_rank,
        c.cohort_size,
        CASE WHEN c.campus_total > 0 THEN ROUND(((c.campus_total - c.campus_rank)::NUMERIC / c.campus_total::NUMERIC) * 100, 2) ELSE NULL END
    INTO v_cohort_rank, v_cohort_size, v_campus_percentile
    FROM cohort c
    WHERE c.student_id = p_student_id
    LIMIT 1;

    -- 6. Subjects (from score_entries) ranked within cohort scope
    SELECT jsonb_agg(jsonb_build_object(
        'subjectName', se.subject_name,
        'componentScores', COALESCE(se.component_scores, '{}'::jsonb),
        'totalScore', se.total_score,
        'gradeLabel', COALESCE(se.grade, se.grade_label),
        'remark', COALESCE(se.teacher_comment, '-'),
        'subjectPosition', DENSE_RANK() OVER (
            PARTITION BY s.campus_id, t.session_label, se.term_id, se.academic_class_id, ac.arm, se.subject_name
            ORDER BY COALESCE(se.total_score, 0) DESC
        )
    ))
    INTO v_subjects
    FROM public.score_entries se
    JOIN public.students s ON s.id = se.student_id
    JOIN public.terms t ON t.id = se.term_id
    LEFT JOIN public.academic_classes ac ON ac.id = se.academic_class_id
    WHERE se.student_id = p_student_id AND se.term_id = p_term_id;

    -- 7. Identify the student's class group for this term (class teacher groups take precedence)
    SELECT cgm.group_id
    INTO v_class_group_id
    FROM public.class_group_members cgm
    JOIN public.class_groups cg ON cg.id = cgm.group_id
    LEFT JOIN public.teaching_assignments ta ON cg.teaching_entity_id = ta.id
    WHERE cgm.student_id = p_student_id
      AND cg.group_type = 'class_teacher'
      AND (ta.term_id = p_term_id OR ta.term_id IS NULL)
    ORDER BY (ta.term_id = p_term_id) DESC, cg.id
    LIMIT 1;

    -- 8. Calculate real attendance from attendance_records
    -- Join through class_group_members to connect students with attendance records
    SELECT
        COALESCE(COUNT(*) FILTER (WHERE LOWER(ar.status) IN ('present', 'p')), 0),
        COALESCE(COUNT(*) FILTER (WHERE LOWER(ar.status) IN ('absent', 'a', 'unexcused')), 0),
        COALESCE(COUNT(*) FILTER (WHERE LOWER(ar.status) IN ('late', 'tardy', 'l', 't')), 0),
        COALESCE(COUNT(*) FILTER (WHERE LOWER(ar.status) IN ('excused', 'e', 'excused absence')), 0),
        COALESCE(COUNT(*), 0)
    INTO v_present_computed, v_unexcused_computed, v_late_computed, v_excused_computed, v_total_computed
    FROM public.attendance_records ar
    INNER JOIN public.class_group_members cgm ON ar.member_id = cgm.id
    WHERE cgm.student_id = p_student_id
      AND ar.session_date IS NOT NULL
      AND (v_term_start IS NULL OR ar.session_date >= v_term_start)
      AND (v_term_end IS NULL OR ar.session_date <= v_term_end);

    -- Calculate total absences (excused + unexcused)
    v_absent_computed := v_excused_computed + v_unexcused_computed;

    -- Calculate attendance rate
    IF v_total_computed > 0 THEN
        v_attendance_rate_computed := ROUND((v_present_computed::NUMERIC / v_total_computed::NUMERIC) * 100, 2);
    ELSE
        v_attendance_rate_computed := 0;
    END IF;

    v_computed_attendance := jsonb_build_object(
        'present', v_present_computed,
        'absent', v_absent_computed,
        'late', v_late_computed,
        'excused', v_excused_computed,
        'unexcused', v_unexcused_computed,
        'total', v_total_computed,
        'rate', v_attendance_rate_computed
    );

    -- 9. Apply overrides when present for this class/term/student
    -- Strategy 1: Try exact match with class_teacher group
    IF v_class_group_id IS NOT NULL THEN
        SELECT * INTO v_override
        FROM public.attendance_overrides ao
        WHERE ao.student_id = p_student_id
          AND ao.term_id = p_term_id
          AND ao.group_id = v_class_group_id
        ORDER BY ao.updated_at DESC
        LIMIT 1;
        IF FOUND THEN
            v_override_found := true;
        END IF;
    END IF;

    -- Strategy 2: If not found, try any group the student belongs to
    IF NOT v_override_found THEN
        SELECT ao.* INTO v_override
        FROM public.attendance_overrides ao
        INNER JOIN public.class_group_members cgm ON cgm.group_id = ao.group_id
        WHERE ao.student_id = p_student_id
          AND ao.term_id = p_term_id
          AND cgm.student_id = p_student_id
        ORDER BY ao.updated_at DESC
        LIMIT 1;
        IF FOUND THEN
            v_override_found := true;
        END IF;
    END IF;

    -- Strategy 3: If still not found, try matching just student_id and term_id (backwards compatibility)
    IF NOT v_override_found THEN
        SELECT * INTO v_override
        FROM public.attendance_overrides ao
        WHERE ao.student_id = p_student_id
          AND ao.term_id = p_term_id
        ORDER BY ao.updated_at DESC
        LIMIT 1;
        IF FOUND THEN
            v_override_found := true;
        END IF;
    END IF;

    IF v_override_found THEN
        v_present_count := COALESCE(v_override.days_present, 0);
        v_total_count := COALESCE(v_override.total_days, 0);
        v_absent_count := GREATEST(COALESCE(v_override.total_days, 0) - COALESCE(v_override.days_present, 0), 0);
        v_late_count := 0;
        v_excused_count := 0;
        v_unexcused_count := v_absent_count;
        v_attendance_source := 'override';
    ELSE
        v_present_count := v_present_computed;
        v_absent_count := v_absent_computed;
        v_late_count := v_late_computed;
        v_excused_count := v_excused_computed;
        v_unexcused_count := v_unexcused_computed;
        -- Use term's total_school_days as fallback if set, otherwise use computed total
        IF v_term_total_school_days IS NOT NULL AND v_term_total_school_days > 0 THEN
            v_total_count := v_term_total_school_days;
            v_attendance_source := 'term_default';
        ELSE
            v_total_count := v_total_computed;
            v_attendance_source := 'computed';
        END IF;
    END IF;

    IF v_total_count > 0 THEN
        v_attendance_rate := ROUND((v_present_count::NUMERIC / v_total_count::NUMERIC) * 100, 2);
    ELSE
        v_attendance_rate := 0;
    END IF;

    -- Build attendance object with detailed metrics
    v_attendance := jsonb_build_object(
        'present', v_present_count,
        'absent', v_absent_count,
        'late', v_late_count,
        'excused', v_excused_count,
        'unexcused', v_unexcused_count,
        'total', v_total_count,
        'rate', v_attendance_rate,
        'source', v_attendance_source,
        'overrideApplied', (v_attendance_source = 'override'),
        'computed', v_computed_attendance,
        'overrideMeta', CASE WHEN v_attendance_source = 'override' THEN jsonb_build_object(
            'group_id', v_override.group_id,
            'comment', v_override.comment,
            'updated_by', v_override.updated_by,
            'updated_at', v_override.updated_at
        ) ELSE NULL END
    );

    -- 10. Fetch academic goal
    SELECT jsonb_build_object(
        'goalText', sag.goal_text,
        'targetAverage', sag.target_average,
        'targetPosition', sag.target_position,
        'targetSubjects', sag.target_subjects
    )
    INTO v_academic_goal
    FROM public.student_academic_goals sag
    WHERE sag.student_id = p_student_id AND sag.term_id = p_term_id;

    -- 11. Fetch goal analysis if available
    IF v_report_row.goal_analysis_report IS NOT NULL THEN
        v_goal_analysis := jsonb_build_object(
            'report', v_report_row.goal_analysis_report,
            'achievementRating', v_report_row.goal_achievement_rating,
            'generatedAt', v_report_row.goal_analysis_generated_at
        );
    ELSE
        v_goal_analysis := NULL;
    END IF;

    RETURN jsonb_build_object(
        'student', v_student,
        'term', v_term,
        'schoolConfig', v_school_config,
        'subjects', COALESCE(v_subjects, '[]'::jsonb),
        'summary', jsonb_build_object(
            'average', v_report_row.average_score,
            'positionInArm', COALESCE(v_cohort_rank, v_report_row.position_in_class),
            'cohortSize', v_cohort_size,
            'campusPercentile', v_campus_percentile,
            'gpaAverage', 0
        ),
        'attendance', v_attendance,
        'comments', jsonb_build_object(
            'teacher', v_report_row.teacher_comment,
            'principal', v_report_row.principal_comment
        ),
        'academicGoal', v_academic_goal,
        'goalAnalysis', v_goal_analysis
    );
END;
$$ LANGUAGE plpgsql;

-- Public Rating Functions
CREATE OR REPLACE FUNCTION public.search_teachers_public(q text, p_class_name text)
RETURNS SETOF public.mv_public_teacher_leaderboard_current_week AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.mv_public_teacher_leaderboard_current_week
    WHERE (q IS NULL OR teacher_name ILIKE '%' || q || '%')
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.teacher_comments_public(p_teacher_id uuid, p_limit int, p_offset int)
RETURNS TABLE (
    id int,
    teacher_id uuid,
    week_start date,
    rating int,
    comment text,
    student_handle text,
    created_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.teacher_id,
        t.week_start,
        t.rating,
        t.comment,
        t.student_handle,
        t.created_at
    FROM public.v_teacher_ratings_masked t
    WHERE t.teacher_id = p_teacher_id
    ORDER BY t.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get student initial password from auth.users metadata
-- Requires SECURITY DEFINER to access auth schema
CREATE OR REPLACE FUNCTION public.get_student_initial_password(p_student_user_id uuid)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    -- Query the auth.users table to get user_metadata
    SELECT raw_user_meta_data->>'initial_password'
    INTO result
    FROM auth.users
    WHERE id = p_student_user_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

export const MANUALS_SYSTEM_SQL = `
-- ============================================
-- MANUALS SYSTEM MIGRATION
-- Instruction Manuals with Compliance Tracking
-- ============================================

-- 1. Manuals Table
CREATE TABLE IF NOT EXISTS public.manuals (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('Academic', 'Administrative', 'Safety & Security', 'IT & Technology', 'Student Handbook', 'Teacher Guide', 'General')),
    
    -- File information
    file_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    version INTEGER DEFAULT 1,
    
    -- Status and access control
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    target_audience TEXT[] DEFAULT '{}',
    restricted_to_classes INTEGER[],
    restricted_to_roles TEXT[],
    
    -- Compliance fields
    is_compulsory BOOLEAN DEFAULT FALSE,
    compulsory_for_roles TEXT[],
    compulsory_for_new_staff BOOLEAN DEFAULT FALSE,
    days_to_complete INTEGER DEFAULT 7,
    requires_acknowledgment BOOLEAN DEFAULT TRUE,
    acknowledgment_text TEXT,
    
    -- Metadata
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    published_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manuals_school_id ON public.manuals(school_id);
CREATE INDEX IF NOT EXISTS idx_manuals_status ON public.manuals(status);
CREATE INDEX IF NOT EXISTS idx_manuals_category ON public.manuals(category);
CREATE INDEX IF NOT EXISTS idx_manuals_compulsory ON public.manuals(is_compulsory) WHERE is_compulsory = TRUE;

-- 2. Manual Assignments Table
CREATE TABLE IF NOT EXISTS public.manual_assignments (
    id SERIAL PRIMARY KEY,
    manual_id INTEGER REFERENCES public.manuals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    
    -- Assignment metadata
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    time_spent_seconds INTEGER DEFAULT 0,
    
    -- Acknowledgment
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledgment_signature TEXT,
    ip_address TEXT,
    
    -- Reminders
    reminder_sent_at TIMESTAMP WITH TIME ZONE,
    reminder_count INTEGER DEFAULT 0,
    
    UNIQUE(manual_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_manual_assignments_user_id ON public.manual_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_assignments_manual_id ON public.manual_assignments(manual_id);
CREATE INDEX IF NOT EXISTS idx_manual_assignments_status ON public.manual_assignments(status);
CREATE INDEX IF NOT EXISTS idx_manual_assignments_due_date ON public.manual_assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_manual_assignments_overdue ON public.manual_assignments(status, due_date) WHERE status != 'completed';

-- 3. Manual Read Sessions Table (for tracking progress)
CREATE TABLE IF NOT EXISTS public.manual_read_sessions (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER REFERENCES public.manual_assignments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    manual_id INTEGER REFERENCES public.manuals(id) ON DELETE CASCADE,
    
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    pages_viewed INTEGER[],
    last_page_viewed INTEGER,
    total_pages INTEGER
);

CREATE INDEX IF NOT EXISTS idx_manual_read_sessions_assignment ON public.manual_read_sessions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_manual_read_sessions_user ON public.manual_read_sessions(user_id);

-- 4. Manual Compliance Log Table (audit trail)
CREATE TABLE IF NOT EXISTS public.manual_compliance_log (
    id SERIAL PRIMARY KEY,
    manual_id INTEGER REFERENCES public.manuals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('assigned', 'started', 'completed', 'acknowledged', 'reminder_sent')),
    details JSONB,
    performed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_compliance_log_manual ON public.manual_compliance_log(manual_id);
CREATE INDEX IF NOT EXISTS idx_manual_compliance_log_user ON public.manual_compliance_log(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_compliance_log_action ON public.manual_compliance_log(action);

-- 5. Trigger: Auto-assign compulsory manuals to new staff
CREATE OR REPLACE FUNCTION public.auto_assign_onboarding_manuals()
RETURNS TRIGGER AS $$
DECLARE
    manual_record RECORD;
    v_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Only process if this is a staff member (not Student, Guardian, Parent)
    IF NEW.role NOT IN ('Student', 'Guardian', 'Parent') THEN
        -- Find all manuals marked for new staff in this school
        FOR manual_record IN
            SELECT id, days_to_complete
            FROM public.manuals
            WHERE school_id = NEW.school_id
              AND status = 'published'
              AND compulsory_for_new_staff = TRUE
              AND (
                  compulsory_for_roles IS NULL 
                  OR NEW.role = ANY(compulsory_for_roles)
              )
        LOOP
            -- Calculate due date
            v_due_date := NOW() + (manual_record.days_to_complete || ' days')::INTERVAL;
            
            -- Create assignment (ignore if already exists)
            INSERT INTO public.manual_assignments (
                manual_id,
                user_id,
                school_id,
                assigned_at,
                due_date,
                reason,
                status
            ) VALUES (
                manual_record.id,
                NEW.id,
                NEW.school_id,
                NOW(),
                v_due_date,
                'Auto-assigned for new staff onboarding',
                'pending'
            ) ON CONFLICT (manual_id, user_id) DO NOTHING;
            
            -- Log the assignment
            INSERT INTO public.manual_compliance_log (
                manual_id,
                user_id,
                action,
                details,
                performed_by
            ) VALUES (
                manual_record.id,
                NEW.id,
                'assigned',
                jsonb_build_object(
                    'reason', 'new_staff_onboarding',
                    'due_date', v_due_date
                ),
                NULL  -- System-generated
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_auto_assign_onboarding_manuals ON public.user_profiles;
CREATE TRIGGER trigger_auto_assign_onboarding_manuals
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_assign_onboarding_manuals();

-- 6. Function to update assignment status based on due date
CREATE OR REPLACE FUNCTION public.update_overdue_manual_assignments()
RETURNS void AS $$
BEGIN
    UPDATE public.manual_assignments
    SET status = 'overdue'
    WHERE status IN ('pending', 'in_progress')
      AND due_date < NOW()
      AND status != 'overdue';
END;
$$ LANGUAGE plpgsql;

-- 7. RLS Policies for Manuals Tables
DO $$
BEGIN
    -- Manuals table policies
    ALTER TABLE public.manuals ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manuals' AND policyname = 'Auth read manuals') THEN
        CREATE POLICY "Auth read manuals" ON public.manuals FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manuals' AND policyname = 'Auth write manuals') THEN
        CREATE POLICY "Auth write manuals" ON public.manuals FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    
    -- Manual assignments policies
    ALTER TABLE public.manual_assignments ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_assignments' AND policyname = 'Auth read manual_assignments') THEN
        CREATE POLICY "Auth read manual_assignments" ON public.manual_assignments FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_assignments' AND policyname = 'Auth write manual_assignments') THEN
        CREATE POLICY "Auth write manual_assignments" ON public.manual_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    
    -- Manual read sessions policies
    ALTER TABLE public.manual_read_sessions ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_read_sessions' AND policyname = 'Auth read manual_read_sessions') THEN
        CREATE POLICY "Auth read manual_read_sessions" ON public.manual_read_sessions FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_read_sessions' AND policyname = 'Auth write manual_read_sessions') THEN
        CREATE POLICY "Auth write manual_read_sessions" ON public.manual_read_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    
    -- Manual compliance log policies
    ALTER TABLE public.manual_compliance_log ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_compliance_log' AND policyname = 'Auth read manual_compliance_log') THEN
        CREATE POLICY "Auth read manual_compliance_log" ON public.manual_compliance_log FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_compliance_log' AND policyname = 'Auth write manual_compliance_log') THEN
        CREATE POLICY "Auth write manual_compliance_log" ON public.manual_compliance_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

NOTIFY pgrst, 'reload config';
`;


const DATABASE_SCHEMA = `
-- Complete Database Schema for School Guardian 360
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Schools (Tenancy Root)
CREATE TABLE IF NOT EXISTS public.schools (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    secret_code TEXT UNIQUE NOT NULL DEFAULT 'UPSS-SECRET-2025',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    branding JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    school_documents JSONB DEFAULT '{}',
    social_accounts JSONB DEFAULT '{}'
);

INSERT INTO public.schools (id, name, secret_code)
VALUES (1, 'University Preparatory Secondary School', 'UPSS-SECRET-2025')
ON CONFLICT (id) DO NOTHING;

-- 2) User Profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    avatar_url TEXT,
    staff_code TEXT,
    phone_number TEXT,
    description TEXT,
    bank_code TEXT,
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    base_pay NUMERIC DEFAULT 0,
    commission NUMERIC DEFAULT 0,
    campus_id INTEGER,
    has_seen_tour BOOLEAN DEFAULT FALSE,
    dashboard_config TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3) Roles
CREATE TABLE IF NOT EXISTS public.roles (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    permissions TEXT[],
    reporting_quota_days INTEGER,
    reporting_quota_count INTEGER,
    ai_analysis_focus TEXT,
    ai_routing_instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_school_id_title_key') THEN
        ALTER TABLE public.roles ADD CONSTRAINT roles_school_id_title_key UNIQUE (school_id, title);
    END IF;
END $$;

INSERT INTO public.roles (school_id, title, description, permissions) VALUES
(1, 'Admin', 'System Administrator', ARRAY['*']),
(1, 'Principal', 'School Head', ARRAY['view-dashboard', 'view-all-reports', 'manage-users', 'manage-students', 'view-analytics', 'view-school-health-overview', 'manage-tasks', 'manage-announcements', 'view-teacher-ratings', 'view-ai-task-suggestions', 'view-at-risk-students', 'view-all-student-data', 'view-sensitive-reports', 'manage-payroll']),
(1, 'Team Lead', 'Department Head', ARRAY['view-dashboard', 'submit-report', 'view-all-reports', 'assign-reports', 'comment-on-reports', 'manage-tasks', 'manage-curriculum', 'view-coverage-feedback']),
(1, 'Teacher', 'Classroom teacher', ARRAY['view-dashboard', 'submit-report', 'score_entries.edit_self', 'view-my-reports', 'view-my-classes', 'view-my-lesson-plans', 'view-my-coverage-feedback', 'take-class-attendance', 'view-curriculum-readonly']),
(1, 'Counselor', 'Student guidance', ARRAY['view-dashboard', 'submit-report', 'view-all-reports', 'manage-students', 'view-at-risk-students', 'view-sensitive-reports']),
(1, 'Accountant', 'Financial management', ARRAY['view-dashboard', 'manage-payroll', 'view-sms-balance', 'manage-finance', 'manage-orders']),
(1, 'School Secretary', 'Admin support', ARRAY['view-dashboard', 'submit-report', 'manage-calendar', 'manage-announcements']),
(1, 'IT Support', 'Tech support', ARRAY['view-dashboard', 'submit-report', 'manage-inventory']),
(1, 'Maintenance', 'Facility', ARRAY['view-dashboard', 'submit-report', 'manage-inventory']),
(1, 'Librarian', 'Library', ARRAY['view-dashboard', 'submit-report', 'manage-inventory']),
(1, 'Bookstore and Uniform Attendant', 'Store', ARRAY['view-dashboard', 'submit-report', 'manage-inventory', 'manage-orders']),
(1, 'Day care Administrator', 'Day care', ARRAY['view-dashboard', 'submit-report']),
(1, 'Social Media Manager', 'Social media', ARRAY['view-dashboard', 'manage-social-media', 'submit-report']),
(1, 'Guardian', 'Parent', ARRAY['view-dashboard']),
(1, 'Student', 'Student', ARRAY['view-dashboard'])
ON CONFLICT (school_id, title) DO NOTHING;

-- 4) User Role Assignments
CREATE TABLE IF NOT EXISTS public.user_role_assignments (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES public.roles(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);
-- Add school_id column if it doesn't exist (for existing deployments)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_role_assignments' AND column_name='school_id') THEN
        ALTER TABLE public.user_role_assignments ADD COLUMN school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5) Students & Profiles
CREATE TABLE IF NOT EXISTS public.students (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    admission_number TEXT,
    grade TEXT,
    class_id INTEGER,
    arm_id INTEGER,
    date_of_birth DATE,
    parent_phone_number_1 TEXT,
    parent_phone_number_2 TEXT,
    address TEXT,
    email TEXT,
    status TEXT DEFAULT 'Active',
    reward_points INTEGER DEFAULT 0,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='email') THEN
        ALTER TABLE public.students ADD COLUMN email TEXT;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.student_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    student_record_id INTEGER REFERENCES public.students(id) ON DELETE SET NULL,
    class_id INTEGER,
    arm_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6) Academics Base (Dictionaries)
CREATE TABLE IF NOT EXISTS public.terms (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    session_label TEXT NOT NULL,
    term_label TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS public.subjects (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL UNIQUE
);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='priority') THEN
        ALTER TABLE public.subjects ADD COLUMN priority INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='is_solo') THEN
        ALTER TABLE public.subjects ADD COLUMN is_solo BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='can_co_run') THEN
        ALTER TABLE public.subjects ADD COLUMN can_co_run BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'subjects' AND constraint_name = 'subjects_solo_corun_check'
    ) THEN
        ALTER TABLE public.subjects
        ADD CONSTRAINT subjects_solo_corun_check CHECK (NOT (is_solo AND can_co_run));
    END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.classes (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS public.arms (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS public.class_subjects (
    id SERIAL PRIMARY KEY,
    class_id INTEGER REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES public.subjects(id) ON DELETE CASCADE,
    is_compulsory BOOLEAN DEFAULT FALSE,
    UNIQUE(class_id, subject_id)
);

-- 7) Academic Structure
CREATE TABLE IF NOT EXISTS public.assessment_structures (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    components JSONB DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS public.grading_schemes (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    scheme_name TEXT NOT NULL,
    gpa_max NUMERIC
);
CREATE TABLE IF NOT EXISTS public.grading_scheme_rules (
    id SERIAL PRIMARY KEY,
    grading_scheme_id INTEGER REFERENCES public.grading_schemes(id) ON DELETE CASCADE,
    min_score NUMERIC,
    max_score NUMERIC,
    grade_label TEXT,
    gpa_value NUMERIC,
    remark TEXT
);
CREATE TABLE IF NOT EXISTS public.school_config (
    school_id INTEGER PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    display_name TEXT,
    address TEXT,
    phone TEXT,
    logo_url TEXT,
    motto TEXT,
    active_grading_scheme_id INTEGER REFERENCES public.grading_schemes(id) ON DELETE SET NULL,
    current_term_id INTEGER REFERENCES public.terms(id) ON DELETE SET NULL,
    term_weights JSONB DEFAULT '{"term1": 10, "term2": 10, "term3": 80}',
    student_id_prefix TEXT,
    staff_id_prefix TEXT,
    id_year_mode TEXT,
    pay_cycle TEXT DEFAULT 'monthly',
    late_checkin_deduction_percent NUMERIC,
    fine_early_checkout NUMERIC DEFAULT 0,
    fine_no_checkout NUMERIC DEFAULT 0
);
-- Ensure config exists
INSERT INTO public.school_config (school_id, display_name) VALUES (1, 'University Preparatory Secondary School') ON CONFLICT (school_id) DO NOTHING;

-- Update config table with new columns if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='school_config' AND column_name='fine_early_checkout') THEN
        ALTER TABLE public.school_config ADD COLUMN fine_early_checkout NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='school_config' AND column_name='fine_no_checkout') THEN
        ALTER TABLE public.school_config ADD COLUMN fine_no_checkout NUMERIC DEFAULT 0;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.academic_classes (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level TEXT,
    arm TEXT,
    session_label TEXT,
    assessment_structure_id INTEGER REFERENCES public.assessment_structures(id) ON DELETE SET NULL,
    grading_scheme_id INTEGER REFERENCES public.grading_schemes(id) ON DELETE SET NULL,
    report_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    min_subjects INTEGER DEFAULT NULL,
    max_subjects INTEGER DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS public.teaching_assignments (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    subject_name TEXT,
    subject_group TEXT,
    teacher_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    max_ca_score NUMERIC,
    max_exam_score NUMERIC,
    is_locked BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP WITH TIME ZONE
);
CREATE TABLE IF NOT EXISTS public.academic_class_students (
    id SERIAL PRIMARY KEY,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    enrolled_term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    UNIQUE(academic_class_id, student_id, enrolled_term_id)
);
CREATE TABLE IF NOT EXISTS public.student_subject_choices (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES public.subjects(id) ON DELETE CASCADE,
    locked BOOLEAN DEFAULT FALSE,
    UNIQUE(student_id, subject_id)
);

-- 8) Assessments & Scores
CREATE TABLE IF NOT EXISTS public.score_entries (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    subject_name TEXT,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    component_scores JSONB DEFAULT '{}',
    total_score NUMERIC,
    grade TEXT,
    teacher_comment TEXT,
    ca_score NUMERIC,
    exam_score NUMERIC,
    UNIQUE(term_id, academic_class_id, subject_name, student_id)
);
CREATE TABLE IF NOT EXISTS public.student_term_reports (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    average_score NUMERIC,
    total_score NUMERIC,
    position_in_class INTEGER,
    position_in_grade INTEGER,
    teacher_comment TEXT,
    principal_comment TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, term_id)
);
CREATE TABLE IF NOT EXISTS public.student_term_report_subjects (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES public.student_term_reports(id) ON DELETE CASCADE,
    subject_name TEXT,
    total_score NUMERIC,
    grade_label TEXT,
    remark TEXT,
    subject_position INTEGER
);
CREATE TABLE IF NOT EXISTS public.student_term_report_traits (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES public.student_term_reports(id) ON DELETE CASCADE,
    trait_name TEXT,
    rating INTEGER
);

CREATE TABLE IF NOT EXISTS public.assessments (
    id SERIAL PRIMARY KEY,
    teaching_assignment_id INTEGER REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    assessment_type TEXT,
    max_score NUMERIC,
    deadline DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.assessment_scores (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER REFERENCES public.assessments(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    score NUMERIC,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(assessment_id, student_id)
);

-- 9) Attendance & Staff Ops
CREATE TABLE IF NOT EXISTS public.campuses (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    geofence_lat NUMERIC,
    geofence_lng NUMERIC,
    geofence_radius_meters NUMERIC
);
CREATE TABLE IF NOT EXISTS public.teacher_checkins (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    checkin_date DATE,
    status TEXT,
    mood TEXT,
    energy INTEGER,
    notes TEXT,
    photo_url TEXT,
    geo_lat NUMERIC,
    geo_lng NUMERIC,
    checkout_time TIMESTAMP WITH TIME ZONE,
    checkout_notes TEXT,
    campus_id INTEGER REFERENCES public.campuses(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.class_groups (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT,
    description TEXT,
    group_type TEXT,
    teaching_entity_id INTEGER REFERENCES public.teaching_assignments(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.class_group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES public.class_groups(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    UNIQUE(group_id, student_id)
);
CREATE TABLE IF NOT EXISTS public.attendance_schedules (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES public.class_group_members(id) ON DELETE CASCADE,
    day_of_week INTEGER,
    start_time TIME,
    end_time TIME
);
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES public.class_group_members(id) ON DELETE CASCADE,
    schedule_id INTEGER REFERENCES public.attendance_schedules(id) ON DELETE SET NULL,
    session_date DATE,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.attendance_overrides (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES public.class_groups(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    session_label TEXT,
    total_days INTEGER DEFAULT 0,
    days_present INTEGER DEFAULT 0,
    comment TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, group_id, term_id),
    CHECK (days_present <= total_days)
);
CREATE INDEX IF NOT EXISTS attendance_overrides_term_idx ON public.attendance_overrides(term_id, group_id);
-- Teaching Entities (Legacy support / alternative to teaching_assignments)
CREATE TABLE IF NOT EXISTS public.teaching_entities (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES public.subjects(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES public.classes(id) ON DELETE CASCADE,
    arm_id INTEGER REFERENCES public.arms(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10) E-Commerce & Inventory
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    stock INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    price NUMERIC DEFAULT 0,
    image_url TEXT,
    description TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.orders (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    total_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    payment_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
    inventory_item_id INTEGER REFERENCES public.inventory_items(id) ON DELETE SET NULL,
    quantity INTEGER,
    unit_price NUMERIC
);
CREATE TABLE IF NOT EXISTS public.order_notes (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11) Payroll & Finance
CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    period_label TEXT,
    total_amount NUMERIC,
    status TEXT,
    transfer_code TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    meta JSONB,
    pay_period_start DATE,
    pay_period_end DATE,
    pay_date DATE,
    reference_number TEXT,
    payment_method TEXT,
    finalized_at TIMESTAMP WITH TIME ZONE,
    pay_period_label TEXT
);
CREATE TABLE IF NOT EXISTS public.payroll_items (
    id SERIAL PRIMARY KEY,
    payroll_run_id INTEGER REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    gross_amount NUMERIC,
    deductions JSONB,
    net_amount NUMERIC,
    paystack_recipient_code TEXT,
    transfer_status TEXT,
    narration TEXT,
    payslip_url TEXT,
    payment_method TEXT,
    status TEXT DEFAULT 'draft',
    pay_date DATE,
    reference_number TEXT,
    employment_type TEXT,
    department TEXT,
    role_title TEXT,
    total_employer_contributions NUMERIC DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.payroll_components (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    component_type TEXT NOT NULL CHECK (component_type IN ('earning', 'deduction', 'employer_contrib')),
    taxable BOOLEAN DEFAULT TRUE,
    pensionable BOOLEAN DEFAULT FALSE,
    calculation_type TEXT DEFAULT 'fixed' NOT NULL CHECK (calculation_type IN ('fixed', 'formula')),
    amount NUMERIC DEFAULT 0,
    formula TEXT,
    ordering INTEGER DEFAULT 100,
    show_on_payslip BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_components_school_id ON public.payroll_components(school_id);
CREATE INDEX IF NOT EXISTS idx_payroll_components_type ON public.payroll_components(component_type);
CREATE TABLE IF NOT EXISTS public.payroll_line_items (
    id SERIAL PRIMARY KEY,
    payroll_item_id INTEGER REFERENCES public.payroll_items(id) ON DELETE CASCADE NOT NULL,
    component_id INTEGER REFERENCES public.payroll_components(id) ON DELETE SET NULL,
    label TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('earning', 'deduction', 'employer_contrib')),
    amount NUMERIC NOT NULL DEFAULT 0,
    units NUMERIC,
    rate NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_line_items_item ON public.payroll_line_items(payroll_item_id);
CREATE INDEX IF NOT EXISTS idx_payroll_line_items_component ON public.payroll_line_items(component_id);
CREATE INDEX IF NOT EXISTS idx_payroll_line_items_category ON public.payroll_line_items(category);
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    amount NUMERIC,
    reason TEXT,
    adjustment_type TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    payroll_run_id INTEGER REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.paystack_recipients (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    recipient_code TEXT NOT NULL,
    bank_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payroll Pre-Run (v2)
CREATE TYPE payroll_run_status_v2 AS ENUM (
    'DRAFT',
    'PRE_RUN_PUBLISHED',
    'FINALIZED',
    'PROCESSING',
    'PROCESSED_OFFLINE',
    'PROCESSED_PAYSTACK',
    'FAILED'
);

CREATE TYPE payroll_processing_method AS ENUM ('OFFLINE', 'PAYSTACK');
CREATE TYPE payslip_status AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'QUERY_RAISED', 'RESOLVED', 'FINAL');
CREATE TYPE payslip_line_item_type AS ENUM ('EARNING', 'DEDUCTION', 'INFO');
CREATE TYPE payslip_query_status AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

CREATE TABLE IF NOT EXISTS public.payroll_runs_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    period_key TEXT NOT NULL,
    status payroll_run_status_v2 NOT NULL DEFAULT 'DRAFT',
    processing_method payroll_processing_method,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    published_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    finalized_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    finalized_at TIMESTAMP WITH TIME ZONE,
    meta JSONB DEFAULT '{}'
);

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payslip_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payslip_id UUID REFERENCES public.payslips(id) ON DELETE CASCADE,
    type payslip_line_item_type NOT NULL,
    label TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    ordering INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payslip_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payslip_id UUID REFERENCES public.payslips(id) ON DELETE CASCADE,
    raised_by_staff_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    status payslip_query_status NOT NULL DEFAULT 'OPEN',
    message TEXT NOT NULL,
    admin_response TEXT,
    attachment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Fee Management
CREATE TABLE IF NOT EXISTS public.fee_items (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    amount NUMERIC DEFAULT 0,
    is_compulsory BOOLEAN DEFAULT TRUE,
    target_class_id INTEGER REFERENCES public.classes(id) ON DELETE SET NULL,
    target_term_id INTEGER REFERENCES public.terms(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.student_invoices (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    invoice_number TEXT,
    total_amount NUMERIC DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Unpaid',
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES public.student_invoices(id) ON DELETE CASCADE,
    fee_item_id INTEGER REFERENCES public.fee_items(id) ON DELETE SET NULL,
    description TEXT,
    amount NUMERIC
);
CREATE TABLE IF NOT EXISTS public.payments (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    invoice_id INTEGER REFERENCES public.student_invoices(id) ON DELETE SET NULL,
    amount NUMERIC,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payment_method TEXT,
    reference TEXT,
    recorded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12) HR Extra
CREATE TABLE IF NOT EXISTS public.leave_types (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    days_allowed INTEGER,
    requires_approval BOOLEAN DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    leave_type_id INTEGER REFERENCES public.leave_types(id) ON DELETE CASCADE,
    start_date DATE,
    end_date DATE,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.teacher_shifts (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    day_of_week INTEGER,
    start_time TIME,
    end_time TIME
);
CREATE TABLE IF NOT EXISTS public.holidays (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT,
    date DATE,
    is_recurring BOOLEAN DEFAULT FALSE
);

-- 13) General & Comms
CREATE TABLE IF NOT EXISTS public.reports (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    report_text TEXT,
    report_type TEXT,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    involved_students INTEGER[],
    involved_staff TEXT[],
    tagged_users JSONB,
    image_url TEXT,
    status TEXT DEFAULT 'pending',
    response TEXT,
    analysis JSONB,
    parent_communication_draft TEXT,
    internal_summary_draft TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    archived BOOLEAN DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS public.report_comments (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES public.reports(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    comment_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.tasks (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'ToDo',
    priority TEXT DEFAULT 'Medium',
    due_date DATE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    report_id INTEGER REFERENCES public.reports(id) ON DELETE SET NULL,
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_minutes_before INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.announcements (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.notifications (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    is_all_day BOOLEAN,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.communications_audit (
    id SERIAL PRIMARY KEY,
    recipients TEXT[],
    message_body TEXT,
    provider_message_id TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Timetable System
CREATE TABLE IF NOT EXISTS public.timetable_periods (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT,
    start_time TIME,
    end_time TIME,
    type TEXT DEFAULT 'lesson'
);
CREATE TABLE IF NOT EXISTS public.timetable_entries (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    day_of_week TEXT,
    period_id INTEGER REFERENCES public.timetable_periods(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    room_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Timetable Locations (campus-specific)
CREATE TABLE IF NOT EXISTS public.timetable_locations (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    campus_id INTEGER REFERENCES public.campuses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    capacity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Add location_id to timetable_entries
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timetable_entries' AND column_name = 'location_id') THEN
        ALTER TABLE public.timetable_entries ADD COLUMN location_id INTEGER REFERENCES public.timetable_locations(id) ON DELETE SET NULL;
    END IF;
END $$;
-- Unique constraints for timetable to prevent double booking
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_teacher_slot') THEN
        ALTER TABLE public.timetable_entries ADD CONSTRAINT unique_teacher_slot UNIQUE (term_id, day_of_week, period_id, teacher_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_location_slot') THEN
        ALTER TABLE public.timetable_entries ADD CONSTRAINT unique_location_slot UNIQUE (term_id, day_of_week, period_id, location_id);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_class_slot') THEN
        ALTER TABLE public.timetable_entries DROP CONSTRAINT unique_class_slot;
    END IF;
END $$;

-- 14) Quizzes & Surveys
CREATE TABLE IF NOT EXISTS public.quizzes (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    audience JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT,
    question_type TEXT,
    position INTEGER,
    options JSONB
);
CREATE TABLE IF NOT EXISTS public.quiz_responses (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER REFERENCES public.quizzes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    selected_option_index INTEGER,
    ranking_value INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15) Other Modules
CREATE TABLE IF NOT EXISTS public.lesson_plans (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    teaching_entity_id INTEGER REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    week_start_date DATE,
    title TEXT,
    plan_type TEXT DEFAULT 'structured',
    objectives TEXT,
    materials TEXT,
    activities TEXT,
    assessment_methods TEXT,
    freeform_content TEXT,
    file_url TEXT,
    submission_status TEXT DEFAULT 'Pending',
    coverage_status TEXT DEFAULT 'Pending',
    coverage_notes TEXT,
    status TEXT DEFAULT 'draft',
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ai_analysis JSONB
);
CREATE TABLE IF NOT EXISTS public.curriculum (
    id SERIAL PRIMARY KEY,
    teaching_entity_id INTEGER REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.curriculum_weeks (
    id SERIAL PRIMARY KEY,
    curriculum_id INTEGER REFERENCES public.curriculum(id) ON DELETE CASCADE,
    week_number INTEGER,
    expected_topics TEXT
);
CREATE TABLE IF NOT EXISTS public.lesson_plan_coverage_votes (
    id SERIAL PRIMARY KEY,
    lesson_plan_id INTEGER REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    vote BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.teams (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    lead_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.team_assignments (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.team_feedback (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES public.teams(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    week_start_date DATE,
    rating INTEGER,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.living_policy_snippets (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    content TEXT,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.student_intervention_plans (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    goals TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.sip_logs (
    id SERIAL PRIMARY KEY,
    sip_id INTEGER REFERENCES public.student_intervention_plans(id) ON DELETE CASCADE,
    log_entry TEXT,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.positive_behavior (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    description TEXT,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.student_awards (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    award_type TEXT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.staff_awards (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    recipient_name TEXT,
    reason TEXT,
    source_report_ids INTEGER[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.rewards_store_items (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT,
    description TEXT,
    cost INTEGER,
    stock INTEGER,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    reward_item_id INTEGER REFERENCES public.rewards_store_items(id) ON DELETE SET NULL,
    cost INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.audit_log (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    action TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.teacher_ratings (
    id SERIAL PRIMARY KEY,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    week_start DATE,
    rating INTEGER,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, teacher_id, week_start)
);
CREATE TABLE IF NOT EXISTS public.teacher_rating_weekly (
    id SERIAL PRIMARY KEY,
    teacher_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    week_start DATE,
    rating_count INTEGER,
    weighted_avg NUMERIC,
    low_count INTEGER,
    spotlight BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Views
CREATE OR REPLACE VIEW public.v_teacher_ratings_masked AS
SELECT
    tr.id,
    tr.teacher_id,
    tr.week_start,
    tr.rating,
    tr.comment,
    'Student ' || substr(md5(tr.student_id::text), 1, 6) as student_handle,
    tr.created_at
FROM public.teacher_ratings tr;

-- Safe Drop/Create of Materialized View
DO $$
DECLARE
    r_kind "char";
BEGIN
    SELECT relkind INTO r_kind
    FROM pg_class
    JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
    WHERE pg_class.relname = 'mv_public_teacher_leaderboard_current_week'
      AND pg_namespace.nspname = 'public';

    IF r_kind = 'v' THEN
        EXECUTE 'DROP VIEW public.mv_public_teacher_leaderboard_current_week CASCADE';
    ELSIF r_kind = 'm' THEN
        EXECUTE 'DROP MATERIALIZED VIEW public.mv_public_teacher_leaderboard_current_week CASCADE';
    END IF;
END $$;

CREATE MATERIALIZED VIEW public.mv_public_teacher_leaderboard_current_week AS
SELECT
    u.id as teacher_id,
    u.name as teacher_name,
    COALESCE(w.weighted_avg, 0) as weighted_avg,
    COALESCE(w.rating_count, 0) as rating_count,
    w.spotlight,
    RANK() OVER (ORDER BY COALESCE(w.weighted_avg, 0) DESC) as rank_overall
FROM public.user_profiles u
LEFT JOIN public.teacher_rating_weekly w ON u.id = w.teacher_id AND w.week_start = date_trunc('week', CURRENT_DATE)::date
WHERE u.role = 'Teacher' OR u.role = 'Team Lead';

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_leaderboard_current ON public.mv_public_teacher_leaderboard_current_week (teacher_id);

CREATE OR REPLACE FUNCTION public.refresh_public_leaderboard_mv()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_public_teacher_leaderboard_current_week;
END;
$$ LANGUAGE plpgsql;


-- Trigger: Handle User Creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    is_first_user BOOLEAN;
    user_type TEXT;
    skip_student_creation BOOLEAN;
BEGIN
    user_type := new.raw_user_meta_data->>'user_type';
    skip_student_creation := (new.raw_user_meta_data->>'skip_student_creation')::boolean;

    IF user_type = 'student' THEN
        INSERT INTO public.student_profiles (id, full_name, school_id, class_id, arm_id)
        VALUES (
            new.id,
            COALESCE(new.raw_user_meta_data->>'name', 'New Student'),
            COALESCE((new.raw_user_meta_data->>'school_id')::int, 1),
            (new.raw_user_meta_data->>'class_id')::int,
            (new.raw_user_meta_data->>'arm_id')::int
        ) ON CONFLICT (id) DO NOTHING;

        IF skip_student_creation IS NOT TRUE THEN
            INSERT INTO public.students (school_id, name, user_id, status)
            VALUES (
                COALESCE((new.raw_user_meta_data->>'school_id')::int, 1),
                COALESCE(new.raw_user_meta_data->>'name', 'New Student'),
                new.id,
                'Active'
            );
        END IF;

    ELSIF user_type = 'staff' OR user_type IS NULL THEN
        SELECT count(*) = 0 INTO is_first_user FROM public.user_profiles;

        INSERT INTO public.user_profiles (id, school_id, name, email, role)
        VALUES (
            new.id,
            1,
            COALESCE(new.raw_user_meta_data->>'name', new.email),
            new.email,
            CASE WHEN is_first_user THEN 'Admin' ELSE 'Teacher' END
        ) ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function: Compute Ratings
CREATE OR REPLACE FUNCTION public.compute_teacher_rating_week_current()
RETURNS void AS $$
DECLARE
    week_start_date date;
BEGIN
    week_start_date := date_trunc('week', CURRENT_DATE)::date;
    
    DELETE FROM public.teacher_rating_weekly WHERE week_start = week_start_date;

    INSERT INTO public.teacher_rating_weekly (teacher_id, week_start, rating_count, weighted_avg, low_count, spotlight)
    SELECT
        teacher_id,
        week_start,
        count(*),
        avg(rating),
        count(*) FILTER (WHERE rating <= 2),
        (avg(rating) >= 4.5 AND count(*) >= 5)
    FROM public.teacher_ratings
    WHERE week_start = week_start_date
    GROUP BY teacher_id, week_start;
END;
$$ LANGUAGE plpgsql;

-- Policies (Non-destructive)
DO $$
DECLARE
    t text;
BEGIN
    -- FIX: Only select BASE TABLES to avoid "cannot be performed on relation" errors for views
    FOR t IN
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

        -- Read Policy (Check existence)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = format('Auth read %s', t)) THEN
             EXECUTE format('CREATE POLICY "Auth read %I" ON %I FOR SELECT TO authenticated USING (true)', t, t);
        END IF;
        
        -- Write Policy (Check existence)
        IF t IN ('reports', 'tasks', 'announcements', 'teacher_checkins', 'inventory_items', 'attendance_records', 'attendance_overrides', 'leave_requests', 'score_entries', 'orders', 'order_items', 'order_notes', 'team_feedback', 'report_comments', 'lesson_plans', 'quiz_responses', 'student_intervention_plans', 'sip_logs', 'student_invoices', 'payments', 'student_profiles', 'students', 'timetable_entries', 'timetable_periods', 'holidays', 'teacher_shifts', 'student_subject_choices', 'class_subjects', 'schools', 'roles', 'user_role_assignments', 'class_groups', 'class_group_members', 'attendance_schedules') THEN
             IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = format('Auth write %s', t)) THEN
                 EXECUTE format('CREATE POLICY "Auth write %I" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
             END IF;
        END IF;
    END LOOP;
END $$;

-- Specific Policy Overrides (Non-destructive checks)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users update own profile') THEN
        CREATE POLICY "Users update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_profiles' AND policyname = 'Students update own profile') THEN
        CREATE POLICY "Students update own profile" ON public.student_profiles FOR UPDATE USING (auth.uid() = id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schools' AND policyname = 'Public view schools') THEN
        CREATE POLICY "Public view schools" ON public.schools FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'school_config' AND policyname = 'Public view config') THEN
        CREATE POLICY "Public view config" ON public.school_config FOR SELECT USING (true);
    END IF;

    -- Attendance overrides: ensure controlled access for class teachers and admins
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_overrides' AND policyname = 'Auth read attendance_overrides') THEN
        DROP POLICY "Auth read attendance_overrides" ON public.attendance_overrides;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_overrides' AND policyname = 'Auth write attendance_overrides') THEN
        DROP POLICY "Auth write attendance_overrides" ON public.attendance_overrides;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_overrides' AND policyname = 'attendance_overrides_select') THEN
        DROP POLICY "attendance_overrides_select" ON public.attendance_overrides;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_overrides' AND policyname = 'attendance_overrides_manage_insert') THEN
        DROP POLICY "attendance_overrides_manage_insert" ON public.attendance_overrides;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_overrides' AND policyname = 'attendance_overrides_manage_update') THEN
        DROP POLICY "attendance_overrides_manage_update" ON public.attendance_overrides;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_overrides' AND policyname = 'attendance_overrides_manage_delete') THEN
        DROP POLICY "attendance_overrides_manage_delete" ON public.attendance_overrides;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_overrides' AND policyname = 'attendance_overrides_select') THEN
        CREATE POLICY "attendance_overrides_select" ON public.attendance_overrides
            FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_overrides' AND policyname = 'attendance_overrides_manage_insert') THEN
        CREATE POLICY "attendance_overrides_manage_insert" ON public.attendance_overrides
            FOR INSERT TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.user_profiles up
                    WHERE up.id = auth.uid() AND up.role IN ('Admin', 'Principal', 'School Owner')
                )
                OR EXISTS (
                    SELECT 1 FROM public.class_groups cg
                    JOIN public.teaching_assignments ta ON cg.teaching_entity_id = ta.id
                    WHERE cg.id = attendance_overrides.group_id
                      AND ta.teacher_user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_overrides' AND policyname = 'attendance_overrides_manage_update') THEN
        CREATE POLICY "attendance_overrides_manage_update" ON public.attendance_overrides
            FOR UPDATE TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.user_profiles up
                    WHERE up.id = auth.uid() AND up.role IN ('Admin', 'Principal', 'School Owner')
                )
                OR EXISTS (
                    SELECT 1 FROM public.class_groups cg
                    JOIN public.teaching_assignments ta ON cg.teaching_entity_id = ta.id
                    WHERE cg.id = attendance_overrides.group_id
                      AND ta.teacher_user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.user_profiles up
                    WHERE up.id = auth.uid() AND up.role IN ('Admin', 'Principal', 'School Owner')
                )
                OR EXISTS (
                    SELECT 1 FROM public.class_groups cg
                    JOIN public.teaching_assignments ta ON cg.teaching_entity_id = ta.id
                    WHERE cg.id = attendance_overrides.group_id
                      AND ta.teacher_user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_overrides' AND policyname = 'attendance_overrides_manage_delete') THEN
        CREATE POLICY "attendance_overrides_manage_delete" ON public.attendance_overrides
            FOR DELETE TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.user_profiles up
                    WHERE up.id = auth.uid() AND up.role IN ('Admin', 'Principal', 'School Owner')
                )
                OR EXISTS (
                    SELECT 1 FROM public.class_groups cg
                    JOIN public.teaching_assignments ta ON cg.teaching_entity_id = ta.id
                    WHERE cg.id = attendance_overrides.group_id
                      AND ta.teacher_user_id = auth.uid()
                )
            );
    END IF;

    -- Teacher checkins: Users can only see their own records, unless they are Admin/Principal/Team Lead
    -- First drop the generic read policy if it exists
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_checkins' AND policyname = 'Auth read teacher_checkins') THEN
        DROP POLICY "Auth read teacher_checkins" ON public.teacher_checkins;
    END IF;
    
    -- Create policy: Users see own checkins, Admins/Principals/Team Leads see all
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_checkins' AND policyname = 'Teacher checkins read policy') THEN
        CREATE POLICY "Teacher checkins read policy" ON public.teacher_checkins FOR SELECT USING (
            teacher_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM public.user_profiles 
                WHERE id = auth.uid() 
                AND role IN ('Admin', 'Principal', 'Team Lead')
            )
        );
    END IF;
END $$;

-- Include the fix function
${ATTENDANCE_FIX_SQL}

-- Include the dictionary fix
${DICTIONARY_FIX_SQL}

-- Include Quiz RPCs
${QUIZ_RPC_SQL}

-- Include Manuals System
${MANUALS_SYSTEM_SQL}

-- Ensure bucket creation logic (idempotent via INSERT DO NOTHING or manual setup instructions usually, but here is SQL for it)
INSERT INTO storage.buckets (id, name, public) VALUES ('report_images', 'report_images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance_photos', 'attendance_photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('lesson_plans', 'lesson_plans', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('learning_materials', 'learning_materials', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('homework_files', 'homework_files', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('manuals', 'manuals', true) ON CONFLICT (id) DO NOTHING;
`;

export const LESSON_PLAN_ENHANCEMENT_SQL = `
-- ============================================
-- LESSON PLAN ENHANCEMENT MIGRATION
-- ============================================

-- 1. Per-Arm Coverage Tracking
CREATE TABLE IF NOT EXISTS public.lesson_plan_coverage (
    id SERIAL PRIMARY KEY,
    lesson_plan_id INTEGER REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    arm_id INTEGER,
    coverage_status TEXT DEFAULT 'Pending',
    coverage_percentage INTEGER DEFAULT 0,
    topics_covered TEXT,
    topics_pending TEXT,
    notes TEXT,
    covered_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Learning Materials
CREATE TABLE IF NOT EXISTS public.learning_materials (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    lesson_plan_id INTEGER REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    material_type TEXT DEFAULT 'document',
    file_url TEXT,
    external_url TEXT,
    tags TEXT[],
    is_shared BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT FALSE,
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Student Material Access Tracking
CREATE TABLE IF NOT EXISTS public.student_material_access (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    material_id INTEGER REFERENCES public.learning_materials(id) ON DELETE CASCADE,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, material_id)
);

-- 4. Lesson Plan Reviews
CREATE TABLE IF NOT EXISTS public.lesson_plan_reviews (
    id SERIAL PRIMARY KEY,
    lesson_plan_id INTEGER REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    review_status TEXT DEFAULT 'pending',
    feedback TEXT,
    revision_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Homework Management
CREATE TABLE IF NOT EXISTS public.homework (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    lesson_plan_id INTEGER REFERENCES public.lesson_plans(id) ON DELETE SET NULL,
    teaching_assignment_id INTEGER REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    due_date DATE NOT NULL,
    due_time TIME,
    max_score INTEGER DEFAULT 100,
    is_graded BOOLEAN DEFAULT TRUE,
    allow_late_submission BOOLEAN DEFAULT FALSE,
    late_penalty_percent INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    notify_parents BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Homework Attachments
CREATE TABLE IF NOT EXISTS public.homework_attachments (
    id SERIAL PRIMARY KEY,
    homework_id INTEGER REFERENCES public.homework(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Homework Submissions
CREATE TABLE IF NOT EXISTS public.homework_submissions (
    id SERIAL PRIMARY KEY,
    homework_id INTEGER REFERENCES public.homework(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    submission_status TEXT DEFAULT 'pending',
    submitted_at TIMESTAMP WITH TIME ZONE,
    submission_text TEXT,
    submission_files TEXT[],
    score NUMERIC,
    feedback TEXT,
    graded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    graded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(homework_id, student_id)
);

-- 8. Notes Compliance Tracking
CREATE TABLE IF NOT EXISTS public.notes_checks (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    teaching_assignment_id INTEGER REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    check_date DATE NOT NULL,
    topic TEXT NOT NULL,
    checked_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Notes Compliance Records
CREATE TABLE IF NOT EXISTS public.notes_compliance (
    id SERIAL PRIMARY KEY,
    notes_check_id INTEGER REFERENCES public.notes_checks(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'incomplete',
    notes TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(notes_check_id, student_id)
);

-- 10. WhatsApp Message Templates
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL,
    template_type TEXT NOT NULL,
    template_id TEXT,
    message_content TEXT NOT NULL,
    variables TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, template_name)
);

-- 11. WhatsApp Notifications Log
CREATE TABLE IF NOT EXISTS public.whatsapp_notifications (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    template_name TEXT,
    message_content TEXT,
    notification_type TEXT,
    reference_id INTEGER,
    status TEXT DEFAULT 'pending',
    termii_message_id TEXT,
    error_message TEXT,
    sent_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update lesson_plans table with new fields
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='published_at') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN published_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='published_by') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN published_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='publish_target') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN publish_target TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='smart_goals') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN smart_goals TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='sessions') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN sessions JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='grade_level') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN grade_level TEXT;
    END IF;
END $$;

-- Add whatsapp_settings to schools table
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='whatsapp_settings') THEN
        ALTER TABLE public.schools ADD COLUMN whatsapp_settings JSONB DEFAULT '{}';
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lesson_plan_coverage_lesson_id ON public.lesson_plan_coverage(lesson_plan_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plan_coverage_class_id ON public.lesson_plan_coverage(academic_class_id);
CREATE INDEX IF NOT EXISTS idx_learning_materials_lesson_id ON public.learning_materials(lesson_plan_id);
CREATE INDEX IF NOT EXISTS idx_learning_materials_published ON public.learning_materials(is_published) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_lesson_plan_reviews_plan_id ON public.lesson_plan_reviews(lesson_plan_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plan_reviews_status ON public.lesson_plan_reviews(review_status);
CREATE INDEX IF NOT EXISTS idx_homework_class_id ON public.homework(academic_class_id);
CREATE INDEX IF NOT EXISTS idx_homework_due_date ON public.homework(due_date);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_homework_id ON public.homework_submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student_id ON public.homework_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_notes_compliance_check_id ON public.notes_compliance(notes_check_id);
CREATE INDEX IF NOT EXISTS idx_notes_compliance_student_id ON public.notes_compliance(student_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_student_id ON public.whatsapp_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_status ON public.whatsapp_notifications(status);
CREATE INDEX IF NOT EXISTS idx_student_term_reports_scope ON public.student_term_reports(term_id, academic_class_id, student_id);
CREATE INDEX IF NOT EXISTS idx_score_entries_scope ON public.score_entries(term_id, academic_class_id, student_id, subject_name);
CREATE INDEX IF NOT EXISTS idx_students_campus_status ON public.students(campus_id, status);

NOTIFY pgrst, 'reload config';
`;

export default DATABASE_SCHEMA;
