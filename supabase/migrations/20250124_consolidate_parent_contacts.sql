-- ============================================
-- PARENT CONTACT CONSOLIDATION MIGRATION
-- ============================================
-- This migration consolidates parent contact information into a single source of truth
-- using father_* and mother_* fields, and migrates data from the generic parent_phone_number_* fields.

-- Step 1: Ensure all specific parent fields exist (should already exist from previous migrations)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='father_name') THEN
        ALTER TABLE public.students ADD COLUMN father_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='father_phone') THEN
        ALTER TABLE public.students ADD COLUMN father_phone TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='father_email') THEN
        ALTER TABLE public.students ADD COLUMN father_email TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='mother_name') THEN
        ALTER TABLE public.students ADD COLUMN mother_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='mother_phone') THEN
        ALTER TABLE public.students ADD COLUMN mother_phone TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='mother_email') THEN
        ALTER TABLE public.students ADD COLUMN mother_email TEXT;
    END IF;
END $$;

-- Step 2: Migrate data from generic fields to specific fields
-- Only migrate if the specific field is empty and the generic field has data
-- This preserves any existing specific data while migrating generic data

-- Migrate parent_phone_number_1 to father_phone (if father_phone is empty)
UPDATE public.students
SET father_phone = parent_phone_number_1
WHERE 
    parent_phone_number_1 IS NOT NULL 
    AND parent_phone_number_1 != ''
    AND (father_phone IS NULL OR father_phone = '');

-- Migrate parent_phone_number_2 to mother_phone (if mother_phone is empty)
UPDATE public.students
SET mother_phone = parent_phone_number_2
WHERE 
    parent_phone_number_2 IS NOT NULL 
    AND parent_phone_number_2 != ''
    AND (mother_phone IS NULL OR mother_phone = '');

-- Step 3: Add comments to document the fields and their usage
COMMENT ON COLUMN public.students.father_name IS 'Father''s full name - canonical field for father contact information';
COMMENT ON COLUMN public.students.father_phone IS 'Father''s phone number - canonical field for father contact';
COMMENT ON COLUMN public.students.father_email IS 'Father''s email address - canonical field for father contact';
COMMENT ON COLUMN public.students.mother_name IS 'Mother''s full name - canonical field for mother contact information';
COMMENT ON COLUMN public.students.mother_phone IS 'Mother''s phone number - canonical field for mother contact';
COMMENT ON COLUMN public.students.mother_email IS 'Mother''s email address - canonical field for mother contact';
COMMENT ON COLUMN public.students.parent_phone_number_1 IS 'DEPRECATED: Use father_phone instead. Kept for backward compatibility only.';
COMMENT ON COLUMN public.students.parent_phone_number_2 IS 'DEPRECATED: Use mother_phone instead. Kept for backward compatibility only.';

-- Step 4: Create a helper function to get all parent contact information
-- This function returns a consolidated view of parent contact information
CREATE OR REPLACE FUNCTION public.get_student_parent_contacts(student_id_param INTEGER)
RETURNS TABLE (
    father_name TEXT,
    father_phone TEXT,
    father_email TEXT,
    mother_name TEXT,
    mother_phone TEXT,
    mother_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.father_name,
        s.father_phone,
        s.father_email,
        s.mother_name,
        s.mother_phone,
        s.mother_email
    FROM public.students s
    WHERE s.id = student_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create a trigger to sync changes from generic fields to specific fields
-- This ensures any legacy code that updates parent_phone_number_* fields
-- will automatically update the corresponding specific fields
CREATE OR REPLACE FUNCTION public.sync_parent_phone_numbers()
RETURNS TRIGGER AS $$
BEGIN
    -- If parent_phone_number_1 is updated and father_phone is not set, sync it
    IF NEW.parent_phone_number_1 IS DISTINCT FROM OLD.parent_phone_number_1 THEN
        IF NEW.parent_phone_number_1 IS NOT NULL AND NEW.parent_phone_number_1 != '' THEN
            -- Only sync if father_phone is not already set
            IF NEW.father_phone IS NULL OR NEW.father_phone = '' THEN
                NEW.father_phone := NEW.parent_phone_number_1;
            END IF;
        END IF;
    END IF;
    
    -- If parent_phone_number_2 is updated and mother_phone is not set, sync it
    IF NEW.parent_phone_number_2 IS DISTINCT FROM OLD.parent_phone_number_2 THEN
        IF NEW.parent_phone_number_2 IS NOT NULL AND NEW.parent_phone_number_2 != '' THEN
            -- Only sync if mother_phone is not already set
            IF NEW.mother_phone IS NULL OR NEW.mother_phone = '' THEN
                NEW.mother_phone := NEW.parent_phone_number_2;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS trigger_sync_parent_phone_numbers ON public.students;
CREATE TRIGGER trigger_sync_parent_phone_numbers
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_parent_phone_numbers();

-- Step 6: Add validation function to ensure at least one parent contact exists
CREATE OR REPLACE FUNCTION public.validate_parent_contact(student_id_param INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    has_contact BOOLEAN;
BEGIN
    SELECT 
        (father_phone IS NOT NULL AND father_phone != '') OR
        (mother_phone IS NOT NULL AND mother_phone != '') OR
        (father_email IS NOT NULL AND father_email != '') OR
        (mother_email IS NOT NULL AND mother_email != '')
    INTO has_contact
    FROM public.students
    WHERE id = student_id_param;
    
    RETURN COALESCE(has_contact, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log the migration
INSERT INTO public.audit_log (
    school_id,
    actor_user_id,
    action,
    details
) VALUES (
    1,
    NULL,
    'parent_contact_consolidation_migration',
    jsonb_build_object(
        'migration_date', NOW(),
        'description', 'Consolidated parent contact information into father_* and mother_* fields',
        'deprecated_fields', ARRAY['parent_phone_number_1', 'parent_phone_number_2']
    )
) ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload config';
