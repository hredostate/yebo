/**
 * Advanced Reports System - Usage Examples
 * 
 * This file demonstrates how to use the new Advanced Reporting System components
 */

import React from 'react';

// Import report components
import AcademicProgressReport from './src/components/reports/AcademicProgressReport';
import FinancialReport from './src/components/reports/FinancialReport';
import AttendancePatternReport from './src/components/reports/AttendancePatternReport';
import TeacherPerformanceReport from './src/components/reports/TeacherPerformanceReport';
import CustomReportBuilder from './src/components/reports/CustomReportBuilder';
import AdvancedReportsDashboard from './src/components/reports/AdvancedReportsDashboard';

// Import analytics services
import { generateFinancialReportData } from './src/services/financialAnalytics';
import { generateAttendancePatternData } from './src/services/attendanceAnalytics';
import { generateTeacherPerformanceData } from './src/services/teacherAnalytics';

// Import utilities
import { exportReportToPDF, exportReportToExcel } from './src/utils/reportExport';

/**
 * Example 1: Academic Progress Report
 */
export const AcademicProgressReportExample = () => {
  const sampleData = {
    student: {
      id: 1,
      name: 'John Doe',
      class: 'Grade 10A',
      admissionNumber: 'ADM001',
    },
    termComparison: [
      { term: 'Term 1', average: 75, rank: 5, totalStudents: 30 },
      { term: 'Term 2', average: 78, rank: 4, totalStudents: 30 },
      { term: 'Term 3', average: 82, rank: 3, totalStudents: 30 },
    ],
    subjectBreakdown: [
      {
        subject: 'Mathematics',
        scores: [70, 75, 80],
        trend: 'improving' as const,
        classAverage: 72,
        percentile: 75,
      },
      {
        subject: 'English',
        scores: [85, 83, 84],
        trend: 'stable' as const,
        classAverage: 78,
        percentile: 85,
      },
    ],
    strengthsWeaknesses: {
      strengths: ['Strong analytical skills', 'Excellent in problem-solving'],
      weaknesses: ['Needs improvement in time management', 'More practice in essay writing'],
      recommendations: [
        'Continue with advanced mathematics courses',
        'Join the debate club to improve communication skills',
        'Practice timed essays weekly',
      ],
    },
  };

  return (
    <AcademicProgressReport
      data={sampleData}
      schoolName="Example High School"
      isDarkMode={false}
    />
  );
};

/**
 * Example 2: Financial Report with Analytics
 */
export const FinancialReportExample = () => {
  // Sample data - in real use, fetch from database
  const feeRecords = [
    { student_id: 1, amount_due: 50000, amount_paid: 45000, created_at: '2024-01-15' },
    { student_id: 2, amount_due: 50000, amount_paid: 50000, created_at: '2024-01-20' },
  ];

  const payments = [
    { payment_method: 'Bank Transfer', amount: 45000 },
    { payment_method: 'Cash', amount: 50000 },
  ];

  const students = [
    { id: 1, name: 'Student 1', class: { name: 'Grade 10' } },
    { id: 2, name: 'Student 2', class: { name: 'Grade 10' } },
  ];

  const reportData = generateFinancialReportData(feeRecords, payments, students);

  return (
    <FinancialReport
      data={reportData}
      schoolName="Example High School"
      isDarkMode={false}
    />
  );
};

/**
 * Example 3: Attendance Pattern Report with Analytics
 */
export const AttendancePatternReportExample = () => {
  const attendanceRecords = [
    { student_id: 1, date: '2024-01-15', status: 'Present' },
    { student_id: 2, date: '2024-01-15', status: 'Absent' },
    // ... more records
  ];

  const students = [
    { id: 1, name: 'Student 1' },
    { id: 2, name: 'Student 2' },
  ];

  const reportData = generateAttendancePatternData(attendanceRecords, students);

  return (
    <AttendancePatternReport
      data={reportData}
      schoolName="Example High School"
      isDarkMode={false}
    />
  );
};

/**
 * Example 4: Teacher Performance Report
 */
export const TeacherPerformanceReportExample = () => {
  const teacherInfo = {
    id: 'teacher1',
    name: 'Jane Smith',
    subjects: ['Mathematics', 'Physics'],
    classes: ['Grade 10A', 'Grade 11B'],
    yearsOfExperience: 5,
  };

  const feedbackRecords = [
    { rating: 4.5, category: 'Teaching Quality', created_at: '2024-01-15' },
    { rating: 4.8, category: 'Communication', created_at: '2024-01-20' },
  ];

  const teacherAssignments = [
    { class_id: 1, class_name: 'Grade 10A', subject: 'Mathematics' },
  ];

  const assessmentScores = [
    { class_id: 1, subject: 'Mathematics', score: 75, created_at: '2024-01-15' },
  ];

  const reportData = generateTeacherPerformanceData(
    teacherInfo,
    feedbackRecords,
    teacherAssignments,
    assessmentScores,
    [], // lesson plans
    [], // attendance records
    70 // school average score
  );

  return (
    <TeacherPerformanceReport
      data={reportData}
      schoolName="Example High School"
      isDarkMode={false}
    />
  );
};

