-- Create user_sessions table for tracking device logins
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_info TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_token TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON user_sessions(last_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active, last_active);

-- RLS Policies for user_sessions table
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own sessions
CREATE POLICY "Users can view own sessions"
    ON user_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own sessions (via service)
CREATE POLICY "Users can insert own sessions"
    ON user_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions"
    ON user_sessions
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete own sessions"
    ON user_sessions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to clean up expired sessions (sessions inactive for more than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_inactive_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE user_sessions
    SET is_active = false
    WHERE is_active = true
    AND last_active < NOW() - INTERVAL '5 minutes';
END;
$$;

-- Create a scheduled job to run cleanup every minute (requires pg_cron extension)
-- Note: This is optional and depends on pg_cron being installed
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule('cleanup-sessions', '* * * * *', 'SELECT cleanup_inactive_sessions()');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_sessions TO authenticated;
