-- Create Termii Settings table
CREATE TABLE IF NOT EXISTS public.termii_settings (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    campus_id INTEGER REFERENCES public.campuses(id) ON DELETE CASCADE,
    api_key TEXT NOT NULL,
    device_id TEXT, -- for WhatsApp
    base_url TEXT DEFAULT 'https://api.ng.termii.com',
    environment TEXT DEFAULT 'test' CHECK (environment IN ('test', 'live')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, campus_id)
);

-- Enable RLS on termii_settings
ALTER TABLE public.termii_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only Admin and Super Admin can view/edit Termii settings
-- School-based isolation (users can only see their school's settings)
DROP POLICY IF EXISTS "Admins can manage termii settings" ON public.termii_settings;
CREATE POLICY "Admins can manage termii settings" ON public.termii_settings
FOR ALL
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles
        WHERE id = auth.uid()
        AND role = 'Admin'
    )
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_termii_settings_school_id ON public.termii_settings(school_id);
CREATE INDEX IF NOT EXISTS idx_termii_settings_campus_id ON public.termii_settings(campus_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_termii_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_termii_settings_timestamp ON public.termii_settings;
CREATE TRIGGER update_termii_settings_timestamp
    BEFORE UPDATE ON public.termii_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_termii_settings_updated_at();
