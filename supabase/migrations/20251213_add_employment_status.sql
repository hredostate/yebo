-- Add employment_status column to user_profiles table
-- This allows tracking teacher employment status: Active, Resigned, Fired, Suspended, Long Leave

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='user_profiles' AND column_name='employment_status') THEN
        ALTER TABLE public.user_profiles 
        ADD COLUMN employment_status TEXT DEFAULT 'Active';
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.user_profiles.employment_status IS 
    'Employment status of the staff member: Active, Resigned, Fired, Suspended, Long Leave';

-- Create an index to optimize filtering by employment status
CREATE INDEX IF NOT EXISTS idx_user_profiles_employment_status 
    ON public.user_profiles(employment_status);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload config';
