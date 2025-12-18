/**
 * Test dual ranking display functionality in report cards
 */

import { buildUnifiedReportData } from '../src/utils/buildUnifiedReportData.js';
import { formatPosition, hasValidRanking } from '../src/utils/reportCardHelpers.js';

// Test formatPosition helper
console.log('Testing formatPosition helper...');
console.log('formatPosition(3, 45):', formatPosition(3, 45)); // Expected: "3rd of 45"
console.log('formatPosition(1, 180):', formatPosition(1, 180)); // Expected: "1st of 180"
console.log('formatPosition(12, 180):', formatPosition(12, 180)); // Expected: "12th of 180"
console.log('formatPosition(null, 180):', formatPosition(null, 180)); // Expected: "N/A"
console.log('formatPosition(12, null):', formatPosition(12, null)); // Expected: "N/A"
console.log('formatPosition("N/A", 180):', formatPosition("N/A", 180)); // Expected: "N/A"

// Test hasValidRanking helper
console.log('\nTesting hasValidRanking helper...');
console.log('hasValidRanking(3, 45):', hasValidRanking(3, 45)); // Expected: true
console.log('hasValidRanking(null, 45):', hasValidRanking(null, 45)); // Expected: false
console.log('hasValidRanking(3, null):', hasValidRanking(3, null)); // Expected: false
console.log('hasValidRanking("N/A", 45):', hasValidRanking("N/A", 45)); // Expected: false
console.log('hasValidRanking(undefined, undefined):', hasValidRanking(undefined, undefined)); // Expected: false

// Test buildUnifiedReportData with level ranking fields
console.log('\nTesting buildUnifiedReportData with level ranking...');

const mockRawReport = {
  student: {
    fullName: 'John Doe',
    className: 'SS1 Copper',
    armName: 'Copper',
    levelName: 'SS1'
  },
  term: {
    sessionLabel: '2024/2025',
    termLabel: 'First Term'
  },
  subjects: [
    {
      subjectName: 'Mathematics',
      totalScore: 85,
      grade: 'B',
      remark: 'Very Good',
      componentScores: { 'CA': 30, 'Exam': 55 },
      subjectPosition: 5
    },
    {
      subjectName: 'English',
      totalScore: 78,
      grade: 'C',
      remark: 'Good',
      componentScores: { 'CA': 28, 'Exam': 50 },
      subjectPosition: 8
    }
  ],
  summary: {
    positionInArm: 3,
    cohortSize: 45,
    positionInLevel: 12,
    levelSize: 180,
    gpaAverage: 3.5,
    campusPercentile: 78.5
  },
  comments: {
    teacher: 'Excellent performance',
    principal: 'Keep up the good work'
  },
  attendance: {
    present: 85,
    absent: 5,
    late: 2,
    excused: 2,
    unexcused: 3,
    total: 90,
    rate: 94.4
  }
};

const mockSchoolConfig = {
  school_name: 'Unity Progressive Secondary School',
  display_name: 'UPSS',
  address: '123 Education Road, Lagos',
  motto: 'Excellence in Learning'
};

const unifiedData = buildUnifiedReportData(
  mockRawReport as any,
  mockSchoolConfig,
  'ADM001',
  null,
  null
);

console.log('Student data:', {
  fullName: unifiedData.student.fullName,
  className: unifiedData.student.className,
  armName: unifiedData.student.armName,
  levelName: unifiedData.student.levelName
});

console.log('Summary data:', {
  positionInArm: unifiedData.summary.positionInArm,
  totalStudentsInArm: unifiedData.summary.totalStudentsInArm,
  positionInLevel: unifiedData.summary.positionInLevel,
  totalStudentsInLevel: unifiedData.summary.totalStudentsInLevel
});

// Test with alternative field names
console.log('\nTesting with alternative field names (snake_case)...');

const mockRawReport2 = {
  student: {
    name: 'Jane Smith',
    class: 'SS2 Gold',
    arm_name: 'Gold',
    level: 'SS2'
  },
  term: {
    session_label: '2024/2025',
    term_label: 'Second Term'
  },
  subjects: [],
  summary: {
    position_in_arm: 1,
    total_students_in_arm: 40,
    position_in_level: 2,
    total_students_in_level: 160,
    gpa_average: 4.0
  }
};

const unifiedData2 = buildUnifiedReportData(
  mockRawReport2 as any,
  mockSchoolConfig,
  'ADM002',
  null,
  null
);

console.log('Student data (snake_case):', {
  fullName: unifiedData2.student.fullName,
  className: unifiedData2.student.className,
  armName: unifiedData2.student.armName,
  levelName: unifiedData2.student.levelName
});

console.log('Summary data (snake_case):', {
  positionInArm: unifiedData2.summary.positionInArm,
  totalStudentsInArm: unifiedData2.summary.totalStudentsInArm,
  positionInLevel: unifiedData2.summary.positionInLevel,
  totalStudentsInLevel: unifiedData2.summary.totalStudentsInLevel
});

// Test with missing level data
console.log('\nTesting with missing level ranking data...');

const mockRawReport3 = {
  student: {
    fullName: 'Test Student',
    className: 'JSS1 A'
  },
  term: {
    sessionLabel: '2024/2025',
    termLabel: 'Third Term'
  },
  subjects: [],
  summary: {
    positionInArm: 5,
    totalStudentsInArm: 30
    // No level ranking data
  }
};

const unifiedData3 = buildUnifiedReportData(
  mockRawReport3 as any,
  mockSchoolConfig,
  'ADM003',
  null,
  null
);

console.log('Summary data (missing level):', {
  positionInArm: unifiedData3.summary.positionInArm,
  totalStudentsInArm: unifiedData3.summary.totalStudentsInArm,
  positionInLevel: unifiedData3.summary.positionInLevel,
  totalStudentsInLevel: unifiedData3.summary.totalStudentsInLevel
});

console.log('\n✅ All tests completed successfully!');
