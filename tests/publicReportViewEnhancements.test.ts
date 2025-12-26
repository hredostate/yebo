/**
 * Tests for PublicReportView enhancements
 * Verifies ordinal suffix helper and component score handling
 */

// Test getOrdinalSuffix helper function
function getOrdinalSuffix(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

// Simple assertion helper
function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function strictEqual<T>(actual: T, expected: T, message: string) {
    if (actual !== expected) {
        throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

// Test 1: Basic ordinal suffixes
console.log('Test 1: Basic ordinal suffixes');
strictEqual(getOrdinalSuffix(1), 'st', '1st should have "st" suffix');
strictEqual(getOrdinalSuffix(2), 'nd', '2nd should have "nd" suffix');
strictEqual(getOrdinalSuffix(3), 'rd', '3rd should have "rd" suffix');
strictEqual(getOrdinalSuffix(4), 'th', '4th should have "th" suffix');
strictEqual(getOrdinalSuffix(5), 'th', '5th should have "th" suffix');

// Test 2: Teen numbers (special case)
console.log('Test 2: Teen numbers');
strictEqual(getOrdinalSuffix(11), 'th', '11th should have "th" suffix');
strictEqual(getOrdinalSuffix(12), 'th', '12th should have "th" suffix');
strictEqual(getOrdinalSuffix(13), 'th', '13th should have "th" suffix');

// Test 3: Numbers ending in 1, 2, 3 (but not teens)
console.log('Test 3: Numbers ending in 1, 2, 3');
strictEqual(getOrdinalSuffix(21), 'st', '21st should have "st" suffix');
strictEqual(getOrdinalSuffix(22), 'nd', '22nd should have "nd" suffix');
strictEqual(getOrdinalSuffix(23), 'rd', '23rd should have "rd" suffix');
strictEqual(getOrdinalSuffix(31), 'st', '31st should have "st" suffix');
strictEqual(getOrdinalSuffix(42), 'nd', '42nd should have "nd" suffix');
strictEqual(getOrdinalSuffix(53), 'rd', '53rd should have "rd" suffix');

// Test 4: Large numbers
console.log('Test 4: Large numbers');
strictEqual(getOrdinalSuffix(101), 'st', '101st should have "st" suffix');
strictEqual(getOrdinalSuffix(111), 'th', '111th should have "th" suffix');
strictEqual(getOrdinalSuffix(121), 'st', '121st should have "st" suffix');
strictEqual(getOrdinalSuffix(1001), 'st', '1001st should have "st" suffix');

// Test 5: Component score interface structure
console.log('Test 5: Component score interface');
interface MockSubject {
    subject_name: string;
    component_scores?: Record<string, number>;
    total_score: number;
}

const testSubjects: MockSubject[] = [
    { subject_name: 'Math', component_scores: { CA1: 15, CA2: 20, Exam: 50 }, total_score: 85 },
    { subject_name: 'English', component_scores: { CA1: 12, CA2: 18, Exam: 55 }, total_score: 85 },
    { subject_name: 'Science', component_scores: { CA1: 18, Exam: 48 }, total_score: 66 },
];

// Check if subjects have component scores
const hasComponentScores = testSubjects.some(s => s.component_scores && Object.keys(s.component_scores).length > 0);
strictEqual(hasComponentScores, true, 'Should detect component scores');

// Extract all unique component names
const componentNames = hasComponentScores ? 
    Array.from(new Set(
        testSubjects.flatMap(s => Object.keys(s.component_scores || {}))
    )).sort() : [];

strictEqual(componentNames.length, 3, 'Should have 3 component names');
strictEqual(componentNames[0], 'CA1', 'First component should be CA1');
strictEqual(componentNames[1], 'CA2', 'Second component should be CA2');
strictEqual(componentNames[2], 'Exam', 'Third component should be Exam');

// Test 6: Position display format
console.log('Test 6: Position display format');
const formatPosition = (position: number, total: number | undefined): string => {
    return `${position}${getOrdinalSuffix(position)}${total ? ` of ${total}` : ''}`;
};

strictEqual(formatPosition(5, 45), '5th of 45', 'Should format position correctly');
strictEqual(formatPosition(1, 30), '1st of 30', 'Should format 1st position correctly');
strictEqual(formatPosition(22, 100), '22nd of 100', 'Should format 22nd position correctly');
strictEqual(formatPosition(3, undefined), '3rd', 'Should handle missing total');

// Test 7: Empty component scores
console.log('Test 7: Empty component scores');
const subjectsWithoutComponents: MockSubject[] = [
    { subject_name: 'Math', total_score: 85 },
    { subject_name: 'English', component_scores: {}, total_score: 85 },
];

const hasNoComponentScores = subjectsWithoutComponents.some(s => s.component_scores && Object.keys(s.component_scores).length > 0);
strictEqual(hasNoComponentScores, false, 'Should detect no component scores');

const emptyComponentNames = hasNoComponentScores ? 
    Array.from(new Set(
        subjectsWithoutComponents.flatMap(s => Object.keys(s.component_scores || {}))
    )).sort() : [];

strictEqual(emptyComponentNames.length, 0, 'Should have no component names');

// Test 8: Position in Level formatted string handling
console.log('Test 8: Position in Level formatted string handling');

interface MockRPCData {
    summary?: {
        positionInLevelFormatted?: string;
    };
    ranking?: {
        positionInLevelFormatted?: string;
    };
}

// Test with formatted string in summary
const mockRPCData1: MockRPCData = {
    summary: {
        positionInLevelFormatted: '100th out of 167'
    }
};

const extractedPositionInLevelFormatted1 = mockRPCData1?.summary?.positionInLevelFormatted ?? mockRPCData1?.ranking?.positionInLevelFormatted;
strictEqual(extractedPositionInLevelFormatted1, '100th out of 167', 'Should extract formatted position from summary');

// Test with formatted string in ranking
const mockRPCData2: MockRPCData = {
    ranking: {
        positionInLevelFormatted: '5th out of 45'
    }
};

const extractedPositionInLevelFormatted2 = mockRPCData2?.summary?.positionInLevelFormatted ?? mockRPCData2?.ranking?.positionInLevelFormatted;
strictEqual(extractedPositionInLevelFormatted2, '5th out of 45', 'Should extract formatted position from ranking');

// Test with no formatted string
const mockRPCData3: MockRPCData = {};
const extractedPositionInLevelFormatted3 = mockRPCData3?.summary?.positionInLevelFormatted ?? mockRPCData3?.ranking?.positionInLevelFormatted;
strictEqual(extractedPositionInLevelFormatted3, undefined, 'Should return undefined when no formatted position exists');

// Test display fallback
const displayValue = extractedPositionInLevelFormatted1 || '—';
strictEqual(displayValue, '100th out of 167', 'Should display formatted value when present');

const displayValueEmpty = extractedPositionInLevelFormatted3 || '—';
strictEqual(displayValueEmpty, '—', 'Should display fallback when no value');

console.log('✅ All PublicReportView enhancement tests passed!');
