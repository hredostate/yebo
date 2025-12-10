-- ============================================
-- Student Enrollment Synchronization System
-- ============================================
-- This migration implements automatic synchronization between the students table
-- (source of truth for class/arm assignments) and academic_class_students table
-- (term-based enrollment records).
--
-- Key Features:
-- 1. Auto-sync function to enroll students in academic classes matching their class_id/arm_id
-- 2. Trigger to sync enrollment when student class/arm changes
-- 3. Bulk sync function for new terms
-- 4. Manual sync function for admin tools

-- ============================================
-- FUNCTION: Sync single student enrollment for a term
-- ============================================
-- Synchronizes a student's enrollment in academic_class_students for a given term
-- based on their class_id and arm_id in the students table.
-- 
-- Parameters:
--   p_student_id: The student ID to sync
--   p_term_id: The term ID to sync for
--
-- Returns: Number of enrollments created/updated
CREATE OR REPLACE FUNCTION public.sync_student_enrollment_for_term(
    p_student_id INTEGER,
    p_term_id INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student RECORD;
    v_term RECORD;
    v_academic_class RECORD;
    v_enrollments_changed INTEGER := 0;
BEGIN
    -- Get student details
    SELECT s.id, s.class_id, s.arm_id, s.school_id, 
           c.name as class_name, a.name as arm_name
    INTO v_student
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN arms a ON s.arm_id = a.id
    WHERE s.id = p_student_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Student % not found', p_student_id;
        RETURN 0;
    END IF;
    
    -- Get term details
    SELECT id, session_label
    INTO v_term
    FROM terms
    WHERE id = p_term_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Term % not found', p_term_id;
        RETURN 0;
    END IF;
    
    -- If student doesn't have both class_id and arm_id, remove any enrollments
    IF v_student.class_id IS NULL OR v_student.arm_id IS NULL THEN
        DELETE FROM academic_class_students
        WHERE student_id = p_student_id
        AND enrolled_term_id = p_term_id;
        
        GET DIAGNOSTICS v_enrollments_changed = ROW_COUNT;
        RAISE NOTICE 'Removed % enrollment(s) for student % (no class/arm assigned)', 
            v_enrollments_changed, p_student_id;
        RETURN v_enrollments_changed;
    END IF;
    
    -- Find matching academic class for this term/session
    SELECT ac.id, ac.name, ac.level, ac.arm
    INTO v_academic_class
    FROM academic_classes ac
    WHERE ac.session_label = v_term.session_label
    AND ac.level = v_student.class_name
    AND ac.arm = v_student.arm_name
    AND ac.school_id = v_student.school_id
    AND ac.is_active = true
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'No matching academic class found for student % (class: %, arm: %, session: %)',
            p_student_id, v_student.class_name, v_student.arm_name, v_term.session_label;
        
        -- Remove any existing enrollments since there's no matching class
        DELETE FROM academic_class_students
        WHERE student_id = p_student_id
        AND enrolled_term_id = p_term_id;
        
        RETURN 0;
    END IF;
    
    -- First, remove any enrollments for this student/term that don't match the correct class
    DELETE FROM academic_class_students
    WHERE student_id = p_student_id
    AND enrolled_term_id = p_term_id
    AND academic_class_id != v_academic_class.id;
    
    GET DIAGNOSTICS v_enrollments_changed = ROW_COUNT;
    
    -- Insert enrollment if it doesn't exist
    -- Check if enrollment already exists first
    IF NOT EXISTS (
        SELECT 1 FROM academic_class_students
        WHERE academic_class_id = v_academic_class.id
        AND student_id = p_student_id
        AND enrolled_term_id = p_term_id
    ) THEN
        INSERT INTO academic_class_students (academic_class_id, student_id, enrolled_term_id)
        VALUES (v_academic_class.id, p_student_id, p_term_id);
        
        v_enrollments_changed := v_enrollments_changed + 1;
        RAISE NOTICE 'Enrolled student % in academic class % for term %',
            p_student_id, v_academic_class.name, p_term_id;
    END IF;
    
    RETURN v_enrollments_changed;
END;
$$;

-- ============================================
-- FUNCTION: Bulk sync all students for a term
-- ============================================
-- Synchronizes all active students' enrollments for a given term.
-- This is useful when creating a new term or fixing inconsistencies.
--
-- Parameters:
--   p_term_id: The term ID to sync
--   p_school_id: Optional school ID to limit sync (default NULL = all schools)
--
-- Returns: Number of enrollments created/updated
CREATE OR REPLACE FUNCTION public.sync_all_students_for_term(
    p_term_id INTEGER,
    p_school_id INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student RECORD;
    v_total_changed INTEGER := 0;
    v_changed INTEGER;
BEGIN
    RAISE NOTICE 'Starting bulk sync for term % (school: %)', p_term_id, COALESCE(p_school_id::TEXT, 'all');
    
    FOR v_student IN 
        SELECT id 
        FROM students
        WHERE status = 'Active'
        AND (p_school_id IS NULL OR school_id = p_school_id)
        ORDER BY id
    LOOP
        v_changed := sync_student_enrollment_for_term(v_student.id, p_term_id);
        v_total_changed := v_total_changed + v_changed;
    END LOOP;
    
    RAISE NOTICE 'Bulk sync complete: % enrollments changed', v_total_changed;
    RETURN v_total_changed;
END;
$$;

-- ============================================
-- FUNCTION: Sync student across all active terms
-- ============================================
-- Synchronizes a student's enrollment across all active terms.
-- Useful when a student's class/arm assignment changes.
--
-- Parameters:
--   p_student_id: The student ID to sync
--
-- Returns: Number of enrollments created/updated
CREATE OR REPLACE FUNCTION public.sync_student_enrollment_all_terms(
    p_student_id INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_term RECORD;
    v_total_changed INTEGER := 0;
    v_changed INTEGER;
    v_student_school_id INTEGER;
BEGIN
    -- Get student's school_id
    SELECT school_id INTO v_student_school_id
    FROM students
    WHERE id = p_student_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Student % not found', p_student_id;
        RETURN 0;
    END IF;
    
    RAISE NOTICE 'Syncing student % across all active terms', p_student_id;
    
    -- Sync for all terms in the student's school
    FOR v_term IN 
        SELECT id, session_label, term_label
        FROM terms
        WHERE school_id = v_student_school_id
        ORDER BY id DESC
        LIMIT 10 -- Only sync recent terms to avoid processing old data
    LOOP
        v_changed := sync_student_enrollment_for_term(p_student_id, v_term.id);
        v_total_changed := v_total_changed + v_changed;
    END LOOP;
    
    RAISE NOTICE 'Synced student % across terms: % enrollments changed', 
        p_student_id, v_total_changed;
    RETURN v_total_changed;
END;
$$;

-- ============================================
-- TRIGGER: Auto-sync when student class/arm changes
-- ============================================
-- Automatically synchronizes enrollment when a student's class_id or arm_id changes
CREATE OR REPLACE FUNCTION public.trigger_sync_student_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_changed INTEGER;
BEGIN
    -- Only sync if class_id or arm_id changed
    IF (TG_OP = 'UPDATE' AND (
        OLD.class_id IS DISTINCT FROM NEW.class_id OR
        OLD.arm_id IS DISTINCT FROM NEW.arm_id
    )) OR TG_OP = 'INSERT' THEN
        
        RAISE NOTICE 'Student % class/arm changed, syncing enrollment', NEW.id;
        
        -- Sync across active terms (non-blocking)
        BEGIN
            v_changed := sync_student_enrollment_all_terms(NEW.id);
            RAISE NOTICE 'Auto-sync completed for student %: % changes', NEW.id, v_changed;
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail the main transaction
            RAISE WARNING 'Auto-sync failed for student %: %', NEW.id, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_sync_student_enrollment_on_change ON public.students;

-- Create trigger on students table
CREATE TRIGGER trigger_sync_student_enrollment_on_change
    AFTER INSERT OR UPDATE OF class_id, arm_id ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sync_student_enrollment();

-- ============================================
-- FUNCTION: Manual sync for admin tools
-- ============================================
-- Comprehensive sync function that can be called from admin tools
-- to fix any inconsistencies or sync after bulk operations
--
-- Parameters:
--   p_school_id: Optional school ID to limit sync
--   p_term_id: Optional term ID to sync (NULL = all recent terms)
--
-- Returns: JSONB with sync statistics
CREATE OR REPLACE FUNCTION public.admin_sync_student_enrollments(
    p_school_id INTEGER DEFAULT NULL,
    p_term_id INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_term RECORD;
    v_total_changed INTEGER := 0;
    v_changed INTEGER;
    v_terms_processed INTEGER := 0;
    v_result JSONB;
BEGIN
    RAISE NOTICE 'Starting admin enrollment sync (school: %, term: %)', 
        COALESCE(p_school_id::TEXT, 'all'), COALESCE(p_term_id::TEXT, 'all recent');
    
    IF p_term_id IS NOT NULL THEN
        -- Sync specific term
        v_changed := sync_all_students_for_term(p_term_id, p_school_id);
        v_total_changed := v_changed;
        v_terms_processed := 1;
    ELSE
        -- Sync all recent terms
        FOR v_term IN 
            SELECT id, session_label, term_label
            FROM terms
            WHERE (p_school_id IS NULL OR school_id = p_school_id)
            ORDER BY id DESC
            LIMIT 10 -- Only sync recent terms
        LOOP
            v_changed := sync_all_students_for_term(v_term.id, p_school_id);
            v_total_changed := v_total_changed + v_changed;
            v_terms_processed := v_terms_processed + 1;
        END LOOP;
    END IF;
    
    v_result := jsonb_build_object(
        'success', true,
        'terms_processed', v_terms_processed,
        'enrollments_changed', v_total_changed,
        'timestamp', NOW()
    );
    
    RAISE NOTICE 'Admin sync complete: %', v_result;
    RETURN v_result;
END;
$$;

-- ============================================
-- Grant necessary permissions
-- ============================================
GRANT EXECUTE ON FUNCTION public.sync_student_enrollment_for_term(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_students_for_term(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_student_enrollment_all_terms(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sync_student_enrollments(INTEGER, INTEGER) TO authenticated;

-- ============================================
-- Initial sync for existing data
-- ============================================
-- Run initial sync for the current/active term if it exists
-- This ensures existing students are enrolled properly
DO $$
DECLARE
    v_active_term RECORD;
    v_result INTEGER;
BEGIN
    -- Find active term
    SELECT id, session_label, term_label
    INTO v_active_term
    FROM terms
    WHERE is_active = true
    LIMIT 1;
    
    IF FOUND THEN
        RAISE NOTICE 'Running initial sync for active term: % %', 
            v_active_term.session_label, v_active_term.term_label;
        
        v_result := sync_all_students_for_term(v_active_term.id);
        
        RAISE NOTICE 'Initial sync complete: % enrollments processed', v_result;
    ELSE
        RAISE NOTICE 'No active term found, skipping initial sync';
    END IF;
END $$;

-- ============================================
-- Documentation Comments
-- ============================================
COMMENT ON FUNCTION public.sync_student_enrollment_for_term IS 
'Synchronizes a single student enrollment for a term based on students.class_id and students.arm_id';

COMMENT ON FUNCTION public.sync_all_students_for_term IS 
'Bulk synchronizes all active students for a given term';

COMMENT ON FUNCTION public.sync_student_enrollment_all_terms IS 
'Synchronizes a student across all active terms after class/arm change';

COMMENT ON FUNCTION public.admin_sync_student_enrollments IS 
'Admin tool function to manually sync enrollments with detailed statistics';

COMMENT ON TRIGGER trigger_sync_student_enrollment_on_change ON public.students IS 
'Automatically syncs student enrollment when class_id or arm_id changes';
