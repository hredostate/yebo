import assert from 'assert';
import { rankCohort, type ResultScope } from '../src/utils/resultAnalytics.js';
import type { AcademicClass, Student, StudentTermReport } from '../src/types.js';
import { StudentStatus } from '../src/types.js';

// Test data: Two arms in the same level (SS1)
const students: Student[] = [
  { id: 1, name: 'Alice', campus_id: 1, school_id: 1, grade: '', admission_number: 'A1', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 },
  { id: 2, name: 'Bob', campus_id: 1, school_id: 1, grade: '', admission_number: 'B1', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 },
  { id: 3, name: 'Charlie', campus_id: 1, school_id: 1, grade: '', admission_number: 'C1', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 },
  { id: 4, name: 'Diana', campus_id: 1, school_id: 1, grade: '', admission_number: 'D1', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 },
  { id: 5, name: 'Eve', campus_id: 1, school_id: 1, grade: '', admission_number: 'E1', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 },
  { id: 6, name: 'Frank', campus_id: 1, school_id: 1, grade: '', admission_number: 'F1', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 }
];

const academicClasses: AcademicClass[] = [
  { id: 101, school_id: 1, name: 'SS1 Gold', level: 'SS1', arm: 'Gold', session_label: '2024/2025', is_active: true },
  { id: 102, school_id: 1, name: 'SS1 Silver', level: 'SS1', arm: 'Silver', session_label: '2024/2025', is_active: true }
];

// Reports across two arms with different scores
const reports: StudentTermReport[] = [
  // SS1 Gold students
  { id: 1, student_id: 1, term_id: 1, academic_class_id: 101, average_score: 95, total_score: 285, position_in_class: 0, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  { id: 2, student_id: 2, term_id: 1, academic_class_id: 101, average_score: 85, total_score: 255, position_in_class: 0, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  { id: 3, student_id: 3, term_id: 1, academic_class_id: 101, average_score: 75, total_score: 225, position_in_class: 0, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  // SS1 Silver students
  { id: 4, student_id: 4, term_id: 1, academic_class_id: 102, average_score: 90, total_score: 270, position_in_class: 0, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  { id: 5, student_id: 5, term_id: 1, academic_class_id: 102, average_score: 80, total_score: 240, position_in_class: 0, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  { id: 6, student_id: 6, term_id: 1, academic_class_id: 102, average_score: 70, total_score: 210, position_in_class: 0, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } }
];

console.log('Testing level-wide ranking across all arms...');

// Test 1: Ranking all students across both arms (per-level mode)
const levelWideScope: ResultScope = {
  campusId: 1,
  termId: 1,
  sessionLabel: '2024/2025',
  academicClassId: undefined, // No specific class - entire level
  armName: undefined // No specific arm - entire level
};

const levelRankings = rankCohort(reports, levelWideScope, students, academicClasses);

// Expected rankings across entire level:
// 1. Alice (95) - rank 1
// 2. Diana (90) - rank 2
// 3. Bob (85) - rank 3
// 4. Eve (80) - rank 4
// 5. Charlie (75) - rank 5
// 6. Frank (70) - rank 6

assert.strictEqual(levelRankings.length, 6, 'Should rank all 6 students across both arms');
assert.strictEqual(levelRankings.find(r => r.studentId === 1)?.rank, 1, 'Alice should be rank 1');
assert.strictEqual(levelRankings.find(r => r.studentId === 4)?.rank, 2, 'Diana should be rank 2');
assert.strictEqual(levelRankings.find(r => r.studentId === 2)?.rank, 3, 'Bob should be rank 3');
assert.strictEqual(levelRankings.find(r => r.studentId === 5)?.rank, 4, 'Eve should be rank 4');
assert.strictEqual(levelRankings.find(r => r.studentId === 3)?.rank, 5, 'Charlie should be rank 5');
assert.strictEqual(levelRankings.find(r => r.studentId === 6)?.rank, 6, 'Frank should be rank 6');

// Verify total count is same for all students
assert.ok(levelRankings.every(r => r.total === 6), 'All students should see total of 6 students in level');

console.log('✓ Level-wide ranking test passed - students ranked across all arms');

// Test 2: Ranking within a single arm (per-arm mode)
const armScope: ResultScope = {
  campusId: 1,
  termId: 1,
  sessionLabel: '2024/2025',
  academicClassId: 101, // Specific to Gold arm
  armName: 'Gold'
};

const armRankings = rankCohort(reports, armScope, students, academicClasses);

// Expected rankings within Gold arm only:
// 1. Alice (95) - rank 1
// 2. Bob (85) - rank 2
// 3. Charlie (75) - rank 3

assert.strictEqual(armRankings.length, 3, 'Should rank only 3 students in Gold arm');
assert.strictEqual(armRankings.find(r => r.studentId === 1)?.rank, 1, 'Alice should be rank 1 in Gold');
assert.strictEqual(armRankings.find(r => r.studentId === 2)?.rank, 2, 'Bob should be rank 2 in Gold');
assert.strictEqual(armRankings.find(r => r.studentId === 3)?.rank, 3, 'Charlie should be rank 3 in Gold');

// Verify total count is 3 for arm-specific ranking
assert.ok(armRankings.every(r => r.total === 3), 'All students should see total of 3 students in arm');

// Silver arm students should not appear
assert.ok(!armRankings.some(r => r.studentId === 4), 'Diana (Silver) should not appear in Gold rankings');
assert.ok(!armRankings.some(r => r.studentId === 5), 'Eve (Silver) should not appear in Gold rankings');
assert.ok(!armRankings.some(r => r.studentId === 6), 'Frank (Silver) should not appear in Gold rankings');

console.log('✓ Per-arm ranking test passed - students ranked within single arm only');

// Test 3: Dense ranking with ties
const reportsWithTies: StudentTermReport[] = [
  { id: 1, student_id: 1, term_id: 1, academic_class_id: 101, average_score: 90, total_score: 270, position_in_class: 0, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  { id: 2, student_id: 2, term_id: 1, academic_class_id: 101, average_score: 90, total_score: 270, position_in_class: 0, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  { id: 3, student_id: 3, term_id: 1, academic_class_id: 101, average_score: 85, total_score: 255, position_in_class: 0, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } }
];

const tieRankings = rankCohort(reportsWithTies, armScope, students, academicClasses);

assert.strictEqual(tieRankings.find(r => r.studentId === 1)?.rank, 1, 'Alice should be rank 1 (tied)');
assert.strictEqual(tieRankings.find(r => r.studentId === 2)?.rank, 1, 'Bob should be rank 1 (tied)');
assert.strictEqual(tieRankings.find(r => r.studentId === 3)?.rank, 2, 'Charlie should be rank 2 (dense ranking, no gap)');

console.log('✓ Dense ranking test passed - ties handled correctly without gaps');

console.log('\n✅ All level ranking tests passed!');
