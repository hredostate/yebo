# Security RLS Testing Guide

## Overview
This document outlines the Row-Level Security (RLS) policies implemented for payroll data and team-scoped access control, along with testing procedures.

## Security Model

### Payroll Data Access

#### Roles with Full Payroll Access
- **Admin**: Has `*` (wildcard) permission - full access to everything
- **Principal**: Has `manage-payroll` permission - full payroll access
- **Accountant**: Has `manage-payroll` permission - full payroll access

#### Roles WITHOUT Payroll Management Access
- **Team Lead**: Can only view their own payslips (NOT full payroll)
- **Teacher**: Can only view their own payslips
- **All other staff**: Can only view their own payslips

### Team Scope Access

#### Team Visibility
- **Team Leads**: Can only view teams they lead or are members of
- **Admin/Users with manage-users**: Can view all teams
- **Team Members**: Can view teams they are assigned to

## RLS Policies Implemented

### Payroll Tables

#### 1. `payroll_runs` (v1) and `payroll_runs_v2`
- **SELECT**: Only users with `manage-payroll` permission
- **INSERT/UPDATE/DELETE**: Only users with `manage-payroll` permission
- **Rationale**: Payroll runs contain aggregate data for entire payroll periods

#### 2. `payroll_items`
- **SELECT**: Staff can view their own items OR users with `manage-payroll` can view all
- **INSERT/UPDATE/DELETE**: Only users with `manage-payroll` permission
- **Rationale**: Individual payroll items contain sensitive salary information

#### 3. `payslips`
- **SELECT**: Staff can view their own OR users with `manage-payroll` can view all
- **UPDATE**: Staff can update their own OR users with `manage-payroll` can update all
- **INSERT/DELETE**: Only users with `manage-payroll` permission
- **Rationale**: Staff need to view/query their own payslips

#### 4. `payslip_line_items` and `payroll_line_items`
- **SELECT**: Staff can view line items for their own payslips OR users with `manage-payroll` can view all
- **INSERT/UPDATE/DELETE**: Only users with `manage-payroll` permission
- **Rationale**: Line items show detailed breakdown of earnings/deductions

#### 5. `payroll_components`
- **SELECT/INSERT/UPDATE/DELETE**: Only users with `manage-payroll` permission
- **Rationale**: Components are configuration data for payroll calculation

#### 6. `payroll_adjustments`
- **SELECT**: Staff can view their own adjustments OR users with `manage-payroll` can view all
- **INSERT/UPDATE/DELETE**: Only users with `manage-payroll` permission
- **Rationale**: Staff should see what adjustments affect their pay

#### 7. `pension_contributions` and `staff_pension`
- **SELECT**: Staff can view their own pension data OR users with `manage-payroll` can view all
- **UPDATE**: Staff can update their own OR users with `manage-payroll` can update all
- **INSERT/DELETE**: Only users with `manage-payroll` permission
- **Rationale**: Staff need to view/verify their pension contributions

#### 8. `payslip_queries`
- **SELECT**: Staff can view queries they raised OR users with `manage-payroll` can view all
- **INSERT/UPDATE**: Staff can manage their own queries OR users with `manage-payroll` can manage all
- **DELETE**: Only users with `manage-payroll` permission
- **Rationale**: Staff need to raise and track queries about their payslips

### Team Tables

#### 9. `teams`
- **SELECT**: Team leads/members can view their teams OR users with `manage-users` can view all
- **INSERT/UPDATE/DELETE**: Only users with `manage-users` permission
- **Rationale**: Team leads should only see teams they're involved with

#### 10. `team_assignments`
- **SELECT**: Team leads can view assignments for their teams OR members can view their own OR users with `manage-users` can view all
- **INSERT/UPDATE/DELETE**: Only users with `manage-users` permission
- **Rationale**: Maintains team scope boundaries

#### 11. `team_feedback`
- **SELECT**: Team leads/members can view feedback for their teams OR users with `manage-users` can view all
- **INSERT**: Team leads/members can create feedback for their teams
- **UPDATE/DELETE**: Only author or users with `manage-users` permission
- **Rationale**: Feedback should be visible within team context

