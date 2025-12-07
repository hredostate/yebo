# Result Sheet Template Updates - Implementation Summary

## Overview

This document summarizes the changes made to address three critical issues with result sheet templates:
1. Subject position calculation across grade level (not entire school)
2. Continuous Assessment (CA) component breakdown display
3. Student visibility control for unpublished reports

## Files Modified

### 1. `database_schema.sql`

**Function Updated:** `get_student_term_report_details(p_student_id INT, p_term_id INT)`

**Key Changes:**
- Added variables for grade level tracking: `v_student_level`, `v_session_label`, `v_grade_level_position`, `v_grade_level_size`
- Updated subject position calculation to filter by grade level using joins with `academic_classes`
- Added `componentScores` field to subjects array (from `score_entries.component_scores`)
- Added grade level position and size calculation
- Updated return object to include new fields

**Impact:** Subject positions now compare students within the same grade level (e.g., all SS1 arms), not across the entire school.

### 2. `src/types.ts`

**Interface Updated:** `StudentTermReportDetails`

**Changes:**
```typescript
subjects: {
    subjectName: string;
    componentScores?: Record<string, number>; // NEW: CA breakdown
    totalScore: number;
    gradeLabel: string;
    remark: string;
    subjectPosition: number;
}[];
summary: {
    average: number;
    positionInArm: number;
    positionInGradeLevel: number | null;
    gradeLevelSize?: number; // NEW: Total students in grade
    gpaAverage?: number | null;
};
```

### 3. `src/components/ResultSheetDesigns.tsx`

**Interface Updated:** `ResultSheetProps`

**Changes:**
```typescript
interface ResultSheetProps {
    // ... existing props
    subjects: Array<{
        subject_name: string;
        component_scores?: Record<string, number>; // NEW
        ca_score: number;
        exam_score: number;
        total_score: number;
        grade: string;
        remark: string;
        teacher_comment?: string;
        subject_position?: number; // NEW
    }>;
    assessmentComponents?: AssessmentComponent[]; // NEW
    gradeLevelPosition?: number; // NEW
    gradeLevelSize?: number; // NEW
}
```

**Components Updated:**
1. **ModernGradientResultSheet**: 
   - Shows component breakdown when `component_scores` available
   - Falls back to CA/Exam display for legacy data

2. **BandedRowsResultSheet**:
   - Dynamic table headers based on `assessmentComponents`
   - Renders component scores in separate columns with max scores
   - Shows grade level position in student details section
   - Displays subject position using helper function

3. **ExecutiveDarkResultSheet**: Updated signature to accept new props

4. **MinimalistResultSheet**: Updated signature to accept new props

**Helper Function Added:**
```typescript
const getOrdinal = (n: number | undefined | null): string => {
    if (!n) return '-';
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
```

### 4. `src/components/StudentReportView.tsx`

**Interface Updated:** `StudentReportViewProps`

**Changes:**
```typescript
interface StudentReportViewProps {
  studentId: number;
  termId: number;
  onBack: () => void;
  isStudentUser?: boolean; // NEW: Identifies student users
}
```

**Key Changes:**
1. Added state for `assessmentComponents`
2. Enhanced published status check:
   - If `isStudentUser=true` and report is unpublished → Block with error
   - If `isStudentUser=false` (staff) and report is unpublished → Show with indicator
3. Fetch assessment structure from academic class:
   ```typescript
   const { data: assessmentStructure } = await supabase
       .from('assessment_structures')
       .select('components')
       .eq('id', classData.assessment_structure_id)
       .maybeSingle();
   ```
4. Store assessment components for passing to result templates

### 5. `src/App.tsx`

**Change:** Pass `isStudentUser={true}` when rendering StudentReportView from student portal:

```typescript
return <StudentReportView 
    studentId={studentProfile.student_record_id} 
    termId={termId} 
    onBack={() => setCurrentView('Reports')} 
    isStudentUser={true} // NEW
/>;
```

## Technical Details

### Subject Position Calculation Logic

**Old Logic:**
```sql
SELECT COUNT(*) + 1 
FROM public.score_entries se2 
WHERE se2.term_id = p_term_id 
  AND se2.subject_name = se.subject_name 
  AND se2.total_score > se.total_score
```
*Problem: Compares across ALL students in school*

