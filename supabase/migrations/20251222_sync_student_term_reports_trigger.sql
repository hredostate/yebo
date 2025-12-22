-- ============================================================================
-- AUTO-SYNC STUDENT_TERM_REPORTS FROM SCORE_ENTRIES
-- This trigger keeps total_score and average_score in sync automatically
-- ============================================================================

-- Function to recalculate and update student_term_reports
CREATE OR REPLACE FUNCTION public.sync_student_term_report_scores()
RETURNS TRIGGER AS $$
DECLARE
    v_student_id public.score_entries.student_id%TYPE;
    v_term_id public.score_entries.term_id%TYPE;
    v_total_score NUMERIC;
    v_average_score NUMERIC;
    v_subject_count INTEGER;
BEGIN
    -- Determine which student/term to update based on trigger operation
    IF TG_OP = 'DELETE' THEN
        v_student_id := OLD.student_id;
        v_term_id := OLD.term_id;
    ELSE
        v_student_id := NEW.student_id;
        v_term_id := NEW.term_id;
    END IF;

    -- Calculate fresh totals from score_entries
    SELECT 
        COALESCE(SUM(total_score), 0),
        CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(total_score), 2) ELSE 0 END,
        COUNT(*)
    INTO v_total_score, v_average_score, v_subject_count
    FROM public.score_entries
    WHERE student_id = v_student_id
      AND term_id = v_term_id;

    -- Update or insert into student_term_reports
    INSERT INTO public.student_term_reports (
        student_id, 
        term_id, 
        total_score, 
        average_score,
        updated_at
    )
    VALUES (
        v_student_id, 
        v_term_id, 
        v_total_score, 
        v_average_score,
        NOW()
    )
    ON CONFLICT (student_id, term_id) 
    DO UPDATE SET
        total_score = EXCLUDED.total_score,
        average_score = EXCLUDED.average_score,
        updated_at = NOW();

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on score_entries table
DROP TRIGGER IF EXISTS trigger_sync_student_term_reports ON public.score_entries;
CREATE TRIGGER trigger_sync_student_term_reports
AFTER INSERT OR UPDATE OR DELETE ON public.score_entries
FOR EACH ROW
EXECUTE FUNCTION public.sync_student_term_report_scores();

-- Add comment explaining the trigger
COMMENT ON FUNCTION public.sync_student_term_report_scores IS 
'Automatically syncs total_score and average_score in student_term_reports 
whenever score_entries are modified. This ensures stored values stay fresh 
and match the computed values from score_entries.';

-- ============================================================================
-- BULK UPDATE: Fix all existing stale records
-- ============================================================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.student_term_reports str
    SET 
        total_score = computed.total_score,
        average_score = computed.average_score,
        updated_at = NOW()
    FROM (
        SELECT 
            student_id,
            term_id,
            COALESCE(SUM(total_score), 0) as total_score,
            CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(total_score), 2) ELSE 0 END as average_score
        FROM public.score_entries
        GROUP BY student_id, term_id
    ) computed
    WHERE str.student_id = computed.student_id
      AND str.term_id = computed.term_id;
    
    -- Get the row count immediately after the UPDATE
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Updated % student_term_reports records with fresh computed values', v_count;
END $$;

NOTIFY pgrst, 'reload config';
