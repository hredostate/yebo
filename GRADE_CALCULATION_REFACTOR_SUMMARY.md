# Grade Calculation Refactoring - Implementation Summary

## Problem Statement

There was a discrepancy between the ranking and position scoring shown in the Result Manager statistics versus the actual report cards. Scores entered after a grading scheme was changed did not reflect the current grading scheme rules.

### Root Cause

Two separate grade calculation implementations existed:

1. **Statistics Dashboard (Client-side)** in `LevelStatisticsDashboard.tsx`:
   - Used a local `getGradeFromScore()` function that iterated over `gradingScheme.rules`
   - Did NOT check for subject-specific overrides in `grading_scheme_overrides`
   - Could have stale data if the grading scheme was updated

2. **Report Cards (Server-side)** via `compute_grade` RPC function:
   - Uses database tables `grading_scheme_rules` and `grading_scheme_overrides`
   - This is the correct source of truth

## Solution Implemented

### 1. Created Shared Grade Calculation Utility

**File:** `src/utils/gradeCalculation.ts`

```typescript
export async function computeGrade(
  score: number,
  gradingSchemeId: number,
  subjectName?: string
): Promise<GradeResult>

export async function computeGradesBatch(
  scores: Array<{ score: number; subjectName?: string }>,
  gradingSchemeId: number
): Promise<GradeResult[]>
```

These functions call the `compute_grade` RPC function, which is the single source of truth for grade calculations. The RPC function:
- Checks for subject-specific overrides first
- Falls back to standard grading rules
- Returns grade label, remark, and GPA value

### 2. Updated LevelStatisticsDashboard.tsx

**Changes:**
- Replaced synchronous `getGradeFromScore()` with RPC-based grade calculation
- Added grade caching in component state (`gradeCache`)
- Added `useEffect` hook to load grades asynchronously when data changes
- Maintained the same `getGradeFromScore()` interface for backward compatibility, but it now returns cached RPC results

**Key Implementation:**
```typescript
const [gradeCache, setGradeCache] = useState<Map<string, string>>(new Map());
const [isLoadingGrades, setIsLoadingGrades] = useState(false);

// Load grades for all scores when data changes
useEffect(() => {
  // Collect unique scores
  // Call computeGradesBatch
  // Build cache map
}, [selectedLevel, gradingScheme, ...]);

const getGradeFromScore = (score: number, subjectName?: string): string => {
  const cacheKey = `${score}-${subjectName || 'default'}`;
  return gradeCache.get(cacheKey) || 'N/A';
};
```

### 3. Created Recalculate Grades Migration

**File:** `supabase/migrations/20251221_recalculate_grades.sql`

Added RPC function `recalculate_all_grades`:
```sql
CREATE OR REPLACE FUNCTION public.recalculate_all_grades(
    p_grading_scheme_id INTEGER,
    p_term_id INTEGER DEFAULT NULL
)
RETURNS JSONB
```

This function:
- Finds all score_entries using the specified grading scheme
- Optionally filters by term_id
- Calls `compute_grade()` for each entry
- Updates `grade_label` and `remark` fields
- Returns count of updated entries

### 4. Added Recalculate Grades UI in ResultManager

**File:** `src/components/ResultManager.tsx`

Added:
- "Recalculate Grades" button in the Statistics view header
- State for managing the recalculation process
- Confirmation modal with warning
- Handler function that calls the RPC
- Success/error feedback with count

**UI Location:** 
Statistics tab → Header (next to "Level Statistics & Rankings" title)

**User Flow:**
1. Click "Recalculate Grades" button
2. See confirmation modal explaining the operation
3. Confirm to proceed
4. See toast notification with result count

### 5. Added Recalculate Option in GradingSchemeManager

**File:** `src/components/GradingSchemeManager.tsx`

Added:
- "Recalculate" button for each grading scheme
- Automatic prompt after saving a scheme
- Confirmation modal with detailed warning
- Handler function for recalculation (all terms)

**Also Updated:** `src/components/SuperAdminConsole.tsx` to pass `addToast` prop

**User Flow:**
1. After editing/saving a grading scheme → Optional prompt to recalculate
2. Or click "Recalculate" button next to any scheme
3. See confirmation modal
4. Confirm to recalculate all grades for all terms using that scheme

## Files Modified

### New Files
1. `src/utils/gradeCalculation.ts` - 58 lines
2. `supabase/migrations/20251221_recalculate_grades.sql` - 60 lines

### Modified Files
1. `src/components/LevelStatisticsDashboard.tsx` - ~70 lines changed
2. `src/components/ResultManager.tsx` - ~80 lines added
3. `src/components/GradingSchemeManager.tsx` - ~80 lines added
4. `src/components/SuperAdminConsole.tsx` - 1 line added

