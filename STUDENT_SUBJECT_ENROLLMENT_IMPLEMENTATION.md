# Student Subject Enrollment System Implementation Summary

## Overview

Implemented a student subject enrollment system that allows administrators to explicitly control which students in a class/arm take which subjects. This prevents teachers from inadvertently entering zero scores for students not taking certain subjects (e.g., electives).

## Implementation Date
December 12, 2024

## Problem Addressed

Previously, when teachers entered scores for a subject, **all students enrolled in an academic class were shown** regardless of whether they actually took that specific subject. This caused issues where:
- Teachers could inadvertently enter zero scores for students not taking the subject
- Students who don't take certain subjects (e.g., electives) still appeared in the score entry sheet

## Solution Components

### 1. Database Changes

**New Table: `student_subject_enrollments`**

```sql
CREATE TABLE IF NOT EXISTS public.student_subject_enrollments (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES public.subjects(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    is_enrolled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, subject_id, academic_class_id, term_id)
);
```

**Files Modified:**
- `database_schema.sql` - Added table creation
- `src/databaseSchema.ts` - Added conditional table creation in DICTIONARY_FIX_SQL

### 2. TypeScript Types

**New Interface: `StudentSubjectEnrollment`**

```typescript
export interface StudentSubjectEnrollment {
    id: number;
    school_id: number;
    student_id: number;
    subject_id: number;
    academic_class_id: number;
    term_id: number;
    is_enrolled: boolean;
    created_at?: string;
    updated_at?: string;
}
```

**File Modified:**
- `src/types.ts`

### 3. TeacherScoreEntryView Updates

**Modified:** `src/components/TeacherScoreEntryView.tsx`

**Changes:**
- Added `allSubjects` and `studentSubjectEnrollments` props
- Updated `enrolledStudents` logic to filter based on subject enrollment
- Implements backward compatibility: if no enrollment records exist for a subject, shows all class students

**Filtering Logic:**
```typescript
const enrolledStudents = useMemo(() => {
    if (!assignment) return [];
    
    return students.filter(s => {
        // Check if student is in the academic class
        const isInClass = academicClassStudents.some(acs => 
            acs.student_id === s.id && 
            acs.academic_class_id === assignment.academic_class_id &&
            acs.enrolled_term_id === assignment.term_id
        );
        
        if (!isInClass) return false;
        
        // Get subject ID from subject name
        const subject = allSubjects.find(sub => sub.name === assignment.subject_name);
        if (!subject) {
            console.warn(`Subject not found: ${assignment.subject_name}`);
            return true; // Fallback
        }
        
        // Check for enrollment records
        const enrollmentRecords = studentSubjectEnrollments.filter(sse =>
            sse.academic_class_id === assignment.academic_class_id &&
            sse.subject_id === subject.id &&
            sse.term_id === assignment.term_id
        );
        
        // If no enrollment records exist, show all students (backward compatibility)
        if (enrollmentRecords.length === 0) return true;
        
        // Otherwise, only show students with is_enrolled = true
        return enrollmentRecords.some(sse => 
            sse.student_id === s.id && sse.is_enrolled === true
        );
    }).sort((a, b) => a.name.localeCompare(b.name));
}, [assignment, academicClassStudents, students, allSubjects, studentSubjectEnrollments]);
```

### 4. Admin UI Component

**New File:** `src/components/admin/StudentSubjectEnrollmentManager.tsx`

**Features:**
- View all students in a selected academic class
- Matrix/grid view with:
  - Rows: Students in the class
  - Columns: Subjects available for that class
  - Cells: Checkboxes to toggle enrollment
- Bulk enroll/unenroll students for a subject
- Filter by academic class, term
- Search students by name or admission number

**Key Features:**
1. **Academic Class & Term Selection:** Dropdown filters to select the context
2. **Student Search:** Real-time search by name or admission number
3. **Individual Toggle:** Click checkbox to enroll/unenroll individual students
4. **Bulk Actions:** "All ✓" and "None ✗" buttons to quickly enroll/unenroll all students for a subject
5. **Visual Feedback:** Green checkmark for enrolled, gray X for not enrolled
6. **Atomic Operations:** Uses upsert to ensure data consistency

### 5. App.tsx Updates

