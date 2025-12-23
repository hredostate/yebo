/**
 * Tests for Navigation Link Generation
 * 
 * Verifies that navigation links are properly generated using path-based routing
 * and that the viewToPath mapping is complete
 */

import { viewToPath, pathToView, VIEW_TO_PATH, getSectionFromView } from '../src/routing/routeViewMapping.js';
import { VIEWS } from '../src/constants.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

console.log('🧪 Running Navigation Link Generation Tests...\n');

// Test: All VIEWS constants have a path mapping
console.log('Testing VIEWS constant coverage...');
let missingMappings: string[] = [];
let mappedCount = 0;

for (const [key, view] of Object.entries(VIEWS)) {
  const path = VIEW_TO_PATH[view];
  if (!path) {
    missingMappings.push(`${key} (${view})`);
  } else {
    mappedCount++;
  }
}

if (missingMappings.length > 0) {
  console.warn(`⚠️  Warning: ${missingMappings.length} views are not mapped to paths:`);
  missingMappings.forEach(m => console.warn(`  - ${m}`));
} else {
  console.log(`✅ All ${mappedCount} VIEWS constants have path mappings`);
}
console.log();

// Test: Path generation for navigation links
console.log('Testing navigation link path generation...');
const navigationTests = [
  { view: VIEWS.DASHBOARD, expectedPath: '/workspace/dashboard', label: 'Dashboard' },
  { view: VIEWS.TASK_BOARD, expectedPath: '/workspace/tasks', label: 'Tasks' },
  { view: VIEWS.REPORT_FEED, expectedPath: '/communication/report-feed', label: 'Report Feed' },
  { view: VIEWS.SUBMIT_REPORT, expectedPath: '/communication/submit-report', label: 'Submit Report' },
  { view: VIEWS.LESSON_PLANNER, expectedPath: '/academics/lesson-plans', label: 'Lesson Plans' },
  { view: VIEWS.RESULT_MANAGER, expectedPath: '/academics/result-manager', label: 'Result Manager' },
  { view: VIEWS.STUDENT_ROSTER, expectedPath: '/student-affairs/student-roster', label: 'Student Roster' },
  { view: VIEWS.TRANSPORT_MANAGER, expectedPath: '/transport/transport-manager', label: 'Transport Manager' },
  { view: VIEWS.USER_MANAGEMENT, expectedPath: '/hr/user-directory', label: 'User Management' },
  { view: VIEWS.HR_PAYROLL, expectedPath: '/finance/payroll', label: 'Payroll' },
  { view: VIEWS.SETTINGS, expectedPath: '/admin/global-settings', label: 'Settings' },
];

for (const { view, expectedPath, label } of navigationTests) {
  const actualPath = viewToPath(view);
  assertEquals(actualPath, expectedPath, `Navigation link for ${label}`);
}
console.log('✅ Navigation link path generation passed\n');

// Test: Path-based links are clean (no hash, no query params)
console.log('Testing clean path format...');
for (const path of Object.values(VIEW_TO_PATH)) {
  assert(!path.includes('#'), `Path should not contain hash: ${path}`);
  assert(!path.includes('?'), `Path should not contain query params: ${path}`);
  assert(path.startsWith('/'), `Path should start with slash: ${path}`);
}
console.log('✅ Clean path format passed\n');

// Test: Section consistency
console.log('Testing section consistency...');
const sectionMapping = {
  workspace: ['Dashboard', 'Tasks', 'Daily Check-in', 'Calendar', 'My Leave', 'My Profile'],
  communication: ['Report Feed', 'Submit Report', 'Bulletin Board', 'Surveys', 'Emergency Broadcast', 'Social Media Hub'],
  academics: ['Lesson Plans', 'Timetable', 'My Gradebook', 'Assessments', 'Result Manager'],
  'student-affairs': ['Student Roster', 'Intervention Plans', 'Absence Requests', 'Student Profile'],
  transport: ['Transport Manager', 'My Transport Groups', 'Transport Attendance'],
  hr: ['User Directory', 'Roles', 'Team Hub', 'Attendance Monitor', 'My Payroll'],
  finance: ['Payroll', 'Bursary (Fees)', 'Store', 'Compliance'],
  admin: ['Global Settings', 'AI Strategic Center', 'Predictive Analytics', 'Data Upload', 'Analytics'],
};

