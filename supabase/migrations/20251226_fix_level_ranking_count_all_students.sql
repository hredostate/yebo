-- Fix Level Ranking Count to Include All Enrolled Students
-- 
-- This migration fixes the issue where level_size was incorrectly counting only students
-- with score entries, excluding students without any scores. This caused the count to be
-- 134 instead of 167 for JSS 2 in the example case.
--
-- Changes:
-- 1. Use academic_class_students as the base for counting ALL enrolled students
-- 2. LEFT JOIN to score_entries for score computation (students without scores get 0)
-- 3. Ensure level_size and cohort_size reflect all enrolled students
--
-- This supersedes the ranking logic from 20251222_fix_ranking_discrepancy.sql

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

    -- 5. Cohort-level ranking with ALL ENROLLED STUDENTS (including those without scores)
    -- FIXED: Use academic_class_students as base to count all enrolled students
    WITH enrolled_students AS (
        -- Get ALL enrolled students for accurate count
        SELECT 
            acs.student_id,
            acs.academic_class_id,
            ac.arm,
            ac.level,
            s.campus_id,
            t.session_label,
            acs.enrolled_term_id as term_id,
            COALESCE(AVG(se.total_score), 0) as computed_average
        FROM public.academic_class_students acs
        JOIN public.academic_classes ac ON ac.id = acs.academic_class_id
        JOIN public.students s ON s.id = acs.student_id
        JOIN public.terms t ON t.id = acs.enrolled_term_id
        LEFT JOIN public.score_entries se ON se.student_id = acs.student_id 
            AND se.term_id = acs.enrolled_term_id
            AND se.academic_class_id = acs.academic_class_id
        WHERE acs.enrolled_term_id = p_term_id
          AND COALESCE(s.status, 'Active') NOT IN ('Withdrawn', 'Graduated', 'Expelled', 'Inactive')
        GROUP BY acs.student_id, acs.academic_class_id, ac.arm, ac.level, s.campus_id, t.session_label, acs.enrolled_term_id
    ),
    cohort AS (
        SELECT
            es.student_id,
            DENSE_RANK() OVER (
                PARTITION BY es.campus_id, es.session_label, es.term_id, es.academic_class_id, es.arm
                ORDER BY es.computed_average DESC
            ) AS cohort_rank,
            COUNT(*) OVER (
                PARTITION BY es.campus_id, es.session_label, es.term_id, es.academic_class_id, es.arm
            ) AS cohort_size,
            DENSE_RANK() OVER (
                PARTITION BY es.campus_id, es.session_label, es.term_id, es.level
                ORDER BY es.computed_average DESC
            ) AS level_rank,
            COUNT(*) OVER (
                PARTITION BY es.campus_id, es.session_label, es.term_id, es.level
            ) AS level_size,
            DENSE_RANK() OVER (
                PARTITION BY es.campus_id, es.session_label, es.term_id
                ORDER BY es.computed_average DESC
            ) AS campus_rank,
            COUNT(*) OVER (
                PARTITION BY es.campus_id, es.session_label, es.term_id
            ) AS campus_total
        FROM enrolled_students es
        WHERE es.term_id = p_term_id
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
    -- Note: We use LEFT JOIN LATERAL instead of calling compute_grade() function
    -- because it's more efficient to do a single join per subject rather than
    -- a function call. The logic is similar to compute_grade but optimized for batch processing.
    SELECT jsonb_agg(subj_data)
    INTO v_subjects
    FROM (
        SELECT jsonb_build_object(
            'subject_id', se.subject_id,
            'subject_name', subj.name,
            'ca_score', se.ca_score,
            'exam_score', se.exam_score,
            'total_score', se.total_score,
            'grade', grade_info.grade,
            'remark', grade_info.remark,
            'subject_position', se.subject_position,
            'highest_score_in_subject', se.highest_score_in_subject,
            'lowest_score_in_subject', se.lowest_score_in_subject,
            'subject_average', se.subject_average,
            'teacher_comment', se.teacher_comment
        ) AS subj_data
        FROM public.score_entries se
        LEFT JOIN public.subjects subj ON subj.id = se.subject_id
        -- Dynamic grade computation from grading_scheme_rules
        LEFT JOIN LATERAL (
            SELECT 
                gsr.grade,
                gsr.remark
            FROM public.grading_scheme_rules gsr
            WHERE gsr.grading_scheme_id = v_grading_scheme_id
              AND se.total_score >= gsr.min_score
              AND se.total_score <= gsr.max_score
            ORDER BY gsr.min_score DESC
            LIMIT 1
        ) AS grade_info ON true
        WHERE se.student_id = p_student_id AND se.term_id = p_term_id
        ORDER BY subj.name
    ) subj;

    -- 7. Attendance from both computed daily and override sources
    -- Attempt to find override first
    SELECT * INTO v_override
    FROM public.attendance_overrides
    WHERE student_id = p_student_id
      AND term_id = p_term_id
    LIMIT 1;

    IF v_override.id IS NOT NULL THEN
        v_override_found := true;
        v_present_str := v_override.present_days;
        v_absent_str := v_override.absent_days;
        v_attendance_source := 'override';
    END IF;

    -- Compute from daily attendance
    SELECT class_group_id INTO v_class_group_id
    FROM public.academic_class_students acs
    WHERE acs.student_id = p_student_id AND acs.enrolled_term_id = p_term_id
    LIMIT 1;

    -- Count attendance records in the term's date range
    SELECT
        COUNT(*) FILTER (WHERE a.status = 'Present') AS present,
        COUNT(*) FILTER (WHERE a.status = 'Absent') AS absent,
        COUNT(*) FILTER (WHERE a.status = 'Late') AS late,
        COUNT(*) FILTER (WHERE a.status = 'Excused') AS excused,
        COUNT(*) FILTER (WHERE a.status IN ('Absent', 'Excused')) AS unexcused_like,
        COUNT(*) AS total
    INTO v_present_computed, v_absent_computed, v_late_computed, v_excused_computed, v_unexcused_computed, v_total_computed
    FROM public.attendance a
    WHERE a.student_id = p_student_id
      AND a.date BETWEEN v_term_start AND v_term_end;

    -- If no override was found, use computed values for STR
    IF NOT v_override_found THEN
        v_present_str := v_present_computed;
        v_absent_str := v_absent_computed;
        v_attendance_source := 'computed';
    END IF;

    -- Build structured attendance for backward compatibility
    v_attendance := jsonb_build_object(
        'present', COALESCE(v_present_str, 0),
        'absent', COALESCE(v_absent_str, 0),
        'attendanceRate', 
            CASE 
                WHEN (COALESCE(v_present_str, 0) + COALESCE(v_absent_str, 0)) > 0
                THEN ROUND(
                    (COALESCE(v_present_str, 0)::NUMERIC / 
                     (COALESCE(v_present_str, 0) + COALESCE(v_absent_str, 0))::NUMERIC) * 100, 
                    2
                )
                ELSE NULL
            END,
        'source', v_attendance_source
    );

    -- Computed attendance (daily logs)
    v_computed_attendance := jsonb_build_object(
        'present', COALESCE(v_present_computed, 0),
        'absent', COALESCE(v_absent_computed, 0),
        'late', COALESCE(v_late_computed, 0),
        'excused', COALESCE(v_excused_computed, 0),
        'unexcused', COALESCE(v_unexcused_computed, 0),
        'total', COALESCE(v_total_computed, 0),
        'attendanceRate',
            CASE
                WHEN v_total_computed > 0
                THEN ROUND((v_present_computed::NUMERIC / v_total_computed::NUMERIC) * 100, 2)
                ELSE NULL
            END
    );

    -- 8. Build final JSONB
    RETURN jsonb_build_object(
        'student', v_student,
        'term', v_term,
        'config', v_school_config,
        'subjects', COALESCE(v_subjects, '[]'::jsonb),
        'report', CASE WHEN v_report_row.id IS NOT NULL THEN row_to_json(v_report_row)::jsonb ELSE '{}'::jsonb END,
        'attendance', v_attendance,
        'computedAttendance', v_computed_attendance,
        'ranking', jsonb_build_object(
            'positionInArm', v_cohort_rank,
            'totalInArm', v_cohort_size,
            'positionInLevel', v_level_rank,
            'totalInLevel', v_level_size,
            'campusPercentile', v_campus_percentile
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_student_term_report_details IS 
'Fetches comprehensive student report details including dynamic rankings from ALL enrolled students (including those without scores), computed grades, and attendance. Updated to fix level_size count by including students without score entries.';
