# Student Academic Goals Feature - Testing Guide

## Overview

This guide outlines how to test the Student Academic Goals feature, which allows students to set academic goals and receive achievement analysis on their report cards.

## Prerequisites

1. Database migration applied: `supabase/migrations/20251219_student_academic_goals.sql`
2. Active term configured in the system
3. At least one student enrolled in a class for the active term

## Testing Phases

### Phase 1: Goal Creation and Editing

#### Test 1.1: Student Can Access Goals Tab
**Steps:**
1. Log in as a student
2. Navigate to Student Portal
3. Click on "My Goals" tab

**Expected Result:**
- Goals tab is visible in the navigation
- Goal editor component loads successfully
- If no goal exists, form is in edit mode by default

#### Test 1.2: Create a New Goal
**Steps:**
1. In the Goals tab, enter a goal description (e.g., "I want to achieve 80% average and rank in top 5")
2. Set target average: 80
3. Set target position: 5
4. Add subject targets:
   - Mathematics: 85
   - English: 80
5. Click "Save Goal"

**Expected Result:**
- Success toast message appears
- Goal is saved to database
- Form switches to display mode showing saved goal

#### Test 1.3: Input Validation
**Steps:**
1. Try to save with empty goal description
2. Try to save with invalid target average (e.g., "abc" or 150)
3. Try to save with invalid target position (e.g., -1)
4. Try to save with invalid subject score (e.g., 110)

**Expected Result:**
- Each invalid input shows appropriate error message
- Goal is not saved until all inputs are valid

#### Test 1.4: Edit Existing Goal
**Steps:**
1. After creating a goal, click "Edit" button
2. Modify the goal description
3. Change target average to 85
4. Add a new subject target
5. Click "Save Goal"

**Expected Result:**
- Changes are saved successfully
- Updated goal is displayed
- Only one goal per student per term (enforced by database constraint)

#### Test 1.5: Cannot Edit After Term Ends
**Steps:**
1. Set the term end date to a past date in database
2. Reload the Goals tab

**Expected Result:**
- Warning message displayed: "Term has ended. Goal editing is disabled."
- Edit button is hidden
- All form inputs are disabled

### Phase 2: Goal Analysis Generation

#### Test 2.1: Bulk Goal Analysis via Report Card Generator
**Steps:**
1. Log in as Admin/Principal
2. Navigate to Results Management
3. Select a class and term
4. Click "Bulk Generate Report Cards"
5. Select students who have set goals
6. Choose template and settings
7. Click "Generate Reports"

**Expected Result:**
- Toast message appears: "Generating goal analyses..."
- Goal analysis is generated for each student with a goal
- Analysis is saved to `student_term_reports` table
- Report cards include goal analysis section

#### Test 2.2: Verify Goal Analysis Logic
**Setup:**
- Student A: Goal average 75%, Achieved 82%
- Student B: Goal average 85%, Achieved 70%
- Student C: Goal position 5, Achieved position 3

**Expected Analysis Ratings:**
- Student A: "exceeded" (surpassed target by 7%)
- Student B: "not_met" or "partially_met" (fell short by 15%)
- Student C: "exceeded" (better position than target)

#### Test 2.3: Multiple Target Analysis
**Setup:**
- Student sets: Average 80%, Position 10, Math 90%, English 85%
- Achieves: Average 82%, Position 8, Math 88%, English 90%

**Expected Result:**
- Analysis narrative mentions:
  - Exceeded average target
  - Exceeded position target (8 < 10)
  - Narrowly missed Math target (88 vs 90)
  - Exceeded English target (90 > 85)
- Overall rating: "met" or "exceeded"

### Phase 3: Report Card Display

#### Test 3.1: Goal Display on Report Card
**Steps:**
1. Generate report card for a student with a goal
2. View the report card (print preview or PDF)

**Expected Result:**
- "Academic Goal & Achievement Analysis" section appears after summary
- Goal statement is displayed in quotes
- Target metrics shown in grid layout:
  - Target Average (if set)
  - Target Position (if set)
  - Subject Targets (if set)

#### Test 3.2: Achievement Rating Badge
**Expected Result:**
- Rating badge displays with appropriate color:
  - Green: "exceeded"
  - Blue: "met"
  - Yellow: "partially met"
  - Red: "not met"
- Rating text uses proper spacing (replaceAll '_')

#### Test 3.3: Analysis Narrative
**Expected Result:**
- Analysis report is displayed in italic text
- Report includes:
  - Student name
  - Goal restatement
  - Achievement summary
  - Specific metrics comparison
  - Concluding statement based on rating
- Generation timestamp shown at bottom

#### Test 3.4: No Goal Scenario
**Steps:**
1. Generate report card for student without a goal

**Expected Result:**
- Goal section does not appear on report card
- No errors or empty sections displayed
- Report card renders normally

### Phase 4: Database and Security

#### Test 4.1: RLS Policy - Student Access
**Steps:**
1. As Student A, try to view goals
2. As Student A, try to view Student B's goals (via direct API call)

**Expected Result:**
- Student A can view/edit own goals only
- Student A cannot access Student B's goals
- RLS policy blocks unauthorized access

#### Test 4.2: RLS Policy - Staff Access
**Steps:**
1. As Teacher/Principal, query student goals

