/**
 * Data Normalizer for Unified Report Card
 * 
 * Converts data from various sources (BulkReportCardGenerator, StudentReportView, etc.)
 * into the unified UnifiedReportCardData format.
 */

import type { UnifiedReportCardData, PrintSubject, PrintAttendance } from '../types/reportCardPrint';

interface RawReportData {
  student: {
    fullName?: string;
    name?: string;
    className?: string;
    class?: string;
  };
  term: {
    sessionLabel?: string;
    session_label?: string;
    termLabel?: string;
    term_label?: string;
  };
  subjects: Array<{
    subjectName?: string;
    subject_name?: string;
    totalScore?: number;
    total_score?: number;
    grade?: string;
    remark?: string;
    componentScores?: Record<string, number>;
    component_scores?: Record<string, number>;
    subjectPosition?: number | null;
    subject_position?: number | null;
  }>;
  schoolConfig?: {
    school_name?: string;
    display_name?: string;
    address?: string;
    motto?: string;
    logo_url?: string;
  };
  summary?: {
    positionInArm?: number | string;
    position_in_arm?: number | string;
    totalStudentsInArm?: number | string;
    total_students_in_arm?: number | string;
    gpaAverage?: number | string;
    gpa_average?: number | string;
    campusPercentile?: number | null;
    campus_percentile?: number | null;
  };
  comments?: {
    teacher?: string;
    teacher_comment?: string;
    principal?: string;
    principal_comment?: string;
  };
  attendance?: {
    present?: number;
    absent?: number;
    late?: number;
    excused?: number;
    unexcused?: number;
    total?: number;
    rate?: number;
    overrideApplied?: boolean;
    computed?: {
      present?: number;
      total?: number;
    };
  };
}

interface SchoolConfig {
  school_name?: string;
  display_name?: string;
  address?: string;
  motto?: string;
  logo_url?: string;
}

interface ClassConfig {
  report_config?: {
    layout?: 'classic' | 'modern' | 'pastel' | 'professional' | 'compact';
    colorTheme?: string;
    customLogoUrl?: string;
    schoolNameOverride?: string;
    principalLabel?: string;
    teacherLabel?: string;
  };
}

interface AssessmentComponent {
  name: string;
  max_score: number;
}

/**
 * Normalizes raw report data into UnifiedReportCardData format
 */
export function buildUnifiedReportData(
  rawReport: RawReportData,
  schoolConfig: SchoolConfig | null,
  studentAdmNumber: string,
  assessmentComponents?: AssessmentComponent[] | null,
  classConfig?: ClassConfig | null
): UnifiedReportCardData {
  // Normalize subjects
  const subjects: PrintSubject[] = rawReport.subjects.map(sub => ({
    subjectName: sub.subjectName || sub.subject_name || 'Unknown Subject',
    totalScore: sub.totalScore ?? sub.total_score ?? 0,
    grade: sub.grade || '-',
    remark: sub.remark || '-',
    componentScores: sub.componentScores || sub.component_scores,
    subjectPosition: sub.subjectPosition ?? sub.subject_position ?? null,
  }));

  // Calculate summary
  const totalScore = subjects.reduce((sum, s) => sum + s.totalScore, 0);
  const averageScore = subjects.length > 0 ? totalScore / subjects.length : 0;

  // Normalize attendance
  let attendance: PrintAttendance | undefined;
  if (rawReport.attendance) {
    attendance = {
      present: rawReport.attendance.present ?? 0,
      absent: rawReport.attendance.absent ?? 0,
      late: rawReport.attendance.late ?? 0,
      excused: rawReport.attendance.excused ?? 0,
      unexcused: rawReport.attendance.unexcused ?? 0,
      total: rawReport.attendance.total ?? 0,
      rate: rawReport.attendance.rate ?? 0,
      overrideApplied: rawReport.attendance.overrideApplied,
      computed: rawReport.attendance.computed,
    };
  }

  // Merge school config from rawReport and schoolConfig parameter
  const mergedSchoolConfig = {
    ...schoolConfig,
    ...rawReport.schoolConfig,
  };

  return {
    student: {
      fullName: rawReport.student.fullName || rawReport.student.name || 'Unknown Student',
      admissionNumber: studentAdmNumber || 'N/A',
      className: rawReport.student.className || rawReport.student.class || 'Unknown Class',
    },
    school: {
      name: mergedSchoolConfig.school_name || 'School Name',
      displayName: mergedSchoolConfig.display_name,
      address: mergedSchoolConfig.address,
      motto: mergedSchoolConfig.motto,
      logoUrl: mergedSchoolConfig.logo_url,
    },
    term: {
      sessionLabel: rawReport.term.sessionLabel || rawReport.term.session_label || '',
      termLabel: rawReport.term.termLabel || rawReport.term.term_label || '',
    },
    subjects,
    summary: {
      totalScore,
      averageScore,
      positionInArm: rawReport.summary?.positionInArm ?? rawReport.summary?.position_in_arm ?? 'N/A',
      totalStudentsInArm: rawReport.summary?.totalStudentsInArm ?? rawReport.summary?.total_students_in_arm ?? 'N/A',
      gpaAverage: rawReport.summary?.gpaAverage ?? rawReport.summary?.gpa_average ?? 'N/A',
      campusPercentile: rawReport.summary?.campusPercentile ?? rawReport.summary?.campus_percentile ?? null,
    },
    comments: {
      teacher: rawReport.comments?.teacher || rawReport.comments?.teacher_comment || '',
      principal: rawReport.comments?.principal || rawReport.comments?.principal_comment || '',
    },
    attendance,
    assessmentComponents: assessmentComponents || undefined,
    config: classConfig?.report_config,
  };
}
