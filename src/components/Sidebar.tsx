import React, { useState, useEffect, useMemo } from 'react';
import {
  HomeIcon, PlusCircleIcon, FileTextIcon, UsersIcon, ShieldIcon, SettingsIcon,
  UploadCloudIcon, CalendarIcon, HeartIcon, BookOpenIcon, ClipboardListIcon,
  ChartBarIcon, MegaphoneIcon, EyeIcon, WandIcon, UserCircleIcon, LogoutIcon,
  GiftIcon, WrenchScrewdriverIcon, TrendingUpIcon, CloseIcon, CheckCircleIcon,
  ChevronDownIcon, SearchIcon, BanknotesIcon, ClockIcon, MapPinIcon, ShoppingCartIcon,
  GlobeIcon, StarIcon
} from './common/icons';
import type { UserProfile, StudentProfile } from '../types';
import { VIEWS, SCHOOL_LOGO_URL } from '../constants';

// Define the structure for navigation groups
interface NavGroup {
  id: string;
  label: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  items: NavItemConfig[];
}

interface NavItemConfig {
  id: string;
  label: string;
  permission: string;
}

// Reorganized Navigation Configuration
const NAV_STRUCTURE: NavGroup[] = [
  {
    id: 'workspace',
    label: 'My Workspace',
    icon: HomeIcon,
    items: [
      { id: VIEWS.DASHBOARD, label: 'Dashboard', permission: 'view-dashboard' },
      { id: VIEWS.TASK_BOARD, label: 'My Tasks', permission: 'manage-tasks' },
      { id: VIEWS.MY_CHECKIN, label: 'Daily Check-in', permission: 'submit-report' },
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
      { id: VIEWS.LESSON_PLANNER, label: 'Lesson Plans', permission: 'manage-curriculum' },
      { id: VIEWS.GRADEBOOK, label: 'My Gradebook', permission: 'score_entries.edit_self' },
      { id: VIEWS.ASSESSMENT_MANAGER, label: 'Assessments', permission: 'score_entries.edit_self' },
      { id: VIEWS.CLASSES_ATTENDANCE, label: 'Class Groups', permission: 'manage-class-groups' },
      { id: VIEWS.CURRICULUM_MANAGER, label: 'Curriculum Map', permission: 'manage-curriculum' },
      { id: VIEWS.RESULT_MANAGER, label: 'Result Manager', permission: 'results.lock_and_publish' },
      { id: VIEWS.COVERAGE_FEEDBACK, label: 'Coverage Feedback', permission: 'view-coverage-feedback' },
    ]
  },
  {
    id: 'students',
    label: 'Student Affairs',
    icon: UsersIcon,
    items: [
      { id: VIEWS.STUDENT_ROSTER, label: 'Student Roster', permission: 'manage-students' },
      { id: VIEWS.INTERVENTION_PLANS, label: 'Intervention Plans', permission: 'manage-students' },
      { id: VIEWS.ID_CARDS, label: 'ID Card Generator', permission: 'manage-students' },
      { id: VIEWS.REWARDS_STORE, label: 'Rewards Store', permission: 'manage-students' },
    ]
  },
  {
    id: 'staff_hr',
    label: 'HR & Staff',
    icon: UserCircleIcon,
    items: [
      { id: VIEWS.USER_MANAGEMENT, label: 'User Directory', permission: 'manage-users' },
      { id: VIEWS.ROLE_MANAGEMENT, label: 'Roles & Access', permission: 'manage-roles' },
      { id: VIEWS.TEAM_MANAGEMENT, label: 'Teams', permission: 'manage-teams' },
      { id: VIEWS.TEACHER_ATTENDANCE, label: 'Attendance Monitor', permission: 'view-teacher-attendance' },
      { id: VIEWS.TEACHER_RATINGS, label: 'Teacher Ratings', permission: 'view-teacher-ratings' },
      { id: VIEWS.TEACHER_PULSE, label: 'Teacher Pulse', permission: 'view-teacher-attendance' },
      { id: VIEWS.LEAVE_APPROVALS, label: 'Leave Approvals', permission: 'manage-users' },
    ]
  },
  {
    id: 'finance_ops',
    label: 'Finance & Ops',
    icon: BanknotesIcon,
    items: [
      { id: VIEWS.HR_PAYROLL, label: 'HR & Payroll', permission: 'view-dashboard' },
      { id: VIEWS.STUDENT_FINANCE, label: 'Bursary (Fees)', permission: 'manage-finance' },
      { id: VIEWS.STOREFRONT, label: 'School Store', permission: 'view-dashboard' },
      { id: VIEWS.STORE_MANAGER, label: 'Store Manager', permission: 'manage-orders' },
      { id: VIEWS.COMPLIANCE_TRACKER, label: 'Compliance Tracker', permission: 'view-compliance-tracker' },
      { id: VIEWS.SUPPORT_HUB, label: 'Support Hub', permission: 'manage-tasks' },
      { id: VIEWS.SURVEY_MANAGER, label: 'Survey Manager', permission: 'manage-surveys' },
    ]
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: ShieldIcon,
    items: [
      { id: VIEWS.SETTINGS, label: 'Global Settings', permission: 'manage-settings' },
      { id: VIEWS.AI_STRATEGIC_CENTER, label: 'AI Strategic Center', permission: 'view-school-health-overview' },
      { id: VIEWS.SUPER_ADMIN_CONSOLE, label: 'Super Admin Console', permission: 'school.console.view' },
      { id: VIEWS.DATA_UPLOAD, label: 'Data Upload', permission: 'access-data-uploader' },
      { id: VIEWS.LIVING_POLICY, label: 'Living Policy', permission: 'manage-living-policy' },
      { id: VIEWS.ANALYTICS, label: 'Analytics Dashboard', permission: 'view-analytics' },
      { id: VIEWS.DATA_ANALYSIS, label: 'AI Data Analysis', permission: 'view-analytics' },
      { id: VIEWS.ROLE_DIRECTORY, label: 'Role Directory', permission: 'manage-roles' },
      { id: VIEWS.GUARDIAN_COMMAND, label: 'Guardian Command', permission: 'access-ai-assistant' },
    ]
  }
];

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  userProfile: UserProfile | StudentProfile;
  userPermissions: string[];
  onLogout: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, userProfile, userPermissions, onLogout, isSidebarOpen, setIsSidebarOpen }) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['workspace']));
  const [searchQuery, setSearchQuery] = useState('');

  const isAllPowerful = userPermissions.includes('*');
  const canViewSuperAdmin = isAllPowerful || userPermissions.includes('school.console.structure_edit') || userPermissions.includes('school.console.branding_edit') || userPermissions.includes('school.console.role_admin') || userPermissions.includes('school.console.view_audit_log');
  
  const [baseView] = currentView.split('/');
  
  const name = 'name' in userProfile ? userProfile.name : userProfile.full_name;
  const role = 'role' in userProfile ? userProfile.role : 'Student';
  const avatarUrl = 'avatar_url' in userProfile ? userProfile.avatar_url : undefined;

  // Automatically expand the group containing the current view
  useEffect(() => {
    const activeGroup = NAV_STRUCTURE.find(group => group.items.some(item => item.id === baseView));
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

  const hasPermission = (permission: string) => {
    if (permission === 'school.console.view') return canViewSuperAdmin;
    return isAllPowerful || userPermissions.includes(permission);
  };

  const filteredNavStructure = useMemo(() => {
    if (role === 'Student') return []; // Student nav is separate

    return NAV_STRUCTURE.map(group => {
      // Filter items by permission AND search query
      const visibleItems = group.items.filter(item => {
        const matchesSearch = searchQuery === '' || item.label.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPermission = hasPermission(item.permission) || item.id === VIEWS.DASHBOARD || item.id === VIEWS.PROFILE;
        return matchesSearch && matchesPermission;
      });

      return { ...group, items: visibleItems };
    }).filter(group => group.items.length > 0);
  }, [userPermissions, searchQuery, isAllPowerful, canViewSuperAdmin, role]);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      
      <aside 
        className={`
          w-72 flex-shrink-0 
          fixed md:relative inset-y-0 left-0 z-40 
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `} 
        aria-label="Sidebar"
      >
        <div className="h-full px-4 py-6 glass-panel border-r-0 rounded-r-2xl md:rounded-none md:rounded-r-2xl flex flex-col">
          
          {/* Brand Header */}
          <div className="flex items-center justify-between mb-6 pl-1">
             <a href="#" onClick={() => onNavigate(VIEWS.DASHBOARD)} className="flex items-center gap-3 group">
               <div className="p-1 transition-transform group-hover:scale-105">
                   <img src={SCHOOL_LOGO_URL} alt="Logo" className="h-10 w-10 object-contain" />
               </div>
             <span className="self-center text-lg font-extrabold whitespace-nowrap text-slate-800 dark:text-white tracking-tight">Guardian 360</span>
           </a>
           <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 text-slate-500 rounded-lg md:hidden hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close sidebar"
           >
            <CloseIcon className="w-5 h-5" />
           </button>
        </div>
        
        {/* Search Bar */}
        {role !== 'Student' && (
            <div className="mb-6 relative group">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                  type="text"
                  placeholder="Search menu..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); if(e.target.value) setExpandedGroups(new Set(NAV_STRUCTURE.map(g=>g.id))); }}
                  className="w-full h-10 pl-10 pr-4 text-sm bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-400"
              />
            </div>
        )}
        
        {/* Navigation Items */}
        <div className="flex-grow overflow-y-auto no-scrollbar space-y-4 pr-1">
          {role !== 'Student' ? (
            <ul className="space-y-2">
              {filteredNavStructure.map(group => {
                 const isExpanded = expandedGroups.has(group.id) || searchQuery !== '';
                 const isActiveGroup = group.items.some(i => i.id === baseView);

                 return (
                   <li key={group.id} className="mb-1">
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className={`flex items-center w-full p-3 text-sm font-bold rounded-xl transition-all duration-200 group ${isActiveGroup ? 'bg-indigo-50/80 dark:bg-indigo-900/20 shadow-sm' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                      >
                        <div className={`p-1.5 rounded-lg mr-3 transition-colors ${isActiveGroup ? 'bg-indigo-200/50 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'}`}>
                            <group.icon className="w-5 h-5" />
                        </div>
                        <span className={`flex-1 text-left whitespace-nowrap ${isActiveGroup ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'}`}>{group.label}</span>
                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} opacity-50`} />
                      </button>
                      
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                        <ul className="space-y-0.5 pl-2 relative">
                          {/* Vertical line for hierarchy */}
                          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-slate-200 to-transparent dark:from-slate-800"></div>
                          {group.items.map(item => {
                            const isActive = baseView === item.id;
                            return (
                              <li key={item.id}>
                                <a
                                  href="#"
                                  onClick={(e) => { e.preventDefault(); onNavigate(item.id); setSearchQuery(''); }}
                                  className={`flex items-center py-2 pl-9 pr-3 w-full text-sm font-medium rounded-lg transition-all duration-200 relative z-10 ${
                                    isActive
                                      ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 translate-x-1 font-bold shadow-sm'
                                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                                  }`}
                                >
                                  {item.label}
                                </a>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                   </li>
                 )
              })}
            </ul>
          ) : (
              /* Student Navigation */
              <ul className="space-y-2">
                <li>
                     <a href="#" onClick={(e) => {e.preventDefault(); onNavigate(VIEWS.MY_SUBJECTS)}} className="flex items-center p-3 text-base font-medium text-slate-900 dark:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <BookOpenIcon className="w-6 h-6 text-slate-400 dark:text-slate-500 mr-3" />
                        <span>My Subjects</span>
                     </a>
                </li>
                 <li>
                     <a href="#" onClick={(e) => {e.preventDefault(); onNavigate(VIEWS.RATE_MY_TEACHER)}} className="flex items-center p-3 text-base font-medium text-slate-900 dark:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <StarIcon className="w-6 h-6 text-slate-400 dark:text-slate-500 mr-3" />
                        <span>Rate My Teacher</span>
                     </a>
                </li>
                 <li>
                     <a href="#" onClick={(e) => {e.preventDefault(); onNavigate(VIEWS.STUDENT_SURVEYS)}} className="flex items-center p-3 text-base font-medium text-slate-900 dark:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <ClipboardListIcon className="w-6 h-6 text-slate-400 dark:text-slate-500 mr-3" />
                        <span>Surveys</span>
                     </a>
                </li>
                 <li>
                     <a href="#" onClick={(e) => {e.preventDefault(); onNavigate(VIEWS.STUDENT_REPORTS)}} className="flex items-center p-3 text-base font-medium text-slate-900 dark:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <FileTextIcon className="w-6 h-6 text-slate-400 dark:text-slate-500 mr-3" />
                        <span>Report Cards</span>
                     </a>
                </li>
              </ul>
          )}
        </div>

        {/* User Profile Footer */}
        <div className="pt-4 mt-4 border-t border-slate-200/60 dark:border-slate-700/60">
           <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group" onClick={() => onNavigate(VIEWS.PROFILE)}>
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md ring-2 ring-white dark:ring-slate-800 overflow-hidden flex-shrink-0 group-hover:scale-110 transition-transform">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                    getInitials(name)
                )}
              </div>
              <div className="overflow-hidden flex-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{name}</p>
                  <p className="text-[11px] uppercase font-bold text-indigo-600 dark:text-indigo-400 truncate">{role}</p>
              </div>
           </div>
           <button 
              onClick={onLogout} 
              className="w-full mt-3 flex items-center justify-center gap-2 p-2.5 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors uppercase tracking-wide"
            >
             <LogoutIcon className="w-4 h-4" />
             Sign Out
           </button>
        </div>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;