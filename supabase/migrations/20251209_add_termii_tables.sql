-- ============================================
-- Termii WhatsApp Integration Tables
-- ============================================

-- Table for storing Termii API settings per school
CREATE TABLE IF NOT EXISTS public.termii_settings (
    id SERIAL PRIMARY KEY,
    school_id INTEGER UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
    api_key TEXT NOT NULL,
    device_id TEXT, -- WhatsApp device ID from Termii dashboard
    base_url TEXT DEFAULT 'https://api.ng.termii.com',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for logging all WhatsApp messages sent via Termii
CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    template_id TEXT,
    message_type TEXT NOT NULL CHECK (message_type IN ('template', 'template_media', 'conversational')),
    message_content JSONB,
    media_url TEXT,
    termii_message_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on termii_settings
ALTER TABLE public.termii_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins and accountants can view/manage Termii settings
DROP POLICY IF EXISTS "Admins can manage termii settings" ON public.termii_settings;
CREATE POLICY "Admins can manage termii settings" ON public.termii_settings
FOR ALL
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles
        WHERE id = auth.uid()
        AND (role = 'Admin' OR role = 'Accountant')
    )
);

-- Enable RLS on whatsapp_message_logs
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and accountants can view logs for their school
DROP POLICY IF EXISTS "School staff can view whatsapp logs" ON public.whatsapp_message_logs;
CREATE POLICY "School staff can view whatsapp logs" ON public.whatsapp_message_logs
FOR SELECT
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles
        WHERE id = auth.uid()
        AND (role = 'Admin' OR role = 'Accountant' OR role = 'Principal')
    )
);

-- Policy: Service role can insert and update logs
DROP POLICY IF EXISTS "Service role can manage whatsapp logs" ON public.whatsapp_message_logs;
CREATE POLICY "Service role can manage whatsapp logs" ON public.whatsapp_message_logs
FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_school_id ON public.whatsapp_message_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_status ON public.whatsapp_message_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_created_at ON public.whatsapp_message_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_termii_message_id ON public.whatsapp_message_logs(termii_message_id);

-- Add comment for documentation
COMMENT ON TABLE public.termii_settings IS 'Stores Termii API configuration per school for WhatsApp messaging';
COMMENT ON TABLE public.whatsapp_message_logs IS 'Logs all WhatsApp messages sent via Termii API including delivery status';
