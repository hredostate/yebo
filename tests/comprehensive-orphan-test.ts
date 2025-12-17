/**
 * Comprehensive test for the orphan-result campus bug scenario
 * 
 * This recreates the exact scenario from the problem statement:
 * 1. buildScopeForClass picks campusId from first student (campus 1)
 * 2. Class has students from multiple campuses  
 * 3. All students have valid enrollments
 * 4. findIntegrityIssues should NOT flag cross-campus students as orphans
 */

import assert from 'assert';
import { findIntegrityIssues } from '../src/utils/resultAnalytics.js';
import type { AcademicClass, AcademicClassStudent, ScoreEntry, Student, StudentTermReport } from '../src/types.js';
import { StudentStatus } from '../src/types.js';

// Students from DIFFERENT campuses
const students: Student[] = [
  // Campus 1 students
  { id: 1, name: 'Student-Campus1-A', campus_id: 1, school_id: 1, grade: '', admission_number: 'S1A', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 },
  { id: 2, name: 'Student-Campus1-B', campus_id: 1, school_id: 1, grade: '', admission_number: 'S1B', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 },
  
  // Campus 2 students  
  { id: 3, name: 'Student-Campus2-A', campus_id: 2, school_id: 1, grade: '', admission_number: 'S2A', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 },
  { id: 4, name: 'Student-Campus2-B', campus_id: 2, school_id: 1, grade: '', admission_number: 'S2B', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 },
  
  // Campus 3 students
  { id: 5, name: 'Student-Campus3-A', campus_id: 3, school_id: 1, grade: '', admission_number: 'S3A', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 },
];

const academicClasses: AcademicClass[] = [
  { id: 101, school_id: 1, name: 'JSS1 Gold', level: 'JSS1', arm: 'Gold', session_label: '2024/2025', is_active: true }
];

// ALL students are enrolled in the SAME class (realistic multi-campus scenario)
const enrollments: AcademicClassStudent[] = [
  { id: 1, academic_class_id: 101, student_id: 1, enrolled_term_id: 1 },
  { id: 2, academic_class_id: 101, student_id: 2, enrolled_term_id: 1 },
  { id: 3, academic_class_id: 101, student_id: 3, enrolled_term_id: 1 },
  { id: 4, academic_class_id: 101, student_id: 4, enrolled_term_id: 1 },
  { id: 5, academic_class_id: 101, student_id: 5, enrolled_term_id: 1 },
];

// ALL students have results
const reports: StudentTermReport[] = [
  { id: 1, student_id: 1, term_id: 1, academic_class_id: 101, average_score: 90, total_score: 270, position_in_class: 1, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  { id: 2, student_id: 2, term_id: 1, academic_class_id: 101, average_score: 85, total_score: 255, position_in_class: 2, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  { id: 3, student_id: 3, term_id: 1, academic_class_id: 101, average_score: 80, total_score: 240, position_in_class: 3, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  { id: 4, student_id: 4, term_id: 1, academic_class_id: 101, average_score: 75, total_score: 225, position_in_class: 4, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  { id: 5, student_id: 5, term_id: 1, academic_class_id: 101, average_score: 70, total_score: 210, position_in_class: 5, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
];

const scoreEntries: ScoreEntry[] = [];

// Simulate what buildScopeForClass does: picks campus ID from first enrolled student
// In this case, student 1 is from campus 1
const scope = { 
  campusId: 1,  // <-- This is picked from first student, but class has students from campuses 1, 2, and 3!
  termId: 1, 
  sessionLabel: '2024/2025', 
  academicClassId: 101, 
  armName: 'Gold' 
} as const;

console.log('\n=== Testing Cross-Campus Orphan-Result Detection ===');
console.log(`Scope campus ID: ${scope.campusId} (from first student)`);
console.log(`Total students: ${students.length} (from ${new Set(students.map(s => s.campus_id)).size} different campuses)`);
console.log(`Total enrollments: ${enrollments.length}`);
console.log(`Total reports: ${reports.length}`);

const issues = findIntegrityIssues(reports, enrollments, students, scoreEntries, scope, academicClasses);

console.log(`\nIntegrity issues found: ${issues.length}`);
issues.forEach((issue, idx) => {
  console.log(`  ${idx + 1}. [${issue.type}] ${issue.message}`);
});

// Filter to only orphan-result issues
const orphanResults = issues.filter(i => i.type === 'orphan-result');

console.log(`\nOrphan result issues: ${orphanResults.length}`);

// CRITICAL TEST: Even though scope.campusId = 1, students from campus 2 and 3  
// should NOT be flagged as orphans because they have valid enrollments
assert.strictEqual(
  orphanResults.length, 
  0, 
  `FAIL: Found ${orphanResults.length} orphan result(s), but expected 0. ` +
  `All students have valid enrollments in class 101 for term 1, regardless of their campus. ` +
  `The campus filter (campusId=${scope.campusId}) should NOT affect orphan-result detection.`
);

console.log('\n✓ SUCCESS: No false positive orphan results for cross-campus students');
console.log('✓ Orphan-result detection correctly ignores campus_id and only checks class/term enrollment\n');
