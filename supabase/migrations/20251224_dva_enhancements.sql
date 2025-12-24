-- DVA Management Enhancements Migration
-- Adds SMS template for DVA account creation notifications

-- Ensure campus_id exists on classes table (should already exist from schema)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classes' AND column_name='campus_id') THEN
        ALTER TABLE public.classes ADD COLUMN campus_id INTEGER REFERENCES public.campuses(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for faster campus lookups on classes if not exists
CREATE INDEX IF NOT EXISTS idx_classes_campus_id ON public.classes(campus_id);

-- Insert SMS template for DVA account creation
-- This template will be used to notify parents when a dedicated virtual account is created
INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    s.id,
    'dva_account_created',
    E'Dear Parent,\n\nA dedicated payment account has been created for {{student_name}}.\n\n🏦 Bank: {{bank_name}}\n💳 Account Number: {{account_number}}\n👤 Account Name: {{account_name}}\n\nUse this account for all school fee payments.\n\nThank you.\n\n- {{school_name}}',
    ARRAY['student_name', 'bank_name', 'account_number', 'account_name', 'school_name'],
    true
FROM public.schools s
ON CONFLICT (school_id, template_name) DO NOTHING;
