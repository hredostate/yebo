-- Migration: Add AI settings support to schools table
-- Description: Adds ai_settings JSONB column to store OpenRouter API configuration
-- Date: 2025-12-10

-- Add ai_settings column to schools table
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS ai_settings JSONB DEFAULT NULL;

-- Add comment to document the column
COMMENT ON COLUMN schools.ai_settings IS 'Stores AI configuration including OpenRouter API key and default model. Structure: {openrouter_api_key: string, default_model: string, is_configured: boolean}';

-- Optional: Create an index for querying configured schools
CREATE INDEX IF NOT EXISTS idx_schools_ai_configured 
ON schools ((ai_settings->>'is_configured')) 
WHERE (ai_settings->>'is_configured')::boolean = true;
