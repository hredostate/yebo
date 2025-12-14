-- ============================================
-- Kudi SMS Integration Migration
-- Replaces Termii with Kudi SMS for WhatsApp and SMS messaging
-- ============================================

-- Create kudisms_settings table
CREATE TABLE IF NOT EXISTS public.kudisms_settings (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    campus_id INTEGER REFERENCES public.campuses(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    payment_receipt_template_code TEXT,
    fee_reminder_template_code TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index that handles NULL campus_id properly
-- For school-wide settings, campus_id should be NULL and there should be only one per school
CREATE UNIQUE INDEX kudisms_settings_school_campus_unique 
ON public.kudisms_settings (school_id, COALESCE(campus_id, -1));

-- Create kudisms_message_logs table
CREATE TABLE IF NOT EXISTS public.kudisms_message_logs (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    template_code TEXT,
    message_type TEXT NOT NULL CHECK (message_type IN ('whatsapp', 'personalised_sms', 'auto_compose_sms')),
    message_content JSONB,
    parameters TEXT,
    kudi_message_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    error_code TEXT,
    error_message TEXT,
    cost DECIMAL(10, 2),
    balance TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on kudisms_settings
ALTER TABLE public.kudisms_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins and accountants can view/manage Kudi SMS settings
DROP POLICY IF EXISTS "Admins can manage kudisms settings" ON public.kudisms_settings;
CREATE POLICY "Admins can manage kudisms settings" ON public.kudisms_settings
FOR ALL
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles
        WHERE id = auth.uid()
        AND (role = 'Admin' OR role = 'Accountant')
    )
);

-- Enable RLS on kudisms_message_logs
ALTER TABLE public.kudisms_message_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and accountants can view logs for their school
DROP POLICY IF EXISTS "School staff can view kudisms logs" ON public.kudisms_message_logs;
CREATE POLICY "School staff can view kudisms logs" ON public.kudisms_message_logs
FOR SELECT
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles
        WHERE id = auth.uid()
        AND (role = 'Admin' OR role = 'Accountant' OR role = 'Principal')
    )
);

-- Policy: Service role can insert and update logs
DROP POLICY IF EXISTS "Service role can manage kudisms logs" ON public.kudisms_message_logs;
CREATE POLICY "Service role can manage kudisms logs" ON public.kudisms_message_logs
FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_kudisms_message_logs_school_id ON public.kudisms_message_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_kudisms_message_logs_status ON public.kudisms_message_logs(status);
CREATE INDEX IF NOT EXISTS idx_kudisms_message_logs_created_at ON public.kudisms_message_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kudisms_message_logs_kudi_message_id ON public.kudisms_message_logs(kudi_message_id);
CREATE INDEX IF NOT EXISTS idx_kudisms_settings_school_campus ON public.kudisms_settings(school_id, campus_id);

-- Add comments for documentation
COMMENT ON TABLE public.kudisms_settings IS 'Stores Kudi SMS API configuration per school/campus for WhatsApp and SMS messaging';
COMMENT ON TABLE public.kudisms_message_logs IS 'Logs all WhatsApp and SMS messages sent via Kudi SMS API including delivery status';

-- Migration note: Termii tables (termii_settings, whatsapp_message_logs) can be dropped after verification
-- For now, we keep them for reference. They can be removed in a future migration:
-- DROP TABLE IF EXISTS public.termii_settings CASCADE;
-- DROP TABLE IF EXISTS public.whatsapp_message_logs CASCADE;
