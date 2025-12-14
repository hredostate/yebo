-- ============================================
-- Migration from Termii to Kudi SMS
-- ============================================
-- This migration replaces Termii WhatsApp integration with Kudi SMS API

-- Create Kudi SMS Settings table
CREATE TABLE IF NOT EXISTS public.kudisms_settings (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    campus_id INTEGER REFERENCES public.campuses(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, campus_id)
);

-- Create SMS Message Logs table (replacing whatsapp_message_logs)
CREATE TABLE IF NOT EXISTS public.sms_message_logs (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN ('personalised', 'auto_compose')),
    message_content TEXT NOT NULL,
    kudi_response JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create SMS Templates table (replacing whatsapp_templates)
CREATE TABLE IF NOT EXISTS public.sms_templates (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    template_name TEXT NOT NULL,
    message_content TEXT NOT NULL,
    variables TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, template_name)
);

-- Create SMS Notifications table (replacing whatsapp_notifications)
CREATE TABLE IF NOT EXISTS public.sms_notifications (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    recipient_phone TEXT NOT NULL,
    template_name TEXT,
    message_content TEXT,
    notification_type TEXT NOT NULL,
    reference_id INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    sent_by TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on kudisms_settings
ALTER TABLE public.kudisms_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admin can manage, Accountant and Principal can view
DROP POLICY IF EXISTS "Admins can manage kudisms settings" ON public.kudisms_settings;
CREATE POLICY "Admins can manage kudisms settings" ON public.kudisms_settings
FOR ALL
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles
        WHERE id = auth.uid()
        AND role = 'Admin'
    )
);

DROP POLICY IF EXISTS "Accountants and Principals can view kudisms settings" ON public.kudisms_settings;
CREATE POLICY "Accountants and Principals can view kudisms settings" ON public.kudisms_settings
FOR SELECT
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles
        WHERE id = auth.uid()
        AND (role = 'Accountant' OR role = 'Principal')
    )
);

-- Enable RLS on sms_message_logs
ALTER TABLE public.sms_message_logs ENABLE ROW LEVEL SECURITY;

-- Policy: School staff can view SMS logs for their school
DROP POLICY IF EXISTS "School staff can view sms logs" ON public.sms_message_logs;
CREATE POLICY "School staff can view sms logs" ON public.sms_message_logs
FOR SELECT
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles
        WHERE id = auth.uid()
        AND (role = 'Admin' OR role = 'Accountant' OR role = 'Principal')
    )
);

-- Policy: Service role can manage SMS logs
DROP POLICY IF EXISTS "Service role can manage sms logs" ON public.sms_message_logs;
CREATE POLICY "Service role can manage sms logs" ON public.sms_message_logs
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable RLS on sms_templates
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage SMS templates
DROP POLICY IF EXISTS "Admins can manage sms templates" ON public.sms_templates;
CREATE POLICY "Admins can manage sms templates" ON public.sms_templates
FOR ALL
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles
        WHERE id = auth.uid()
        AND role = 'Admin'
    )
);

-- Enable RLS on sms_notifications
ALTER TABLE public.sms_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: School staff can view SMS notifications
DROP POLICY IF EXISTS "School staff can view sms notifications" ON public.sms_notifications;
CREATE POLICY "School staff can view sms notifications" ON public.sms_notifications
FOR SELECT
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles
        WHERE id = auth.uid()
        AND (role = 'Admin' OR role = 'Principal' OR role = 'Teacher')
    )
);

-- Policy: Service role can manage SMS notifications
DROP POLICY IF EXISTS "Service role can manage sms notifications" ON public.sms_notifications;
CREATE POLICY "Service role can manage sms notifications" ON public.sms_notifications
FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_kudisms_settings_school_id ON public.kudisms_settings(school_id);
CREATE INDEX IF NOT EXISTS idx_kudisms_settings_campus_id ON public.kudisms_settings(campus_id);
CREATE INDEX IF NOT EXISTS idx_sms_message_logs_school_id ON public.sms_message_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_sms_message_logs_status ON public.sms_message_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_message_logs_created_at ON public.sms_message_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_templates_school_id ON public.sms_templates(school_id);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_school_id ON public.sms_notifications(school_id);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_student_id ON public.sms_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_created_at ON public.sms_notifications(created_at DESC);

-- Add triggers to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_kudisms_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_kudisms_settings_timestamp ON public.kudisms_settings;
CREATE TRIGGER update_kudisms_settings_timestamp
    BEFORE UPDATE ON public.kudisms_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_kudisms_settings_updated_at();

CREATE OR REPLACE FUNCTION update_sms_message_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sms_message_logs_timestamp ON public.sms_message_logs;
CREATE TRIGGER update_sms_message_logs_timestamp
    BEFORE UPDATE ON public.sms_message_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_sms_message_logs_updated_at();

CREATE OR REPLACE FUNCTION update_sms_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sms_templates_timestamp ON public.sms_templates;
CREATE TRIGGER update_sms_templates_timestamp
    BEFORE UPDATE ON public.sms_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_sms_templates_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.kudisms_settings IS 'Stores Kudi SMS API configuration per school for SMS messaging';
COMMENT ON TABLE public.sms_message_logs IS 'Logs all SMS messages sent via Kudi SMS API';
COMMENT ON TABLE public.sms_templates IS 'Stores reusable SMS message templates';
COMMENT ON TABLE public.sms_notifications IS 'Tracks SMS notifications sent to parents/guardians';

-- Note: Termii tables (termii_settings, whatsapp_message_logs, whatsapp_templates, whatsapp_notifications)
-- are NOT automatically dropped to preserve historical data. Administrators can manually drop them
-- after verifying the migration is successful and no historical data is needed.
