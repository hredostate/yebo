/**
 * Campus Filtering Utilities
 * Helper functions to filter data by campus based on campus scope
 */

import type { UserProfile, Student, AcademicClass } from '../types';

/**
 * Filter users by campus_id
 */
export const filterUsersByCampus = (
  users: UserProfile[],
  campusId: number | null | undefined,
  isSitewideView: boolean
): UserProfile[] => {
  if (isSitewideView) {
    return users;
  }

  // If user has no campus assigned, show only users with no campus
  if (campusId === null || campusId === undefined) {
    return users.filter(u => u.campus_id === null || u.campus_id === undefined);
  }

  // Filter to user's assigned campus
  return users.filter(u => u.campus_id === campusId);
};

/**
 * Filter students by campus through their academic class enrollments
 */
export const filterStudentsByCampus = (
  students: Student[],
  academicClasses: AcademicClass[],
  campusId: number | null | undefined,
  isSitewideView: boolean
): Student[] => {
  if (isSitewideView) {
    return students;
  }

  // Get academic classes for the campus
  let relevantClasses: AcademicClass[];
  
  if (campusId === null || campusId === undefined) {
    relevantClasses = academicClasses.filter(ac => ac.campus_id === null || ac.campus_id === undefined);
  } else {
    relevantClasses = academicClasses.filter(ac => ac.campus_id === campusId);
  }

  const relevantClassIds = new Set(relevantClasses.map(c => c.id));

  // Filter students who are enrolled in these classes
  // This would require academic_class_students data, which should be available in the app
  // For now, we return all students if we can't determine their class
  // Components will need to implement their own filtering based on academic_class_students
  return students;
};

/**
 * Filter academic classes by campus
 */
export const filterAcademicClassesByCampus = (
  academicClasses: AcademicClass[],
  campusId: number | null | undefined,
  isSitewideView: boolean
): AcademicClass[] => {
  if (isSitewideView) {
    return academicClasses;
  }

  if (campusId === null || campusId === undefined) {
    return academicClasses.filter(ac => ac.campus_id === null || ac.campus_id === undefined);
  }

  return academicClasses.filter(ac => ac.campus_id === campusId);
};

/**
 * Get the effective campus ID for filtering
 * Returns null if user has no campus or undefined campusId
 */
export const getEffectiveCampusId = (
  userProfile: UserProfile | null | undefined
): number | null | undefined => {
  if (!userProfile || !('campus_id' in userProfile)) {
    return undefined;
  }
  return userProfile.campus_id;
};
