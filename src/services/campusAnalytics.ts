/**
 * Campus Analytics Service
 * Provides comprehensive statistics and reporting by campus
 */

import { supabase } from './supabaseClient';
import type { Student, UserProfile, StudentInvoice, Payment, Campus } from '../types';
import { StudentStatus } from '../types';

export interface CampusStudentStats {
  campusId: number | null;
  campusName: string;
  totalStudents: number;
  activeStudents: number;
  suspendedStudents: number;
  expelledStudents: number;
  graduatedStudents: number;
  withdrawnStudents: number;
  neverLoggedIn: number;
  withActiveAccounts: number;
  statusBreakdown: {
    [key: string]: number;
  };
}

export interface CampusUserStats {
  campusId: number | null;
  campusName: string;
  totalUsers: number;
  activeUsers: number; // Logged in within last 30 days
  neverLoggedIn: number;
  deactivatedUsers: number;
  roleBreakdown: {
    [role: string]: number;
  };
}

export interface CampusFinancialStats {
  campusId: number | null;
  campusName: string;
  totalInvoices: number;
  totalExpected: number;
  totalCollected: number;
  totalOutstanding: number;
  feesOwedByGraduated: number;
  feesOwedByExpelled: number;
  feesOwedByNonActive: number;
  collectionRate: number; // Percentage
}

export interface CampusOtherStats {
  campusId: number | null;
  campusName: string;
  attendanceRate: number;
  reportCount: number;
  taskCompletionRate: number;
  studentToStaffRatio: number;
}

export interface CampusStats {
  studentStats: CampusStudentStats;
  userStats: CampusUserStats;
  financialStats: CampusFinancialStats;
  otherStats: CampusOtherStats;
}

/**
 * Get all campuses for a school
 */
export const getCampuses = async (schoolId: number): Promise<Campus[]> => {
  const { data, error } = await supabase
    .from('campuses')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');

  if (error) {
    console.error('Error fetching campuses:', error);
    return [];
  }

  return data || [];
};

/**
 * Calculate student statistics for a specific campus
 */
export const calculateStudentStats = async (
  schoolId: number,
  campusId?: number | null
): Promise<CampusStudentStats> => {
  // Build query
  let query = supabase
    .from('students')
    .select('*, student_profiles(id)')
    .eq('school_id', schoolId);

  if (campusId !== undefined) {
    if (campusId === null) {
      query = query.is('campus_id', null);
    } else {
      query = query.eq('campus_id', campusId);
    }
  }

  const { data: students, error } = await query;

  if (error) {
    console.error('Error fetching students:', error);
    throw error;
  }

  const campusName = campusId !== null && campusId !== undefined ? await getCampusName(campusId) : 'No Campus';
  const totalStudents = students?.length || 0;

  // Count by status
  const statusBreakdown: { [key: string]: number } = {};
  let activeStudents = 0;
  let suspendedStudents = 0;
  let expelledStudents = 0;
  let graduatedStudents = 0;
  let withdrawnStudents = 0;
  let neverLoggedIn = 0;
  let withActiveAccounts = 0;

  students?.forEach((student: any) => {
    const status = student.status || 'Active';
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

    if (status === StudentStatus.Active) activeStudents++;
    if (status === StudentStatus.DisciplinarySuspension || status === StudentStatus.FinancialSuspension) {
      suspendedStudents++;
    }
    if (status === StudentStatus.Expelled) expelledStudents++;
    if (status === StudentStatus.Graduated) graduatedStudents++;
    if (status === StudentStatus.Withdrawn) withdrawnStudents++;

    // Check if student has account
    if (student.user_id && student.student_profiles && student.student_profiles.length > 0) {
      withActiveAccounts++;
    } else if (!student.user_id) {
      neverLoggedIn++;
    }
  });

  return {
    campusId: campusId || null,
    campusName,
    totalStudents,
    activeStudents,
    suspendedStudents,
    expelledStudents,
    graduatedStudents,
    withdrawnStudents,
    neverLoggedIn,
    withActiveAccounts,
    statusBreakdown,
  };
};

