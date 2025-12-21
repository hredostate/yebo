import assert from 'assert';
import type { AcademicClassStudent, StudentTermReport } from '../src/types.js';

/**
 * Test to validate the class-level principal comment generation logic
 * This simulates the filtering logic from ResultManager.tsx handleGeneratePrincipalCommentsForClass
 */

// Test data for academic class students
const testAcademicClassStudents: AcademicClassStudent[] = [
  { id: 1, academic_class_id: 101, student_id: 1001, enrolled_term_id: 1 },
  { id: 2, academic_class_id: 101, student_id: 1002, enrolled_term_id: 1 },
  { id: 3, academic_class_id: 102, student_id: 1003, enrolled_term_id: 1 },
  { id: 4, academic_class_id: 102, student_id: 1004, enrolled_term_id: 1 },
  { id: 5, academic_class_id: 102, student_id: 1005, enrolled_term_id: 1 },
];

// Test data for student term reports
const testStudentTermReports: StudentTermReport[] = [
  // Class 101 - Term 1
  { id: 1, student_id: 1001, term_id: 1, academic_class_id: 101, average_score: 85, total_score: 85, position_in_class: 1, is_published: false, teacher_comment: 'Good work', principal_comment: null, created_at: '2024-01-01' },
  { id: 2, student_id: 1002, term_id: 1, academic_class_id: 101, average_score: 75, total_score: 75, position_in_class: 2, is_published: false, teacher_comment: 'Keep it up', principal_comment: '', created_at: '2024-01-01' },
  
  // Class 102 - Term 1
  { id: 3, student_id: 1003, term_id: 1, academic_class_id: 102, average_score: 90, total_score: 90, position_in_class: 1, is_published: false, teacher_comment: 'Excellent', principal_comment: 'Already has comment', created_at: '2024-01-01' },
  { id: 4, student_id: 1004, term_id: 1, academic_class_id: 102, average_score: 80, total_score: 80, position_in_class: 2, is_published: false, teacher_comment: 'Good', principal_comment: null, created_at: '2024-01-01' },
  { id: 5, student_id: 1005, term_id: 1, academic_class_id: 102, average_score: 70, total_score: 70, position_in_class: 3, is_published: false, teacher_comment: 'Satisfactory', principal_comment: '   ', created_at: '2024-01-01' },
];

/**
 * Simulates the filtering logic from handleGeneratePrincipalCommentsForClass
 */
function filterReportsForPrincipalComments(
  classId: number,
  termId: number,
  academicClassStudents: AcademicClassStudent[],
  studentTermReports: StudentTermReport[]
): StudentTermReport[] {
  // Get students in this class
  const studentsInClass = academicClassStudents.filter(acs => acs.academic_class_id === classId);
  const studentIds = studentsInClass.map(s => s.student_id);

  // Get reports for these students in this term that don't have principal comments
  return studentTermReports.filter(r => 
    r.term_id === termId && 
    studentIds.includes(r.student_id) &&
    (!r.principal_comment || r.principal_comment.trim() === '')
  );
}

// Test 1: Filter reports for class 101 in term 1
const class101Reports = filterReportsForPrincipalComments(101, 1, testAcademicClassStudents, testStudentTermReports);
assert.strictEqual(class101Reports.length, 2, 'Class 101 should have 2 reports needing principal comments');
assert.ok(class101Reports.some(r => r.student_id === 1001), 'Should include student 1001 (null comment)');
assert.ok(class101Reports.some(r => r.student_id === 1002), 'Should include student 1002 (empty string comment)');

// Test 2: Filter reports for class 102 in term 1
const class102Reports = filterReportsForPrincipalComments(102, 1, testAcademicClassStudents, testStudentTermReports);
assert.strictEqual(class102Reports.length, 2, 'Class 102 should have 2 reports needing principal comments');
assert.ok(class102Reports.some(r => r.student_id === 1004), 'Should include student 1004 (null comment)');
assert.ok(class102Reports.some(r => r.student_id === 1005), 'Should include student 1005 (whitespace-only comment)');
assert.ok(!class102Reports.some(r => r.student_id === 1003), 'Should NOT include student 1003 (has existing comment)');

// Test 3: Filter reports for non-existent class
const nonExistentClassReports = filterReportsForPrincipalComments(999, 1, testAcademicClassStudents, testStudentTermReports);
assert.strictEqual(nonExistentClassReports.length, 0, 'Non-existent class should return 0 reports');

// Test 4: Filter reports for wrong term
const wrongTermReports = filterReportsForPrincipalComments(101, 999, testAcademicClassStudents, testStudentTermReports);
assert.strictEqual(wrongTermReports.length, 0, 'Wrong term should return 0 reports');

// Test 5: Verify whitespace-only comments are treated as empty
const whitespaceReport = testStudentTermReports.find(r => r.student_id === 1005);
assert.ok(whitespaceReport, 'Student 1005 should exist in test data');
assert.ok(class102Reports.some(r => r.id === whitespaceReport!.id), 'Whitespace-only comment should be treated as empty');

// Test 6: Verify null and empty string comments are both filtered
const class101Ids = class101Reports.map(r => r.student_id);
assert.ok(class101Ids.includes(1001), 'Should include student with null comment');
assert.ok(class101Ids.includes(1002), 'Should include student with empty string comment');

// Test 7: Verify students with existing comments are excluded
const class102Ids = class102Reports.map(r => r.student_id);
assert.ok(!class102Ids.includes(1003), 'Should NOT include student with existing principal comment');

console.log('ResultManager class-level principal comments tests passed');
