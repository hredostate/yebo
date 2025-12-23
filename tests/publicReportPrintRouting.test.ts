/**
 * Tests for print route token parsing
 * Ensures /report/:token/:slug?/print route is handled correctly
 */

import assert from 'assert';
import { parsePublicReportTokenFromLocation } from '../src/utils/reportUrlHelpers.js';

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

const testToken = '5080-1-1766419518668-qyshsl';

// Test 1: Print route without slug - /report/<token>/print
const loc1 = createMockLocation(`/report/${testToken}/print`);
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc1),
    testToken,
    'Should parse token from /report/<token>/print'
);

// Test 2: Print route with slug - /report/<token>/<slug>/print
const loc2 = createMockLocation(`/report/${testToken}/adun-tina/print`);
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc2),
    testToken,
    'Should parse token from /report/<token>/<slug>/print'
);

// Test 3: Print route with slug and hash fragment
const loc3 = createMockLocation(`/report/${testToken}/adun-tina/print`, '#Dashboard');
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc3),
    testToken,
    'Should parse token from print route with hash fragment'
);

// Test 4: Print route with query params
const loc4 = createMockLocation(`/report/${testToken}/print`, '', '?foo=bar');
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc4),
    testToken,
    'Should parse token from print route with query params'
);

// Test 5: Print route with :1 suffix on token
const pollutedToken = `${testToken}:1`;
const loc5 = createMockLocation(`/report/${pollutedToken}/print`);
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc5),
    testToken,
    'Should strip :1 suffix from token in print route'
);

// Test 6: Print route with slug containing :1 and hash
const loc6 = createMockLocation(`/report/${testToken}/student-name:1/print`, '#Dashboard');
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc6),
    testToken,
    'Should handle print route with polluted slug and hash'
);

// Test 7: Ensure backward compatibility - regular report route still works
const loc7 = createMockLocation(`/report/${testToken}/adun-tina`);
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc7),
    testToken,
    'Should still parse token from regular route (backward compatible)'
);

// Test 8: UUID token in print route
const uuidToken = '123e4567-e89b-12d3-a456-426614174000';
const loc8 = createMockLocation(`/report/${uuidToken}/student-name/print`);
assert.strictEqual(
    parsePublicReportTokenFromLocation(loc8),
    uuidToken,
    'Should handle UUID tokens in print route'
);

// Test 9: Ensure parsed token has no slashes (defensive check)
const loc9 = createMockLocation(`/report/${testToken}/slug/print`);
const parsed = parsePublicReportTokenFromLocation(loc9);
assert.strictEqual(
    parsed.includes('/'),
    false,
    'Parsed token must not contain forward slashes'
);

// Test 10: Ensure parsed token has no colons (defensive check)
assert.strictEqual(
    parsed.includes(':'),
    false,
    'Parsed token must not contain colons'
);

console.log('✅ All print route token parsing tests passed!');
console.log('   - /report/<token>/print format works');
console.log('   - /report/<token>/<slug>/print format works');
console.log('   - Hash fragments and query params handled correctly');
console.log('   - Backward compatibility maintained');
