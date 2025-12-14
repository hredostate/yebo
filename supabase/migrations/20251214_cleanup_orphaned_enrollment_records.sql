-- ============================================
-- Cleanup Orphaned Enrollment Records
-- Removes enrollment records referencing non-existent students
-- ============================================

-- Log orphaned records before deletion (for audit)
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    -- Count orphaned student_subject_enrollments
    SELECT COUNT(*) INTO orphan_count
    FROM student_subject_enrollments sse
    LEFT JOIN students s ON sse.student_id = s.id
    WHERE s.id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE NOTICE 'Found % orphaned student_subject_enrollment records', orphan_count;
    END IF;
END $$;

-- Delete orphaned student_subject_enrollments
DELETE FROM student_subject_enrollments
WHERE student_id NOT IN (SELECT id FROM students);

-- Delete orphaned academic_class_students
DELETE FROM academic_class_students
WHERE student_id NOT IN (SELECT id FROM students);

-- Delete orphaned score_entries
DELETE FROM score_entries
WHERE student_id NOT IN (SELECT id FROM students);

-- Add a database trigger to prevent future orphaned records
-- This is a safety net in case ON DELETE CASCADE fails

CREATE OR REPLACE FUNCTION prevent_orphaned_student_records()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM students WHERE id = NEW.student_id) THEN
        RAISE EXCEPTION 'Cannot insert/update: student_id % does not exist in students table', NEW.student_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to student_subject_enrollments
DROP TRIGGER IF EXISTS check_student_exists_on_enrollment ON student_subject_enrollments;
CREATE TRIGGER check_student_exists_on_enrollment
    BEFORE INSERT OR UPDATE ON student_subject_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION prevent_orphaned_student_records();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION prevent_orphaned_student_records() TO authenticated;
