# Enrollment Sync Score Protection Implementation

## Overview

This implementation adds score entry protection to the enrollment synchronization system to prevent students with existing scores from being removed from enrollments. This ensures teachers can always see and grade students in the Result Manager, even if there are issues with class/arm assignments.

## Problem Statement

The enrollment sync system was removing students when:
1. Student's `class_id` or `arm_id` is NULL
2. No matching `academic_class` exists with the same `level` and `arm` text values
3. The matching is case-sensitive and exact

**Critical Issue**: Students who already have score entries were being removed, causing:
- Data loss
- Teachers unable to see students in Result Manager
- Inability to enter or update scores for affected students

## Solution Components

### 1. Score Entry Protection in `sync_student_enrollment`

**Location**: `supabase/migrations/20251213_enrollment_sync_score_protection.sql`

**Implementation**:
- Before any DELETE operation, the function checks if the student has `score_entries` for the term
- If scores exist, the enrollment is preserved and the action is logged as `preserved_with_scores`
- Returns a JSONB object with:
  - `action`: 'preserved_with_scores'
  - `student_id`: The student's ID
  - `score_count`: Number of score entries
  - `academic_class_id`: Current enrollment class
  - `reason`: 'student_has_existing_scores'

**Code Example**:
```sql
-- Check if student has score entries for this term before removing
SELECT COUNT(*) INTO v_score_count
FROM score_entries
WHERE student_id = p_student_id
  AND term_id = p_term_id;

IF v_score_count > 0 THEN
    -- Don't remove enrollment if student has scores
    RETURN jsonb_build_object(
        'action', 'preserved_with_scores',
        'student_id', p_student_id,
        'score_count', v_score_count,
        'reason', 'student_has_existing_scores'
    );
END IF;
```

### 2. Updated `sync_all_students_for_term` Function

**New Tracking**: Added `preserved_with_scores` counter to track students protected due to score entries

**Statistics Returned**:
- `created`: New enrollments
- `updated`: Modified enrollments
- `removed`: Deleted enrollments
- `errors`: Failures
- `preserved_manual`: Manual enrollments preserved
- `preserved_with_scores`: Students with scores protected (NEW)
- `total_processed`: Total students processed

### 3. New `repair_missing_enrollments` Function

**Purpose**: Restores enrollment records for students who have scores but are missing from `academic_class_students`

**Parameters**:
- `p_term_id`: Term to repair
- `p_school_id`: School ID

**Returns**:
```json
{
  "success": true,
  "term_id": 1,
  "school_id": 1,
  "repaired": 15,
  "failed": 2,
  "message": "15 enrollments repaired, 2 failed"
}
```

**Algorithm**:
1. Finds students with `score_entries` but no entry in `academic_class_students`
2. Attempts to use the `academic_class_id` from their score entries
3. Verifies the academic class is still active
4. Falls back to matching by student's `class_id` and `arm_id` if needed
5. Creates enrollment records for successfully matched students
6. Returns statistics on repairs and failures

### 4. New `get_enrollment_removal_candidates` Function

**Purpose**: Diagnostic function showing which students WOULD be removed by sync (without actually removing them)

**Returns**: Table with columns:
- `student_id`, `student_name`
- `current_class_id`, `current_arm_id`
- `enrolled_academic_class_id`, `enrolled_academic_class_name`
- `has_scores`: Boolean indicating if student has score entries
- `score_count`: Number of score entries
- `would_be_removed`: Boolean indicating if student would be removed
- `removal_reason`: Explanation of why they would be removed

**Use Cases**:
- Preview sync impact before running it
- Identify students with scores who need attention
- Understand why certain students are being protected

## UI Updates

### EnrollmentSyncTool Component

**Location**: `src/components/EnrollmentSyncTool.tsx`

**Changes**:

1. **New State Variables**:
   - `repairing`: Boolean for repair operation status
   - `repairResult`: Stores repair operation results

2. **New Handler**: `handleRepair()`
   - Calls `repair_missing_enrollments` RPC function
   - Displays success/failure toast notifications
   - Shows repair statistics

3. **New UI Button**: "Repair Missing"
   - Green/emerald colored button
   - Calls repair function when clicked
   - Disabled during sync, diagnostics, or repair operations

4. **Updated Sync Results Display**:
   - Shows `preserved_with_scores` count when > 0
   - Displays in teal-colored box with "Protected" label
   - Includes informational message about score protection

5. **New Repair Results Section**:
   - Shows number of enrollments repaired
   - Shows number of failures (if any)
   - Displays success message

6. **Updated Information Panel**:
   - Added Score Protection bullet point
   - Added Repair Missing bullet point
   - Uses shield and wrench emojis for visual distinction

