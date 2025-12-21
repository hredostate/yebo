import { requireSupabaseClient } from '../services/supabaseClient';

interface GradeResult {
  grade_label: string;
  remark: string;
  gpa_value: number;
}

/**
 * Compute grade using the server-side compute_grade RPC function.
 * This is the single source of truth for grade calculation.
 * 
 * @param score - The score to compute grade for
 * @param gradingSchemeId - The grading scheme ID to use
 * @param subjectName - Optional subject name for subject-specific overrides
 * @returns Grade result with label, remark, and GPA value
 */
export async function computeGrade(
  score: number,
  gradingSchemeId: number,
  subjectName?: string
): Promise<GradeResult> {
  const supabase = requireSupabaseClient();
  
  const { data, error } = await supabase.rpc('compute_grade', {
    p_score: score,
    p_grading_scheme_id: gradingSchemeId,
    p_subject_name: subjectName ?? null
  });
  
  if (error) {
    console.error('Error computing grade:', error);
    return { grade_label: 'N/A', remark: '', gpa_value: 0 };
  }
  
  return data as GradeResult;
}

/**
 * Batch compute grades for multiple scores.
 * More efficient than calling computeGrade multiple times.
 * 
 * @param scores - Array of scores with optional subject names
 * @param gradingSchemeId - The grading scheme ID to use
 * @returns Array of grade results
 */
export async function computeGradesBatch(
  scores: Array<{ score: number; subjectName?: string }>,
  gradingSchemeId: number
): Promise<GradeResult[]> {
  // For now, call individually - could be optimized with a batch RPC later
  return Promise.all(
    scores.map(({ score, subjectName }) => 
      computeGrade(score, gradingSchemeId, subjectName)
    )
  );
}
