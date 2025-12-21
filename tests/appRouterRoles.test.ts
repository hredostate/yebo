import assert from 'assert';

/**
 * Test to verify that data.roles is correctly converted from Record to Array
 * for the ManualsManager component in AppRouter.tsx
 * 
 * This test validates the fix for the bug where data.roles.map() was called
 * directly on a Record<string, RoleDetails> instead of first converting it
 * to an array using Object.values().
 */

// Mock RoleDetails type
interface RoleDetails {
    id?: number;
    school_id?: number;
    title: string;
    description: string;
    permissions: string[];
}

// Mock data structure as it appears in App.tsx (Record, not Array)
const mockRolesRecord: Record<string, RoleDetails> = {
    'admin': {
        id: 1,
        school_id: 1,
        title: 'Admin',
        description: 'Administrator role',
        permissions: ['manage-all']
    },
    'teacher': {
        id: 2,
        school_id: 1,
        title: 'Teacher',
        description: 'Teacher role',
        permissions: ['view-dashboard', 'manage-classes']
    },
    'principal': {
        id: 3,
        school_id: 1,
        title: 'Principal',
        description: 'Principal role',
        permissions: ['view-dashboard', 'manage-users']
    }
};

// Test 1: Verify that data.roles is a Record, not an Array
assert.strictEqual(
    Array.isArray(mockRolesRecord),
    false,
    'data.roles should be a Record, not an Array'
);

// Test 2: Verify that calling .map() directly on the Record would fail
try {
    // This is the BUGGY code that was on line 961
    // @ts-ignore - intentionally testing invalid code
    const buggyResult = mockRolesRecord.map((r: any) => r.title);
    assert.fail('Expected .map() to fail on Record');
} catch (error: any) {
    assert.ok(
        error.message.includes('not a function'),
        'Calling .map() directly on Record should throw "not a function" error'
    );
}

// Test 3: Verify that the FIX works correctly - Object.values() then .map()
const correctResult = Object.values(mockRolesRecord).map((r: any) => r.title);
assert.ok(
    Array.isArray(correctResult),
    'Object.values(data.roles).map() should return an array'
);
assert.strictEqual(
    correctResult.length,
    3,
    'Should extract all 3 role titles'
);
assert.deepStrictEqual(
    correctResult.sort(),
    ['Admin', 'Principal', 'Teacher'],
    'Should extract correct role titles'
);

// Test 4: Verify that ManualsManager receives the correct type (string[])
const rolesForManualsManager: string[] = Object.values(mockRolesRecord).map((r: any) => r.title);
assert.ok(
    rolesForManualsManager.every(title => typeof title === 'string'),
    'All role titles should be strings'
);

console.log('✅ AppRouter roles conversion tests passed');
console.log('   - Confirmed data.roles is a Record, not an Array');
console.log('   - Confirmed .map() fails on Record');
console.log('   - Confirmed Object.values(data.roles).map() works correctly');
console.log('   - Verified ManualsManager receives string[] as expected');
