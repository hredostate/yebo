/**
 * Tests for Legacy Hash URL Redirects
 * 
 * Verifies that legacy hash-based URLs are properly redirected to clean BrowserRouter paths
 */

import { hashToPath, viewToPath } from '../src/routing/routeViewMapping.js';
import { VIEWS } from '../src/constants.js';

function assertEquals(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

console.log('🧪 Running Legacy Hash URL Redirect Tests...\n');

// Test: Basic hash to path conversion
console.log('Testing basic hash to path conversion...');
assertEquals(hashToPath('#Dashboard'), '/workspace/dashboard', 'Hash #Dashboard → /workspace/dashboard');
assertEquals(hashToPath('#/Dashboard'), '/workspace/dashboard', 'Hash #/Dashboard → /workspace/dashboard');
assertEquals(hashToPath('#Result Manager'), '/academics/result-manager', 'Hash #Result Manager → /academics/result-manager');
console.log('✅ Basic hash conversion passed\n');

// Test: Legacy parameterized hash URLs
console.log('Testing parameterized hash URLs...');
const studentProfileHash = '#Student Profile/123';
const expectedStudentPath = '/student-affairs/student-profile/123';
assertEquals(hashToPath(studentProfileHash), expectedStudentPath, 'Parameterized student profile hash redirects correctly');
console.log('✅ Parameterized hash URLs passed\n');

// Test: Empty/null hash handling
console.log('Testing empty hash handling...');
assertEquals(hashToPath('#'), '/workspace/dashboard', 'Empty hash (#) defaults to dashboard');
assertEquals(hashToPath(''), '/workspace/dashboard', 'Empty string defaults to dashboard');
console.log('✅ Empty hash handling passed\n');

// Test: Auth token hashes should not redirect (handled by redirect logic)
console.log('Testing auth token detection...');
const authTokenHash = '#access_token=abc123&token_type=bearer';
// hashToPath should still convert it, but the redirect logic in the component ignores it
assertEquals(hashToPath(authTokenHash), '/workspace/dashboard', 'Auth token hash falls back to dashboard');
console.log('✅ Auth token detection passed\n');

// Test: All critical view hashes
console.log('Testing critical view hash redirects...');
const criticalViews = [
  { view: VIEWS.DASHBOARD, path: '/workspace/dashboard' },
  { view: VIEWS.REPORT_FEED, path: '/communication/report-feed' },
  { view: VIEWS.LESSON_PLANNER, path: '/academics/lesson-plans' },
  { view: VIEWS.RESULT_MANAGER, path: '/academics/result-manager' },
  { view: VIEWS.STUDENT_ROSTER, path: '/student-affairs/student-roster' },
  { view: VIEWS.USER_MANAGEMENT, path: '/hr/user-directory' },
  { view: VIEWS.STUDENT_FINANCE, path: '/finance/fees' },
  { view: VIEWS.SETTINGS, path: '/admin/global-settings' },
];

for (const { view, path } of criticalViews) {
  const hash = `#${view}`;
  assertEquals(hashToPath(hash), path, `Critical hash ${hash} → ${path}`);
}
console.log('✅ Critical view hash redirects passed\n');

// Test: Section-based hash URLs
console.log('Testing section-based navigation...');
const sectionTests = [
  { hash: '#Dashboard', expectedSection: 'workspace' },
  { hash: '#Report Feed', expectedSection: 'communication' },
  { hash: '#Lesson Plans', expectedSection: 'academics' },
  { hash: '#Student Roster', expectedSection: 'student-affairs' },
  { hash: '#Transport Manager', expectedSection: 'transport' },
  { hash: '#User Directory', expectedSection: 'hr' },
  { hash: '#Fees', expectedSection: 'finance' },
  { hash: '#Global Settings', expectedSection: 'admin' },
];

for (const { hash, expectedSection } of sectionTests) {
  const path = hashToPath(hash);
  const actualSection = path.split('/')[1];
  assertEquals(actualSection, expectedSection, `Hash ${hash} redirects to ${expectedSection} section`);
}
console.log('✅ Section-based navigation passed\n');

// Test: Legacy student portal hashes
console.log('Testing student portal hash redirects...');
assertEquals(hashToPath('#Student Dashboard'), '/student/dashboard', 'Student Dashboard hash');
assertEquals(hashToPath('#Student Portal'), '/student/portal', 'Student Portal hash');
assertEquals(hashToPath('#My Subjects'), '/student/subjects', 'My Subjects hash');
assertEquals(hashToPath('#Student Reports'), '/student/reports', 'Student Reports hash');
console.log('✅ Student portal hash redirects passed\n');

// Test: Consistency check - hash -> path -> view -> path
console.log('Testing round-trip consistency...');
const testViews = [
  VIEWS.DASHBOARD,
  VIEWS.RESULT_MANAGER,
  VIEWS.STUDENT_ROSTER,
  VIEWS.LESSON_PLANNER,
  VIEWS.USER_MANAGEMENT,
];

for (const view of testViews) {
  const path = viewToPath(view);
  const hash = `#${view}`;
  const convertedPath = hashToPath(hash);
  assertEquals(convertedPath, path, `Round-trip consistency for ${view}: hash → path → view → path`);
}
console.log('✅ Round-trip consistency passed\n');

console.log('✨ All Legacy Hash URL Redirect Tests Passed! ✨\n');
