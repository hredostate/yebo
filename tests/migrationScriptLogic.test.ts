/**
 * Test script to validate the migration script logic
 * This tests the core logic without requiring database access
 */

import assert from 'assert';
import { generateAdmissionNumber } from '../src/utils/admissionNumber.js';

console.log('\n=== Testing Migration Script Logic ===\n');

// Test 1: Verify admission number generation for different classes
console.log('Test 1: Verify admission number generation for different classes');
const upssNumber = generateAdmissionNumber('JSS 1', []);
const camNumber = generateAdmissionNumber('Elementary 1', []);
const cagsNumber = generateAdmissionNumber('Grade 1', []);

assert(upssNumber?.startsWith('UPSS/'), 'UPSS number should start with UPSS/');
assert(camNumber?.startsWith('CAM/'), 'CAM number should start with CAM/');
assert(cagsNumber?.startsWith('CAGS/'), 'CAGS number should start with CAGS/');
console.log('✓ All campus prefixes correct\n');

// Test 2: Verify sequential numbering
console.log('Test 2: Verify sequential numbering');
const currentYear = new Date().getFullYear().toString().slice(-2);
const existing = [`UPSS/${currentYear}/0001`, `UPSS/${currentYear}/0002`];
const nextNumber = generateAdmissionNumber('JSS 1', existing);
assert.equal(nextNumber, `UPSS/${currentYear}/0003`, 'Should generate sequential number');
console.log('✓ Sequential numbering works\n');

// Test 3: Verify unrecognized class handling
console.log('Test 3: Verify unrecognized class handling');
const unknownClass = generateAdmissionNumber('Unknown Class', []);
assert.equal(unknownClass, null, 'Should return null for unknown class');
console.log('✓ Unknown classes handled correctly\n');

// Test 4: Verify batch generation (simulating migration)
console.log('Test 4: Verify batch generation (simulating migration)');
const students = [
  { name: 'John Doe', className: 'JSS 1' },
  { name: 'Jane Smith', className: 'JSS 1' },
  { name: 'Bob Johnson', className: 'Elementary 1' },
  { name: 'Alice Brown', className: 'Grade 1' },
];

const generated: string[] = [];
const allExisting: string[] = [];

for (const student of students) {
  const admissionNumber = generateAdmissionNumber(student.className, [...allExisting, ...generated]);
  if (admissionNumber) {
    generated.push(admissionNumber);
  }
}

// Verify all generated numbers are unique
const uniqueSet = new Set(generated);
assert.equal(uniqueSet.size, generated.length, 'All generated numbers should be unique');
console.log(`✓ Generated ${generated.length} unique admission numbers in batch\n`);

// Test 5: Verify handling of students without classes (should skip)
console.log('Test 5: Verify handling of missing/invalid data');
const noClass = generateAdmissionNumber('', []);
assert.equal(noClass, null, 'Should return null for empty class name');
console.log('✓ Missing/invalid data handled correctly\n');

// Test 6: Verify import path works (this test running proves it)
console.log('Test 6: Verify TypeScript import path');
console.log('✓ Import with .js extension works correctly for .ts files\n');

console.log('=== All Migration Script Logic Tests Passed! ===\n');

process.exit(0);
