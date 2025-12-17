-- Migration: Add Student Credential Messaging Templates
-- Description: Adds templates for sending student login credentials and password resets to parents
-- Date: 2025-12-17

-- Insert student_credentials template for all schools
INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'student_credentials' as template_name,
    E'Hello! Login credentials for {{student_name}} at {{school_name}}:

Username: {{username}}
Password: {{password}}

Please keep this secure and change password after first login.

- UPSS' as message_content,
    ARRAY['student_name', 'username', 'password', 'school_name']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

-- Insert password_reset template for all schools
INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'password_reset' as template_name,
    E'Hello! Password has been reset for {{student_name}} at {{school_name}}:

New Password: {{password}}

Please change this password after logging in.

- UPSS' as message_content,
    ARRAY['student_name', 'password', 'school_name']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

-- Log successful migration
DO $$
DECLARE
    credential_templates_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO credential_templates_count 
    FROM sms_templates 
    WHERE template_name IN ('student_credentials', 'password_reset');
    
    RAISE NOTICE 'Migration completed. Credential templates created: %', credential_templates_count;
END $$;
