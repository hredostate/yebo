-- ============================================
-- Kudi SMS Complete Messaging System
-- ============================================
-- This migration adds:
-- 1. Per-notification channel selection
-- 2. WhatsApp template codes
-- 3. Fallback configuration
-- 4. Public token for report cards
-- 5. Default SMS templates

-- Add new columns to kudisms_settings
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
  "report_card_ready": "whatsapp",
  "emergency_broadcast": "both"
}'::jsonb,
ADD COLUMN IF NOT EXISTS whatsapp_template_codes JSONB DEFAULT '{}'::jsonb;

-- Add columns to student_term_reports for public download links
ALTER TABLE public.student_term_reports 
ADD COLUMN IF NOT EXISTS public_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Create index on public_token for fast lookup
CREATE INDEX IF NOT EXISTS idx_student_term_reports_public_token 
ON public.student_term_reports(public_token) WHERE public_token IS NOT NULL;

-- Add channel and fallback info to sms_message_logs
ALTER TABLE public.sms_message_logs
ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'sms' CHECK (channel IN ('sms', 'whatsapp')),
ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cost_units INTEGER;

-- Insert default SMS templates
-- Note: These will only be inserted if they don't already exist for each school

-- Function to insert default templates for a school
CREATE OR REPLACE FUNCTION insert_default_sms_templates(p_school_id INTEGER)
RETURNS void AS $$
BEGIN
    -- 1. Payment Receipt
    INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
    VALUES (
        p_school_id,
        'payment_receipt',
        E'Dear Parent,\n\nPayment Receipt ✅\n\nStudent: {{student_name}}\nAmount: ₦{{amount}}\nReference: {{reference}}\nDate: {{date}}\n\nThank you for your payment.\n\n- UPSS',
        ARRAY['student_name', 'amount', 'reference', 'date'],
        true
    )
    ON CONFLICT (school_id, template_name) DO NOTHING;

    -- 2. Homework Missing
    INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
    VALUES (
        p_school_id,
        'homework_missing',
        E'Dear Parent,\n\n⚠️ {{student_name}} has not submitted homework for {{subject}}.\n\nAssignment: {{homework_title}}\nDue Date: {{due_date}}\n\nPlease follow up with your child.\n\n- UPSS',
        ARRAY['student_name', 'subject', 'homework_title', 'due_date'],
        true
    )
    ON CONFLICT (school_id, template_name) DO NOTHING;

    -- 3. Homework Reminder
    INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
    VALUES (
        p_school_id,
        'homework_reminder',
        E'Dear Parent,\n\n📚 Homework Reminder\n\n{{student_name}} has homework due soon.\n\nSubject: {{subject}}\nAssignment: {{homework_title}}\nDue Date: {{due_date}}\n\n- UPSS',
        ARRAY['student_name', 'subject', 'homework_title', 'due_date'],
        true
    )
    ON CONFLICT (school_id, template_name) DO NOTHING;

    -- 4. Notes Incomplete
    INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
    VALUES (
        p_school_id,
        'notes_incomplete',
        E'Dear Parent,\n\n📝 {{student_name}} has incomplete notes in {{subject}}.\n\nTopic: {{topic}}\nDate: {{date}}\n\nPlease ensure your child completes their notes.\n\n- UPSS',
        ARRAY['student_name', 'subject', 'topic', 'date'],
        true
    )
    ON CONFLICT (school_id, template_name) DO NOTHING;

    -- 5. Lesson Published
    INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
    VALUES (
        p_school_id,
        'lesson_published',
        E'Dear Parent,\n\n📖 New lesson available for {{student_name}}.\n\nSubject: {{subject}}\nTopic: {{topic}}\n\nView in the parent portal.\n\n- UPSS',
        ARRAY['student_name', 'subject', 'topic'],
        true
    )
    ON CONFLICT (school_id, template_name) DO NOTHING;

    -- 6. Attendance Present
    INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
    VALUES (
        p_school_id,
        'attendance_present',
        E'Dear Parent,\n\n✅ {{student_name}} has arrived at school.\n\nDate: {{date}}\nTime: {{time}}\nClass: {{class_name}}\n\nHave a great day!\n\n- UPSS',
        ARRAY['student_name', 'date', 'time', 'class_name'],
        true
    )
    ON CONFLICT (school_id, template_name) DO NOTHING;

    -- 7. Absentee Alert
    INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
    VALUES (
        p_school_id,
        'absentee_alert',
        E'Dear Parent,\n\n❌ {{student_name}} is marked ABSENT today.\n\nDate: {{date}}\nClass: {{class_name}}\n\nIf this is an error, please contact the school.\n\n- UPSS',
        ARRAY['student_name', 'date', 'class_name'],
        true
    )
    ON CONFLICT (school_id, template_name) DO NOTHING;

    -- 8. Late Arrival
    INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
    VALUES (
        p_school_id,
        'late_arrival',
        E'Dear Parent,\n\n⏰ {{student_name}} arrived LATE to school today.\n\nDate: {{date}}\nTime Arrived: {{time}}\nClass: {{class_name}}\n\nPlease ensure punctuality.\n\n- UPSS',
        ARRAY['student_name', 'date', 'time', 'class_name'],
        true
    )
    ON CONFLICT (school_id, template_name) DO NOTHING;

    -- 9. Subject Absentee
    INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
    VALUES (
        p_school_id,
        'subject_absentee',
        E'Dear Parent,\n\n❌ {{student_name}} is marked ABSENT from {{subject}} class today.\n\nDate: {{date}}\nSubject: {{subject}}\nClass: {{class_name}}\n\nIf this is an error, please contact the school.\n\n- UPSS',
        ARRAY['student_name', 'date', 'subject', 'class_name'],
        true
    )
    ON CONFLICT (school_id, template_name) DO NOTHING;

    -- 10. Subject Late
    INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
    VALUES (
        p_school_id,
        'subject_late',
        E'Dear Parent,\n\n⏰ {{student_name}} arrived LATE to {{subject}} class today.\n\nDate: {{date}}\nSubject: {{subject}}\nClass: {{class_name}}\n\nPlease ensure punctuality.\n\n- UPSS',
        ARRAY['student_name', 'date', 'subject', 'class_name'],
        true
    )
    ON CONFLICT (school_id, template_name) DO NOTHING;

    -- 11. Report Card Ready
    INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
    VALUES (
        p_school_id,
        'report_card_ready',
        E'Dear Parent,\n\n📊 Report Card Ready!\n\nThe report card for {{student_name}} is now available.\n\nStudent: {{student_name}}\nTerm: {{term}}\nClass: {{class_name}}\n\n📥 View & Download:\n{{download_link}}\n\nIf you have any questions, please contact the school.\n\n- UPSS',
        ARRAY['student_name', 'term', 'class_name', 'download_link'],
        true
    )
    ON CONFLICT (school_id, template_name) DO NOTHING;

    -- 12. Emergency Broadcast
    INSERT INTO public.sms_templates (school_id, template_name, message_content, variables, is_active)
    VALUES (
        p_school_id,
        'emergency_broadcast',
        E'🚨 URGENT NOTICE\n\n{{message}}\n\n- UPSS',
        ARRAY['message'],
        true
    )
    ON CONFLICT (school_id, template_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Auto-insert default templates for all existing schools
DO $$
DECLARE
    school_record RECORD;
BEGIN
    FOR school_record IN SELECT id FROM public.schools
    LOOP
        PERFORM insert_default_sms_templates(school_record.id);
    END LOOP;
END $$;

-- Add comment
COMMENT ON FUNCTION insert_default_sms_templates(INTEGER) IS 'Inserts default SMS templates for a school if they do not already exist';

-- Update notification types check constraint to include new types
ALTER TABLE public.sms_notifications DROP CONSTRAINT IF EXISTS sms_notifications_notification_type_check;
-- Note: PostgreSQL doesn't allow adding CHECK constraints with IF NOT EXISTS
-- This will create a new constraint that allows all notification types
-- If the constraint doesn't exist, this will work. If it does, it may fail but that's okay.

DO $$
BEGIN
    ALTER TABLE public.sms_notifications 
    ADD CONSTRAINT sms_notifications_notification_type_check 
    CHECK (notification_type IN (
        'homework_reminder', 
        'homework_missing', 
        'notes_incomplete', 
        'lesson_published', 
        'payment_receipt', 
        'attendance_present',
        'absentee_alert',
        'late_arrival',
        'subject_absentee',
        'subject_late',
        'report_card_ready',
        'emergency_broadcast',
        'general'
    ));
EXCEPTION
    WHEN duplicate_object THEN
        -- Constraint already exists, skip
        NULL;
END $$;
