-- Migration: Add comprehensive RLS policies for payroll and team-scoped data
-- Created: 2026-07-02
-- Purpose: Restrict payroll data access to authorized users only and scope team leads to their teams

-- ============================================================================
-- Helper Function: Check if user has specific permission
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_has_permission(user_id UUID, required_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    role_permissions TEXT[];
BEGIN
    -- Get user's role and permissions in a single query for better performance
    SELECT up.role, r.permissions INTO user_role, role_permissions
    FROM public.user_profiles up
    LEFT JOIN public.roles r ON r.school_id = up.school_id AND r.title = up.role
    WHERE up.id = user_id
    LIMIT 1;
    
    -- If no user found, deny access
    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- If no role permissions found, deny access
    IF role_permissions IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if user has wildcard permission (Admin)
    IF role_permissions @> ARRAY['*'] THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has the specific permission
    IF role_permissions @> ARRAY[required_permission] THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- Helper Function: Check if user is a team lead for a specific user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_team_lead_for_user(lead_id UUID, member_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.teams t
        JOIN public.team_assignments ta ON ta.team_id = t.id
        WHERE t.lead_id = lead_id 
        AND ta.user_id = member_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS Policies for payroll_runs (v1 - legacy)
-- ============================================================================
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

-- Staff can never see payroll runs directly (they see their payslips)
-- Only users with manage-payroll permission can view
DROP POLICY IF EXISTS payroll_runs_select ON public.payroll_runs;
CREATE POLICY payroll_runs_select ON public.payroll_runs
    FOR SELECT
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can insert payroll runs
DROP POLICY IF EXISTS payroll_runs_insert ON public.payroll_runs;
CREATE POLICY payroll_runs_insert ON public.payroll_runs
    FOR INSERT
    WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can update payroll runs
DROP POLICY IF EXISTS payroll_runs_update ON public.payroll_runs;
CREATE POLICY payroll_runs_update ON public.payroll_runs
    FOR UPDATE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can delete payroll runs
DROP POLICY IF EXISTS payroll_runs_delete ON public.payroll_runs;
CREATE POLICY payroll_runs_delete ON public.payroll_runs
    FOR DELETE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- ============================================================================
-- RLS Policies for payroll_runs_v2
-- ============================================================================
ALTER TABLE public.payroll_runs_v2 ENABLE ROW LEVEL SECURITY;

-- Only users with manage-payroll permission can view
DROP POLICY IF EXISTS payroll_runs_v2_select ON public.payroll_runs_v2;
CREATE POLICY payroll_runs_v2_select ON public.payroll_runs_v2
    FOR SELECT
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can insert
DROP POLICY IF EXISTS payroll_runs_v2_insert ON public.payroll_runs_v2;
CREATE POLICY payroll_runs_v2_insert ON public.payroll_runs_v2
    FOR INSERT
    WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can update
DROP POLICY IF EXISTS payroll_runs_v2_update ON public.payroll_runs_v2;
CREATE POLICY payroll_runs_v2_update ON public.payroll_runs_v2
    FOR UPDATE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can delete
DROP POLICY IF EXISTS payroll_runs_v2_delete ON public.payroll_runs_v2;
CREATE POLICY payroll_runs_v2_delete ON public.payroll_runs_v2
    FOR DELETE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- ============================================================================
-- RLS Policies for payroll_items
-- ============================================================================
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

-- Staff can view only their own payroll items
-- Users with manage-payroll can view all
DROP POLICY IF EXISTS payroll_items_select ON public.payroll_items;
CREATE POLICY payroll_items_select ON public.payroll_items
    FOR SELECT
    USING (
        user_id = auth.uid() 
        OR public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can insert
DROP POLICY IF EXISTS payroll_items_insert ON public.payroll_items;
CREATE POLICY payroll_items_insert ON public.payroll_items
    FOR INSERT
    WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can update
DROP POLICY IF EXISTS payroll_items_update ON public.payroll_items;
CREATE POLICY payroll_items_update ON public.payroll_items
    FOR UPDATE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can delete
DROP POLICY IF EXISTS payroll_items_delete ON public.payroll_items;
CREATE POLICY payroll_items_delete ON public.payroll_items
    FOR DELETE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- ============================================================================
-- Update RLS Policies for payslips (add admin access)
-- ============================================================================

-- Drop existing staff-only policy
DROP POLICY IF EXISTS payslips_staff_select ON public.payslips;

-- New policy: Staff can view their own, admins can view all
CREATE POLICY payslips_select ON public.payslips
    FOR SELECT
    USING (
        staff_id = auth.uid() 
        OR public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Update policy: Only staff can update their own, admins can update all
DROP POLICY IF EXISTS payslips_staff_update ON public.payslips;
CREATE POLICY payslips_update ON public.payslips
    FOR UPDATE
    USING (
        staff_id = auth.uid() 
        OR public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only admins can insert payslips
DROP POLICY IF EXISTS payslips_insert ON public.payslips;
CREATE POLICY payslips_insert ON public.payslips
    FOR INSERT
    WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only admins can delete payslips
DROP POLICY IF EXISTS payslips_delete ON public.payslips;
CREATE POLICY payslips_delete ON public.payslips
    FOR DELETE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- ============================================================================
-- RLS Policies for payslip_line_items
-- ============================================================================
ALTER TABLE public.payslip_line_items ENABLE ROW LEVEL SECURITY;

-- Staff can view their own line items, admins can view all
DROP POLICY IF EXISTS payslip_line_items_select ON public.payslip_line_items;
CREATE POLICY payslip_line_items_select ON public.payslip_line_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.payslips p
            WHERE p.id = payslip_id 
            AND p.staff_id = auth.uid()
        )
        OR public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can insert
DROP POLICY IF EXISTS payslip_line_items_insert ON public.payslip_line_items;
CREATE POLICY payslip_line_items_insert ON public.payslip_line_items
    FOR INSERT
    WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can update
DROP POLICY IF EXISTS payslip_line_items_update ON public.payslip_line_items;
CREATE POLICY payslip_line_items_update ON public.payslip_line_items
    FOR UPDATE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can delete
DROP POLICY IF EXISTS payslip_line_items_delete ON public.payslip_line_items;
CREATE POLICY payslip_line_items_delete ON public.payslip_line_items
    FOR DELETE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- ============================================================================
-- RLS Policies for payroll_line_items (v1)
-- ============================================================================
ALTER TABLE public.payroll_line_items ENABLE ROW LEVEL SECURITY;

-- Staff can view their own line items, admins can view all
DROP POLICY IF EXISTS payroll_line_items_select ON public.payroll_line_items;
CREATE POLICY payroll_line_items_select ON public.payroll_line_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.payroll_items pi
            WHERE pi.id = payroll_item_id 
            AND pi.user_id = auth.uid()
        )
        OR public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can insert
DROP POLICY IF EXISTS payroll_line_items_insert ON public.payroll_line_items;
CREATE POLICY payroll_line_items_insert ON public.payroll_line_items
    FOR INSERT
    WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can update
DROP POLICY IF EXISTS payroll_line_items_update ON public.payroll_line_items;
CREATE POLICY payroll_line_items_update ON public.payroll_line_items
    FOR UPDATE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can delete
DROP POLICY IF EXISTS payroll_line_items_delete ON public.payroll_line_items;
CREATE POLICY payroll_line_items_delete ON public.payroll_line_items
    FOR DELETE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- ============================================================================
-- RLS Policies for payroll_components
-- ============================================================================
ALTER TABLE public.payroll_components ENABLE ROW LEVEL SECURITY;

-- Only users with manage-payroll can view components
DROP POLICY IF EXISTS payroll_components_select ON public.payroll_components;
CREATE POLICY payroll_components_select ON public.payroll_components
    FOR SELECT
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can insert
DROP POLICY IF EXISTS payroll_components_insert ON public.payroll_components;
CREATE POLICY payroll_components_insert ON public.payroll_components
    FOR INSERT
    WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can update
DROP POLICY IF EXISTS payroll_components_update ON public.payroll_components;
CREATE POLICY payroll_components_update ON public.payroll_components
    FOR UPDATE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can delete
DROP POLICY IF EXISTS payroll_components_delete ON public.payroll_components;
CREATE POLICY payroll_components_delete ON public.payroll_components
    FOR DELETE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- ============================================================================
-- RLS Policies for payroll_adjustments
-- ============================================================================
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

-- Staff can view their own adjustments, admins can view all
DROP POLICY IF EXISTS payroll_adjustments_select ON public.payroll_adjustments;
CREATE POLICY payroll_adjustments_select ON public.payroll_adjustments
    FOR SELECT
    USING (
        user_id = auth.uid() 
        OR public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can insert
DROP POLICY IF EXISTS payroll_adjustments_insert ON public.payroll_adjustments;
CREATE POLICY payroll_adjustments_insert ON public.payroll_adjustments
    FOR INSERT
    WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can update
DROP POLICY IF EXISTS payroll_adjustments_update ON public.payroll_adjustments;
CREATE POLICY payroll_adjustments_update ON public.payroll_adjustments
    FOR UPDATE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can delete
DROP POLICY IF EXISTS payroll_adjustments_delete ON public.payroll_adjustments;
CREATE POLICY payroll_adjustments_delete ON public.payroll_adjustments
    FOR DELETE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- ============================================================================
-- Update RLS Policies for pension_contributions
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS pension_contributions_select_policy ON public.pension_contributions;
DROP POLICY IF EXISTS pension_contributions_insert_policy ON public.pension_contributions;
DROP POLICY IF EXISTS pension_contributions_update_policy ON public.pension_contributions;
DROP POLICY IF EXISTS pension_contributions_delete_policy ON public.pension_contributions;

-- Staff can view their own contributions, admins can view all
CREATE POLICY pension_contributions_select ON public.pension_contributions
    FOR SELECT
    USING (
        user_id = auth.uid() 
        OR public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can insert
CREATE POLICY pension_contributions_insert ON public.pension_contributions
    FOR INSERT
    WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can update
CREATE POLICY pension_contributions_update ON public.pension_contributions
    FOR UPDATE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can delete
CREATE POLICY pension_contributions_delete ON public.pension_contributions
    FOR DELETE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- ============================================================================
-- Update RLS Policies for staff_pension
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS staff_pension_select_policy ON public.staff_pension;
DROP POLICY IF EXISTS staff_pension_insert_policy ON public.staff_pension;
DROP POLICY IF EXISTS staff_pension_update_policy ON public.staff_pension;
DROP POLICY IF EXISTS staff_pension_delete_policy ON public.staff_pension;

-- Staff can view their own pension config, admins can view all
CREATE POLICY staff_pension_select ON public.staff_pension
    FOR SELECT
    USING (
        user_id = auth.uid() 
        OR public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can insert
CREATE POLICY staff_pension_insert ON public.staff_pension
    FOR INSERT
    WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Staff can update their own (for queries), admins can update all
CREATE POLICY staff_pension_update ON public.staff_pension
    FOR UPDATE
    USING (
        user_id = auth.uid() 
        OR public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- Only users with manage-payroll can delete
CREATE POLICY staff_pension_delete ON public.staff_pension
    FOR DELETE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- ============================================================================
-- Update RLS Policies for payslip_queries (add admin access)
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS payslip_queries_staff_rw ON public.payslip_queries;

-- Staff can manage their own queries, admins can manage all
CREATE POLICY payslip_queries_select ON public.payslip_queries
    FOR SELECT
    USING (
        raised_by_staff_id = auth.uid() 
        OR public.user_has_permission(auth.uid(), 'manage-payroll')
    );

CREATE POLICY payslip_queries_insert ON public.payslip_queries
    FOR INSERT
    WITH CHECK (
        raised_by_staff_id = auth.uid() 
        OR public.user_has_permission(auth.uid(), 'manage-payroll')
    );

CREATE POLICY payslip_queries_update ON public.payslip_queries
    FOR UPDATE
    USING (
        raised_by_staff_id = auth.uid() 
        OR public.user_has_permission(auth.uid(), 'manage-payroll')
    );

CREATE POLICY payslip_queries_delete ON public.payslip_queries
    FOR DELETE
    USING (
        public.user_has_permission(auth.uid(), 'manage-payroll')
    );

-- ============================================================================
-- RLS Policies for teams (team leads should only see their teams)
-- ============================================================================
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Users can view teams they are part of (as lead or member) or if they have manage permissions
DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams
    FOR SELECT
    USING (
        -- User is the team lead
        lead_id = auth.uid()
        -- User is a member of the team
        OR EXISTS (
            SELECT 1 FROM public.team_assignments ta
            WHERE ta.team_id = id 
            AND ta.user_id = auth.uid()
        )
        -- User has admin/manage permissions
        OR public.user_has_permission(auth.uid(), 'manage-users')
        OR public.user_has_permission(auth.uid(), '*')
    );

-- Only admins can create teams
DROP POLICY IF EXISTS teams_insert ON public.teams;
CREATE POLICY teams_insert ON public.teams
    FOR INSERT
    WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage-users')
    );

-- Only admins can update teams
DROP POLICY IF EXISTS teams_update ON public.teams;
CREATE POLICY teams_update ON public.teams
    FOR UPDATE
    USING (
        public.user_has_permission(auth.uid(), 'manage-users')
    );

-- Only admins can delete teams
DROP POLICY IF EXISTS teams_delete ON public.teams;
CREATE POLICY teams_delete ON public.teams
    FOR DELETE
    USING (
        public.user_has_permission(auth.uid(), 'manage-users')
    );

-- ============================================================================
-- RLS Policies for team_assignments
-- ============================================================================
ALTER TABLE public.team_assignments ENABLE ROW LEVEL SECURITY;

-- Users can view assignments for teams they're part of or lead
DROP POLICY IF EXISTS team_assignments_select ON public.team_assignments;
CREATE POLICY team_assignments_select ON public.team_assignments
    FOR SELECT
    USING (
        -- User is the team lead
        EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_id 
            AND t.lead_id = auth.uid()
        )
        -- User is assigned to the team
        OR user_id = auth.uid()
        -- User has admin permissions
        OR public.user_has_permission(auth.uid(), 'manage-users')
    );

-- Only admins can create assignments
DROP POLICY IF EXISTS team_assignments_insert ON public.team_assignments;
CREATE POLICY team_assignments_insert ON public.team_assignments
    FOR INSERT
    WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage-users')
    );

-- Only admins can update assignments
DROP POLICY IF EXISTS team_assignments_update ON public.team_assignments;
CREATE POLICY team_assignments_update ON public.team_assignments
    FOR UPDATE
    USING (
        public.user_has_permission(auth.uid(), 'manage-users')
    );

-- Only admins can delete assignments
DROP POLICY IF EXISTS team_assignments_delete ON public.team_assignments;
CREATE POLICY team_assignments_delete ON public.team_assignments
    FOR DELETE
    USING (
        public.user_has_permission(auth.uid(), 'manage-users')
    );

-- ============================================================================
-- RLS Policies for team_feedback
-- ============================================================================
ALTER TABLE public.team_feedback ENABLE ROW LEVEL SECURITY;

-- Users can view feedback for teams they're part of or lead
DROP POLICY IF EXISTS team_feedback_select ON public.team_feedback;
CREATE POLICY team_feedback_select ON public.team_feedback
    FOR SELECT
    USING (
        -- User is the team lead
        EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_id 
            AND t.lead_id = auth.uid()
        )
        -- User is a member of the team
        OR EXISTS (
            SELECT 1 FROM public.team_assignments ta
            WHERE ta.team_id = team_id 
            AND ta.user_id = auth.uid()
        )
        -- User is the author
        OR author_id = auth.uid()
        -- User has admin permissions
        OR public.user_has_permission(auth.uid(), 'manage-users')
    );

-- Team members can create feedback
DROP POLICY IF EXISTS team_feedback_insert ON public.team_feedback;
CREATE POLICY team_feedback_insert ON public.team_feedback
    FOR INSERT
    WITH CHECK (
        -- User is a member of the team
        EXISTS (
            SELECT 1 FROM public.team_assignments ta
            WHERE ta.team_id = team_id 
            AND ta.user_id = auth.uid()
        )
        -- User is the team lead
        OR EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_id 
            AND t.lead_id = auth.uid()
        )
    );

-- Only author or admin can update feedback
DROP POLICY IF EXISTS team_feedback_update ON public.team_feedback;
CREATE POLICY team_feedback_update ON public.team_feedback
    FOR UPDATE
    USING (
        author_id = auth.uid() 
        OR public.user_has_permission(auth.uid(), 'manage-users')
    );

-- Only author or admin can delete feedback
DROP POLICY IF EXISTS team_feedback_delete ON public.team_feedback;
CREATE POLICY team_feedback_delete ON public.team_feedback
    FOR DELETE
    USING (
        author_id = auth.uid() 
        OR public.user_has_permission(auth.uid(), 'manage-users')
    );

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON FUNCTION public.user_has_permission IS 'Checks if a user has a specific permission based on their role';
COMMENT ON FUNCTION public.is_team_lead_for_user IS 'Checks if a user is a team lead for another user';