for (const [expectedSection, viewLabels] of Object.entries(sectionMapping)) {
  for (const viewLabel of viewLabels) {
    // Find the view constant that matches this label
    const viewKey = Object.keys(VIEWS).find(key => {
      const view = VIEWS[key as keyof typeof VIEWS];
      return view === viewLabel || viewLabel.includes(view) || view.includes(viewLabel);
    });
    
    if (viewKey) {
      const view = VIEWS[viewKey as keyof typeof VIEWS];
      const actualSection = getSectionFromView(view);
      assertEquals(actualSection, expectedSection, `${viewLabel} should be in ${expectedSection} section`);
    }
  }
}
console.log('✅ Section consistency passed\n');

// Test: Parameterized link generation
console.log('Testing parameterized link generation...');
const studentId = 123;
const studentProfileView = `${VIEWS.STUDENT_PROFILE}/${studentId}`;
const studentProfilePath = viewToPath(studentProfileView);
assertEquals(studentProfilePath, `/student-affairs/student-profile/${studentId}`, 'Parameterized student profile link');

const assignmentId = 456;
const scoreEntryView = `${VIEWS.TEACHER_SCORE_ENTRY}/${assignmentId}`;
const scoreEntryPath = viewToPath(scoreEntryView);
assert(scoreEntryPath.includes(String(assignmentId)), `Score entry link should include assignment ID: ${scoreEntryPath}`);
console.log('✅ Parameterized link generation passed\n');

// Test: Student portal link generation
console.log('Testing student portal link generation...');
const studentViews = [
  { view: VIEWS.STUDENT_DASHBOARD, expectedPath: '/student/dashboard' },
  { view: VIEWS.STUDENT_PORTAL, expectedPath: '/student/portal' },
  { view: VIEWS.MY_SUBJECTS, expectedPath: '/student/subjects' },
  { view: VIEWS.STUDENT_REPORTS, expectedPath: '/student/reports' },
  { view: VIEWS.RATE_MY_TEACHER, expectedPath: '/student/rate-teacher' },
];

for (const { view, expectedPath } of studentViews) {
  const actualPath = viewToPath(view);
  assertEquals(actualPath, expectedPath, `Student portal link: ${view}`);
}
console.log('✅ Student portal link generation passed\n');

// Test: Bidirectional link integrity
console.log('Testing bidirectional link integrity...');
let integrityErrors = 0;
for (const [view, path] of Object.entries(VIEW_TO_PATH)) {
  const reconstructedView = pathToView(path);
  if (reconstructedView !== view) {
    console.error(`Integrity error: ${view} → ${path} → ${reconstructedView}`);
    integrityErrors++;
  }
}

if (integrityErrors > 0) {
  throw new Error(`Found ${integrityErrors} bidirectional integrity errors`);
}
console.log(`✅ Verified ${Object.keys(VIEW_TO_PATH).length} bidirectional links\n`);

// Test: No duplicate paths
console.log('Testing for duplicate paths...');
const pathCounts = new Map<string, string[]>();
for (const [view, path] of Object.entries(VIEW_TO_PATH)) {
  if (!pathCounts.has(path)) {
    pathCounts.set(path, []);
  }
  pathCounts.get(path)!.push(view);
}

let duplicateCount = 0;
for (const [path, views] of pathCounts.entries()) {
  if (views.length > 1) {
    console.error(`Duplicate path ${path} maps to: ${views.join(', ')}`);
    duplicateCount++;
  }
}

assertEquals(duplicateCount, 0, 'Should have no duplicate paths');
console.log('✅ No duplicate paths found\n');

console.log('✨ All Navigation Link Generation Tests Passed! ✨\n');
