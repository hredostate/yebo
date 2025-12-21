/**
 * Student Subject Choice Service
 * Handles locking/unlocking of student subject selections
 * and enforcing elective subject capacity limits
 */

import { requireSupabaseClient } from './supabaseClient';

export interface LockResult {
  success: boolean;
  message: string;
  affectedCount?: number;
}

export interface ElectiveCapacityInfo {
  subjectId: number;
  subjectName: string;
  currentEnrollment: number;
  maxStudents: number | null; // null means unlimited
  isAtCapacity: boolean;
  isFull: boolean;
}

/**
 * Lock a student's subject choices
 * @param studentId - The student ID
 * @param adminId - Optional admin user ID who is locking (null means auto-lock by student)
 * @returns Promise with success status and message
 */
export async function lockStudentChoices(
  studentId: number,
  adminId?: string
): Promise<LockResult> {
  try {
    const supabase = requireSupabaseClient();
    
    // Update all choices for this student to locked
    const { error, count } = await supabase
      .from('student_subject_choices')
      .update({
        locked: true,
        locked_at: new Date().toISOString(),
        locked_by: adminId || null
      })
      .eq('student_id', studentId)
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error locking student choices:', error);
      return {
        success: false,
        message: `Failed to lock choices: ${error.message}`
      };
    }
    
    return {
      success: true,
      message: `Successfully locked ${count || 0} subject choice(s)`,
      affectedCount: count || 0
    };
  } catch (error: any) {
    console.error('Error in lockStudentChoices:', error);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Unlock a student's subject choices
 * @param studentId - The student ID
 * @param adminId - Admin user ID who is unlocking
 * @returns Promise with success status and message
 */
export async function unlockStudentChoices(
  studentId: number,
  adminId: string
): Promise<LockResult> {
  try {
    const supabase = requireSupabaseClient();
    
    // Update all choices for this student to unlocked
    const { error, count } = await supabase
      .from('student_subject_choices')
      .update({
        locked: false,
        locked_at: null,
        locked_by: adminId // Track who unlocked it
      })
      .eq('student_id', studentId)
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error unlocking student choices:', error);
      return {
        success: false,
        message: `Failed to unlock choices: ${error.message}`
      };
    }
    
    return {
      success: true,
      message: `Successfully unlocked ${count || 0} subject choice(s)`,
      affectedCount: count || 0
    };
  } catch (error: any) {
    console.error('Error in unlockStudentChoices:', error);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Lock subject choices for multiple students (bulk operation)
 * @param studentIds - Array of student IDs
 * @param adminId - Optional admin user ID (null means auto-lock)
 * @returns Promise with success status and message
 */
export async function bulkLockChoices(
  studentIds: number[],
  adminId?: string
): Promise<LockResult> {
  try {
    if (studentIds.length === 0) {
      return {
        success: false,
        message: 'No students selected'
      };
    }
    
    const supabase = requireSupabaseClient();
    
    // Bulk update for all selected students
    const { error, count } = await supabase
      .from('student_subject_choices')
      .update({
        locked: true,
        locked_at: new Date().toISOString(),
        locked_by: adminId || null
      })
      .in('student_id', studentIds)
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error bulk locking choices:', error);
      return {
        success: false,
        message: `Failed to lock choices: ${error.message}`
      };
    }
    
    return {
      success: true,
      message: `Successfully locked choices for ${studentIds.length} student(s) (${count || 0} total choice records)`,
      affectedCount: count || 0
    };
  } catch (error: any) {
    console.error('Error in bulkLockChoices:', error);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Unlock subject choices for multiple students (bulk operation)
 * @param studentIds - Array of student IDs
 * @param adminId - Admin user ID who is unlocking
 * @returns Promise with success status and message
 */
export async function bulkUnlockChoices(
  studentIds: number[],
  adminId: string
): Promise<LockResult> {
  try {
    if (studentIds.length === 0) {
      return {
        success: false,
        message: 'No students selected'
      };
    }
    
    const supabase = requireSupabaseClient();
    
    // Bulk update for all selected students
    const { error, count } = await supabase
      .from('student_subject_choices')
      .update({
        locked: false,
        locked_at: null,
        locked_by: adminId
      })
      .in('student_id', studentIds)
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error bulk unlocking choices:', error);
      return {
        success: false,
        message: `Failed to unlock choices: ${error.message}`
      };
    }
    
    return {
      success: true,
      message: `Successfully unlocked choices for ${studentIds.length} student(s) (${count || 0} total choice records)`,
      affectedCount: count || 0
    };
  } catch (error: any) {
    console.error('Error in bulkUnlockChoices:', error);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Get the lock status for a student's subject choices
 * @param studentId - The student ID
 * @returns Promise with lock status (true if any choice is locked)
 */
export async function getStudentChoicesLockStatus(
  studentId: number
): Promise<boolean> {
  try {
    const supabase = requireSupabaseClient();
    
    // Check if any of the student's choices are locked
    const { data, error } = await supabase
      .from('student_subject_choices')
      .select('locked')
      .eq('student_id', studentId)
      .limit(1);
    
    if (error) {
      console.error('Error checking lock status:', error);
      return false;
    }
    
    // If student has any choice and at least one is locked, consider them locked
    return data && data.length > 0 ? (data[0].locked || false) : false;
  } catch (error: any) {
    console.error('Error in getStudentChoicesLockStatus:', error);
    return false;
  }
}

/**
 * Get elective subject capacity information for a class/arm
 * @param classId - The class ID
 * @param armId - Optional arm ID
 * @param schoolId - School ID
 * @returns Promise with array of elective capacity info
 */
export async function getElectiveCapacityInfo(
  classId: number,
  armId: number | null,
  schoolId: number
): Promise<ElectiveCapacityInfo[]> {
  try {
    const supabase = requireSupabaseClient();
    
    // Get all elective subjects for this class
    const { data: electiveSubjects, error: subjectsError } = await supabase
      .from('class_subjects')
      .select('subject_id, subjects(id, name)')
      .eq('class_id', classId)
      .eq('is_compulsory', false);
    
    if (subjectsError) {
      console.error('Error fetching elective subjects:', subjectsError);
      return [];
    }
    
    if (!electiveSubjects || electiveSubjects.length === 0) {
      return [];
    }
    
    const capacityInfo: ElectiveCapacityInfo[] = [];
    
    for (const elective of electiveSubjects) {
      const subjectId = elective.subject_id;
      const subjectName = (elective.subjects as any)?.name || 'Unknown';
      
      // Get the limit for this elective
      const { data: limitData } = await supabase
        .from('elective_subject_limits')
        .select('max_students')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .eq('subject_id', subjectId)
        .eq('arm_id', armId)
        .maybeSingle();
      
      const maxStudents = limitData?.max_students || null;
      
      // Get current enrollment count using the database function
      const { data: countData, error: countError } = await supabase
        .rpc('get_elective_enrollment_count', {
          p_subject_id: subjectId,
          p_class_id: classId,
          p_arm_id: armId
        });
      
      const currentEnrollment = countError ? 0 : (countData || 0);
      
      // Check if at capacity
      const isAtCapacity = maxStudents !== null && currentEnrollment >= maxStudents;
      
      capacityInfo.push({
        subjectId,
        subjectName,
        currentEnrollment,
        maxStudents,
        isAtCapacity,
        isFull: isAtCapacity
      });
    }
    
    return capacityInfo;
  } catch (error: any) {
    console.error('Error in getElectiveCapacityInfo:', error);
    return [];
  }
}

/**
 * Check if a student can select a specific elective subject
 * @param studentId - The student ID
 * @param subjectId - The subject ID to check
 * @param classId - The class ID
 * @param armId - Optional arm ID
 * @returns Promise with boolean indicating if selection is allowed
 */
export async function canSelectElective(
  studentId: number,
  subjectId: number,
  classId: number,
  armId: number | null
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const supabase = requireSupabaseClient();
    
    // Check if student already has this subject selected
    const { data: existing } = await supabase
      .from('student_subject_choices')
      .select('id')
      .eq('student_id', studentId)
      .eq('subject_id', subjectId)
      .maybeSingle();
    
    // If already selected, they can keep it (allowed)
    if (existing) {
      return { allowed: true, reason: 'Already selected' };
    }
    
    // Check if subject is at capacity using database function
    const { data: isAtCapacity, error } = await supabase
      .rpc('is_elective_at_capacity', {
        p_subject_id: subjectId,
        p_class_id: classId,
        p_arm_id: armId
      });
    
    if (error) {
      console.error('Error checking capacity:', error);
      return { allowed: true, reason: 'Error checking capacity, allowing selection' };
    }
    
    if (isAtCapacity) {
      return { allowed: false, reason: 'Subject is at full capacity' };
    }
    
    return { allowed: true };
  } catch (error: any) {
    console.error('Error in canSelectElective:', error);
    return { allowed: true, reason: 'Error occurred, allowing selection by default' };
  }
}
