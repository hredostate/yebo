import assert from 'assert';
import { findIntegrityIssues } from '../src/utils/resultAnalytics.js';
import type { AcademicClass, AcademicClassStudent, ScoreEntry, Student, StudentTermReport } from '../src/types.js';
import { StudentStatus } from '../src/types.js';

/**
 * This test demonstrates the campus-based false positive for orphan results.
 * 
 * Scenario:
 * - Class 101 (JSS1 Gold) has students from BOTH campus 1 and campus 2
 * - Student 1 (campus 1) is enrolled in Class 101
 * - Student 5 (campus 2) is enrolled in Class 101
 * - Both students have results for Class 101
 * - buildScopeForClass picks campusId=1 (from first student found)
 * 
 * Bug: If findIntegrityIssues filters enrollments or students by campus,
 * it won't find student 5's enrollment, causing a false "orphan result" warning.
 */

const students: Student[] = [
  { id: 1, name: 'Ada', campus_id: 1, school_id: 1, grade: '', admission_number: 'A1', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 },
  { id: 5, name: 'Eniola', campus_id: 2, school_id: 1, grade: '', admission_number: 'E1', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 }
];

const academicClasses: AcademicClass[] = [
  { id: 101, school_id: 1, name: 'JSS1 Gold', level: 'JSS1', arm: 'Gold', session_label: '2024/2025', is_active: true }
];

// Both students are enrolled in the same class
const enrollments: AcademicClassStudent[] = [
  { id: 1, academic_class_id: 101, student_id: 1, enrolled_term_id: 1 },
  { id: 5, academic_class_id: 101, student_id: 5, enrolled_term_id: 1 }
];

// Both students have results for the same class
const reports: StudentTermReport[] = [
  { id: 1, student_id: 1, term_id: 1, academic_class_id: 101, average_score: 90, total_score: 270, position_in_class: 1, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  { id: 5, student_id: 5, term_id: 1, academic_class_id: 101, average_score: 85, total_score: 255, position_in_class: 2, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } }
];

const scoreEntries: ScoreEntry[] = [];

// Scope with campusId=1 (picked from first student, as buildScopeForClass does)
const scope = { campusId: 1, termId: 1, sessionLabel: '2024/2025', academicClassId: 101, armName: 'Gold' } as const;

const issues = findIntegrityIssues(reports, enrollments, students, scoreEntries, scope, academicClasses);

// Filter to only orphan-result issues
const orphanResults = issues.filter(i => i.type === 'orphan-result');

console.log('Orphan result issues found:', orphanResults.length);
orphanResults.forEach(issue => {
  console.log('  -', issue.message);
});

// EXPECTED BEHAVIOR: No orphan results should be detected
// Both students have valid enrollments in class 101, regardless of campus
assert.strictEqual(
  orphanResults.length, 
  0, 
  `Expected no orphan results, but found ${orphanResults.length}. Student 5 (campus 2) has a valid enrollment in class 101 and should NOT be flagged as an orphan.`
);

console.log('✓ Cross-campus orphan-result test passed: No false positives for students from different campuses');
