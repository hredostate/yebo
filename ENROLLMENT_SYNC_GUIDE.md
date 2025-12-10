# Enrollment Synchronization System Guide

## Overview

The Enrollment Synchronization System resolves the dual source of truth problem for student class and arm assignments by establishing the `students` table as the authoritative source and automatically synchronizing enrollments in the `academic_class_students` table.

## Architecture

### Source of Truth

- **Primary Source**: `students` table (`class_id` and `arm_id` columns)
- **Synchronized Target**: `academic_class_students` table (term-based enrollment records)

### How It Works

1. **Student Assignment**: Students are assigned to a class and arm in the `students` table via `class_id` and `arm_id`
2. **Academic Classes**: Academic classes are created with a `level` (matching class name) and `arm` (matching arm name)
3. **Automatic Matching**: The sync system matches students to academic classes by comparing:
   - `students.class_id` → `classes.name` → `academic_classes.level`
   - `students.arm_id` → `arms.name` → `academic_classes.arm`
4. **Enrollment Creation**: When a match is found, an enrollment record is created/updated in `academic_class_students`

## Automatic Synchronization

### Trigger 1: Student Update

When a student's `class_id` or `arm_id` is updated:
- The system automatically updates their enrollment in all **active** terms
- If no matching academic class exists, the student is removed from enrollment
- This ensures enrollments stay current as students are promoted or transferred

**Database Trigger**: `student_enrollment_sync_trigger` on `students` table

### Trigger 2: Term Creation/Activation

When a new term is created or an existing term is activated:
- All students in the school are automatically enrolled in the appropriate academic classes
- Students without class/arm assignments are skipped
- Students with assignments but no matching academic class are logged

**Database Trigger**: `term_enrollment_sync_trigger` on `terms` table

## Manual Synchronization

### Accessing the Sync Tool

1. Navigate to **Super Admin Console**
2. Click on the **Structure** tab
3. Select the **Enrollment Sync** sub-tab

### Using the Sync Tool

#### Step 1: Select a Term
- Choose the academic term you want to sync from the dropdown
- Active terms are marked with "(Active)"

#### Step 2: Run Sync
- Click the **"Sync Enrollments"** button
- Wait for the sync to complete
- Review the sync statistics:
  - **Created**: New enrollment records added
  - **Updated**: Existing enrollments modified
  - **Removed**: Enrollments deleted (student no longer assigned or no matching class)
  - **Errors**: Issues encountered during sync

#### Step 3: Run Diagnostics (Optional)
- Click **"Run Diagnostics"** to identify students with enrollment issues
- The diagnostic report shows:
  - Students without class/arm assignments
  - Students with assignments but no matching academic class
  - Students enrolled in wrong classes
  - Students not enrolled but should be

### Understanding Sync Results

**Status Badges**:
- 🟢 **SYNCED**: Student is correctly enrolled
- 🟡 **NOT ENROLLED**: Student should be enrolled but isn't
- 🟠 **MISMATCHED**: Student is enrolled in the wrong class
- ⚪ **NO ASSIGNMENT**: Student has no class/arm in the students table
- 🔴 **NO MATCHING CLASS**: Student has an assignment but no corresponding academic class exists

## Database Functions

### `sync_student_enrollment(p_student_id, p_term_id, p_school_id)`
Synchronizes a single student's enrollment for a specific term.

**Returns**: JSONB with action taken ('created', 'updated', 'removed', 'error')

### `sync_all_students_for_term(p_term_id, p_school_id)`
Bulk synchronizes all students for a specific term.

**Returns**: JSONB with statistics (created, updated, removed, errors)

### `admin_sync_student_enrollments(p_term_id, p_school_id)`
Admin version with before/after counts and detailed statistics.

**Returns**: JSONB with before_count, after_count, and sync_stats

### `get_enrollment_sync_diagnostics(p_term_id, p_school_id)`
Identifies students with enrollment sync issues.

**Returns**: Table with diagnostic information for out-of-sync students

## Common Scenarios

### Scenario 1: New Academic Year
1. Create new terms in the Terms Manager
2. Mark the first term as active
3. Students are automatically enrolled based on their current class/arm
4. Run diagnostics to verify all students are enrolled correctly

