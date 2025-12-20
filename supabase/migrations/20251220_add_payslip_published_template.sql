-- Migration: Add payslip_published SMS template
-- Description: Creates SMS template for notifying staff when their payslips are published
-- Date: 2025-12-20

-- Insert payslip_published template for all schools
-- Using ON CONFLICT DO NOTHING to prevent duplicates on re-run

INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    schools.id as school_id,
    'payslip_published' as template_name,
    'Dear {{staff_name}},

Your payslip for {{period}} is now ready for review.

Please login to review and approve your payslip.

Thank you.' as message_content,
    ARRAY['staff_name', 'period']::text[] as variables,
    true as is_active
FROM schools
ON CONFLICT (school_id, template_name) DO NOTHING;

-- Log successful migration
DO $$
DECLARE
    template_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO template_count FROM sms_templates WHERE template_name = 'payslip_published';
    RAISE NOTICE 'Migration completed. payslip_published templates created: %', template_count;
END $$;
