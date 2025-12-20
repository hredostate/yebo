import assert from 'assert';

/**
 * Test for Unpublished Preview Badge Visibility
 * 
 * This test validates that the "Unpublished Preview" badge is only shown
 * to staff users and never to students, even when viewing an unpublished report.
 */

interface ReportViewContext {
  isPublished: boolean;
  isStudentUser: boolean;
}

/**
 * Determines if the unpublished preview badge should be visible
 */
function shouldShowUnpublishedBadge(context: ReportViewContext): boolean {
  // Badge should only show if report is not published AND user is not a student
  return !context.isPublished && !context.isStudentUser;
}

// Test 1: Published report - no badge for anyone
const context1: ReportViewContext = { isPublished: true, isStudentUser: false };
assert.strictEqual(
  shouldShowUnpublishedBadge(context1), 
  false, 
  'Published report should not show badge for staff'
);

// Test 2: Published report - no badge for students
const context2: ReportViewContext = { isPublished: true, isStudentUser: true };
assert.strictEqual(
  shouldShowUnpublishedBadge(context2), 
  false, 
  'Published report should not show badge for students'
);

// Test 3: Unpublished report - staff SHOULD see badge
const context3: ReportViewContext = { isPublished: false, isStudentUser: false };
assert.strictEqual(
  shouldShowUnpublishedBadge(context3), 
  true, 
  'Unpublished report should show badge for staff'
);

// Test 4: Unpublished report - students SHOULD NOT see badge
const context4: ReportViewContext = { isPublished: false, isStudentUser: true };
assert.strictEqual(
  shouldShowUnpublishedBadge(context4), 
  false, 
  'Unpublished report should NEVER show badge for students'
);

console.log('✅ All unpublished preview badge visibility tests passed!');
