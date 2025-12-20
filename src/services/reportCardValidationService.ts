/**
 * Report Card Validation Service
 * 
 * Provides validation logic for report card generation.
 * Ensures no mock data or placeholders are used in production.
 */

import { requireSupabaseClient } from './supabaseClient';

export interface ValidationError {
  student_id?: number;
  subject?: string;
  missing?: string | string[];
  error?: string;
}

export interface ValidationResult {
  status: 'success' | 'blocked';
  reason?: 'STUDENT_NOT_FOUND' | 'NOT_ENROLLED' | 'RESULTS_NOT_PUBLISHED' | 'MISSING_GRADING_SCHEME' | 'MISSING_SCORES';
  details?: ValidationError[];
  data?: ReportCardData;
}

export interface ReportCardData {
  student: {
    id: number;
    fullName: string;
    admissionNumber: string;
    className?: string;
    armName?: string;
  };
  school: {
    name: string;
    displayName?: string;
    address?: string;
    motto?: string;
    logoUrl?: string;
  };
  term: {
    sessionLabel: string;
    termLabel: string;
  };
  subjects: Array<{
    subjectName: string;
    totalScore: number;
    grade: string;
    remark: string;
    componentScores?: Record<string, number>;
    subjectPosition?: number | null;
  }>;
  summary: {
    totalScore: number;
    averageScore: number;
    positionInArm?: number;
    totalStudentsInArm?: number;
    positionInLevel?: number;
    totalStudentsInLevel?: number;
    gpaAverage?: number;
    campusPercentile?: number | null;
  };
  comments: {
    teacher?: string;
    principal?: string;
  };
  attendance?: {
    present: number;
    absent: number;
    late: number;
    excused?: number;
    unexcused?: number;
    total?: number;
    rate: number;
  };
}

/**
 * Validate and fetch report card data for a single student
 * Uses the server-side RPC function to ensure data integrity
 */
export async function validateReportCardData(
  studentId: number,
  termId: number
): Promise<ValidationResult> {
  const supabase = requireSupabaseClient();

  try {
    // Call the server-side RPC function that validates and computes data
    const { data, error } = await supabase.rpc('compute_report_card_data', {
      p_student_id: studentId,
      p_term_id: termId
    });

    if (error) {
      console.error('Error calling compute_report_card_data:', error);
      return {
        status: 'blocked',
        reason: 'STUDENT_NOT_FOUND',
        details: [{ error: error.message }]
      };
    }

    // The RPC function returns a result with status and either data or validation errors
    if (data.status === 'blocked') {
      return {
        status: 'blocked',
        reason: data.reason,
        details: data.details
      };
    }

    // Success case - return the computed data
    return {
      status: 'success',
      data: data.data
    };
  } catch (error) {
    console.error('Error in validateReportCardData:', error);
    return {
      status: 'blocked',
      reason: 'STUDENT_NOT_FOUND',
      details: [{ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }]
    };
  }
}

/**
 * Validate report card data for multiple students
 * Returns a map of student IDs to their validation results
 */
export async function validateBulkReportCardData(
  studentIds: number[],
  termId: number
): Promise<Map<number, ValidationResult>> {
  const results = new Map<number, ValidationResult>();

  // Validate each student (can be parallelized if needed)
  const validationPromises = studentIds.map(async (studentId) => {
    const result = await validateReportCardData(studentId, termId);
    return { studentId, result };
  });

  const validations = await Promise.all(validationPromises);
  
  for (const { studentId, result } of validations) {
    results.set(studentId, result);
  }

  return results;
}

/**
 * Format validation error into human-readable message
 */
export function formatValidationError(result: ValidationResult): string {
  if (result.status === 'success') {
    return '';
  }

  const { reason, details } = result;

  switch (reason) {
    case 'STUDENT_NOT_FOUND':
      return 'Student record not found in the system.';
    
    case 'NOT_ENROLLED':
      return 'Student is not enrolled in any class for this term.';
    
    case 'RESULTS_NOT_PUBLISHED':
      return 'Results have not been published yet. Please publish results before generating report cards.';
    
    case 'MISSING_GRADING_SCHEME':
      return 'No grading scheme is configured for this class or campus. Please configure a grading scheme first.';
    
    case 'MISSING_SCORES':
      if (!details || details.length === 0) {
        return 'Some required scores are missing.';
      }
      
      const missingSubjects = details
        .map(d => d.subject)
        .filter(Boolean)
        .join(', ');
      
      return `Missing scores for the following subjects: ${missingSubjects}`;
    
    default:
      if (details && details.length > 0 && details[0].error) {
        return details[0].error;
      }
      return 'Unable to generate report card due to incomplete data.';
  }
}

/**
 * Get detailed validation error breakdown
 * Returns an array of error objects with specific details
 */
export function getDetailedValidationErrors(result: ValidationResult): ValidationError[] {
  if (result.status === 'success' || !result.details) {
    return [];
  }
  
  return result.details;
}

/**
 * Check if all validations passed for a batch
 */
export function allValidationsPassed(
  validations: Map<number, ValidationResult>
): boolean {
  for (const result of validations.values()) {
    if (result.status !== 'success') {
      return false;
    }
  }
  return true;
}

/**
 * Get summary of validation results
 */
export function getValidationSummary(
  validations: Map<number, ValidationResult>
): {
  total: number;
  passed: number;
  failed: number;
  failureReasons: Record<string, number>;
} {
  let passed = 0;
  let failed = 0;
  const failureReasons: Record<string, number> = {};

  for (const result of validations.values()) {
    if (result.status === 'success') {
      passed++;
    } else {
      failed++;
      if (result.reason) {
        failureReasons[result.reason] = (failureReasons[result.reason] || 0) + 1;
      }
    }
  }

  return {
    total: validations.size,
    passed,
    failed,
    failureReasons
  };
}
