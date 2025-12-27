/**
 * Test for Student Credentials Bulk Send Route Mapping
 * 
 * Verifies that the STUDENT_CREDENTIALS_BULK_SEND view is properly mapped to its route path
 */

import { VIEWS } from '../src/constants.js';
import {
  viewToPath,
  pathToView,
  VIEW_TO_PATH,
} from '../src/routing/routeViewMapping.js';

function assertEquals(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

console.log('🧪 Testing Student Credentials Bulk Send Route Mapping...\n');

// Test that the constant exists
console.log('Testing VIEWS.STUDENT_CREDENTIALS_BULK_SEND constant exists...');
if (!VIEWS.STUDENT_CREDENTIALS_BULK_SEND) {
  throw new Error('VIEWS.STUDENT_CREDENTIALS_BULK_SEND constant is not defined');
}
assertEquals(VIEWS.STUDENT_CREDENTIALS_BULK_SEND, 'Student Credentials Bulk Send', 'VIEWS constant value');
console.log('✅ Constant exists with correct value\n');

// Test that the view-to-path mapping exists
console.log('Testing VIEW_TO_PATH mapping...');
const expectedPath = '/student-affairs/send-credentials';
if (!VIEW_TO_PATH[VIEWS.STUDENT_CREDENTIALS_BULK_SEND]) {
  throw new Error('VIEW_TO_PATH mapping for STUDENT_CREDENTIALS_BULK_SEND is missing');
}
assertEquals(VIEW_TO_PATH[VIEWS.STUDENT_CREDENTIALS_BULK_SEND], expectedPath, 'VIEW_TO_PATH mapping');
console.log('✅ VIEW_TO_PATH mapping exists\n');

// Test viewToPath function
console.log('Testing viewToPath function...');
const resultPath = viewToPath(VIEWS.STUDENT_CREDENTIALS_BULK_SEND);
assertEquals(resultPath, expectedPath, 'viewToPath returns correct path');
console.log('✅ viewToPath returns correct path\n');

// Test pathToView function (reverse mapping)
console.log('Testing pathToView function...');
const resultView = pathToView(expectedPath);
assertEquals(resultView, VIEWS.STUDENT_CREDENTIALS_BULK_SEND, 'pathToView returns correct view');
console.log('✅ pathToView returns correct view\n');

// Test bidirectional consistency
console.log('Testing bidirectional consistency...');
const roundTripView = pathToView(viewToPath(VIEWS.STUDENT_CREDENTIALS_BULK_SEND));
assertEquals(roundTripView, VIEWS.STUDENT_CREDENTIALS_BULK_SEND, 'Bidirectional mapping is consistent');
console.log('✅ Bidirectional mapping is consistent\n');

console.log('✅ All Student Credentials Bulk Send route mapping tests passed!');