/**
 * Example 5: Custom Report Builder
 */
export const CustomReportBuilderExample = () => {
  const handleSaveTemplate = (template: any) => {
    console.log('Template saved:', template);
    // In real application, save to database
  };

  return (
    <CustomReportBuilder
      isDarkMode={false}
      onSave={handleSaveTemplate}
    />
  );
};

/**
 * Example 6: Advanced Reports Dashboard
 */
export const AdvancedReportsDashboardExample = () => {
  const handleOpenReport = (reportType: string, templateId?: number) => {
    console.log('Opening report:', reportType, templateId);
    // Navigate to specific report or load template
  };

  const handleCreateCustomReport = () => {
    console.log('Creating custom report');
    // Navigate to custom report builder
  };

  return (
    <AdvancedReportsDashboard
      onOpenReport={handleOpenReport}
      onCreateCustomReport={handleCreateCustomReport}
      isDarkMode={false}
    />
  );
};

/**
 * Example 7: Export Report to PDF
 */
export const exportReportToPDFExample = async () => {
  const reportElement = document.getElementById('report-content');
  if (!reportElement) return;

  await exportReportToPDF(
    'Academic Progress Report',
    reportElement,
    {
      subtitle: 'Term 3 Report',
      schoolName: 'Example High School',
      generatedBy: 'Admin User',
    }
  );
};

/**
 * Example 8: Export Report to Excel
 */
export const exportReportToExcelExample = async () => {
  const data = [
    { term: 'Term 1', average: 75, rank: 5 },
    { term: 'Term 2', average: 78, rank: 4 },
    { term: 'Term 3', average: 82, rank: 3 },
  ];

  const columns = [
    { key: 'term', header: 'Term', width: 15 },
    { key: 'average', header: 'Average', width: 15, type: 'number' as const },
    { key: 'rank', header: 'Rank', width: 15, type: 'number' as const },
  ];

  await exportReportToExcel(data, columns, 'Academic_Progress', 'Term Comparison');
};

/**
 * Integration with existing application
 */
export const IntegrationExample = () => {
  // In your main App.tsx or routing component:
  
  // 1. Add route for reports dashboard
  // <Route path="/reports" element={<AdvancedReportsDashboard />} />
  
  // 2. Add route for custom report builder
  // <Route path="/reports/builder" element={<CustomReportBuilder />} />
  
  // 3. Add routes for specific reports
  // <Route path="/reports/academic" element={<AcademicProgressReport data={...} />} />
  // <Route path="/reports/financial" element={<FinancialReport data={...} />} />
  // <Route path="/reports/attendance" element={<AttendancePatternReport data={...} />} />
  // <Route path="/reports/teacher" element={<TeacherPerformanceReport data={...} />} />

  // 4. Add navigation link in sidebar
  // <NavLink to="/reports">📊 Advanced Reports</NavLink>

  return null;
};

/**
 * Database Integration Example
 */
export const DatabaseIntegrationExample = () => {
  // Example of fetching data from Supabase for reports

  const fetchAcademicData = async (studentId: number) => {
    // const { data: scores } = await supabase
    //   .from('assessment_scores')
    //   .select('*')
    //   .eq('student_id', studentId);
    
    // const { data: student } = await supabase
    //   .from('students')
    //   .select('*')
    //   .eq('id', studentId)
    //   .single();
    
    // Process and format data for report
    return {
      student: { /* ... */ },
      termComparison: [ /* ... */ ],
      subjectBreakdown: [ /* ... */ ],
      strengthsWeaknesses: { /* ... */ },
    };
  };

  const fetchFinancialData = async (schoolId: number) => {
    // const { data: fees } = await supabase
    //   .from('fees')
    //   .select('*')
    //   .eq('school_id', schoolId);
    
    // const { data: payments } = await supabase
    //   .from('payment_history')
    //   .select('*')
    //   .eq('school_id', schoolId);
    
    // Use analytics service to process data
    // return generateFinancialReportData(fees, payments, students);
  };

  const fetchAttendanceData = async (schoolId: number) => {
    // const { data: attendance } = await supabase
    //   .from('attendance_records')
    //   .select('*')
    //   .eq('school_id', schoolId);
    
    // Use analytics service to process data
    // return generateAttendancePatternData(attendance, students);
  };

  return null;
};
