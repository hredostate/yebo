import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { VIEWS } from '../../constants';
import { viewToPath, pathToView } from '../../routing/routeViewMapping';

export const SIDEBAR_EXPANDED = 'w-[280px]';
export const SIDEBAR_COLLAPSED = 'w-[88px]';
export const SIDEBAR_WIDTH_TRANSITION = 'transition-[width] duration-200 ease-out';

const baseIconClass =
  'flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-200/70 text-[10px] font-semibold text-slate-600 dark:bg-slate-800/70 dark:text-slate-200';

// Navigation icons
const HomeIcon = () => <div className={baseIconClass}>🏠</div>;
const MegaphoneIcon = () => <div className={baseIconClass}>📢</div>;
const BookOpenIcon = () => <div className={baseIconClass}>📚</div>;
const UsersIcon = () => <div className={baseIconClass}>👥</div>;
const UserCircleIcon = () => <div className={baseIconClass}>👔</div>;
const ShieldIcon = () => <div className={baseIconClass}>🛡️</div>;
const LogOutIcon = () => <div className={baseIconClass}>LO</div>;
const CloseIcon = () => <div className={baseIconClass}>X</div>;
const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

// Define the structure for navigation groups
interface NavGroup {
  id: string;
  label: string;
  icon: React.FC;
  items: NavItemConfig[];
}

interface NavItemConfig {
  id: string;
  label: string;
  permission?: string;
  subtabs?: SubtabConfig[];
}

interface SubtabConfig {
  id: string;
  label: string;
  permission?: string;
}

