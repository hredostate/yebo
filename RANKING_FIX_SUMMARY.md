# Ranking Discrepancy Fix - Implementation Summary

## Problem Statement

There was a discrepancy between the ranking/position shown in Result Manager statistics and the actual report cards. Additionally, some scores entered after the grading scheme was changed were not reflecting the current grading scheme.

## Root Cause

The `get_student_term_report_details` function computed rankings using **stale stored values** from `student_term_reports.average_score` instead of computing averages dynamically from `score_entries`. When scores were updated, the stored `average_score` in `student_term_reports` was not automatically recalculated, causing rankings to become out of sync.

### Previous Code (Problem)

```sql
WITH cohort AS (
    SELECT str.student_id,
        DENSE_RANK() OVER (
            PARTITION BY s.campus_id, t.session_label, str.term_id, str.academic_class_id, ac.arm
            ORDER BY COALESCE(str.average_score, 0) DESC  -- Uses STALE stored value
        ) AS cohort_rank
    FROM public.student_term_reports str
    ...
)
```

## Solution Implemented

### 1. Created Migration: `20251222_fix_ranking_discrepancy.sql`

This migration updates the `get_student_term_report_details` function to:

1. **Compute averages dynamically** from `score_entries` for ranking calculations
2. **Use dynamic grade computation** from `grading_scheme_rules` (the single source of truth)
3. **Update rankings based on freshly computed averages**

### New Code (Solution)

```sql
WITH student_averages AS (
    -- Compute average score for each student from their score_entries
    SELECT 
        se.student_id,
        se.term_id,
        se.academic_class_id,
        AVG(se.total_score) as computed_average
    FROM public.score_entries se
    WHERE se.term_id = p_term_id
    GROUP BY se.student_id, se.term_id, se.academic_class_id
),
cohort AS (
    SELECT
        sa.student_id,
        DENSE_RANK() OVER (
            PARTITION BY s.campus_id, t.session_label, sa.term_id, sa.academic_class_id, ac.arm
            ORDER BY COALESCE(sa.computed_average, 0) DESC  -- Uses FRESH computed average
        ) AS cohort_rank
    FROM student_averages sa
    ...
)
```

### 2. Updated `database_schema.sql`

- Added `compute_grade` function (single source of truth for grade calculations)
- Updated `get_student_term_report_details` to match the migration
- Ensures database schema file stays in sync with migrations

## Key Changes

### Ranking Calculation
- **Before**: Used `student_term_reports.average_score` (stale stored value)
- **After**: Computes `AVG(score_entries.total_score)` dynamically per student

### Grade Computation
- **Before**: Used `score_entries.grade_label` (stale stored value)
- **After**: Queries `grading_scheme_rules` dynamically based on current grading scheme

## Expected Behavior After Fix

✅ Report card rankings match Result Manager statistics  
✅ When grading scheme is changed, existing scores reflect the new grade boundaries  
✅ Rankings update immediately when scores are modified  
✅ No need to manually recalculate stored averages  

## Files Modified

1. **New Migration**: `supabase/migrations/20251222_fix_ranking_discrepancy.sql` (363 lines)
2. **Updated Schema**: `database_schema.sql` (added `compute_grade` function, updated `get_student_term_report_details`)

## Testing Recommendations

### 1. Test Ranking Updates

1. Navigate to Result Manager → Statistics
2. Note the rankings for students in a class
3. Update a student's score in Score Entry
4. Refresh Statistics view
5. Verify ranking has updated immediately

### 2. Test Grading Scheme Changes

1. Navigate to Super Admin Console → Grading
2. Modify grade boundaries in a grading scheme
3. View a student's report card
4. Verify grades reflect the new boundaries (without recalculation)

### 3. Test Ranking Consistency

1. Compare rankings in Result Manager Statistics
2. View the same students' report cards
3. Verify rankings match between both views

### 4. Database Verification

```sql
-- Compare stored vs computed averages
SELECT 
  str.student_id,
  str.average_score as stored_average,
  AVG(se.total_score) as computed_average,
  str.position_in_class as stored_rank
FROM student_term_reports str
JOIN score_entries se ON se.student_id = str.student_id 
  AND se.term_id = str.term_id
WHERE str.term_id = <term_id>
GROUP BY str.student_id, str.average_score, str.position_in_class
ORDER BY computed_average DESC;
```

## Migration Notes

When deploying this update:

1. **Run Migration**: Ensure `20251222_fix_ranking_discrepancy.sql` is executed after `20251222_fix_dynamic_grade_computation.sql`
2. **Verify Function**: Check that `get_student_term_report_details` function is updated correctly
3. **No Data Migration Needed**: The fix is in the function logic, no table data changes required
4. **Backward Compatible**: Existing code calling this function will work without changes
5. **Performance**: Dynamic computation is efficient with proper indexes on `score_entries`

## Relationship to Other Migrations

This migration **supersedes** `20251222_fix_dynamic_grade_computation.sql` because it includes both:
- Grade computation fix (from the previous migration)
- Ranking computation fix (new in this migration)

Both migrations update the same function, so the second one effectively replaces the first.

## Technical Notes

### Performance Considerations

- **CTE Optimization**: Uses Common Table Expression (CTE) to compute averages once per query
- **Index Usage**: Relies on existing indexes on `score_entries(term_id, student_id, academic_class_id)`
- **Window Functions**: Uses `DENSE_RANK()` which is optimized in PostgreSQL

### Consistency Guarantees

- Rankings are computed in real-time from source data
- No synchronization issues between stored and computed values
- Grades always reflect current grading scheme rules

### Future Improvements

Consider adding:
1. Materialized view for student averages (if performance becomes an issue)
2. Trigger to update `student_term_reports.average_score` for backward compatibility
3. Audit log for ranking changes over time
