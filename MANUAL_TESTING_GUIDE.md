# Manual Testing Guide - Permission System Changes

This guide provides step-by-step instructions for manually testing the permission system changes.

## Setup

1. Ensure the database is seeded with the updated role definitions from `database_schema.sql`
2. Create test users for each role type:
   - Teacher account
   - Principal account
   - Counselor account
   - Team Lead account (to test backward compatibility)

## Test Cases

### Test 1: Teacher Access to Academic Features ✓

**Objective**: Verify teachers can now access lesson plans, curriculum, attendance, and coverage feedback

**Steps**:
1. Login as a Teacher user
2. Open the sidebar navigation
3. Look for the "Academics" section

**Expected Results**:
- ✅ "Lesson Plans" link should be VISIBLE
- ✅ "Curriculum Map" link should be VISIBLE
- ✅ "Class Groups" link should be VISIBLE
- ✅ "Coverage Feedback" link should be VISIBLE
- ✅ "My Gradebook" link should be VISIBLE

**Permissions Used**:
- Lesson Plans: `view-my-lesson-plans`
- Curriculum Map: `view-curriculum-readonly`
- Class Groups: `take-class-attendance`
- Coverage Feedback: `view-my-coverage-feedback`

---

### Test 2: Teacher CANNOT Access Sensitive Widgets ✓

**Objective**: Verify teachers cannot see AI Task Suggestions or At-Risk Students on dashboard

**Steps**:
1. Login as a Teacher user
2. Navigate to Dashboard
3. Observe the widgets displayed

**Expected Results**:
- ❌ "AI Task Suggestions" widget should NOT appear
- ❌ "At-Risk Students" widget should NOT appear
- ❌ "Student Records" widget should NOT appear (if it was in their config)