// Full Navigation Configuration matching the main Sidebar
const NAV_STRUCTURE: NavGroup[] = [
  {
    id: 'workspace',
    label: 'My Workspace',
    icon: HomeIcon,
    items: [
      { id: VIEWS.DASHBOARD, label: 'Dashboard', permission: 'view-dashboard' },
      { id: VIEWS.TASK_BOARD, label: 'My Tasks', permission: 'manage-tasks' },
      { id: VIEWS.MY_CHECKIN, label: 'Daily Check-in', permission: 'view-dashboard' },
      { id: VIEWS.CALENDAR, label: 'Calendar', permission: 'manage-calendar' },
      { id: VIEWS.MY_LEAVE, label: 'My Leave', permission: 'view-dashboard' },
      { id: VIEWS.PROFILE, label: 'My Profile', permission: 'view-dashboard' },
    ]
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: MegaphoneIcon,
    items: [
      { id: VIEWS.SUBMIT_REPORT, label: 'Submit Report', permission: 'submit-report' },
      { id: VIEWS.REPORT_FEED, label: 'Report Feed', permission: 'view-all-reports' },
      { id: VIEWS.BULLETIN_BOARD, label: 'Bulletin Board', permission: 'view-dashboard' },
      { id: VIEWS.SURVEYS, label: 'Surveys & Polls', permission: 'view-dashboard' },
      { id: VIEWS.EMERGENCY_BROADCAST, label: 'Emergency Broadcast', permission: 'send-emergency-broadcast' },
      { id: VIEWS.SOCIAL_MEDIA_HUB, label: 'Social Media Hub', permission: 'manage-social-media' },
    ]
  },
  {
    id: 'academics',
    label: 'Academics',
    icon: BookOpenIcon,
    items: [
      { id: VIEWS.TIMETABLE, label: 'Timetable', permission: 'view-dashboard' },
      { 
        id: VIEWS.CURRICULUM_HUB, 
        label: 'Curriculum Hub', 
        permission: 'view-my-lesson-plans|manage-curriculum',
        subtabs: [
          { id: VIEWS.LESSON_PLANNER, label: 'My Plans', permission: 'view-my-lesson-plans|manage-curriculum' },
          { id: VIEWS.TEAM_LESSON_HUB, label: 'Team Hub', permission: 'manage-curriculum' },
          { id: VIEWS.LEARNING_MATERIALS, label: 'Materials', permission: 'view-my-lesson-plans|manage-curriculum' },
          { id: VIEWS.CURRICULUM_MANAGER, label: 'Map', permission: 'view-curriculum-readonly|manage-curriculum' },
          { id: VIEWS.COVERAGE_ANALYTICS, label: 'Analytics', permission: 'manage-curriculum' },
          { id: VIEWS.TEACHING_ASSIGNMENTS, label: 'Workload', permission: 'manage-curriculum' },
          { id: VIEWS.COVERAGE_FEEDBACK, label: 'Feedback', permission: 'view-my-coverage-feedback|view-coverage-feedback' },
        ]
      },
      { id: VIEWS.HOMEWORK_MANAGER, label: 'Homework Manager', permission: 'view-my-lesson-plans|manage-curriculum' },
      { id: VIEWS.NOTES_COMPLIANCE, label: 'Notes Compliance', permission: 'view-my-lesson-plans|manage-curriculum' },
      { 
        id: VIEWS.GRADES_RESULTS_HUB, 
        label: 'Grades & Results', 
        permission: 'score_entries.edit_self',
        subtabs: [
          { id: VIEWS.GRADEBOOK, label: 'Gradebook', permission: 'score_entries.edit_self' },
          { id: VIEWS.ASSESSMENT_MANAGER, label: 'Assessments', permission: 'score_entries.edit_self' },
          { id: VIEWS.RESULT_MANAGER, label: 'Results', permission: 'results.lock_and_publish' },
          { id: VIEWS.SCORE_REVIEW, label: 'Review', permission: 'score_entries.view_all' },
        ]
      },
      { id: VIEWS.CLASSES_ATTENDANCE, label: 'Class Groups', permission: 'take-class-attendance|manage-class-groups' },
    ]
  },
  {
    id: 'students',
    label: 'Student Affairs',
    icon: UsersIcon,
    items: [
      { id: VIEWS.STUDENT_ROSTER, label: 'Student Roster', permission: 'manage-students' },
      { id: VIEWS.STUDENT_ACCOUNTS, label: 'Student Accounts', permission: 'manage-students' },
      { id: VIEWS.INTERVENTION_PLANS, label: 'Intervention Plans', permission: 'manage-students' },
      { id: VIEWS.ABSENCE_REQUESTS, label: 'Absence Requests', permission: 'view-dashboard' },
      { id: VIEWS.STUDENT_SUBJECT_CHOICES_ADMIN, label: 'Subject Choices', permission: 'manage-students' },
      { id: VIEWS.ID_CARDS, label: 'ID Card Generator', permission: 'manage-students' },
      { id: VIEWS.REWARDS_STORE, label: 'Rewards Store', permission: 'manage-students' },
      { 
        id: VIEWS.TRANSPORT_HUB, 
        label: 'Transport', 
        permission: 'transport.routes.manage|transport.attendance.mark',
        subtabs: [
          { id: VIEWS.TRANSPORT_MANAGER, label: 'Routes', permission: 'transport.routes.manage' },
          { id: VIEWS.TEACHER_TRANSPORT_GROUPS, label: 'My Groups', permission: 'transport.attendance.mark' },
          { id: VIEWS.TEACHER_TRANSPORT_ATTENDANCE, label: 'Attendance', permission: 'transport.attendance.mark' },
        ]
      },
    ]
  },
  {
    id: 'hr_staff',
    label: 'Staff & Operations',
    icon: UserCircleIcon,
    items: [
      { 
        id: VIEWS.USERS_TEAMS_HUB, 
        label: 'Users & Teams', 
        permission: 'manage-users|manage-roles|manage-teams',
        subtabs: [
          { id: VIEWS.USER_MANAGEMENT, label: 'Directory', permission: 'manage-users' },
          { id: VIEWS.ROLE_MANAGEMENT, label: 'Roles', permission: 'manage-roles' },
          { id: VIEWS.TEAM_HUB, label: 'Teams', permission: 'manage-teams' },
          { id: VIEWS.ROLE_DIRECTORY, label: 'Role Directory', permission: 'manage-roles' },
        ]
      },
      { id: VIEWS.TEACHER_ATTENDANCE, label: 'Attendance Monitor', permission: 'view-teacher-attendance' },
      { id: VIEWS.TEACHER_RATINGS, label: 'Teacher Ratings', permission: 'view-teacher-ratings' },
      { id: VIEWS.TEACHER_PULSE, label: 'Teacher Pulse', permission: 'view-dashboard' },
      { id: VIEWS.LEAVE_APPROVALS, label: 'Leave Approvals', permission: 'manage-users' },
      { id: VIEWS.MANUALS, label: 'Manuals', permission: 'view-dashboard' },
      { id: VIEWS.HR_PAYROLL, label: 'HR & Payroll', permission: 'view-dashboard' },
      { id: VIEWS.STUDENT_FINANCE, label: 'Bursary (Fees)', permission: 'manage-finance' },
      { id: VIEWS.STOREFRONT, label: 'School Store', permission: 'view-dashboard' },
      { id: VIEWS.STORE_MANAGER, label: 'Store Manager', permission: 'manage-orders' },
      { id: VIEWS.COMPLIANCE_TRACKER, label: 'Compliance Tracker', permission: 'view-compliance-tracker' },
      { id: VIEWS.SUPPORT_HUB, label: 'Support Hub', permission: 'manage-tasks' },
      { id: VIEWS.SURVEY_MANAGER, label: 'Survey Manager', permission: 'manage-surveys' },
      { id: VIEWS.NOTIFICATION_HISTORY, label: 'Notification History', permission: 'view-dashboard' },
    ]
  },
  {
    id: 'administration',
    label: 'Administration',
    icon: ShieldIcon,
    items: [
      { 
        id: VIEWS.SETTINGS_HUB, 
        label: 'Settings', 
        permission: 'manage-settings',
        subtabs: [
          { id: VIEWS.SETTINGS, label: 'General', permission: 'manage-settings' },
          { id: VIEWS.SUBMISSION_SETTINGS, label: 'Submissions', permission: 'manage-settings' },
        ]
      },
      { 
        id: VIEWS.ANALYTICS_HUB, 
        label: 'Analytics & Insights', 
        permission: 'view-analytics|view-school-health-overview',
        subtabs: [
          { id: VIEWS.ANALYTICS, label: 'Dashboard', permission: 'view-analytics' },
          { id: VIEWS.DATA_ANALYSIS, label: 'AI Analysis', permission: 'view-analytics' },
          { id: VIEWS.CAMPUS_STATISTICS, label: 'Campus Stats', permission: 'view-campus-stats' },
          { id: VIEWS.PREDICTIVE_ANALYTICS, label: 'Predictions', permission: 'view-predictive-analytics' },
          { id: VIEWS.AI_STRATEGIC_CENTER, label: 'Strategic', permission: 'view-school-health-overview' },
        ]
      },
      { id: VIEWS.SUPER_ADMIN_CONSOLE, label: 'Super Admin Console', permission: 'school.console.view' },
      { id: VIEWS.DATA_UPLOAD, label: 'Data Upload', permission: 'access-data-uploader' },
      { 
        id: VIEWS.POLICY_HUB, 
        label: 'Policy Hub', 
        permission: 'manage-living-policy|query-living-policy',
        subtabs: [
          { id: VIEWS.LIVING_POLICY, label: 'Policies', permission: 'manage-living-policy' },
          { id: VIEWS.POLICY_QUERY, label: 'Query', permission: 'query-living-policy' },
          { id: VIEWS.POLICY_STATEMENTS, label: 'Statements', permission: 'manage-living-policy' },
        ]
      },
      { id: VIEWS.GUARDIAN_COMMAND, label: 'Guardian Command', permission: 'view-dashboard' },
    ]
  }
];

