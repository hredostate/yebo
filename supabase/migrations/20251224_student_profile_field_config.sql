-- Migration: Student Profile Field Configuration
-- Description: Add configuration table for managing which fields students can edit
-- Date: 2025-12-24

-- Create student_profile_field_configs table
CREATE TABLE IF NOT EXISTS public.student_profile_field_configs (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES public.school_config(school_id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_label VARCHAR(200) NOT NULL,
    field_type VARCHAR(50) NOT NULL DEFAULT 'text', -- text, email, phone, date, textarea, select
    is_custom BOOLEAN NOT NULL DEFAULT false,
    is_editable_by_student BOOLEAN NOT NULL DEFAULT true,
    is_required BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    field_options JSONB DEFAULT NULL, -- For select fields: {"options": ["Option 1", "Option 2"]}
    placeholder_text VARCHAR(200),
    validation_rules JSONB DEFAULT NULL, -- Custom validation rules
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, field_name)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profile_field_configs_school 
    ON public.student_profile_field_configs(school_id);
CREATE INDEX IF NOT EXISTS idx_profile_field_configs_editable 
    ON public.student_profile_field_configs(school_id, is_editable_by_student);

-- Enable RLS
ALTER TABLE public.student_profile_field_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow all authenticated users to read field configurations for their school
CREATE POLICY "Users can view field configs for their school"
ON public.student_profile_field_configs FOR SELECT
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
        UNION
        SELECT school_id FROM public.student_profiles WHERE id = auth.uid()
    )
);

-- Only admins can insert/update/delete field configurations
CREATE POLICY "Admins can manage field configs"
ON public.student_profile_field_configs FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND school_id = student_profile_field_configs.school_id
        AND role IN ('Admin', 'Principal')
    )
);

-- Create custom field value storage table for extensibility
CREATE TABLE IF NOT EXISTS public.student_custom_field_values (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    field_config_id INTEGER NOT NULL REFERENCES public.student_profile_field_configs(id) ON DELETE CASCADE,
    field_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, field_config_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_custom_field_values_student 
    ON public.student_custom_field_values(student_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_field 
    ON public.student_custom_field_values(field_config_id);

-- Enable RLS
ALTER TABLE public.student_custom_field_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom field values
-- Students can read their own custom field values
CREATE POLICY "Students can view their custom field values"
ON public.student_custom_field_values FOR SELECT
USING (
    student_id IN (
        SELECT student_record_id FROM public.student_profiles WHERE id = auth.uid()
    )
);

-- Students can update their own custom field values only if the field is editable
CREATE POLICY "Students can update editable custom field values"
ON public.student_custom_field_values FOR UPDATE
USING (
    student_id IN (
        SELECT student_record_id FROM public.student_profiles WHERE id = auth.uid()
    )
    AND field_config_id IN (
        SELECT id FROM public.student_profile_field_configs 
        WHERE is_editable_by_student = true
    )
)
WITH CHECK (
    student_id IN (
        SELECT student_record_id FROM public.student_profiles WHERE id = auth.uid()
    )
    AND field_config_id IN (
        SELECT id FROM public.student_profile_field_configs 
        WHERE is_editable_by_student = true
    )
);

-- Students can insert their own custom field values only if the field is editable
CREATE POLICY "Students can insert editable custom field values"
ON public.student_custom_field_values FOR INSERT
WITH CHECK (
    student_id IN (
        SELECT student_record_id FROM public.student_profiles WHERE id = auth.uid()
    )
    AND field_config_id IN (
        SELECT id FROM public.student_profile_field_configs 
        WHERE is_editable_by_student = true
    )
);

-- Staff can view all custom field values in their school
CREATE POLICY "Staff can view custom field values in their school"
ON public.student_custom_field_values FOR SELECT
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
);

-- Admins and authorized staff can manage all custom field values in their school
CREATE POLICY "Authorized staff can manage custom field values"
ON public.student_custom_field_values FOR ALL
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles 
        WHERE id = auth.uid()
        AND role IN ('Admin', 'Principal', 'Team Lead')
    )
);

-- Insert default field configurations for built-in fields
-- This will be done per school when they first access the settings
-- For now, we'll create a function to seed defaults

CREATE OR REPLACE FUNCTION seed_default_profile_field_configs(p_school_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only insert if no configs exist for this school
    IF NOT EXISTS (SELECT 1 FROM student_profile_field_configs WHERE school_id = p_school_id) THEN
        -- Photo field
        INSERT INTO student_profile_field_configs 
            (school_id, field_name, field_label, field_type, is_custom, is_editable_by_student, display_order)
        VALUES 
            (p_school_id, 'photo_url', 'Profile Photo', 'photo', false, true, 1);
        
        -- Personal contact
        INSERT INTO student_profile_field_configs 
            (school_id, field_name, field_label, field_type, is_custom, is_editable_by_student, display_order, placeholder_text)
        VALUES 
            (p_school_id, 'phone', 'Phone Number', 'phone', false, true, 10, 'e.g., +234 800 000 0000');
        
        INSERT INTO student_profile_field_configs 
            (school_id, field_name, field_label, field_type, is_custom, is_editable_by_student, display_order, placeholder_text)
        VALUES 
            (p_school_id, 'email', 'Email', 'email', false, false, 11, 'student@school.com');
        
        -- Address fields
        INSERT INTO student_profile_field_configs 
            (school_id, field_name, field_label, field_type, is_custom, is_editable_by_student, display_order)
        VALUES 
            (p_school_id, 'street_address', 'Street Address', 'textarea', false, true, 20),
            (p_school_id, 'city', 'City', 'text', false, true, 21),
            (p_school_id, 'state', 'State/Province', 'text', false, true, 22),
            (p_school_id, 'postal_code', 'Postal Code', 'text', false, true, 23),
            (p_school_id, 'country', 'Country', 'text', false, true, 24);
        
        -- Emergency contact fields
        INSERT INTO student_profile_field_configs 
            (school_id, field_name, field_label, field_type, is_custom, is_editable_by_student, display_order)
        VALUES 
            (p_school_id, 'emergency_contact_name', 'Emergency Contact Name', 'text', false, true, 30),
            (p_school_id, 'emergency_contact_phone', 'Emergency Contact Phone', 'phone', false, true, 31),
            (p_school_id, 'emergency_contact_relationship', 'Emergency Contact Relationship', 'select', false, true, 32);
        
        -- Parent phone numbers (read-only by default for students)
        INSERT INTO student_profile_field_configs 
            (school_id, field_name, field_label, field_type, is_custom, is_editable_by_student, display_order)
        VALUES 
            (p_school_id, 'parent_phone_number_1', 'Parent Phone 1', 'phone', false, false, 40),
            (p_school_id, 'parent_phone_number_2', 'Parent Phone 2', 'phone', false, false, 41);
    END IF;
END;
$$;

-- Add comment for documentation
COMMENT ON TABLE public.student_profile_field_configs IS 
    'Configuration for student profile fields - defines which fields are editable by students and supports custom fields';
COMMENT ON TABLE public.student_custom_field_values IS 
    'Stores values for custom student profile fields';
COMMENT ON FUNCTION seed_default_profile_field_configs IS 
    'Seeds default field configurations for a school - should be called when school first accesses student profile settings';
