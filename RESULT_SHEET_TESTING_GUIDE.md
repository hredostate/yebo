# Result Sheet Template Updates - Testing Guide

This document provides instructions for testing the updates to result sheet templates, including subject position calculations, CA component display, and student visibility controls.

## Changes Implemented

### 1. Database RPC Function Updates (`database_schema.sql`)

**Function:** `get_student_term_report_details(p_student_id INT, p_term_id INT)`

**Changes:**
- Subject positions are now calculated across grade level (e.g., all SS1 arms) instead of all students in school
- Added `componentScores` field to return CA breakdown from `score_entries.component_scores`
- Added `gradeLevelPosition` and `gradeLevelSize` to summary for cross-arm positioning

**Key SQL Updates:**
```sql
-- Subject position now filters by grade level
'subjectPosition', (
    SELECT COUNT(*) + 1 
    FROM public.score_entries se2 
    JOIN public.academic_classes ac2 ON se2.academic_class_id = ac2.id
    WHERE se2.term_id = p_term_id 
      AND se2.subject_name = se.subject_name 
      AND se2.total_score > se.total_score
      AND ac2.level = v_student_level
      AND ac2.session_label = v_session_label
)
```

### 2. TypeScript Type Updates (`src/types.ts`)

**Interface:** `StudentTermReportDetails`

**Changes:**
- Added `componentScores?: Record<string, number>` to subjects array
- Added `gradeLevelSize?: number` to summary

### 3. Result Sheet Design Updates (`src/components/ResultSheetDesigns.tsx`)

**Interface:** `ResultSheetProps`

**Changes:**
- Added `component_scores?: Record<string, number>` to subjects
- Added `assessmentComponents?: AssessmentComponent[]` for component definitions
- Added `subject_position?: number` to subjects
- Added `gradeLevelPosition?: number` and `gradeLevelSize?: number`

**Component Updates:**
- `ModernGradientResultSheet`: Shows component breakdown when available
- `BandedRowsResultSheet`: Dynamic columns for CA components with max scores
- All components updated to display grade-level position

### 4. Student Report View Updates (`src/components/StudentReportView.tsx`)

**Changes:**
- Added `isStudentUser?: boolean` prop to identify student users
- Strict blocking: Students cannot view unpublished reports (returns error)
- Staff can view unpublished reports with indicator
- Fetches assessment structure to get component definitions
- Passes assessment components to result sheet templates

## Testing Instructions

### Test 1: Subject Position Calculation Across Grade Level

**Prerequisites:**
1. Create multiple arms for the same grade level (e.g., SS1 Gold, SS1 Silver, SS1 Diamond)
2. Ensure students are enrolled in different arms but same grade level
3. Enter scores for the same subject across all arms

**Steps:**
1. Navigate to Score Entry
2. Enter Mathematics scores for students:
   - SS1 Gold: Student A = 95, Student B = 85
   - SS1 Silver: Student C = 90, Student D = 80
   - SS1 Diamond: Student E = 92, Student F = 88

**Expected Results:**
- Student A (95) should have position 1 in Mathematics across all SS1
- Student E (92) should have position 2
- Student C (90) should have position 3
- Student F (88) should have position 4
- Student B (85) should have position 5
- Student D (80) should have position 6

**Verification:**
1. Generate report for Student A → Check Mathematics position shows "1st"
2. Generate report for Student C → Check Mathematics position shows "3rd"
3. Verify positions are NOT calculated across all school (e.g., SS2, SS3)

### Test 2: CA Component Display

**Prerequisites:**
1. Create an assessment structure with multiple components:
   - CA1: 10 marks
   - CA2: 10 marks
   - CA3: 10 marks
   - Exam: 70 marks
2. Assign this assessment structure to an academic class
3. Enter component scores for students

**Steps:**
1. Navigate to Score Entry for the academic class
2. Enter component scores for a student:
   - CA1: 8
   - CA2: 9
   - CA3: 10
   - Exam: 65
   - Total: 92

**Expected Results:**
- Report should display all components in separate columns/sections
- BandedRowsResultSheet should show: CA1 (8/10), CA2 (9/10), CA3 (10/10), Exam (65/70)
- ModernGradientResultSheet should show component breakdown in card view
- Legacy reports without components should fall back to showing CA/Exam totals

**Verification:**
1. View report in different designs (Banded, Modern Gradient)
2. Verify all component scores are visible
3. Verify max scores are shown in column headers (BandedRows)
4. For classes without assessment structure, verify fallback to CA/Exam display

### Test 3: Student Visibility - Unpublished Reports

**Prerequisites:**
1. Create a student user account
2. Generate a report for that student but DO NOT publish it
3. Login as the student

**Steps (Student View):**
1. Login as student
2. Navigate to Reports section
3. Attempt to view the unpublished report

**Expected Results:**
- Student should see error message: "This report has not been published yet. Please check back later."
- Student should NOT be able to see any report data
- No warning badge - complete blocking

**Steps (Staff View):**
1. Login as staff/admin
2. Navigate to the same report
3. View the unpublished report

**Expected Results:**
- Staff can view the report
- Unpublished indicator should be visible
- All report data should be accessible

**Verification:**
1. Confirm student sees error (not just warning)
2. Confirm staff can view with indicator
3. Publish the report
4. Verify student can now view the report

### Test 4: Grade Level Position Display

**Prerequisites:**
1. Multiple students in different arms of same grade level
2. Reports generated for all students with varying averages

**Steps:**
1. Student in SS1 Gold with average 85%
2. Student in SS1 Silver with average 90%
3. Student in SS1 Diamond with average 88%
4. Generate reports for all three

**Expected Results:**
- SS1 Silver student (90%) → Grade position: 1st of 3
- SS1 Diamond student (88%) → Grade position: 2nd of 3
- SS1 Gold student (85%) → Grade position: 3rd of 3
- Position in arm should still show correctly

**Verification:**
1. Check both "Position in Arm" and "Position in Grade" are displayed
2. Verify grade position includes students from all arms
3. Verify arm position only includes students in the same arm

## Database Function Testing

To test the database function directly in Supabase SQL Editor:

```sql
-- Test the function with a sample student and term
SELECT * FROM public.get_student_term_report_details(1, 1);

-- Verify the returned JSON structure includes:
-- 1. subjects[].componentScores
-- 2. subjects[].subjectPosition (calculated by grade level)
-- 3. summary.gradeLevelPosition
-- 4. summary.gradeLevelSize
```

## Rollback Procedure

If issues are found, rollback steps:

1. Revert database function:
```sql
-- Restore previous version that calculates position across all students
-- And doesn't include componentScores
```

2. Revert code changes:
```bash
git revert <commit-hash>
```

## Known Limitations

1. **Grade Level Calculation**: Requires `academic_classes` with proper `level` and `session_label` values
2. **Component Scores**: Only displayed if `assessment_structure` is configured for the class
3. **Backward Compatibility**: Classes without assessment structures fall back to CA/Exam display

## Success Criteria

✅ Subject positions calculate correctly across grade level only  
✅ CA components display in separate columns when available  
✅ Students cannot view unpublished reports (strict blocking)  
✅ Staff can view unpublished reports with indicator  
✅ Grade level position displays correctly  
✅ Legacy reports (without components) still work  
✅ Build completes without TypeScript errors