// Student Navigation Structure
const STUDENT_NAV_ITEMS = [
  { id: VIEWS.STUDENT_DASHBOARD, label: 'Dashboard', icon: HomeIcon },
  { id: VIEWS.MY_SUBJECTS, label: 'My Subjects', icon: BookOpenIcon },
  { id: VIEWS.STUDENT_LESSON_PORTAL, label: 'Lesson Plans', icon: BookOpenIcon },
  { id: VIEWS.TIMETABLE, label: 'Timetable', icon: HomeIcon },
  { id: VIEWS.STUDENT_HOMEWORK, label: 'My Homework', icon: BookOpenIcon },
  { id: VIEWS.STUDENT_REPORTS, label: 'Report Cards', icon: BookOpenIcon },
  { id: VIEWS.STUDENT_FINANCES, label: 'Wallet & Payments', icon: HomeIcon },
  { id: VIEWS.RATE_MY_TEACHER, label: 'Rate Teachers', icon: UsersIcon },
  { id: VIEWS.STUDENT_SURVEYS, label: 'Surveys & Quizzes', icon: BookOpenIcon },
  { id: VIEWS.STUDENT_PROFILE_EDIT, label: 'My Profile', icon: UserCircleIcon },
  { id: VIEWS.ABSENCE_REQUESTS, label: 'Absence Requests', icon: HomeIcon },
  { id: VIEWS.TRANSPORT_SIGN_UP, label: 'Transport Sign-Up', icon: HomeIcon },
  { id: VIEWS.STUDENT_STRIKES, label: 'Strikes & Appeals', icon: ShieldIcon },
  { id: VIEWS.STOREFRONT, label: 'Store', icon: HomeIcon },
];

export interface SidebarUser {
  name?: string;
  role?: string;
  avatarUrl?: string;
}

export interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  closeMobile: () => void;
  onLogout?: () => void;
  user?: SidebarUser;
  userPermissions?: string[];
}

