-- ============================================
-- Enrollment Synchronization System
-- Resolves dual source of truth between students table and academic_class_students
-- ============================================

-- Function: Sync a single student's enrollment for a specific term
-- This function ensures that a student's academic_class_students record matches
-- their current class_id and arm_id from the students table
CREATE OR REPLACE FUNCTION sync_student_enrollment(
    p_student_id INTEGER,
    p_term_id INTEGER,
    p_school_id INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
    v_academic_class RECORD;
    v_result JSONB;
    v_action TEXT;
BEGIN
    -- Get student's current class and arm
    SELECT class_id, arm_id, name
    INTO v_student
    FROM students
    WHERE id = p_student_id AND school_id = p_school_id;
    
    -- If student not found or has no class/arm assignment, remove their enrollment
    IF v_student IS NULL OR v_student.class_id IS NULL OR v_student.arm_id IS NULL THEN
        DELETE FROM academic_class_students
        WHERE student_id = p_student_id
          AND enrolled_term_id = p_term_id;
        
        RETURN jsonb_build_object(
            'action', 'removed',
            'student_id', p_student_id,
            'reason', CASE 
                WHEN v_student IS NULL THEN 'student_not_found'
                ELSE 'no_class_or_arm_assigned'
            END
        );
    END IF;
    
    -- Get student's class and arm names
    DECLARE
        v_class_name TEXT;
        v_arm_name TEXT;
    BEGIN
        SELECT name INTO v_class_name FROM classes WHERE id = v_student.class_id;
        SELECT name INTO v_arm_name FROM arms WHERE id = v_student.arm_id;
        
        -- If class or arm not found, can't proceed
        IF v_class_name IS NULL OR v_arm_name IS NULL THEN
            RETURN jsonb_build_object(
                'action', 'error',
                'student_id', p_student_id,
                'reason', 'class_or_arm_not_found',
                'class_id', v_student.class_id,
                'arm_id', v_student.arm_id
            );
        END IF;
        
        -- Find the matching academic class
        SELECT id INTO v_academic_class
        FROM academic_classes
        WHERE school_id = p_school_id
          AND level = v_class_name
          AND arm = v_arm_name
          AND is_active = TRUE
        LIMIT 1;
        
        -- If no matching academic class, can't enroll
        IF v_academic_class IS NULL THEN
            DELETE FROM academic_class_students
            WHERE student_id = p_student_id
              AND enrolled_term_id = p_term_id;
            
            RETURN jsonb_build_object(
                'action', 'removed',
                'student_id', p_student_id,
                'reason', 'no_matching_academic_class',
                'class_name', v_class_name,
                'arm_name', v_arm_name
            );
        END IF;
        
        -- Upsert the enrollment
        INSERT INTO academic_class_students (academic_class_id, student_id, enrolled_term_id)
        VALUES (v_academic_class.id, p_student_id, p_term_id)
        ON CONFLICT (academic_class_id, student_id, enrolled_term_id) 
        DO UPDATE SET academic_class_id = EXCLUDED.academic_class_id
        RETURNING 
            CASE 
                WHEN xmax = 0 THEN 'created'
                ELSE 'updated'
            END INTO v_action;
        
        RETURN jsonb_build_object(
            'action', COALESCE(v_action, 'updated'),
            'student_id', p_student_id,
            'academic_class_id', v_academic_class.id,
            'class_name', v_class_name,
            'arm_name', v_arm_name
        );
    END;
END;
$$ LANGUAGE plpgsql;

-- Function: Sync all students for a specific term
-- This is the main function for bulk synchronization
CREATE OR REPLACE FUNCTION sync_all_students_for_term(
    p_term_id INTEGER,
    p_school_id INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
    v_result JSONB;
    v_stats JSONB;
    v_created INTEGER := 0;
    v_updated INTEGER := 0;
    v_removed INTEGER := 0;
    v_errors INTEGER := 0;
BEGIN
    -- Process each student
    FOR v_student IN 
        SELECT id FROM students WHERE school_id = p_school_id
    LOOP
        v_result := sync_student_enrollment(v_student.id, p_term_id, p_school_id);
        
        CASE v_result->>'action'
            WHEN 'created' THEN v_created := v_created + 1;
            WHEN 'updated' THEN v_updated := v_updated + 1;
            WHEN 'removed' THEN v_removed := v_removed + 1;
            WHEN 'error' THEN v_errors := v_errors + 1;
        END CASE;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'term_id', p_term_id,
        'school_id', p_school_id,
        'stats', jsonb_build_object(
            'created', v_created,
            'updated', v_updated,
            'removed', v_removed,
            'errors', v_errors,
            'total_processed', v_created + v_updated + v_removed + v_errors
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger Function: Auto-sync student enrollment when class/arm changes
CREATE OR REPLACE FUNCTION trigger_sync_student_enrollment()
RETURNS TRIGGER AS $$
DECLARE
    v_active_term RECORD;
    v_result JSONB;
BEGIN
    -- Only sync if class_id or arm_id changed
    IF (TG_OP = 'UPDATE' AND (
        OLD.class_id IS DISTINCT FROM NEW.class_id OR 
        OLD.arm_id IS DISTINCT FROM NEW.arm_id
    )) OR TG_OP = 'INSERT' THEN
        
        -- Get all active terms for this school
        FOR v_active_term IN 
            SELECT id FROM terms 
            WHERE school_id = NEW.school_id 
              AND is_active = TRUE
        LOOP
            -- Sync student for this term
            PERFORM sync_student_enrollment(NEW.id, v_active_term.id, NEW.school_id);
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on students table
DROP TRIGGER IF EXISTS student_enrollment_sync_trigger ON students;
CREATE TRIGGER student_enrollment_sync_trigger
    AFTER INSERT OR UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sync_student_enrollment();

-- Trigger Function: Auto-enroll all students when a new term is created or activated
CREATE OR REPLACE FUNCTION trigger_sync_enrollments_on_term()
RETURNS TRIGGER AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- When a term becomes active (created as active or changed to active)
    IF (TG_OP = 'INSERT' AND NEW.is_active = TRUE) OR 
       (TG_OP = 'UPDATE' AND OLD.is_active = FALSE AND NEW.is_active = TRUE) THEN
        
        -- Sync all students for this term
        PERFORM sync_all_students_for_term(NEW.id, NEW.school_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on terms table
DROP TRIGGER IF EXISTS term_enrollment_sync_trigger ON terms;
CREATE TRIGGER term_enrollment_sync_trigger
    AFTER INSERT OR UPDATE ON terms
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sync_enrollments_on_term();

-- Function: Admin sync with detailed statistics
-- This function is used by the admin UI to manually sync enrollments
CREATE OR REPLACE FUNCTION admin_sync_student_enrollments(
    p_term_id INTEGER,
    p_school_id INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_before_count INTEGER;
    v_after_count INTEGER;
BEGIN
    -- Count enrollments before sync
    SELECT COUNT(*) INTO v_before_count
    FROM academic_class_students
    WHERE enrolled_term_id = p_term_id;
    
    -- Perform sync
    v_result := sync_all_students_for_term(p_term_id, p_school_id);
    
    -- Count enrollments after sync
    SELECT COUNT(*) INTO v_after_count
    FROM academic_class_students
    WHERE enrolled_term_id = p_term_id;
    
    -- Return detailed stats
    RETURN jsonb_build_object(
        'success', true,
        'term_id', p_term_id,
        'school_id', p_school_id,
        'before_count', v_before_count,
        'after_count', v_after_count,
        'sync_stats', v_result->'stats'
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Get enrollment sync diagnostics
-- Identifies students who are out of sync
CREATE OR REPLACE FUNCTION get_enrollment_sync_diagnostics(
    p_term_id INTEGER,
    p_school_id INTEGER
) RETURNS TABLE(
    student_id INTEGER,
    student_name TEXT,
    current_class_id INTEGER,
    current_arm_id INTEGER,
    current_class_name TEXT,
    current_arm_name TEXT,
    expected_academic_class_id INTEGER,
    expected_academic_class_name TEXT,
    enrolled_academic_class_id INTEGER,
    enrolled_academic_class_name TEXT,
    sync_status TEXT,
    issue_description TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH student_info AS (
        SELECT 
            s.id as student_id,
            s.name as student_name,
            s.class_id,
            s.arm_id,
            c.name as class_name,
            a.name as arm_name
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN arms a ON s.arm_id = a.id
        WHERE s.school_id = p_school_id
    ),
    expected_classes AS (
        SELECT 
            si.student_id,
            si.student_name,
            si.class_id,
            si.arm_id,
            si.class_name,
            si.arm_name,
            ac.id as expected_ac_id,
            ac.name as expected_ac_name
        FROM student_info si
        LEFT JOIN academic_classes ac ON 
            ac.school_id = p_school_id AND
            ac.level = si.class_name AND
            ac.arm = si.arm_name AND
            ac.is_active = TRUE
    ),
    current_enrollments AS (
        SELECT 
            acs.student_id,
            acs.academic_class_id as enrolled_ac_id,
            ac.name as enrolled_ac_name
        FROM academic_class_students acs
        JOIN academic_classes ac ON acs.academic_class_id = ac.id
        WHERE acs.enrolled_term_id = p_term_id
    )
    SELECT 
        ec.student_id,
        ec.student_name,
        ec.class_id as current_class_id,
        ec.arm_id as current_arm_id,
        ec.class_name as current_class_name,
        ec.arm_name as current_arm_name,
        ec.expected_ac_id as expected_academic_class_id,
        ec.expected_ac_name as expected_academic_class_name,
        ce.enrolled_ac_id as enrolled_academic_class_id,
        ce.enrolled_ac_name as enrolled_academic_class_name,
        CASE 
            WHEN ec.class_id IS NULL OR ec.arm_id IS NULL THEN 'no_assignment'
            WHEN ec.expected_ac_id IS NULL THEN 'no_matching_class'
            WHEN ce.enrolled_ac_id IS NULL THEN 'not_enrolled'
            WHEN ce.enrolled_ac_id != ec.expected_ac_id THEN 'mismatched'
            ELSE 'synced'
        END as sync_status,
        CASE 
            WHEN ec.class_id IS NULL OR ec.arm_id IS NULL THEN 
                'Student has no class or arm assignment in students table'
            WHEN ec.expected_ac_id IS NULL THEN 
                'No active academic class found for ' || ec.class_name || ' ' || ec.arm_name
            WHEN ce.enrolled_ac_id IS NULL THEN 
                'Student not enrolled in any class for this term'
            WHEN ce.enrolled_ac_id != ec.expected_ac_id THEN 
                'Student enrolled in ' || ce.enrolled_ac_name || ' but should be in ' || ec.expected_ac_name
            ELSE 'Student correctly enrolled'
        END as issue_description
    FROM expected_classes ec
    LEFT JOIN current_enrollments ce ON ec.student_id = ce.student_id
    WHERE 
        -- Only return students with issues or filter all if needed
        CASE 
            WHEN ec.class_id IS NULL OR ec.arm_id IS NULL THEN TRUE
            WHEN ec.expected_ac_id IS NULL THEN TRUE
            WHEN ce.enrolled_ac_id IS NULL THEN TRUE
            WHEN ce.enrolled_ac_id != ec.expected_ac_id THEN TRUE
            ELSE FALSE
        END
    ORDER BY ec.student_name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION sync_student_enrollment(INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_all_students_for_term(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_sync_student_enrollments(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_enrollment_sync_diagnostics(INTEGER, INTEGER) TO authenticated;

-- Add comment documentation
COMMENT ON FUNCTION sync_student_enrollment IS 'Synchronizes a single student enrollment record for a term based on their class_id and arm_id';
COMMENT ON FUNCTION sync_all_students_for_term IS 'Bulk synchronizes all students enrollments for a specific term';
COMMENT ON FUNCTION admin_sync_student_enrollments IS 'Admin function to manually sync enrollments with detailed statistics';
COMMENT ON FUNCTION get_enrollment_sync_diagnostics IS 'Diagnostic function to identify students with enrollment sync issues';
COMMENT ON TRIGGER student_enrollment_sync_trigger ON students IS 'Auto-syncs student enrollments when class_id or arm_id changes';
COMMENT ON TRIGGER term_enrollment_sync_trigger ON terms IS 'Auto-enrolls all students when a new term is created or activated';
