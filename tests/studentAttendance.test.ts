import assert from 'assert';

/**
 * Test for Student Dashboard Attendance Calculation Logic
 * 
 * This test validates that the attendance calculation works correctly
 * for various scenarios:
 * 1. Using attendance override values
 * 2. Computing from attendance records
 * 3. Handling edge cases (no records, no term, etc.)
 */

interface AttendanceOverride {
  days_present: number;
  total_days: number;
}

interface AttendanceRecord {
  status: string;
  session_date: string;
}

/**
 * Calculate attendance percentage based on override or records
 */
function calculateAttendancePercentage(
  override: AttendanceOverride | null,
  records: AttendanceRecord[] | null
): number {
  let attendancePercentage = 0;

  if (override) {
    // Use override values
    const total = override.total_days || 0;
    attendancePercentage = total > 0 ? Math.round((override.days_present / total) * 100) : 0;
  } else if (records && records.length > 0) {
    // Compute from attendance records
    const presentCount = records.filter(r => 
      r.status && ['present', 'p'].includes(r.status.toLowerCase())
    ).length;
    const totalRecords = records.length;

    if (totalRecords > 0) {
      attendancePercentage = Math.round((presentCount / totalRecords) * 100);
    }
  }

  return attendancePercentage;
}

// Test 1: Attendance with override
const override1: AttendanceOverride = { days_present: 85, total_days: 100 };
const result1 = calculateAttendancePercentage(override1, null);
assert.strictEqual(result1, 85, 'Should calculate 85% from override');

// Test 2: Attendance from records - all present
const records2: AttendanceRecord[] = [
  { status: 'present', session_date: '2024-01-01' },
  { status: 'present', session_date: '2024-01-02' },
  { status: 'present', session_date: '2024-01-03' },
  { status: 'present', session_date: '2024-01-04' },
  { status: 'present', session_date: '2024-01-05' },
];
const result2 = calculateAttendancePercentage(null, records2);
assert.strictEqual(result2, 100, 'Should calculate 100% when all present');

// Test 3: Attendance from records - mixed status
const records3: AttendanceRecord[] = [
  { status: 'present', session_date: '2024-01-01' },
  { status: 'absent', session_date: '2024-01-02' },
  { status: 'present', session_date: '2024-01-03' },
  { status: 'late', session_date: '2024-01-04' },
  { status: 'present', session_date: '2024-01-05' },
];
const result3 = calculateAttendancePercentage(null, records3);
assert.strictEqual(result3, 60, 'Should calculate 60% (3 present out of 5)');

// Test 4: Attendance with 'P' status (case insensitive)
const records4: AttendanceRecord[] = [
  { status: 'P', session_date: '2024-01-01' },
  { status: 'p', session_date: '2024-01-02' },
  { status: 'Present', session_date: '2024-01-03' },
  { status: 'PRESENT', session_date: '2024-01-04' },
];
const result4 = calculateAttendancePercentage(null, records4);
assert.strictEqual(result4, 100, 'Should handle case-insensitive present status');

// Test 5: No records
const result5 = calculateAttendancePercentage(null, null);
assert.strictEqual(result5, 0, 'Should return 0% when no records');

// Test 6: Empty records array
const result6 = calculateAttendancePercentage(null, []);
assert.strictEqual(result6, 0, 'Should return 0% when empty records array');

// Test 7: Override with zero total days
const override7: AttendanceOverride = { days_present: 50, total_days: 0 };
const result7 = calculateAttendancePercentage(override7, null);
assert.strictEqual(result7, 0, 'Should return 0% when total days is 0');

// Test 8: Override takes precedence over records
const override8: AttendanceOverride = { days_present: 90, total_days: 100 };
const records8: AttendanceRecord[] = [
  { status: 'absent', session_date: '2024-01-01' },
  { status: 'absent', session_date: '2024-01-02' },
];
const result8 = calculateAttendancePercentage(override8, records8);
assert.strictEqual(result8, 90, 'Override should take precedence over records');

// Test 9: Rounding behavior
const records9: AttendanceRecord[] = [
  { status: 'present', session_date: '2024-01-01' },
  { status: 'present', session_date: '2024-01-02' },
  { status: 'absent', session_date: '2024-01-03' },
];
const result9 = calculateAttendancePercentage(null, records9);
assert.strictEqual(result9, 67, 'Should round 66.67% to 67%');

// Test 10: Null status values should be ignored
const records10: AttendanceRecord[] = [
  { status: 'present', session_date: '2024-01-01' },
  { status: null as any, session_date: '2024-01-02' },
  { status: 'present', session_date: '2024-01-03' },
];
const result10 = calculateAttendancePercentage(null, records10);
assert.strictEqual(result10, 67, 'Should ignore null status values (2 present out of 3)');

console.log('✅ All student attendance calculation tests passed!');
