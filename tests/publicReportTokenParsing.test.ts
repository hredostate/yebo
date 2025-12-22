/**
 * Tests for parsePublicReportTokenFromLocation
 * Ensures robust token parsing handles all edge cases from production
 */

import assert from 'assert';
import { parsePublicReportTokenFromLocation } from '../src/utils/reportUrlHelpers';

// Helper to create mock Location object
function createMockLocation(pathname: string, hash?: string, search?: string): Location {
    return {
        pathname,
        hash: hash || '',
        search: search || '',
        href: '',
        origin: '',
        protocol: '',
        host: '',
        hostname: '',
        port: '',
        ancestorOrigins: {} as DOMStringList,
        assign: () => {},
        reload: () => {},
        replace: () => {}
    } as Location;
}

// Test 1: Basic token format (backward compatible)
const basicToken = '5080-1-1766419518668-qyshsl';
const loc1 = createMockLocation(`/report/${basicToken}`);
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc1),
    basicToken,
    'Should parse basic token format'
);

// Test 2: Token with student slug (canonical format)
const loc2 = createMockLocation(`/report/${basicToken}/adun-tina`);
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc2),
    basicToken,
    'Should extract token from canonical format with slug'
);

// Test 3: Token polluted with :1 suffix
const pollutedToken = `${basicToken}:1`;
const loc3 = createMockLocation(`/report/${pollutedToken}`);
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc3),
    basicToken,
    'Should strip :1 suffix from token'
);

// Test 4: Token with slug and :1 suffix (real-world failure case)
const loc4 = createMockLocation(`/report/${basicToken}/adun-tina:1`);
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc4),
    basicToken,
    'Should handle token with slug containing :1 suffix'
);

// Test 5: Token with hash fragment
const loc5 = createMockLocation(`/report/${basicToken}#Dashboard`);
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc5),
    basicToken,
    'Should strip hash fragment from token'
);

// Test 6: Token with slug and hash fragment (real-world case)
const loc6 = createMockLocation(`/report/${basicToken}/adun-tina`, '#Dashboard');
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc6),
    basicToken,
    'Should handle canonical format with hash fragment'
);

// Test 7: Token with query parameters
const loc7 = createMockLocation(`/report/${basicToken}?foo=bar`);
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc7),
    basicToken,
    'Should strip query parameters from token'
);

// Test 8: Complex polluted case - everything combined
const loc8 = createMockLocation(`/report/${basicToken}/student-name:1`, '#Dashboard', '?test=1');
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc8),
    basicToken,
    'Should handle multiple pollution sources'
);

// Test 9: Token with trailing slash
const loc9 = createMockLocation(`/report/${basicToken}/`);
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc9),
    basicToken,
    'Should handle trailing slash'
);

// Test 10: UUID format token (from crypto.randomUUID)
const uuidToken = '123e4567-e89b-12d3-a456-426614174000';
const loc10 = createMockLocation(`/report/${uuidToken}/student-slug`);
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc10),
    uuidToken,
    'Should handle UUID format tokens'
);

// Test 11: Empty/invalid paths
const loc11 = createMockLocation('/report/');
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc11),
    '',
    'Should return empty string for missing token'
);

const loc12 = createMockLocation('/other-path/123');
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc12),
    '',
    'Should return empty string for non-report paths'
);

// Test 12: Token followed by multiple slashes (defensive case)
const loc13 = createMockLocation(`/report/${basicToken}///extra/path`);
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc13),
    basicToken,
    'Should handle multiple trailing slashes'
);

// Test 13: Case from problem statement - exact failing URL
const failingToken = '5080-1-1766419518668-qyshsl';
const loc14 = createMockLocation(`/report/${failingToken}/adun-tina`, '#Dashboard');
const parsed = parsePublicReportTokenFromLocation(loc14);
assert.strictEqual(
    parsed,
    failingToken,
    'Should correctly parse the exact failing URL from problem statement'
);
// Ensure no slash in parsed token
assert.strictEqual(
    parsed.includes('/'),
    false,
    'Parsed token must not contain forward slashes'
);
// Ensure no :1 suffix
assert.strictEqual(
    parsed.includes(':'),
    false,
    'Parsed token must not contain colon artifacts'
);

console.log('✅ All public report token parsing tests passed!');