### Scenario 2: Student Promotion
1. Update student's `class_id` in the Student List
2. System automatically updates their enrollment in all active terms
3. Verify enrollment in Academic Classes

### Scenario 3: Student Transfer
1. Update both `class_id` and `arm_id` for the student
2. System automatically re-enrolls them in the correct academic class
3. Previous enrollment is removed/updated as needed

### Scenario 4: Fixing Enrollment Issues
1. Go to Super Admin Console → Structure → Enrollment Sync
2. Select the problematic term
3. Click "Run Diagnostics" to identify issues
4. Review the diagnostic report
5. Fix root causes (e.g., create missing academic classes, update student assignments)
6. Click "Sync Enrollments" to apply corrections
7. Run diagnostics again to verify

## Best Practices

### 1. Maintain Clean Data
- Ensure all active students have a `class_id` and `arm_id`
- Create academic classes that match all class/arm combinations in use
- Use consistent naming between classes/arms and academic class levels/arms

### 2. Regular Audits
- Run diagnostics at the start of each term
- Review the diagnostic report for anomalies
- Sync manually if automatic sync failed for any reason

### 3. Academic Class Setup
- Create academic classes **before** activating a new term
- Ensure the `level` field exactly matches the class name (e.g., "JSS 1")
- Ensure the `arm` field exactly matches the arm name (e.g., "A")
- Mark academic classes as active (`is_active = TRUE`)

### 4. Monitoring
- Check sync statistics after major data imports
- Verify enrollments after bulk student updates
- Run diagnostics before publishing results or generating reports

## Troubleshooting

### Students Not Enrolled After Term Creation
**Cause**: Academic classes for student's class/arm combination don't exist

**Solution**: 
1. Check academic classes in Structure → Academic Classes
2. Create missing academic classes with matching level and arm
3. Run manual sync

### Student Enrolled in Wrong Class
**Cause**: Student's `class_id` or `arm_id` in students table is incorrect

**Solution**:
1. Update student's class/arm assignment in Student List
2. System will auto-sync, or run manual sync

### Sync Errors Reported
**Cause**: Database constraint violations or missing references

**Solution**:
1. Run diagnostics to identify the issue
2. Check database logs for detailed error messages
3. Verify data integrity (no orphaned references)
4. Contact system administrator if issue persists

### Enrollment Count Decreased After Sync
**Cause**: Some students were enrolled in classes that don't match their current assignment

**Solution**: This is expected behavior. The sync removed incorrect enrollments. Run diagnostics to verify students are now correctly assigned.

## Technical Details

### Database Schema

**students table** (source of truth):
- `id`: Student identifier
- `class_id`: Reference to classes table
- `arm_id`: Reference to arms table
- `school_id`: School identifier

**academic_classes table** (enrollment target):
- `id`: Academic class identifier
- `level`: Text matching class name
- `arm`: Text matching arm name
- `is_active`: Boolean flag
- `school_id`: School identifier

**academic_class_students table** (enrollment records):
- `id`: Enrollment identifier
- `academic_class_id`: Reference to academic_classes
- `student_id`: Reference to students
- `enrolled_term_id`: Reference to terms
- Unique constraint: (academic_class_id, student_id, enrolled_term_id)

### Triggers

1. **student_enrollment_sync_trigger**: Fires on INSERT or UPDATE of students table
2. **term_enrollment_sync_trigger**: Fires on INSERT or UPDATE of terms table

### Performance Considerations

- Bulk sync processes all students in a transaction
- Large schools (>5000 students) may experience a brief delay during sync
- Triggers execute asynchronously after the main transaction
- No user-facing delays for individual student updates

## API Integration

For programmatic access, you can call the RPC functions directly:

```javascript
// Manual sync
const { data, error } = await supabase.rpc('admin_sync_student_enrollments', {
    p_term_id: termId,
    p_school_id: schoolId
});

// Run diagnostics
const { data, error } = await supabase.rpc('get_enrollment_sync_diagnostics', {
    p_term_id: termId,
    p_school_id: schoolId
});
```

## Support

For issues or questions about the enrollment sync system:
1. Run diagnostics to identify the problem
2. Check this guide for troubleshooting steps
3. Review database logs for detailed error messages
4. Contact technical support with diagnostic report

---

**Last Updated**: December 2024
**Version**: 1.0.0
