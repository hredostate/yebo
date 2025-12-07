-- Migration: Add webhook_events table for audit trail
-- Description: Creates a table to log all incoming webhook events from Paystack
--              This provides an audit trail and helps with debugging webhook issues

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    signature TEXT,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT
);

-- Add index for faster lookups by event type
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON public.webhook_events(event_type);

-- Add index for faster lookups by processing status
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed);

-- Add index for faster lookups by reference (useful for idempotency checks)
CREATE INDEX IF NOT EXISTS idx_webhook_events_reference ON public.webhook_events((payload->>'reference'));

-- Enable RLS on webhook_events
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users with admin role can view webhook events
CREATE POLICY "Admin can view webhook events" ON public.webhook_events
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.user_profiles 
            WHERE role IN ('Admin', 'Super Admin')
        )
    );

-- Note: Service role key is used for webhook inserts (bypasses RLS)