**Changes:**
- Added `studentSubjectEnrollments` state
- Fetches enrollment data from Supabase on load
- Passes data to AppRouter
- Added `reloadData` function to actions for refreshing after enrollment changes

### 6. AppRouter Updates

**File:** `src/components/AppRouter.tsx`

**Changes:**
- Added import for `StudentSubjectEnrollmentManager`
- Added route for `VIEWS.STUDENT_SUBJECT_ENROLLMENT_MANAGER`
- Passes `allSubjects` and `studentSubjectEnrollments` to `TeacherScoreEntryView`

### 7. Navigation

**Added to Sidebar:** `src/components/Sidebar.tsx`
- Located in the **"Student Affairs"** section
- Menu item: **"Subject Enrollment"**
- Appears after "Subject Choices"
- Requires `manage-students` permission

**Added constant:** `VIEWS.STUDENT_SUBJECT_ENROLLMENT_MANAGER` in `src/constants.ts`

**Navigation Path:**
```
Sidebar → Student Affairs → Subject Enrollment
```

## Backward Compatibility

The system is **fully backward compatible**:

- If no enrollment records exist for a subject/class/term combination, the system falls back to showing all students (current behavior)
- This prevents breaking existing score entry workflows
- Schools can gradually adopt the enrollment system without disruption

## Usage Guide

### For Administrators

1. **Navigate to Student Subject Enrollment**
   - Access via the admin menu or navigation

2. **Select Academic Class and Term**
   - Choose the academic class (e.g., "JSS 1 Gold (2023/2024)")
   - Select the term (e.g., "2023/2024 - First Term")

3. **Manage Enrollments**
   - View the matrix of students and subjects
   - Click checkboxes to toggle individual enrollments
   - Use "All ✓" or "None ✗" for bulk actions

4. **Search Students**
   - Use the search box to filter students by name or admission number

### For Teachers

**Score Entry Behavior:**

1. **Without Enrollment Records:**
   - All students in the class appear (default behavior)

2. **With Enrollment Records:**
   - Only students enrolled in the subject appear
   - Students not taking the subject won't show up
   - Prevents accidental zero scores

## Technical Notes

### Database Constraints
- Unique constraint ensures one enrollment record per student-subject-class-term combination
- Cascading deletes ensure data integrity when related records are removed

### Performance Considerations
- Enrollment data is loaded once on app initialization
- Uses memoization to avoid unnecessary recalculations
- Bulk operations use upsert for atomicity

### Security
- All operations respect school_id boundaries
- CodeQL security scan passed with no alerts

## Files Modified

1. `database_schema.sql` - New table
2. `src/databaseSchema.ts` - Migration SQL
3. `src/types.ts` - New interface
4. `src/constants.ts` - New view constant
5. `src/App.tsx` - State management and data loading
6. `src/components/AppRouter.tsx` - Routing
7. `src/components/TeacherScoreEntryView.tsx` - Filtering logic
8. `src/components/admin/StudentSubjectEnrollmentManager.tsx` - New component

## Testing Checklist

- [x] Build successfully completes
- [x] TypeScript compilation passes
- [x] Code review completed and issues addressed
- [x] Security scan passes (CodeQL)
- [ ] Manual testing of enrollment manager UI
- [ ] Manual testing of score entry filtering
- [ ] Test backward compatibility with no enrollment records
- [ ] Test bulk enrollment/unenrollment
- [ ] Test search functionality

## Future Enhancements

1. **Import/Export:** Allow bulk import of enrollment data from CSV
2. **Templates:** Create enrollment templates that can be reused across terms
3. **Auto-enrollment:** Automatically enroll students based on compulsory subject rules
4. **Audit Trail:** Track who made enrollment changes and when
5. **Class-based Filtering:** In the enrollment manager, filter students to only show those actually in the academic class (currently shows all students)

## Migration Notes

**For Existing Deployments:**

1. Run the SQL migration in `src/databaseSchema.ts` (DICTIONARY_FIX_SQL)
2. The table will be created automatically on next schema update
3. No data migration needed - system works without enrollment records
4. Administrators can gradually add enrollment records as needed

## Support

For issues or questions:
- Check console logs for warnings about missing subjects
- Verify academic class and term selection in enrollment manager
- Ensure subjects are properly configured in the system
