/**
 * Route-View Mapping Module
 * 
 * Provides bidirectional mapping between React Router paths and existing VIEWS constants
 * to maintain backward compatibility during incremental migration.
 */

import { VIEWS } from '../constants.js';

/**
 * Map of VIEWS constants to their corresponding route paths
 * This serves as the single source of truth for navigation
 */
export const VIEW_TO_PATH: Record<string, string> = {
  // Workspace
  [VIEWS.DASHBOARD]: '/workspace/dashboard',
  [VIEWS.TASK_BOARD]: '/workspace/tasks',
  [VIEWS.MY_CHECKIN]: '/workspace/checkin',
  [VIEWS.CALENDAR]: '/workspace/calendar',
  [VIEWS.MY_LEAVE]: '/workspace/leave',
  [VIEWS.PROFILE]: '/workspace/profile',
  [VIEWS.TEACHING_WORKSPACE]: '/workspace/teaching',
  
  // Communication
  [VIEWS.SUBMIT_REPORT]: '/communication/submit-report',
  [VIEWS.REPORT_FEED]: '/communication/report-feed',
  [VIEWS.BULLETIN_BOARD]: '/communication/bulletin',
  [VIEWS.SURVEYS]: '/communication/surveys',
  [VIEWS.EMERGENCY_BROADCAST]: '/communication/emergency-broadcast',
  [VIEWS.SOCIAL_MEDIA_HUB]: '/communication/social-media',
  
  // Academics
  [VIEWS.TIMETABLE]: '/academics/timetable',
  [VIEWS.LESSON_PLANNER]: '/academics/lesson-plans',
  [VIEWS.TEAM_LESSON_HUB]: '/academics/team-lesson-hub',
  [VIEWS.COVERAGE_ANALYTICS]: '/academics/coverage-analytics',
  [VIEWS.HOMEWORK_MANAGER]: '/academics/homework',
  [VIEWS.LEARNING_MATERIALS]: '/academics/learning-materials',
  [VIEWS.NOTES_COMPLIANCE]: '/academics/notes-compliance',
  [VIEWS.GRADEBOOK]: '/academics/gradebook',
  [VIEWS.ASSESSMENT_MANAGER]: '/academics/assessments',
  [VIEWS.CLASSES_ATTENDANCE]: '/academics/class-groups',
  [VIEWS.CURRICULUM_MANAGER]: '/academics/curriculum-map',
  [VIEWS.TEACHING_ASSIGNMENTS]: '/academics/workload-analysis',
  [VIEWS.RESULT_MANAGER]: '/academics/result-manager',
  [VIEWS.SCORE_REVIEW]: '/academics/score-review',
  [VIEWS.COVERAGE_FEEDBACK]: '/academics/coverage-feedback',
  [VIEWS.COVERAGE_REPORTING]: '/academics/coverage-reporting',
  [VIEWS.REVIEW_QUALITY_DASHBOARD]: '/academics/review-quality',
  [VIEWS.SUBMISSION_SETTINGS]: '/academics/submission-settings',
  [VIEWS.TEACHER_SCORE_ENTRY]: '/academics/score-entry',
  
  // Student Affairs
  [VIEWS.STUDENT_ROSTER]: '/student-affairs/student-roster',
  [VIEWS.STUDENT_ACCOUNTS]: '/student-affairs/student-accounts',
  [VIEWS.PARENT_ACCOUNTS]: '/student-affairs/parent-accounts',
  [VIEWS.INTERVENTION_PLANS]: '/student-affairs/intervention-plans',
  [VIEWS.ABSENCE_REQUESTS]: '/student-affairs/absence-requests',
  [VIEWS.STUDENT_SUBJECT_CHOICES_ADMIN]: '/student-affairs/subject-choices',
  [VIEWS.ID_CARDS]: '/student-affairs/id-cards',
  [VIEWS.REWARDS_STORE]: '/student-affairs/rewards-store',
  [VIEWS.STUDENT_PROFILE]: '/student-affairs/student-profile',
  [VIEWS.STUDENT_SUBJECT_ENROLLMENT_MANAGER]: '/student-affairs/subject-enrollment',
  
  // Transport
  [VIEWS.TRANSPORT_MANAGER]: '/transport/transport-manager',
  [VIEWS.TEACHER_TRANSPORT_GROUPS]: '/transport/groups',
  [VIEWS.TEACHER_TRANSPORT_ATTENDANCE]: '/transport/attendance',
  [VIEWS.TRANSPORT_SIGN_UP]: '/transport/sign-up',
  
  // HR & Staff
  [VIEWS.USER_MANAGEMENT]: '/hr/user-directory',
  [VIEWS.ROLE_MANAGEMENT]: '/hr/roles',
  [VIEWS.TEAM_HUB]: '/hr/team-hub',
  [VIEWS.TEAM_MANAGEMENT]: '/hr/team-management',
  [VIEWS.TEACHER_ATTENDANCE]: '/hr/attendance-monitor',
  [VIEWS.TEACHER_RATINGS]: '/hr/teacher-ratings',
  [VIEWS.TEACHER_PULSE]: '/hr/teacher-pulse',
  [VIEWS.LEAVE_APPROVALS]: '/hr/leave-approvals',
  [VIEWS.MANUALS]: '/hr/manuals',
  [VIEWS.MY_PAYROLL]: '/hr/my-payroll',
  [VIEWS.MY_ADJUSTMENTS]: '/hr/my-adjustments',
  
  // Finance & Ops
  [VIEWS.HR_PAYROLL]: '/finance/payroll',
  [VIEWS.STUDENT_FINANCE]: '/finance/fees',
  [VIEWS.STOREFRONT]: '/finance/store',
  [VIEWS.STORE_MANAGER]: '/finance/store-manager',
  [VIEWS.ORDER_MANAGER]: '/finance/order-manager',
  [VIEWS.COMPLIANCE_TRACKER]: '/finance/compliance',
  [VIEWS.SUPPORT_HUB]: '/finance/support',
  [VIEWS.SURVEY_MANAGER]: '/finance/survey-manager',
  [VIEWS.NOTIFICATION_HISTORY]: '/finance/notifications',
  
  // Administration
  [VIEWS.SETTINGS]: '/admin/global-settings',
  [VIEWS.AI_STRATEGIC_CENTER]: '/admin/ai-strategic-center',
  [VIEWS.PREDICTIVE_ANALYTICS]: '/admin/predictive-analytics',
  [VIEWS.SUPER_ADMIN_CONSOLE]: '/admin/super-admin',
  [VIEWS.DATA_UPLOAD]: '/admin/data-upload',
  [VIEWS.LIVING_POLICY]: '/admin/living-policy',
  [VIEWS.POLICY_QUERY]: '/admin/policy-query',
  [VIEWS.POLICY_STATEMENTS]: '/admin/policy-statements',
  [VIEWS.ANALYTICS]: '/admin/analytics',
  [VIEWS.DATA_ANALYSIS]: '/admin/data-analysis',
  [VIEWS.CAMPUS_STATISTICS]: '/admin/campus-stats',
  [VIEWS.ROLE_DIRECTORY]: '/admin/role-directory',
  [VIEWS.GUARDIAN_COMMAND]: '/admin/guardian-command',
  
  // Student Portal Views
  [VIEWS.STUDENT_PORTAL]: '/student/portal',
  [VIEWS.STUDENT_DASHBOARD]: '/student/dashboard',
  [VIEWS.STUDENT_FINANCES]: '/student/finances',
  [VIEWS.MY_SUBJECTS]: '/student/subjects',
  [VIEWS.RATE_MY_TEACHER]: '/student/rate-teacher',
  [VIEWS.STUDENT_REPORTS]: '/student/reports',
  [VIEWS.STUDENT_SURVEYS]: '/student/surveys',
  [VIEWS.STUDENT_PROFILE_EDIT]: '/student/profile-edit',
  [VIEWS.STUDENT_STRIKES]: '/student/strikes',
  [VIEWS.TAKE_QUIZ]: '/student/take-quiz',
  [VIEWS.TAKE_SURVEY]: '/student/take-survey',
  [VIEWS.STUDENT_LESSON_PORTAL]: '/student/lessons',
  [VIEWS.STUDENT_HOMEWORK]: '/student/homework',
  [VIEWS.STUDENT_REPORT]: '/student/report',
};

