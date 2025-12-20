import assert from 'assert';
import type { AcademicTeachingAssignment } from '../src/types.js';

/**
 * Test to validate that the ResultManager filter logic handles null values correctly.
 * This simulates the filter logic from ResultManager.tsx lines 102-105
 */

// Test data with various null/undefined scenarios
const testAssignments: AcademicTeachingAssignment[] = [
  {
    id: 1,
    school_id: 1,
    term_id: 1,
    academic_class_id: 101,
    subject_name: 'Mathematics',
    teacher_user_id: 'teacher1',
    is_locked: false,
    academic_class: { id: 101, school_id: 1, name: 'JSS1 Gold', level: 'JSS1', arm: 'Gold', session_label: '2024/2025', is_active: true },
    teacher: { id: 'teacher1', name: 'John Doe', email: 'john@example.com', school_id: 1, role: 'Teacher' as const, created_at: '2024-01-01' }
  },
  {
    id: 2,
    school_id: 1,
    term_id: 1,
    academic_class_id: 102,
    subject_name: 'English',
    teacher_user_id: 'teacher2',
    is_locked: false,
    academic_class: { id: 102, school_id: 1, name: null, level: 'JSS1', arm: 'Silver', session_label: '2024/2025', is_active: true } as any, // name is null
    teacher: { id: 'teacher2', name: 'Jane Smith', email: 'jane@example.com', school_id: 1, role: 'Teacher' as const, created_at: '2024-01-01' }
  },
  {
    id: 3,
    school_id: 1,
    term_id: 1,
    academic_class_id: 103,
    subject_name: null as any, // subject_name is null
    teacher_user_id: 'teacher3',
    is_locked: false,
    academic_class: { id: 103, school_id: 1, name: 'JSS2 Blue', level: 'JSS2', arm: 'Blue', session_label: '2024/2025', is_active: true },
    teacher: { id: 'teacher3', name: null, email: 'teacher3@example.com', school_id: 1, role: 'Teacher' as const, created_at: '2024-01-01' } as any // teacher name is null
  },
  {
    id: 4,
    school_id: 1,
    term_id: 1,
    academic_class_id: 104,
    subject_name: 'Science',
    teacher_user_id: 'teacher4',
    is_locked: false,
    academic_class: undefined, // academic_class is undefined
    teacher: { id: 'teacher4', name: 'Bob Johnson', email: 'bob@example.com', school_id: 1, role: 'Teacher' as const, created_at: '2024-01-01' }
  },
  {
    id: 5,
    school_id: 1,
    term_id: 1,
    academic_class_id: 105,
    subject_name: 'History',
    teacher_user_id: 'teacher5',
    is_locked: false,
    academic_class: { id: 105, school_id: 1, name: 'JSS3 Red', level: 'JSS3', arm: 'Red', session_label: '2024/2025', is_active: true },
    teacher: undefined // teacher is undefined
  }
];

// Simulate the filter logic from ResultManager.tsx
function filterAssignments(assignments: AcademicTeachingAssignment[], searchQuery: string): AcademicTeachingAssignment[] {
  if (!searchQuery.trim()) return assignments;
  
  const q = searchQuery.toLowerCase();
  return assignments.filter(a => 
    a.academic_class?.name?.toLowerCase().includes(q) ||
    a.subject_name?.toLowerCase().includes(q) ||
    a.teacher?.name?.toLowerCase().includes(q)
  );
}

// Test 1: Search for "Gold" should find the first assignment
const goldResults = filterAssignments(testAssignments, 'Gold');
assert.strictEqual(goldResults.length, 1, 'Should find one assignment with "Gold"');
assert.strictEqual(goldResults[0].id, 1, 'Should find assignment with JSS1 Gold class');

// Test 2: Search for "English" should find the second assignment despite null class name
const englishResults = filterAssignments(testAssignments, 'English');
assert.strictEqual(englishResults.length, 1, 'Should find one assignment with "English"');
assert.strictEqual(englishResults[0].id, 2, 'Should find assignment with English subject');

// Test 3: Search for "Science" should find the fourth assignment despite undefined academic_class
const scienceResults = filterAssignments(testAssignments, 'Science');
assert.strictEqual(scienceResults.length, 1, 'Should find one assignment with "Science"');
assert.strictEqual(scienceResults[0].id, 4, 'Should find assignment with Science subject');

// Test 4: Search for "Bob" should find the fourth assignment
const bobResults = filterAssignments(testAssignments, 'Bob');
assert.strictEqual(bobResults.length, 1, 'Should find one assignment with teacher "Bob"');
assert.strictEqual(bobResults[0].id, 4, 'Should find assignment with Bob Johnson as teacher');

// Test 5: Search for "JSS3" should find the fifth assignment despite undefined teacher
const jss3Results = filterAssignments(testAssignments, 'JSS3');
assert.strictEqual(jss3Results.length, 1, 'Should find one assignment with "JSS3"');
assert.strictEqual(jss3Results[0].id, 5, 'Should find assignment with JSS3 Red class');

// Test 6: Search with null values should not throw errors
try {
  const nullResults = filterAssignments(testAssignments, 'NonExistent');
  assert.strictEqual(nullResults.length, 0, 'Should return empty array for non-existent search');
} catch (error) {
  assert.fail('Filter should not throw error when handling null values');
}

// Test 7: Empty search should return all assignments
const emptyResults = filterAssignments(testAssignments, '');
assert.strictEqual(emptyResults.length, testAssignments.length, 'Empty search should return all assignments');

// Test 8: Search for "Jane" should find the second assignment
const janeResults = filterAssignments(testAssignments, 'Jane');
assert.strictEqual(janeResults.length, 1, 'Should find one assignment with teacher "Jane"');
assert.strictEqual(janeResults[0].id, 2, 'Should find assignment with Jane Smith as teacher');

console.log('ResultManager null handling tests passed');
