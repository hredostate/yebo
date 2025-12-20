/**
 * Test attendance override retrieval logic for report cards
 * 
 * This test validates that the attendance override lookup works correctly
 * when searching for overrides with different group_id scenarios:
 * 1. Exact match with class_teacher group
 * 2. Match with any group the student belongs to
 * 3. Match with just student_id and term_id (backwards compatibility)
 */

import assert from 'assert';

interface AttendanceOverride {
  id: number;
  student_id: number;
  group_id: number;
  term_id: number;
  total_days: number;
  days_present: number;
  comment?: string;
  updated_at: string;
}

interface ClassGroupMember {
  student_id: number;
  group_id: number;
}

/**
 * Simulate the improved override lookup logic
 * This should match the behavior of the fixed SQL function
 */
function findAttendanceOverride(
  studentId: number,
  termId: number,
  classTeacherGroupId: number | null,
  allStudentGroups: ClassGroupMember[],
  overrides: AttendanceOverride[]
): AttendanceOverride | null {
  
  // Strategy 1: Try exact match with class_teacher group
  if (classTeacherGroupId !== null) {
    const exactMatch = overrides.find(
      o => o.student_id === studentId && 
           o.term_id === termId && 
           o.group_id === classTeacherGroupId
    );
    if (exactMatch) {
      return exactMatch;
    }
  }
  
  // Strategy 2: Try matching with any group the student belongs to
  const studentGroupIds = allStudentGroups
    .filter(m => m.student_id === studentId)
    .map(m => m.group_id);
  
  for (const groupId of studentGroupIds) {
    const groupMatch = overrides.find(
      o => o.student_id === studentId && 
           o.term_id === termId && 
           o.group_id === groupId
    );
    if (groupMatch) {
      return groupMatch;
    }
  }
  
  // Strategy 3: Try matching just student_id and term_id (backwards compatibility)
  const fallbackMatch = overrides.find(
    o => o.student_id === studentId && o.term_id === termId
  );
  
  return fallbackMatch || null;
}

// Test Setup
const STUDENT_ID = 1001;
const TERM_ID = 5;
const CLASS_TEACHER_GROUP_ID = 10;
const OTHER_GROUP_ID = 20;
const UNRELATED_GROUP_ID = 30;

// Test Case 1: Override exists with exact class_teacher group match
console.log('Test 1: Override with exact class_teacher group match...');
const overrides1: AttendanceOverride[] = [
  {
    id: 1,
    student_id: STUDENT_ID,
    group_id: CLASS_TEACHER_GROUP_ID,
    term_id: TERM_ID,
    total_days: 100,
    days_present: 85,
    comment: 'Adjusted for sick leave',
    updated_at: '2024-01-15T10:00:00Z'
  }
];
const members1: ClassGroupMember[] = [
  { student_id: STUDENT_ID, group_id: CLASS_TEACHER_GROUP_ID }
];
const result1 = findAttendanceOverride(STUDENT_ID, TERM_ID, CLASS_TEACHER_GROUP_ID, members1, overrides1);
assert.strictEqual(result1?.id, 1, 'Should find override with exact class_teacher match');
assert.strictEqual(result1?.days_present, 85, 'Should return correct days_present');
console.log('✅ Test 1 passed');

// Test Case 2: No class_teacher group, but override exists with another group
console.log('\nTest 2: Override with other group when class_teacher is null...');
const overrides2: AttendanceOverride[] = [
  {
    id: 2,
    student_id: STUDENT_ID,
    group_id: OTHER_GROUP_ID,
    term_id: TERM_ID,
    total_days: 90,
    days_present: 80,
    updated_at: '2024-01-15T10:00:00Z'
  }
];
const members2: ClassGroupMember[] = [
  { student_id: STUDENT_ID, group_id: OTHER_GROUP_ID }
];
const result2 = findAttendanceOverride(STUDENT_ID, TERM_ID, null, members2, overrides2);
assert.strictEqual(result2?.id, 2, 'Should find override with other group when class_teacher is null');
assert.strictEqual(result2?.days_present, 80, 'Should return correct days_present');
console.log('✅ Test 2 passed');

