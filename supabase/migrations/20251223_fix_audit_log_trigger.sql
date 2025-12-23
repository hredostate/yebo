-- Migration: Fix audit_log trigger function and add missing columns
-- Date: 2025-12-23
-- Description: Fix "column table_name does not exist" and "school_id NOT NULL" errors when updating scores

-- Step 1: Add missing columns to audit_log for compatibility
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS table_name TEXT;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS record_id INTEGER;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS changes JSONB;

-- Step 2: Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON public.audit_log(record_id);

-- Step 3: Add comments for documentation
COMMENT ON COLUMN public.audit_log.table_name IS 'The name of the table that triggered this audit log entry (for backward compatibility, not used by current triggers)';
COMMENT ON COLUMN public.audit_log.record_id IS 'The ID of the record that was changed (for backward compatibility, not used by current triggers)';
COMMENT ON COLUMN public.audit_log.changes IS 'JSONB containing the changes made (for backward compatibility, current triggers use details column)';

-- Step 4: Fix the log_score_entry_changes() trigger function
CREATE OR REPLACE FUNCTION public.log_score_entry_changes()
RETURNS TRIGGER AS $$
DECLARE
    changes JSONB;
BEGIN
    -- Build changes JSON
    changes := jsonb_build_object(
        'score_entry_id', NEW.id,
        'student_id', NEW.student_id,
        'subject_name', NEW.subject_name,
        'term_id', NEW.term_id,
        'academic_class_id', NEW.academic_class_id
    );

    IF TG_OP = 'UPDATE' THEN
        -- Log what changed
        IF OLD.component_scores IS DISTINCT FROM NEW.component_scores THEN
            changes := changes || jsonb_build_object(
                'component_scores_old', OLD.component_scores,
                'component_scores_new', NEW.component_scores
            );
        END IF;
        IF OLD.total_score IS DISTINCT FROM NEW.total_score THEN
            changes := changes || jsonb_build_object(
                'total_score_old', OLD.total_score,
                'total_score_new', NEW.total_score
            );
        END IF;
        IF OLD.grade IS DISTINCT FROM NEW.grade THEN
            changes := changes || jsonb_build_object(
                'grade_old', OLD.grade,
                'grade_new', NEW.grade
            );
        END IF;
        IF OLD.teacher_comment IS DISTINCT FROM NEW.teacher_comment THEN
            changes := changes || jsonb_build_object(
                'teacher_comment_old', OLD.teacher_comment,
                'teacher_comment_new', NEW.teacher_comment
            );
        END IF;

        changes := changes || jsonb_build_object(
            'entered_by_user_id', OLD.entered_by_user_id,
            'modified_by_user_id', NEW.last_modified_by_user_id
        );

        -- Insert audit log entry with school_id
        INSERT INTO public.audit_log (school_id, actor_user_id, action, details)
        VALUES (NEW.school_id, NEW.last_modified_by_user_id, 'score_entry_updated', changes);
    ELSIF TG_OP = 'INSERT' THEN
        changes := changes || jsonb_build_object(
            'component_scores', NEW.component_scores,
            'total_score', NEW.total_score,
            'grade', NEW.grade,
            'teacher_comment', NEW.teacher_comment,
            'entered_by_user_id', NEW.entered_by_user_id
        );

        -- Insert audit log entry with school_id
        INSERT INTO public.audit_log (school_id, actor_user_id, action, details)
        VALUES (NEW.school_id, NEW.entered_by_user_id, 'score_entry_created', changes);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Ensure the trigger exists
DROP TRIGGER IF EXISTS score_entries_audit_trigger ON public.score_entries;
CREATE TRIGGER score_entries_audit_trigger
    AFTER INSERT OR UPDATE ON public.score_entries
    FOR EACH ROW
    EXECUTE FUNCTION log_score_entry_changes();
