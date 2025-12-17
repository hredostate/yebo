-- ============================================
-- Extend Kudi SMS for Complete Messaging System
-- ============================================
-- This migration extends the Kudi SMS integration with:
-- - Per-notification channel selection (SMS/WhatsApp/Both)
-- - WhatsApp template codes
-- - Fallback settings
-- - Report card public links with token expiry
-- - Default SMS templates

-- 1.1 Add new columns to kudisms_settings
ALTER TABLE public.kudisms_settings 
ADD COLUMN IF NOT EXISTS enable_fallback BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_channels JSONB DEFAULT '{
  "payment_receipt": "whatsapp",
  "homework_missing": "sms",
  "homework_reminder": "sms",
  "notes_incomplete": "sms",
  "lesson_published": "whatsapp",
  "attendance_present": "whatsapp",
  "absentee_alert": "both",
  "late_arrival": "both",
  "subject_absentee": "sms",
  "subject_late": "sms",
  "report_card_ready": "sms",
  "emergency_broadcast": "both"
}'::jsonb,
ADD COLUMN IF NOT EXISTS whatsapp_template_codes JSONB DEFAULT '{}'::jsonb;

-- 1.2 Add columns to student_term_reports for public links
ALTER TABLE public.student_term_reports 
ADD COLUMN IF NOT EXISTS public_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_student_term_reports_public_token 
ON public.student_term_reports(public_token) WHERE public_token IS NOT NULL;

-- 1.3 sms_templates table already exists from previous migration
-- Just ensure it has the correct structure
DO $$ 
BEGIN
    -- Verify the table exists and has the expected columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sms_templates' 
                   AND column_name = 'variables') THEN
        RAISE EXCEPTION 'sms_templates table is missing expected columns';
    END IF;
END $$;

-- Part 7: Insert Default SMS Templates
-- These templates are signed with "- UPSS" and include variables

INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    s.id as school_id,
    'attendance_present',
    E'Dear Parent,\n\n✅ {{student_name}} has arrived at school.\n\nDate: {{date}}\nTime: {{time}}\nClass: {{class_name}}\n\nHave a great day!\n\n- UPSS',
    ARRAY['student_name', 'date', 'time', 'class_name'],
    true
FROM public.schools s
WHERE NOT EXISTS (
    SELECT 1 FROM public.sms_templates 
    WHERE school_id = s.id AND template_name = 'attendance_present'
);

INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    s.id as school_id,
    'absentee_alert',
    E'Dear Parent,\n\n❌ {{student_name}} is marked ABSENT today.\n\nDate: {{date}}\nClass: {{class_name}}\n\nIf this is an error, please contact the school.\n\n- UPSS',
    ARRAY['student_name', 'date', 'class_name'],
    true
FROM public.schools s
WHERE NOT EXISTS (
    SELECT 1 FROM public.sms_templates 
    WHERE school_id = s.id AND template_name = 'absentee_alert'
);

INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    s.id as school_id,
    'late_arrival',
    E'Dear Parent,\n\n⏰ {{student_name}} arrived LATE to school today.\n\nDate: {{date}}\nTime Arrived: {{time}}\nClass: {{class_name}}\n\nPlease ensure punctuality.\n\n- UPSS',
    ARRAY['student_name', 'date', 'time', 'class_name'],
    true
FROM public.schools s
WHERE NOT EXISTS (
    SELECT 1 FROM public.sms_templates 
    WHERE school_id = s.id AND template_name = 'late_arrival'
);

INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    s.id as school_id,
    'subject_absentee',
    E'Dear Parent,\n\n❌ {{student_name}} is marked ABSENT from {{subject}} class today.\n\nDate: {{date}}\nSubject: {{subject}}\nClass: {{class_name}}\n\nIf this is an error, please contact the school.\n\n- UPSS',
    ARRAY['student_name', 'subject', 'date', 'class_name'],
    true
FROM public.schools s
WHERE NOT EXISTS (
    SELECT 1 FROM public.sms_templates 
    WHERE school_id = s.id AND template_name = 'subject_absentee'
);

INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    s.id as school_id,
    'subject_late',
    E'Dear Parent,\n\n⏰ {{student_name}} arrived LATE to {{subject}} class today.\n\nDate: {{date}}\nSubject: {{subject}}\nClass: {{class_name}}\n\nPlease ensure punctuality.\n\n- UPSS',
    ARRAY['student_name', 'subject', 'date', 'class_name'],
    true
FROM public.schools s
WHERE NOT EXISTS (
    SELECT 1 FROM public.sms_templates 
    WHERE school_id = s.id AND template_name = 'subject_late'
);

INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    s.id as school_id,
    'report_card_ready',
    E'Dear Parent,\n\nYour child\'s report card is now ready! 📊\n\nStudent: {{student_name}}\nClass: {{class_name}}\nTerm: {{term}}\n\nView & Download Here:\n{{download_link}}\n\nThis link is valid for 30 days. For any questions, please contact the school office.\n\nBest regards,\nUPSS Administration',
    ARRAY['student_name', 'term', 'class_name', 'download_link'],
    true
FROM public.schools s
WHERE NOT EXISTS (
    SELECT 1 FROM public.sms_templates 
    WHERE school_id = s.id AND template_name = 'report_card_ready'
);

-- Add payment_receipt template if it doesn't exist
INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    s.id as school_id,
    'payment_receipt',
    E'Dear Parent,\n\nPayment received for {{student_name}}.\n\nAmount: ₦{{amount}}\nDate: {{date}}\nReference: {{reference}}\n\nThank you!\n\n- UPSS',
    ARRAY['student_name', 'amount', 'date', 'reference'],
    true
FROM public.schools s
WHERE NOT EXISTS (
    SELECT 1 FROM public.sms_templates 
    WHERE school_id = s.id AND template_name = 'payment_receipt'
);

-- Add emergency_broadcast template if it doesn't exist
INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
SELECT 
    s.id as school_id,
    'emergency_broadcast',
    E'URGENT NOTICE\n\n{{message}}\n\nPlease contact the school immediately for more information.\n\n- UPSS',
    ARRAY['message'],
    true
FROM public.schools s
WHERE NOT EXISTS (
    SELECT 1 FROM public.sms_templates 
    WHERE school_id = s.id AND template_name = 'emergency_broadcast'
);

-- Add comments for new columns
COMMENT ON COLUMN public.kudisms_settings.enable_fallback IS 'Enable automatic fallback from WhatsApp to SMS if WhatsApp fails';
COMMENT ON COLUMN public.kudisms_settings.notification_channels IS 'Per-notification type channel preference (sms, whatsapp, both)';
COMMENT ON COLUMN public.kudisms_settings.whatsapp_template_codes IS 'Kudi SMS WhatsApp template codes from dashboard';
COMMENT ON COLUMN public.student_term_reports.public_token IS 'Unique token for public report access via shareable link';
COMMENT ON COLUMN public.student_term_reports.token_expires_at IS 'Expiration timestamp for public access token (typically 30 days)';
