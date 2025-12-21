-- Fix Ranking Discrepancy: Compute rankings dynamically from score_entries
-- This migration updates get_student_term_report_details to compute rankings
-- from fresh score_entries averages instead of using stale student_term_reports.average_score
-- 
-- This migration supersedes and includes the grade computation fix from 20251222_fix_dynamic_grade_computation.sql
-- It applies BOTH fixes:
-- 1. Rankings computed from score_entries averages (NEW)
-- 2. Grades computed from grading_scheme_rules (from previous migration)

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

    -- 4b. Get grading scheme ID for dynamic grade computation
    SELECT COALESCE(ac.grading_scheme_id, sc.active_grading_scheme_id)
    INTO v_grading_scheme_id
    FROM public.academic_class_students acs
    JOIN public.academic_classes ac ON ac.id = acs.academic_class_id
    CROSS JOIN public.school_config sc
    WHERE acs.student_id = p_student_id
      AND acs.enrolled_term_id = p_term_id
    LIMIT 1;

    -- 5. Cohort-level ranking with DYNAMIC AVERAGES from score_entries
    WITH student_averages AS (
        -- Compute average score for each student from their score_entries
        SELECT 
            se.student_id,
            se.term_id,
            se.academic_class_id,
            AVG(se.total_score) as computed_average
        FROM public.score_entries se
        WHERE se.term_id = p_term_id
        GROUP BY se.student_id, se.term_id, se.academic_class_id
    ),
    cohort AS (
        SELECT
            sa.student_id,
            DENSE_RANK() OVER (
                PARTITION BY s.campus_id, t.session_label, sa.term_id, sa.academic_class_id, ac.arm
                ORDER BY COALESCE(sa.computed_average, 0) DESC
            ) AS cohort_rank,
            COUNT(*) OVER (
                PARTITION BY s.campus_id, t.session_label, sa.term_id, sa.academic_class_id, ac.arm
            ) AS cohort_size,
            DENSE_RANK() OVER (
                PARTITION BY s.campus_id, t.session_label, sa.term_id, ac.level
                ORDER BY COALESCE(sa.computed_average, 0) DESC
            ) AS level_rank,
            COUNT(*) OVER (
                PARTITION BY s.campus_id, t.session_label, sa.term_id, ac.level
            ) AS level_size,
            DENSE_RANK() OVER (
                PARTITION BY s.campus_id, t.session_label, sa.term_id
                ORDER BY COALESCE(sa.computed_average, 0) DESC
            ) AS campus_rank,
            COUNT(*) OVER (
                PARTITION BY s.campus_id, t.session_label, sa.term_id
            ) AS campus_total
        FROM student_averages sa
        JOIN public.students s ON sa.student_id = s.id
        JOIN public.terms t ON t.id = sa.term_id
        LEFT JOIN public.academic_classes ac ON ac.id = sa.academic_class_id
        WHERE sa.term_id = p_term_id
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

    -- 6. Subjects with DYNAMICALLY COMPUTED grades from grading_scheme_rules
    SELECT jsonb_agg(subj_data)
    INTO v_subjects
    FROM (
        SELECT jsonb_build_object(
            'subjectName', se.subject_name,
            'subject_name', se.subject_name,
            'componentScores', COALESCE(se.component_scores, '{}'::jsonb),
            'component_scores', COALESCE(se.component_scores, '{}'::jsonb),
            'totalScore', se.total_score,
            'total_score', se.total_score,
            'gradeLabel', COALESCE(gsr.grade_label, 'F'),
            'grade', COALESCE(gsr.grade_label, 'F'),
            'remark', COALESCE(gsr.remark, se.remark, '-'),
            'subjectPosition', subject_rank,
            'subject_position', subject_rank
        ) AS subj_data
        FROM (
            SELECT 
                se.*,
                DENSE_RANK() OVER (
                    PARTITION BY se.academic_class_id, se.subject_name
                    ORDER BY se.total_score DESC
                ) as subject_rank
            FROM public.score_entries se
            JOIN public.students s ON s.id = se.student_id
            WHERE se.term_id = p_term_id
              AND COALESCE(s.status, 'Active') NOT IN ('Withdrawn', 'Graduated', 'Expelled', 'Inactive')
        ) se
        LEFT JOIN LATERAL (
            SELECT grade_label, remark
            FROM public.grading_scheme_rules gsr
            WHERE gsr.grading_scheme_id = v_grading_scheme_id
              AND se.total_score >= gsr.min_score
              AND se.total_score <= gsr.max_score
            ORDER BY gsr.min_score DESC
            LIMIT 1
        ) gsr ON true
        WHERE se.student_id = p_student_id
    ) subquery;

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

    -- 10. FALLBACK: If computed attendance is zero, try student_term_reports for manual entry
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

-- Add comment explaining the fix
COMMENT ON FUNCTION public.get_student_term_report_details IS 
'Returns student term report details with:
1. Rankings computed dynamically from score_entries averages (not stale student_term_reports.average_score)
2. Grades computed dynamically from grading_scheme_rules table (reflects current grading scheme)
This ensures report cards always match Result Manager statistics and reflect the current grading scheme.
Fixed in migration 20251222 to address ranking and grade discrepancies.';
