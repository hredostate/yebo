-- Migration: Replace Termii with Kudi SMS
-- Date: 2025-12-14
-- Description: Creates kudisms_settings table and updates related tables

-- 1. Create kudisms_settings table
CREATE TABLE IF NOT EXISTS kudisms_settings (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    campus_id INTEGER REFERENCES campuses(id) ON DELETE CASCADE,
    api_token TEXT NOT NULL,
    sender_id TEXT,
    template_codes JSONB, -- e.g., {"payment_receipt": "25XXXXX", "fee_reminder": "25YYYYY"}
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, campus_id) -- One config per school-campus combination
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_kudisms_settings_school_active 
    ON kudisms_settings(school_id, is_active);

-- 2. Update whatsapp_message_logs table to support Kudi SMS
-- Rename termii_message_id to kudisms_message_id if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'whatsapp_message_logs' 
        AND column_name = 'termii_message_id'
    ) THEN
        ALTER TABLE whatsapp_message_logs 
        RENAME COLUMN termii_message_id TO kudisms_message_id;
    END IF;
END $$;

-- Add kudisms_message_id column if it doesn't exist
ALTER TABLE whatsapp_message_logs 
ADD COLUMN IF NOT EXISTS kudisms_message_id TEXT;

-- Add cost column to track message costs
ALTER TABLE whatsapp_message_logs 
ADD COLUMN IF NOT EXISTS cost DECIMAL(10, 2);

-- Update message_type to support new types if needed
DO $$
BEGIN
    -- Drop the old enum type if it exists and recreate
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type_enum') THEN
        ALTER TABLE whatsapp_message_logs 
        ALTER COLUMN message_type TYPE TEXT;
        
        DROP TYPE IF EXISTS message_type_enum;
    END IF;
END $$;

-- Ensure message_type is TEXT type
ALTER TABLE whatsapp_message_logs 
ALTER COLUMN message_type TYPE TEXT;

-- Rename template_id to template_code for consistency
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'whatsapp_message_logs' 
        AND column_name = 'template_id'
    ) THEN
        ALTER TABLE whatsapp_message_logs 
        RENAME COLUMN template_id TO template_code;
    END IF;
END $$;

-- Add template_code column if it doesn't exist
ALTER TABLE whatsapp_message_logs 
ADD COLUMN IF NOT EXISTS template_code TEXT;

-- 3. Update whatsapp_notifications table
-- Rename termii_message_id to kudisms_message_id if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'whatsapp_notifications' 
        AND column_name = 'termii_message_id'
    ) THEN
        ALTER TABLE whatsapp_notifications 
        RENAME COLUMN termii_message_id TO kudisms_message_id;
    END IF;
END $$;

-- Add kudisms_message_id column if it doesn't exist
ALTER TABLE whatsapp_notifications 
ADD COLUMN IF NOT EXISTS kudisms_message_id TEXT;

-- 4. Add comments for documentation
COMMENT ON TABLE kudisms_settings IS 'Configuration for Kudi SMS API integration for WhatsApp and SMS messaging';
COMMENT ON COLUMN kudisms_settings.api_token IS 'API token from Kudi SMS dashboard';
COMMENT ON COLUMN kudisms_settings.sender_id IS 'Approved sender ID for SMS messages (max 11 characters)';
COMMENT ON COLUMN kudisms_settings.template_codes IS 'JSON object mapping template names to approved template codes';
COMMENT ON COLUMN whatsapp_message_logs.kudisms_message_id IS 'Message ID returned by Kudi SMS API';
COMMENT ON COLUMN whatsapp_message_logs.cost IS 'Cost of sending the message in Naira';

-- 5. Grant permissions (adjust role names as needed)
GRANT SELECT, INSERT, UPDATE, DELETE ON kudisms_settings TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE kudisms_settings_id_seq TO authenticated;

-- 6. Enable RLS on kudisms_settings
ALTER TABLE kudisms_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for kudisms_settings
CREATE POLICY "Users can manage settings for their school"
    ON kudisms_settings
    FOR ALL
    USING (
        school_id IN (
            SELECT school_id FROM user_profiles WHERE id = auth.uid()
        )
    );
