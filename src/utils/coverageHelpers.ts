import type { LessonPlanCoverage, CoverageStatus } from '../types';

/**
 * Computes the overall derived coverage status for a lesson plan based on its coverage records
 * from the lesson_plan_coverage table.
 * 
 * This is the single source of truth for lesson plan coverage status.
 * 
 * @param coverageRecords - Array of coverage records for a lesson plan
 * @returns Derived coverage status
 */
export function computeDerivedCoverageStatus(coverageRecords: LessonPlanCoverage[]): CoverageStatus {
  if (coverageRecords.length === 0) {
    return 'Pending';
  }
  
  const statuses = coverageRecords.map(r => r.coverage_status);
  
  // If all are fully covered
  if (statuses.every(s => s === 'Fully Covered')) {
    return 'Fully Covered';
  }
  
  // If any is not covered
  if (statuses.some(s => s === 'Not Covered')) {
    return 'Not Covered';
  }
  
  // If any is partially covered or some are fully covered (mixed state)
  if (statuses.some(s => s === 'Partially Covered')) {
    return 'Partially Covered';
  }
  
  // If some are fully covered but not all (mixed with not_started or Pending)
  if (statuses.some(s => s === 'Fully Covered')) {
    return 'Partially Covered';
  }
  
  // All remaining must be either not_started or Pending (no progress yet)
  return 'Pending';
}

/**
 * Gets coverage records for a specific lesson plan
 * @param lessonPlanId - The ID of the lesson plan
 * @param allCoverageRecords - All coverage records
 * @returns Coverage records for the specified lesson plan
 */
export function getCoverageRecordsForPlan(
  lessonPlanId: number,
  allCoverageRecords: LessonPlanCoverage[]
): LessonPlanCoverage[] {
  return allCoverageRecords.filter(c => c.lesson_plan_id === lessonPlanId);
}

/**
 * Gets the derived coverage status for a specific lesson plan
 * @param lessonPlanId - The ID of the lesson plan
 * @param allCoverageRecords - All coverage records
 * @returns Derived coverage status
 */
export function getDerivedCoverageStatus(
  lessonPlanId: number,
  allCoverageRecords: LessonPlanCoverage[]
): CoverageStatus {
  const records = getCoverageRecordsForPlan(lessonPlanId, allCoverageRecords);
  return computeDerivedCoverageStatus(records);
}
