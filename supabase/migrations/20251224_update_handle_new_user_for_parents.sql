-- Migration: Update handle_new_user function to support parent user type
-- This extends the auth trigger to automatically create parent_profiles entries

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    is_first_user BOOLEAN;
    user_type TEXT;
    skip_student_creation BOOLEAN;
    new_student_id INTEGER;
BEGIN
    user_type := new.raw_user_meta_data->>'user_type';
    skip_student_creation := (new.raw_user_meta_data->>'skip_student_creation')::boolean;

    IF user_type = 'student' THEN
        IF skip_student_creation IS NOT TRUE THEN
            -- First, create the student record in students table
            INSERT INTO public.students (school_id, name, user_id, status)
            VALUES (
                COALESCE((new.raw_user_meta_data->>'school_id')::int, 1),
                COALESCE(new.raw_user_meta_data->>'name', 'New Student'),
                new.id,
                'Active'
            )
            RETURNING id INTO new_student_id;
            
            -- Then create student_profiles with the student_record_id populated
            INSERT INTO public.student_profiles (id, full_name, school_id, class_id, arm_id, student_record_id)
            VALUES (
                new.id,
                COALESCE(new.raw_user_meta_data->>'name', 'New Student'),
                COALESCE((new.raw_user_meta_data->>'school_id')::int, 1),
                (new.raw_user_meta_data->>'class_id')::int,
                (new.raw_user_meta_data->>'arm_id')::int,
                new_student_id
            ) ON CONFLICT (id) DO NOTHING;
        ELSE
            -- If skip_student_creation is TRUE, just create the profile without student_record_id
            -- The student_record_id will be set later when linking to an existing student
            INSERT INTO public.student_profiles (id, full_name, school_id, class_id, arm_id)
            VALUES (
                new.id,
                COALESCE(new.raw_user_meta_data->>'name', 'New Student'),
                COALESCE((new.raw_user_meta_data->>'school_id')::int, 1),
                (new.raw_user_meta_data->>'class_id')::int,
                (new.raw_user_meta_data->>'arm_id')::int
            ) ON CONFLICT (id) DO NOTHING;
        END IF;

    ELSIF user_type = 'parent' THEN
        -- Create parent profile
        INSERT INTO public.parent_profiles (id, school_id, name, phone_number)
        VALUES (
            new.id,
            COALESCE((new.raw_user_meta_data->>'school_id')::int, 1),
            COALESCE(new.raw_user_meta_data->>'name', 'Parent'),
            COALESCE(new.raw_user_meta_data->>'phone_number', '')
        ) ON CONFLICT (id) DO NOTHING;

    ELSIF user_type = 'staff' OR user_type IS NULL THEN
        SELECT count(*) = 0 INTO is_first_user FROM public.user_profiles;

        INSERT INTO public.user_profiles (id, school_id, name, email, role)
        VALUES (
            new.id,
            1,
            COALESCE(new.raw_user_meta_data->>'name', new.email),
            new.email,
            CASE WHEN is_first_user THEN 'Admin' ELSE 'Teacher' END
        ) ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger already exists, no need to recreate it