**New Logic:**
```sql
SELECT COUNT(*) + 1 
FROM public.score_entries se2 
JOIN public.academic_classes ac2 ON se2.academic_class_id = ac2.id
WHERE se2.term_id = p_term_id 
  AND se2.subject_name = se.subject_name 
  AND se2.total_score > se.total_score
  AND ac2.level = v_student_level      -- Same grade (e.g., SS1)
  AND ac2.session_label = v_session_label -- Same session
```
*Solution: Only compares students in same grade level across all arms*

### Grade Level Position Calculation

```sql
SELECT COUNT(*) + 1 INTO v_grade_level_position
FROM public.student_term_reports str
JOIN public.score_entries se ON str.student_id = se.student_id AND str.term_id = se.term_id
JOIN public.academic_classes ac ON se.academic_class_id = ac.id
WHERE str.term_id = p_term_id
  AND ac.level = v_student_level
  AND ac.session_label = v_session_label
  AND str.average_score > v_report_row.average_score;
```

### Component Score Display

**Data Flow:**
1. Database stores component scores in `score_entries.component_scores` (JSONB)
2. RPC function returns: `'componentScores', COALESCE(se.component_scores, '{}'::jsonb)`
3. TypeScript type: `componentScores?: Record<string, number>`
4. UI renders based on availability:
   - If components exist → Show detailed breakdown
   - If components null/empty → Fall back to CA/Exam totals

### Student Visibility Control

**Logic Flow:**
```typescript
if (reportMeta && !reportMeta.is_published) {
    if (isStudentUser) {
        setError('This report has not been published yet...');
        return; // Block completely
    }
    setIsPublished(false); // Staff can view with indicator
}
```

## Backward Compatibility

✅ **Legacy Data Support:**
- Reports without `component_scores` fall back to `ca_score`/`exam_score`
- Classes without assessment structures show traditional CA/Exam columns
- Existing reports continue to work without modification

✅ **TypeScript Compatibility:**
- All new fields are optional (`?`)
- Default values provided where needed
- No breaking changes to existing interfaces

## Performance Considerations

1. **Database Queries:**
   - Subject position: O(n) where n = students in grade level (reduced from all students)
   - Grade level position: Single query with joins
   - Assessment structure: Cached per class

2. **Frontend:**
   - Component scores rendered dynamically
   - No impact on initial load time
   - Print-friendly layouts maintained

## Security Enhancements

1. **Student Access Control:**
   - Strict blocking for unpublished reports
   - No data leakage through UI
   - Error message only (no hints about content)

2. **Staff Privileges:**
   - Can preview unpublished reports
   - Visual indicator for unpublished status
   - No data loss for authorized users

## Testing Coverage

See `RESULT_SHEET_TESTING_GUIDE.md` for detailed testing instructions.

**Key Test Cases:**
1. ✅ Subject position across grade level
2. ✅ CA component display with multiple components
3. ✅ Student blocking for unpublished reports
4. ✅ Staff viewing with unpublished indicator
5. ✅ Grade level position calculation
6. ✅ Backward compatibility with legacy data

## Deployment Notes

1. **Database Migration:**
   - Run updated `database_schema.sql` to replace RPC function
   - No data migration needed (uses existing columns)
   - Zero downtime deployment possible

2. **Frontend Deployment:**
   - Standard build and deploy process
   - No environment variables required
   - Cache invalidation recommended for assets

3. **Validation:**
   - Test with sample student data
   - Verify positions calculated correctly
   - Check component display in multiple designs
   - Confirm student access control

## Future Enhancements

1. **Performance Optimization:**
   - Consider materialized views for grade-level statistics
   - Cache assessment structures per session
   - Batch position calculations

2. **Feature Additions:**
   - Subject position trends over terms
   - Component-level analysis
   - Custom component configurations per subject

3. **UI Improvements:**
   - Graphical component score visualization
   - Interactive position rankings
   - Mobile-optimized result templates

## Support Information

**Documentation:**
- Testing Guide: `RESULT_SHEET_TESTING_GUIDE.md`
- User Guide: `USER_GUIDE_RESULTS_MANAGEMENT.md`

**Key Functions:**
- Database: `get_student_term_report_details()`
- TypeScript: `StudentTermReportDetails` interface
- Components: `ResultSheetDesigns.tsx`, `StudentReportView.tsx`

**Related Tables:**
- `score_entries` (component_scores JSONB)
- `academic_classes` (level, session_label)
- `assessment_structures` (components)
- `student_term_reports` (is_published, position_in_grade)
