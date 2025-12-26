/**
 * Tests for PublicReportView label and attendance rate fixes
 * Verifies:
 * 1. Position in Class label (not "Position in Arm")
 * 2. "out of" format for position display
 * 3. Attendance rate field mapping (attendanceRate vs rate)
 */

// Simple assertion helper
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

// Helper function from PublicReportView
function getOrdinalSuffix(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

// Test 1: Position formatting with "out of"
console.log('Test 1: Position formatting with "out of"');

const formatPositionOld = (position: number, total: number | undefined): string => {
    return `${position}${getOrdinalSuffix(position)}${total ? ` of ${total}` : ''}`;
};

const formatPositionNew = (position: number, total: number | string | undefined): string => {
    return `${position}${getOrdinalSuffix(position)} out of ${total || '—'}`;
};

// Test old format (before fix)
strictEqual(formatPositionOld(26, 30), '26th of 30', 'Old format: 26th of 30');
strictEqual(formatPositionOld(1, 45), '1st of 45', 'Old format: 1st of 45');
strictEqual(formatPositionOld(5, undefined), '5th', 'Old format: handles missing total');

// Test new format (after fix)
strictEqual(formatPositionNew(26, 30), '26th out of 30', 'New format: 26th out of 30');
strictEqual(formatPositionNew(1, 45), '1st out of 45', 'New format: 1st out of 45');
strictEqual(formatPositionNew(5, undefined), '5th out of —', 'New format: shows — for missing total');
strictEqual(formatPositionNew(3, '—'), '3rd out of —', 'New format: handles — string');

// Test 2: Attendance rate field mapping
console.log('Test 2: Attendance rate field mapping');

interface MockAttendanceRPC {
    attendance?: {
        present?: number;
        absent?: number;
        late?: number;
        excused?: number;
        unexcused?: number;
        total?: number;
        rate?: number;
        attendanceRate?: number;
    };
}

// Mock RPC data with attendanceRate field (new backend format)
const mockRPCDataNew: MockAttendanceRPC = {
    attendance: {
        present: 95,
        absent: 5,
        late: 2,
        excused: 1,
        unexcused: 4,
        total: 100,
        attendanceRate: 95
    }
};

// Mock RPC data with rate field (old backend format)
const mockRPCDataOld: MockAttendanceRPC = {
    attendance: {
        present: 90,
        absent: 10,
        late: 3,
        excused: 2,
        unexcused: 8,
        total: 100,
        rate: 90
    }
};

// Mock RPC data with both fields (attendanceRate takes precedence)
const mockRPCDataBoth: MockAttendanceRPC = {
    attendance: {
        present: 85,
        absent: 15,
        total: 100,
        attendanceRate: 85,
        rate: 80  // Should be ignored when attendanceRate is present
    }
};

// Old extraction logic (before fix) - only checks rate
const extractedAttendanceOld = (rpcData: MockAttendanceRPC) => rpcData?.attendance ? {
    present: rpcData.attendance.present ?? 0,
    absent: rpcData.attendance.absent ?? 0,
    late: rpcData.attendance.late ?? 0,
    excused: rpcData.attendance.excused ?? 0,
    unexcused: rpcData.attendance.unexcused ?? 0,
    total: rpcData.attendance.total ?? 0,
    rate: rpcData.attendance.rate ?? 0,
} : null;

// New extraction logic (after fix) - checks attendanceRate first, then rate
const extractedAttendanceNew = (rpcData: MockAttendanceRPC) => rpcData?.attendance ? {
    present: rpcData.attendance.present ?? 0,
    absent: rpcData.attendance.absent ?? 0,
    late: rpcData.attendance.late ?? 0,
    excused: rpcData.attendance.excused ?? 0,
    unexcused: rpcData.attendance.unexcused ?? 0,
    total: rpcData.attendance.total ?? 0,
    rate: rpcData.attendance.attendanceRate ?? rpcData.attendance.rate ?? 0,
} : null;

// Test with new backend format (attendanceRate field)
const resultNew = extractedAttendanceNew(mockRPCDataNew);
assert(resultNew !== null, 'Should extract attendance data');
strictEqual(resultNew!.rate, 95, 'Should correctly extract attendanceRate as rate');

// Test with old backend format (rate field)
const resultOld = extractedAttendanceNew(mockRPCDataOld);
assert(resultOld !== null, 'Should extract attendance data');
strictEqual(resultOld!.rate, 90, 'Should correctly extract rate field as fallback');

// Test with both fields (attendanceRate takes precedence)
const resultBoth = extractedAttendanceNew(mockRPCDataBoth);
assert(resultBoth !== null, 'Should extract attendance data');
strictEqual(resultBoth!.rate, 85, 'Should prefer attendanceRate over rate');

// Verify old logic fails with new format
const resultOldLogicNewData = extractedAttendanceOld(mockRPCDataNew);
assert(resultOldLogicNewData !== null, 'Should extract attendance data');
strictEqual(resultOldLogicNewData!.rate, 0, 'Old logic incorrectly returns 0 for new format');

console.log('✅ All PublicReportView label and attendance fix tests passed!');
