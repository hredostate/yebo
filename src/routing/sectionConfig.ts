/**
 * Section Configuration
 * 
 * Defines metadata for each section including default routes, tabs, and pinned items.
 */

import { VIEWS } from '../constants';
import type { ReactNode } from 'react';

export interface SectionTab {
  id: string;
  label: string;
  path: string;
  permission?: string;
  view: string;
}

export interface PinnedItem {
  id: string;
  label: string;
  path: string;
  view: string;
  icon?: ReactNode;
}

export interface SectionConfig {
  id: string;
  title: string;
  path: string;
  defaultPath: string;
  defaultView: string;
  tabs: SectionTab[];
  maxVisibleTabs: number; // Number of tabs visible before "More" dropdown
  pinnedItems?: PinnedItem[];
  icon?: string;
}

/**
 * Section configurations
 * Each section has a default route, tabs for navigation, and optional pinned items
 */
export const SECTION_CONFIGS: Record<string, SectionConfig> = {
  workspace: {
    id: 'workspace',
    title: 'My Workspace',
    path: '/workspace',
    defaultPath: '/workspace/dashboard',
    defaultView: VIEWS.DASHBOARD,
    maxVisibleTabs: 5,
    tabs: [
      { id: 'dashboard', label: 'Dashboard', path: '/workspace/dashboard', view: VIEWS.DASHBOARD, permission: 'view-dashboard' },
      { id: 'tasks', label: 'My Tasks', path: '/workspace/tasks', view: VIEWS.TASK_BOARD, permission: 'manage-tasks' },
      { id: 'checkin', label: 'Daily Check-in', path: '/workspace/checkin', view: VIEWS.MY_CHECKIN, permission: 'view-dashboard' },
      { id: 'calendar', label: 'Calendar', path: '/workspace/calendar', view: VIEWS.CALENDAR, permission: 'manage-calendar' },
      { id: 'leave', label: 'My Leave', path: '/workspace/leave', view: VIEWS.MY_LEAVE, permission: 'view-dashboard' },
      { id: 'profile', label: 'My Profile', path: '/workspace/profile', view: VIEWS.PROFILE, permission: 'view-dashboard' },
    ],
  },
  
  communication: {
    id: 'communication',
    title: 'Communication',
    path: '/communication',
    defaultPath: '/communication/report-feed',
    defaultView: VIEWS.REPORT_FEED,
    maxVisibleTabs: 5,
    tabs: [
      { id: 'report-feed', label: 'Report Feed', path: '/communication/report-feed', view: VIEWS.REPORT_FEED, permission: 'view-all-reports' },
      { id: 'submit-report', label: 'Submit Report', path: '/communication/submit-report', view: VIEWS.SUBMIT_REPORT, permission: 'submit-report' },
      { id: 'bulletin', label: 'Bulletin Board', path: '/communication/bulletin', view: VIEWS.BULLETIN_BOARD, permission: 'view-dashboard' },
      { id: 'surveys', label: 'Surveys & Polls', path: '/communication/surveys', view: VIEWS.SURVEYS, permission: 'view-dashboard' },
      { id: 'emergency', label: 'Emergency Broadcast', path: '/communication/emergency-broadcast', view: VIEWS.EMERGENCY_BROADCAST, permission: 'send-emergency-broadcast' },
      { id: 'social-media', label: 'Social Media Hub', path: '/communication/social-media', view: VIEWS.SOCIAL_MEDIA_HUB, permission: 'manage-social-media' },
    ],
  },
  
  academics: {
    id: 'academics',
    title: 'Academics',
    path: '/academics',
    defaultPath: '/academics/lesson-plans',
    defaultView: VIEWS.LESSON_PLANNER,
    maxVisibleTabs: 5,
    tabs: [
      { id: 'lesson-plans', label: 'Lesson Plans', path: '/academics/lesson-plans', view: VIEWS.LESSON_PLANNER, permission: 'view-my-lesson-plans|manage-curriculum' },
      { id: 'timetable', label: 'Timetable', path: '/academics/timetable', view: VIEWS.TIMETABLE, permission: 'view-dashboard' },
      { id: 'gradebook', label: 'My Gradebook', path: '/academics/gradebook', view: VIEWS.GRADEBOOK, permission: 'score_entries.edit_self' },
      { id: 'assessments', label: 'Assessments', path: '/academics/assessments', view: VIEWS.ASSESSMENT_MANAGER, permission: 'score_entries.edit_self' },
      { id: 'result-manager', label: 'Result Manager', path: '/academics/result-manager', view: VIEWS.RESULT_MANAGER, permission: 'results.lock_and_publish' },
      { id: 'team-lesson-hub', label: 'Team Lesson Hub', path: '/academics/team-lesson-hub', view: VIEWS.TEAM_LESSON_HUB, permission: 'manage-curriculum' },
      { id: 'coverage-analytics', label: 'Coverage Analytics', path: '/academics/coverage-analytics', view: VIEWS.COVERAGE_ANALYTICS, permission: 'manage-curriculum' },
      { id: 'homework', label: 'Homework Manager', path: '/academics/homework', view: VIEWS.HOMEWORK_MANAGER, permission: 'view-my-lesson-plans|manage-curriculum' },
      { id: 'class-groups', label: 'Class Groups', path: '/academics/class-groups', view: VIEWS.CLASSES_ATTENDANCE, permission: 'take-class-attendance|manage-class-groups' },
      { id: 'curriculum-map', label: 'Curriculum Map', path: '/academics/curriculum-map', view: VIEWS.CURRICULUM_MANAGER, permission: 'view-curriculum-readonly|manage-curriculum' },
    ],
  },
  
  'student-affairs': {
    id: 'student-affairs',
    title: 'Student Affairs',
    path: '/student-affairs',
    defaultPath: '/student-affairs/student-roster',
    defaultView: VIEWS.STUDENT_ROSTER,
    maxVisibleTabs: 5,
    tabs: [
      { id: 'student-roster', label: 'Student Roster', path: '/student-affairs/student-roster', view: VIEWS.STUDENT_ROSTER, permission: 'manage-students' },
      { id: 'student-accounts', label: 'Student Accounts', path: '/student-affairs/student-accounts', view: VIEWS.STUDENT_ACCOUNTS, permission: 'manage-students' },
      { id: 'parent-accounts', label: 'Parent Accounts', path: '/student-affairs/parent-accounts', view: VIEWS.PARENT_ACCOUNTS, permission: 'manage-students' },
      { id: 'intervention-plans', label: 'Intervention Plans', path: '/student-affairs/intervention-plans', view: VIEWS.INTERVENTION_PLANS, permission: 'manage-students' },
      { id: 'absence-requests', label: 'Absence Requests', path: '/student-affairs/absence-requests', view: VIEWS.ABSENCE_REQUESTS, permission: 'view-dashboard' },
      { id: 'subject-choices', label: 'Subject Choices', path: '/student-affairs/subject-choices', view: VIEWS.STUDENT_SUBJECT_CHOICES_ADMIN, permission: 'manage-students' },
      { id: 'id-cards', label: 'ID Card Generator', path: '/student-affairs/id-cards', view: VIEWS.ID_CARDS, permission: 'manage-students' },
      { id: 'rewards-store', label: 'Rewards Store', path: '/student-affairs/rewards-store', view: VIEWS.REWARDS_STORE, permission: 'manage-students' },
    ],
  },
  
  transport: {
    id: 'transport',
    title: 'Transport',
    path: '/transport',
    defaultPath: '/transport/transport-manager',
    defaultView: VIEWS.TRANSPORT_MANAGER,
    maxVisibleTabs: 3, // Transport has only 3 tabs, no More unless needed
    tabs: [
      { id: 'transport-manager', label: 'Transport Manager', path: '/transport/transport-manager', view: VIEWS.TRANSPORT_MANAGER, permission: 'transport.routes.manage' },
      { id: 'groups', label: 'My Transport Groups', path: '/transport/groups', view: VIEWS.TEACHER_TRANSPORT_GROUPS, permission: 'transport.attendance.mark' },
      { id: 'attendance', label: 'Transport Attendance', path: '/transport/attendance', view: VIEWS.TEACHER_TRANSPORT_ATTENDANCE, permission: 'transport.attendance.mark' },
    ],
  },
  
  hr: {
    id: 'hr',
    title: 'HR & Staff',
    path: '/hr',
    defaultPath: '/hr/user-directory',
    defaultView: VIEWS.USER_MANAGEMENT,
    maxVisibleTabs: 5,
    tabs: [
      { id: 'user-directory', label: 'User Directory', path: '/hr/user-directory', view: VIEWS.USER_MANAGEMENT, permission: 'manage-users' },
      { id: 'roles', label: 'Roles & Access', path: '/hr/roles', view: VIEWS.ROLE_MANAGEMENT, permission: 'manage-roles' },
      { id: 'team-hub', label: 'Team Hub', path: '/hr/team-hub', view: VIEWS.TEAM_HUB, permission: 'manage-teams' },
      { id: 'attendance-monitor', label: 'Attendance Monitor', path: '/hr/attendance-monitor', view: VIEWS.TEACHER_ATTENDANCE, permission: 'view-teacher-attendance' },
      { id: 'teacher-ratings', label: 'Teacher Ratings', path: '/hr/teacher-ratings', view: VIEWS.TEACHER_RATINGS, permission: 'view-teacher-ratings' },
      { id: 'teacher-pulse', label: 'Teacher Pulse', path: '/hr/teacher-pulse', view: VIEWS.TEACHER_PULSE, permission: 'view-dashboard' },
      { id: 'leave-approvals', label: 'Leave Approvals', path: '/hr/leave-approvals', view: VIEWS.LEAVE_APPROVALS, permission: 'manage-users' },
      { id: 'manuals', label: 'Manuals', path: '/hr/manuals', view: VIEWS.MANUALS, permission: 'view-dashboard' },
    ],
  },
  
  finance: {
    id: 'finance',
    title: 'Finance & Ops',
    path: '/finance',
    defaultPath: '/finance/fees',
    defaultView: VIEWS.STUDENT_FINANCE,
    maxVisibleTabs: 5,
    tabs: [
      { id: 'fees', label: 'Bursary (Fees)', path: '/finance/fees', view: VIEWS.STUDENT_FINANCE, permission: 'manage-finance' },
      { id: 'payroll', label: 'HR & Payroll', path: '/finance/payroll', view: VIEWS.HR_PAYROLL, permission: 'view-dashboard' },
      { id: 'store', label: 'School Store', path: '/finance/store', view: VIEWS.STOREFRONT, permission: 'view-dashboard' },
      { id: 'store-manager', label: 'Store Manager', path: '/finance/store-manager', view: VIEWS.STORE_MANAGER, permission: 'manage-orders' },
      { id: 'compliance', label: 'Compliance Tracker', path: '/finance/compliance', view: VIEWS.COMPLIANCE_TRACKER, permission: 'view-compliance-tracker' },
      { id: 'support', label: 'Support Hub', path: '/finance/support', view: VIEWS.SUPPORT_HUB, permission: 'manage-tasks' },
      { id: 'survey-manager', label: 'Survey Manager', path: '/finance/survey-manager', view: VIEWS.SURVEY_MANAGER, permission: 'manage-surveys' },
    ],
  },
  
  admin: {
    id: 'admin',
    title: 'Administration',
    path: '/admin',
    defaultPath: '/admin/global-settings',
    defaultView: VIEWS.SETTINGS,
    maxVisibleTabs: 5,
    tabs: [
      { id: 'global-settings', label: 'Global Settings', path: '/admin/global-settings', view: VIEWS.SETTINGS, permission: 'manage-settings' },
      { id: 'super-admin', label: 'Super Admin Console', path: '/admin/super-admin', view: VIEWS.SUPER_ADMIN_CONSOLE, permission: 'school.console.view' },
      { id: 'ai-strategic-center', label: 'AI Strategic Center', path: '/admin/ai-strategic-center', view: VIEWS.AI_STRATEGIC_CENTER, permission: 'view-school-health-overview' },
      { id: 'predictive-analytics', label: 'Predictive Analytics', path: '/admin/predictive-analytics', view: VIEWS.PREDICTIVE_ANALYTICS, permission: 'view-predictive-analytics' },
      { id: 'analytics', label: 'Analytics Dashboard', path: '/admin/analytics', view: VIEWS.ANALYTICS, permission: 'view-analytics' },
      { id: 'data-upload', label: 'Data Upload', path: '/admin/data-upload', view: VIEWS.DATA_UPLOAD, permission: 'access-data-uploader' },
      { id: 'policy-query', label: 'Policy Query', path: '/admin/policy-query', view: VIEWS.POLICY_QUERY, permission: 'query-living-policy' },
      { id: 'campus-stats', label: 'Campus Statistics', path: '/admin/campus-stats', view: VIEWS.CAMPUS_STATISTICS, permission: 'view-campus-stats' },
    ],
  },
};

