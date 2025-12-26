-- Green-API Settings Table
-- This table stores Green-API WhatsApp configuration per school/campus
-- Green-API replaces KudiSMS for WhatsApp messaging only (SMS stays with KudiSMS)

CREATE TABLE IF NOT EXISTS greenapi_settings (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  campus_id INTEGER REFERENCES campuses(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,  -- idInstance from Green-API console
  api_token TEXT NOT NULL,    -- apiTokenInstance from Green-API console
  api_url TEXT DEFAULT 'https://api.green-api.com' NOT NULL,
  media_url TEXT DEFAULT 'https://media.green-api.com' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Ensure only one active configuration per school/campus combination
-- Using partial index to allow multiple inactive records
CREATE UNIQUE INDEX unique_active_greenapi_per_school_campus 
  ON greenapi_settings(school_id, campus_id) 
  WHERE is_active = true;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_greenapi_settings_school_id ON greenapi_settings(school_id);
CREATE INDEX IF NOT EXISTS idx_greenapi_settings_campus_id ON greenapi_settings(campus_id);
CREATE INDEX IF NOT EXISTS idx_greenapi_settings_active ON greenapi_settings(is_active) WHERE is_active = true;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_greenapi_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER greenapi_settings_updated_at
  BEFORE UPDATE ON greenapi_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_greenapi_settings_updated_at();

-- Add RLS policies
ALTER TABLE greenapi_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view their school's Green-API settings
CREATE POLICY "Admins can view their school's Green-API settings"
  ON greenapi_settings
  FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Admins can insert/update their school's Green-API settings
CREATE POLICY "Admins can manage their school's Green-API settings"
  ON greenapi_settings
  FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM user_profiles WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- Comment on table
COMMENT ON TABLE greenapi_settings IS 'Stores Green-API WhatsApp configuration per school/campus. Green-API handles WhatsApp messaging ($12/month) while KudiSMS handles SMS (₦5.95/msg).';

-- Comment on columns
COMMENT ON COLUMN greenapi_settings.instance_id IS 'Green-API instance ID from console';
COMMENT ON COLUMN greenapi_settings.api_token IS 'Green-API API token from console';
COMMENT ON COLUMN greenapi_settings.api_url IS 'Green-API base URL (default: https://api.green-api.com)';
COMMENT ON COLUMN greenapi_settings.media_url IS 'Green-API media URL (default: https://media.green-api.com)';
