-- Add campus_id to academic_classes table
-- This allows entire academic classes to be assigned to a campus

DO $$
BEGIN
    -- Add campus_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='academic_classes' AND column_name='campus_id'
    ) THEN
        ALTER TABLE public.academic_classes 
        ADD COLUMN campus_id INTEGER REFERENCES public.campuses(id);
        
        RAISE NOTICE 'Added campus_id column to academic_classes table';
    END IF;
    
    -- Create index for better query performance
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename='academic_classes' AND indexname='idx_academic_classes_campus'
    ) THEN
        CREATE INDEX idx_academic_classes_campus ON public.academic_classes(campus_id);
        
        RAISE NOTICE 'Created index idx_academic_classes_campus';
    END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