// Test Case 3: Override saved with different group than class_teacher
console.log('\nTest 3: Override saved with different group than class_teacher...');
const overrides3: AttendanceOverride[] = [
  {
    id: 3,
    student_id: STUDENT_ID,
    group_id: OTHER_GROUP_ID,
    term_id: TERM_ID,
    total_days: 95,
    days_present: 90,
    updated_at: '2024-01-15T10:00:00Z'
  }
];
const members3: ClassGroupMember[] = [
  { student_id: STUDENT_ID, group_id: CLASS_TEACHER_GROUP_ID },
  { student_id: STUDENT_ID, group_id: OTHER_GROUP_ID }
];
const result3 = findAttendanceOverride(STUDENT_ID, TERM_ID, CLASS_TEACHER_GROUP_ID, members3, overrides3);
assert.strictEqual(result3?.id, 3, 'Should find override even if saved with non-class_teacher group');
assert.strictEqual(result3?.days_present, 90, 'Should return correct days_present');
console.log('✅ Test 3 passed');

// Test Case 4: Override without group_id (backwards compatibility)
console.log('\nTest 4: Override without specific group (backwards compatibility)...');
const overrides4: AttendanceOverride[] = [
  {
    id: 4,
    student_id: STUDENT_ID,
    group_id: UNRELATED_GROUP_ID, // Group student doesn't belong to
    term_id: TERM_ID,
    total_days: 88,
    days_present: 82,
    updated_at: '2024-01-15T10:00:00Z'
  }
];
const members4: ClassGroupMember[] = [
  { student_id: STUDENT_ID, group_id: CLASS_TEACHER_GROUP_ID }
];
const result4 = findAttendanceOverride(STUDENT_ID, TERM_ID, CLASS_TEACHER_GROUP_ID, members4, overrides4);
assert.strictEqual(result4?.id, 4, 'Should find override by student_id and term_id only as fallback');
assert.strictEqual(result4?.days_present, 82, 'Should return correct days_present');
console.log('✅ Test 4 passed');

// Test Case 5: No override exists
console.log('\nTest 5: No override exists...');
const overrides5: AttendanceOverride[] = [];
const members5: ClassGroupMember[] = [
  { student_id: STUDENT_ID, group_id: CLASS_TEACHER_GROUP_ID }
];
const result5 = findAttendanceOverride(STUDENT_ID, TERM_ID, CLASS_TEACHER_GROUP_ID, members5, overrides5);
assert.strictEqual(result5, null, 'Should return null when no override exists');
console.log('✅ Test 5 passed');

// Test Case 6: Multiple overrides, prioritize class_teacher
console.log('\nTest 6: Multiple overrides, prioritize class_teacher...');
const overrides6: AttendanceOverride[] = [
  {
    id: 6,
    student_id: STUDENT_ID,
    group_id: OTHER_GROUP_ID,
    term_id: TERM_ID,
    total_days: 90,
    days_present: 80,
    updated_at: '2024-01-14T10:00:00Z'
  },
  {
    id: 7,
    student_id: STUDENT_ID,
    group_id: CLASS_TEACHER_GROUP_ID,
    term_id: TERM_ID,
    total_days: 92,
    days_present: 88,
    updated_at: '2024-01-15T10:00:00Z'
  }
];
const members6: ClassGroupMember[] = [
  { student_id: STUDENT_ID, group_id: CLASS_TEACHER_GROUP_ID },
  { student_id: STUDENT_ID, group_id: OTHER_GROUP_ID }
];
const result6 = findAttendanceOverride(STUDENT_ID, TERM_ID, CLASS_TEACHER_GROUP_ID, members6, overrides6);
assert.strictEqual(result6?.id, 7, 'Should prioritize class_teacher group override');
assert.strictEqual(result6?.days_present, 88, 'Should return correct days_present');
console.log('✅ Test 6 passed');

// Test Case 7: Override for different term should not be found
console.log('\nTest 7: Override for different term should not be found...');
const overrides7: AttendanceOverride[] = [
  {
    id: 8,
    student_id: STUDENT_ID,
    group_id: CLASS_TEACHER_GROUP_ID,
    term_id: 999, // Different term
    total_days: 100,
    days_present: 95,
    updated_at: '2024-01-15T10:00:00Z'
  }
];
const members7: ClassGroupMember[] = [
  { student_id: STUDENT_ID, group_id: CLASS_TEACHER_GROUP_ID }
];
const result7 = findAttendanceOverride(STUDENT_ID, TERM_ID, CLASS_TEACHER_GROUP_ID, members7, overrides7);
assert.strictEqual(result7, null, 'Should not find override for different term');
console.log('✅ Test 7 passed');

console.log('\n✅ All attendance override retrieval tests passed!');
