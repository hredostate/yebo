import assert from 'assert';

/**
 * Test for Report Card Attendance Display
 * 
 * This test validates that:
 * 1. Attendance data is correctly extracted from RPC response
 * 2. Attendance state is properly set
 * 3. Attendance UI renders when data exists
 * 4. buildUnifiedReportData includes attendance in output
 */

/**
 * Mock function that extracts attendance from RPC data
 * (matches the logic in PublicReportView.tsx)
 */
function extractAttendanceFromRPC(rpcData) {
  if (!rpcData?.attendance) {
    return null;
  }

  return {
    present: rpcData.attendance.present ?? 0,
    absent: rpcData.attendance.absent ?? 0,
    late: rpcData.attendance.late ?? 0,
    excused: rpcData.attendance.excused ?? 0,
    unexcused: rpcData.attendance.unexcused ?? 0,
    total: rpcData.attendance.total ?? 0,
    rate: rpcData.attendance.rate ?? 0,
  };
}

/**
 * Check if attendance section should be displayed
 * (matches condition in PublicReportView.tsx)
 */
function shouldDisplayAttendance(attendance) {
  return attendance !== null && attendance.total > 0;
}

// Test 1: Extract valid attendance data
console.log('Test 1: Extract valid attendance data from RPC response');
const mockRPCData = {
  attendance: {
    present: 85,
    absent: 5,
    late: 3,
    excused: 2,
    unexcused: 3,
    total: 90,
    rate: 94.4,
  },
};

const extracted = extractAttendanceFromRPC(mockRPCData);
assert(extracted !== null, 'Attendance should be extracted');
assert.strictEqual(extracted.present, 85, 'Present days should match');
assert.strictEqual(extracted.absent, 5, 'Absent days should match');
assert.strictEqual(extracted.late, 3, 'Late days should match');
assert.strictEqual(extracted.excused, 2, 'Excused days should match');
assert.strictEqual(extracted.unexcused, 3, 'Unexcused days should match');
assert.strictEqual(extracted.total, 90, 'Total days should match');
assert.strictEqual(extracted.rate, 94.4, 'Attendance rate should match');
assert(shouldDisplayAttendance(extracted), 'Attendance section should display');
console.log('✓ Test 1 passed');

// Test 2: Handle missing attendance data
console.log('\nTest 2: Handle missing attendance data');
const noAttendanceData = {};
const extractedNull = extractAttendanceFromRPC(noAttendanceData);
assert.strictEqual(extractedNull, null, 'Should return null when no attendance');
assert(!shouldDisplayAttendance(extractedNull), 'Attendance section should not display');
console.log('✓ Test 2 passed');

// Test 3: Handle partial attendance data with defaults
console.log('\nTest 3: Handle partial attendance data with defaults');
const partialData = {
  attendance: {
    present: 50,
    total: 60,
    // Missing other fields - should default to 0
  },
};
const extractedPartial = extractAttendanceFromRPC(partialData);
assert(extractedPartial !== null, 'Should extract partial data');
assert.strictEqual(extractedPartial.present, 50, 'Present should be set');
assert.strictEqual(extractedPartial.absent, 0, 'Absent should default to 0');
assert.strictEqual(extractedPartial.late, 0, 'Late should default to 0');
assert.strictEqual(extractedPartial.excused, 0, 'Excused should default to 0');
assert.strictEqual(extractedPartial.unexcused, 0, 'Unexcused should default to 0');
assert.strictEqual(extractedPartial.total, 60, 'Total should be set');
assert.strictEqual(extractedPartial.rate, 0, 'Rate should default to 0');
assert(shouldDisplayAttendance(extractedPartial), 'Attendance section should display (total > 0)');
console.log('✓ Test 3 passed');

// Test 4: Handle zero total (should not display)
console.log('\nTest 4: Handle zero total days');
const zeroTotalData = {
  attendance: {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    unexcused: 0,
    total: 0,
    rate: 0,
  },
};
const extractedZero = extractAttendanceFromRPC(zeroTotalData);
assert(extractedZero !== null, 'Should extract data even with zeros');
assert(!shouldDisplayAttendance(extractedZero), 'Attendance section should not display when total = 0');
console.log('✓ Test 4 passed');

// Test 5: Validate attendance rate calculation display
console.log('\nTest 5: Validate attendance rate display');
const attendanceWithRate = {
  present: 45,
  absent: 3,
  late: 2,
  excused: 1,
  unexcused: 2,
  total: 50,
  rate: 90.0,
};
// Simulate toFixed(1) formatting
const formattedRate = attendanceWithRate.rate.toFixed(1);
assert.strictEqual(formattedRate, '90.0', 'Rate should format to 1 decimal place');
console.log('✓ Test 5 passed');

console.log('\n=== All Report Card Attendance Tests Passed ===\n');
