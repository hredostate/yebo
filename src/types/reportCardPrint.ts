/**
 * Unified Report Card Print Data Model
 * 
 * This module defines the canonical data structures for report card printing.
 * All entry points (BulkReportCardGenerator, StudentReportView, PublicReportView)
 * must normalize their data to these interfaces before rendering.
 */

export interface PrintSubject {
  subjectName: string;
  totalScore: number;
  grade: string;
  remark: string;
  componentScores?: Record<string, number>; // e.g., { "CA1": 10, "Exam": 50 }
  subjectPosition?: number | null;
}

export interface PrintAttendance {
  present: number;
  absent: number;
  late: number;
  excused: number;
  unexcused: number;
  total: number;
  rate: number;
  overrideApplied?: boolean;
  computed?: {
    present: number;
    total: number;
  };
}

export interface PrintStudent {
  fullName: string;
  admissionNumber: string;
  className: string;
}

export interface PrintSchool {
  name: string;
  displayName?: string;
  address?: string;
  motto?: string;
  logoUrl?: string;
}

export interface PrintTerm {
  sessionLabel: string;
  termLabel: string;
}

export interface PrintSummary {
  totalScore: number;
  averageScore: number;
  positionInArm?: number | string;
  totalStudentsInArm?: number | string;
  gpaAverage?: number | string;
  campusPercentile?: number | null;
}

export interface PrintComments {
  teacher?: string;
  principal?: string;
}

export interface AssessmentComponentDef {
  name: string;
  max_score: number;
}

export interface GradeRule {
  min_score: number;
  max_score: number;
  grade: string;
  remark: string;
}

export interface PrintConfig {
  layout?: 'classic' | 'modern' | 'pastel' | 'professional' | 'compact';
  colorTheme?: string;
  customLogoUrl?: string;
  schoolNameOverride?: string;
  principalLabel?: string;
  teacherLabel?: string;
}

export interface UnifiedReportCardData {
  student: PrintStudent;
  school: PrintSchool;
  term: PrintTerm;
  subjects: PrintSubject[];
  summary: PrintSummary;
  comments: PrintComments;
  attendance?: PrintAttendance;
  assessmentComponents?: AssessmentComponentDef[];
  gradeRules?: GradeRule[];
  config?: PrintConfig;
}

export type WatermarkType = 'DRAFT' | 'FINAL' | 'NONE';
