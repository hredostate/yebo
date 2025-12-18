-- Add RLS policies for teaching_assignments table
-- This migration ensures proper UPDATE permissions for unlocking scores

-- Ensure RLS is enabled
ALTER TABLE public.teaching_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "teaching_assignments_update_policy" ON public.teaching_assignments;
DROP POLICY IF EXISTS "teaching_assignments_select_policy" ON public.teaching_assignments;
DROP POLICY IF EXISTS "teaching_assignments_insert_policy" ON public.teaching_assignments;
DROP POLICY IF EXISTS "teaching_assignments_delete_policy" ON public.teaching_assignments;

-- CREATE UPDATE policy - allow authenticated users with proper permissions
CREATE POLICY "teaching_assignments_update_policy" ON public.teaching_assignments
FOR UPDATE TO authenticated
USING (
    -- Allow if user is Admin, Principal, Team Lead, or School Owner
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() 
        AND up.role IN ('Admin', 'Principal', 'Team Lead', 'School Owner')
    )
    -- OR if user is the assigned teacher
    OR teacher_user_id = auth.uid()
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() 
        AND up.role IN ('Admin', 'Principal', 'Team Lead', 'School Owner')
    )
    OR teacher_user_id = auth.uid()
);

-- CREATE SELECT policy
CREATE POLICY "teaching_assignments_select_policy" ON public.teaching_assignments
FOR SELECT TO authenticated
USING (true);

-- CREATE INSERT policy
CREATE POLICY "teaching_assignments_insert_policy" ON public.teaching_assignments
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() 
        AND up.role IN ('Admin', 'Principal', 'Team Lead', 'School Owner')
    )
);

-- CREATE DELETE policy
CREATE POLICY "teaching_assignments_delete_policy" ON public.teaching_assignments
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() 
        AND up.role IN ('Admin', 'Principal', 'Team Lead', 'School Owner')
    )
);

-- Add helpful comment
COMMENT ON POLICY "teaching_assignments_update_policy" ON public.teaching_assignments IS 
'Allows administrators and assigned teachers to update teaching assignments, including locking/unlocking scores';
