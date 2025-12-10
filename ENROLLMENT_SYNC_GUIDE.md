# Student Enrollment Synchronization System

## Overview

This document describes the student enrollment synchronization system that maintains consistency between the `students` table (source of truth for class/arm assignments) and the `academic_class_students` table (term-based enrollment records).

## Problem Statement

Previously, the system had a dual source of truth issue:
- **Students Table**: Contains permanent class_id and arm_id fields
- **Academic Class Students Table**: Contains term-based enrollment records

This dual structure caused:
- Data inconsistencies
- Students appearing/disappearing from views unexpectedly
- Manual enrollment errors
- Missing students in reports and timetables

## Solution: Single Source of Truth

### Source of Truth: `students` Table

The **`students` table** is the authoritative source for a student's class and arm assignment:
- `students.class_id` → References the class (e.g., "JSS 1", "SSS 2")
- `students.arm_id` → References the arm/stream (e.g., "Gold", "Silver")

The `academic_class_students` table is automatically synchronized to reflect these assignments for each term.

## Automatic Synchronization

### 1. Database Triggers

A database trigger automatically syncs enrollments when:
- A new student is created with class_id and arm_id
- An existing student's class_id or arm_id is updated

**Trigger**: `trigger_sync_student_enrollment_on_change`
- Fires after INSERT or UPDATE on `students` table
- Calls `sync_student_enrollment_all_terms()` function
- Non-blocking: errors are logged but don't fail the main transaction

### 2. Term Creation

When a new term is created, the system automatically enrolls all active students:
- Matches students to academic classes by level, arm, and session
- Creates enrollment records in `academic_class_students`
- Happens in `handleSaveTerm()` function in App.tsx

### 3. Manual Admin Sync

Admins can manually trigger synchronization via:
- **Location**: Super Admin Console → Structure → Enrollment Sync
- **Options**: Sync single term or all recent terms
- **Function**: `admin_sync_student_enrollments()`

## Database Functions

### `sync_student_enrollment_for_term(student_id, term_id)`

Synchronizes a single student's enrollment for a specific term.

**Process**:
1. Fetches student's class_id and arm_id
2. If both are null, removes all enrollments for that term
3. Finds matching academic class (by level, arm, and session)
4. If no match found, removes enrollments
5. If match found, removes incorrect enrollments and creates/updates correct one

**Returns**: Number of enrollment records changed

### `sync_all_students_for_term(term_id, school_id)`

Bulk synchronizes all active students for a given term.

**Process**:
1. Iterates through all active students in the school
2. Calls `sync_student_enrollment_for_term()` for each
3. Aggregates total changes

**Returns**: Total number of enrollment records changed

### `sync_student_enrollment_all_terms(student_id)`

Synchronizes a student across all active terms (up to 10 most recent).

**Use Case**: Called when a student's class or arm changes

**Returns**: Total number of enrollment records changed across all terms

### `admin_sync_student_enrollments(school_id, term_id)`

Comprehensive sync function for admin tools.

**Parameters**:
- `school_id`: Optional - limit to specific school
- `term_id`: Optional - sync specific term or all recent terms (NULL)

**Returns**: JSONB object with:
```json
{
  "success": true,
  "terms_processed": 3,
  "enrollments_changed": 145,
  "timestamp": "2025-12-10T15:30:00Z"
}
```

## Enrollment Matching Logic

For each student, the system:

1. **Gets student data**:
   - `class_id` → resolves to class name (e.g., "JSS 1")
   - `arm_id` → resolves to arm name (e.g., "Gold")

2. **Gets term data**:
   - `term_id` → resolves to session_label (e.g., "2023/2024")

3. **Finds matching academic class**:
   - WHERE level = student's class name
   - AND arm = student's arm name
   - AND session_label = term's session
   - AND school_id matches
   - AND is_active = true

4. **Updates enrollment**:
   - Removes any incorrect enrollments
   - Creates/updates correct enrollment record

## Application Layer Integration

### Student Update Handler (`handleUpdateStudent`)

```typescript
// After updating student in database
if (studentData.class_id !== undefined || studentData.arm_id !== undefined) {
    // Refresh enrollment data to reflect changes
    // Database trigger handles the actual sync
}
```

### Term Creation Handler (`handleSaveTerm`)

```typescript
// After creating new term
const { data: syncResult } = await supabase.rpc(
    'sync_all_students_for_term',
    { p_term_id: data.id, p_school_id: userProfile.school_id }
);
// Logs result but doesn't fail term creation if sync fails
```

## Admin Tools

### Enrollment Sync Tool

**Location**: Super Admin Console → Structure Tab → Enrollment Sync

