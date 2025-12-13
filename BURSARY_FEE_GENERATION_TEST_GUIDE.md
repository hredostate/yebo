# Bursary Fee Generation Test Guide

## Overview
This guide provides steps to test the bursary fee generation feature, which excludes students working in the bursary department from having fees generated for them.

## Test Scenarios

### Scenario 1: Add Students with Different Bursary Status

1. **Navigate to Student Roster**
   - Go to Student Affairs → Student Roster

2. **Add Regular Student**
   - Click "Add New Student"
   - Fill in required fields (Name, Date of Birth, etc.)
   - Select a Class (e.g., "JSS 1")
   - Leave "Working in Bursary (Exempt from Fees)" **unchecked**
   - Click "Add Student"
   - **Expected Result**: Student is added without bursary status

3. **Add Bursary Worker Student**
   - Click "Add New Student"
   - Fill in required fields (Name, Date of Birth, etc.)
   - Select the same Class (e.g., "JSS 1")
   - **Check** "Working in Bursary (Exempt from Fees)"
   - Click "Add Student"
   - **Expected Result**: Student is added with bursary status

4. **Verify Visual Indicators**
   - In the student list, find the bursary worker student
   - **Expected Result**: A purple badge reading "💼 Bursary Staff" should appear below their status
   - Hover over the badge
   - **Expected Result**: Tooltip shows "Exempt from fees"

### Scenario 2: Generate Invoices (Fee Generation)

1. **Navigate to Student Finance**
   - Go to Finance & Ops → Bursary (Fees)

2. **Create Fee Items (if not already exists)**
   - Go to "Fee Configuration" tab
   - Add a fee item (e.g., "Tuition Fee - ₦50,000")
   - Click "Add Fee"

3. **Generate Invoices**
   - Go to "Invoices" tab
   - In the "Generate Invoices" section:
     - Select a Term
     - Select the Class that has both regular and bursary students (e.g., "JSS 1")
   - **Expected Result**: An informational message appears:
     ```
     ℹ️ Note: 1 student is working in bursary and will be excluded from invoice generation.
     ```
   - Note the student count in the "Generate" button
   - **Expected Result**: Count should be total students in class MINUS bursary workers
   - Select fee items to include
   - Set a due date
   - Click "Generate for X Students"

4. **Verify Invoice Generation**
   - Check the invoices list
   - **Expected Result**: 
     - Regular students have invoices generated
     - Bursary worker students do NOT have invoices generated
   - Search for the bursary worker student's name
   - **Expected Result**: No invoice should be found for this student

### Scenario 3: Mixed Class Test

1. **Create Test Class with Multiple Students**
   - Add 5 students to a class:
     - 3 regular students (not working in bursary)
     - 2 bursary workers (working in bursary checkbox checked)

2. **Generate Invoices for the Class**
   - Navigate to Invoices tab
   - Select the test class
   - **Expected Result**: Message shows "2 students are working in bursary..."
   - **Expected Result**: Button shows "Generate for 3 Students"
   
3. **After Generation**
   - **Expected Result**: Only 3 invoices created (for non-bursary students)
   - **Expected Result**: 2 bursary workers have no invoices

## Database Verification

If you have access to the database, you can verify:

```sql
-- Check students with bursary status
SELECT id, name, working_in_bursary, class_id 
FROM students 
WHERE working_in_bursary = true;

-- Verify no invoices for bursary students
SELECT si.id, si.invoice_number, s.name, s.working_in_bursary
FROM student_invoices si
JOIN students s ON s.id = si.student_id
WHERE s.working_in_bursary = true;
-- Expected: Should return 0 rows
```

## Edge Cases to Test

1. **Change Bursary Status**
   - Currently, you need to edit a student directly in the database to change their bursary status after creation
   - Future enhancement: Add edit capability in the UI

2. **All Students in Bursary**
   - If all students in a class are bursary workers:
   - **Expected Result**: Button shows "Generate for 0 Students" and should be disabled

3. **No Students in Bursary**
   - If no students are bursary workers:
   - **Expected Result**: No informational message, normal invoice generation proceeds

## Success Criteria

✅ Students can be marked as working in bursary during creation
✅ Bursary students are visually identified in the student list with a purple badge
✅ Invoice generator shows count of excluded bursary students
✅ Invoice generation excludes bursary students from the selected class
✅ Only non-bursary students receive invoices
✅ No security vulnerabilities introduced
✅ Build completes successfully with no errors

## Notes

- The `working_in_bursary` field defaults to `false` for backward compatibility
- Existing students in the database will have `working_in_bursary = false` unless manually updated
- The feature is transparent: if no students are working in bursary, the system behaves exactly as before