/**
 * Calculate user/staff statistics for a specific campus
 */
export const calculateUserStats = async (
  schoolId: number,
  campusId?: number | null
): Promise<CampusUserStats> => {
  // Build query
  let query = supabase
    .from('user_profiles')
    .select('*')
    .eq('school_id', schoolId)
    .neq('role', 'Student'); // Exclude student accounts

  if (campusId !== undefined) {
    if (campusId === null) {
      query = query.is('campus_id', null);
    } else {
      query = query.eq('campus_id', campusId);
    }
  }

  const { data: users, error } = await query;

  if (error) {
    console.error('Error fetching users:', error);
    throw error;
  }

  const campusName = campusId !== null && campusId !== undefined ? await getCampusName(campusId) : 'No Campus';
  const totalUsers = users?.length || 0;

  // Get last login data from auth.users
  const userIds = users?.map(u => u.id) || [];

  // Note: Tracking active users and never logged in requires additional database fields
  // In production, you would add last_login_at to user_profiles or query auth.users
  // For now, we return 0 as placeholders

  // Role breakdown
  const roleBreakdown: { [role: string]: number } = {};
  users?.forEach((user: UserProfile) => {
    roleBreakdown[user.role] = (roleBreakdown[user.role] || 0) + 1;
  });

  return {
    campusId: campusId || null,
    campusName,
    totalUsers,
    activeUsers: 0, // Placeholder - requires last_login tracking in database
    neverLoggedIn: 0, // Placeholder - requires last_login tracking in database
    deactivatedUsers: 0, // Placeholder - requires a deactivated flag in database
    roleBreakdown,
  };
};

/**
 * Calculate financial statistics for a specific campus
 */
export const calculateFinancialStats = async (
  schoolId: number,
  campusId?: number | null,
  termId?: number
): Promise<CampusFinancialStats> => {
  // First get students for this campus
  let studentQuery = supabase
    .from('students')
    .select('id, status, campus_id')
    .eq('school_id', schoolId);

  if (campusId !== undefined) {
    if (campusId === null) {
      studentQuery = studentQuery.is('campus_id', null);
    } else {
      studentQuery = studentQuery.eq('campus_id', campusId);
    }
  }

  const { data: students, error: studentsError } = await studentQuery;

  if (studentsError) {
    console.error('Error fetching students:', studentsError);
    throw studentsError;
  }

  const studentIds = students?.map(s => s.id) || [];
  const campusName = campusId !== null && campusId !== undefined ? await getCampusName(campusId) : 'No Campus';

  if (studentIds.length === 0) {
    return {
      campusId: campusId || null,
      campusName,
      totalInvoices: 0,
      totalExpected: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      feesOwedByGraduated: 0,
      feesOwedByExpelled: 0,
      feesOwedByNonActive: 0,
      collectionRate: 0,
    };
  }

  // Get invoices for these students
  let invoiceQuery = supabase
    .from('student_invoices')
    .select('*, student:students(id, status)')
    .eq('school_id', schoolId)
    .in('student_id', studentIds);

  if (termId) {
    invoiceQuery = invoiceQuery.eq('term_id', termId);
  }

  const { data: invoices, error: invoicesError } = await invoiceQuery;

  if (invoicesError) {
    console.error('Error fetching invoices:', invoicesError);
    throw invoicesError;
  }

  const totalInvoices = invoices?.length || 0;
  let totalExpected = 0;
  let totalCollected = 0;
  let feesOwedByGraduated = 0;
  let feesOwedByExpelled = 0;
  let feesOwedByNonActive = 0;

  invoices?.forEach((invoice: any) => {
    const expected = invoice.total_amount || 0;
    const paid = invoice.amount_paid || 0;
    const outstanding = expected - paid;

    totalExpected += expected;
    totalCollected += paid;

    if (outstanding > 0 && invoice.student) {
      const status = invoice.student.status || 'Active';
      if (status === StudentStatus.Graduated) {
        feesOwedByGraduated += outstanding;
      }
      if (status === StudentStatus.Expelled) {
        feesOwedByExpelled += outstanding;
      }
      if (status === StudentStatus.Withdrawn || status === StudentStatus.Transferred) {
        feesOwedByNonActive += outstanding;
      }
    }
  });

  const totalOutstanding = totalExpected - totalCollected;
  const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

  return {
    campusId: campusId || null,
    campusName,
    totalInvoices,
    totalExpected,
    totalCollected,
    totalOutstanding,
    feesOwedByGraduated,
    feesOwedByExpelled,
    feesOwedByNonActive,
    collectionRate,
  };
};

