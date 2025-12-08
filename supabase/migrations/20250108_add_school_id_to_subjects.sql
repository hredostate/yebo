-- Migration: Add school_id column to subjects table
-- Date: 2025-01-08
-- Purpose: Fix "Could not find the 'school_id' column of 'subjects' in the schema cache" error

-- Add school_id column to subjects table if it doesn't exist
DO $$ 
BEGIN
    -- Check if the school_id column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'subjects' 
        AND column_name = 'school_id'
    ) THEN
        -- Add the column without NOT NULL constraint initially
        ALTER TABLE public.subjects 
        ADD COLUMN school_id INTEGER;
        
        -- Update existing records to set school_id to 1 (default school)
        -- This assumes the default school has id = 1 as per database_schema.sql
        UPDATE public.subjects 
        SET school_id = 1 
        WHERE school_id IS NULL;
        
        -- Now add the foreign key constraint
        ALTER TABLE public.subjects 
        ADD CONSTRAINT subjects_school_id_fkey 
        FOREIGN KEY (school_id) 
        REFERENCES public.schools(id) 
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Added school_id column to subjects table and set default values';
    ELSE
        RAISE NOTICE 'school_id column already exists in subjects table';
    END IF;
END $$;

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
