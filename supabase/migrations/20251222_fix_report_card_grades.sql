-- Fix Report Card Stale Grades Issue
-- This migration ensures grades on report cards are computed dynamically from grading schemes
-- instead of reading stale stored values from score_entries.grade_label

-- ============================================================================
-- 1. Ensure compute_grade function exists (Single Source of Truth for grades)
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
    SELECT grade_label, remark, NULL::NUMERIC
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
-- 2. Update get_student_term_report_details to compute grades dynamically
-- ============================================================================
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
    v_level_rank INTEGER;
    v_level_size INTEGER;
    v_campus_percentile NUMERIC;
    v_present_str INTEGER;
    v_absent_str INTEGER;
    v_grading_scheme_id INTEGER;
BEGIN
    -- 1. Student Info scoped with campus/class/arm/level for cohort filters
    SELECT jsonb_build_object(
        'id', s.id,
        'fullName', s.name,
        'className', ac.name,
        'classId', ac.id,
        'armName', ac.arm,
        'arm_name', ac.arm,
        'levelName', ac.level,
        'level_name', ac.level,
        'level', ac.level,
        'campusId', s.campus_id
    )
    INTO v_student
    FROM public.students s
    LEFT JOIN public.academic_class_students acs ON acs.student_id = s.id AND acs.enrolled_term_id = p_term_id
    LEFT JOIN public.academic_classes ac ON ac.id = acs.academic_class_id
    WHERE s.id = p_student_id;

    -- 2. Term Info with date range
    SELECT jsonb_build_object('sessionLabel', session_label, 'termLabel', term_label, 'session_label', session_label, 'term_label', term_label),
           start_date, end_date
    INTO v_term, v_term_start, v_term_end
    FROM public.terms WHERE id = p_term_id;

    -- 3. Config
    SELECT to_jsonb(sc.*) INTO v_school_config
    FROM public.school_config sc LIMIT 1;

    -- 4. Report Meta
    SELECT * INTO v_report_row
    FROM public.student_term_reports
    WHERE student_id = p_student_id AND term_id = p_term_id;

    -- 5. Get the grading scheme for this student's class (class-specific or school-wide)
    SELECT COALESCE(ac.grading_scheme_id, sc.active_grading_scheme_id)
    INTO v_grading_scheme_id
    FROM public.academic_class_students acs
    LEFT JOIN public.academic_classes ac ON ac.id = acs.academic_class_id
    CROSS JOIN public.school_config sc
    WHERE acs.student_id = p_student_id
      AND acs.enrolled_term_id = p_term_id
    LIMIT 1;

    -- 6. Cohort-level ranking (campus + session + term + class + arm) and Level-wide ranking
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
                PARTITION BY s.campus_id, t.session_label, str.term_id, ac.level
                ORDER BY COALESCE(str.average_score, 0) DESC
            ) AS level_rank,
            COUNT(*) OVER (
                PARTITION BY s.campus_id, t.session_label, str.term_id, ac.level
            ) AS level_size,
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
        c.level_rank,
        c.level_size,
        CASE WHEN c.campus_total > 0 THEN ROUND(((c.campus_total - c.campus_rank)::NUMERIC / c.campus_total::NUMERIC) * 100, 2) ELSE NULL END
    INTO v_cohort_rank, v_cohort_size, v_level_rank, v_level_size, v_campus_percentile
    FROM cohort c
    WHERE c.student_id = p_student_id
    LIMIT 1;

    -- 7. Subjects (from score_entries) with DYNAMICALLY COMPUTED grades
    -- This is the key fix: instead of reading stored grade_label, compute it from grading scheme
    SELECT jsonb_agg(jsonb_build_object(
        'subjectName', se.subject_name,
        'subject_name', se.subject_name,
        'componentScores', COALESCE(se.component_scores, '{}'::jsonb),
        'component_scores', COALESCE(se.component_scores, '{}'::jsonb),
        'totalScore', se.total_score,
        'total_score', se.total_score,
        -- FIXED: Compute grade dynamically from grading scheme instead of using stored value
        'gradeLabel', CASE 
            WHEN v_grading_scheme_id IS NOT NULL AND se.total_score IS NOT NULL 
            THEN (public.compute_grade(se.total_score, v_grading_scheme_id, se.subject_name))->>'grade_label'
            ELSE COALESCE(se.grade, se.grade_label, '-')
        END,
        'grade', CASE 
            WHEN v_grading_scheme_id IS NOT NULL AND se.total_score IS NOT NULL 
            THEN (public.compute_grade(se.total_score, v_grading_scheme_id, se.subject_name))->>'grade_label'
            ELSE COALESCE(se.grade, se.grade_label, '-')
        END,
        'remark', CASE 
            WHEN v_grading_scheme_id IS NOT NULL AND se.total_score IS NOT NULL 
            THEN COALESCE(
                (public.compute_grade(se.total_score, v_grading_scheme_id, se.subject_name))->>'remark',
                se.teacher_comment,
                '-'
            )
            ELSE COALESCE(se.teacher_comment, '-')
        END,
        'subjectPosition', DENSE_RANK() OVER (
            PARTITION BY s.campus_id, t.session_label, se.term_id, se.academic_class_id, ac.arm, se.subject_name
            ORDER BY COALESCE(se.total_score, 0) DESC
        ),
        'subject_position', DENSE_RANK() OVER (
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

    -- 8. Identify the student's class group for this term (class teacher groups take precedence)
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

    -- 9. Calculate real attendance from attendance_records
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

    -- 10. Apply overrides when present for this class/term/student
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
        v_total_count := v_total_computed;
        v_attendance_source := 'computed';
    END IF;

    -- 11. FALLBACK: If computed attendance is zero, try student_term_reports for manual entry
    IF v_total_count = 0 THEN
        SELECT days_present, days_absent
        INTO v_present_str, v_absent_str
        FROM public.student_term_reports
        WHERE student_id = p_student_id AND term_id = p_term_id;
        
        v_present_count := COALESCE(v_present_str, 0);
        v_absent_count := COALESCE(v_absent_str, 0);
        v_total_count := v_present_count + v_absent_count;
        
        IF v_total_count > 0 THEN
            v_attendance_source := 'manual_entry';
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

    RETURN jsonb_build_object(
        'student', v_student,
        'term', v_term,
        'schoolConfig', v_school_config,
        'subjects', COALESCE(v_subjects, '[]'::jsonb),
        'summary', jsonb_build_object(
            'average', v_report_row.average_score,
            'positionInArm', COALESCE(v_cohort_rank, v_report_row.position_in_class),
            'position_in_arm', COALESCE(v_cohort_rank, v_report_row.position_in_class),
            'position_in_class', COALESCE(v_cohort_rank, v_report_row.position_in_class),
            'cohortSize', v_cohort_size,
            'totalStudentsInArm', v_cohort_size,
            'total_students_in_arm', v_cohort_size,
            'total_in_arm', v_cohort_size,
            'positionInLevel', v_level_rank,
            'position_in_level', v_level_rank,
            'position_in_grade', v_level_rank,
            'gradeLevelPosition', v_level_rank,
            'levelSize', v_level_size,
            'totalStudentsInLevel', v_level_size,
            'total_students_in_level', v_level_size,
            'total_in_level', v_level_size,
            'gradeLevelSize', v_level_size,
            'campusPercentile', v_campus_percentile,
            'campus_percentile', v_campus_percentile,
            'gpaAverage', 0,
            'gpa_average', 0
        ),
        'attendance', v_attendance,
        'comments', jsonb_build_object(
            'teacher', v_report_row.teacher_comment,
            'teacher_comment', v_report_row.teacher_comment,
            'principal', v_report_row.principal_comment,
            'principal_comment', v_report_row.principal_comment
        )
    );
END;
$$ LANGUAGE plpgsql;
