-- Migration: Seed default SMS templates for all schools
-- Description: Creates 12 default SMS templates with standardized messages signed "- UPSS"
-- Date: 2025-12-14

-- Insert default SMS templates for all schools
-- Using ON CONFLICT DO NOTHING to prevent duplicates on re-run

-- For each school, insert the 12 default templates
INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'attendance_present' as template_name,
    'Dear Parent,

{{student_name}} attended {{class_name}} on {{date}} at {{time}}.

- UPSS' as message_content,
    ARRAY['student_name', 'date', 'time', 'class_name']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'absentee_alert' as template_name,
    'Dear Parent,

{{student_name}} was absent from {{class_name}} on {{date}}. Please follow up.

- UPSS' as message_content,
    ARRAY['student_name', 'date', 'class_name']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'late_arrival' as template_name,
    'Dear Parent,

{{student_name}} arrived late to {{class_name}} on {{date}} at {{time}}.

- UPSS' as message_content,
    ARRAY['student_name', 'date', 'time', 'class_name']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'subject_absentee' as template_name,
    'Dear Parent,

{{student_name}} was absent from {{subject}} on {{date}} in {{class_name}}.

- UPSS' as message_content,
    ARRAY['student_name', 'subject', 'date', 'class_name']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'subject_late' as template_name,
    'Dear Parent,

{{student_name}} was late to {{subject}} on {{date}} in {{class_name}}.

- UPSS' as message_content,
    ARRAY['student_name', 'subject', 'date', 'class_name']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'report_card_ready' as template_name,
    'Dear Parent,

{{student_name}}''s {{term}} report card for {{class_name}} is ready.

Download: {{download_link}}

- UPSS' as message_content,
    ARRAY['student_name', 'term', 'class_name', 'download_link']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'payment_receipt' as template_name,
    'Dear Parent,

Payment received for {{student_name}}.
Amount: {{amount}}
Reference: {{reference}}
Date: {{date}}

Thank you!

- UPSS' as message_content,
    ARRAY['student_name', 'amount', 'reference', 'date']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'homework_missing' as template_name,
    'Dear Parent,

{{student_name}} has not submitted homework for {{subject}}.

Homework: {{homework_title}}
Due: {{due_date}}

Please follow up.

- UPSS' as message_content,
    ARRAY['student_name', 'subject', 'homework_title', 'due_date']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'homework_reminder' as template_name,
    'Dear Parent,

Reminder: {{student_name}} has homework due for {{subject}}.

Homework: {{homework_title}}
Due: {{due_date}}

- UPSS' as message_content,
    ARRAY['student_name', 'subject', 'homework_title', 'due_date']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'notes_incomplete' as template_name,
    'Dear Parent,

{{student_name}}''s notes for {{subject}} are incomplete.

Topic: {{topic}}
Date: {{date}}

Please ensure notes are kept up to date.

- UPSS' as message_content,
    ARRAY['student_name', 'subject', 'topic', 'date']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'lesson_published' as template_name,
    'Dear Parent,

New lesson published for {{student_name}} in {{subject}}.

Topic: {{topic}}

Access it in the student portal.

- UPSS' as message_content,
    ARRAY['student_name', 'subject', 'topic']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'emergency_broadcast' as template_name,
    'URGENT:

{{message}}

- UPSS' as message_content,
    ARRAY['message']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

-- Log successful migration
DO $$
DECLARE
    template_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO template_count FROM sms_templates;
    RAISE NOTICE 'Migration completed. Total SMS templates: %', template_count;
END $$;
