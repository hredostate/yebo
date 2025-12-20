/**
 * Manual Test Script for Admission Number Generator
 * 
 * This script demonstrates how the admission number generator works
 * with sample data that simulates real-world usage.
 */

import { generateAdmissionNumber, getCampusFromClassName, isValidAdmissionNumber } from '../src/utils/admissionNumber.js';

console.log('='.repeat(60));
console.log('ADMISSION NUMBER GENERATOR - MANUAL TEST');
console.log('='.repeat(60));
console.log();

// Simulate existing admission numbers in the database
const existingNumbers = [
  'UPSS/25/0001',
  'UPSS/25/0002',
  'UPSS/25/0003',
  'CAM/25/0001',
  'CAM/25/0002',
  'CAGS/25/0001',
  'UPSS/24/0099', // Previous year - should be ignored
];

console.log('📚 EXISTING ADMISSION NUMBERS:');
existingNumbers.forEach(num => console.log(`  - ${num}`));
console.log();

// Test 1: Add new student to JSS 1 (UPSS Campus)
console.log('✅ TEST 1: Add new student to JSS 1');
console.log('  Input: Class = "JSS 1"');
const jss1Number = generateAdmissionNumber('JSS 1', existingNumbers);
console.log(`  Generated: ${jss1Number}`);
console.log(`  Valid: ${isValidAdmissionNumber(jss1Number || '')}`);
console.log();

// Test 2: Add new student to Elementary 1 (CAM Campus)
console.log('✅ TEST 2: Add new student to Elementary 1');
console.log('  Input: Class = "Elementary 1"');
const elem1Number = generateAdmissionNumber('Elementary 1', existingNumbers);
console.log(`  Generated: ${elem1Number}`);
console.log(`  Valid: ${isValidAdmissionNumber(elem1Number || '')}`);
console.log();

// Test 3: Add new student to Grade 5 (CAGS Campus)
console.log('✅ TEST 3: Add new student to Grade 5');
console.log('  Input: Class = "Grade 5"');
const grade5Number = generateAdmissionNumber('Grade 5', existingNumbers);
console.log(`  Generated: ${grade5Number}`);
console.log(`  Valid: ${isValidAdmissionNumber(grade5Number || '')}`);
console.log();

// Test 4: Batch import - simulate CSV upload of 3 students
console.log('✅ TEST 4: Batch CSV Upload Simulation');
console.log('  Simulating import of 3 students to JSS 1...');
const batchNumbers: string[] = [];
const allExisting = [...existingNumbers];

for (let i = 1; i <= 3; i++) {
  const number = generateAdmissionNumber('JSS 1', [...allExisting, ...batchNumbers]);
  if (number) {
    batchNumbers.push(number);
    console.log(`  Student ${i}: ${number}`);
  }
}
console.log();

// Test 5: Campus detection
console.log('✅ TEST 5: Campus Detection from Class Names');
const testClasses = [
  'JSS 1',
  'SS2',
  'Elementary 3',
  'Level 2',
  'Dahlia',
  'Grade 4',
  'Kindergarten 1',
  'Preschool A'
];

testClasses.forEach(className => {
  const campus = getCampusFromClassName(className);
  console.log(`  ${className.padEnd(20)} → ${campus}`);
});
console.log();

// Test 6: Case-insensitive matching
console.log('✅ TEST 6: Case-Insensitive Class Name Matching');
const caseTests = [
  'jss 1',
  'JSS 1',
  'elementary 1',
  'ELEMENTARY 1',
  'grade 5',
  'GRADE 5'
];

caseTests.forEach(className => {
  const number = generateAdmissionNumber(className, existingNumbers);
  console.log(`  "${className}" → ${number}`);
});
console.log();

// Test 7: Validation
console.log('✅ TEST 7: Admission Number Validation');
const validationTests = [
  { number: 'UPSS/25/0001', expected: true },
  { number: 'CAM/25/0123', expected: true },
  { number: 'CAGS/25/9999', expected: true },
  { number: 'INVALID/25/0001', expected: false },
  { number: 'UPSS/2025/0001', expected: false },
  { number: 'UPSS/25/001', expected: false },
  { number: 'UPSS-25-0001', expected: false },
];

validationTests.forEach(({ number, expected }) => {
  const isValid = isValidAdmissionNumber(number);
  const status = isValid === expected ? '✓' : '✗';
  console.log(`  ${status} "${number}" → ${isValid} (expected: ${expected})`);
});
console.log();

console.log('='.repeat(60));
console.log('✨ MANUAL TEST COMPLETE');
console.log('='.repeat(60));
