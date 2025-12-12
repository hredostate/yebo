-- ============================================
-- Enrollment Sync Score Protection
-- Prevents removal of students who have score entries
-- Adds repair function to restore missing enrollments
-- ============================================

-- STEP 1: Drop and recreate sync_student_enrollment with score protection
-- Drop all versions first
DROP FUNCTION IF EXISTS sync_student_enrollment(INTEGER, INTEGER, INTEGER, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS sync_student_enrollment(INTEGER, INTEGER, INTEGER) CASCADE;

-- Create primary 4-parameter version with score protection
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
    v_score_count INTEGER;
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
        
        -- Check if student has score entries for this term before removing
        SELECT COUNT(*) INTO v_score_count
        FROM score_entries
        WHERE student_id = p_student_id
          AND term_id = p_term_id;
        
        IF v_score_count > 0 THEN
            -- Don't remove enrollment if student has scores
            SELECT academic_class_id INTO v_academic_class_id
            FROM academic_class_students
            WHERE student_id = p_student_id
              AND enrolled_term_id = p_term_id
            LIMIT 1;
            
            RETURN jsonb_build_object(
                'action', 'preserved_with_scores',
                'student_id', p_student_id,
                'score_count', v_score_count,
                'academic_class_id', v_academic_class_id,
                'reason', 'student_has_existing_scores'
            );
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
        
        -- Check if student has score entries for this term before removing
        SELECT COUNT(*) INTO v_score_count
        FROM score_entries
        WHERE student_id = p_student_id
          AND term_id = p_term_id;
        
        IF v_score_count > 0 THEN
            -- Don't remove enrollment if student has scores
            SELECT academic_class_id INTO v_academic_class_id
            FROM academic_class_students
            WHERE student_id = p_student_id
              AND enrolled_term_id = p_term_id
            LIMIT 1;
            
            RETURN jsonb_build_object(
                'action', 'preserved_with_scores',
                'student_id', p_student_id,
                'score_count', v_score_count,
                'academic_class_id', v_academic_class_id,
                'reason', 'student_has_existing_scores',
                'class_name', v_class_name,
                'arm_name', v_arm_name
            );
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

-- Create 3-parameter wrapper for backward compatibility
CREATE OR REPLACE FUNCTION sync_student_enrollment(
    p_student_id INTEGER,
    p_term_id INTEGER,
    p_school_id INTEGER
) RETURNS JSONB AS $$
BEGIN
    -- Call the 4-parameter version with default preserve_manual=TRUE
    RETURN sync_student_enrollment(p_student_id, p_term_id, p_school_id, TRUE);
END;
$$ LANGUAGE plpgsql;

-- STEP 2: Update sync_all_students_for_term to track preserved_with_scores
DROP FUNCTION IF EXISTS sync_all_students_for_term(INTEGER, INTEGER, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS sync_all_students_for_term(INTEGER, INTEGER) CASCADE;

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
    v_preserved_manual INTEGER := 0;
    v_preserved_with_scores INTEGER := 0;
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
            WHEN 'preserved_manual' THEN v_preserved_manual := v_preserved_manual + 1;
            WHEN 'preserved_with_scores' THEN v_preserved_with_scores := v_preserved_with_scores + 1;
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
            'preserved_manual', v_preserved_manual,
            'preserved_with_scores', v_preserved_with_scores,
            'total_processed', v_created + v_updated + v_removed + v_errors + v_preserved_manual + v_preserved_with_scores
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Create 2-parameter wrapper for backward compatibility
CREATE OR REPLACE FUNCTION sync_all_students_for_term(
    p_term_id INTEGER,
    p_school_id INTEGER
) RETURNS JSONB AS $$
BEGIN
    -- Call the 3-parameter version with default preserve_manual=TRUE
    RETURN sync_all_students_for_term(p_term_id, p_school_id, TRUE);
END;
$$ LANGUAGE plpgsql;

-- STEP 3: Create repair function for missing enrollments
CREATE OR REPLACE FUNCTION repair_missing_enrollments(
    p_term_id INTEGER,
    p_school_id INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_missing_student RECORD;
    v_repaired INTEGER := 0;
    v_academic_class_id INTEGER;
    v_class_name TEXT;
    v_arm_name TEXT;
    v_failed INTEGER := 0;
BEGIN
    -- Find students who have score entries but no enrollment
    FOR v_missing_student IN
        SELECT DISTINCT s.id, s.name, s.class_id, s.arm_id, se.academic_class_id
        FROM students s
        INNER JOIN score_entries se ON s.id = se.student_id
        LEFT JOIN academic_class_students acs ON s.id = acs.student_id 
            AND acs.enrolled_term_id = p_term_id
        WHERE s.school_id = p_school_id
          AND se.term_id = p_term_id
          AND acs.id IS NULL  -- No enrollment exists
    LOOP
        BEGIN
            -- Try to use the academic_class_id from their score entries
            v_academic_class_id := v_missing_student.academic_class_id;
            
            -- Verify the academic class still exists and is active
            IF NOT EXISTS (
                SELECT 1 FROM academic_classes 
                WHERE id = v_academic_class_id 
                  AND school_id = p_school_id 
                  AND is_active = TRUE
            ) THEN
                -- Try to find matching class based on student's class_id and arm_id
                IF v_missing_student.class_id IS NOT NULL AND v_missing_student.arm_id IS NOT NULL THEN
                    SELECT c.name INTO v_class_name FROM classes c WHERE c.id = v_missing_student.class_id;
                    SELECT a.name INTO v_arm_name FROM arms a WHERE a.id = v_missing_student.arm_id;
                    
                    IF v_class_name IS NOT NULL AND v_arm_name IS NOT NULL THEN
                        SELECT id INTO v_academic_class_id
                        FROM academic_classes
                        WHERE school_id = p_school_id
                          AND level = v_class_name
                          AND arm = v_arm_name
                          AND is_active = TRUE
                        LIMIT 1;
                    END IF;
                END IF;
            END IF;
            
            -- If we found a valid academic class, create the enrollment
            IF v_academic_class_id IS NOT NULL THEN
                INSERT INTO academic_class_students (academic_class_id, student_id, enrolled_term_id, manually_enrolled)
                VALUES (v_academic_class_id, v_missing_student.id, p_term_id, FALSE)
                ON CONFLICT (academic_class_id, student_id, enrolled_term_id) DO NOTHING;
                
                v_repaired := v_repaired + 1;
            ELSE
                v_failed := v_failed + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'term_id', p_term_id,
        'school_id', p_school_id,
        'repaired', v_repaired,
        'failed', v_failed,
        'message', format('%s enrollments repaired, %s failed', v_repaired, v_failed)
    );
END;
$$ LANGUAGE plpgsql;

-- STEP 4: Create diagnostic function to identify removal candidates
CREATE OR REPLACE FUNCTION get_enrollment_removal_candidates(
    p_term_id INTEGER,
    p_school_id INTEGER
) RETURNS TABLE(
    student_id INTEGER,
    student_name TEXT,
    current_class_id INTEGER,
    current_arm_id INTEGER,
    enrolled_academic_class_id INTEGER,
    enrolled_academic_class_name TEXT,
    has_scores BOOLEAN,
    score_count INTEGER,
    would_be_removed BOOLEAN,
    removal_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as student_id,
        s.name as student_name,
        s.class_id as current_class_id,
        s.arm_id as current_arm_id,
        acs.academic_class_id as enrolled_academic_class_id,
        ac.name as enrolled_academic_class_name,
        (SELECT COUNT(*) > 0 FROM score_entries se WHERE se.student_id = s.id AND se.term_id = p_term_id) as has_scores,
        (SELECT COUNT(*)::INTEGER FROM score_entries se WHERE se.student_id = s.id AND se.term_id = p_term_id) as score_count,
        CASE 
            -- Would be removed if no class/arm assignment
            WHEN s.class_id IS NULL OR s.arm_id IS NULL THEN TRUE
            -- Would be removed if no matching academic class exists
            WHEN NOT EXISTS (
                SELECT 1 FROM academic_classes target_ac
                JOIN classes c ON c.id = s.class_id
                JOIN arms a ON a.id = s.arm_id
                WHERE target_ac.school_id = p_school_id
                  AND target_ac.level = c.name
                  AND target_ac.arm = a.name
                  AND target_ac.is_active = TRUE
            ) THEN TRUE
            ELSE FALSE
        END as would_be_removed,
        CASE 
            WHEN s.class_id IS NULL OR s.arm_id IS NULL THEN 'No class or arm assignment'
            WHEN NOT EXISTS (
                SELECT 1 FROM academic_classes target_ac
                JOIN classes c ON c.id = s.class_id
                JOIN arms a ON a.id = s.arm_id
                WHERE target_ac.school_id = p_school_id
                  AND target_ac.level = c.name
                  AND target_ac.arm = a.name
                  AND target_ac.is_active = TRUE
            ) THEN 'No matching active academic class'
            ELSE 'Would not be removed'
        END as removal_reason
    FROM students s
    INNER JOIN academic_class_students acs ON s.id = acs.student_id
    INNER JOIN academic_classes ac ON acs.academic_class_id = ac.id
    WHERE s.school_id = p_school_id
      AND acs.enrolled_term_id = p_term_id
      AND acs.manually_enrolled = FALSE  -- Only auto-synced enrollments
    ORDER BY 
        CASE 
            WHEN s.class_id IS NULL OR s.arm_id IS NULL THEN 1
            WHEN NOT EXISTS (
                SELECT 1 FROM academic_classes target_ac
                JOIN classes c ON c.id = s.class_id
                JOIN arms a ON a.id = s.arm_id
                WHERE target_ac.school_id = p_school_id
                  AND target_ac.level = c.name
                  AND target_ac.arm = a.name
                  AND target_ac.is_active = TRUE
            ) THEN 2
            ELSE 3
        END,
        (SELECT COUNT(*) > 0 FROM score_entries se WHERE se.student_id = s.id AND se.term_id = p_term_id) DESC,
        s.name;
END;
$$ LANGUAGE plpgsql;

-- STEP 5: Update admin_sync_student_enrollments (no changes needed, just recreate)
DROP FUNCTION IF EXISTS admin_sync_student_enrollments(INTEGER, INTEGER, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS admin_sync_student_enrollments(INTEGER, INTEGER) CASCADE;

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

CREATE OR REPLACE FUNCTION admin_sync_student_enrollments(
    p_term_id INTEGER,
    p_school_id INTEGER
) RETURNS JSONB AS $$
BEGIN
    -- Call the 3-parameter version with default preserve_manual=TRUE
    RETURN admin_sync_student_enrollments(p_term_id, p_school_id, TRUE);
END;
$$ LANGUAGE plpgsql;

-- STEP 6: Grant permissions
GRANT EXECUTE ON FUNCTION sync_student_enrollment(INTEGER, INTEGER, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_student_enrollment(INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_all_students_for_term(INTEGER, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_all_students_for_term(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_sync_student_enrollments(INTEGER, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_sync_student_enrollments(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION repair_missing_enrollments(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_enrollment_removal_candidates(INTEGER, INTEGER) TO authenticated;

-- STEP 7: Add documentation comments
COMMENT ON FUNCTION sync_student_enrollment(INTEGER, INTEGER, INTEGER, BOOLEAN) IS 
    'Synchronizes a single student enrollment record for a term. Protects students with score entries from removal. When p_preserve_manual is TRUE (default), manual enrollments are also preserved.';

COMMENT ON FUNCTION repair_missing_enrollments(INTEGER, INTEGER) IS 
    'Finds students who have score entries but are missing from academic_class_students and re-creates their enrollment records. Returns statistics on repairs.';

COMMENT ON FUNCTION get_enrollment_removal_candidates(INTEGER, INTEGER) IS 
    'Diagnostic function that shows which students WOULD be removed by sync, without actually removing them. Useful for identifying students with scores who might be affected.';

COMMENT ON FUNCTION sync_all_students_for_term(INTEGER, INTEGER, BOOLEAN) IS 
    'Bulk synchronizes all students enrollments for a specific term. Tracks preserved_with_scores count for students protected due to existing score entries.';
