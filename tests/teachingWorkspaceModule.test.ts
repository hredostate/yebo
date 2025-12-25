/**
 * Test: Teaching Workspace Module Integration
 * Purpose: Verify that the Teaching Workspace module is properly integrated into the application
 */

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

console.log('🧪 Running Teaching Workspace Module Integration Tests...\n');

// Test TEACHING_WORKSPACE constant is defined
console.log('Testing TEACHING_WORKSPACE constant...');
assert('TEACHING_WORKSPACE' in VIEWS, 'TEACHING_WORKSPACE should exist in VIEWS object');
assertEquals(VIEWS.TEACHING_WORKSPACE, 'Teaching Workspace', 'TEACHING_WORKSPACE value should be "Teaching Workspace"');
console.log('✅ TEACHING_WORKSPACE constant tests passed\n');

console.log('✅ All Teaching Workspace Module Integration Tests Passed');
