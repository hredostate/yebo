-- Migration: Add Score Review Permissions and Audit Fields
-- Date: 2025-12-09
-- Description: Enable Team Leaders and Admins to view and edit all teacher-entered scores

-- Step 1: Add new columns to score_entries table for tracking who entered/modified scores
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='entered_by_user_id') THEN
        ALTER TABLE public.score_entries ADD COLUMN entered_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='last_modified_by_user_id') THEN
        ALTER TABLE public.score_entries ADD COLUMN last_modified_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='created_at') THEN
        ALTER TABLE public.score_entries ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='updated_at') THEN
        ALTER TABLE public.score_entries ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Step 2: Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_score_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS score_entries_updated_at_trigger ON public.score_entries;
CREATE TRIGGER score_entries_updated_at_trigger
    BEFORE UPDATE ON public.score_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_score_entries_updated_at();

-- Step 3: Create audit logging trigger for score_entries
CREATE OR REPLACE FUNCTION log_score_entry_changes()
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

        -- Insert audit log entry
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

        -- Insert audit log entry
        INSERT INTO public.audit_log (school_id, actor_user_id, action, details)
        VALUES (NEW.school_id, NEW.entered_by_user_id, 'score_entry_created', changes);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS score_entries_audit_trigger ON public.score_entries;
CREATE TRIGGER score_entries_audit_trigger
    AFTER INSERT OR UPDATE ON public.score_entries
    FOR EACH ROW
    EXECUTE FUNCTION log_score_entry_changes();

-- Step 4: Update roles to add new permissions
-- NOTE: These updates target school_id = 1 which is the default school created in the schema.
-- For multi-tenant deployments, you may need to update permissions for other school_ids as well.
-- You can do this by running similar UPDATE statements with different school_id values.

-- Update Team Lead role
UPDATE public.roles 
SET permissions = ARRAY['view-dashboard', 'submit-report', 'view-all-reports', 'assign-reports', 'comment-on-reports', 
                       'manage-tasks', 'manage-curriculum', 'view-coverage-feedback', 'score_entries.view_all', 
                       'score_entries.edit_all', 'results.lock_and_publish']
WHERE school_id = 1 AND title = 'Team Lead';

-- Update Principal role
UPDATE public.roles 
SET permissions = ARRAY['view-dashboard', 'view-all-reports', 'manage-users', 'manage-students', 'view-analytics', 
                       'view-school-health-overview', 'manage-tasks', 'manage-announcements', 'view-teacher-ratings', 
                       'view-ai-task-suggestions', 'view-at-risk-students', 'view-all-student-data', 'view-sensitive-reports',
                       'score_entries.view_all', 'score_entries.edit_all', 'results.lock_and_publish']
WHERE school_id = 1 AND title = 'Principal';

-- Note: Admin role already has '*' wildcard permission so no update needed

COMMENT ON COLUMN public.score_entries.entered_by_user_id IS 'User ID of the teacher/staff who originally entered this score';
COMMENT ON COLUMN public.score_entries.last_modified_by_user_id IS 'User ID of the last person to modify this score';
COMMENT ON COLUMN public.score_entries.created_at IS 'Timestamp when the score was first entered';
COMMENT ON COLUMN public.score_entries.updated_at IS 'Timestamp when the score was last modified';