**Expected Result:**
- Staff can view goals for students in their school
- Staff from different schools cannot see each other's student goals

#### Test 4.3: Unique Constraint
**Steps:**
1. Try to insert duplicate goal for same student/term combination

**Expected Result:**
- Database constraint prevents duplicate
- Only one goal per student per term allowed
- Update operation works correctly

#### Test 4.4: Cascade Deletion
**Steps:**
1. Delete a student who has goals
2. Check student_academic_goals table

**Expected Result:**
- Associated goals are automatically deleted (ON DELETE CASCADE)
- No orphaned records remain

### Phase 5: RPC Function Integration

#### Test 5.1: RPC Returns Goal Data
**Steps:**
1. Call `get_student_term_report_details(student_id, term_id)` for student with goal

**Expected Result:**
- Response includes `academicGoal` object with:
  - goalText
  - targetAverage
  - targetPosition
  - targetSubjects
- If analysis exists, includes `goalAnalysis` object with:
  - report
  - achievementRating
  - generatedAt

#### Test 5.2: RPC Handles Missing Goals
**Steps:**
1. Call RPC for student without a goal

**Expected Result:**
- `academicGoal` is null
- `goalAnalysis` is null
- No errors thrown
- Other report data renders normally

### Phase 6: Edge Cases

#### Test 6.1: Null Target Fields
**Steps:**
1. Set goal with only description (no numeric targets)
2. Generate analysis

**Expected Result:**
- Goal saved successfully with nulls for optional fields
- Analysis focuses on general description
- Rating based on available data

#### Test 6.2: Subject Not in Score Entries
**Steps:**
1. Set target: "Chemistry: 80"
2. Student doesn't take Chemistry (no score entry)

**Expected Result:**
- Analysis handles missing subject gracefully
- Doesn't crash or throw errors
- May mention subject in narrative as "data not available"

#### Test 6.3: Long Goal Text
**Steps:**
1. Enter very long goal description (500+ characters)

**Expected Result:**
- Text is saved and displayed correctly
- No truncation or overflow issues on report card
- Text wraps appropriately in PDF

## Performance Testing

### Test 7.1: Bulk Analysis Performance
**Steps:**
1. Select 50+ students for bulk report generation
2. Monitor generation time

**Expected Result:**
- Goal analysis doesn't significantly slow down generation
- Progress indicator updates smoothly
- No timeout errors

### Test 7.2: Concurrent Goal Edits
**Steps:**
1. Have multiple students edit goals simultaneously

**Expected Result:**
- No database conflicts
- Each save operation completes independently
- No data corruption

## Regression Testing

### Test 8.1: Existing Features Unaffected
**Steps:**
1. Test report card generation without goals
2. Test student portal subject selection
3. Test timetable view

**Expected Result:**
- All existing features work as before
- No breaking changes introduced
- UI/UX remains consistent

## Browser Compatibility

Test on:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

## Accessibility

Test with:
- [ ] Screen reader (NVDA/JAWS)
- [ ] Keyboard navigation only
- [ ] High contrast mode
- [ ] Text zoom (200%)

## Checklist Summary

- [ ] Goal creation works
- [ ] Goal editing works
- [ ] Input validation prevents invalid data
- [ ] Term end disables editing
- [ ] Bulk analysis generates correctly
- [ ] Achievement ratings are accurate
- [ ] Report cards display goals properly
- [ ] RLS policies enforce security
- [ ] Database constraints work
- [ ] RPC function includes goal data
- [ ] Edge cases handled gracefully
- [ ] No performance degradation
- [ ] No regression in existing features
- [ ] Cross-browser compatible
- [ ] Accessible

## Known Limitations

1. Goal analysis is rule-based, not using external AI
2. One goal per student per term (by design)
3. Goals cannot be deleted, only edited or cleared
4. Analysis only generated during bulk report generation (not on-demand)

## Troubleshooting

**Issue: Goal not saving**
- Check browser console for errors
- Verify RLS policies are applied
- Check database connection
- Ensure student is enrolled in active term

**Issue: Analysis not appearing on report**
- Verify bulk generation was run after goals were set
- Check `student_term_reports.goal_analysis_report` column
- Ensure RPC function is updated

**Issue: "Term has ended" always showing**
- Check term end_date in database
- Verify timezone handling
- Check client-side date comparison logic

## Manual SQL Queries for Verification

```sql
-- View all goals for a term
SELECT 
    s.name as student_name,
    sag.goal_text,
    sag.target_average,
    sag.target_position,
    sag.target_subjects,
    sag.created_at,
    sag.updated_at
FROM student_academic_goals sag
JOIN students s ON s.id = sag.student_id
WHERE sag.term_id = :term_id;

-- View reports with goal analysis
SELECT 
    s.name as student_name,
    str.goal_achievement_rating,
    str.goal_analysis_report,
    str.goal_analysis_generated_at
FROM student_term_reports str
JOIN students s ON s.id = str.student_id
WHERE str.term_id = :term_id
AND str.goal_analysis_report IS NOT NULL;

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'student_academic_goals';
```

## Success Criteria

✅ All test cases pass
✅ No security vulnerabilities (CodeQL: 0 alerts)
✅ No production npm vulnerabilities
✅ Build completes successfully
✅ Code review feedback addressed
✅ Documentation complete
