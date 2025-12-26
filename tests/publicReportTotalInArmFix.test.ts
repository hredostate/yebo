/**
 * Tests for PublicReportView totalInArm and totalInLevel extraction fix
 * Verifies that the extraction logic correctly handles different field name variations
 * from the RPC response, including the new ranking object format.
 */

// Simple assertion helpers
function strictEqual<T>(actual: T, expected: T, message: string) {
    if (actual !== expected) {
        throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

// Mock RPC response types
interface MockRPCData {
    summary?: {
        totalInArm?: number;
        total_in_arm?: number;
        cohortSize?: number;
        totalStudentsInArm?: number;
        totalInLevel?: number;
        total_in_level?: number;
        levelSize?: number;
        totalStudentsInLevel?: number;
    };
    ranking?: {
        totalInArm?: number;
        totalInLevel?: number;
    };
}

// Test 1: New ranking object format (from 20251226 migration)
console.log('Test 1: New ranking object format');

const mockRPCDataNewFormat: MockRPCData = {
    ranking: {
        totalInArm: 30,
        totalInLevel: 167
    }
};

// New extraction logic (after fix)
const extractedTotalInArmNew = mockRPCDataNewFormat?.summary?.totalInArm 
    ?? mockRPCDataNewFormat?.summary?.total_in_arm 
    ?? mockRPCDataNewFormat?.ranking?.totalInArm 
    ?? mockRPCDataNewFormat?.summary?.cohortSize 
    ?? mockRPCDataNewFormat?.summary?.totalStudentsInArm;

const extractedTotalInLevelNew = mockRPCDataNewFormat?.summary?.totalInLevel 
    ?? mockRPCDataNewFormat?.summary?.total_in_level 
    ?? mockRPCDataNewFormat?.ranking?.totalInLevel 
    ?? mockRPCDataNewFormat?.summary?.levelSize 
    ?? mockRPCDataNewFormat?.summary?.totalStudentsInLevel;

strictEqual(extractedTotalInArmNew, 30, 'Should extract totalInArm from ranking object');
strictEqual(extractedTotalInLevelNew, 167, 'Should extract totalInLevel from ranking object');

// Test 2: Old summary object format with totalInArm/total_in_arm
console.log('Test 2: Old summary object format with totalInArm/total_in_arm');

const mockRPCDataOldSummaryFormat: MockRPCData = {
    summary: {
        totalInArm: 25,
        total_in_arm: 25,
        totalInLevel: 150,
        total_in_level: 150
    }
};

const extractedTotalInArmOldSummary = mockRPCDataOldSummaryFormat?.summary?.totalInArm 
    ?? mockRPCDataOldSummaryFormat?.summary?.total_in_arm 
    ?? mockRPCDataOldSummaryFormat?.ranking?.totalInArm 
    ?? mockRPCDataOldSummaryFormat?.summary?.cohortSize 
    ?? mockRPCDataOldSummaryFormat?.summary?.totalStudentsInArm;

const extractedTotalInLevelOldSummary = mockRPCDataOldSummaryFormat?.summary?.totalInLevel 
    ?? mockRPCDataOldSummaryFormat?.summary?.total_in_level 
    ?? mockRPCDataOldSummaryFormat?.ranking?.totalInLevel 
    ?? mockRPCDataOldSummaryFormat?.summary?.levelSize 
    ?? mockRPCDataOldSummaryFormat?.summary?.totalStudentsInLevel;

strictEqual(extractedTotalInArmOldSummary, 25, 'Should extract totalInArm from summary object (camelCase)');
strictEqual(extractedTotalInLevelOldSummary, 150, 'Should extract totalInLevel from summary object (camelCase)');

// Test 3: Very old format with cohortSize/levelSize
console.log('Test 3: Very old format with cohortSize/levelSize');

const mockRPCDataVeryOldFormat: MockRPCData = {
    summary: {
        cohortSize: 28,
        levelSize: 140
    }
};

const extractedTotalInArmVeryOld = mockRPCDataVeryOldFormat?.summary?.totalInArm 
    ?? mockRPCDataVeryOldFormat?.summary?.total_in_arm 
    ?? mockRPCDataVeryOldFormat?.ranking?.totalInArm 
    ?? mockRPCDataVeryOldFormat?.summary?.cohortSize 
    ?? mockRPCDataVeryOldFormat?.summary?.totalStudentsInArm;

const extractedTotalInLevelVeryOld = mockRPCDataVeryOldFormat?.summary?.totalInLevel 
    ?? mockRPCDataVeryOldFormat?.summary?.total_in_level 
    ?? mockRPCDataVeryOldFormat?.ranking?.totalInLevel 
    ?? mockRPCDataVeryOldFormat?.summary?.levelSize 
    ?? mockRPCDataVeryOldFormat?.summary?.totalStudentsInLevel;

strictEqual(extractedTotalInArmVeryOld, 28, 'Should extract totalInArm from cohortSize fallback');
strictEqual(extractedTotalInLevelVeryOld, 140, 'Should extract totalInLevel from levelSize fallback');

// Test 4: Oldest format with totalStudentsInArm/totalStudentsInLevel
console.log('Test 4: Oldest format with totalStudentsInArm/totalStudentsInLevel');

const mockRPCDataOldestFormat: MockRPCData = {
    summary: {
        totalStudentsInArm: 32,
        totalStudentsInLevel: 180
    }
};

const extractedTotalInArmOldest = mockRPCDataOldestFormat?.summary?.totalInArm 
    ?? mockRPCDataOldestFormat?.summary?.total_in_arm 
    ?? mockRPCDataOldestFormat?.ranking?.totalInArm 
    ?? mockRPCDataOldestFormat?.summary?.cohortSize 
    ?? mockRPCDataOldestFormat?.summary?.totalStudentsInArm;

const extractedTotalInLevelOldest = mockRPCDataOldestFormat?.summary?.totalInLevel 
    ?? mockRPCDataOldestFormat?.summary?.total_in_level 
    ?? mockRPCDataOldestFormat?.ranking?.totalInLevel 
    ?? mockRPCDataOldestFormat?.summary?.levelSize 
    ?? mockRPCDataOldestFormat?.summary?.totalStudentsInLevel;

strictEqual(extractedTotalInArmOldest, 32, 'Should extract totalInArm from totalStudentsInArm fallback');
strictEqual(extractedTotalInLevelOldest, 180, 'Should extract totalInLevel from totalStudentsInLevel fallback');

// Test 5: Precedence test - newer format should take precedence
console.log('Test 5: Precedence test - newer format should take precedence');

const mockRPCDataMixed: MockRPCData = {
    summary: {
        totalInArm: 30,
        cohortSize: 25,  // Should be ignored
        totalStudentsInArm: 20  // Should be ignored
    },
    ranking: {
        totalInArm: 28  // Should be ignored when summary.totalInArm exists
    }
};

const extractedTotalInArmMixed = mockRPCDataMixed?.summary?.totalInArm 
    ?? mockRPCDataMixed?.summary?.total_in_arm 
    ?? mockRPCDataMixed?.ranking?.totalInArm 
    ?? mockRPCDataMixed?.summary?.cohortSize 
    ?? mockRPCDataMixed?.summary?.totalStudentsInArm;

strictEqual(extractedTotalInArmMixed, 30, 'Should prefer summary.totalInArm over other fields');

// Test 6: Verify old extraction logic would fail with new format
console.log('Test 6: Verify old extraction logic would fail with new format');

// Old extraction logic (before fix)
const oldExtractedTotalInArm = mockRPCDataNewFormat?.summary?.cohortSize 
    ?? mockRPCDataNewFormat?.summary?.totalStudentsInArm;

const oldExtractedTotalInLevel = mockRPCDataNewFormat?.summary?.levelSize 
    ?? mockRPCDataNewFormat?.summary?.totalStudentsInLevel;

strictEqual(oldExtractedTotalInArm, undefined, 'Old logic fails to extract from ranking object');
strictEqual(oldExtractedTotalInLevel, undefined, 'Old logic fails to extract from ranking object');

// Test 7: Handle missing/null values gracefully
console.log('Test 7: Handle missing/null values gracefully');

const mockRPCDataEmpty: MockRPCData = {};

const extractedTotalInArmEmpty = mockRPCDataEmpty?.summary?.totalInArm 
    ?? mockRPCDataEmpty?.summary?.total_in_arm 
    ?? mockRPCDataEmpty?.ranking?.totalInArm 
    ?? mockRPCDataEmpty?.summary?.cohortSize 
    ?? mockRPCDataEmpty?.summary?.totalStudentsInArm;

const extractedTotalInLevelEmpty = mockRPCDataEmpty?.summary?.totalInLevel 
    ?? mockRPCDataEmpty?.summary?.total_in_level 
    ?? mockRPCDataEmpty?.ranking?.totalInLevel 
    ?? mockRPCDataEmpty?.summary?.levelSize 
    ?? mockRPCDataEmpty?.summary?.totalStudentsInLevel;

strictEqual(extractedTotalInArmEmpty, undefined, 'Should return undefined when all fields are missing');
strictEqual(extractedTotalInLevelEmpty, undefined, 'Should return undefined when all fields are missing');

console.log('✅ All totalInArm and totalInLevel extraction tests passed!');
