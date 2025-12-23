/**
 * Navigation Route Mapping Tests
 * 
 * Tests to verify route-view bidirectional mapping
 */

import { VIEWS } from '../src/constants.js';
import {
  viewToPath,
  pathToView,
  VIEW_TO_PATH,
  getSectionFromPath,
  getSectionFromView,
  isPathInSection,
  hashToPath,
  pathToHash,
} from '../src/routing/routeViewMapping.js';

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

console.log('🧪 Running Navigation Route Mapping Tests...\n');

// Test viewToPath
console.log('Testing viewToPath...');
assertEquals(viewToPath(VIEWS.DASHBOARD), '/workspace/dashboard', 'Dashboard view to path');
assertEquals(viewToPath(VIEWS.RESULT_MANAGER), '/academics/result-manager', 'Result Manager view to path');
assertEquals(viewToPath('Student Profile/123'), '/student-affairs/student-profile/123', 'Parameterized view to path');
assertEquals(viewToPath('Unknown View'), '/workspace/dashboard', 'Unknown view fallback to dashboard');
console.log('✅ viewToPath tests passed\n');

// Test pathToView
console.log('Testing pathToView...');
assertEquals(pathToView('/workspace/dashboard'), VIEWS.DASHBOARD, 'Path to Dashboard view');
assertEquals(pathToView('/academics/result-manager'), VIEWS.RESULT_MANAGER, 'Path to Result Manager view');
assertEquals(pathToView('/student-affairs/student-profile/123'), 'Student Profile/123', 'Parameterized path to view');
assertEquals(pathToView('/unknown/path'), null, 'Unknown path returns null');
assertEquals(pathToView('/workspace/dashboard'), pathToView('workspace/dashboard'), 'Path with/without leading slash');
console.log('✅ pathToView tests passed\n');

// Test bidirectional consistency
console.log('Testing bidirectional mapping consistency...');
let mappingCount = 0;
for (const [view, path] of Object.entries(VIEW_TO_PATH)) {
  const reconstructedView = pathToView(path);
  assertEquals(reconstructedView, view, `Bidirectional mapping for ${view}`);
  mappingCount++;
}
console.log(`✅ Verified ${mappingCount} bidirectional mappings\n`);

// Test section extraction
console.log('Testing section extraction...');
assertEquals(getSectionFromPath('/workspace/dashboard'), 'workspace', 'Extract workspace section');
assertEquals(getSectionFromPath('/academics/result-manager'), 'academics', 'Extract academics section');
assertEquals(getSectionFromView(VIEWS.RESULT_MANAGER), 'academics', 'Extract section from view');
assert(isPathInSection('/workspace/dashboard', 'workspace'), 'Path is in workspace section');
assert(!isPathInSection('/workspace/dashboard', 'academics'), 'Path is not in academics section');
console.log('✅ Section extraction tests passed\n');

// Test hash support
console.log('Testing legacy hash support...');
assertEquals(hashToPath('#Dashboard'), '/workspace/dashboard', 'Hash to path');
assertEquals(hashToPath('#/Dashboard'), '/workspace/dashboard', 'Hash with slash to path');
assertEquals(pathToHash('/workspace/dashboard'), '#Dashboard', 'Path to hash');
assertEquals(hashToPath('#'), '/workspace/dashboard', 'Empty hash fallback');
assertEquals(hashToPath('#access_token=abc123'), '/workspace/dashboard', 'Ignore auth tokens');
console.log('✅ Hash support tests passed\n');

// Test critical mappings
console.log('Testing critical view mappings...');
const criticalMappings = [
  { view: VIEWS.DASHBOARD, path: '/workspace/dashboard' },
  { view: VIEWS.REPORT_FEED, path: '/communication/report-feed' },
  { view: VIEWS.LESSON_PLANNER, path: '/academics/lesson-plans' },
  { view: VIEWS.RESULT_MANAGER, path: '/academics/result-manager' },
  { view: VIEWS.STUDENT_ROSTER, path: '/student-affairs/student-roster' },
  { view: VIEWS.USER_MANAGEMENT, path: '/hr/user-directory' },
  { view: VIEWS.STUDENT_FINANCE, path: '/finance/fees' },
  { view: VIEWS.SETTINGS, path: '/admin/global-settings' },
];

for (const { view, path } of criticalMappings) {
  assertEquals(viewToPath(view), path, `Critical mapping: ${view} → ${path}`);
  assertEquals(pathToView(path), view, `Critical mapping: ${path} → ${view}`);
}
console.log('✅ Critical mappings tests passed\n');

// Test transport section
console.log('Testing transport section special case...');
assertEquals(viewToPath(VIEWS.TRANSPORT_MANAGER), '/transport/transport-manager', 'Transport Manager path');
assertEquals(viewToPath(VIEWS.TEACHER_TRANSPORT_GROUPS), '/transport/groups', 'Transport Groups path');
assertEquals(viewToPath(VIEWS.TEACHER_TRANSPORT_ATTENDANCE), '/transport/attendance', 'Transport Attendance path');
assertEquals(getSectionFromPath('/transport/transport-manager'), 'transport', 'Transport section from path');
assertEquals(getSectionFromView(VIEWS.TRANSPORT_MANAGER), 'transport', 'Transport section from view');
console.log('✅ Transport section tests passed\n');

// Test section defaults
console.log('Testing section default routes...');
const expectedDefaults = {
  workspace: '/workspace/dashboard',
  communication: '/communication/report-feed',
  academics: '/academics/lesson-plans',
  'student-affairs': '/student-affairs/student-roster',
  transport: '/transport/transport-manager',
  hr: '/hr/user-directory',
  finance: '/finance/fees',
  admin: '/admin/global-settings',
};

for (const [section, expectedPath] of Object.entries(expectedDefaults)) {
  assert(isPathInSection(expectedPath, section), `Default path for ${section} is in correct section`);
}
console.log('✅ Section defaults tests passed\n');

console.log('✨ All Navigation Route Mapping Tests Passed! ✨');