interface SidebarContentProps {
  collapsed: boolean;
  onLogout?: () => void;
  user?: SidebarUser;
  userPermissions?: string[];
  showCloseButton?: boolean;
  onClose?: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({ 
  collapsed, 
  onLogout, 
  user, 
  userPermissions = [],
  showCloseButton, 
  onClose 
}) => {
  const location = useLocation();
  const displayName = user?.name || 'Guardian 360';
  const displayRole = user?.role || 'Premium Suite';
  const isStudent = displayRole === 'Student';
  const initials = displayName
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Load expanded state from localStorage
  const loadExpandedState = () => {
    try {
      const saved = localStorage.getItem('sidebar-expanded-groups');
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>(['workspace']);
    } catch {
      return new Set<string>(['workspace']);
    }
  };

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(loadExpandedState);
  const [searchQuery, setSearchQuery] = useState('');

  const isAllPowerful = userPermissions.includes('*');
  const canViewSuperAdmin = isAllPowerful || 
    userPermissions.includes('school.console.view') ||
    userPermissions.includes('school.console.structure_edit') || 
    userPermissions.includes('school.console.branding_edit') || 
    userPermissions.includes('school.console.role_admin') || 
    userPermissions.includes('school.console.view_audit_log');

  // Get current view from path
  const currentPath = location.pathname;
  const currentView = pathToView(currentPath) || VIEWS.DASHBOARD;
  const [baseView] = currentView.split('/');

  // Persist expanded groups to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-expanded-groups', JSON.stringify([...expandedGroups]));
  }, [expandedGroups]);

  // Auto-expand group containing current view
  useEffect(() => {
    const activeGroup = NAV_STRUCTURE.find(group => {
      return group.items.some(item => item.id === baseView || 
        (item.subtabs && item.subtabs.some(st => st.id === baseView)));
    });
    
    if (activeGroup) {
      setExpandedGroups(prev => new Set(prev).add(activeGroup.id));
    }
  }, [baseView]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const hasPermission = (permission?: string, itemId?: string) => {
    if (permission === undefined) return true;
    if (permission === 'school.console.view') return canViewSuperAdmin;
    if (permission.includes('|')) {
      const perms = permission.split('|');
      return isAllPowerful || perms.some(p => userPermissions.includes(p.trim()));
    }
    return isAllPowerful || userPermissions.includes(permission);
  };

  // Get first accessible subtab for hub items
  const getFirstAccessibleSubtab = (item: NavItemConfig): string | null => {
    if (!item.subtabs || item.subtabs.length === 0) return null;
    for (const subtab of item.subtabs) {
      if (hasPermission(subtab.permission, subtab.id)) {
        return subtab.id;
      }
    }
    return null;
  };

  const filteredNavStructure = useMemo(() => {
    if (isStudent) return [];

    return NAV_STRUCTURE.map(group => {
      const visibleItems = group.items.filter(item => {
        const matchesSearch = searchQuery === '' || item.label.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPermission = hasPermission(item.permission, item.id) || item.id === VIEWS.DASHBOARD || item.id === VIEWS.PROFILE;
        
        // For hub items with subtabs, check if at least one subtab is accessible
        if (item.subtabs && item.subtabs.length > 0) {
          const hasAccessibleSubtab = item.subtabs.some(subtab => hasPermission(subtab.permission, subtab.id));
          return matchesSearch && hasAccessibleSubtab;
        }
        
        return matchesSearch && matchesPermission;
      });

      return { ...group, items: visibleItems };
    }).filter(group => group.items.length > 0);
  }, [userPermissions, searchQuery, isAllPowerful, canViewSuperAdmin, isStudent]);

  // Render student navigation
  const renderStudentNav = () => (
    <nav className="space-y-1">
      {STUDENT_NAV_ITEMS.map(item => (
        <NavLink
          key={item.id}
          to={viewToPath(item.id)}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) =>
            [
              'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition',
              collapsed ? 'justify-center px-2' : 'justify-start',
              isActive
                ? 'bg-indigo-50 ring-1 ring-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:ring-indigo-500/20 dark:text-indigo-200'
                : 'text-slate-700 hover:bg-slate-100/70 dark:text-slate-200 dark:hover:bg-slate-800/40',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              <span className="relative flex h-10 w-10 items-center justify-center">
                <item.icon />
                {isActive && !collapsed && (
                  <span className="absolute -left-3 h-6 w-1 rounded-full bg-indigo-600" />
                )}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  // Render staff navigation
  const renderStaffNav = () => (
    <div className="space-y-2">
      {filteredNavStructure.map(group => {
        const isExpanded = expandedGroups.has(group.id) || searchQuery !== '';
        const isActiveGroup = group.items.some(i => 
          i.id === baseView || (i.subtabs && i.subtabs.some(st => st.id === baseView))
        );

        return (
          <div key={group.id}>
            <button
              onClick={() => toggleGroup(group.id)}
              aria-expanded={isExpanded}
              className={[
                'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition',
                collapsed ? 'justify-center px-2' : 'justify-start',
                isActiveGroup
                  ? 'bg-slate-100 text-indigo-700 dark:bg-slate-800 dark:text-indigo-300'
                  : 'text-slate-700 hover:bg-slate-100/70 dark:text-slate-200 dark:hover:bg-slate-800/40',
              ].join(' ')}
            >
              <span className="flex h-10 w-10 items-center justify-center">
                <group.icon />
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1 truncate text-left">{group.label}</span>
                  <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDownIcon />
                  </span>
                </>
              )}
            </button>

            {!collapsed && (
              <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[1000px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                <div className="ml-4 space-y-1 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
                  {group.items.map(item => {
                    const isActive = baseView === item.id || 
                      (item.subtabs && item.subtabs.some(subtab => baseView === subtab.id));
                    
                    // For items with subtabs, navigate to first accessible subtab
                    const targetView = item.subtabs && item.subtabs.length > 0 
                      ? getFirstAccessibleSubtab(item) || item.id
                      : item.id;

                    return (
                      <NavLink
                        key={item.id}
                        to={viewToPath(targetView)}
                        className={
                          [
                            'block rounded-xl px-3 py-2 text-sm font-medium transition',
                            isActive
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200'
                              : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/40 dark:hover:text-slate-100',
                          ].join(' ')
                        }
                      >
                        {item.label}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/80 to-indigo-600/90 text-lg font-semibold text-white shadow-lg shadow-indigo-500/30">
            G
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Guardian 360
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Glass Command
              </div>
            </div>
          )}
        </div>
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-600 transition hover:bg-slate-100/70 dark:text-slate-300 dark:hover:bg-slate-800/60"
            aria-label="Close sidebar"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Search Bar (staff only) */}
      {!isStudent && !collapsed && (
        <div className="mt-4 px-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value) setExpandedGroups(new Set(NAV_STRUCTURE.map(g => g.id)));
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-4 flex-1 overflow-y-auto px-3">
        {isStudent ? renderStudentNav() : renderStaffNav()}
      </div>

      {/* User Footer */}
      <div className="px-4 pb-5">
        <div className="rounded-2xl bg-white/60 p-3 shadow-sm shadow-slate-200/50 backdrop-blur dark:bg-slate-900/50 dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 text-sm font-semibold text-slate-700 dark:from-slate-800 dark:to-slate-700 dark:text-slate-100">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {displayName}
                </div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {displayRole}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onLogout}
            className={[
              'mt-3 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/60',
              collapsed ? 'justify-center px-2' : 'w-full justify-start',
            ].join(' ')}
            title={collapsed ? 'Sign out' : undefined}
            aria-label={collapsed ? 'Sign out' : undefined}
          >
            <LogOutIcon />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  mobileOpen,
  closeMobile,
  onLogout,
  user,
  userPermissions,
}) => {
  const desktopWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  return (
    <>
      <aside
        className={[
          'sticky top-6 hidden h-[calc(100vh-48px)] overflow-hidden rounded-3xl border border-slate-200/70 bg-white/70 shadow-[0_1px_0_#0f172a0a,0_18px_60px_#0f172a10] backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/45 lg:block',
          desktopWidth,
          SIDEBAR_WIDTH_TRANSITION,
        ].join(' ')}
      >
        <SidebarContent 
          collapsed={collapsed} 
          onLogout={onLogout} 
          user={user} 
          userPermissions={userPermissions}
        />
      </aside>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={closeMobile}
          className={[
            'fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-opacity',
            mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          ].join(' ')}
          aria-label="Close sidebar"
        />
        <aside
          className={[
            'fixed left-4 top-4 bottom-4 z-50 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 shadow-[0_1px_0_#0f172a0a,0_18px_60px_#0f172a10] backdrop-blur transition-transform duration-200 ease-out dark:border-slate-800/70 dark:bg-slate-950/60',
            SIDEBAR_EXPANDED,
            mobileOpen ? 'translate-x-0' : '-translate-x-[120%]',
          ].join(' ')}
        >
          <SidebarContent
            collapsed={false}
            onLogout={onLogout}
            user={user}
            userPermissions={userPermissions}
            showCloseButton
            onClose={closeMobile}
          />
        </aside>
      </div>
    </>
  );
};

export default Sidebar;