## Testing Procedures

### Setup Test Users

Create test users with different roles in your Supabase database:

```sql
-- Example test users (adjust UUIDs and school_id as needed)
INSERT INTO user_profiles (id, school_id, name, email, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 1, 'Test Admin', 'admin@test.com', 'Admin'),
  ('00000000-0000-0000-0000-000000000002', 1, 'Test Principal', 'principal@test.com', 'Principal'),
  ('00000000-0000-0000-0000-000000000003', 1, 'Test Accountant', 'accountant@test.com', 'Accountant'),
  ('00000000-0000-0000-0000-000000000004', 1, 'Test Team Lead', 'teamlead@test.com', 'Team Lead'),
  ('00000000-0000-0000-0000-000000000005', 1, 'Test Teacher', 'teacher@test.com', 'Teacher');
```

### Test Case 1: Payroll Access - Team Lead (Should FAIL)

**Test**: Team Lead should NOT be able to view payroll runs or other staff's payroll data

```sql
-- Authenticate as Team Lead
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000004"}';

-- This should return 0 rows (access denied)
SELECT COUNT(*) FROM payroll_runs;

-- This should return 0 rows (access denied)
SELECT COUNT(*) FROM payroll_items WHERE user_id != '00000000-0000-0000-0000-000000000004';

-- This should return 0 rows (access denied)
SELECT COUNT(*) FROM payroll_components;
```

**Expected**: All queries return 0 rows or raise permission errors

### Test Case 2: Payroll Access - Accountant (Should PASS)

**Test**: Accountant should be able to view all payroll data

```sql
-- Authenticate as Accountant
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000003"}';

-- This should return all rows
SELECT COUNT(*) FROM payroll_runs;

-- This should return all rows
SELECT COUNT(*) FROM payroll_items;

-- This should return all rows
SELECT COUNT(*) FROM payroll_components;

-- This should return all rows
SELECT COUNT(*) FROM payslips;
```

**Expected**: All queries return full data set

### Test Case 3: Own Payslip Access - Teacher (Should PASS)

**Test**: Teacher should be able to view their own payslip

```sql
-- Authenticate as Teacher
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000005"}';

-- This should return only teacher's own payslips
SELECT COUNT(*) FROM payslips WHERE staff_id = '00000000-0000-0000-0000-000000000005';

-- This should return 0 rows (can't see other payslips)
SELECT COUNT(*) FROM payslips WHERE staff_id != '00000000-0000-0000-0000-000000000005';

-- This should return only teacher's own payroll items
SELECT COUNT(*) FROM payroll_items WHERE user_id = '00000000-0000-0000-0000-000000000005';
```

**Expected**: Can view own data, cannot view others' data

### Test Case 4: Team Scope - Team Lead (Should PASS)

**Test**: Team Lead should only see their own team

```sql
-- First, create a team with the team lead
INSERT INTO teams (school_id, team_name, lead_id) 
VALUES (1, 'Test Team A', '00000000-0000-0000-0000-000000000004');

-- Authenticate as Team Lead
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000004"}';

-- This should return only teams where user is lead or member
SELECT COUNT(*) FROM teams WHERE lead_id = '00000000-0000-0000-0000-000000000004';

-- Create another team with different lead
INSERT INTO teams (school_id, team_name, lead_id) 
VALUES (1, 'Test Team B', '00000000-0000-0000-0000-000000000002');

-- Team Lead should NOT see Team B
SELECT COUNT(*) FROM teams WHERE lead_id != '00000000-0000-0000-0000-000000000004';
```

**Expected**: Can only see own team, not other teams

### Test Case 5: Principal Access (Should PASS)

**Test**: Principal should have full payroll access via manage-payroll permission

```sql
-- Authenticate as Principal
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000002"}';

-- This should return all rows
SELECT COUNT(*) FROM payroll_runs;

-- This should return all rows
SELECT COUNT(*) FROM payslips;

-- This should return all rows
SELECT COUNT(*) FROM pension_contributions;
```

**Expected**: Full access to all payroll data

### Test Case 6: Insert Operations - Teacher (Should FAIL)

