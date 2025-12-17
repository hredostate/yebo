import assert from 'assert';
import { aggregateResultStatistics, rankCohort, findIntegrityIssues, calculateCampusPercentile } from '../src/utils/resultAnalytics.js';
import type { AcademicClass, AcademicClassStudent, ScoreEntry, Student, StudentTermReport } from '../src/types.js';
import { StudentStatus } from '../src/types.js';

const students: Student[] = [
  { id: 1, name: 'Ada', campus_id: 1, school_id: 1, grade: '', admission_number: 'A1', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 },
  { id: 2, name: 'Bola', campus_id: 1, school_id: 1, grade: '', admission_number: 'B1', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 },
  { id: 3, name: 'Chidi', campus_id: 1, school_id: 1, grade: '', admission_number: 'C1', class_id: 0, arm_id: 0, status: StudentStatus.Withdrawn, reward_points: 0 },
  { id: 4, name: 'Dami', campus_id: 1, school_id: 1, grade: '', admission_number: 'D1', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 },
  { id: 5, name: 'Eniola', campus_id: 2, school_id: 1, grade: '', admission_number: 'E1', class_id: 0, arm_id: 0, status: StudentStatus.Active, reward_points: 0 }
];

const academicClasses: AcademicClass[] = [
  { id: 101, school_id: 1, name: 'JSS1 Gold', level: 'JSS1', arm: 'Gold', session_label: '2024/2025', is_active: true },
  { id: 102, school_id: 1, name: 'JSS1 Silver', level: 'JSS1', arm: 'Silver', session_label: '2024/2025', is_active: true }
];

const enrollments: AcademicClassStudent[] = [
  { id: 1, academic_class_id: 101, student_id: 1, enrolled_term_id: 1 },
  { id: 2, academic_class_id: 101, student_id: 1, enrolled_term_id: 1 }, // duplicate should not inflate count
  { id: 3, academic_class_id: 101, student_id: 2, enrolled_term_id: 1 },
  { id: 4, academic_class_id: 101, student_id: 3, enrolled_term_id: 1 }
];

const reports: StudentTermReport[] = [
  { id: 1, student_id: 1, term_id: 1, academic_class_id: 101, average_score: 90, total_score: 270, position_in_class: 1, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  { id: 2, student_id: 2, term_id: 1, academic_class_id: 101, average_score: 90, total_score: 270, position_in_class: 1, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  { id: 3, student_id: 3, term_id: 1, academic_class_id: 101, average_score: 50, total_score: 200, position_in_class: 3, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } },
  { id: 4, student_id: 5, term_id: 1, academic_class_id: 102, average_score: 88, total_score: 240, position_in_class: 1, is_published: true, created_at: '', term: { id: 1, school_id: 1, session_label: '2024/2025', term_label: 'First Term', start_date: '', end_date: '', is_active: true } }
];

const scoreEntries: ScoreEntry[] = [
  { id: 1, student_id: 1, term_id: 1, academic_class_id: 101, subject_name: 'Math', total_score: 90, grade_label: 'A', school_id: 1 },
  { id: 2, student_id: 1, term_id: 1, academic_class_id: 101, subject_name: 'Math', total_score: 90, grade_label: 'A', school_id: 1 } // intentional duplicate
];

const scope = { campusId: 1, termId: 1, sessionLabel: '2024/2025', academicClassId: 101, armName: 'Gold' } as const;

const stats = aggregateResultStatistics(reports, enrollments, students, scope, 50, academicClasses);
assert.strictEqual(stats.enrolled, 2, 'Distinct active enrollments should be counted');
assert.strictEqual(stats.withResults, 2, 'Withdrawn student results should be ignored');
assert.strictEqual(Math.round(stats.averageScore), 90, 'Average should be based on scoped reports');
assert.strictEqual(Math.round(stats.passRate), 100, 'All scoped students passed');

const ranks = rankCohort(reports, scope, students, academicClasses);
assert.deepStrictEqual(ranks.map(r => r.rank), [1, 1], 'Dense ranks should not have gaps for ties');
assert.ok(ranks.every(r => r.total === 2), 'Cohort size should exclude inactive students');

const percentile = calculateCampusPercentile(reports[0], reports, scope, students, academicClasses);
assert.strictEqual(percentile, 50, 'Top student out of two active campus peers should be at 50th percentile');

const issues = findIntegrityIssues(reports, enrollments, students, scoreEntries, scope, academicClasses);
assert.ok(issues.some(i => i.type === 'duplicate-result'), 'Duplicate score rows should be flagged');
assert.ok(issues.some(i => i.type === 'missing-assignment'), 'Active students without enrollment should be detected');
assert.ok(issues.some(i => i.type === 'orphan-result'), 'Results without enrollment should be detected');

console.log('resultAnalytics tests passed');
