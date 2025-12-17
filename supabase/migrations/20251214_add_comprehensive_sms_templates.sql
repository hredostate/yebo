-- Migration: Add Comprehensive SMS Templates
-- Description: Adds missing SMS templates (fee_reminder, exam_schedule, event_announcement, general_announcement)
--              and ensures all 12 essential templates exist for all schools
-- Date: 2025-12-14

-- Insert fee_reminder template for all schools
INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'fee_reminder' as template_name,
    'Dear Parent,

{{student_name}} has an outstanding fee of ₦{{amount}} due on {{due_date}} for {{term}}.

Please make payment to avoid late fees.

Thank you.

- UPSS' as message_content,
    ARRAY['student_name', 'amount', 'due_date', 'term']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

-- Insert exam_schedule template for all schools
INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'exam_schedule' as template_name,
    'Dear Parent,

{{student_name}} has an upcoming exam.

Subject: {{subject}}
Date: {{exam_date}}
Time: {{time}}

Please ensure your child is prepared.

Thank you.

- UPSS' as message_content,
    ARRAY['student_name', 'subject', 'exam_date', 'time']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

-- Insert event_announcement template for all schools
INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'event_announcement' as template_name,
    'Dear Parent,

School Event: {{event_name}}

Date: {{event_date}}

{{message}}

Thank you.

- UPSS' as message_content,
    ARRAY['event_name', 'event_date', 'message']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

-- Insert general_announcement template for all schools
INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'general_announcement' as template_name,
    'Dear Parent,

{{message}}

Thank you.

- UPSS' as message_content,
    ARRAY['message']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

-- Insert emergency_alert template for all schools (mapped to emergency_broadcast)
INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'emergency_alert' as template_name,
    'Dear Parent,

URGENT NOTICE:

{{message}}

Date: {{date}}
Time: {{time}}

Thank you.

- UPSS' as message_content,
    ARRAY['message', 'date', 'time']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

-- Update payment_receipt template to include Nigerian Naira symbol if it doesn't already
UPDATE sms_templates
SET message_content = 'Dear Parent,

Payment received for {{student_name}}.

Amount: ₦{{amount}}
Reference: {{reference}}
Date: {{date}}

Thank you.

- UPSS',
    variables = ARRAY['student_name', 'amount', 'reference', 'date']::text[]
WHERE template_name = 'payment_receipt'
  AND message_content NOT LIKE '%₦%';

-- Update attendance_present template to match required format
UPDATE sms_templates
SET message_content = 'Dear Parent,

{{student_name}} has arrived at school.

Date: {{date}}
Time: {{time}}
Class: {{class_name}}

Thank you.

- UPSS',
    variables = ARRAY['student_name', 'date', 'time', 'class_name']::text[]
WHERE template_name = 'attendance_present';

-- Update absentee_alert template to match required format
UPDATE sms_templates
SET message_content = 'Dear Parent,

{{student_name}} is marked absent from {{class_name}} on {{date}}.

Please contact the school if this is an error.

Thank you.

- UPSS',
    variables = ARRAY['student_name', 'date', 'class_name']::text[]
WHERE template_name = 'absentee_alert';

-- Update late_arrival template to match required format
UPDATE sms_templates
SET message_content = 'Dear Parent,

{{student_name}} arrived late to {{class_name}} on {{date}} at {{time}}.

Please ensure punctuality.

Thank you.

- UPSS',
    variables = ARRAY['student_name', 'date', 'time', 'class_name']::text[]
WHERE template_name = 'late_arrival';

-- Update report_card_ready template to match required format
UPDATE sms_templates
SET message_content = E'Dear Parent,

Your child\'s report card is now ready! 📊

Student: {{student_name}}
Class: {{class_name}}
Term: {{term}}

View & Download Here:
{{download_link}}

This link is valid for 30 days. For any questions, please contact the school office.

Best regards,
UPSS Administration',
    variables = ARRAY['student_name', 'term', 'class_name', 'download_link']::text[]
WHERE template_name = 'report_card_ready';

-- Update homework_reminder template to match required format
UPDATE sms_templates
SET message_content = 'Dear Parent,

{{student_name}} has homework due on {{due_date}} for {{subject}}.

Homework: {{homework_title}}

Please ensure it is submitted on time.

Thank you.

- UPSS',
    variables = ARRAY['student_name', 'due_date', 'subject', 'homework_title']::text[]
WHERE template_name = 'homework_reminder';

-- Update homework_missing template to match required format
UPDATE sms_templates
SET message_content = 'Dear Parent,

{{student_name}} has not submitted homework for {{subject}}.

Homework: {{homework_title}}
Due Date: {{due_date}}

Please follow up with your child.

Thank you.

- UPSS',
    variables = ARRAY['student_name', 'subject', 'homework_title', 'due_date']::text[]
WHERE template_name = 'homework_missing';

-- Log successful migration
DO $$
DECLARE
    template_count INTEGER;
    school_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO template_count FROM sms_templates;
    SELECT COUNT(DISTINCT school_id) INTO school_count FROM sms_templates;
    RAISE NOTICE 'Migration completed. Total SMS templates: %, Schools with templates: %', template_count, school_count;
END $$;