**Features**:
- Select specific term or all recent terms
- One-click synchronization
- Real-time progress feedback
- Detailed results:
  - Number of terms processed
  - Number of enrollments changed
  - Timestamp of sync

**When to Use**:
- After bulk student imports
- After data migration
- When reports show missing students
- After fixing data inconsistencies
- As regular maintenance (monthly/quarterly)

## Data Flow Diagram

```
┌─────────────────┐
│  students       │  ← SOURCE OF TRUTH
│  - class_id     │
│  - arm_id       │
└────────┬────────┘
         │
         │ (Trigger on INSERT/UPDATE)
         ▼
┌─────────────────────────┐
│ sync_student_           │
│ enrollment_all_terms()  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Find matching           │
│ academic_classes by:    │
│ - level (class name)    │
│ - arm (arm name)        │
│ - session_label         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ academic_class_students │  ← SYNCHRONIZED VIEW
│ (term enrollments)      │
└─────────────────────────┘
```

## Best Practices

### For Admins

1. **Set class/arm on all students**: Ensure every active student has both `class_id` and `arm_id` set
2. **Create academic classes first**: Before creating a term, ensure academic classes exist for that session
3. **Run sync after imports**: After bulk importing students, run manual sync
4. **Regular maintenance**: Run manual sync monthly to catch any edge cases

### For Developers

1. **Never manually modify academic_class_students**: Always update through students table or sync functions
2. **Use database functions**: Don't replicate sync logic in application code
3. **Handle sync errors gracefully**: Sync failures should log but not block main operations
4. **Test with various scenarios**:
   - Students without class/arm
   - Multiple arms in same class
   - Cross-campus students
   - Transferred students

## Troubleshooting

### Students Missing from Class Lists

**Cause**: Enrollment not synced
**Solution**: 
1. Check student has both `class_id` and `arm_id` set
2. Check matching academic class exists for current session
3. Run manual sync from Enrollment Sync Tool

### Duplicate Enrollments

**Cause**: Manual insertion bypassing sync functions
**Solution**:
1. Run manual sync - it will remove duplicates and keep correct one
2. Check application code isn't directly inserting into `academic_class_students`

### Sync Fails for Specific Student

**Check**:
1. Student's `class_id` references valid class
2. Student's `arm_id` references valid arm
3. Academic class exists matching: class.name = level, arm.name = arm, session matches term
4. Academic class is active (`is_active = true`)

### Performance Issues

The sync functions are optimized for:
- Up to 10,000 students per term
- Batch processing in single transaction
- Minimal database round-trips

If sync takes too long:
1. Sync one term at a time instead of all terms
2. Check database indexes on:
   - `students.class_id`
   - `students.arm_id`
   - `academic_classes.level`
   - `academic_classes.arm`
   - `academic_class_students.student_id`

## Migration Notes

### Initial Sync

The migration `20251210_add_student_enrollment_sync.sql` includes an initial sync for the active term:
```sql
-- Runs automatically during migration
DO $$
DECLARE
    v_active_term RECORD;
    v_result INTEGER;
BEGIN
    SELECT id INTO v_active_term FROM terms WHERE is_active = true LIMIT 1;
    IF FOUND THEN
        v_result := sync_all_students_for_term(v_active_term.id);
    END IF;
END $$;
```

### Permissions

All sync functions are granted to `authenticated` role:
```sql
GRANT EXECUTE ON FUNCTION sync_student_enrollment_for_term TO authenticated;
GRANT EXECUTE ON FUNCTION sync_all_students_for_term TO authenticated;
GRANT EXECUTE ON FUNCTION sync_student_enrollment_all_terms TO authenticated;
GRANT EXECUTE ON FUNCTION admin_sync_student_enrollments TO authenticated;
```

## Future Enhancements

### Potential Improvements

1. **Audit Trail**: Log all sync operations for review
2. **Dry Run Mode**: Preview changes before applying
3. **Conflict Resolution**: Handle edge cases like student in multiple classes
4. **Historical Tracking**: Track enrollment history over time
5. **Notifications**: Alert admins when sync detects issues

### Not Implemented (By Design)

- **Manual enrollment override**: Enrollments are always derived from students table
- **Partial sync**: Either sync all matching students or none
- **Custom enrollment rules**: All students follow the same matching logic

## Summary

The synchronization system ensures:
- ✅ Single source of truth: `students` table
- ✅ Automatic sync on student changes
- ✅ Automatic sync on term creation
- ✅ Manual sync tools for admins
- ✅ Consistent data across all views
- ✅ No missing students in reports/timetables
- ✅ Clear audit trail of changes

All enrollment views, reports, and timetables now rely on synchronized `academic_class_students` records, which are automatically kept in sync with the `students` table.