/**
 * Reverse mapping: path to view
 * Generated from VIEW_TO_PATH for efficient lookup
 */
export const PATH_TO_VIEW = Object.entries(VIEW_TO_PATH).reduce(
  (acc, [view, path]) => {
    acc[path] = view;
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Convert a view constant to its corresponding route path
 * @param view - VIEWS constant
 * @returns Route path or fallback to dashboard
 */
export function viewToPath(view: string): string {
  // Handle parameterized views like "Student Profile/123"
  const [baseView, ...params] = view.split('/');
  const basePath = VIEW_TO_PATH[baseView];
  
  if (!basePath) {
    console.warn(`[routeViewMapping] No path mapping found for view: ${view}, defaulting to dashboard`);
    return VIEW_TO_PATH[VIEWS.DASHBOARD];
  }
  
  // Append parameters if any
  if (params.length > 0) {
    return `${basePath}/${params.join('/')}`;
  }
  
  return basePath;
}

/**
 * Convert a route path to its corresponding view constant
 * @param path - Route path
 * @returns VIEWS constant or null if not found
 */
export function pathToView(path: string): string | null {
  // Remove leading slash if present
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Try exact match first
  if (PATH_TO_VIEW[normalizedPath]) {
    return PATH_TO_VIEW[normalizedPath];
  }
  
  // Try matching base path for parameterized routes
  const pathSegments = normalizedPath.split('/').filter(Boolean);
  for (let i = pathSegments.length; i > 0; i--) {
    const basePath = '/' + pathSegments.slice(0, i).join('/');
    if (PATH_TO_VIEW[basePath]) {
      // Return view with parameters appended
      const params = pathSegments.slice(i);
      return params.length > 0 
        ? `${PATH_TO_VIEW[basePath]}/${params.join('/')}`
        : PATH_TO_VIEW[basePath];
    }
  }
  
  return null;
}

/**
 * Get the section identifier from a path
 * @param path - Route path
 * @returns Section identifier (e.g., 'workspace', 'academics')
 */
export function getSectionFromPath(path: string): string | null {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const firstSegment = normalizedPath.split('/')[1];
  return firstSegment || null;
}

/**
 * Get the section identifier from a view
 * @param view - VIEWS constant
 * @returns Section identifier
 */
export function getSectionFromView(view: string): string | null {
  const path = viewToPath(view);
  return getSectionFromPath(path);
}

/**
 * Check if a path belongs to a specific section
 * @param path - Route path
 * @param section - Section identifier
 * @returns true if path belongs to section
 */
export function isPathInSection(path: string, section: string): boolean {
  return getSectionFromPath(path) === section;
}

/**
 * Legacy support: Convert hash-based navigation to path-based
 * @param hash - URL hash (e.g., "#Dashboard" or "#/Dashboard")
 * @returns Route path
 */
export function hashToPath(hash: string): string {
  // Remove leading # and /
  const cleanHash = hash.replace(/^#\/?/, '');
  
  if (!cleanHash) {
    return VIEW_TO_PATH[VIEWS.DASHBOARD];
  }
  
  // Check if it's already a path (starts with section name)
  if (cleanHash.startsWith('/')) {
    return cleanHash;
  }
  
  // Try to find matching view
  const view = Object.keys(VIEWS).find(key => VIEWS[key as keyof typeof VIEWS] === cleanHash);
  if (view) {
    return viewToPath(VIEWS[view as keyof typeof VIEWS]);
  }
  
  // Fallback to dashboard
  return VIEW_TO_PATH[VIEWS.DASHBOARD];
}

/**
 * Legacy support: Convert path to hash for backward compatibility
 * @param path - Route path
 * @returns Hash string (e.g., "#Dashboard")
 */
export function pathToHash(path: string): string {
  const view = pathToView(path);
  return view ? `#${view}` : '#Dashboard';
}