## Testing Guide

### 1. Test Grade Calculation in Statistics Dashboard

**Prerequisites:**
- Have a grading scheme with subject-specific overrides set up
- Have students with scores in various subjects
- Have an active term with score entries

**Steps:**
1. Navigate to Result Manager
2. Select a term
3. Switch to "Statistics" view
4. Select a grade level
5. Verify that:
   - Grade distributions show correctly
   - Student rankings display proper grades
   - Subject-wise statistics use correct grades
6. Change the grading scheme (add/modify rules)
7. Refresh the statistics view
8. Verify grades update to reflect the new scheme

### 2. Test Recalculate Grades in Result Manager

**Steps:**
1. Navigate to Result Manager
2. Select a term
3. Switch to "Statistics" view
4. Click the "Recalculate Grades" button (purple button in header)
5. Read the confirmation modal
6. Verify the warning message appears
7. Click "Recalculate Grades" to confirm
8. Verify:
   - Toast notification appears with "Recalculating grades..."
   - Success toast shows count of updated grades
   - Button shows spinner while processing
9. Check score entries in database to verify grades updated

### 3. Test Recalculate Grades in Grading Scheme Manager

**Steps:**
1. Navigate to Super Admin Console → Grading tab
2. Edit an existing grading scheme
3. Modify a rule (e.g., change grade boundaries)
4. Save the scheme
5. Verify prompt appears asking to recalculate grades
6. Choose "Yes" to recalculate
7. Verify confirmation modal appears
8. Confirm recalculation
9. Verify success toast with count
10. Check that grades were updated

**Alternative Flow:**
1. In Grading Scheme Manager
2. Click "Recalculate" button next to any scheme
3. Verify modal explains it will recalculate for all terms
4. Confirm and verify success

### 4. Verify Subject-Specific Overrides

**Setup:**
1. Create a subject-specific override in `grading_scheme_overrides` table
2. For example: Mathematics gets different grade boundaries

**Test:**
1. Enter/modify scores for that subject
2. View statistics dashboard
3. Verify grades use the override rules
4. Click recalculate grades
5. Verify override rules are still applied after recalculation

### 5. Database Verification

**Query to check grades:**
```sql
SELECT 
  se.id,
  se.student_id,
  se.subject_name,
  se.total_score,
  se.grade_label,
  se.remark,
  compute_grade(se.total_score, ac.grading_scheme_id, se.subject_name) as computed_grade
FROM score_entries se
JOIN academic_classes ac ON se.academic_class_id = ac.id
WHERE se.term_id = <term_id>
LIMIT 20;
```

Verify that `grade_label` matches `computed_grade->>'grade_label'`

## Key Benefits

1. **Consistency**: Statistics and report cards now use the same grade calculation logic
2. **Accuracy**: Subject-specific overrides are respected everywhere
3. **Maintainability**: Single source of truth for grade logic (database RPC function)
4. **Flexibility**: Admins can recalculate grades when schemes change
5. **Performance**: Batch grade computation and caching in UI
6. **User Experience**: Clear feedback and confirmation dialogs

## Migration Notes

When deploying this update:

1. **Run Migration:** Ensure `20251221_recalculate_grades.sql` is executed
2. **Verify RPC Function:** Check that `compute_grade` function exists (from previous migration)
3. **Test Permissions:** Verify `authenticated` role has EXECUTE permission on both functions
4. **Data Integrity:** Consider running recalculate_all_grades for each active grading scheme after deployment
5. **User Communication:** Notify admins about the new recalculate feature

## Potential Future Enhancements

1. **Batch RPC Function:** Create a true batch version of `compute_grade` for better performance
2. **Background Job:** For large datasets, recalculate grades in background with progress tracking
3. **Audit Trail:** Log grade recalculations with timestamp and user info
4. **Selective Recalculation:** Allow recalculation by class or subject, not just term
5. **Grade Change Notifications:** Notify students/teachers when grades are recalculated

## Technical Notes

### Performance Considerations

- **Statistics Dashboard:** Grades are loaded once per view change and cached
- **Batch Operations:** Currently calls RPC individually; could be optimized
- **Large Datasets:** May need pagination or background processing for schools with 1000+ students

### Error Handling

- Failed RPC calls return `{ grade_label: 'N/A', remark: '', gpa_value: 0 }`
- Errors are logged to console
- User sees toast notifications for failures
- Component state is properly cleaned up after operations

### Browser Compatibility

- Uses modern React hooks (useState, useEffect, useMemo)
- Async/await for RPC calls
- No special polyfills required
- Tested with modern browsers (Chrome, Firefox, Safari, Edge)
