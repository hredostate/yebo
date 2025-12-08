-- Migration: Add school_id column to subjects table
-- Date: 2025-01-08
-- Purpose: Fix "Could not find the 'school_id' column of 'subjects' in the schema cache" error

-- Add school_id column to subjects table if it doesn't exist
DO $$ 
DECLARE
    default_school_id INTEGER;
BEGIN
    -- Check if the school_id column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'subjects' 
        AND column_name = 'school_id'
    ) THEN
        -- Get the first available school_id from the schools table
        SELECT id INTO default_school_id 
        FROM public.schools 
        ORDER BY id 
        LIMIT 1;
        
        -- Ensure at least one school exists
        IF default_school_id IS NULL THEN
            RAISE EXCEPTION 'No schools found in database. Please create a school record first.';
        END IF;
        
        -- Add the column without NOT NULL constraint initially
        ALTER TABLE public.subjects 
        ADD COLUMN school_id INTEGER;
        
        -- Update existing records to use the first school
        UPDATE public.subjects 
        SET school_id = default_school_id 
        WHERE school_id IS NULL;
        
        -- Make the column NOT NULL to enforce data integrity
        ALTER TABLE public.subjects 
        ALTER COLUMN school_id SET NOT NULL;
        
        -- Add the foreign key constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_constraint 
            WHERE conname = 'subjects_school_id_fkey'
        ) THEN
            ALTER TABLE public.subjects 
            ADD CONSTRAINT subjects_school_id_fkey 
            FOREIGN KEY (school_id) 
            REFERENCES public.schools(id) 
            ON DELETE CASCADE;
        END IF;
        
        RAISE NOTICE 'Added school_id column to subjects table with default school_id = %', default_school_id;
    ELSE
        RAISE NOTICE 'school_id column already exists in subjects table';
    END IF;
END $$;

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
