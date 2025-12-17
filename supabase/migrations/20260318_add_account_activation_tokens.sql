-- Create table for one-time activation tokens
CREATE TABLE IF NOT EXISTS public.account_activation_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz NULL,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure only one active token per student
CREATE UNIQUE INDEX IF NOT EXISTS account_activation_tokens_unique_active
ON public.account_activation_tokens(student_id)
WHERE used_at IS NULL;

-- Enable RLS and allow administrators to manage records
ALTER TABLE public.account_activation_tokens ENABLE ROW LEVEL SECURITY;

-- Allow owners (admins) to view tokens for their school via policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'account_activation_tokens' AND policyname = 'Admins can manage activation tokens'
    ) THEN
        CREATE POLICY "Admins can manage activation tokens" ON public.account_activation_tokens
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() AND p.school_id = (
                    SELECT s.school_id FROM public.students s WHERE s.id = account_activation_tokens.student_id
                ) AND (p.role ILIKE 'admin%' OR p.role ILIKE '%admin' OR p.role = 'Principal')
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() AND p.school_id = (
                    SELECT s.school_id FROM public.students s WHERE s.id = account_activation_tokens.student_id
                ) AND (p.role ILIKE 'admin%' OR p.role ILIKE '%admin' OR p.role = 'Principal')
            )
        );
    END IF;
END $$;

-- Add safety index for expiry lookup
CREATE INDEX IF NOT EXISTS account_activation_tokens_expires_idx
ON public.account_activation_tokens(expires_at);
