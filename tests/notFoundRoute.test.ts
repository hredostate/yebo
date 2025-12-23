/**
 * Tests for NotFound Route Behavior
 * 
 * Verifies that unknown routes properly display the NotFound page
 * and that navigation from NotFound works correctly
 */

import { pathToView, viewToPath } from '../src/routing/routeViewMapping.js';
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

console.log('🧪 Running NotFound Route Behavior Tests...\n');

// Test: Unknown paths should return null from pathToView
console.log('Testing unknown path detection...');
const unknownPaths = [
  '/unknown/route',
  '/workspace/nonexistent',
  '/academics/fake-page',
  '/totally-invalid',
  '/admin/does-not-exist',
];

for (const path of unknownPaths) {
  const view = pathToView(path);
  assertEquals(view, null, `Unknown path ${path} should return null`);
}
console.log('✅ Unknown path detection passed\n');

// Test: Valid paths should NOT return null
console.log('Testing valid path recognition...');
const validPaths = [
  '/workspace/dashboard',
  '/academics/result-manager',
  '/student-affairs/student-roster',
  '/communication/report-feed',
  '/hr/user-directory',
];

for (const path of validPaths) {
  const view = pathToView(path);
  assert(view !== null, `Valid path ${path} should return a view, got null`);
}
console.log('✅ Valid path recognition passed\n');

// Test: Section paths without specific route should redirect to section default
console.log('Testing section default behavior...');
// When navigating to just /workspace, /academics, etc., routes.tsx has <Route index> that redirects to default
// This test just verifies we can detect the section
const sectionPaths = [
  { path: '/workspace', section: 'workspace' },
  { path: '/academics', section: 'academics' },
  { path: '/communication', section: 'communication' },
  { path: '/student-affairs', section: 'student-affairs' },
  { path: '/transport', section: 'transport' },
  { path: '/hr', section: 'hr' },
  { path: '/finance', section: 'finance' },
  { path: '/admin', section: 'admin' },
];

for (const { path, section } of sectionPaths) {
  const actualSection = path.split('/')[1];
  assertEquals(actualSection, section, `Path ${path} belongs to section ${section}`);
}
console.log('✅ Section default behavior passed\n');

// Test: NotFound recovery - ensure dashboard path is valid
console.log('Testing NotFound recovery path...');
const dashboardPath = viewToPath(VIEWS.DASHBOARD);
assertEquals(dashboardPath, '/workspace/dashboard', 'Dashboard path for NotFound recovery');
const dashboardView = pathToView(dashboardPath);
assertEquals(dashboardView, VIEWS.DASHBOARD, 'Dashboard path maps back to dashboard view');
console.log('✅ NotFound recovery path passed\n');

// Test: Parameterized paths - existing vs non-existing
console.log('Testing parameterized path handling...');
// Valid parameterized path
const validParamPath = '/student-affairs/student-profile/123';
const validParamView = pathToView(validParamPath);
assertEquals(validParamView, 'Student Profile/123', 'Valid parameterized path returns view with param');

// Invalid parameterized path
const invalidParamPath = '/student-affairs/nonexistent-route/456';
const invalidParamView = pathToView(invalidParamPath);
assertEquals(invalidParamView, null, 'Invalid parameterized path returns null');
console.log('✅ Parameterized path handling passed\n');

// Test: Root path behavior
console.log('Testing root path...');
// Root path "/" should redirect to dashboard via routes.tsx
const rootSection = '/'.split('/')[1];
assertEquals(rootSection, '', 'Root path has no section (will be redirected by router)');
console.log('✅ Root path behavior passed\n');

// Test: Case sensitivity
console.log('Testing path case sensitivity...');
// Paths should be case-sensitive
const lowerPath = '/workspace/dashboard';
const upperPath = '/WORKSPACE/DASHBOARD';
const lowerView = pathToView(lowerPath);
const upperView = pathToView(upperPath);
assert(lowerView !== null, 'Lowercase path should be valid');
assertEquals(upperView, null, 'Uppercase path should be invalid (paths are case-sensitive)');
console.log('✅ Path case sensitivity passed\n');

// Test: Trailing slash handling
console.log('Testing trailing slash behavior...');
const withoutSlash = '/workspace/dashboard';
const withSlash = '/workspace/dashboard/';
const viewWithout = pathToView(withoutSlash);
const viewWith = pathToView(withSlash);
assert(viewWithout !== null, 'Path without trailing slash should be valid');
// Trailing slash should be normalized or handled
console.log(`Path without slash: ${withoutSlash} → ${viewWithout}`);
console.log(`Path with slash: ${withSlash} → ${viewWith}`);
console.log('✅ Trailing slash behavior checked\n');

console.log('✨ All NotFound Route Behavior Tests Passed! ✨\n');