**Test**: Teacher should NOT be able to create payroll runs or components

```sql
-- Authenticate as Teacher
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000005"}';

-- This should FAIL (raise error)
INSERT INTO payroll_runs (school_id, period_label, status) 
VALUES (1, 'Test Period', 'draft');

-- This should FAIL (raise error)
INSERT INTO payroll_components (school_id, name, component_type) 
VALUES (1, 'Test Component', 'earning');
```

**Expected**: Both inserts should be rejected

## UI Testing

### Test as Team Lead
1. Log in as a user with "Team Lead" role
2. Navigate to Payroll module
3. **Expected**: Should see "My Payslips" section only, NOT payroll management features
4. Navigate to Team Manager
5. **Expected**: Should see only teams they lead or are members of

### Test as Teacher
1. Log in as a user with "Teacher" role
2. Navigate to Payroll module
3. **Expected**: Should see "My Payslips" section only
4. **Expected**: Should NOT see payroll runs, components, or other staff's data

### Test as Accountant
1. Log in as a user with "Accountant" role
2. Navigate to Payroll module
3. **Expected**: Should see full payroll management interface
4. **Expected**: Can view and manage all payroll runs, components, and staff payroll data

### Test as Principal
1. Log in as a user with "Principal" role
2. Navigate to Payroll module
3. **Expected**: Should see full payroll management interface
4. **Expected**: Can view all payroll data

## Verification Checklist

### Payroll Security
- [ ] Team Lead cannot view payroll runs
- [ ] Team Lead cannot view other staff's payslips
- [ ] Team Lead can view their own payslip
- [ ] Teacher cannot view payroll components
- [ ] Teacher can view their own payslip
- [ ] Accountant can view all payroll data
- [ ] Principal can view all payroll data
- [ ] Admin can view all payroll data
- [ ] Regular staff cannot insert/update payroll runs
- [ ] Regular staff cannot insert/update payroll components

### Team Scope Security
- [ ] Team Lead can only view their assigned teams
- [ ] Team Lead cannot view teams they're not part of
- [ ] Admin can view all teams
- [ ] Team members can view teams they're assigned to
- [ ] Team Lead can view team assignments for their teams only
- [ ] Regular users cannot create/edit teams

### Pension Data Security
- [ ] Staff can view their own pension contributions
- [ ] Staff cannot view other staff's pension contributions
- [ ] Users with manage-payroll can view all pension data
- [ ] Staff cannot modify pension contribution records directly

## Migration Verification

After applying the migration, verify:

```sql
-- Check that RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'payroll_runs', 
  'payroll_runs_v2', 
  'payroll_items', 
  'payslips', 
  'payslip_line_items',
  'payroll_line_items',
  'payroll_components',
  'payroll_adjustments',
  'pension_contributions',
  'staff_pension',
  'teams',
  'team_assignments',
  'team_feedback'
);

-- Check that policies exist
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN (
  'payroll_runs', 
  'payroll_runs_v2', 
  'payroll_items', 
  'payslips'
);

-- Verify helper function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'user_has_permission';
```

## Security Notes

1. **Service Role Bypass**: Edge functions using service role keys will bypass RLS policies
2. **Database Direct Access**: Direct database access with postgres role bypasses RLS
3. **Permission Caching**: Role permissions are cached in the application; changes may require re-login
4. **Team Assignment**: Team scope is enforced at database level; application should not filter again

## Troubleshooting

### Issue: User can't see their own payslip
**Cause**: RLS policy checks auth.uid() against staff_id
**Solution**: Verify user_id in payslips table matches auth.uid()

### Issue: Admin can't see payroll data
**Cause**: Role permissions not properly loaded
**Solution**: Check roles table has Admin role with `*` permission for the school_id

### Issue: Team Lead sees all teams
**Cause**: RLS policy not enabled or misconfigured
**Solution**: Verify teams table has RLS enabled and policies are created

## Documentation References

- Migration file: `supabase/migrations/20260702_add_comprehensive_payroll_rls_policies.sql`
- Permission model: `src/databaseSchema.ts` (roles table)
- UI implementation: `src/components/HRPayrollModule.tsx`