/**
 * Calculate other statistics (attendance, reports, tasks, ratios)
 */
export const calculateOtherStats = async (
  schoolId: number,
  campusId?: number | null
): Promise<CampusOtherStats> => {
  const campusName = campusId !== null && campusId !== undefined ? await getCampusName(campusId) : 'No Campus';

  // Get student count for ratio calculation
  const studentStats = await calculateStudentStats(schoolId, campusId);
  const userStats = await calculateUserStats(schoolId, campusId);

  const studentToStaffRatio = userStats.totalUsers > 0
    ? studentStats.totalStudents / userStats.totalUsers
    : 0;

  // These would require additional queries to actual attendance and report tables
  // For now, returning placeholder values
  return {
    campusId: campusId || null,
    campusName,
    attendanceRate: 0, // Would need attendance data
    reportCount: 0, // Would need to query reports table
    taskCompletionRate: 0, // Would need to query tasks table
    studentToStaffRatio,
  };
};

/**
 * Get comprehensive statistics for a campus
 */
export const getCampusStats = async (
  schoolId: number,
  campusId?: number | null,
  termId?: number
): Promise<CampusStats> => {
  const [studentStats, userStats, financialStats, otherStats] = await Promise.all([
    calculateStudentStats(schoolId, campusId),
    calculateUserStats(schoolId, campusId),
    calculateFinancialStats(schoolId, campusId, termId),
    calculateOtherStats(schoolId, campusId),
  ]);

  return {
    studentStats,
    userStats,
    financialStats,
    otherStats,
  };
};

/**
 * Get statistics for all campuses
 */
export const getAllCampusesStats = async (
  schoolId: number,
  termId?: number
): Promise<CampusStats[]> => {
  const campuses = await getCampuses(schoolId);
  
  // Include stats for students with no campus assigned
  const allCampusIds = [...campuses.map(c => c.id), null];

  const statsPromises = allCampusIds.map(campusId =>
    getCampusStats(schoolId, campusId, termId)
  );

  return await Promise.all(statsPromises);
};

/**
 * Helper function to get campus name by ID
 */
const getCampusName = async (campusId: number): Promise<string> => {
  const { data, error } = await supabase
    .from('campuses')
    .select('name')
    .eq('id', campusId)
    .single();

  if (error || !data) {
    return `Campus #${campusId}`;
  }

  return data.name;
};

/**
 * Export data to CSV format
 */
export const exportToCSV = (stats: CampusStats[]): string => {
  const headers = [
    'Campus',
    'Total Students',
    'Active Students',
    'Total Staff',
    'Total Expected (₦)',
    'Total Collected (₦)',
    'Outstanding (₦)',
    'Collection Rate (%)',
    'Student-Staff Ratio',
  ];

  const rows = stats.map(stat => [
    stat.studentStats.campusName,
    stat.studentStats.totalStudents,
    stat.studentStats.activeStudents,
    stat.userStats.totalUsers,
    stat.financialStats.totalExpected.toFixed(2),
    stat.financialStats.totalCollected.toFixed(2),
    stat.financialStats.totalOutstanding.toFixed(2),
    stat.financialStats.collectionRate.toFixed(2),
    stat.otherStats.studentToStaffRatio.toFixed(2),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  return csvContent;
};