## Documentation Updates

### ENROLLMENT_SYNC_GUIDE.md

**New Sections**:

1. **Score Entry Protection**:
   - How score protection works
   - When students are protected
   - Code examples for repair function
   - Diagnostic functions documentation

2. **Troubleshooting**:
   - "Students Missing from Result Manager" section
   - "Score Protection Warning During Sync" section
   - Step-by-step repair instructions

3. **API Integration**:
   - Updated with new RPC function calls
   - Examples for `repair_missing_enrollments`
   - Examples for `get_enrollment_removal_candidates`

## Testing Verification

### Manual Testing Steps:

1. **Test Score Protection**:
   ```sql
   -- Create a student with scores but no class/arm assignment
   UPDATE students SET class_id = NULL, arm_id = NULL WHERE id = <student_id>;
   
   -- Run sync
   SELECT * FROM admin_sync_student_enrollments(<term_id>, <school_id>);
   
   -- Verify student appears in preserved_with_scores count
   -- Verify enrollment still exists in academic_class_students
   ```

2. **Test Repair Function**:
   ```sql
   -- Manually delete an enrollment for a student with scores
   DELETE FROM academic_class_students 
   WHERE student_id = <student_id> AND enrolled_term_id = <term_id>;
   
   -- Run repair
   SELECT * FROM repair_missing_enrollments(<term_id>, <school_id>);
   
   -- Verify enrollment was restored
   SELECT * FROM academic_class_students 
   WHERE student_id = <student_id> AND enrolled_term_id = <term_id>;
   ```

3. **Test Removal Candidates Diagnostic**:
   ```sql
   -- Preview what would be removed
   SELECT * FROM get_enrollment_removal_candidates(<term_id>, <school_id>);
   
   -- Verify students with scores show has_scores = true
   -- Verify would_be_removed reflects protection logic
   ```

4. **UI Testing**:
   - Navigate to Super Admin Console → Structure → Enrollment Sync
   - Select a term
   - Click "Sync Enrollments" - verify preserved_with_scores appears in results
   - Click "Repair Missing" - verify repair statistics are displayed
   - Verify all buttons disable appropriately during operations

## Database Migration

**File**: `supabase/migrations/20251213_enrollment_sync_score_protection.sql`

**Migration Steps**:
1. Drops and recreates `sync_student_enrollment` (both 3 and 4 parameter versions)
2. Drops and recreates `sync_all_students_for_term` (both 2 and 3 parameter versions)
3. Creates new `repair_missing_enrollments` function
4. Creates new `get_enrollment_removal_candidates` function
5. Drops and recreates `admin_sync_student_enrollments` for consistency
6. Grants execute permissions to all functions
7. Adds documentation comments to all functions

**Backward Compatibility**:
- All wrapper functions maintained for 3-parameter and 2-parameter versions
- Existing code calling old function signatures continues to work
- Default behavior unchanged (preserve_manual = TRUE)

## Performance Considerations

1. **Score Entry Check**: Adds a COUNT query to `score_entries` before each removal
   - Indexed on `student_id` and `term_id` for performance
   - Only runs when student would otherwise be removed

2. **Repair Function**: 
   - Processes students one at a time in a loop
   - Uses exception handling to prevent single failures from blocking entire repair
   - May take longer for schools with many students

3. **Removal Candidates**:
   - Read-only diagnostic query
   - Uses EXISTS clauses for efficiency
   - Sorted by removal priority and score status

## Security Considerations

1. **Permissions**: All functions granted to `authenticated` role only
2. **Data Integrity**: Uses ON CONFLICT DO NOTHING for repair inserts
3. **Audit Trail**: All operations return detailed JSONB results for logging
4. **Validation**: Verifies academic classes are active before creating enrollments

## Future Enhancements

1. **Batch Repair**: Add parameter to repair specific student IDs only
2. **Auto-Repair**: Option to automatically run repair after sync
3. **Email Notifications**: Alert admins when students are protected due to scores
4. **Historical Tracking**: Log all score protection events in audit table
5. **Force Override**: Admin option to override score protection (with confirmation)

## Version History

- **v2.0.0** (December 2024): Added score entry protection and repair functions
- **v1.0.0** (December 2024): Initial enrollment sync implementation

## Support

For issues or questions:
1. Check `ENROLLMENT_SYNC_GUIDE.md` for usage documentation
2. Run `get_enrollment_removal_candidates` to preview sync impact
3. Use `get_enrollment_sync_diagnostics` to identify issues
4. Review function comments in migration file for detailed behavior

---

**Implementation Date**: December 12, 2024
**Author**: GitHub Copilot
**Status**: Complete
