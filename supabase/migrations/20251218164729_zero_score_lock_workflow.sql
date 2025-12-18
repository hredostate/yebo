-- Migration: Zero Score Lock Workflow
-- Implements comprehensive detection and handling of students with zero total scores during assignment lock

-- =====================================================
-- Function 1: Detect Zero Total Scores
-- =====================================================
-- Detects students with total_score = 0 or NULL for a specific teaching assignment
-- CRITICAL: Only checks total_score, NOT component scores
CREATE OR REPLACE FUNCTION public.detect_zero_total_scores(
    p_assignment_id INTEGER
)
RETURNS TABLE (
    student_id INTEGER,
    student_name TEXT,
    admission_number TEXT,
    total_score NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_term_id INTEGER;
    v_class_id INTEGER;
    v_subject_name TEXT;
BEGIN
    -- Get assignment details
    SELECT term_id, academic_class_id, subject_name
    INTO v_term_id, v_class_id, v_subject_name
    FROM public.teaching_assignments
    WHERE id = p_assignment_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teaching assignment not found: %', p_assignment_id;
    END IF;
    
    -- Return students with zero or NULL total scores
    RETURN QUERY
    SELECT 
        se.student_id,
        s.name,
        s.admission_number,
        se.total_score
    FROM public.score_entries se
    INNER JOIN public.students s ON se.student_id = s.id
    WHERE se.term_id = v_term_id
      AND se.academic_class_id = v_class_id
      AND se.subject_name = v_subject_name
      AND (se.total_score = 0 OR se.total_score IS NULL)
    ORDER BY s.name;
END;
$$;

-- =====================================================
-- Function 2: Unenroll Zero Score Students
-- =====================================================
-- Performs comprehensive unenrollment of students with zero total scores
CREATE OR REPLACE FUNCTION public.unenroll_zero_score_students(
    p_assignment_id INTEGER,
    p_student_ids INTEGER[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_term_id INTEGER;
    v_class_id INTEGER;
    v_subject_name TEXT;
    v_school_id INTEGER;
    v_subject_id INTEGER;
    v_deleted_scores INTEGER := 0;
    v_updated_enrollments INTEGER := 0;
    v_deleted_zero_entries INTEGER := 0;
    v_student_id INTEGER;
    v_level TEXT;
    v_session_label TEXT;
BEGIN
    -- Get assignment details
    SELECT ta.term_id, ta.academic_class_id, ta.subject_name, ta.school_id
    INTO v_term_id, v_class_id, v_subject_name, v_school_id
    FROM public.teaching_assignments ta
    WHERE ta.id = p_assignment_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Teaching assignment not found: %', p_assignment_id;
    END IF;
    
    -- Get subject_id
    SELECT id INTO v_subject_id
    FROM public.subjects
    WHERE name = v_subject_name AND school_id = v_school_id
    LIMIT 1;
    
    -- Get class level and session
    SELECT level, session_label INTO v_level, v_session_label
    FROM public.academic_classes
    WHERE id = v_class_id;
    
    -- Process each student
    FOREACH v_student_id IN ARRAY p_student_ids
    LOOP
        -- 1. Delete score entry
        DELETE FROM public.score_entries
        WHERE student_id = v_student_id
          AND subject_name = v_subject_name
          AND term_id = v_term_id
          AND academic_class_id = v_class_id;
        
        GET DIAGNOSTICS v_deleted_scores = ROW_COUNT;
        
        -- 2. Update subject enrollment (if exists)
        IF v_subject_id IS NOT NULL THEN
            UPDATE public.student_subject_enrollments
            SET is_enrolled = false, updated_at = NOW()
            WHERE student_id = v_student_id
              AND term_id = v_term_id
              AND academic_class_id = v_class_id
              AND subject_id = v_subject_id;
            
            GET DIAGNOSTICS v_updated_enrollments = ROW_COUNT;
        END IF;
        
        -- 3. Remove from zero_score_entries (cleanup)
        DELETE FROM public.zero_score_entries
        WHERE student_id = v_student_id
          AND subject_name = v_subject_name
          AND term_id = v_term_id
          AND academic_class_id = v_class_id;
        
        GET DIAGNOSTICS v_deleted_zero_entries = ROW_COUNT;
        
        -- 4. Recalculate student term report
        PERFORM public.recalculate_student_term_report(v_student_id, v_term_id, v_class_id);
    END LOOP;
    
    -- 5. Recalculate class rankings
    PERFORM public.recalculate_class_rankings(v_term_id, v_class_id);
    
    -- 6. Recalculate level rankings
    IF v_level IS NOT NULL AND v_session_label IS NOT NULL THEN
        PERFORM public.recalculate_level_rankings(v_term_id, v_level, v_session_label);
    END IF;
    
    -- Return summary
    RETURN json_build_object(
        'success', true,
        'students_processed', array_length(p_student_ids, 1),
        'scores_deleted', v_deleted_scores,
        'enrollments_updated', v_updated_enrollments,
        'zero_entries_deleted', v_deleted_zero_entries
    );
END;
$$;

-- =====================================================
-- Function 3: Recalculate Student Term Report
-- =====================================================
-- Recalculates average_score, total_score for a single student
CREATE OR REPLACE FUNCTION public.recalculate_student_term_report(
    p_student_id INTEGER,
    p_term_id INTEGER,
    p_academic_class_id INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_avg_score NUMERIC;
    v_total_score NUMERIC;
    v_subject_count INTEGER;
BEGIN
    -- Calculate new average and total from remaining scores
    SELECT 
        AVG(total_score),
        SUM(total_score),
        COUNT(*)
    INTO v_avg_score, v_total_score, v_subject_count
    FROM public.score_entries
    WHERE student_id = p_student_id 
      AND term_id = p_term_id
      AND academic_class_id = p_academic_class_id;
    
    -- Update or insert student_term_reports
    INSERT INTO public.student_term_reports (
        student_id,
        term_id,
        academic_class_id,
        average_score,
        total_score,
        position_in_class,
        position_in_grade,
        created_at
    ) VALUES (
        p_student_id,
        p_term_id,
        p_academic_class_id,
        COALESCE(v_avg_score, 0),
        COALESCE(v_total_score, 0),
        0, -- Will be updated by recalculate_class_rankings
        0, -- Will be updated by recalculate_level_rankings
        NOW()
    )
    ON CONFLICT (student_id, term_id)
    DO UPDATE SET
        average_score = COALESCE(v_avg_score, 0),
        total_score = COALESCE(v_total_score, 0),
        created_at = NOW();
    
    -- Delete from student_term_report_subjects for removed subject
    -- This is handled by the calling function which knows the subject name
END;
$$;

-- =====================================================
-- Function 4: Recalculate Class Rankings
-- =====================================================
-- Recalculates position_in_class for all students in a class
CREATE OR REPLACE FUNCTION public.recalculate_class_rankings(
    p_term_id INTEGER,
    p_academic_class_id INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Recalculate position_in_class for all students in the class
    WITH ranked AS (
        SELECT 
            id,
            DENSE_RANK() OVER (ORDER BY average_score DESC NULLS LAST) as new_position
        FROM public.student_term_reports
        WHERE term_id = p_term_id 
          AND academic_class_id = p_academic_class_id
    )
    UPDATE public.student_term_reports str
    SET position_in_class = ranked.new_position
    FROM ranked
    WHERE str.id = ranked.id;
END;
$$;

-- =====================================================
-- Function 5: Recalculate Level Rankings
-- =====================================================
-- Recalculates position_in_grade for all students in a level
CREATE OR REPLACE FUNCTION public.recalculate_level_rankings(
    p_term_id INTEGER,
    p_level TEXT,
    p_session_label TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Recalculate position_in_grade for all students in the level
    WITH level_students AS (
        SELECT str.id, str.average_score
        FROM public.student_term_reports str
        INNER JOIN public.academic_class_students acs ON str.student_id = acs.student_id
        INNER JOIN public.academic_classes ac ON acs.academic_class_id = ac.id
        WHERE str.term_id = p_term_id
          AND ac.level = p_level
          AND ac.session_label = p_session_label
    ),
    ranked AS (
        SELECT 
            id, 
            DENSE_RANK() OVER (ORDER BY average_score DESC NULLS LAST) as new_position
        FROM level_students
    )
    UPDATE public.student_term_reports str
    SET position_in_grade = ranked.new_position
    FROM ranked
    WHERE str.id = ranked.id;
END;
$$;

-- =====================================================
-- Permissions
-- =====================================================
-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.detect_zero_total_scores(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unenroll_zero_score_students(INTEGER, INTEGER[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_student_term_report(INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_class_rankings(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_level_rankings(INTEGER, TEXT, TEXT) TO authenticated;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON FUNCTION public.detect_zero_total_scores IS 'Detects students with total_score = 0 or NULL for a specific teaching assignment. Only checks total_score, not component scores.';
COMMENT ON FUNCTION public.unenroll_zero_score_students IS 'Performs comprehensive unenrollment of students with zero total scores including score deletion, enrollment updates, and ranking recalculation.';
COMMENT ON FUNCTION public.recalculate_student_term_report IS 'Recalculates average_score and total_score for a single student based on remaining score entries.';
COMMENT ON FUNCTION public.recalculate_class_rankings IS 'Recalculates position_in_class for all students in a specific class and term.';
COMMENT ON FUNCTION public.recalculate_level_rankings IS 'Recalculates position_in_grade for all students in a specific level (grade) and session.';
