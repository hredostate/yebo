-- Migration: Add recalculate_all_grades RPC function
-- This function recalculates all grades when a grading scheme changes

-- ============================================================================
-- RPC Function: Recalculate All Grades for a Grading Scheme
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_all_grades(
    p_grading_scheme_id INTEGER,
    p_term_id INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_entry RECORD;
    v_grade_data JSONB;
BEGIN
    -- Update grade_label and remark for all score_entries using this grading scheme
    FOR v_entry IN 
        SELECT se.id, se.total_score, se.subject_name
        FROM public.score_entries se
        JOIN public.academic_classes ac ON se.academic_class_id = ac.id
        WHERE (ac.grading_scheme_id = p_grading_scheme_id 
               OR (ac.grading_scheme_id IS NULL AND EXISTS (
                   SELECT 1 FROM public.school_config sc 
                   WHERE sc.active_grading_scheme_id = p_grading_scheme_id
               )))
          AND (p_term_id IS NULL OR se.term_id = p_term_id)
    LOOP
        -- Compute the grade using the single source of truth function
        v_grade_data := public.compute_grade(
            v_entry.total_score, 
            p_grading_scheme_id, 
            v_entry.subject_name
        );
        
        -- Update the score entry with the new grade
        UPDATE public.score_entries
        SET 
            grade_label = v_grade_data->>'grade_label',
            remark = v_grade_data->>'remark'
        WHERE id = v_entry.id;
        
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'updated_count', v_updated_count,
        'grading_scheme_id', p_grading_scheme_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.recalculate_all_grades TO authenticated;

COMMENT ON FUNCTION public.recalculate_all_grades IS 
'Recalculates all grades for score entries using a specific grading scheme. 
Optionally filters by term_id. Returns count of updated entries.';