/**
 * Get section configuration by ID
 */
export function getSectionConfig(sectionId: string): SectionConfig | undefined {
  return SECTION_CONFIGS[sectionId];
}

/**
 * Get all section IDs
 */
export function getAllSectionIds(): string[] {
  return Object.keys(SECTION_CONFIGS);
}

/**
 * Get visible tabs for a section based on max visible tabs configuration
 */
export function getVisibleTabs(sectionId: string): SectionTab[] {
  const config = SECTION_CONFIGS[sectionId];
  if (!config) return [];
  return config.tabs.slice(0, config.maxVisibleTabs);
}

/**
 * Get overflow tabs (those that should appear in "More" dropdown)
 */
export function getOverflowTabs(sectionId: string): SectionTab[] {
  const config = SECTION_CONFIGS[sectionId];
  if (!config) return [];
  return config.tabs.slice(config.maxVisibleTabs);
}

/**
 * Check if section needs a "More" dropdown
 */
export function needsMoreDropdown(sectionId: string): boolean {
  const config = SECTION_CONFIGS[sectionId];
  if (!config) return false;
  return config.tabs.length > config.maxVisibleTabs;
}

/**
 * Filter tabs based on user permissions
 */
export function filterTabsByPermissions(
  tabs: SectionTab[],
  userPermissions: string[]
): SectionTab[] {
  return tabs.filter(tab => {
    if (!tab.permission) return true;
    
    // Support OR permissions (separated by |)
    const requiredPermissions = tab.permission.split('|');
    return requiredPermissions.some(perm => userPermissions.includes(perm.trim()));
  });
}
