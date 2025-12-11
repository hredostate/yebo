-- ============================================
-- Enrollment Sync Improvements
-- Fixes issue where manual enrollments are removed during sync
-- ============================================

-- 1. Add manually_enrolled column to track manual enrollments
ALTER TABLE public.academic_class_students 
ADD COLUMN IF NOT EXISTS manually_enrolled BOOLEAN DEFAULT FALSE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_academic_class_students_manual 
    ON public.academic_class_students(manually_enrolled) 
    WHERE manually_enrolled = TRUE;

-- 2. Improved sync_student_enrollment function with manual enrollment protection
CREATE OR REPLACE FUNCTION sync_student_enrollment(
    p_student_id INTEGER,
    p_term_id INTEGER,
    p_school_id INTEGER,
    p_preserve_manual BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
    v_academic_class_id INTEGER;
    v_result JSONB;
    v_action TEXT;
    v_class_name TEXT;
    v_arm_name TEXT;
    v_existing_enrollment RECORD;
BEGIN
    -- Get student's current class and arm
    SELECT class_id, arm_id, name
    INTO v_student
    FROM students
    WHERE id = p_student_id AND school_id = p_school_id;
    
    -- If student not found or has no class/arm assignment
    IF v_student IS NULL OR v_student.class_id IS NULL OR v_student.arm_id IS NULL THEN
        -- Check if there's a manual enrollment to preserve
        IF p_preserve_manual THEN
            SELECT * INTO v_existing_enrollment
            FROM academic_class_students
            WHERE student_id = p_student_id
              AND enrolled_term_id = p_term_id
              AND manually_enrolled = TRUE;
            
            IF FOUND THEN
                -- Preserve manual enrollment, just log a warning
                RETURN jsonb_build_object(
                    'action', 'preserved_manual',
                    'student_id', p_student_id,
                    'reason', CASE 
                        WHEN v_student IS NULL THEN 'student_not_found_but_manual_enrollment_preserved'
                        ELSE 'no_class_or_arm_assigned_but_manual_enrollment_preserved'
                    END,
                    'academic_class_id', v_existing_enrollment.academic_class_id
                );
            END IF;
        END IF;
        
        -- Remove only auto-synced enrollments
        DELETE FROM academic_class_students
        WHERE student_id = p_student_id
          AND enrolled_term_id = p_term_id
          AND (NOT p_preserve_manual OR manually_enrolled = FALSE);
        
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
    SELECT id INTO v_academic_class_id
    FROM academic_classes
    WHERE school_id = p_school_id
      AND level = v_class_name
      AND arm = v_arm_name
      AND is_active = TRUE
    LIMIT 1;
    
    -- If no matching academic class found
    IF v_academic_class_id IS NULL THEN
        -- Check if there's a manual enrollment to preserve
        IF p_preserve_manual THEN
            SELECT * INTO v_existing_enrollment
            FROM academic_class_students
            WHERE student_id = p_student_id
              AND enrolled_term_id = p_term_id
              AND manually_enrolled = TRUE;
            
            IF FOUND THEN
                -- Preserve manual enrollment, just log a warning
                RETURN jsonb_build_object(
                    'action', 'preserved_manual',
                    'student_id', p_student_id,
                    'reason', 'no_matching_academic_class_but_manual_enrollment_preserved',
                    'class_name', v_class_name,
                    'arm_name', v_arm_name,
                    'academic_class_id', v_existing_enrollment.academic_class_id
                );
            END IF;
        END IF;
        
        -- Remove only auto-synced enrollments
        DELETE FROM academic_class_students
        WHERE student_id = p_student_id
          AND enrolled_term_id = p_term_id
          AND (NOT p_preserve_manual OR manually_enrolled = FALSE);
        
        RETURN jsonb_build_object(
            'action', 'removed',
            'student_id', p_student_id,
            'reason', 'no_matching_academic_class',
            'class_name', v_class_name,
            'arm_name', v_arm_name
        );
    END IF;
    
    -- Check if enrollment already exists
    SELECT * INTO v_existing_enrollment
    FROM academic_class_students
    WHERE student_id = p_student_id
      AND enrolled_term_id = p_term_id;
    
    IF FOUND THEN
        -- If it's a manual enrollment and matches the target class, preserve it
        IF v_existing_enrollment.manually_enrolled AND 
           v_existing_enrollment.academic_class_id = v_academic_class_id THEN
            RETURN jsonb_build_object(
                'action', 'preserved_manual',
                'student_id', p_student_id,
                'academic_class_id', v_academic_class_id,
                'class_name', v_class_name,
                'arm_name', v_arm_name,
                'reason', 'manual_enrollment_already_correct'
            );
        END IF;
        
        -- If it's a manual enrollment but for different class
        IF v_existing_enrollment.manually_enrolled AND 
           v_existing_enrollment.academic_class_id != v_academic_class_id AND
           p_preserve_manual THEN
            -- Keep the manual enrollment, don't override
            RETURN jsonb_build_object(
                'action', 'preserved_manual',
                'student_id', p_student_id,
                'academic_class_id', v_existing_enrollment.academic_class_id,
                'expected_class_id', v_academic_class_id,
                'class_name', v_class_name,
                'arm_name', v_arm_name,
                'reason', 'manual_enrollment_for_different_class_preserved'
            );
        END IF;
        
        -- Update the enrollment (it's either auto-synced or we're not preserving manual)
        UPDATE academic_class_students
        SET academic_class_id = v_academic_class_id,
            manually_enrolled = FALSE  -- Reset to auto-synced
        WHERE student_id = p_student_id
          AND enrolled_term_id = p_term_id;
        
        RETURN jsonb_build_object(
            'action', 'updated',
            'student_id', p_student_id,
            'academic_class_id', v_academic_class_id,
            'class_name', v_class_name,
            'arm_name', v_arm_name
        );
    ELSE
        -- Create new enrollment (auto-synced)
        INSERT INTO academic_class_students (academic_class_id, student_id, enrolled_term_id, manually_enrolled)
        VALUES (v_academic_class_id, p_student_id, p_term_id, FALSE);
        
        RETURN jsonb_build_object(
            'action', 'created',
            'student_id', p_student_id,
            'academic_class_id', v_academic_class_id,
            'class_name', v_class_name,
            'arm_name', v_arm_name
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Update sync_all_students_for_term to support preserve_manual parameter
CREATE OR REPLACE FUNCTION sync_all_students_for_term(
    p_term_id INTEGER,
    p_school_id INTEGER,
    p_preserve_manual BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
    v_result JSONB;
    v_stats JSONB;
    v_created INTEGER := 0;
    v_updated INTEGER := 0;
    v_removed INTEGER := 0;
    v_errors INTEGER := 0;
    v_preserved INTEGER := 0;
BEGIN
    -- Process each student
    FOR v_student IN 
        SELECT id FROM students WHERE school_id = p_school_id
    LOOP
        v_result := sync_student_enrollment(v_student.id, p_term_id, p_school_id, p_preserve_manual);
        
        CASE v_result->>'action'
            WHEN 'created' THEN v_created := v_created + 1;
            WHEN 'updated' THEN v_updated := v_updated + 1;
            WHEN 'removed' THEN v_removed := v_removed + 1;
            WHEN 'error' THEN v_errors := v_errors + 1;
            WHEN 'preserved_manual' THEN v_preserved := v_preserved + 1;
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
            'preserved_manual', v_preserved,
            'total_processed', v_created + v_updated + v_removed + v_errors + v_preserved
        )
    );
END;
$$ LANGUAGE plpgsql;

-- 4. Update admin_sync_student_enrollments to support preserve_manual parameter
CREATE OR REPLACE FUNCTION admin_sync_student_enrollments(
    p_term_id INTEGER,
    p_school_id INTEGER,
    p_preserve_manual BOOLEAN DEFAULT TRUE
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
    v_result := sync_all_students_for_term(p_term_id, p_school_id, p_preserve_manual);
    
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
        'preserve_manual', p_preserve_manual,
        'sync_stats', v_result->'stats'
    );
END;
$$ LANGUAGE plpgsql;

-- 5. Verify the trigger is already selective (it is!)
-- The existing trigger already only fires on class_id/arm_id changes
-- No changes needed to trigger_sync_student_enrollment

-- 6. Update comments
COMMENT ON COLUMN public.academic_class_students.manually_enrolled IS 
    'TRUE if enrollment was manually added through UI, FALSE if auto-synced. Manual enrollments are preserved during sync operations.';

COMMENT ON FUNCTION sync_student_enrollment IS 
    'Synchronizes a single student enrollment record for a term based on their class_id and arm_id. 
     When p_preserve_manual is TRUE (default), manual enrollments are preserved even when no matching class is found.';

COMMENT ON FUNCTION sync_all_students_for_term IS 
    'Bulk synchronizes all students enrollments for a specific term. 
     When p_preserve_manual is TRUE (default), manual enrollments are preserved during sync.';

COMMENT ON FUNCTION admin_sync_student_enrollments IS 
    'Admin function to manually sync enrollments with detailed statistics. 
     When p_preserve_manual is TRUE (default), manual enrollments are preserved during sync.';
