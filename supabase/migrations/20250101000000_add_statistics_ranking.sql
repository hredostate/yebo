-- =====================================================
-- Statistics and Ranking Enhancement
-- =====================================================
-- This migration adds support for server-side ranking calculations
-- and comprehensive statistics RPC functions for the Report Card Manager.

-- =====================================================
-- 1. Ranking Configuration Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ranking_config (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    tie_method TEXT NOT NULL DEFAULT 'dense' CHECK (tie_method IN ('dense', 'competition')),
    missing_subject_policy TEXT NOT NULL DEFAULT 'exclude' CHECK (missing_subject_policy IN ('exclude', 'zero')),
    min_subjects_for_ranking INTEGER DEFAULT 3,
    pass_threshold NUMERIC DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id)
);

-- Add RLS policies for ranking_config
ALTER TABLE public.ranking_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ranking config for their school"
    ON public.ranking_config
    FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage ranking config for their school"
    ON public.ranking_config
    FOR ALL
    USING (
        school_id IN (
            SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
            AND role IN ('Admin', 'Principal')
        )
    );

-- =====================================================
-- 2. Calculate Level Rankings RPC Function
-- =====================================================
-- Returns ranked students within a specific level (e.g., JSS 1)
-- Filters by term, level, and optionally campus/session
CREATE OR REPLACE FUNCTION public.calculate_level_rankings(
    p_school_id INTEGER,
    p_term_id INTEGER,
    p_level TEXT,
    p_session_label TEXT DEFAULT NULL,
    p_campus_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
    student_id INTEGER,
    name TEXT,
    admission_number TEXT,
    arm TEXT,
    total_score NUMERIC,
    average_score NUMERIC,
    subjects_count INTEGER,
    level_rank INTEGER,
    level_percentile NUMERIC,
    is_ranked BOOLEAN,
    rank_reason TEXT,
    grade_counts JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_config RECORD;
    v_grading_scheme_id INTEGER;
BEGIN
    -- Get ranking configuration
    SELECT * INTO v_config
    FROM public.ranking_config
    WHERE school_id = p_school_id
    LIMIT 1;
    
    -- Use defaults if no config exists
    IF v_config IS NULL THEN
        v_config := ROW(NULL, p_school_id, 'dense', 'exclude', 3, 50, NOW(), NOW());
    END IF;
    
    -- Get the active grading scheme for the school
    SELECT active_grading_scheme_id INTO v_grading_scheme_id
    FROM public.school_config
    WHERE school_id = p_school_id;
    
    RETURN QUERY
    WITH level_classes AS (
        -- Get all classes for the specified level
        SELECT ac.id, ac.arm, ac.session_label, ac.campus_id
        FROM public.academic_classes ac
        WHERE ac.school_id = p_school_id
            AND ac.level = p_level
            AND ac.is_active = true
            AND (p_session_label IS NULL OR ac.session_label = p_session_label)
    ),
    student_scores AS (
        -- Get student scores for the level
        SELECT 
            s.id as student_id,
            s.name,
            s.admission_number,
            ac.arm,
            COUNT(se.id) as subjects_count,
            SUM(se.total_score) as total_score,
            AVG(se.total_score) as average_score,
            -- Calculate grade distribution
            jsonb_object_agg(
                gsr.grade_label,
                (SELECT COUNT(*) FROM public.score_entries se2 
                 WHERE se2.student_id = s.id 
                   AND se2.term_id = p_term_id
                   AND se2.total_score >= gsr.min_score 
                   AND se2.total_score <= gsr.max_score)
            ) FILTER (WHERE gsr.grade_label IS NOT NULL) as grade_counts
        FROM public.students s
        INNER JOIN public.academic_class_students acs ON s.id = acs.student_id
        INNER JOIN level_classes ac ON acs.academic_class_id = ac.id
        LEFT JOIN public.score_entries se ON s.id = se.student_id 
            AND se.term_id = p_term_id 
            AND se.academic_class_id = ac.id
        LEFT JOIN public.grading_scheme_rules gsr ON gsr.grading_scheme_id = v_grading_scheme_id
        WHERE s.school_id = p_school_id
            AND acs.enrolled_term_id = p_term_id
            AND s.status NOT IN ('Withdrawn', 'Graduated', 'Expelled', 'Inactive')
            AND (p_campus_id IS NULL OR s.campus_id = p_campus_id)
        GROUP BY s.id, s.name, s.admission_number, ac.arm
    ),
    ranked_students AS (
        -- Apply ranking
        SELECT 
            ss.*,
            CASE 
                WHEN ss.subjects_count >= COALESCE(v_config.min_subjects_for_ranking, 3) THEN
                    CASE v_config.tie_method
                        WHEN 'dense' THEN DENSE_RANK() OVER (ORDER BY ss.average_score DESC NULLS LAST)
                        ELSE RANK() OVER (ORDER BY ss.average_score DESC NULLS LAST)
                    END
                ELSE NULL
            END as rank,
            CASE 
                WHEN ss.subjects_count >= COALESCE(v_config.min_subjects_for_ranking, 3) THEN true
                ELSE false
            END as is_ranked,
            CASE 
                WHEN ss.subjects_count < COALESCE(v_config.min_subjects_for_ranking, 3) THEN 
                    'Insufficient subjects for ranking (minimum ' || COALESCE(v_config.min_subjects_for_ranking, 3) || ' required)'
                ELSE NULL
            END as rank_reason
        FROM student_scores ss
    )
    SELECT 
        rs.student_id,
        rs.name,
        rs.admission_number,
        rs.arm,
        rs.total_score,
        rs.average_score,
        rs.subjects_count,
        rs.rank::INTEGER as level_rank,
        CASE 
            WHEN rs.rank IS NOT NULL THEN
                ROUND(((COUNT(*) OVER () - rs.rank) * 100.0 / NULLIF(COUNT(*) OVER (), 0)), 2)
            ELSE NULL
        END as level_percentile,
        rs.is_ranked,
        rs.rank_reason,
        COALESCE(rs.grade_counts, '{}'::JSONB) as grade_counts
    FROM ranked_students rs
    ORDER BY rs.rank NULLS LAST, rs.average_score DESC;
END;
$$;

-- =====================================================
-- 3. Calculate Arm Rankings RPC Function
-- =====================================================
-- Returns ranked students within a specific arm (class)
CREATE OR REPLACE FUNCTION public.calculate_arm_rankings(
    p_school_id INTEGER,
    p_term_id INTEGER,
    p_academic_class_id INTEGER
)
RETURNS TABLE (
    student_id INTEGER,
    name TEXT,
    admission_number TEXT,
    average_score NUMERIC,
    arm_rank INTEGER,
    arm_percentile NUMERIC,
    subject_scores JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH student_scores AS (
        -- Get student scores for the specific arm
        SELECT 
            s.id as student_id,
            s.name,
            s.admission_number,
            AVG(se.total_score) as average_score,
            jsonb_object_agg(se.subject_name, se.total_score) as subject_scores
        FROM public.students s
        INNER JOIN public.academic_class_students acs ON s.id = acs.student_id
        LEFT JOIN public.score_entries se ON s.id = se.student_id 
            AND se.term_id = p_term_id 
            AND se.academic_class_id = p_academic_class_id
        WHERE s.school_id = p_school_id
            AND acs.academic_class_id = p_academic_class_id
            AND acs.enrolled_term_id = p_term_id
            AND s.status NOT IN ('Withdrawn', 'Graduated', 'Expelled', 'Inactive')
        GROUP BY s.id, s.name, s.admission_number
    ),
    ranked_students AS (
        SELECT 
            ss.*,
            DENSE_RANK() OVER (ORDER BY ss.average_score DESC NULLS LAST) as rank
        FROM student_scores ss
    )
    SELECT 
        rs.student_id,
        rs.name,
        rs.admission_number,
        rs.average_score,
        rs.rank::INTEGER as arm_rank,
        ROUND(((COUNT(*) OVER () - rs.rank) * 100.0 / NULLIF(COUNT(*) OVER (), 0)), 2) as arm_percentile,
        COALESCE(rs.subject_scores, '{}'::JSONB) as subject_scores
    FROM ranked_students rs
    ORDER BY rs.rank, rs.average_score DESC;
END;
$$;

-- =====================================================
-- 4. Get Level Statistics RPC Function
-- =====================================================
-- Returns comprehensive statistics for a level
CREATE OR REPLACE FUNCTION public.get_level_statistics(
    p_school_id INTEGER,
    p_term_id INTEGER,
    p_level TEXT,
    p_session_label TEXT DEFAULT NULL,
    p_campus_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
    -- Enrollment stats
    total_enrolled INTEGER,
    students_with_scores INTEGER,
    students_complete INTEGER,
    students_incomplete INTEGER,
    
    -- Score statistics
    mean_score NUMERIC,
    median_score NUMERIC,
    min_score NUMERIC,
    max_score NUMERIC,
    std_dev NUMERIC,
    pass_count INTEGER,
    pass_rate NUMERIC,
    
    -- Grade distribution
    grade_distribution JSONB,
    
    -- Subject analytics
    subject_analytics JSONB,
    
    -- Top/Bottom performers
    top_10_students JSONB,
    bottom_10_students JSONB,
    
    -- Arm comparison
    arm_comparison JSONB,
    
    -- Insights
    hardest_subject TEXT,
    easiest_subject TEXT,
    highest_fail_rate_subject TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pass_threshold NUMERIC;
    v_grading_scheme_id INTEGER;
    v_result RECORD;
BEGIN
    -- Get pass threshold from config
    SELECT pass_threshold INTO v_pass_threshold
    FROM public.ranking_config
    WHERE school_id = p_school_id;
    
    v_pass_threshold := COALESCE(v_pass_threshold, 50);
    
    -- Get active grading scheme
    SELECT active_grading_scheme_id INTO v_grading_scheme_id
    FROM public.school_config
    WHERE school_id = p_school_id;
    
    -- Build the statistics
    SELECT 
        -- Enrollment stats
        COUNT(DISTINCT acs.student_id)::INTEGER,
        COUNT(DISTINCT se.student_id)::INTEGER,
        COUNT(DISTINCT CASE WHEN subj_count.cnt >= 3 THEN acs.student_id END)::INTEGER,
        COUNT(DISTINCT CASE WHEN subj_count.cnt < 3 THEN acs.student_id END)::INTEGER,
        
        -- Score statistics
        ROUND(AVG(se.total_score), 2),
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY se.total_score),
        MIN(se.total_score),
        MAX(se.total_score),
        ROUND(STDDEV(se.total_score), 2),
        COUNT(DISTINCT CASE WHEN se.total_score >= v_pass_threshold THEN se.student_id END)::INTEGER,
        ROUND((COUNT(DISTINCT CASE WHEN se.total_score >= v_pass_threshold THEN se.student_id END)::NUMERIC / 
               NULLIF(COUNT(DISTINCT se.student_id), 0) * 100), 2),
        
        -- Grade distribution
        (SELECT jsonb_agg(
            jsonb_build_object(
                'grade', gsr.grade_label,
                'count', COUNT(se2.id),
                'percentage', ROUND((COUNT(se2.id)::NUMERIC / NULLIF(total_scores.cnt, 0) * 100), 2)
            )
        )
        FROM public.grading_scheme_rules gsr
        CROSS JOIN (SELECT COUNT(*)::INTEGER as cnt FROM public.score_entries se3 
                    WHERE se3.term_id = p_term_id AND se3.school_id = p_school_id) total_scores
        LEFT JOIN public.score_entries se2 ON se2.total_score >= gsr.min_score 
            AND se2.total_score <= gsr.max_score
            AND se2.term_id = p_term_id
            AND se2.school_id = p_school_id
        WHERE gsr.grading_scheme_id = v_grading_scheme_id
        GROUP BY gsr.grade_label, gsr.min_score
        ORDER BY gsr.min_score DESC),
        
        -- Subject analytics
        (SELECT jsonb_agg(
            jsonb_build_object(
                'subject', subject_name,
                'avg_score', ROUND(avg_score, 2),
                'min_score', min_score,
                'max_score', max_score,
                'student_count', student_count,
                'fail_count', fail_count,
                'fail_rate', ROUND(fail_rate, 2)
            )
        )
        FROM (
            SELECT 
                se3.subject_name,
                AVG(se3.total_score) as avg_score,
                MIN(se3.total_score) as min_score,
                MAX(se3.total_score) as max_score,
                COUNT(DISTINCT se3.student_id)::INTEGER as student_count,
                COUNT(CASE WHEN se3.total_score < v_pass_threshold THEN 1 END)::INTEGER as fail_count,
                (COUNT(CASE WHEN se3.total_score < v_pass_threshold THEN 1 END)::NUMERIC / 
                 NULLIF(COUNT(*), 0) * 100) as fail_rate
            FROM public.score_entries se3
            INNER JOIN public.academic_classes ac ON se3.academic_class_id = ac.id
            WHERE se3.school_id = p_school_id
                AND se3.term_id = p_term_id
                AND ac.level = p_level
                AND (p_session_label IS NULL OR ac.session_label = p_session_label)
            GROUP BY se3.subject_name
            ORDER BY avg_score DESC
        ) subj_stats),
        
        -- Top 10 students
        (SELECT jsonb_agg(
            jsonb_build_object(
                'student_id', student_id,
                'name', name,
                'average', ROUND(avg_score, 2)
            )
        )
        FROM (
            SELECT s.id as student_id, s.name, AVG(se4.total_score) as avg_score
            FROM public.students s
            INNER JOIN public.score_entries se4 ON s.id = se4.student_id
            INNER JOIN public.academic_classes ac ON se4.academic_class_id = ac.id
            WHERE s.school_id = p_school_id
                AND se4.term_id = p_term_id
                AND ac.level = p_level
                AND (p_session_label IS NULL OR ac.session_label = p_session_label)
            GROUP BY s.id, s.name
            ORDER BY avg_score DESC
            LIMIT 10
        ) top_students),
        
        -- Bottom 10 students
        (SELECT jsonb_agg(
            jsonb_build_object(
                'student_id', student_id,
                'name', name,
                'average', ROUND(avg_score, 2)
            )
        )
        FROM (
            SELECT s.id as student_id, s.name, AVG(se5.total_score) as avg_score
            FROM public.students s
            INNER JOIN public.score_entries se5 ON s.id = se5.student_id
            INNER JOIN public.academic_classes ac ON se5.academic_class_id = ac.id
            WHERE s.school_id = p_school_id
                AND se5.term_id = p_term_id
                AND ac.level = p_level
                AND (p_session_label IS NULL OR ac.session_label = p_session_label)
            GROUP BY s.id, s.name
            ORDER BY avg_score ASC
            LIMIT 10
        ) bottom_students),
        
        -- Arm comparison
        (SELECT jsonb_agg(
            jsonb_build_object(
                'arm', arm,
                'student_count', student_count,
                'average', ROUND(avg_score, 2),
                'pass_rate', ROUND(pass_rate, 2)
            )
        )
        FROM (
            SELECT 
                ac.arm,
                COUNT(DISTINCT s.id)::INTEGER as student_count,
                AVG(se6.total_score) as avg_score,
                (COUNT(CASE WHEN se6.total_score >= v_pass_threshold THEN 1 END)::NUMERIC / 
                 NULLIF(COUNT(*), 0) * 100) as pass_rate
            FROM public.academic_classes ac
            LEFT JOIN public.score_entries se6 ON ac.id = se6.academic_class_id AND se6.term_id = p_term_id
            LEFT JOIN public.students s ON se6.student_id = s.id
            WHERE ac.school_id = p_school_id
                AND ac.level = p_level
                AND ac.is_active = true
                AND (p_session_label IS NULL OR ac.session_label = p_session_label)
            GROUP BY ac.arm
            ORDER BY avg_score DESC
        ) arm_stats),
        
        -- Insights - hardest subject
        (SELECT subject_name FROM (
            SELECT se7.subject_name, AVG(se7.total_score) as avg_score
            FROM public.score_entries se7
            INNER JOIN public.academic_classes ac ON se7.academic_class_id = ac.id
            WHERE se7.school_id = p_school_id
                AND se7.term_id = p_term_id
                AND ac.level = p_level
            GROUP BY se7.subject_name
            ORDER BY avg_score ASC
            LIMIT 1
        ) hardest),
        
        -- Insights - easiest subject
        (SELECT subject_name FROM (
            SELECT se8.subject_name, AVG(se8.total_score) as avg_score
            FROM public.score_entries se8
            INNER JOIN public.academic_classes ac ON se8.academic_class_id = ac.id
            WHERE se8.school_id = p_school_id
                AND se8.term_id = p_term_id
                AND ac.level = p_level
            GROUP BY se8.subject_name
            ORDER BY avg_score DESC
            LIMIT 1
        ) easiest),
        
        -- Insights - highest fail rate subject
        (SELECT subject_name FROM (
            SELECT 
                se9.subject_name,
                (COUNT(CASE WHEN se9.total_score < v_pass_threshold THEN 1 END)::NUMERIC / 
                 NULLIF(COUNT(*), 0) * 100) as fail_rate
            FROM public.score_entries se9
            INNER JOIN public.academic_classes ac ON se9.academic_class_id = ac.id
            WHERE se9.school_id = p_school_id
                AND se9.term_id = p_term_id
                AND ac.level = p_level
            GROUP BY se9.subject_name
            ORDER BY fail_rate DESC
            LIMIT 1
        ) highest_fail)
        
    INTO v_result
    FROM public.academic_class_students acs
    INNER JOIN public.academic_classes ac ON acs.academic_class_id = ac.id
    INNER JOIN public.students s ON acs.student_id = s.id
    LEFT JOIN public.score_entries se ON s.id = se.student_id 
        AND se.term_id = p_term_id 
        AND se.academic_class_id = ac.id
    LEFT JOIN (
        SELECT student_id, COUNT(*) as cnt
        FROM public.score_entries
        WHERE term_id = p_term_id AND school_id = p_school_id
        GROUP BY student_id
    ) subj_count ON s.id = subj_count.student_id
    WHERE acs.school_id = p_school_id
        AND acs.enrolled_term_id = p_term_id
        AND ac.level = p_level
        AND ac.is_active = true
        AND s.status NOT IN ('Withdrawn', 'Graduated', 'Expelled', 'Inactive')
        AND (p_session_label IS NULL OR ac.session_label = p_session_label)
        AND (p_campus_id IS NULL OR s.campus_id = p_campus_id);
    
    RETURN QUERY SELECT 
        v_result.count,
        v_result.count1,
        v_result.count2,
        v_result.count3,
        v_result.round,
        v_result.percentile_cont,
        v_result.min,
        v_result.max,
        v_result.round1,
        v_result.count4,
        v_result.round2,
        v_result.jsonb_agg,
        v_result.jsonb_agg1,
        v_result.jsonb_agg2,
        v_result.jsonb_agg3,
        v_result.jsonb_agg4,
        v_result.subject_name,
        v_result.subject_name1,
        v_result.subject_name2;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_level_rankings TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_arm_rankings TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_level_statistics TO authenticated;

-- Add comments
COMMENT ON TABLE public.ranking_config IS 'Stores school-specific ranking configuration for report card statistics';
COMMENT ON FUNCTION public.calculate_level_rankings IS 'Calculates and returns student rankings within a specific level (e.g., JSS 1)';
COMMENT ON FUNCTION public.calculate_arm_rankings IS 'Calculates and returns student rankings within a specific arm/class';
COMMENT ON FUNCTION public.get_level_statistics IS 'Returns comprehensive statistics for a level including enrollment, scores, grades, and subject analytics';