**Permissions Checked**:
- AI Task Suggestions requires: `view-ai-task-suggestions` (Teacher doesn't have)
- At-Risk Students requires: `view-at-risk-students` (Teacher doesn't have)
- Student Records requires: `view-all-student-data` (Teacher doesn't have)

---

### Test 3: Principal Access to Sensitive Features ✓

**Objective**: Verify principals can see all sensitive widgets and features

**Steps**:
1. Login as a Principal user
2. Navigate to Dashboard
3. Observe the widgets displayed

**Expected Results**:
- ✅ "AI Task Suggestions" widget SHOULD appear (if there are suggestions)
- ✅ "At-Risk Students" widget SHOULD appear (if configured in dashboard)
- ✅ "Student Records" widget SHOULD appear (if configured in dashboard)
- ✅ All navigation items should be visible

**Permissions Granted**:
- `view-ai-task-suggestions` ✓
- `view-at-risk-students` ✓
- `view-all-student-data` ✓
- `view-sensitive-reports` ✓

---

### Test 4: Counselor Partial Access ✓

**Objective**: Verify counselors have access to at-risk students but not AI suggestions

**Steps**:
1. Login as a Counselor user
2. Navigate to Dashboard
3. Open widget customization modal

**Expected Results**:
- ✅ "At-Risk Students" widget option SHOULD be available
- ❌ "AI Task Suggestions" widget should NOT be available in customization
- ✅ "Student Records" widget should NOT be available (don't have view-all-student-data)

**Permissions Granted**:
- `view-at-risk-students` ✓
- `view-sensitive-reports` ✓
- `view-ai-task-suggestions` ❌ (not granted)

---

### Test 5: Team Lead Backward Compatibility ✓

**Objective**: Verify existing roles with old permissions still have access

**Steps**:
1. Login as a Team Lead user (has `manage-curriculum` permission)
2. Open the sidebar navigation

**Expected Results**:
- ✅ "Lesson Plans" link should be VISIBLE (via `manage-curriculum` OR logic)
- ✅ "Curriculum Map" link should be VISIBLE (via `manage-curriculum` OR logic)
- ✅ "Coverage Feedback" link should be VISIBLE (via `view-coverage-feedback`)

**Backward Compatibility Test**:
The sidebar uses OR logic: `view-my-lesson-plans|manage-curriculum`
- Team Leads have `manage-curriculum` so they still see the link
- Teachers have `view-my-lesson-plans` so they also see the link

---

### Test 6: Widget Customization Modal ✓

**Objective**: Verify the customize dashboard modal only shows widgets the user has permission for

**Steps**:
1. Login as each role type (Teacher, Principal, Counselor)
2. On Dashboard, click "Customize View" button
3. Observe available widgets in the customization modal

**Expected Results**:

**For Teacher**:
- Available: my-tasks, daily-report-status, announcements, alerts, inventory, etc.
- NOT Available: at-risk-students, student-records

**For Principal**:
- Available: All widgets including at-risk-students, student-records, ai-task-suggestions

**For Counselor**:
- Available: my-tasks, announcements, at-risk-students, etc.
- NOT Available: ai-task-suggestions, student-records (if no view-all-student-data)

---

### Test 7: Admin Wildcard Permission ✓

**Objective**: Verify Admin users with '*' permission see everything

**Steps**:
1. Login as an Admin user
2. Check sidebar navigation and dashboard

**Expected Results**:
- ✅ All navigation items visible
- ✅ All widgets available in customization
- ✅ AI Task Suggestions visible if any exist

---

## Verification Checklist

After completing all tests, verify:

- [ ] Teachers can access academic features (Lesson Plans, Curriculum, Attendance, Coverage Feedback)
- [ ] Teachers CANNOT see sensitive widgets (AI Suggestions, At-Risk Students, All Student Records)
- [ ] Principals can see all sensitive features
- [ ] Counselors can see at-risk students but not AI suggestions
- [ ] Team Leads with old permissions still have access (backward compatibility)
- [ ] Widget customization modal respects permissions
- [ ] Admin users see everything

---

## Debugging Tips

If a user doesn't see expected features:

1. **Check User's Role Permissions**:
```sql
SELECT u.name, u.role, r.permissions 
FROM users u 
JOIN roles r ON u.role = r.title 
WHERE u.id = '[user_id]';
```

2. **Check Widget Definitions**:
Look at `src/dashboardWidgets.ts` to see what permission each widget requires

3. **Check Browser Console**:
Look for any JavaScript errors that might prevent widgets from rendering

4. **Clear Browser Cache**:
Sometimes old JavaScript files are cached

5. **Check Database Migration**:
Ensure the database has been updated with new role permissions from `database_schema.sql`

---

## Migration for Existing Deployments

If testing on an existing deployment that hasn't been migrated:

```sql
-- Run these SQL commands to add new permissions to existing roles

-- Update Teacher roles
UPDATE roles 
SET permissions = array_cat(permissions, ARRAY[
  'view-my-classes', 'view-my-lesson-plans', 'view-my-coverage-feedback', 
  'take-class-attendance', 'view-curriculum-readonly'
])
WHERE title = 'Teacher';

-- Update Principal roles
UPDATE roles
SET permissions = array_cat(permissions, ARRAY[
  'view-ai-task-suggestions', 'view-at-risk-students', 
  'view-all-student-data', 'view-sensitive-reports'
])
WHERE title = 'Principal';

-- Update Counselor roles
UPDATE roles
SET permissions = array_cat(permissions, ARRAY[
  'view-at-risk-students', 'view-sensitive-reports'
])
WHERE title = 'Counselor';
```

---

## Success Criteria

All tests pass when:

1. Teachers can access the academic features they need
2. Sensitive features are properly restricted based on role
3. Backward compatibility is maintained for existing roles
4. No console errors appear during testing
5. Widget customization respects permissions
6. Build compiles successfully with no TypeScript errors

---

## Reporting Issues

If any test fails, report:
1. Which test case failed
2. User's role and permissions (from database)
3. Expected vs actual behavior
4. Browser console errors (if any)
5. Screenshots of the issue
