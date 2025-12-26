import React, { useState, useEffect, useCallback, useRef, Suspense, useMemo, Component, startTransition } from 'react';
import type { Session, User } from '@supabase/auth-js';
import { initializeAIClient, getAIClient, getAIClientError, getCurrentModel } from './services/aiClient';
import type { OpenAI } from 'openai';
import { Team, TeamFeedback, TeamPulse, Task, TaskPriority, TaskStatus, ReportType, CoverageStatus, RoleTitle, Student, UserProfile, ReportRecord, ReportComment, Announcement, Notification, ToastMessage, RoleDetails, PositiveBehaviorRecord, StudentAward, StaffAward, StaffCertification, AIProfileInsight, AtRiskStudent, Alert, StudentInterventionPlan, SIPLog, SchoolHealthReport, SchoolSettings, PolicyInquiry, LivingPolicySnippet, AtRiskTeacher, InventoryItem, CalendarEvent, LessonPlan, CurriculumReport, LessonPlanAnalysis, DailyBriefing, StudentProfile, TeachingAssignment, BaseDataObject, Subject, Survey, SurveyWithQuestions, TeacherRatingWeekly, SuggestedTask, SchoolImprovementPlan, Curriculum, CurriculumWeek, CoverageDeviation, ClassGroup, AttendanceSchedule, AttendanceRecord, UPSSGPTResponse, SchoolConfig, Term, AcademicClass, AcademicTeachingAssignment, GradingScheme, GradingSchemeRule, AcademicClassStudent, StudentSubjectEnrollment, ScoreEntry, StudentTermReport, AuditLog, Assessment, AssessmentScore, CoverageVote, RewardStoreItem, PayrollRun, PayrollItem, PayrollAdjustment, Campus, TeacherCheckin, CheckinAnomaly, LeaveType, LeaveRequest, LeaveRequestStatus, TeacherShift, FutureRiskPrediction, AssessmentStructure, SocialMediaAnalytics, SocialAccount, CreatedCredential, NavigationContext, TeacherMood, Order, OrderStatus, StudentTermReportSubject, UserRoleAssignment, StudentFormData, PayrollUpdateData, CommunicationLogData, ZeroScoreEntry, ZeroScoreStudent, AbsenceRequest, AbsenceRequestType, ClassSubject, EmploymentStatus, PolicyStatement, PolicyAcknowledgment, ReportCardAnnouncement, ParentProfile, LinkedChild, ParentStudentLink } from './types';

import { MOCK_SOCIAL_ACCOUNTS, MOCK_TOUR_CONTENT, MOCK_SOCIAL_ANALYTICS } from './services/mockData';
import { extractAndParseJson } from './utils/json';
import { logAiEvent, textFromAI } from './utils/ai';
import { askUPSSGPT } from './services/upssGPT';
import { base64ToBlob } from './utils/file';
import { generateAdmissionNumber } from './utils/admissionNumber';
import { Offline, cache } from './offline/client';
import { requireSupabaseClient } from './services/supabaseClient';
import { queueStore } from './offline/db';
import { VIEWS } from './constants';
import { checkInToday, checkOutToday, todayISO } from './services/checkins';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { fetchAllStudents } from './utils/studentPagination';
import { updateSessionHeartbeat, terminateCurrentSession } from './services/sessionManager';
import { clearUserPersistedState } from './hooks/usePersistedState';
import { canManagePayroll, canViewOwnPayslip, canViewPayroll, useCan, canViewSitewide } from './security/permissions';
import { CampusScopeProvider } from './contexts/CampusScopeContext';
import {
    AUTH_ONLY_VIEWS,
    getInitialTargetViewFromHash,
    getWeekStartDateString,
    isStudentAllowedView,
    useInitialTargetView,
} from './hooks/useInitialView';

import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import EnvironmentSetupError from './components/EnvironmentSetupError';
import DatabaseSetupError from './components/DatabaseSetupError';
import PositiveBehaviorModal from './components/PositiveBehaviorModal';
import CreateStudentAccountModal from './components/CreateStudentAccountModal';
import Toast from './components/Toast';
import Spinner from './components/common/Spinner';
import TourModal from './components/TourModal';
import StudentPortal from './components/StudentPortal';
import PublicTeacherRatingsView from './components/PublicTeacherRatingsView';
import LandingPage from './components/LandingPage';
import StudentLoginPage from './components/StudentLoginPage';
import ParentLoginPage from './components/ParentLoginPage';
import ParentDashboard from './components/ParentDashboard';
import AIBulkResponseModal from './components/AIBulkResponseModal';
import TaskFormModal from './components/TaskFormModal';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import FeedbackWidget from './components/common/FeedbackWidget';
import ActivationPage from './components/ActivationPage';
import { useKeyboardShortcuts, defaultShortcuts } from './hooks/useKeyboardShortcuts';

import StudentSurveysView from './components/StudentSurveysView';
import StudentRateMyTeacherView from './components/StudentRateMyTeacherView';
import StudentReportList from './components/StudentReportList';
import PolicyAcknowledgmentGate from './components/PolicyAcknowledgmentGate';
import { BookOpenIcon, ClipboardListIcon, FileTextIcon, StarIcon, UserCircleIcon } from './components/common/icons';
import RouterWrapper from './components/RouterWrapper';

// Use lazyWithRetry for all lazy-loaded components to handle chunk load failures
// This is especially important for PWAs where cached bundles may reference outdated chunk hashes
const Dashboard = lazyWithRetry(() => import('./components/Dashboard'));
const ReportForm = lazyWithRetry(() => import('./components/ReportForm'));
const ReportFeed = lazyWithRetry(() => import('./components/ReportFeed'));
const TaskManager = lazyWithRetry(() => import('./components/TaskManager'));
const TeamManager = lazyWithRetry(() => import('./components/TeamManager'));
const UserManagement = lazyWithRetry(() => import('./components/UserManagement'));
const RoleManager = lazyWithRetry(() => import('./components/RoleManager'));
const DataUploader = lazyWithRetry(() => import('./components/DataUploader'));
const StudentListView = lazyWithRetry(() => import('./components/StudentListView'));
const StudentProfileView = lazyWithRetry(() => import('./components/StudentProfileView'));
const CalendarView = lazyWithRetry(() => import('./components/CalendarView'));
const AIAssistantView = lazyWithRetry(() => import('./components/AIAssistantView'));
const EmergencyBroadcast = lazyWithRetry(() => import('./components/EmergencyBroadcast'));
const LivingPolicyManager = lazyWithRetry(() => import('./components/LivingPolicyManager'));
const SettingsView = lazyWithRetry(() => import('./components/SettingsView'));
const BulletinBoard = lazyWithRetry(() => import('./components/BulletinBoard'));
const ComplianceTracker = lazyWithRetry(() => import('./components/ComplianceTracker'));
const SIPView = lazyWithRetry(() => import('./components/SIPView'));
const ProfilePage = lazyWithRetry(() => import('./components/ProfilePage'));
const SurveyManager = lazyWithRetry(() => import('./components/SurveyManager'));
const SurveyListView = lazyWithRetry(() => import('./components/SurveyListView'));
const SurveyTakerView = lazyWithRetry(() => import('./components/SurveyTakerView'));
const StaffTeacherRatingsView = lazyWithRetry(() => import('./components/StaffTeacherRatingsView'));
const CurriculumPlannerContainer = lazyWithRetry(() => import('./components/CurriculumPlannerContainer'));
const CurriculumManager = lazyWithRetry(() => import('./components/CurriculumManager'));
const AIStrategicCenterView = lazyWithRetry(() => import('./components/AIStrategicCenterView'));
const AICopilot = lazyWithRetry(() => import('./components/AICopilot'));
const AnalyticsView = lazyWithRetry(() => import('./components/AnalyticsView'));
const ClassGroupManager = lazyWithRetry(() => import('./components/ClassGroupManager'));
const SuperAdminConsole = lazyWithRetry(() => import('./components/SuperAdminConsole'));
const TeacherGradebookView = lazyWithRetry(() => import('./components/TeacherGradebookView'));
const TeacherScoreEntryView = lazyWithRetry(() => import('./components/TeacherScoreEntryView'));
const AssessmentManager = lazyWithRetry(() => import('./components/AssessmentManager'));
const ResultManager = lazyWithRetry(() => import('./components/ResultManager'));
const CoverageFeedbackReport = lazyWithRetry(() => import('./components/CoverageFeedbackReport'));
const SupportHubView = lazyWithRetry(() => import('./components/SupportHubView'));
const DataAnalysisView = lazyWithRetry(() => import('./components/DataAnalysisView'));
const RewardsStoreView = lazyWithRetry(() => import('./components/RewardsStoreView'));
const RoleDirectoryView = lazyWithRetry(() => import('./components/RoleDirectoryView'));
const StudentReportView = lazyWithRetry(() => import('./components/StudentReportView'));
const TeacherCheckinView = lazyWithRetry(() => import('./components/TeacherCheckinView'));
const TeacherPulseView = lazyWithRetry(() => import('./components/TeacherPulseView'));
const PayrollPage = lazyWithRetry(() => import('./components/PayrollPage'));
const MyPayrollView = lazyWithRetry(() => import('./components/MyPayrollView'));
const TeacherAttendanceDashboard = lazyWithRetry(() => import('./components/TeacherAttendanceDashboard'));
const MyLeaveView = lazyWithRetry(() => import('./components/MyLeaveView'));
const LeaveApprovalView = lazyWithRetry(() => import('./components/LeaveApprovalView'));
const MyAdjustmentsView = lazyWithRetry(() => import('./components/MyAdjustmentsView'));
const SocialMediaHubView = lazyWithRetry(() => import('./components/SocialMediaHubView'));
const StudentFinanceView = lazyWithRetry(() => import('./components/StudentFinanceView'));
const TimetableView = lazyWithRetry(() => import('./components/TimetableView'));
const IdCardGenerator = lazyWithRetry(() => import('./components/IdCardGenerator'));
const StorefrontView = lazyWithRetry(() => import('./components/StorefrontView'));
const QuizTakerView = lazyWithRetry(() => import('./components/QuizTakerView'));
const TeachingAssignmentsContainer = lazyWithRetry(() => import('./components/TeachingAssignmentsContainer'));
const HRPayrollModule = lazyWithRetry(() => import('./components/HRPayrollModule'));
const StoreManager = lazyWithRetry(() => import('./components/StoreManager'));
const ZeroScoreMonitorView = lazyWithRetry(() => import('./components/ZeroScoreMonitorView'));
const AppRouter = lazyWithRetry(() => import('./components/AppRouter'));
const AbsenceRequestsView = lazyWithRetry(() => import('./components/AbsenceRequestsView'));
const PolicyQueryView = lazyWithRetry(() => import('./components/PolicyQueryView'));
const PolicyStatementsManager = lazyWithRetry(() => import('./components/PolicyStatementsManager'));

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

// Helper function to clear all service worker caches
const clearAllCaches = async (): Promise<void> => {
    // Clear all Cache Storage
    if ('caches' in window) {
        try {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        } catch (e) {
            console.warn('Failed to clear caches:', e);
        }
    }
    
    // Unregister all service workers
    if ('serviceWorker' in navigator) {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(registration => registration.unregister()));
        } catch (e) {
            console.warn('Failed to unregister service workers:', e);
        }
    }
};

// Component to force a reload when a chunk fails to load
const ForceReload = () => {
    useEffect(() => {
        const handleReload = async () => {
            // Clear all caches before reloading to ensure fresh chunks
            await clearAllCaches();
            window.location.reload();
        };
        handleReload();
    }, []);
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
             <Spinner size="lg" />
             <p className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-200">New version detected. Updating...</p>
        </div>
    );
};

// Error Boundary Component to catch runtime errors in children
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // Check specifically for chunk load errors (deployment updates)
            const errorMessage = this.state.error?.toString() || '';
            const isChunkError = errorMessage.includes('Failed to fetch dynamically imported module') || 
                                 errorMessage.includes('Importing a module script failed');
            
            // If it's a chunk error, auto-reload once
            if (isChunkError && !sessionStorage.getItem('sg360_reload_lock')) {
                sessionStorage.setItem('sg360_reload_lock', 'true');
                return <ForceReload />;
            }

            return (
                <div className="flex h-screen w-full flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-900">
                    <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-red-100 dark:border-red-900/30">
                        <div className="mb-4 text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-full inline-block">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Application Error</h2>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">Something went wrong while rendering this view.</p>
                        
                        {this.state.error && (
                            <div className="text-left mb-6 bg-red-50 dark:bg-slate-950 border border-red-100 dark:border-red-900/30 rounded-lg p-4 overflow-auto max-h-48">
                                <p className="font-bold text-xs text-red-800 dark:text-red-300 mb-1">Error Details:</p>
                                <p className="font-mono text-xs text-red-600 dark:text-red-400 break-words">
                                    {this.state.error.toString()}
                                </p>
                            </div>
                        )}

                        <button 
                            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
                            className="w-full px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                        >
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Constants
const AI_RATE_LIMIT_COOLDOWN_MS = 120000; // 2 minutes

// Utility function to transform class groups data and map student names
interface ClassGroupMemberWithStudent {
    student?: { id: number; name: string } | null;
    [key: string]: any;
}

interface ClassGroupData {
    members?: ClassGroupMemberWithStudent[];
    [key: string]: any;
}

const transformClassGroupsWithStudentNames = (data: ClassGroupData | ClassGroupData[]): any => {
    const transformGroup = (group: ClassGroupData) => ({
        ...group,
        members: group.members?.map((member: ClassGroupMemberWithStudent) => ({
            ...member,
            student_name: member.student?.name || null
        })) || []
    });

    return Array.isArray(data) ? data.map(transformGroup) : transformGroup(data);
};

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | StudentProfile | null | undefined>(undefined);
    const [userType, setUserType] = useState<'staff' | 'student' | 'parent' | null>(null);
    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    
    // Parent-specific state
    const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null);
    const [linkedChildren, setLinkedChildren] = useState<LinkedChild[]>([]);
    const [selectedChild, setSelectedChild] = useState<LinkedChild | null>(null);

    const permissionContext = useMemo(() => {
        const resolvedRole = userProfile && 'role' in userProfile ? userProfile.role : userType === 'student' ? 'Student' : null;
        return {
            role: resolvedRole,
            permissions: userPermissions,
            userId: session?.user?.id,
        };
    }, [session?.user?.id, userPermissions, userProfile, userType]);

    const canAccess = useCan(permissionContext);
    const userCanViewSitewide = useMemo(() => canViewSitewide(permissionContext), [permissionContext]);
    
    // Theme Management
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            if (saved) return saved === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const toggleTheme = () => setIsDarkMode(!isDarkMode);

    const getIsDesktopLayout = () => window.matchMedia('(min-width: 1024px)').matches;

    const [currentView, setCurrentView] = useState(() => {
        try {
            let hash = decodeURIComponent(window.location.hash.substring(1));
            if (hash.startsWith('/')) hash = hash.substring(1);
            
            // Ignore auth tokens in initial hash
            if (hash.includes('access_token=') || hash.includes('error=')) {
                // Try to restore from localStorage if auth redirect cleared hash
                const lastView = localStorage.getItem('sg360_last_view');
                return lastView || VIEWS.DASHBOARD;
            }
            
            return hash || VIEWS.DASHBOARD;
        } catch (e) {
            console.warn("Failed to parse initial URL hash:", e);
            return VIEWS.DASHBOARD;
        }
    });

    // --- Smart Navigation Context ---
    const [navContext, setNavContext] = useState<NavigationContext | null>(null);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false); // Manually control task modal from App level for Copilot access
    const [isCreateStudentAccountModalOpen, setIsCreateStudentAccountModalOpen] = useState(false);
    const [isKeyboardShortcutsModalOpen, setIsKeyboardShortcutsModalOpen] = useState(false);

    const [booting, setBooting] = useState(true);
    const lastFetchedUserId = useRef<string | null>(null);
    const lastFetchedTimestamp = useRef<number>(0);
    const isFetchingRef = useRef(false);
    const dataLoadedRef = useRef(false);
    const lastProcessedAuthEvent = useRef<string | null>(null);
    const sessionUserIdRef = useRef<string | null>(null);
    const [dbError, setDbError] = useState<string | null>(null);
    const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(false);
    const profileLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isDesktopLayout, setIsDesktopLayout] = useState(() => getIsDesktopLayout());
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => getIsDesktopLayout());
    // Note: hash state removed - using BrowserRouter path-based navigation

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 1024px)');

        const handleLayoutChange = (event: MediaQueryListEvent) => {
            setIsDesktopLayout(event.matches);
        };

        setIsDesktopLayout(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleLayoutChange);

        return () => mediaQuery.removeEventListener('change', handleLayoutChange);
    }, []);

    useEffect(() => {
        // Keep the sidebar pinned open on desktop, default to drawer on mobile/tablet
        if (isDesktopLayout) {
            setIsSidebarOpen(true);
        } else {
            setIsSidebarOpen(false);
        }
    }, [isDesktopLayout]);
    
    // Store the initial target view from URL hash to preserve it across auth redirects
    const initialTargetView = useInitialTargetView();
    const hasHandledInitialNavigation = useRef(false);

    // Rate limit tracking
    const [aiRateLimitCooldown, setAiRateLimitCooldown] = useState<number | null>(null);
    const aiRateLimitUntil = useRef<number | null>(null);
    const aiCooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

    const userProfileRef = useRef<UserProfile | StudentProfile | null | undefined>(undefined);
    useEffect(() => {
        userProfileRef.current = userProfile;
    }, [userProfile]);

    // Cleanup AI cooldown timer on unmount
    useEffect(() => {
        return () => {
            if (aiCooldownTimerRef.current) {
                clearTimeout(aiCooldownTimerRef.current);
            }
        };
    }, []);

    // Session heartbeat - update last_active every 60 seconds (increased from 30s to reduce load)
    useEffect(() => {
        if (!session || !userProfile) return;
        
        // Initial heartbeat
        updateSessionHeartbeat();
        
        // Set up interval for heartbeat
        const heartbeatInterval = setInterval(() => {
            updateSessionHeartbeat();
        }, 60000); // 60 seconds (increased from 30s to reduce connection load)
        
        return () => {
            clearInterval(heartbeatInterval);
        };
    }, [session, userProfile]);

    const [users, setUsers] = useState<UserProfile[]>([]);
    const [reports, setReports] = useState<ReportRecord[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [roles, setRoles] = useState<Record<string, RoleDetails>>({});
    const [positiveRecords, setPositiveRecords] = useState<PositiveBehaviorRecord[]>([]);
    const [studentAwards, setStudentAwards] = useState<StudentAward[]>([]);
    const [staffAwards, setStaffAwards] = useState<StaffAward[]>([]);
    const [staffCertifications, setStaffCertifications] = useState<StaffCertification[]>([]);
    const [interventionPlans, setInterventionPlans] = useState<StudentInterventionPlan[]>([]);
    const [sipLogs, setSipLogs] = useState<SIPLog[]>([]);
    const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
    const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    const [allClasses, setAllClasses] = useState<BaseDataObject[]>([]);
    const [allArms, setAllArms] = useState<BaseDataObject[]>([]);
    const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
    const [surveys, setSurveys] = useState<SurveyWithQuestions[]>([]);
    const [takenSurveys, setTakenSurveys] = useState<Set<number>>(new Set());
    const [weeklyRatings, setWeeklyRatings] = useState<TeacherRatingWeekly[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [teamPulse, setTeamPulse] = useState<TeamPulse[]>([]);
    const [teamFeedback, setTeamFeedback] = useState<TeamFeedback[]>([]);
    const [curricula, setCurricula] = useState<Curriculum[]>([]);
    const [curriculumWeeks, setCurriculumWeeks] = useState<CurriculumWeek[]>([]);
    const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
    const [userRoleAssignments, setUserRoleAssignments] = useState<{ user_id: string; role_id: number }[]>([]);
    const [coverageVotes, setCoverageVotes] = useState<CoverageVote[]>([]);
    const [rewards, setRewards] = useState<RewardStoreItem[]>([]);
    const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
    const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
    const [payrollAdjustments, setPayrollAdjustments] = useState<PayrollAdjustment[]>([]);
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [teacherCheckins, setTeacherCheckins] = useState<TeacherCheckin[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequest[]>([]);
    const [teacherShifts, setTeacherShifts] = useState<TeacherShift[]>([]);
    const [teachingEntities, setTeachingEntities] = useState<TeachingAssignment[]>([]);
    const [socialMediaAnalytics, setSocialMediaAnalytics] = useState<SocialMediaAnalytics[]>(MOCK_SOCIAL_ACCOUNTS ? MOCK_SOCIAL_ANALYTICS : []);
    const [socialAccounts, setSocialAccounts] = useState<SocialAccount | null>(MOCK_SOCIAL_ACCOUNTS);
    const [reportCardAnnouncements, setReportCardAnnouncements] = useState<ReportCardAnnouncement[]>([]);
    
    const [schoolConfig, setSchoolConfig] = useState<SchoolConfig | null>(null);
    const [terms, setTerms] = useState<Term[]>([]);
    const [academicClasses, setAcademicClasses] = useState<AcademicClass[]>([]);
    const [academicAssignments, setAcademicAssignments] = useState<AcademicTeachingAssignment[]>([]);
    const [gradingSchemes, setGradingSchemes] = useState<GradingScheme[]>([]);
    const [academicClassStudents, setAcademicClassStudents] = useState<AcademicClassStudent[]>([]);
    const [studentSubjectEnrollments, setStudentSubjectEnrollments] = useState<StudentSubjectEnrollment[]>([]);
    const [scoreEntries, setScoreEntries] = useState<ScoreEntry[]>([]);
    const [studentTermReports, setStudentTermReports] = useState<StudentTermReport[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [assessmentStructures, setAssessmentStructures] = useState<AssessmentStructure[]>([]);
    const [assessmentScores, setAssessmentScores] = useState<AssessmentScore[]>([]);
    const [studentTermReportSubjects, setStudentTermReportSubjects] = useState<StudentTermReportSubject[]>([]);
    
    const [orders, setOrders] = useState<Order[]>([]);

    const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [policyInquiries, setPolicyInquiries] = useState<PolicyInquiry[]>([]);
    const [atRiskTeachers, setAtRiskTeachers] = useState<AtRiskTeacher[]>([]);
    const [curriculumReport, setCurriculumReport] = useState<CurriculumReport | null>(null);
    const [dailyBriefing, setDailyBriefing] = useState<DailyBriefing | null>(null);
    const [taskSuggestions, setTaskSuggestions] = useState<SuggestedTask[]>([]);
    const [areFallbackSuggestions, setAreFallbackSuggestions] = useState(false);
    const [schoolHealthReport, setSchoolHealthReport] = useState<SchoolHealthReport | null>(null);
    const [improvementPlan, setImprovementPlan] = useState<SchoolImprovementPlan | null>(null);
    const [checkinAnomalies, setCheckinAnomalies] = useState<CheckinAnomaly[]>([]);

    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isPositiveModalOpen, setIsPositiveModalOpen] = useState(false);
    const [positiveModalDefaultStudent, setPositiveModalDefaultStudent] = useState<Student | undefined>();
    const [isTourOpen, setIsTourOpen] = useState(false);
    const [takingSurvey, setTakingSurvey] = useState<SurveyWithQuestions | null>(null);
    const [isAIBulkResponseModalOpen, setIsAIBulkResponseModalOpen] = useState(false);
    const [reportsForAIBulkResponse, setReportsForAIBulkResponse] = useState<ReportRecord[]>([]);
    const toastCounter = useRef(0);
    
    const [livingPolicy, setLivingPolicy] = useState<LivingPolicySnippet[]>([]);
    const [pendingPolicies, setPendingPolicies] = useState<PolicyStatement[]>([]);
    const [showPolicyGate, setShowPolicyGate] = useState(false);

    const todaysCheckinForDashboard = useMemo(() => {
        if (!userProfile || !teacherCheckins) return null;
        const today = todayISO();
        return teacherCheckins.find(c => c.teacher_id === userProfile.id && c.checkin_date === today);
    }, [userProfile, teacherCheckins]);

    // Extract attendance records from class groups for AI Copilot (limit to recent records)
    const allAttendanceRecords = useMemo(() => {
        const records: AttendanceRecord[] = [];
        classGroups.forEach(group => {
            group.members?.forEach(member => {
                if (member.records) {
                    // Only include the last 30 records per member to avoid memory issues
                    records.push(...member.records.slice(-30));
                }
            });
        });
        return records;
    }, [classGroups]);

    const updateState = <T extends {id: number | string}>(setter: React.Dispatch<React.SetStateAction<T[]>>, item: T) => setter(prev => prev.map(i => i.id === item.id ? item : i));
    const addItem = <T extends {}>(setter: React.Dispatch<React.SetStateAction<T[]>>, item: T) => setter(prev => [item, ...prev]);
    const deleteItem = <T extends {id: number | string}>(setter: React.Dispatch<React.SetStateAction<T[]>>, id: number | string) => setter(prev => prev.filter(i => i.id !== id));

    // HTTP status code constants
    const HTTP_TOO_MANY_REQUESTS = 429;

    // --- Toast Handlers ---
    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        toastCounter.current++;
        const id = Date.now() + toastCounter.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 5000);
    }, [removeToast]);

    // Helper function to check if error is a rate limit error
    const isRateLimitError = (error: any): boolean => {
        // Check for various rate limit error formats
        const has429Status = error?.status === HTTP_TOO_MANY_REQUESTS || 
                             error?.response?.status === HTTP_TOO_MANY_REQUESTS ||
                             error?.code === HTTP_TOO_MANY_REQUESTS;
        
        // Check for rate limit related messages
        const hasRateLimitMessage = error?.message && (
            error.message.toLowerCase().includes('rate limit') ||
            error.message.toLowerCase().includes('quota exceeded') ||
            error.message.toLowerCase().includes('too many requests')
        );
        
        return has429Status || hasRateLimitMessage;
    };

    // Helper to check if AI is currently in cooldown
    const isAiInCooldown = (): boolean => {
        if (aiRateLimitUntil.current && Date.now() < aiRateLimitUntil.current) {
            return true;
        }
        return false;
    };

    // Helper to set AI rate limit cooldown
    const setAiCooldown = (durationMs: number = AI_RATE_LIMIT_COOLDOWN_MS) => {
        // Validate duration
        if (durationMs <= 0) {
            console.warn('AI cooldown duration must be positive, using default');
            durationMs = AI_RATE_LIMIT_COOLDOWN_MS;
        }
        
        const until = Date.now() + durationMs;
        aiRateLimitUntil.current = until;
        setAiRateLimitCooldown(durationMs);
        
        // Clear any existing timeout
        if (aiCooldownTimerRef.current) {
            clearTimeout(aiCooldownTimerRef.current);
        }
        
        // Clear cooldown after duration
        aiCooldownTimerRef.current = setTimeout(() => {
            // Only clear if this is still the active timer
            if (aiCooldownTimerRef.current) {
                aiRateLimitUntil.current = null;
                setAiRateLimitCooldown(null);
                aiCooldownTimerRef.current = null;
            }
        }, durationMs);
    };

    // Audit logging helper function
    const logAuditAction = useCallback(async (action: string, details: Record<string, unknown> = {}) => {
        if (!userProfile) return;
        const supabase = requireSupabaseClient();
        try {
            await supabase.from('audit_log').insert({
                school_id: userProfile.school_id,
                actor_user_id: userProfile.id,
                action,
                details
            });
        } catch (error) {
            console.error('Failed to log audit action:', error);
            // Don't show error to user - audit logging failure shouldn't disrupt UX
        }
    }, [userProfile]);

    const handleLogout = useCallback(async () => {
        const supabase = requireSupabaseClient();
        try {
            // Terminate current session
            await terminateCurrentSession();
            
            // Clear persisted state for this user
            if (userProfile?.id) {
                clearUserPersistedState(userProfile.id);
            }
            
            // Reset auth-related refs
            dataLoadedRef.current = false;
            lastFetchedUserId.current = null;
            lastProcessedAuthEvent.current = null;
            sessionUserIdRef.current = null;
            
            // Clear session state first
            setSession(null);
            setUserProfile(null);
            setUserType(null);
            setUserPermissions([]);
            setCurrentView('Dashboard');
            window.location.hash = '';
            
            // Clear cached data
            try {
                await cache.clear();
            } catch (cacheError) {
                console.error('Failed to clear cache during logout:', cacheError);
                // Continue with logout even if cache clearing fails
            }
            
            // Clear local storage (except theme preference)
            const theme = localStorage.getItem('theme');
            localStorage.clear();
            if (theme) {
                localStorage.setItem('theme', theme);
            }
            
            // Sign out from Supabase
            await supabase.auth.signOut();
            
            console.log("Logout successful");
        } catch (error) {
            if (Offline.online()) {
                console.error("Logout error:", error);
            } else {
                console.log("Offline logout successful locally.");
            }
            // Even if signOut fails, ensure local state is cleared
            dataLoadedRef.current = false;
            lastFetchedUserId.current = null;
            lastProcessedAuthEvent.current = null;
            sessionUserIdRef.current = null;
            setSession(null);
            setUserProfile(null);
            setUserType(null);
            setUserPermissions([]);
            setCurrentView('Dashboard');
            window.location.hash = '';
        }
    }, [userProfile]);

    // Check for pending policy acknowledgments
    const checkPendingPolicies = useCallback(async (profile: UserProfile | StudentProfile, userType: 'staff' | 'student') => {
        const supabase = requireSupabaseClient();
        try {
            const targetAudience = userType === 'staff' ? 'staff' : 'student';
            
            // Fetch active policies for this user type
            const { data: activePolicies, error } = await supabase
                .from('policy_statements')
                .select('*')
                .eq('school_id', profile.school_id)
                .eq('is_active', true)
                .eq('requires_acknowledgment', true)
                .contains('target_audience', [targetAudience]);

            if (error) {
                console.error('Failed to fetch policies:', error);
                return;
            }

            if (!activePolicies || activePolicies.length === 0) {
                setPendingPolicies([]);
                setShowPolicyGate(false);
                return;
            }

            // Get user's existing acknowledgments
            const acknowledged = (profile as any).policy_acknowledgments || [];

            // Find policies not yet acknowledged (by id AND version)
            const pending = activePolicies.filter((policy: PolicyStatement) =>
                !acknowledged.some((ack: PolicyAcknowledgment) =>
                    ack.policy_id === policy.id && ack.policy_version === policy.version
                )
            );

            if (pending.length > 0) {
                setPendingPolicies(pending);
                setShowPolicyGate(true);
            } else {
                setPendingPolicies([]);
                setShowPolicyGate(false);
            }
        } catch (error) {
            console.error('Error checking pending policies:', error);
        }
    }, []);

    // Handle policy acknowledgment
    const handlePolicyAcknowledgment = useCallback(async (policyId: number, acknowledgment: PolicyAcknowledgment) => {
        if (!userProfile || !userType) return;
        const supabase = requireSupabaseClient();

        try {
            // Helper to get the correct table and ID based on user type
            const getUserIdentifier = () => {
                if (userType === 'staff') {
                    return {
                        tableName: 'user_profiles' as const,
                        idField: 'id' as const,
                        userId: (userProfile as UserProfile).id,
                        schoolId: (userProfile as UserProfile).school_id
                    };
                } else {
                    return {
                        tableName: 'students' as const,
                        idField: 'id' as const,
                        userId: (userProfile as StudentProfile).student_record_id,
                        schoolId: (userProfile as StudentProfile).school_id
                    };
                }
            };

            const { tableName, idField, userId, schoolId } = getUserIdentifier();
            
            // Get current acknowledgments
            const { data: current } = await supabase
                .from(tableName)
                .select('policy_acknowledgments')
                .eq(idField, userId)
                .single();

            const currentAcks = current?.policy_acknowledgments || [];
            const updatedAcks = [...currentAcks, acknowledgment];

            // Dual-write: 1) Update the profile with new acknowledgment (existing behavior)
            const { error } = await supabase
                .from(tableName)
                .update({ policy_acknowledgments: updatedAcks })
                .eq(idField, userId);

            if (error) throw error;

            // Dual-write: 2) Insert into policy_acknowledgments table (new behavior for efficient queries)
            const acknowledgmentRecord = {
                policy_id: policyId,
                school_id: schoolId,
                user_id: userType === 'staff' ? (userProfile as UserProfile).id : null,
                student_id: userType === 'student' ? userId : null,
                full_name_entered: acknowledgment.full_name_entered,
                policy_version: acknowledgment.policy_version,
                acknowledged_at: acknowledgment.acknowledged_at,
                ip_address: acknowledgment.ip_address
            };

            const { error: ackError } = await supabase
                .from('policy_acknowledgments')
                .insert(acknowledgmentRecord);

            if (ackError) {
                console.error('Failed to insert into policy_acknowledgments table:', ackError);
                // Don't throw - the main JSONB update succeeded
            }

            // Update local profile state
            setUserProfile(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    policy_acknowledgments: updatedAcks
                } as any;
            });

            // Remove this policy from pending
            setPendingPolicies(prev => prev.filter(p => p.id !== policyId));

            // If no more pending policies, hide the gate
            if (pendingPolicies.length <= 1) {
                setShowPolicyGate(false);
            }

            addToast('Policy acknowledged successfully', 'success');
        } catch (error) {
            console.error('Failed to save acknowledgment:', error);
            throw error;
        }
    }, [userProfile, userType, pendingPolicies, addToast]);


    const fetchData = useCallback(async (user: User, forceRefresh: boolean = false) => {
        const supabase = requireSupabaseClient();
        
        // Prevent duplicate concurrent fetches
        if (isFetchingRef.current) {
            console.log('[Auth] Fetch already in progress, skipping');
            return;
        }
        
        // Add debouncing: prevent rapid successive calls (within 200ms) for the SAME user
        const now = Date.now();
        const DEBOUNCE_THRESHOLD = 200; // milliseconds
        const isSameUser = lastFetchedUserId.current === user.id;
        
        if (!forceRefresh && isSameUser && (now - lastFetchedTimestamp.current) < DEBOUNCE_THRESHOLD) {
            console.log('[Auth] Debouncing: fetch called too soon for same user, skipping');
            return;
        }
        
        // If not forcing refresh and data already loaded for this user, skip
        if (!forceRefresh && isSameUser && dataLoadedRef.current && userProfileRef.current) {
            console.log('[Auth] User data already loaded, skipping fetch');
            return;
        }
        
        // Additional guard: If profile and userType are already set and we're not booting, skip
        if (!forceRefresh && userProfile && userType && !booting) {
            console.log('[Auth] Profile already loaded, skipping fetch');
            return;
        }

        console.log('[Auth] Starting profile fetch for user:', user.id);
        
        // Reset dataLoadedRef to allow refetch (safe because isFetchingRef prevents concurrent calls)
        dataLoadedRef.current = false;
        isFetchingRef.current = true;
        lastFetchedTimestamp.current = now;
        setIsProfileLoading(true);
        setProfileLoadError(null);

        // Clear any existing timeout
        if (profileLoadTimeoutRef.current) {
            clearTimeout(profileLoadTimeoutRef.current);
        }

        // Set a 30-second timeout for profile loading (increased from 15s for slow connections)
        profileLoadTimeoutRef.current = setTimeout(() => {
            console.error('[Auth] Profile loading timeout after 30 seconds');
            setProfileLoadError('Profile loading timed out. Please try again.');
            setIsProfileLoading(false);
            setBooting(false);
            isFetchingRef.current = false;
        }, 30000);

        try {
            let staffProfile: any = null;
            let studentProfile: any = null;
            let parentProfile: any = null;
            let staffProfileError: any = null;
            let studentProfileError: any = null;
            
            const metadataUserType = user.user_metadata?.user_type;
            console.log('[Auth] User type from metadata:', metadataUserType);
            
            // Strict separation: If metadata says student, ONLY check student profile.
            if (metadataUserType === 'student') {
                 console.log('[Auth] Fetching student profile...');
                 const studentRes = await supabase.from('student_profiles').select('*').eq('id', user.id).maybeSingle();
                 studentProfile = studentRes.data;
                 studentProfileError = studentRes.error;

                 // Self-healing for student if profile missing but user_type is student
                 if (!studentProfile) {
                    console.log("[Auth] Self-healing: creating student profile for authenticated user", user.id);
                    // Important: We explicitly use the user's ID to link the profile.
                    const { data: newProfile, error: profileError } = await supabase.from('student_profiles').insert({
                        id: user.id,
                        school_id: user.user_metadata.school_id || 1, // Fallback to 1 if missing
                        full_name: user.user_metadata.name || 'Student',
                        // Populate class/arm if available in metadata to prevent empty state
                        class_id: user.user_metadata.class_id || null,
                        arm_id: user.user_metadata.arm_id || null
                    }).select().single();

                    if (newProfile) {
                        studentProfile = newProfile;
                        console.log('[Auth] Student profile created successfully');
                        addToast("Student profile recovered successfully.", "success");
                    } else {
                         console.error("[Auth] Failed to recover student profile:", profileError);
                         if (profileError?.message.includes('policy')) {
                             setDbError("Account setup failed: Database permission denied. Please ask Admin to run the 'Fix Missing Data' script in Settings.");
                             if (profileLoadTimeoutRef.current) clearTimeout(profileLoadTimeoutRef.current);
                             setIsProfileLoading(false);
                             isFetchingRef.current = false;
                             return;
                         }
                    }
                 } else {
                    console.log('[Auth] Student profile found');
                 }
            } 
            // If metadata says staff, ONLY check staff profile.
            else if (metadataUserType === 'staff') {
                 console.log('[Auth] Fetching staff profile...');
                 const staffRes = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
                 staffProfile = staffRes.data;
                 staffProfileError = staffRes.error;
                 if (staffProfile) {
                    console.log('[Auth] Staff profile found');
                 }
            }
            // If metadata says parent, ONLY check parent profile.
            else if (metadataUserType === 'parent') {
                 console.log('[Auth] Fetching parent profile...');
                 const parentRes = await supabase.from('parent_profiles').select('*').eq('id', user.id).maybeSingle();
                 parentProfile = parentRes.data;
                 if (parentProfile) {
                    console.log('[Auth] Parent profile found');
                 }
            }
            // If legacy/unknown, try all but prioritize student if found
            else {
                 console.log('[Auth] Legacy/unknown user type, checking both profiles...');
                 // Check student first
                 const studentRes = await supabase.from('student_profiles').select('*').eq('id', user.id).maybeSingle();
                 studentProfile = studentRes.data;
                 
                 if (!studentProfile) {
                     const staffRes = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
                     staffProfile = staffRes.data;
                     staffProfileError = staffRes.error;
                 }
            }

            // --- STAFF SELF HEALING (Only if not identified as student) ---
            if (!staffProfile && !studentProfile && metadataUserType !== 'student') {
                const userType = user.user_metadata?.user_type;
                
                if (userType === 'staff' || !userType) {
                    console.log("Self-healing: creating staff profile for authenticated user", user.id);
                    const { count } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true });
                    const isFirst = count === 0;
                    
                    const { data: newProfile, error: createError } = await supabase.from('user_profiles').insert({
                        id: user.id,
                        school_id: 1,
                        name: user.user_metadata.name || user.email?.split('@')[0] || 'Staff Member',
                        email: user.email,
                        role: isFirst ? 'Admin' : 'Teacher'
                    }).select().single();
                    
                    if (newProfile) {
                        staffProfile = newProfile;
                        addToast("Account profile recovered successfully.", "success");
                    } else {
                        console.error("Failed to recover staff profile:", createError);
                    }
                } 
            }

            // --- PROCESS STAFF PROFILE ---
            if (staffProfile) {
                console.log('[Auth] Processing staff profile...');
                
                // Batch initial state updates with startTransition to minimize re-renders
                startTransition(() => {
                    setUserProfile(staffProfile as UserProfile);
                    setUserType('staff');
                });
                lastFetchedUserId.current = user.id;

                const { data: rolesData, error: rolesError } = await supabase.from('roles').select('*');
                if (rolesError) throw rolesError;
                
                const rolesMap: Record<string, RoleDetails> = {};
                rolesData.forEach((r: any) => {
                    const normalized: RoleDetails = {
                        id: r.id,
                        school_id: r.school_id,
                        title: r.title,
                        description: r.description ?? '',
                        permissions: r.permissions ?? [],
                        reportingQuotaDays: r.reporting_quota_days ?? null,
                        reportingQuotaCount: r.reporting_quota_count ?? null,
                        aiAnalysisFocus: r.ai_analysis_focus ?? '',
                        aiRoutingInstructions: r.ai_routing_instructions ?? '',
                    };
                    rolesMap[normalized.title] = normalized;
                });

                const { data: userRoleAssignmentsRes } = await supabase.from('user_role_assignments').select('*');
                const perms = new Set<string>();
                const primaryRolePermissions = rolesMap[(staffProfile as UserProfile).role]?.permissions || [];
                primaryRolePermissions.forEach(p => perms.add(p));

                if (userRoleAssignmentsRes) {
                    const myAssignments = userRoleAssignmentsRes.filter((a: any) => a.user_id === (staffProfile as UserProfile).id);
                    myAssignments.forEach((assignment: any) => {
                         const roleDef = rolesData.find((r: any) => r.id === assignment.role_id);
                         if (roleDef && roleDef.permissions) {
                             roleDef.permissions.forEach((p: string) => perms.add(p));
                         }
                    });
                }
                if ((staffProfile as UserProfile).role === 'Admin') {
                    perms.add('*');
                }
                if (rolesData.length === 0) {
                    perms.add('*');
                    addToast("Warning: No roles defined in database. Temporary Super Admin access granted to fix setup.", "error");
                }
                if (perms.size === 0) {
                    perms.add('view-dashboard');
                }
                
                // Batch roles and permissions updates separately from profile state.
                // startTransition marks these as non-urgent, allowing React to prioritize
                // more critical updates and interrupt if needed, improving perceived performance.
                startTransition(() => {
                    setRoles(rolesMap);
                    setUserPermissions(Array.from(perms));
                    setUserRoleAssignments(userRoleAssignmentsRes || []);
                });

                if (!(staffProfile as UserProfile).has_seen_tour) {
                    supabase.from('user_profiles').update({ has_seen_tour: true }).eq('id', (staffProfile as UserProfile).id).then(({ error }) => {
                        if (error) console.error('Failed to update tour status:', error.message);
                    });
                }
            } 
            // --- PROCESS STUDENT PROFILE ---
            else if (studentProfile) {
                console.log('[Auth] Processing student profile...');
                let className: string | null = null;
                if (studentProfile.class_id) {
                    const { data: classData } = await supabase.from('classes').select('name').eq('id', studentProfile.class_id).maybeSingle();
                    className = classData?.name ?? null;
                }
                let armName: string | null = null;
                if (studentProfile.arm_id) {
                    const { data: armData } = await supabase.from('arms').select('name').eq('id', studentProfile.arm_id).maybeSingle();
                    armName = armData?.name ?? null;
                }
                let { data: studentRecord } = await supabase.from('students').select('id').eq('user_id', (studentProfile as any).id).maybeSingle();
                
                if (!studentRecord) {
                    console.log("Attempting to self-heal missing student record...");
                    const { data: newStudent, error: createError } = await supabase.from('students').insert({
                        school_id: (studentProfile as any).school_id,
                        name: (studentProfile as any).full_name,
                        user_id: (studentProfile as any).id,
                        status: 'Active',
                        // Also propagate class/arm to the student record if available
                        class_id: (studentProfile as any).class_id,
                        arm_id: (studentProfile as any).arm_id
                    }).select('id').single();

                    if (createError || !newStudent) {
                        console.error("Self-repair failed:", createError);
                         if (createError?.message.includes('policy')) {
                            setDbError(`Account Setup Incomplete: Permissions issue. Please ask Admin to run 'Fix Missing Data' script.`);
                         } else {
                            setDbError(`Account Setup Error: ${createError?.message || 'Could not initialize student record.'}`);
                         }
                         isFetchingRef.current = false;
                         return;
                    }
                    studentRecord = newStudent;
                    
                    // Update profile to link back to record
                    await supabase.from('student_profiles').update({ student_record_id: newStudent.id }).eq('id', user.id);
                    addToast("Account setup corrected automatically.", "success");
                }

                    const profile: StudentProfile = {
                    id: (studentProfile as any).id,
                    student_record_id: studentRecord.id,
                    school_id: (studentProfile as any).school_id,
                    full_name: (studentProfile as any).full_name,
                    class_id: (studentProfile as any).class_id,
                    arm_id: (studentProfile as any).arm_id,
                    created_at: (studentProfile as any).created_at,
                    class_name: className,
                    arm_name: armName,
                    email: user.email
                };
                
                // Batch student profile state updates
                startTransition(() => {
                    setUserProfile(profile);
                    setUserType('student');
                    setUserPermissions([]);
                });
                lastFetchedUserId.current = user.id;

                const { data: studentReports } = await supabase.from('student_term_reports').select('*, term:terms(*)').eq('student_id', studentRecord.id).order('created_at', { ascending: false });
                if (studentReports) {
                    startTransition(() => {
                        setStudentTermReports(studentReports as any);
                    });
                }
                
                // Clear timeout and mark as loaded successfully
                if (profileLoadTimeoutRef.current) clearTimeout(profileLoadTimeoutRef.current);
                setIsProfileLoading(false);
                isFetchingRef.current = false;
                dataLoadedRef.current = true;
                console.log('[Auth] Student profile loaded successfully');
                setBooting(false);
                
                // Check for pending policy acknowledgments
                await checkPendingPolicies(profile, 'student');
                
                // Navigate to student default view or restore intended view
                const targetView = initialTargetView.current;
                
                // Check if we have a stored target view that students can access
                if (targetView && !hasHandledInitialNavigation.current && isStudentAllowedView(targetView)) {
                    console.log('[Auth] Restoring student to initial target view:', targetView);
                    setCurrentView(targetView);
                } else {
                    setCurrentView(VIEWS.STUDENT_DASHBOARD);
                }
                return;
            } 
            // --- PROCESS PARENT PROFILE ---
            else if (parentProfile) {
                console.log('[Auth] Processing parent profile...');
                
                // Batch parent profile state updates
                startTransition(() => {
                    setParentProfile(parentProfile as ParentProfile);
                    setUserProfile(parentProfile as any); // Set as userProfile for session checks
                    setUserType('parent');
                });
                lastFetchedUserId.current = user.id;
                
                // Load linked children
                const { data: links, error: linksError } = await supabase
                    .from('parent_student_links')
                    .select(`
                        *,
                        student:students(
                            *,
                            class:classes(*),
                            arm:arms(*)
                        )
                    `)
                    .eq('parent_id', user.id);
                
                if (linksError) {
                    console.error('[Auth] Error loading parent-student links:', linksError);
                } else if (links) {
                    const children: LinkedChild[] = links
                        .filter(link => link.student)
                        .map(link => ({
                            ...link.student,
                            relationship: link.relationship,
                            permissions: {
                                canViewReports: link.can_view_reports,
                                canViewFinances: link.can_view_finances,
                                canViewAttendance: link.can_view_attendance,
                                canCommunicate: link.can_communicate
                            }
                        }));
                    
                    startTransition(() => {
                        setLinkedChildren(children);
                        setSelectedChild(children[0] || null);
                        setUserPermissions(['view-parent-dashboard']); // Basic parent permissions
                    });
                }
                
                // Clear timeout and mark as loaded successfully
                if (profileLoadTimeoutRef.current) clearTimeout(profileLoadTimeoutRef.current);
                setIsProfileLoading(false);
                isFetchingRef.current = false;
                dataLoadedRef.current = true;
                console.log('[Auth] Parent profile loaded successfully');
                setBooting(false);
                
                // Navigate to parent dashboard
                setCurrentView('parent-dashboard');
                return;
            } 
            else {
                console.error('[Auth] No profile found for user');
                setUserProfile(null);
                setUserType(null);
                
                // Clear timeout
                if (profileLoadTimeoutRef.current) clearTimeout(profileLoadTimeoutRef.current);
                setIsProfileLoading(false);
                isFetchingRef.current = false;
                setBooting(false);
                
                // Handle Database Schema Errors
                if (staffProfileError?.message.includes('relation') || staffProfileError?.message.includes('does not exist') || studentProfileError?.message.includes('relation')) {
                    setDbError(staffProfileError?.message || studentProfileError?.message);
                } else if ((!staffProfileError && !studentProfileError) || (staffProfileError?.code === 'PGRST116' && studentProfileError?.code === 'PGRST116')) {
                        // No profile found and self-heal failed
                        setDbError('No user profile found. Your account may not have been fully set up. Please contact support.');
                } else {
                    setDbError(staffProfileError?.message || studentProfileError?.message || 'Failed to fetch profile.');
                }
                return;
            }
    
            // --- FETCH STAFF DATA ONLY IF STAFF PROFILE EXISTS ---
            // This block is now strictly reachable only if staffProfile is truthy
            if (staffProfile) {
                (async () => {
                    const sp = staffProfile as UserProfile;
                    try {
                        // Reusable fetchers
                        const fetchUsers = async () => {
                            const supabase = requireSupabaseClient();
                            const { data, error } = await supabase.from('user_profiles').select('*');
                            if (error) throw error;
                            return data ?? [];
                        };
                        
                        const fetchStudents = async () => {
                             // Use pagination to support schools with more than 1000 students
                             return await fetchAllStudents('*, class:classes(name), arm:arms(name)', 'name');
                        };
                        
                        const fetchOrders = async () => {
                            const supabase = requireSupabaseClient();
                            // Try full orders query with order_notes, fallback to simpler one if it fails
                            // Note: This pattern is duplicated in handleCreateOrder due to scope limitations.
                            // fetchOrders is defined inside this IIFE and not accessible from other handlers.
                            // Extracting to a shared function would require significant refactoring.
                            try {
                                const fullQuery = await supabase.from('orders')
                                    .select('*, items:order_items(*, inventory_item:inventory_items!inventory_item_id(name, image_url)), user:user_profiles!user_id(name, email), notes:order_notes(*, author:user_profiles!author_id(name))')
                                    .order('created_at', { ascending: false });
                                
                                if (fullQuery.error) throw fullQuery.error;
                                return fullQuery.data ?? [];
                            } catch (e) {
                                console.warn('[Orders] Full query failed, using fallback without notes:', e);
                                const fallbackQuery = await supabase.from('orders')
                                    .select('*, items:order_items(*, inventory_item:inventory_items!inventory_item_id(name, image_url)), user:user_profiles!user_id(name, email)')
                                    .order('created_at', { ascending: false });
                                
                                if (fallbackQuery.error) {
                                    console.error('[Orders] Fallback query also failed:', fallbackQuery.error);
                                    return [];
                                }
                                return fallbackQuery.data ?? [];
                            }
                        };

                        // PHASE 1: Critical data needed for dashboard
                        const criticalQueries = [
                            // Bypassing cache if forceRefresh is true for critical lists (users, students)
                            forceRefresh 
                                ? fetchUsers().then(data => { cache.set('users', data); return data; }) 
                                : Offline.selectCached('users', fetchUsers),
                                
                            Offline.selectCached('reports', async () => {
                                const { data, error } = await supabase.from('reports').select('*, author:user_profiles!author_id(*), assignee:user_profiles!assignee_id(*), comments:report_comments(*, author:user_profiles(*))');
                                if (error) throw error;
                                return data ?? [];
                            }),
                            
                            forceRefresh 
                                ? fetchStudents().then(data => { cache.set('students', data); return data; }) 
                                : Offline.selectCached('students', fetchStudents),

                            Offline.selectCached('tasks', async () => {
                                const { data, error } = await supabase.from('tasks').select('*');
                                if (error) throw error;
                                return data ?? [];
                            }),
                        ];

                        // PHASE 2: Background data that can load after UI is shown
                        // NOTE: Supabase defaults to 1000 row limit. Queries for large tables
                        // must specify explicit .limit() to ensure all data is fetched.
                        // Limits added below: academic_class_students (10000), score_entries (50000),
                        // student_term_reports (10000), student_term_report_subjects (50000),
                        // teaching_assignments (5000), lesson_plans (10000), positive_behavior (10000),
                        // student_awards (10000), quiz_responses (10000), notifications (5000).
                        
                        // Calculate permission context inline to avoid circular dependency with fetchData
                        // Note: permissions array is empty here as it's populated later (line ~958)
                        // For payroll queries, the role-based permission check is sufficient for initial load
                        // Explicit permissions provide more granular control after they're loaded
                        const inlinePermissionContext = {
                            role: sp.role,
                            permissions: [], // Will be populated when userPermissions are loaded
                            userId: user.id,
                        };
                        
                        const payrollRunsQuery = canViewPayroll(inlinePermissionContext) || canManagePayroll(inlinePermissionContext)
                            ? supabase.from('payroll_runs').select('*')
                            : canViewOwnPayslip(inlinePermissionContext, user.id)
                                ? supabase.from('payroll_runs').select('*, items:payroll_items!inner(user_id)').eq('items.user_id', user.id)
                                : supabase.from('payroll_runs').select('id').limit(0);

                        const payrollItemsQuery = canViewPayroll(inlinePermissionContext) || canManagePayroll(inlinePermissionContext)
                            ? supabase.from('payroll_items').select('*')
                            : canViewOwnPayslip(inlinePermissionContext, user.id)
                                ? supabase.from('payroll_items').select('*').eq('user_id', user.id)
                                : supabase.from('payroll_items').select('id').limit(0);

                        const payrollAdjustmentsQuery = canManagePayroll(inlinePermissionContext) || sp.role === 'Admin'
                            ? supabase.from('payroll_adjustments').select('*')
                            : canViewOwnPayslip(inlinePermissionContext, user.id)
                                ? supabase.from('payroll_adjustments').select('*').eq('user_id', user.id)
                                : supabase.from('payroll_adjustments').select('id').limit(0);

                        const backgroundQueries = [
                            supabase.from('announcements').select('*, author:user_profiles(name)').order('created_at', { ascending: false }),
                            supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5000),
                            supabase.from('positive_behavior').select('*, student:students(name), author:user_profiles(name)').order('created_at', { ascending: false }).limit(10000),
                            supabase.from('student_awards').select('*, student:students(name)').order('created_at', { ascending: false }).limit(10000),
                            supabase.from('staff_awards').select('*').order('created_at', { ascending: false }),
                            supabase.from('student_intervention_plans').select('*, student:students(*)'),
                            supabase.from('sip_logs').select('*, author:user_profiles(name)'),
                            // Fetch teaching assignments with expanded relation
                            supabase.from('lesson_plans').select('*, author:user_profiles!author_id(name), teaching_entity:teaching_assignments!teaching_entity_id(*, teacher:user_profiles!teacher_user_id(name), academic_class:academic_classes!academic_class_id(name))').limit(10000),
                            supabase.from('schools').select('*').eq('id', sp.school_id).limit(1).maybeSingle(),
                            supabase.from('living_policy_snippets').select('*, author:user_profiles(name)').order('created_at', { ascending: false }),
                            supabase.from('calendar_events').select('*').order('start_time', { ascending: true }),
                            supabase.from('inventory_items').select('*'),
                            supabase.from('subjects').select('*'),
                            supabase.from('class_subjects').select('*'),
                            supabase.from('classes').select('*'),
                            supabase.from('arms').select('*'),
                            supabase.from('quizzes').select('*, questions:quiz_questions(*)').order('created_at', { ascending: false }),
                            supabase.from('quiz_responses').select('quiz_id').eq('user_id', user.id).limit(10000),
                            supabase.from('teacher_rating_weekly').select('*').order('week_start', { ascending: false }),
                            supabase.from('teams').select('*, lead:user_profiles!lead_id(*), members:team_assignments(user_id, profile:user_profiles(name))'),
                            supabase.from('team_feedback').select('*'),
                            supabase.from('curriculum').select('*'),
                            supabase.from('curriculum_weeks').select('*'),
                            supabase.from('class_groups').select('*, members:class_group_members(*, student:students(id, name), schedules:attendance_schedules(*), records:attendance_records(*)), teaching_entity:teaching_assignments!teaching_entity_id(*, teacher:user_profiles!teacher_user_id(name), academic_class:academic_classes!academic_class_id(name))').eq('school_id', sp.school_id),
                            supabase.from('school_config').select('*').eq('school_id', sp.school_id).limit(1).maybeSingle(),
                            supabase.from('terms').select('*'),
                            supabase.from('academic_classes').select('*, assessment_structure:assessment_structures(*)'),
                            supabase.from('teaching_assignments').select('*, term:terms(*), academic_class:academic_classes(*, assessment_structure:assessment_structures(*)), teacher:user_profiles!teacher_user_id(*)').limit(5000),
                            supabase.from('grading_schemes').select('*'),
                            supabase.from('grading_scheme_rules').select('*'),
                            supabase.from('academic_class_students').select('*').limit(10000),
                            supabase.from('student_subject_enrollments').select('*').limit(10000),
                            supabase.from('score_entries').select('*').limit(50000),
                            supabase.from('student_term_reports').select('*, term:terms(*)').limit(10000),
                            supabase.from('audit_log').select('*, actor:user_profiles!actor_user_id(name)').order('created_at', { ascending: false }).limit(100),
                            supabase.from('assessments').select('*, assignment:teaching_assignments!inner(*)'),
                            supabase.from('assessment_scores').select('*'),
                            supabase.from('student_term_report_subjects').select('*').limit(50000),
                            supabase.from('lesson_plan_coverage_votes').select('*'),
                            supabase.from('rewards_store_items').select('*'),
                            payrollRunsQuery,
                            payrollItemsQuery,
                            payrollAdjustmentsQuery,
                            supabase.from('campuses').select('*'),
                            supabase.from('teacher_checkins').select('*'),
                            supabase.from('leave_types').select('*'),
                            supabase.from('leave_requests').select('*, leave_type:leave_types(*), requester:user_profiles!requester_id(*)'),
                            supabase.from('absence_requests').select('*, student:students(*, class:classes(name), arm:arms(name)), requester:user_profiles!requested_by(name), reviewer:user_profiles!reviewed_by(name)'),
                            supabase.from('teacher_shifts').select('*'),
                            supabase.from('assessment_structures').select('*'),
                            supabase.from('teaching_entities').select('*, teacher:user_profiles!user_id(name), class:classes(name), arm:arms(name), subject:subjects(name))'),
                            fetchOrders(),
                            supabase.from('staff_certifications').select('*, uploader:user_profiles!uploaded_by(name)').order('uploaded_at', { ascending: false }),
                            supabase.from('report_card_announcements').select('*').order('display_order', { ascending: true }),
                        ];
                        
                        // Load critical data first (Phase 1)
                        console.log('[Data Fetch] Phase 1: Loading critical data...');
                        const criticalResults = await Promise.allSettled(criticalQueries);
                        
                        // Log critical query results
                        criticalResults.forEach((result, index) => {
                            if (result.status === 'rejected') {
                                console.error(`[Data Fetch] Critical query ${index} failed:`, result.reason);
                            }
                        });
                        
                        // Set critical data immediately
                        const getCriticalData = (index: number): any[] => {
                            const res = criticalResults[index];
                            if (res.status !== 'fulfilled') return [];
                            const value = res.value as any;
                            if (value && typeof value === 'object' && 'data' in value) {
                                const data = value.data;
                                return Array.isArray(data) ? data : [];
                            }
                            return Array.isArray(value) ? value : [];
                        };
                        
                        setUsers(getCriticalData(0));
                        setReports(getCriticalData(1));
                        setStudents(getCriticalData(2));
                        setTasks(getCriticalData(3));
                        
                        // Check for critical failures
                        const criticalErrors = criticalResults.filter(r => r.status === 'rejected').length;
                        if (criticalErrors > 0) {
                            addToast("Some core data failed to load. The app may not function correctly.", "error");
                        }
                        
                        // Clear timeout and mark profile as loaded
                        if (profileLoadTimeoutRef.current) clearTimeout(profileLoadTimeoutRef.current);
                        setIsProfileLoading(false);
                        isFetchingRef.current = false;
                        dataLoadedRef.current = true;
                        setBooting(false);
                        console.log('[Auth] Critical data loaded, checking for target view...');
                        
                        // Check for pending policy acknowledgments
                        await checkPendingPolicies(staffProfile as UserProfile, 'staff');
                        
                        // Navigate to staff default view only if no target view exists and initial navigation not handled
                        const currentHash = decodeURIComponent(window.location.hash.substring(1) || '');
                        const targetView = initialTargetView.current;
                        
                        // Only set view if initial navigation hasn't been handled yet
                        if (!hasHandledInitialNavigation.current) {
                            if (targetView && !AUTH_ONLY_VIEWS.includes(targetView)) {
                                // We have a stored target view from initial load - navigate there
                                console.log('[Auth] Restoring staff to initial target view:', targetView);
                                setCurrentView(targetView);
                            } else {
                                // Check if we're on the root path before defaulting to dashboard
                                const currentPath = window.location.pathname;
                                if (!currentHash || currentHash.includes('access_token=') || currentHash.includes('error=') || currentPath === '/' || currentPath === '') {
                                    // No valid hash or target view, and on root path - go to dashboard
                                    setCurrentView(VIEWS.DASHBOARD);
                                }
                            }
                        }
                        
                        // Load background data (Phase 2) asynchronously
                        console.log('[Data Fetch] Phase 2: Loading background data...');
                        Promise.allSettled(backgroundQueries).then(backgroundResults => {
                            // Log background query results
                            backgroundResults.forEach((result, index) => {
                                if (result.status === 'rejected') {
                                    console.error(`[Data Fetch] Background query ${index} failed:`, result.reason);
                                }
                            });
                            
                            // Helper to safely extract data from result - always returns array for array types
                            const getData = (index: number): any[] => {
                                const res = backgroundResults[index];
                                if (res.status !== 'fulfilled') return [];
                                const value = res.value as any;
                                // Check for Supabase response format
                                if (value && typeof value === 'object' && 'data' in value) {
                                    // Ensure we return an array
                                    const data = value.data;
                                    return Array.isArray(data) ? data : [];
                                }
                                // For Offline.selectCached which returns data directly
                                return Array.isArray(value) ? value : [];
                            };
                            
                            // Helper for single-object data (like school settings)
                            const getSingleData = (index: number): any => {
                                const res = backgroundResults[index];
                                if (res.status !== 'fulfilled') return null;
                                const value = res.value as any;
                                if (value && typeof value === 'object' && 'data' in value) {
                                    return value.data;
                                }
                                return value;
                            };
                
                            setAnnouncements(getData(0));
                            setNotifications(getData(1));
                            setPositiveRecords(getData(2));
                            setStudentAwards(getData(3));
                            setStaffAwards(getData(4));
                            setInterventionPlans(getData(5));
                            setSipLogs(getData(6));
                            setLessonPlans(getData(7));
                            setSchoolSettings(getSingleData(8));
                            setLivingPolicy(getData(9));
                            setCalendarEvents(getData(10));
                            setInventory(getData(11));
                            setAllSubjects(getData(12));
                            setClassSubjects(getData(13));
                            setAllClasses(getData(14));
                            setAllArms(getData(15));
                            setSurveys(getData(16));
                            setTakenSurveys(new Set(getData(17).map((r: any) => r.quiz_id)));
                            setWeeklyRatings(getData(18));
                            setTeams(getData(19));
                            setTeamFeedback(getData(20));
                            setCurricula(getData(21));
                            setCurriculumWeeks(getData(22));
                            const classGroupsData = getData(23);
                            console.log('Class groups fetched:', classGroupsData);
                            // Map student_name from joined student data using utility function
                            setClassGroups(transformClassGroupsWithStudentNames(classGroupsData));
                            setSchoolConfig(getSingleData(24));
                            setTerms(getData(25));
                            setAcademicClasses(getData(26));
                            setAcademicAssignments(getData(27));
                            const schemesData = getData(28);
                            const rulesData = getData(29);
                            setAcademicClassStudents(getData(30));
                            setStudentSubjectEnrollments(getData(31));
                            setScoreEntries(getData(32));
                            setStudentTermReports(getData(33));
                            setAuditLogs(getData(34));
                            setAssessments(getData(35));
                            setAssessmentScores(getData(36));
                            setStudentTermReportSubjects(getData(37));
                            setCoverageVotes(getData(38));
                            setRewards(getData(39));
                            setPayrollRuns(getData(40));
                            setPayrollItems(getData(41));
                            setPayrollAdjustments(getData(42));
                            setCampuses(getData(43));
                            setTeacherCheckins(getData(44));
                            setLeaveTypes(getData(45));
                            setLeaveRequests(getData(46));
                            setAbsenceRequests(getData(47));
                            setTeacherShifts(getData(48));
                            setAssessmentStructures(getData(49));
                            setTeachingEntities(getData(50));
                            setOrders(getData(51));
                            setStaffCertifications(getData(52));
                            setReportCardAnnouncements(getData(53));

                            const combinedSchemes = (schemesData as GradingScheme[]).map(scheme => ({
                                ...scheme,
                                rules: (rulesData as GradingSchemeRule[]).filter(rule => rule.grading_scheme_id === scheme.id)
                            }));
                            setGradingSchemes(combinedSchemes);

                            const settings = getSingleData(8);
                            if (settings?.school_documents) {
                                const docs = settings.school_documents;
                                if (docs.daily_briefing) setDailyBriefing(docs.daily_briefing);
                                if (docs.curriculum_report) setCurriculumReport(docs.curriculum_report);
                                if (docs.health_report) setSchoolHealthReport(docs.health_report);
                                if (docs.improvement_plan) setImprovementPlan(docs.improvement_plan);
                            }
                            
                            console.log('[Auth] Background data loaded successfully');

                            // Analyze at-risk students and generate task suggestions using critical data
                            const students = getCriticalData(2);
                            const reports = getCriticalData(1);
                            analyzeAtRiskStudents(students, reports);
                            generateTaskSuggestions(reports);
                        });
                    } catch (error: any) {
                        console.error('[Auth] Critical data fetching error:', error);
                        
                        // Clear timeout
                        if (profileLoadTimeoutRef.current) clearTimeout(profileLoadTimeoutRef.current);
                        setIsProfileLoading(false);
                        isFetchingRef.current = false;
                        setBooting(false);
                        
                        // Do NOT logout if it's a schema error, so the Setup screen can show
                        if (error.message && (error.message.includes('relation') || error.message.includes('does not exist') || error.code === 'PGRST204')) {
                            setDbError(error.message);
                        } else {
                            setProfileLoadError(`Failed to load profile: ${error.message}`);
                            addToast(`Failed to fetch user data: ${error.message}. You will be logged out.`, 'error');
                            setUserProfile(null);
                            setUserType(null);
                            handleLogout();
                        }
                    }
                })();
            }
    
        } catch (error: any) {
            console.error('[Auth] Essential data fetching error:', error);
            
            // Clear timeout
            if (profileLoadTimeoutRef.current) clearTimeout(profileLoadTimeoutRef.current);
            setIsProfileLoading(false);
            
             // Do NOT logout if it's a schema error, so the Setup screen can show
            if (error.message && (error.message.includes('relation') || error.message.includes('does not exist') || error.code === 'PGRST204')) {
                 setDbError(error.message);
            } else {
                 setProfileLoadError(`Failed to load profile: ${error.message}`);
                 addToast(`Failed to fetch user data: ${error.message}. You will be logged out.`, 'error');
                 setUserProfile(null);
                 setUserType(null);
                 handleLogout();
            }
            setBooting(false);
        } finally {
            isFetchingRef.current = false;
        }
    }, [addToast, handleLogout, userProfile, userType, booting]);
    
    // Store fetchData in a ref to avoid it being a dependency in effects
    const fetchDataRef = useRef(fetchData);
    useEffect(() => {
        fetchDataRef.current = fetchData;
    }, [fetchData]);
    
    // --- Auth Logic & Data Fetching ---
    
    useEffect(() => {
        const supabase = requireSupabaseClient();
        // Clear reload lock on successful app mount
        sessionStorage.removeItem('sg360_reload_lock');

        // Auth Listener
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (!session) setBooting(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            // Deduplicate events - create unique key from event and user ID
            const eventKey = `${event}_${session?.user?.id || 'null'}`;
            if (lastProcessedAuthEvent.current === eventKey) {
                console.log('[Auth] Duplicate event, skipping:', event);
                return;
            }
            lastProcessedAuthEvent.current = eventKey;
            
            // Memoize session comparison - only process if user ID changed
            const currentUserId = session?.user?.id;
            if (currentUserId) {
                if (sessionUserIdRef.current === currentUserId) {
                    console.log('[Auth] Same user session, skipping state update');
                    return;
                }
                sessionUserIdRef.current = currentUserId;
            } else {
                sessionUserIdRef.current = null;
            }
            
            setSession(session);
            
            if (event === 'PASSWORD_RECOVERY') {
                setCurrentView(VIEWS.PROFILE);
                addToast("Password recovery link verified. Please update your password now.", "info");
            }
            
            if (!session) {
                setBooting(false);
                setUserProfile(null);
            } else {
                fetchDataRef.current(session.user);
            }
        });

        return () => {
            subscription.unsubscribe();
            // Cleanup timeout on unmount
            if (profileLoadTimeoutRef.current) {
                clearTimeout(profileLoadTimeoutRef.current);
            }
        };
    }, [addToast]);

    // --- Realtime Updates ---
    useEffect(() => {
        if (!session?.user) return;
        const supabase = requireSupabaseClient();

        const channel = supabase.channel('app_updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_profiles', filter: `id=eq.${session.user.id}` },
                (payload) => {
                    console.log('Profile updated remotely', payload);
                    // Prevent realtime updates from triggering during initial boot
                    if (!booting) {
                        fetchDataRef.current(session.user, true);
                        addToast('Your profile has been updated.', 'info');
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_role_assignments', filter: `user_id=eq.${session.user.id}` },
                (payload) => {
                    console.log('Role assignments updated remotely', payload);
                    // Prevent realtime updates from triggering during initial boot
                    if (!booting) {
                        fetchDataRef.current(session.user, true);
                        addToast('Your permissions have been updated.', 'info');
                    }
                }
            )
            // NEW: Listen for notifications
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
                (payload) => {
                     const newNotif = payload.new as Notification;
                     setNotifications(prev => [newNotif, ...prev]);
                     addToast(newNotif.message, 'info');
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session, addToast, booting]); 

    // --- Initialize AI Client ---
    useEffect(() => {
        if (schoolSettings?.ai_settings) {
            const { groq_api_key, openrouter_api_key, default_model } = schoolSettings.ai_settings;
            
            // Use groq_api_key if available, fallback to openrouter_api_key for backward compatibility
            const apiKey = groq_api_key || openrouter_api_key;
            
            if (apiKey) {
                console.log('[AI] Initializing AI client with Groq');
                initializeAIClient(apiKey, default_model || 'llama-3.1-8b-instant');
                const error = getAIClientError();
                if (error) {
                    console.error('[AI] Failed to initialize AI client:', error);
                } else {
                    console.log('[AI] AI client initialized successfully');
                }
            } else {
                console.log('[AI] No API key configured');
            }
        }
    }, [schoolSettings]);

    // Note: Hash sync removed - using BrowserRouter path-based navigation instead
    // The RouterWrapper component handles the bi-directional sync between paths and currentView state
    // Keeping this comment for historical context during the migration

    // Redirect authenticated users away from auth-only views
    useEffect(() => {
        if (session && AUTH_ONLY_VIEWS.includes(currentView)) {
            // Try to restore from localStorage if available, otherwise go to Dashboard
            const lastView = localStorage.getItem('sg360_last_view');
            const canRestoreLastView = lastView && !AUTH_ONLY_VIEWS.includes(lastView);
            const targetView = canRestoreLastView ? lastView : (userType === 'student' ? VIEWS.STUDENT_DASHBOARD : VIEWS.DASHBOARD);
            setCurrentView(targetView);
        }
    }, [session, currentView, userType]);

    // Mark initial navigation as handled after auth is complete
    // This prevents the initial target view from being reused on subsequent navigations
    useEffect(() => {
        if (!booting && userProfile && !hasHandledInitialNavigation.current) {
            console.log('[App] Auth complete, marking initial navigation as handled');
            hasHandledInitialNavigation.current = true;
        }
    }, [booting, userProfile]);

    // --- Handle AI Navigation ---
    const handleAINavigation = useCallback((context: NavigationContext) => {
        if (context.targetView === 'create_task_modal') {
            // Task creation is a modal, not a view change
            setIsTaskModalOpen(true);
            // If there's task data, we might need to pass it to the modal directly or via state
            // Since TaskFormModal doesn't take initialData yet, we can pass it via navContext
            // but we need to ensure we clear it when closing the modal.
            setNavContext(context);
        } else {
            // Standard View Navigation
            setCurrentView(context.targetView);
            setNavContext(context);
        }
    }, []);


    useEffect(() => {
        if (!currentView) return;
        const [view, param] = currentView.split('/');
        if (view === 'Student Profile' && param) {
            const studentId = Number(param);
            if (selectedStudent?.id !== studentId) {
                const student = students.find(s => s.id === studentId);
                if (student) {
                    setSelectedStudent(student);
                } else if (students.length > 0) {
                    // Only clear if we actually have students loaded and still didn't find a match
                    // This prevents clearing on initial load before students are fetched
                     setSelectedStudent(null);
                }
            }
        } else {
            if (selectedStudent) {
                setSelectedStudent(null);
            }
        }
    }, [currentView, students, selectedStudent]);
    
    // Note: Hash state management removed - using BrowserRouter path-based navigation
    
    // Redirect students only when they try to access unauthorized views
    // This should only trigger after authentication is complete (not during boot)
    useEffect(() => {
        // Redirect student if they're trying to access an unauthorized view
        if (userType === 'student' && !booting && userProfile && !isStudentAllowedView(currentView)) {
            console.log('[App] Student accessing unauthorized view, redirecting to My Subjects');
            setCurrentView(VIEWS.STUDENT_DASHBOARD);
        }
    }, [userType, currentView, booting, userProfile]);

    useEffect(() => {
        if (userProfile === undefined && session) {
            const timer = setTimeout(() => {
                setDbError("Request timed out. The server is taking too long to respond. Please check your internet connection or try again later.");
            }, 15000);
            return () => clearTimeout(timer);
        }
    }, [userProfile, session]);

    // --- ALERT GENERATION LOGIC ---
    useEffect(() => {
        if (reports.length > 0) {
            const criticalReports = reports.filter(r => 
                (r.analysis?.urgency === 'Critical' || r.analysis?.urgency === 'High') && 
                r.status !== 'treated'
            );
            
            const reportAlerts: Alert[] = criticalReports.map(r => ({
                id: r.id * 1000, 
                title: `${r.analysis?.urgency} Priority Report`,
                description: r.analysis?.summary || r.report_text.substring(0, 50) + '...',
                severity: r.analysis?.urgency as any,
                type: 'safety',
                sourceId: r.id,
                sourceType: 'report'
            }));

            setAlerts(prev => {
                const otherAlerts = prev.filter(a => a.sourceType !== 'report');
                return [...otherAlerts, ...reportAlerts];
            });
        }
    }, [reports]);

    // --- TASK REMINDERS LOGIC ---
    useEffect(() => {
        if (tasks.length === 0) return;

        const checkReminders = () => {
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            tasks.forEach(task => {
                if (task.status === TaskStatus.Completed) return;
                if (task.reminder_sent) return; 
                if (!task.reminder_minutes_before) return;

                let shouldNotify = false;
                let message = '';

                // Logic for reminders based on due date
                if (task.reminder_minutes_before >= 1440) {
                    // 1 Day before
                    if (task.due_date === tomorrowStr) {
                        shouldNotify = true;
                        message = `Reminder: Task "${task.title}" is due tomorrow.`;
                    }
                } else {
                    // Same day reminder (5, 30, 60 mins - treated as "Day of" for simplicity without due_time)
                    if (task.due_date === todayStr) {
                         shouldNotify = true;
                         message = `Reminder: Task "${task.title}" is due today.`;
                    }
                }

                if (shouldNotify) {
                    addToast(message, 'info');
                    // Mark as sent in DB
                    Offline.update('tasks', { reminder_sent: true }, { id: task.id });
                    // Optimistically update local state to prevent repeated toasts in this session
                    updateState(setTasks, { ...task, reminder_sent: true });
                }
            });
        };
        
        // Check immediately and then every minute
        checkReminders();
        const timer = setInterval(checkReminders, 60000);
        return () => clearInterval(timer);
    }, [tasks, addToast]);


    // --- REACTIVE AI ANALYSIS TRIGGER ---
    useEffect(() => {
        if (reports.length > 0 && students.length > 0 && !booting) {
            const timer = setTimeout(() => {
                analyzeAtRiskStudents(students, reports);
                generateTaskSuggestions(reports);
            }, 2000); // Debounce to prevent thrashing on rapid updates
            return () => clearTimeout(timer);
        }
    }, [reports, students, booting]);

    const analyzeAtRiskStudents = useCallback(async (allStudents: Student[], allReports: ReportRecord[]) => {
        const aiClient = getAIClient();
        if (!aiClient || allStudents.length === 0) {
            logAiEvent('at-risk-analysis', { status: 'unavailable', detail: 'missing-client-or-data' });
            return;
        }
        
        // Check if AI is in cooldown
        if (isAiInCooldown()) {
            console.log('AI in cooldown, skipping at-risk analysis');
            return;
        }
        
        const start = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        try {
            // Collect negative behavior reports
            const studentReportMap: Record<number, string[]> = {};
            allReports.forEach(r => {
                if(r.analysis?.sentiment === 'Negative') {
                    r.involved_students?.forEach((s: any) => {
                        const studentId = typeof s === 'number' ? s : s?.id;
                        if (studentId == null) return;
                        if (!studentReportMap[studentId]) studentReportMap[studentId] = [];
                        studentReportMap[studentId].push(r.report_text);
                    });
                }
            });
            
            // Extract attendance data from class groups
            const attendanceMap: Record<number, { present: number; total: number }> = {};
            classGroups.forEach(group => {
                group.members?.forEach(member => {
                    const records = member.records || [];
                    const presentCount = records.filter(r => r.status === 'Present' || r.status === 'Remote').length;
                    const totalCount = records.length;
                    if (totalCount > 0) {
                        const studentId = member.student_id;
                        if (!attendanceMap[studentId]) {
                            attendanceMap[studentId] = { present: 0, total: 0 };
                        }
                        attendanceMap[studentId].present += presentCount;
                        attendanceMap[studentId].total += totalCount;
                    }
                });
            });
            
            // Build comprehensive student data for AI analysis
            const studentDataForAI = allStudents.slice(0, 100).map(s => {
                const studentScores = scoreEntries.filter(e => e.student_id === s.id);
                const avgScore = studentScores.length > 0 
                    ? studentScores.reduce((sum, e) => sum + (e.total_score || 0), 0) / studentScores.length 
                    : null;
                const lowScores = studentScores.filter(e => (e.total_score || 0) < 50).length;
                
                const attendance = attendanceMap[s.id];
                const attendanceRate = attendance ? (attendance.present / attendance.total) * 100 : null;
                
                const termReports = studentTermReports.filter(tr => tr.student_id === s.id).slice(0, 3);
                
                return {
                    id: s.id,
                    name: s.name,
                    negativeReports: studentReportMap[s.id] || [],
                    academicPerformance: {
                        avgScore: avgScore ? Math.round(avgScore) : null,
                        lowScoreCount: lowScores,
                        totalScores: studentScores.length
                    },
                    attendance: attendanceRate ? Math.round(attendanceRate) : null,
                    termReportTrends: termReports.map(tr => ({
                        term: tr.term?.name,
                        avgGrade: tr.overall_average,
                        position: tr.class_position
                    }))
                };
            }).filter(s => 
                s.negativeReports.length > 0 || 
                (s.academicPerformance.avgScore !== null && s.academicPerformance.avgScore < 50) || 
                (s.attendance !== null && s.attendance < 85)
            );
            
            if (studentDataForAI.length === 0) { setAtRiskStudents([]); return; }
            
            const prompt = `Analyze student data to identify at-risk students. Consider: negative behavior reports, low academic scores (below 50%), poor attendance (below 85%), and declining trends. Return a JSON array of objects with "studentId" (number), "riskScore" (1-100), and "reasons" (array of short strings explaining specific concerns). Only include students with risk score > 60.

Student Data: ${JSON.stringify(studentDataForAI)}`;
            
            const response = await aiClient.chat.completions.create({ 
                model: schoolSettings?.ai_settings?.default_model || 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            });
            const results = extractAndParseJson<{ studentId: number, riskScore: number, reasons: string[] }[]>(textFromAI(response));
            if (results && Array.isArray(results)) {
                const atRiskData: AtRiskStudent[] = results.map(res => {
                    const student = allStudents.find(s => s.id === res.studentId);
                    return student ? { student, score: res.riskScore, reasons: res.reasons } : null;
                }).filter((s): s is AtRiskStudent => s !== null);
                setAtRiskStudents(atRiskData);
                logAiEvent('at-risk-analysis', { status: 'success', durationMs: (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - start, suggestions: results.length });
            }
        } catch (e: any) {
            console.error("At-risk student analysis failed:", e);
            if (isRateLimitError(e)) {
                setAiCooldown(); // Use default cooldown
                addToast('AI service is temporarily busy. Please try again in a few minutes.', 'warning');
            }
            logAiEvent('at-risk-analysis', { status: 'error', error: e, durationMs: (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - start });
        }
    }, [addToast, schoolSettings, classGroups, scoreEntries, studentTermReports]);

    // Generate fallback task suggestions based on user role and context
    const generateFallbackTaskSuggestions = useCallback((allReports: ReportRecord[], userRole: RoleTitle | undefined): SuggestedTask[] => {
        const urgentReports = allReports.filter(r => (r.analysis?.urgency === 'Critical' || r.analysis?.urgency === 'High') && !tasks.some(t => t.report_id === r.id));
        
        // Role-based default suggestions
        const roleBasedSuggestions: Record<string, Array<{ title: string; description: string; priority: TaskPriority; suggestedRole: string }>> = {
            'Admin': [
                { title: 'Review Urgent Reports', description: 'Check and address all high-priority reports that require immediate attention', priority: TaskPriority.High, suggestedRole: 'Admin' },
                { title: 'Update School Policies', description: 'Review and update school policies based on recent feedback', priority: TaskPriority.Medium, suggestedRole: 'Admin' },
                { title: 'Check System Health', description: 'Verify all school systems are operating correctly', priority: TaskPriority.Medium, suggestedRole: 'Admin' },
            ],
            'Principal': [
                { title: 'Review Staff Performance', description: 'Assess recent staff performance and provide feedback', priority: TaskPriority.High, suggestedRole: 'Principal' },
                { title: 'Address Parent Concerns', description: 'Review and respond to pending parent communications', priority: TaskPriority.High, suggestedRole: 'Principal' },
                { title: 'Weekly School Walkthrough', description: 'Conduct classroom observations and facility inspection', priority: TaskPriority.Medium, suggestedRole: 'Principal' },
            ],
            'Team Lead': [
                { title: 'Team Check-in Meeting', description: 'Schedule and conduct weekly team coordination meeting', priority: TaskPriority.Medium, suggestedRole: 'Team Lead' },
                { title: 'Review Team Reports', description: 'Check progress on team tasks and provide support where needed', priority: TaskPriority.High, suggestedRole: 'Team Lead' },
                { title: 'Monitor Team Attendance', description: 'Track team member attendance and address any patterns', priority: TaskPriority.Medium, suggestedRole: 'Team Lead' },
            ],
            'Teacher': [
                { title: 'Update Lesson Plans', description: 'Review and update lesson plans for the upcoming week', priority: TaskPriority.Medium, suggestedRole: 'Teacher' },
                { title: 'Grade Pending Assignments', description: 'Complete grading for submitted student work', priority: TaskPriority.High, suggestedRole: 'Teacher' },
                { title: 'Check Student Progress', description: 'Review students who may need additional support', priority: TaskPriority.Medium, suggestedRole: 'Teacher' },
            ],
            'Counselor': [
                { title: 'Follow up with At-Risk Students', description: 'Check in with students flagged for additional support', priority: TaskPriority.Critical, suggestedRole: 'Counselor' },
                { title: 'Review Intervention Plans', description: 'Update and assess effectiveness of current intervention strategies', priority: TaskPriority.High, suggestedRole: 'Counselor' },
                { title: 'Schedule Parent Conferences', description: 'Arrange meetings with parents of students needing support', priority: TaskPriority.High, suggestedRole: 'Counselor' },
            ],
            'Maintenance': [
                { title: 'Facility Safety Inspection', description: 'Conduct routine safety check of school facilities', priority: TaskPriority.High, suggestedRole: 'Maintenance' },
                { title: 'Address Pending Repairs', description: 'Complete outstanding maintenance requests', priority: TaskPriority.High, suggestedRole: 'Maintenance' },
                { title: 'Equipment Maintenance', description: 'Perform scheduled maintenance on school equipment', priority: TaskPriority.Medium, suggestedRole: 'Maintenance' },
            ],
        };

        const suggestions: SuggestedTask[] = [];
        
        // If there are urgent reports, prioritize creating tasks from those
        if (urgentReports.length > 0) {
            urgentReports.slice(0, 3).forEach((report, index) => {
                suggestions.push({
                    id: `fallback-report-${report.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    reportId: report.id,
                    title: `Address: ${report.analysis?.summary?.substring(0, 40) || 'Urgent Report'}...`,
                    description: report.analysis?.summary || report.report_text.substring(0, 100),
                    priority: report.analysis?.urgency === 'Critical' ? TaskPriority.Critical : TaskPriority.High,
                    suggestedRole: report.assigned_to_role || userRole || 'Admin',
                });
            });
        }
        
        // Add role-based suggestions if user role is available
        if (userRole && roleBasedSuggestions[userRole]) {
            const roleSuggestions = roleBasedSuggestions[userRole];
            const numToAdd = Math.min(3 - suggestions.length, roleSuggestions.length);
            
            for (let i = 0; i < numToAdd; i++) {
                const suggestion = roleSuggestions[i];
                suggestions.push({
                    id: `fallback-role-${userRole}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    title: suggestion.title,
                    description: suggestion.description,
                    priority: suggestion.priority,
                    suggestedRole: suggestion.suggestedRole,
                });
            }
        } else if (suggestions.length === 0) {
            // Generic fallback for roles without specific suggestions
            suggestions.push({
                id: `fallback-generic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: 'Review Pending Tasks',
                description: 'Check all pending tasks and prioritize important items',
                priority: TaskPriority.Medium,
                suggestedRole: userRole || 'Admin',
            });
        }
        
        return suggestions.slice(0, 5); // Return up to 5 suggestions
    }, [tasks]);

    const generateTaskSuggestions = useCallback(async (allReports: ReportRecord[]) => {
        const aiClient = getAIClient();
        if (!aiClient) {
            console.log('[AI Task Suggestions] AI client not available, using fallback suggestions');
            const fallbackSuggestions = generateFallbackTaskSuggestions(allReports, userProfile?.role);
            if (fallbackSuggestions.length > 0) {
                setTaskSuggestions(fallbackSuggestions);
                setAreFallbackSuggestions(true);
                addToast('AI suggestions unavailable - showing recommended tasks instead.', 'info');
            } else {
                console.log('[AI Task Suggestions] No fallback suggestions available');
            }
            logAiEvent('task-suggestions', { status: 'unavailable', detail: 'missing-client', suggestions: fallbackSuggestions.length });
            return;
        }

        // Check if AI is in cooldown
        if (isAiInCooldown()) {
            console.log('[AI Task Suggestions] AI in cooldown, using fallback suggestions');
            const fallbackSuggestions = generateFallbackTaskSuggestions(allReports, userProfile?.role);
            setTaskSuggestions(fallbackSuggestions);
            setAreFallbackSuggestions(true);
            logAiEvent('task-suggestions', { status: 'fallback', detail: 'cooldown', suggestions: fallbackSuggestions.length });
            return;
        }

        const start = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        try {
            const urgentReports = allReports.filter(r => (r.analysis?.urgency === 'Critical' || r.analysis?.urgency === 'High') && !tasks.some(t => t.report_id === r.id));
            
            // Additional task sources beyond urgent reports
            const lowStockItems = inventory.filter(item => item.quantity < (item.reorder_level || 10)).slice(0, 5);
            const pendingLeaveRequests = leaveRequests.filter(lr => lr.status === 'Pending').slice(0, 5);
            const overdueLessonPlans = lessonPlans.filter(lp => 
                lp.submission_status === 'Missed' || lp.submission_status === 'Late'
            ).slice(0, 5);
            const atRiskCount = atRiskStudents.length;
            
            // Build context for AI
            const contextData = {
                urgentReports: urgentReports.slice(0, 10).map(r => ({
                    id: r.id,
                    text: r.report_text.substring(0, 200),
                    summary: r.analysis?.summary,
                    urgency: r.analysis?.urgency
                })),
                lowStockItems: lowStockItems.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    reorderLevel: item.reorder_level
                })),
                pendingLeaveRequests: pendingLeaveRequests.map(lr => ({
                    teacherName: lr.requester?.name,
                    startDate: lr.start_date,
                    leaveType: lr.leave_type?.name
                })),
                overdueLessonPlans: overdueLessonPlans.map(lp => ({
                    teacherName: lp.author?.name,
                    title: lp.title,
                    status: lp.submission_status
                })),
                atRiskStudentsCount: atRiskCount
            };
            
            if (!hasTaskableData) {
                console.log('[AI Task Suggestions] No taskable data available');
                setTaskSuggestions([]);
                setAreFallbackSuggestions(false);
                logAiEvent('task-suggestions', { status: 'fallback', detail: 'no-taskable-data', suggestions: 0 });
                return;
            }
            
            console.log('[AI Task Suggestions] Generating AI suggestions with data:', {
                urgentReports: urgentReports.length,
                lowStock: lowStockItems.length,
                pendingLeave: pendingLeaveRequests.length,
                overduePlans: overdueLessonPlans.length,
                atRiskStudents: atRiskCount
            });
            
            const prompt = `Analyze the following school data and generate actionable task suggestions. Consider urgent reports, low inventory, pending leave requests, overdue lesson plans, and at-risk students. Return a JSON array of task objects with "reportId" (number or null), "title" (string, max 50 chars), "description" (string, max 150 chars), "priority" (string: 'Low', 'Medium', 'High', or 'Critical'), and "suggestedRole" (string: 'Admin', 'Principal', 'Counselor', 'Team Lead', 'Teacher', or 'Maintenance'). Prioritize high-impact tasks.

Context: ${JSON.stringify(contextData)}`;
            
            const response = await aiClient.chat.completions.create({
                model: schoolSettings?.ai_settings?.default_model || 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            });
            const results = extractAndParseJson<Omit<SuggestedTask, 'id'>[]>(textFromAI(response));
            if (results && Array.isArray(results)) {
                console.log('[AI Task Suggestions] Successfully generated', results.length, 'suggestions');
                const suggestions: SuggestedTask[] = results.map((res, idx) => ({
                    ...res,
                    id: `sugg-${res.reportId || 'auto'}-${Date.now()}-${idx}`
                }));
                setTaskSuggestions(suggestions);
                setAreFallbackSuggestions(false);
                logAiEvent('task-suggestions', { status: 'success', durationMs: (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - start, suggestions: suggestions.length });
            } else {
                console.warn('[AI Task Suggestions] AI returned invalid response format, using fallback');
                const fallbackSuggestions = generateFallbackTaskSuggestions(allReports, userProfile?.role);
                setTaskSuggestions(fallbackSuggestions);
                setAreFallbackSuggestions(true);
                logAiEvent('task-suggestions', { status: 'fallback', detail: 'invalid-response', durationMs: (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - start, suggestions: fallbackSuggestions.length });
            }
        } catch (e: any) {
            console.error('[AI Task Suggestions] Generation failed:', e);
            if (isRateLimitError(e)) {
                console.log('[AI Task Suggestions] Rate limit detected, setting cooldown and using fallback');
                setAiCooldown(); // Use default cooldown
                addToast('AI suggestions temporarily unavailable - showing recommended tasks', 'info');
                
                // Provide fallback suggestions instead of leaving the user with nothing
                const fallbackSuggestions = generateFallbackTaskSuggestions(allReports, userProfile?.role);
                setTaskSuggestions(fallbackSuggestions);
                setAreFallbackSuggestions(true);
                logAiEvent('task-suggestions', { status: 'fallback', detail: 'rate-limit', durationMs: (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - start, suggestions: fallbackSuggestions.length });
            } else {
                // For non-rate-limit errors, also provide fallback suggestions
                console.warn('[AI Task Suggestions] Using fallback suggestions due to error:', e.message || e);
                const fallbackSuggestions = generateFallbackTaskSuggestions(allReports, userProfile?.role);
                if (fallbackSuggestions.length > 0) {
                    setTaskSuggestions(fallbackSuggestions);
                    setAreFallbackSuggestions(true);
                    // Don't show toast for non-rate-limit errors - silent fallback
                } else {
                    console.log('[AI Task Suggestions] No fallback suggestions available after error');
                }
                logAiEvent('task-suggestions', { status: 'error', error: e, durationMs: (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - start, suggestions: fallbackSuggestions.length });
            }
        }
    }, [tasks, addToast, generateFallbackTaskSuggestions, userProfile, schoolSettings, inventory, leaveRequests, lessonPlans, atRiskStudents]);

    const handleGenerateForesight = useCallback(async (question: string): Promise<UPSSGPTResponse | null> => {
        const aiClient = getAIClient();
        if (!aiClient) { addToast("AI client is not available.", "error"); return null; }
        addToast("Consulting the Oracle...", "info");
        try {
            const context = `Recent Reports: ${reports.slice(0, 10).map(r => r.analysis?.summary || r.report_text.substring(0, 100)).join('; ')} At-Risk Students: ${atRiskStudents.length} students flagged. Team Performance: ${teamPulse.map(p => `${p.teamName} score: ${p.overallScore}`).join(', ')}`;
            const response = await askUPSSGPT(question, context);
            if (response.alerts.includes("AI Service Error")) { addToast(response.answer, "error"); return null; }
            return response;
        } catch (e: any) { addToast(`Foresight generation failed: ${e.message}`, 'error'); return null; }
    }, [addToast, reports, atRiskStudents, teamPulse]);

    const handleUpdateSchoolSettings = useCallback(async (settingsData: Partial<SchoolSettings>): Promise<boolean> => {
        if (!schoolSettings) return false;
        const supabase = requireSupabaseClient();
        const { data, error } = await supabase.from('schools').update(settingsData).eq('id', schoolSettings.id).select();
        if (error) { addToast(`Failed to update school settings: ${error.message}`, 'error'); return false; }
        if (data && data.length > 0) { setSchoolSettings(data[0]); addToast('School settings updated.', 'success'); return true; }
        addToast('Failed to apply settings update.', 'error'); return false;
    }, [schoolSettings, addToast]);
    
    const handleUpdateSchoolConfig = useCallback(async (config: Partial<SchoolConfig>): Promise<boolean> => {
        if (!userProfile || userType !== 'staff') return false;
        const staffProfile = userProfile as UserProfile;
        const { error } = await Offline.update('school_config', config, { school_id: staffProfile.school_id });
        if (error) { addToast(`Failed to update school config: ${error.message}`, 'error'); return false; }
        setSchoolConfig(prev => prev ? { ...prev, ...config } : null);
        addToast('Configuration updated.', 'success');
        return true;
    }, [userProfile, userType, addToast]);

    const handleSaveInventoryItem = useCallback(async (item: Partial<InventoryItem>) => {
        const supabase = requireSupabaseClient();
        if (!userProfile || userType !== 'staff') return false;
        const staffProfile = userProfile as UserProfile;
        let error;
        if (item.id) {
            ({ error } = await Offline.update('inventory_items', item, { id: item.id }));
        } else {
            ({ error } = await Offline.insert('inventory_items', { ...item, school_id: staffProfile.school_id }));
        }

        if (error) {
             addToast(`Error saving item: ${error.message}`, 'error');
             return false;
        }
        
        // Optimistic update or re-fetch could go here
        const { data } = await supabase.from('inventory_items').select('*');
        if(data) setInventory(data);
        
        addToast('Inventory saved.', 'success');
        return true;
    }, [userProfile, userType, addToast]);

    const handleDeleteInventoryItem = useCallback(async (id: number) => {
        const { error } = await Offline.del('inventory_items', { id });
        if (error) {
            addToast(`Error deleting item: ${error.message}`, 'error');
            return false;
        }
        setInventory(prev => prev.filter(i => i.id !== id));
        addToast('Item deleted.', 'success');
        return true;
    }, [addToast]);

    const handleGenerateHealthReport = useCallback(async () => {
         const aiClient = getAIClient();
         if (!aiClient || !session) { addToast("AI client is not configured.", "error"); return; }
         addToast("Generating School Health Report...", "info");
         try {
             // Extract attendance data from class groups
             const allAttendanceRecords: AttendanceRecord[] = [];
             classGroups.forEach(group => {
                 group.members?.forEach(member => {
                     if (member.records) {
                         allAttendanceRecords.push(...member.records);
                     }
                 });
             });
             const presentCount = allAttendanceRecords.filter(r => r.status === 'Present' || r.status === 'Remote').length;
             const studentAttendanceRate = allAttendanceRecords.length > 0 
                 ? (presentCount / allAttendanceRecords.length) * 100 
                 : 0;
             
             // Teacher attendance from checkins
             const today = new Date();
             const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
             const recentCheckins = teacherCheckins.filter(c => new Date(c.checkin_date) >= last7Days);
             const staffAttendanceRate = recentCheckins.length > 0
                 ? (recentCheckins.filter(c => c.status === 'Present').length / recentCheckins.length) * 100
                 : 0;
             
             // Academic performance
             const recentScores = scoreEntries.slice(0, 500);
             const avgAcademicScore = recentScores.length > 0
                 ? recentScores.reduce((sum, e) => sum + (e.total_score || 0), 0) / recentScores.length
                 : 0;
             
             // Lesson plan compliance
             const totalLessonPlans = lessonPlans.length;
             const submittedPlans = lessonPlans.filter(lp => lp.submission_status !== 'Missed').length;
             const lessonPlanComplianceRate = totalLessonPlans > 0 
                 ? (submittedPlans / totalLessonPlans) * 100 
                 : 100;
             
             const reportCount = reports.length;
             const taskCompletionRate = tasks.length > 0 ? (tasks.filter(t => t.status === TaskStatus.Completed).length / tasks.length) * 100 : 100;
             const atRiskCount = atRiskStudents.length;
             const positiveBehaviorCount = positiveRecords.length;
             const averageTeamPulse = teamPulse.length > 0 ? teamPulse.reduce((acc, p) => acc + p.overallScore, 0) / teamPulse.length : 0;
             
             const context = `Total Reports: ${reportCount}, Task Completion Rate: ${taskCompletionRate.toFixed(1)}%, At-Risk Students: ${atRiskCount}, Positive Behaviors: ${positiveBehaviorCount}, Team Pulse: ${averageTeamPulse.toFixed(1)}, Student Attendance: ${studentAttendanceRate.toFixed(1)}%, Staff Attendance: ${staffAttendanceRate.toFixed(1)}%, Average Academic Score: ${avgAcademicScore.toFixed(1)}, Lesson Plan Compliance: ${lessonPlanComplianceRate.toFixed(1)}%, Low Inventory Items: ${inventory.filter(i => i.quantity < (i.reorder_level || 10)).length}`;
             
             const prompt = `You are an AI school administrator. Generate a comprehensive "School Health Report" JSON with "overall_score" (0-100), "summary" (string), and "metrics" (array of {metric, score, summary}). Consider all aspects: academics, attendance, staff morale, operational efficiency, and resource management. Data: ${context}`;
             
             const response = await aiClient.chat.completions.create({
                model: schoolSettings?.ai_settings?.default_model || 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
             });
             const reportData = extractAndParseJson<Omit<SchoolHealthReport, 'generated_at'>>(textFromAI(response));
             if (!reportData) throw new Error("Invalid AI response");
             const newReport: SchoolHealthReport = { ...reportData, generated_at: new Date().toISOString() };
             await handleUpdateSchoolSettings({ school_documents: { ...schoolSettings?.school_documents, health_report: newReport } });
             addToast("School Health Report generated.", "success");
             if(session.user) fetchDataRef.current(session.user, true);
         } catch(e: any) { 
             console.error(e); 
             if (isRateLimitError(e)) {
                 addToast('AI service is temporarily busy. Please try again in a few minutes.', 'warning');
             } else {
                 addToast(`Failed: ${e.message}`, 'error');
             }
         }
    }, [session, addToast, reports, tasks, atRiskStudents, positiveRecords, teamPulse, schoolSettings, handleUpdateSchoolSettings, classGroups, teacherCheckins, scoreEntries, lessonPlans, inventory]);

    // ... (Existing handlers: tasks, announcements, etc.) ...
    const handleUpdateTaskStatus = useCallback(async (taskId: number, status: TaskStatus) => {
        const { error } = await Offline.update('tasks', { status, updated_at: new Date().toISOString() }, { id: taskId });
        if (error) {
            addToast(`Failed to update task: ${error.message}`, 'error');
        } else {
            updateState(setTasks, { ...tasks.find(t => t.id === taskId)!, status, updated_at: new Date().toISOString() });
        }
    }, [tasks, addToast]);

    const handleAddTask = useCallback(async (taskData: any): Promise<boolean> => {
        const sanitizedData = { ...taskData };
        if (sanitizedData.title && sanitizedData.title.length > 255) {
            sanitizedData.title = sanitizedData.title.substring(0, 255);
        }

        const { error, data } = await Offline.insert('tasks', sanitizedData);
        if (error) {
            addToast(`Failed to create task: ${error.message}`, 'error');
            return false;
        } else {
            if (data) addItem(setTasks, data);
            addToast('Task created successfully', 'success');
            return true;
        }
    }, [addToast]);

    const handleAddAnnouncement = useCallback(async (title: string, content: string) => {
        if (!userProfile) return;
        const authorName = 'name' in userProfile ? userProfile.name : (userProfile as StudentProfile).full_name;
        const { error, data } = await Offline.insert('announcements', { 
            title, 
            content, 
            school_id: userProfile.school_id, 
            author_id: userProfile.id 
        });
        if (error) {
            addToast(`Failed to post announcement: ${error.message}`, 'error');
        } else {
            if (data) addItem(setAnnouncements, { ...data, author: { name: authorName } });
            addToast('Announcement posted.', 'success');
        }
    }, [userProfile, addToast]);

    const handleUpdateAnnouncement = useCallback(async (id: number, data: { title: string, content: string }) => {
        const { error } = await Offline.update('announcements', data, { id });
        if (error) {
            addToast(`Failed to update announcement: ${error.message}`, 'error');
        } else {
            setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
            addToast('Announcement updated.', 'success');
        }
    }, [addToast]);

    const handleDeleteAnnouncement = useCallback(async (id: number) => {
        const { error } = await Offline.del('announcements', { id });
        if (error) {
            addToast(`Failed to delete announcement: ${error.message}`, 'error');
        } else {
            deleteItem(setAnnouncements, id);
            addToast('Announcement deleted.', 'success');
        }
    }, [addToast]);

    // ... (Handlers for staff awards, team feedback, etc.) ...
     const handleGenerateStaffAwards = useCallback(async () => {
        const aiClient = getAIClient();
        if (!aiClient) {
            addToast('AI client is not available.', 'error');
            return;
        }
        
        // Check if AI is in cooldown
        if (isAiInCooldown()) {
            addToast('AI service is cooling down. Please try again in a few minutes.', 'warning');
            return;
        }
        
        addToast('Analyzing staff performance...', 'info');
        
        try {
            // Gather staff performance data
            const staffData = users.slice(0, 50).map(staff => {
                // Count reports authored
                const reportsAuthored = reports.filter(r => r.author_id === staff.id).length;
                
                // Count positive mentions in reports
                const positiveMentions = reports.filter(r => 
                    r.analysis?.sentiment === 'Positive' && 
                    (r.report_text.toLowerCase().includes(staff.name.toLowerCase()) || 
                     r.involved_staff?.includes(staff.id))
                ).length;
                
                // Get teacher ratings
                const teacherRatings = weeklyRatings.filter(wr => wr.teacher_id === staff.id);
                const avgRating = teacherRatings.length > 0
                    ? teacherRatings.reduce((sum, r) => sum + (r.weighted_avg || 0), 0) / teacherRatings.length
                    : null;
                
                // Check punctuality from checkins
                const staffCheckins = teacherCheckins.filter(c => c.teacher_id === staff.id);
                const punctualCheckins = staffCheckins.filter(c => c.status === 'Present').length;
                const punctualityRate = staffCheckins.length > 0 
                    ? (punctualCheckins / staffCheckins.length) * 100 
                    : null;
                
                // Lesson plan compliance
                const staffLessonPlans = lessonPlans.filter(lp => lp.author_id === staff.id);
                const onTimePlans = staffLessonPlans.filter(lp => 
                    lp.submission_status === 'On Time' || lp.submission_status === 'Early'
                ).length;
                const lessonPlanCompliance = staffLessonPlans.length > 0
                    ? (onTimePlans / staffLessonPlans.length) * 100
                    : null;
                
                // Leave usage (lower is better for dedication indicator)
                const staffLeaveRequests = leaveRequests.filter(lr => 
                    lr.requester_id === staff.id && lr.status === 'Approved'
                );
                
                return {
                    id: staff.id,
                    name: staff.name,
                    role: staff.role,
                    reportsAuthored,
                    positiveMentions,
                    avgRating: avgRating ? avgRating.toFixed(1) : null,
                    punctualityRate: punctualityRate ? punctualityRate.toFixed(0) : null,
                    lessonPlanCompliance: lessonPlanCompliance ? lessonPlanCompliance.toFixed(0) : null,
                    leaveRequestCount: staffLeaveRequests.length
                };
            }).filter(s => 
                // Include staff with notable achievements
                s.reportsAuthored > 5 || 
                s.positiveMentions > 0 || 
                (s.avgRating !== null && parseFloat(s.avgRating) >= 4) ||
                (s.punctualityRate !== null && parseFloat(s.punctualityRate) >= 90) ||
                (s.lessonPlanCompliance !== null && parseFloat(s.lessonPlanCompliance) >= 90)
            );
            
            if (staffData.length === 0) {
                addToast('Not enough staff performance data to generate awards.', 'info');
                return;
            }
            
            const prompt = `Analyze staff performance data and generate awards for outstanding staff members. Consider: productivity (reports authored), positive feedback, student ratings, punctuality, lesson plan compliance, and dedication (low leave usage). Return a JSON array of award objects with "staff_id" (string), "staff_name" (string), "award_type" (string: e.g., "Outstanding Teacher", "Exemplary Dedication", "Student Favorite"), and "reason" (string, max 150 chars explaining why). Generate up to 5 awards for the most deserving staff.

Staff Performance Data: ${JSON.stringify(staffData)}`;
            
            const response = await aiClient.chat.completions.create({
                model: schoolSettings?.ai_settings?.default_model || 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            });
            
            const result = extractAndParseJson<{ staff_id: string; staff_name: string; award_type: string; reason: string }[]>(textFromAI(response));
            
            if (result && Array.isArray(result) && result.length > 0) {
                const newAwards: StaffAward[] = result.map(award => ({
                    id: Date.now() + Math.random(),
                    school_id: userProfile?.school_id || 1,
                    recipient_id: award.staff_id,
                    recipient_name: award.staff_name,
                    award_type: award.award_type,
                    reason: award.reason,
                    created_at: new Date().toISOString(),
                    source_report_ids: []
                }));
                
                setStaffAwards(prev => [...newAwards, ...prev]);
                addToast(`${newAwards.length} staff award(s) generated!`, 'success');
            } else {
                addToast('No awards generated. Staff may already be recognized or need more performance data.', 'info');
            }
        } catch (e: any) {
            console.error('Staff awards generation error:', e);
            if (isRateLimitError(e)) {
                setAiCooldown();
                addToast('AI service is temporarily busy. Please try again in a few minutes.', 'warning');
            } else {
                addToast('Failed to generate staff awards. Please try again.', 'error');
            }
        }
    }, [addToast, users, reports, weeklyRatings, teacherCheckins, lessonPlans, leaveRequests, userProfile, schoolSettings]);

    const handleAnalyzeTeacherRisk = useCallback(async () => {
         const aiClient = getAIClient();
         if (!aiClient) return;
         addToast('Analyzing teacher risk factors...', 'info');
         
         try {
            // Gather comprehensive teacher data
            const teacherData = users.filter(u => u.role === 'Teacher' || u.role === 'Team Lead').slice(0, 50).map(teacher => {
                // Check checkin patterns
                const checkins = teacherCheckins.filter(c => c.teacher_id === teacher.id);
                const lateCheckins = checkins.filter(c => c.status === 'Late').length;
                const checkinRate = checkins.length > 0 ? (lateCheckins / checkins.length) * 100 : 0;
                
                // Mood trends from checkins
                const recentMoods = checkins.slice(0, 10).map(c => c.mood).filter(Boolean);
                const negativeMoodCount = recentMoods.filter(m => 
                    m === 'stressed' || m === 'frustrated' || m === 'overwhelmed'
                ).length;
                
                // Leave patterns
                const teacherLeaveRequests = leaveRequests.filter(lr => lr.requester_id === teacher.id);
                const recentLeaves = teacherLeaveRequests.filter(lr => {
                    const leaveDate = new Date(lr.start_date);
                    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                    return leaveDate >= thirtyDaysAgo;
                }).length;
                
                // Lesson plan submission compliance
                const teacherLessonPlans = lessonPlans.filter(lp => lp.author_id === teacher.id);
                const missedOrLatePlans = teacherLessonPlans.filter(lp => 
                    lp.submission_status === 'Missed' || lp.submission_status === 'Late'
                ).length;
                const complianceIssues = teacherLessonPlans.length > 0
                    ? (missedOrLatePlans / teacherLessonPlans.length) * 100
                    : 0;
                
                // Student ratings
                const ratings = weeklyRatings.filter(wr => wr.teacher_id === teacher.id);
                const avgRating = ratings.length > 0
                    ? ratings.reduce((sum, r) => sum + (r.weighted_avg || 0), 0) / ratings.length
                    : null;
                
                // Team feedback scores
                const feedback = teamFeedback.filter(tf => tf.author_id === teacher.id);
                const avgTeamFeedback = feedback.length > 0
                    ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length
                    : null;
                
                // Negative reports about the teacher
                const negativeReports = reports.filter(r => 
                    r.analysis?.sentiment === 'Negative' && 
                    (r.report_text.toLowerCase().includes(teacher.name.toLowerCase()) ||
                     r.involved_staff?.includes(teacher.id))
                );
                
                return {
                    name: teacher.name,
                    role: teacher.role,
                    lateCheckinRate: checkinRate.toFixed(0),
                    negativeMoodCount,
                    recentLeaveCount: recentLeaves,
                    lessonPlanComplianceIssues: complianceIssues.toFixed(0),
                    avgStudentRating: avgRating ? avgRating.toFixed(1) : null,
                    avgTeamFeedback: avgTeamFeedback ? avgTeamFeedback.toFixed(1) : null,
                    negativeReportsCount: negativeReports.length
                };
            }).filter(t => 
                // Filter to teachers showing potential risk factors
                parseFloat(t.lateCheckinRate) > 20 ||
                t.negativeMoodCount > 3 ||
                t.recentLeaveCount > 2 ||
                parseFloat(t.lessonPlanComplianceIssues) > 30 ||
                (t.avgStudentRating !== null && parseFloat(t.avgStudentRating) < 3) ||
                t.negativeReportsCount > 0
            );
            
            if (teacherData.length === 0) {
                setAtRiskTeachers([]);
                addToast('Analysis complete. No high-risk factors detected.', 'success');
                return;
            }
            
            const prompt = `Analyze teacher data for signs of burnout, stress, or performance issues. Consider: late arrivals, negative moods, frequent leave, poor lesson plan compliance, low student ratings, team feedback, and negative reports. Return a JSON array of objects with "teacherName" (string), "riskScore" (1-100), and "reasons" (array of specific concerns). Only include high-risk cases (score > 60).

Teacher Data: ${JSON.stringify(teacherData)}`;
            
            const response = await aiClient.chat.completions.create({
                model: schoolSettings?.ai_settings?.default_model || 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            });

            const risks = extractAndParseJson<{ teacherName: string, riskScore: number, reasons: string[] }[]>(textFromAI(response));
            
            if (risks && Array.isArray(risks) && risks.length > 0) {
                const mappedRisks: AtRiskTeacher[] = risks.map(r => {
                    const teacher = users.find(u => u.name === r.teacherName);
                    return teacher ? { teacher, score: r.riskScore, reasons: r.reasons } : null;
                }).filter((r): r is AtRiskTeacher => r !== null);
                setAtRiskTeachers(mappedRisks);
                addToast(`Identified ${mappedRisks.length} potential risk ${mappedRisks.length === 1 ? 'case' : 'cases'}.`, 'warning');
            } else {
                setAtRiskTeachers([]);
                addToast('Analysis complete. No high-risk factors detected.', 'success');
            }
         } catch (e: any) {
             console.error(e);
             if (isRateLimitError(e)) {
                 addToast('AI service is temporarily busy. Please try again in a few minutes.', 'warning');
             } else {
                 addToast('Failed to analyze risks.', 'error');
             }
         }
    }, [users, addToast, schoolSettings, teacherCheckins, leaveRequests, lessonPlans, weeklyRatings, teamFeedback, reports]);

    const handleSaveTeamFeedback = useCallback(async (teamId: number, rating: number, comments: string | null): Promise<boolean> => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return false;
        const weekStart = getWeekStartDateString(new Date());
        const { error } = await supabase.from('team_feedback').upsert({
            team_id: teamId,
            author_id: userProfile.id,
            week_start_date: weekStart,
            rating,
            comments
        });
        if (error) {
            addToast(`Error saving feedback: ${error.message}`, 'error');
            return false;
        }
        addToast('Feedback submitted.', 'success');
        return true;
    }, [userProfile, addToast]);

    // ... (Handlers for policy, curriculum report, profile, daily digest) ...
    const handleGeneratePolicyInquiries = useCallback(async () => {
        const aiClient = getAIClient();
        if (!aiClient) return;
        addToast('Scanning for policy gaps...', 'info');
        
        try {
            const incidents = reports.filter(r => r.report_type === ReportType.Incident).slice(0, 20);
            
            // Extract attendance records from class groups
            const allAttendanceRecords: AttendanceRecord[] = [];
            classGroups.forEach(group => {
                group.members?.forEach(member => {
                    if (member.records) {
                        allAttendanceRecords.push(...member.records);
                    }
                });
            });
            
            // Find attendance anomalies (excessive absences)
            const attendanceIssues = allAttendanceRecords.filter(r => 
                r.status === 'Absent' || r.status === 'Late'
            ).length;
            
            // Check leave patterns that might indicate policy gaps
            const frequentLeaves = leaveRequests.filter(lr => lr.status === 'Approved');
            const leaveTypeDistribution: Record<string, number> = {};
            frequentLeaves.forEach(lr => {
                const type = lr.leave_type?.name || 'Unknown';
                leaveTypeDistribution[type] = (leaveTypeDistribution[type] || 0) + 1;
            });
            
            // Checkin anomalies
            const lateCheckins = teacherCheckins.filter(c => c.status === 'Late').length;
            const missedCheckouts = teacherCheckins.filter(c => !c.checkout_time && c.status === 'Present').length;
            
            // Low stock patterns suggesting procurement policy issues
            const lowStockItems = inventory.filter(item => item.quantity < (item.reorder_level || 10));
            
            const contextData = {
                incidentReports: incidents.map(r => ({
                    type: r.report_type,
                    text: r.report_text.substring(0, 150),
                    category: r.category
                })),
                attendanceAnomalies: {
                    totalAbsences: attendanceIssues,
                    concernLevel: attendanceIssues > 50 ? 'high' : 'normal'
                },
                leavePatterns: leaveTypeDistribution,
                checkinIssues: {
                    lateArrivals: lateCheckins,
                    missedCheckouts: missedCheckouts
                },
                inventoryIssues: {
                    lowStockCount: lowStockItems.length,
                    categories: lowStockItems.map(i => i.category).filter(Boolean)
                }
            };
            
            const prompt = `Analyze school operational data to identify policy gaps or areas needing clearer guidelines. Look for patterns in incidents, attendance issues, leave requests, checkin violations, and inventory management that suggest unclear or missing policies. Return a JSON array of policy inquiry objects with "category" (string), "question" (string), and "context" (string explaining the pattern observed). Generate 3-5 most important policy questions.

Operational Data: ${JSON.stringify(contextData)}`;
            
            const response = await aiClient.chat.completions.create({
                model: schoolSettings?.ai_settings?.default_model || 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            });
            
            const inquiries = extractAndParseJson<PolicyInquiry[]>(textFromAI(response));
            if (inquiries && Array.isArray(inquiries)) {
                setPolicyInquiries(inquiries.map(i => ({ ...i, id: String(Date.now() + Math.random()) })));
                addToast('Policy inquiries generated.', 'success');
            }
        } catch (e: any) {
            console.error(e);
            if (isRateLimitError(e)) {
                addToast('AI service is temporarily busy. Please try again in a few minutes.', 'warning');
            } else {
                addToast('Failed to generate inquiries.', 'error');
            }
        }
    }, [reports, addToast, schoolSettings, classGroups, leaveRequests, teacherCheckins, inventory]);

    const handleGenerateCurriculumReport = useCallback(async () => {
        const aiClient = getAIClient();
        if (!aiClient) return;
        addToast('Generating curriculum report...', 'info');
        
        try {
            const submittedPlans = lessonPlans.filter(p => p.submission_status !== 'Missed');
            const submissionRate = lessonPlans.length > 0 ? Math.round((submittedPlans.length / lessonPlans.length) * 100) : 0;
            
            // Get coverage data from lesson plans
            const coverageData = lessonPlans.slice(0, 50).map(lp => ({
                teacher: lp.author?.name,
                class: lp.teaching_entity?.academic_class?.name,
                title: lp.title,
                coverageStatus: lp.coverage_status,
                submissionStatus: lp.submission_status
            }));
            
            // Get expected curriculum weeks for comparison
            const weeklyExpectations = curriculumWeeks.slice(0, 20).map(cw => ({
                weekNumber: cw.week_number,
                expectedTopics: cw.topics,
                learningObjectives: cw.learning_objectives
            }));
            
            // Get teaching assignments for context
            const assignments = academicAssignments.slice(0, 30).map(a => ({
                teacher: a.teacher?.name,
                class: a.academic_class?.name,
                subjectId: a.subject_id
            }));
            
            // Get student performance data to identify coverage-performance correlation
            const subjectPerformance: Record<number, { avgScore: number; count: number }> = {};
            scoreEntries.forEach(se => {
                if (se.subject_id) {
                    if (!subjectPerformance[se.subject_id]) {
                        subjectPerformance[se.subject_id] = { avgScore: 0, count: 0 };
                    }
                    subjectPerformance[se.subject_id].avgScore += se.total_score || 0;
                    subjectPerformance[se.subject_id].count += 1;
                }
            });
            
            // Calculate average scores per subject
            const performanceBySubject = Object.entries(subjectPerformance).map(([subjectId, data]) => ({
                subjectId: parseInt(subjectId),
                avgScore: data.count > 0 ? (data.avgScore / data.count).toFixed(1) : '0'
            }));
            
            const prompt = `Analyze curriculum delivery and identify coverage gaps or topics falling behind. Consider lesson plan submissions, coverage status, expected weekly topics, teacher assignments, and student performance by subject. Identify if poor coverage correlates with poor student scores. Return a JSON object with "summary" (string), "coverage_gaps" (array of {teacher_name, class_name, topic, suggestion, student_performance_impact}).

Data:
- Lesson Plans: ${JSON.stringify(coverageData)}
- Expected Curriculum: ${JSON.stringify(weeklyExpectations)}
- Teaching Assignments: ${JSON.stringify(assignments)}
- Subject Performance: ${JSON.stringify(performanceBySubject)}
- Overall Submission Rate: ${submissionRate}%`;
            
            const response = await aiClient.chat.completions.create({
                model: schoolSettings?.ai_settings?.default_model || 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            });
            
            const analysis = extractAndParseJson<any>(textFromAI(response));
            
            if (analysis) {
                const report: CurriculumReport = {
                    generated_at: new Date().toISOString(),
                    summary: analysis.summary,
                    submission_rate: submissionRate,
                    late_submissions: lessonPlans.filter(p => p.submission_status === 'Late').length,
                    coverage_gaps: (Array.isArray(analysis.coverage_gaps) ? analysis.coverage_gaps : [])
                };
                setCurriculumReport(report);
                addToast('Curriculum report generated.', 'success');
            }
        } catch (e: any) {
            console.error(e);
            if (isRateLimitError(e)) {
                addToast('AI service is temporarily busy. Please try again in a few minutes.', 'warning');
            } else {
                addToast('Failed to generate report.', 'error');
            }
        }
    }, [lessonPlans, addToast, schoolSettings, curriculumWeeks, academicAssignments, scoreEntries]);

    const handleUpdateProfile = useCallback(async (data: Partial<UserProfile>): Promise<boolean> => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return false;
        const { error } = await supabase.from('user_profiles').update(data).eq('id', userProfile.id);
        if (error) {
            addToast(`Update failed: ${error.message}`, 'error');
            return false;
        }
        setUserProfile(prev => prev ? ({ ...prev, ...data } as UserProfile) : null);
        addToast('Profile updated successfully.', 'success');
        return true;
    }, [userProfile, addToast]);
    
    const handleUpdatePassword = useCallback(async (password: string): Promise<void> => {
        const supabase = requireSupabaseClient();
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
             addToast(`Password update failed: ${error.message}`, 'error');
        } else {
             addToast('Password updated successfully!', 'success');
        }
    }, [addToast]);

    const handleProcessDailyDigest = useCallback(async (): Promise<DailyBriefing | null> => {
        const aiClient = getAIClient();
        if (!aiClient) return null;
        
        try {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentReports = reports.filter(r => new Date(r.created_at) > oneDayAgo);
            const pendingTasks = tasks.filter(t => t.status !== TaskStatus.Completed);
            
            // Today's staff attendance from checkins
            const today = todayISO();
            const todayCheckins = teacherCheckins.filter(c => c.checkin_date === today);
            const presentStaff = todayCheckins.filter(c => c.status === 'Present').length;
            const totalExpectedStaff = users.filter(u => u.role !== 'Admin').length;
            const staffAttendanceRate = totalExpectedStaff > 0 ? (presentStaff / totalExpectedStaff) * 100 : 0;
            
            // Staff mood summary
            const moodCounts: Record<string, number> = {};
            todayCheckins.forEach(c => {
                if (c.mood) {
                    moodCounts[c.mood] = (moodCounts[c.mood] || 0) + 1;
                }
            });
            
            // Upcoming approved leaves (next 7 days)
            const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const upcomingLeaves = leaveRequests.filter(lr => {
                const startDate = new Date(lr.start_date);
                return lr.status === 'Approved' && startDate >= new Date() && startDate <= sevenDaysFromNow;
            }).map(lr => ({
                teacher: lr.requester?.name,
                startDate: lr.start_date,
                type: lr.leave_type?.name
            }));
            
            // Low stock alerts
            const lowStockAlerts = inventory.filter(i => i.quantity < (i.reorder_level || 10)).map(i => ({
                name: i.name,
                quantity: i.quantity,
                reorderLevel: i.reorder_level
            }));
            
            // Upcoming assessment deadlines
            const upcomingAssessments = assessments.filter(a => {
                if (!a.due_date) return false;
                const dueDate = new Date(a.due_date);
                return dueDate >= new Date() && dueDate <= sevenDaysFromNow;
            }).map(a => ({
                title: a.title,
                dueDate: a.due_date,
                class: a.assignment?.academic_class?.name
            }));
            
            // Current at-risk student count
            const atRiskCount = atRiskStudents.length;
            
            // Team morale scores
            const teamMoraleScores = teamPulse.map(tp => ({
                team: tp.teamName,
                score: tp.overallScore
            }));
            
            const contextData = {
                recentReports: recentReports.slice(0, 20).map(r => ({ 
                    type: r.report_type, 
                    text: r.report_text.substring(0, 150), 
                    sentiment: r.analysis?.sentiment 
                })),
                pendingTasks: pendingTasks.slice(0, 15).map(t => ({ title: t.title, priority: t.priority })),
                staffAttendance: {
                    rate: staffAttendanceRate.toFixed(0),
                    presentCount: presentStaff,
                    totalExpected: totalExpectedStaff,
                    moodSummary: moodCounts
                },
                upcomingLeaves: upcomingLeaves.slice(0, 10),
                lowStockAlerts: lowStockAlerts.slice(0, 5),
                upcomingAssessments: upcomingAssessments.slice(0, 5),
                atRiskStudentsCount: atRiskCount,
                teamMorale: teamMoraleScores
            };
            
            const prompt = `Generate a comprehensive Daily Briefing for the school principal.

Context Data: ${JSON.stringify(contextData)}
            
Return a JSON object with:
- daily_summary: A concise paragraph summarizing key events and priorities for today.
- morale_forecast: A short prediction of school morale (Positive, Neutral, Negative) with a reason based on staff attendance, mood, and team pulse.
- resource_allocation_suggestions: Array of strings suggesting where to focus attention (e.g., low stock items, upcoming leaves, at-risk students).
- parent_communication_points: Array of strings for potential parent updates (e.g., upcoming assessments, school events).
`;
            
            const response = await aiClient.chat.completions.create({
                model: schoolSettings?.ai_settings?.default_model || 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            });
            
            const digest = extractAndParseJson<Omit<DailyBriefing, 'generated_at'>>(textFromAI(response));
            if (digest && typeof digest === 'object') {
                return { ...digest, generated_at: new Date().toISOString() };
            }
            throw new Error("Failed to parse digest");
        } catch (e: any) {
            console.error(e);
            if (isRateLimitError(e)) {
                addToast('AI service is temporarily busy. Please try again in a few minutes.', 'warning');
            } else {
                addToast("Failed to generate daily briefing.", "error");
            }
            return null;
        }
    }, [reports, tasks, addToast, schoolSettings, teacherCheckins, users, leaveRequests, inventory, assessments, atRiskStudents, teamPulse]);

    const handleAcceptTaskSuggestion = useCallback(async (suggestion: SuggestedTask, assigneeId: string) => {
        if (!userProfile) return;
        const success = await handleAddTask({
            title: suggestion.title,
            description: suggestion.description,
            priority: suggestion.priority,
            status: TaskStatus.ToDo,
            due_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
            user_id: assigneeId,
            school_id: userProfile.school_id,
        });
        if (success) {
            setTaskSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        }
    }, [handleAddTask, userProfile]);

    const handleDismissTaskSuggestion = useCallback((suggestionId: string) => {
        setTaskSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    }, []);

    const handleCheckinOut = useCallback(async (notes?: string | null, isRemote?: boolean, location?: { lat: number; lng: number } | null, photoUrl?: string | null, mood?: TeacherMood | null): Promise<boolean> => {
        if (!userProfile) return false;
        // Only teachers (staff) can check in. StudentProfile doesn't have campus_id in types.
        if (userType !== 'staff') return false;
        const staffProfile = userProfile as UserProfile;
        
        const today = todayISO();
        const existing = teacherCheckins.find(c => c.teacher_id === staffProfile.id && c.checkin_date === today);

        if (existing && !existing.checkout_time) {
            const { data, error } = await checkOutToday(notes || null);
             if (error) {
                addToast(error, 'error');
                return false;
            } else {
                // Optimistic update
                const updated = { ...existing, checkout_time: new Date().toISOString(), checkout_notes: notes };
                setTeacherCheckins(prev => prev.map(c => c.id === existing.id ? updated : c));
                return true;
            }
        } else if (!existing) {
            const { data, error, offlineQueued } = await checkInToday({
                is_remote: isRemote || false,
                notes: notes || null,
                geo_lat: location?.lat,
                geo_lng: location?.lng,
                campus_id: staffProfile.campus_id,
                photo_url: photoUrl,
                mood: mood
            });
             if (error) {
                addToast(error, 'error');
                return false;
            } else {
                if(offlineQueued) {
                     // Creating a temporary optimistic record
                    const temp: TeacherCheckin = {
                        id: Date.now(),
                        teacher_id: staffProfile.id,
                        school_id: staffProfile.school_id,
                        checkin_date: today,
                        created_at: new Date().toISOString(),
                        status: isRemote ? 'Remote' : 'Present',
                        notes: notes || null,
                        photo_url: photoUrl || null,
                        mood: mood || null
                    };
                    setTeacherCheckins(prev => [temp, ...prev]);
                } else if(data) {
                    setTeacherCheckins(prev => [data, ...prev]);
                }
                return true;
            }
        }
        return false;
    }, [userProfile, userType, teacherCheckins, addToast]);

    // ... (Report handlers)
    const handleAddReport = useCallback(async (data: any) => {
        if (!userProfile) return;
        
        // ADDED: Real-time AI Analysis logic
        let analysis = null;
        const aiClient = getAIClient();
        if (aiClient && data.report_text) {
            try {
                const prompt = `Analyze this school report for sentiment, urgency, and summary.
                Report: "${data.report_text}"
                Type: ${data.report_type}
                
                Return JSON:
                {
                "sentiment": "Positive" | "Negative" | "Neutral",
                "urgency": "Low" | "Medium" | "High" | "Critical",
                "summary": "Short summary (max 15 words)"
                }`;
                
                const response = await aiClient.chat.completions.create({
                    model: schoolSettings?.ai_settings?.default_model || 'llama-3.1-8b-instant',
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' }
                });
                
                analysis = extractAndParseJson(textFromAI(response));
            } catch (e: any) {
                console.error("Real-time analysis failed", e);
                if (isRateLimitError(e)) {
                    // Silently skip analysis on rate limit for report submission
                    // Don't show toast here as it's not critical to report submission
                    console.debug("AI rate limit hit during report submission - skipping analysis");
                }
            }
        }

        let imageUrl = null;
        // Handle Image Upload
        if (data.image_data) {
             try {
                 const { base64, mimeType } = data.image_data;
                 const blob = base64ToBlob(base64, mimeType);
                 const fileName = `${Date.now()}_report_img.${mimeType.split('/')[1]}`;
                 const filePath = `reports/${userProfile.id}/${fileName}`;
                 
                 // Use Offline upload handling
                 const uploadResult = await Offline.upload('report_images', filePath, blob);
                 
                 if (uploadResult.error) {
                     console.error("Image upload failed:", uploadResult.error);
                     addToast("Failed to upload image, report will be submitted without it.", "warning");
                 } else {
                     // Standard Supabase public URL pattern:
                     const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                     imageUrl = `${supabaseUrl}/storage/v1/object/public/report_images/${filePath}`;
                 }
             } catch (e) {
                 console.error("Image processing error:", e);
             }
        }

        // Destructure image_data out of payload to avoid DB errors
        const { image_data, ...reportData } = data;
        const payload = {
            ...reportData,
            school_id: userProfile.school_id,
            author_id: userProfile.id,
            analysis: analysis,
            image_url: imageUrl
        };

        const { error, data: newReport } = await Offline.insert('reports', payload);

        if (error) {
             addToast(`Failed to submit report: ${error.message}`, 'error');
        } else {
             // Handle offline optimistic update or online real update
             if(newReport) {
                const fullReport = { ...newReport, author: userProfile, analysis };
                addItem(setReports, fullReport);
                // Trigger immediate re-analysis with new data
                analyzeAtRiskStudents(students, [fullReport, ...reports]);
                generateTaskSuggestions([fullReport, ...reports]);
             } else {
                 // Optimistic offline handling - create a temp object to show immediate feedback if desired, 
                 // or just rely on the toast. For robust offline UX, we'd add it to state with a 'pending' flag.
                 // For now, just toast.
             }
             addToast('Report submitted successfully.', 'success');
             // Ideally trigger navigation back to feed
             setCurrentView(VIEWS.REPORT_FEED);
        }
    }, [userProfile, addToast, analyzeAtRiskStudents, generateTaskSuggestions, students, reports]);

    const handleAssignReport = useCallback(async (reportId: number, assigneeId: string | null) => {
        const { error } = await Offline.update('reports', { assignee_id: assigneeId }, { id: reportId });
        if (error) addToast(`Failed to assign: ${error.message}`, 'error');
        else {
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, assignee_id: assigneeId, assignee: users.find(u => u.id === assigneeId) } : r));
            addToast('Report assigned.', 'success');
        }
    }, [users, addToast]);

    const handleAddReportComment = useCallback(async (reportId: number, commentText: string) => {
        if (!userProfile) return;
        const { error, data } = await Offline.insert('report_comments', { report_id: reportId, author_id: userProfile.id, comment_text: commentText });
        if (error) addToast(`Failed to comment: ${error.message}`, 'error');
        else {
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, comments: [...(r.comments || []), { ...data, author: userProfile }] } : r));
        }
    }, [userProfile, addToast]);

    const handleDeleteReport = useCallback(async (reportId: number) => {
        const { error } = await Offline.del('reports', { id: reportId });
        if (error) addToast(`Failed to delete: ${error.message}`, 'error');
        else {
            const updatedReports = reports.filter(r => r.id !== reportId);
            setReports(updatedReports);
            // Re-run analysis on deletion
            analyzeAtRiskStudents(students, updatedReports);
            generateTaskSuggestions(updatedReports);
            addToast('Report deleted.', 'success');
        }
    }, [addToast, reports, students, analyzeAtRiskStudents, generateTaskSuggestions]);

    const handleUpdateReportStatusAndResponse = useCallback(async (reportId: number, status: 'pending' | 'treated', responseText: string | null) => {
        if (!userProfile) return false;

        // 1. Update Report Status and Response Text
        const { error } = await Offline.update('reports', { status, response: responseText }, { id: reportId });
        if (error) {
            addToast(`Failed to update status: ${error.message}`, 'error');
            return false;
        } else {
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, status, response: responseText } : r));
            
            // 2. Create a notification Task for the author if treated and responded
            if (status === 'treated' && responseText) {
                const report = reports.find(r => r.id === reportId);
                if (report && report.author_id) {
                    const taskCreated = await handleAddTask({
                        title: `Response to Report #${report.id}`,
                        description: `Response: ${responseText.substring(0, 100)}...`,
                        priority: TaskPriority.Medium,
                        status: TaskStatus.ToDo,
                        due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Due tomorrow
                        user_id: report.author_id,
                        report_id: report.id,
                        school_id: userProfile.school_id,
                    });
                    if (taskCreated) {
                        addToast('Report updated and author notified via task.', 'success');
                    } else {
                        addToast('Report updated, but failed to notify author.', 'info');
                    }
                } else {
                    addToast('Report updated.', 'success');
                }
            } else {
                addToast('Report updated.', 'success');
            }
            return true;
        }
    }, [addToast, reports, userProfile, handleAddTask]);

    const handleBulkDeleteReports = useCallback(async (reportIds: number[]) => {
        const supabase = requireSupabaseClient();
        const { error } = await supabase.from('reports').delete().in('id', reportIds);
        if (error) addToast(`Bulk delete failed: ${error.message}`, 'error');
        else {
            const updatedReports = reports.filter(r => !reportIds.includes(r.id));
            setReports(updatedReports);
            analyzeAtRiskStudents(students, updatedReports);
            generateTaskSuggestions(updatedReports);
            addToast(`${reportIds.length} reports deleted.`, 'success');
        }
    }, [addToast, reports, students, analyzeAtRiskStudents, generateTaskSuggestions]);

    const handleBulkAssignReports = useCallback(async (reportIds: number[], assigneeId: string | null) => {
        const supabase = requireSupabaseClient();
        const { error } = await supabase.from('reports').update({ assignee_id: assigneeId }).in('id', reportIds);
        if (error) addToast(`Bulk assign failed: ${error.message}`, 'error');
        else {
            setReports(prev => prev.map(r => reportIds.includes(r.id) ? { ...r, assignee_id: assigneeId, assignee: users.find(u => u.id === assigneeId) } : r));
            addToast(`${reportIds.length} reports assigned.`, 'success');
        }
    }, [users, addToast]);

    const handleBulkUpdateReportStatus = useCallback(async (reportIds: number[], status: 'pending' | 'treated') => {
        const supabase = requireSupabaseClient();
        const { error } = await supabase.from('reports').update({ status }).in('id', reportIds);
        if (error) addToast(`Bulk update failed: ${error.message}`, 'error');
        else {
            setReports(prev => prev.map(r => reportIds.includes(r.id) ? { ...r, status } : r));
            addToast(`${reportIds.length} reports updated.`, 'success');
        }
    }, [addToast]);

    const handleOpenAIBulkResponseModal = useCallback((reportIds: number[]) => {
        const selectedReports = reports.filter(r => reportIds.includes(r.id));
        setReportsForAIBulkResponse(selectedReports);
        setIsAIBulkResponseModalOpen(true);
    }, [reports]);

    const handleStudentPasswordReset = useCallback(async (userId: string): Promise<string | null> => {
        const supabase = requireSupabaseClient();
        try {
             const { data, error } = await supabase.functions.invoke('manage-users', {
                 body: { action: 'reset_password', studentId: userId }
             });
             
             if (error) {
                 console.error("Edge Function Invoke Error:", error);
                 // Try to extract a meaningful message
                 let errorMessage = "Service unavailable";
                 if (error instanceof Error) errorMessage = error.message;
                 else if (typeof error === 'object' && error.message) errorMessage = error.message;
                 else if (typeof error === 'string') errorMessage = error;
                 
                 throw new Error(errorMessage);
             }
             
             if (data?.error) {
                 throw new Error(data.error);
             }

             if (!data || !data.password) {
                 throw new Error("Invalid response from server.");
             }

             return data.password;
        } catch (e: any) {
             console.error("Password Reset Error:", e);
             addToast(`Password reset failed: ${e.message}`, 'error');
             return null;
        }
    }, [addToast]);

    const handleDeleteStudentAccount = useCallback(async (userId: string): Promise<boolean> => {
        const supabase = requireSupabaseClient();
        try {
            const { data, error } = await supabase.functions.invoke('manage-users', {
                body: { action: 'delete_account', studentId: userId }
            });
            
            if (error) {
                console.error("Edge Function Invoke Error:", error);
                let errorMessage = "Service unavailable";
                if (error instanceof Error) errorMessage = error.message;
                else if (typeof error === 'object' && error.message) errorMessage = error.message;
                else if (typeof error === 'string') errorMessage = error;
                
                throw new Error(errorMessage);
            }
            
            if (data?.error) {
                throw new Error(data.error);
            }

            // Refresh student data to reflect the deleted account
            try {
                const updatedStudents = await fetchAllStudents('*, class:classes(name), arm:arms(name)', 'name');
                setStudents(updatedStudents);
            } catch (refreshError: any) {
                console.error("Student data refresh failed:", refreshError);
                addToast('Account deleted successfully, but student list refresh failed. Please refresh the page.', 'warning');
            }

            return true;
        } catch (e: any) {
            console.error("Delete Account Error:", e);
            addToast(`Account deletion failed: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

    const handleBulkDeleteStudentAccounts = useCallback(async (userIds: string[]): Promise<{ success: boolean; deleted: number; total: number }> => {
        const supabase = requireSupabaseClient();
        try {
            console.log(`Attempting to delete ${userIds.length} student accounts`);

            const { data, error } = await supabase.functions.invoke('manage-users', {
                body: { action: 'bulk_delete', studentIds: userIds }
            });
            
            if (error) {
                console.error("Edge Function Invoke Error:", error);
                let errorMessage = "Service unavailable";
                if (error instanceof Error) errorMessage = error.message;
                else if (typeof error === 'object' && error.message) errorMessage = error.message;
                else if (typeof error === 'string') errorMessage = error;
                
                throw new Error(errorMessage);
            }
            
            if (data?.error) {
                throw new Error(data.error);
            }

            console.log(`Deletion completed: ${data.deleted} of ${data.total} accounts deleted`);
            
            // If some deletions failed, log the failures
            if (data.results && data.deleted < data.total) {
                const failures = data.results.filter((r: any) => r.status === 'Failed');
                console.error('Failed deletions:', failures);
            }

            // Refresh student data to reflect the deleted accounts
            // Add a small delay to ensure database triggers have completed
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
                const updatedStudents = await fetchAllStudents('*, class:classes(name), arm:arms(name)', 'name');
                setStudents(updatedStudents);
                console.log(`Refreshed student data: ${updatedStudents.length} students`);
            } catch (refreshError: any) {
                console.error("Student data refresh failed:", refreshError);
                addToast('Accounts deleted successfully, but student list refresh failed. Please refresh the page.', 'warning');
            }

            const message = data.deleted === data.total 
                ? `Successfully deleted ${data.deleted} account${data.deleted !== 1 ? 's' : ''}`
                : `Deleted ${data.deleted} of ${data.total} accounts. ${data.total - data.deleted} failed.`;
            
            addToast(message, data.deleted === data.total ? 'success' : 'info');
            return { success: true, deleted: data.deleted, total: data.total };
        } catch (e: any) {
            console.error("Bulk Delete Accounts Error:", e);
            addToast(`Bulk deletion failed: ${e.message}`, 'error');
            return { success: false, deleted: 0, total: userIds.length };
        }
    }, [addToast]);

    const handleDeleteStudent = useCallback(async (studentId: number): Promise<boolean> => {
        const supabase = requireSupabaseClient();
        try {
            // First, if student has an auth account, delete it
            const student = students.find(s => s.id === studentId);
            if (student?.user_id) {
                await supabase.functions.invoke('manage-users', {
                    body: { action: 'delete_account', studentId: student.user_id }
                });
            }
            
            // Then delete the student record
            const { error } = await supabase.from('students').delete().eq('id', studentId);
            if (error) {
                addToast(`Failed to delete student: ${error.message}`, 'error');
                return false;
            }
            
            // Update local state
            setStudents(prev => prev.filter(s => s.id !== studentId));
            addToast('Student deleted successfully.', 'success');
            
            // Log audit action
            await logAuditAction('student_deleted', {
                student_id: studentId,
                student_name: student?.name,
                admission_number: student?.admission_number
            });
            
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [students, addToast, logAuditAction]);

    const handleBulkDeleteStudents = useCallback(async (studentIds: number[]): Promise<{ success: boolean; deleted: number; total: number }> => {
        const supabase = requireSupabaseClient();
        try {
            // Get students with auth accounts
            const studentsToDelete = students.filter(s => studentIds.includes(s.id));
            const userIds = studentsToDelete.filter(s => s.user_id).map(s => s.user_id!);
            
            // Delete auth accounts first (if any)
            if (userIds.length > 0) {
                await supabase.functions.invoke('manage-users', {
                    body: { action: 'bulk_delete', studentIds: userIds }
                });
            }
            
            // Delete student records
            const { error } = await supabase.from('students').delete().in('id', studentIds);
            if (error) {
                addToast(`Failed to delete students: ${error.message}`, 'error');
                return { success: false, deleted: 0, total: studentIds.length };
            }
            
            // Update local state
            setStudents(prev => prev.filter(s => !studentIds.includes(s.id)));
            addToast(`Successfully deleted ${studentIds.length} student(s).`, 'success');
            return { success: true, deleted: studentIds.length, total: studentIds.length };
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return { success: false, deleted: 0, total: studentIds.length };
        }
    }, [students, addToast]);

    // ... (Handlers for students, sips, calendar, etc.) ...
    
    const handleBulkAddStudents = useCallback(async (studentsData: any[]) => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return { success: false, message: 'User not authenticated' };
        
        // Map class_name/arm_name to IDs to ensure proper linkage
        const enrichedData = studentsData.map(s => {
            const classRecord = allClasses.find(c => c.name.trim().toLowerCase() === s.class_name?.trim().toLowerCase());
            const armRecord = allArms.find(a => a.name.trim().toLowerCase() === s.arm_name?.trim().toLowerCase());
            
            return { 
                ...s, 
                school_id: userProfile.school_id, 
                status: 'Active',
                class_id: classRecord ? classRecord.id : null,
                arm_id: armRecord ? armRecord.id : null
            };
        });
        
        try {
            const { data, error } = await supabase.functions.invoke('manage-users', {
                body: { action: 'bulk_create', students: enrichedData }
            });

            if (error) {
                 console.warn("Edge function invoke error:", error);
                 throw new Error("Edge function unavailable");
            }
            
            // Refresh student list after bulk create (Edge function creates Auth users AND triggers DB insert/updates)
            setTimeout(() => fetchDataRef.current(session!.user, true), 2000);

            return { success: true, message: `${enrichedData.length} students processed.`, credentials: data.credentials };
        } catch (e: any) {
            console.error("Bulk upload error:", e);
            // Fallback to direct DB insert if function fails (no login generated, only DB record) - Simplified for now
            return { success: false, message: `Service unavailable or error: ${e.message}` };
        }
    }, [userProfile, session, allClasses, allArms]);

    const handleBulkCreateStudentAccounts = useCallback(async (studentIds: number[]) => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return { success: false, message: 'User not authenticated' };

        try {
            const { data, error } = await supabase.functions.invoke('manage-users', {
                body: { action: 'bulk_create_for_existing', studentIds }
            });

            if (error) {
                 console.warn("Edge function invoke error:", error);
                 throw new Error("Edge function unavailable");
            }
            
            fetchDataRef.current(session!.user, true); // Refresh list to update user_id presence

            return { success: true, message: `Accounts generated for ${studentIds.length} students.`, credentials: data.credentials };
        } catch (e: any) {
             console.error("Bulk account creation error:", e);
             return { success: false, message: `Service unavailable (Edge Function missing). Please ask students to sign up manually.` };
        }
    }, [userProfile, session]);

    const handleBulkRetrievePasswords = useCallback(async (studentIds: number[]) => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return { success: false, credentials: [] };

        try {
            const { data, error } = await supabase.functions.invoke('manage-users', {
                body: { action: 'bulk_retrieve_passwords', studentIds }
            });

            if (error) {
                console.warn("Edge function invoke error:", error);
                throw new Error("Edge function unavailable");
            }

            return { success: true, credentials: data.credentials || [] };
        } catch (e: any) {
            console.error("Bulk password retrieval error:", e);
            return { success: false, credentials: [] };
        }
    }, [userProfile]);

    const handleGenerateActivationLinks = useCallback(async (
        studentIds: number[],
        options: { expiryHours: number; phoneField: 'parent_phone_number_1' | 'parent_phone_number_2' | 'student_phone'; template: string }
    ) => {
        if (!userProfile) return { success: false, results: [], expires_at: '' };
        const supabase = requireSupabaseClient();
        const { data, error } = await supabase.functions.invoke('activation-links', {
            body: {
                action: 'generate',
                student_ids: studentIds,
                expiry_hours: options.expiryHours,
                recipient_phone_field: options.phoneField,
                template: options.template,
            }
        });
        if (error) throw error;
        return data as { success: boolean; results: any[]; expires_at: string };
    }, [userProfile]);


    const handleAddStudent = useCallback(async (studentData: StudentFormData): Promise<boolean> => {
        if (!userProfile) return false;
        
        // Generate admission number if not provided and class_id is available
        let finalStudentData = { ...studentData, school_id: userProfile.school_id };
        
        if (!studentData.admission_number && studentData.class_id) {
            try {
                const supabase = requireSupabaseClient();
                
                // Get class name from class_id
                const selectedClass = allClasses.find(c => c.id === studentData.class_id);
                if (selectedClass) {
                    // Fetch all existing admission numbers for this school
                    const { data: existingStudents, error: fetchError } = await supabase
                        .from('students')
                        .select('admission_number')
                        .eq('school_id', userProfile.school_id);
                    
                    if (!fetchError && existingStudents) {
                        const existingNumbers = existingStudents
                            .map(s => s.admission_number)
                            .filter((num): num is string => !!num);
                        
                        const generatedNumber = generateAdmissionNumber(selectedClass.name, existingNumbers);
                        
                        if (generatedNumber) {
                            finalStudentData.admission_number = generatedNumber;
                        }
                    }
                }
            } catch (error) {
                console.warn('Failed to generate admission number:', error);
                // Continue without admission number - it's not critical
            }
        }
        
        const { error, data } = await Offline.insert('students', finalStudentData);
        if (error) {
            addToast(error.message, 'error');
            return false;
        }
        if(data) addItem(setStudents, data);
        addToast('Student record created (No login).', 'success');
        return true;
    }, [userProfile, addToast, allClasses]);

    const handleCreateStudentAccount = useCallback(async (studentId: number): Promise<CreatedCredential | null> => {
        const supabase = requireSupabaseClient();
        try {
            const { data, error } = await supabase.functions.invoke('manage-users', {
                body: { action: 'create_single_for_existing', studentId }
            });
            
            if (error) {
                 console.warn("Edge function invoke error:", error);
                 throw new Error("Edge function unavailable");
            }
            
            addToast(`Login created for student.`, 'success');
            // Refresh to update UI state (e.g. removing the button)
            if(session?.user) fetchDataRef.current(session.user, true);

            return data.credential;
        } catch (e: any) {
            console.error("Create account error:", e);
            addToast(`Automated creation unavailable. Student can sign up using Secret Code: UPSS-SECRET-2025`, 'warning'); 
            return null;
        }
    }, [session, addToast]);


    const handleUpdateStudent = useCallback(async (studentId: number, studentData: Partial<Student>): Promise<boolean> => {
        const supabase = requireSupabaseClient();
        const { error } = await Offline.update('students', studentData, { id: studentId });
        if (error) {
            addToast(error.message, 'error');
            return false;
        }
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...studentData } : s));
        addToast('Student updated.', 'success');
        
        // Log audit action
        await logAuditAction('student_updated', {
            student_id: studentId,
            updated_fields: Object.keys(studentData),
            changes: studentData
        });
        
        // If class_id or arm_id changed, trigger enrollment sync
        // Note: The database trigger will handle this, but we can refresh enrollment data
        if (studentData.class_id !== undefined || studentData.arm_id !== undefined) {
            try {
                // Refresh enrollment data to reflect changes
                const { data: enrollments } = await supabase.from('academic_class_students').select('*').limit(10000);
                if (enrollments) {
                    setAcademicClassStudents(enrollments);
                }
            } catch (syncErr) {
                console.warn('Failed to refresh enrollment data after student update:', syncErr);
            }
        }
        
        return true;
    }, [addToast, logAuditAction]);

    const handleCreateSIP = useCallback(async (studentId: number, goals: string[]) => {
        if (!userProfile) return false;
        const { error, data } = await Offline.insert('student_intervention_plans', { student_id: studentId, goals, school_id: userProfile.school_id, is_active: true });
        if (error) {
            addToast(error.message, 'error');
            return false;
        }
        if(data) addItem(setInterventionPlans, { ...data, student: students.find(s => s.id === studentId) });
        addToast('Intervention plan created.', 'success');
        return true;
    }, [userProfile, students, addToast]);

    const handleAddSIPLog = useCallback(async (planId: number, logEntry: string) => {
        if (!userProfile) return false;
        const { error, data } = await Offline.insert('sip_logs', { sip_id: planId, log_entry: logEntry, author_id: userProfile.id });
        if (error) {
            addToast(error.message, 'error');
            return false;
        }
        if(data) addItem(setSipLogs, { ...data, author: userProfile });
        addToast('Log added.', 'success');
        return true;
    }, [userProfile, addToast]);

    const handleUpdateSIP = useCallback(async (planId: number, data: Partial<StudentInterventionPlan>) => {
        const { error } = await Offline.update('student_intervention_plans', data, { id: planId });
        if (error) {
            addToast(error.message, 'error');
            return false;
        }
        setInterventionPlans(prev => prev.map(p => p.id === planId ? { ...p, ...data } : p));
        addToast('Plan updated.', 'success');
        return true;
    }, [addToast]);

    /**
     * Placeholder implementation for weekly compliance check.
     * 
     * @remarks
     * This is a NO-OP function added to fix a ReferenceError.
     * Clicking the compliance check button will only show an info message.
     * 
     * @todo Implement actual compliance logic:
     * - Check lesson plan submission rates
     * - Verify teacher attendance compliance
     * - Review policy adherence metrics
     * - Generate compliance report
     */
    const handleRunWeeklyComplianceCheck = useCallback(async (): Promise<void> => {
        console.warn("handleRunWeeklyComplianceCheck called - placeholder implementation, no actual checks performed");
        addToast('Feature not yet implemented. Compliance checks coming soon.', 'info');
    }, [addToast]);

    // Constants for AI award generation
    const AI_AWARDS_ANALYSIS_RECORD_LIMIT = 20;
    const AI_AWARDS_GENERATION_COUNT = 3;

    const handleGenerateStudentAwards = useCallback(async (): Promise<void> => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return;
        const aiClient = getAIClient();
        if (!aiClient) return;
        
        // Check if AI is in cooldown
        if (isAiInCooldown()) {
            addToast('AI service is cooling down. Please try again in a few minutes.', 'warning');
            return;
        }
        
        try {
            // Extract attendance from class groups
            const attendanceMap: Record<number, { present: number; total: number }> = {};
            classGroups.forEach(group => {
                group.members?.forEach(member => {
                    const records = member.records || [];
                    const presentCount = records.filter(r => r.status === 'Present' || r.status === 'Remote').length;
                    const totalCount = records.length;
                    if (totalCount > 0 && member.student_id) {
                        if (!attendanceMap[member.student_id]) {
                            attendanceMap[member.student_id] = { present: 0, total: 0 };
                        }
                        attendanceMap[member.student_id].present += presentCount;
                        attendanceMap[member.student_id].total += totalCount;
                    }
                });
            });
            
            // Build comprehensive student achievement data
            const studentAchievementData = students.slice(0, 50).map(s => {
                // Positive behavior
                const positiveBehaviors = positiveRecords.filter(p => p.student_id === s.id);
                
                // Academic excellence or improvement
                const studentScores = scoreEntries.filter(e => e.student_id === s.id);
                const avgScore = studentScores.length > 0
                    ? studentScores.reduce((sum, e) => sum + (e.total_score || 0), 0) / studentScores.length
                    : null;
                const highScores = studentScores.filter(e => (e.total_score || 0) >= 85).length;
                
                // Attendance
                const attendance = attendanceMap[s.id];
                const attendanceRate = attendance ? (attendance.present / attendance.total) * 100 : null;
                
                // Term report improvement trends
                const termReports = studentTermReports
                    .filter(tr => tr.student_id === s.id)
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .slice(-3); // Last 3 terms
                
                const improvementTrend = termReports.length >= 2
                    ? termReports[termReports.length - 1].overall_average - termReports[0].overall_average
                    : null;
                
                return {
                    id: s.id,
                    name: s.name,
                    positiveBehaviorCount: positiveBehaviors.length,
                    recentBehaviors: positiveBehaviors.slice(0, 3).map(p => p.behavior_type),
                    academicPerformance: {
                        avgScore: avgScore ? avgScore.toFixed(1) : null,
                        highScoreCount: highScores,
                        totalScores: studentScores.length
                    },
                    attendanceRate: attendanceRate ? attendanceRate.toFixed(0) : null,
                    improvementTrend: improvementTrend ? improvementTrend.toFixed(1) : null,
                    latestTermPosition: termReports.length > 0 ? termReports[termReports.length - 1].class_position : null
                };
            }).filter(s => 
                // Filter to students with notable achievements
                s.positiveBehaviorCount > 2 ||
                (s.academicPerformance.avgScore !== null && parseFloat(s.academicPerformance.avgScore) >= 80) ||
                (s.attendanceRate !== null && parseFloat(s.attendanceRate) >= 95) ||
                (s.improvementTrend !== null && parseFloat(s.improvementTrend) > 10) ||
                s.academicPerformance.highScoreCount >= 5
            ).slice(0, AI_AWARDS_ANALYSIS_RECORD_LIMIT);
            
            if (studentAchievementData.length === 0) {
                addToast('Not enough student achievement data to generate awards.', 'info');
                return;
            }
            
            const prompt = `Analyze student achievement data and generate awards for outstanding students. Consider: positive behaviors, academic excellence (high scores), perfect/excellent attendance (>95%), consistent on-time performance, and significant improvement trends. Return a JSON array of award objects with "student_id" (number), "award_type" (string: e.g., "Academic Excellence", "Perfect Attendance", "Most Improved", "Outstanding Behavior"), and "reason" (string, max 150 chars). Generate up to ${AI_AWARDS_GENERATION_COUNT} awards for the most deserving students.

Student Achievement Data: ${JSON.stringify(studentAchievementData)}`;
            
            const res = await aiClient.chat.completions.create({
                model: schoolSettings?.ai_settings?.default_model || 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            });
            
            if (res) {
                const awards = extractAndParseJson<any[]>(textFromAI(res));
                if (awards && Array.isArray(awards)) {
                    const { error } = await supabase.from('student_awards').insert(
                        awards.map((a: any) => ({ ...a, school_id: userProfile.school_id }))
                    );
                    if (error) {
                        addToast('Failed to save awards.', 'error');
                    } else {
                        addToast('Student awards generated successfully.', 'success');
                        if (session?.user) fetchDataRef.current(session.user, true);
                    }
                }
            }
        } catch (e: any) {
            console.error('Generate awards error:', e);
            if (isRateLimitError(e)) {
                setAiCooldown(); // Use default cooldown
                addToast('AI service is temporarily busy. Please try again in a few minutes.', 'warning');
            } else {
                addToast('Failed to generate awards. Please try again.', 'error');
            }
        }
    }, [userProfile, positiveRecords, addToast, session, schoolSettings, students, scoreEntries, studentTermReports, classGroups]);

    const handleGenerateStudentInsight = useCallback(async (studentId: number): Promise<any | null> => {
        const aiClient = getAIClient();
        if (!aiClient) return null;
        
        // Check if AI is in cooldown
        if (isAiInCooldown()) {
            addToast('AI service is cooling down. Please try again in a few minutes.', 'warning');
            return null;
        }
        
        try {

            const student = students.find(s => s.id === studentId);
            if (!student) return null;

            const studentData = {
                profile: student,
                reports: reports.filter(r => r.student_id === studentId),
                positiveRecords: positiveRecords.filter(p => p.student_id === studentId),
            };

            const prompt = `Analyze this student's data and provide insights: ${JSON.stringify(studentData)}. Return JSON with fields: strengths, areas_for_improvement, recommendations.`;
            const res = await aiClient.chat.completions.create({
                model: schoolSettings?.ai_settings?.default_model || 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            });

            if (res) {
                const insight = extractAndParseJson<any>(textFromAI(res));
                if (insight) {
                    addToast('Student insight generated.', 'success');
                    return insight;
                }
            }
            return null;
        } catch (e: any) {
            console.error('Generate insight error:', e);
            if (isRateLimitError(e)) {
                setAiCooldown(); // Use default cooldown
                addToast('AI service is temporarily busy. Please try again in a few minutes.', 'warning');
            } else {
                addToast('Failed to generate student insight. Please try again.', 'error');
            }
            return null;
        }
    }, [students, reports, positiveRecords, addToast, schoolSettings]);


    // Lock academic assignment scores (for Result Manager)
    const handleLockScores = useCallback(async (
        assignmentId: number, 
        zeroScoreCallback?: (students: ZeroScoreStudent[]) => Promise<'unenroll' | 'keep' | 'cancel'>
    ): Promise<boolean> => {
        try {
            const supabase = requireSupabaseClient();
            
            // 1. Detect zero total scores
            const { data: zeroScoreStudents, error: detectError } = await supabase
                .rpc('detect_zero_total_scores', { p_assignment_id: assignmentId });

            if (detectError) {
                console.error('Error detecting zero scores:', detectError);
                addToast(`Error detecting zero scores: ${detectError.message}`, 'error');
                return false;
            }

            // 2. If zero scores found and callback provided, ask user what to do
            if (zeroScoreStudents && zeroScoreStudents.length > 0 && zeroScoreCallback) {
                const userChoice = await zeroScoreCallback(zeroScoreStudents);
                
                if (userChoice === 'cancel') {
                    return false; // Abort lock operation
                }
                
                if (userChoice === 'unenroll') {
                    // 3. Unenroll students with zero scores
                    const studentIds = zeroScoreStudents.map((s: ZeroScoreStudent) => s.student_id);
                    const { data: unenrollResult, error: unenrollError } = await supabase
                        .rpc('unenroll_zero_score_students', { 
                            p_assignment_id: assignmentId,
                            p_student_ids: studentIds
                        });

                    if (unenrollError) {
                        console.error('Error unenrolling students:', unenrollError);
                        addToast(`Error unenrolling students: ${unenrollError.message}`, 'error');
                        return false;
                    }

                    console.log('Unenrollment result:', unenrollResult);
                    addToast(`Successfully unenrolled ${studentIds.length} student(s) with zero total scores`, 'success');
                }
                // If 'keep', continue to lock without unenrollment
            }

            // 4. Lock the assignment
            const { error } = await Offline.update('teaching_assignments', 
                { is_locked: true }, 
                { id: assignmentId }
            );
            
            if (error) {
                addToast(`Failed to lock scores: ${error.message}`, 'error');
                return false;
            }
            
            // Update local state
            setAcademicAssignments(prev => 
                prev.map(a => a.id === assignmentId ? { ...a, is_locked: true } : a)
            );
            
            addToast('Scores locked successfully.', 'success');
            return true;
        } catch (e: any) {
            console.error('Error in handleLockScores:', e);
            addToast(`Error locking scores: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

    const handleResetSubmission = useCallback(async (assignmentId: number): Promise<boolean> => {
        try {
            // Find the assignment to check if it's locked
            const assignment = academicAssignments.find(a => a.id === assignmentId);
            if (!assignment) {
                addToast('Assignment not found.', 'error');
                return false;
            }

            // Build the update payload
            const updatePayload: { submitted_at: null; is_locked?: boolean } = {
                submitted_at: null
            };

            // If the assignment is also locked, ask if they want to unlock it
            if (assignment.is_locked) {
                const unlockConfirmed = window.confirm(
                    "This assignment is also locked. Do you want to unlock it as well?"
                );
                if (unlockConfirmed) {
                    updatePayload.is_locked = false;
                }
            }

            const { error } = await Offline.update('teaching_assignments', 
                updatePayload, 
                { id: assignmentId }
            );
            
            if (error) {
                addToast(`Failed to reset submission: ${error.message}`, 'error');
                return false;
            }
            
            // Update local state
            setAcademicAssignments(prev => 
                prev.map(a => a.id === assignmentId ? { ...a, ...updatePayload } : a)
            );
            
            addToast('Submission reset successfully. Teacher can now re-enter scores.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error resetting submission: ${e.message}`, 'error');
            return false;
        }
    }, [academicAssignments, addToast]);

    // Update result comments (for Result Manager)
    const handleUpdateResultComments = useCallback(async (reportId: number, teacherComment: string, principalComment: string): Promise<void> => {
        try {
            const { error } = await Offline.update('student_term_reports', 
                { teacher_comment: teacherComment, principal_comment: principalComment }, 
                { id: reportId }
            );
            
            if (error) {
                addToast(`Failed to update comments: ${error.message}`, 'error');
                return;
            }
            
            // Update local state
            setStudentTermReports(prev => 
                prev.map(r => r.id === reportId ? { ...r, teacher_comment: teacherComment, principal_comment: principalComment } : r)
            );
            
            addToast('Comments updated.', 'success');
        } catch (e: any) {
            addToast(`Error updating comments: ${e.message}`, 'error');
        }
    }, [addToast]);

    // Generate AI-powered report card comment
    const handleGenerateReportComment = useCallback(async (
        studentId: number, 
        termId: number, 
        commentType: 'teacher' | 'principal'
    ): Promise<string | null> => {
        const aiClient = getAIClient();
        if (!aiClient) {
            addToast('AI client not available. Please configure AI in Settings.', 'error');
            return null;
        }
        
        try {
            // Gather student data
            const student = students.find(s => s.id === studentId);
            if (!student) {
                addToast('Student not found.', 'error');
                return null;
            }
            
            const studentScores = scoreEntries.filter(s => s.student_id === studentId && s.term_id === termId);
            const termReport = studentTermReports.find(r => r.student_id === studentId && r.term_id === termId);
            
            // Extract attendance records from classGroups
            const allAttendance: AttendanceRecord[] = [];
            classGroups.forEach(group => {
                group.members?.forEach(member => {
                    if (member.records) {
                        allAttendance.push(...member.records);
                    }
                });
            });
            const studentAttendance = allAttendance.filter(a => a.student_id === studentId);
            
            const behaviorReports = reports.filter(r => r.involved_students?.includes(studentId));
            
            // TODO: Implement homework submissions feature
            // For now, using empty array as homework submissions state doesn't exist
            const homeworkSubmissions_filtered: any[] = [];
            
            // Calculate attendance rate
            const termAttendance = studentAttendance; // You might want to filter by term if possible
            const attendanceRate = termAttendance.length > 0
                ? (termAttendance.filter(a => a.status === 'Present').length / termAttendance.length) * 100
                : 0;
            
            // Calculate homework completion
            const homeworkCompletion = homeworkSubmissions_filtered.length > 0
                ? (homeworkSubmissions_filtered.filter(h => h.status === 'Completed' || h.status === 'Graded').length / homeworkSubmissions_filtered.length) * 100
                : 0;
            
            const context = {
                studentName: student.name,
                scores: studentScores.map(s => ({ 
                    subject: s.subject_name, 
                    score: s.total_score, 
                    grade: s.grade_label 
                })),
                averageScore: termReport?.average_score,
                positionInClass: termReport?.position_in_class,
                attendanceRate: attendanceRate.toFixed(1),
                behaviorSummary: behaviorReports.slice(0, 5).map(r => 
                    r.analysis?.summary || r.report_text.substring(0, 100)
                ),
                homeworkCompletion: homeworkCompletion.toFixed(1)
            };
            
            const prompt = commentType === 'teacher' 
                ? `Generate a warm, professional teacher's comment for ${student.name}'s report card.
                   
                   Academic Performance: ${JSON.stringify(context.scores)}
                   Average: ${context.averageScore}%, Position: ${context.positionInClass}
                   Attendance: ${context.attendanceRate}%
                   Behavior Notes: ${context.behaviorSummary.join('; ')}
                   Homework Completion: ${context.homeworkCompletion}%
                   
                   The comment should:
                   - Be 2-3 sentences
                   - Highlight specific strengths
                   - Mention one area for improvement constructively
                   - End with encouragement
                   - Be personalized, not generic`
                
                : `Generate a professional principal's comment for ${student.name}'s report card.
                   
                   Average: ${context.averageScore}%, Position: ${context.positionInClass}
                   Overall Performance: ${context.averageScore && context.averageScore >= 70 ? 'Excellent' : context.averageScore && context.averageScore >= 50 ? 'Good' : 'Needs Support'}
                   
                   The comment should:
                   - Be 1-2 sentences
                   - Acknowledge effort or achievement
                   - Provide encouragement for next term
                   - Be appropriately formal`;
            
            const response = await aiClient.chat.completions.create({
                model: getCurrentModel(),
                messages: [{ role: 'user', content: prompt }],
            });
            
            return textFromAI(response);
        } catch (e: any) {
            console.error('Error generating comment:', e);
            addToast(`Failed to generate comment: ${e.message}`, 'error');
            return null;
        }
    }, [students, scoreEntries, studentTermReports, classGroups, reports, addToast]);

    // --- Grading Scheme Handlers ---
    const handleSaveGradingScheme = useCallback(async (scheme: Partial<GradingScheme>): Promise<boolean> => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return false;
        try {
            const { rules, ...schemeData } = scheme;
            
            if (scheme.id) {
                // Update existing scheme
                const { error } = await Offline.update('grading_schemes', schemeData, { id: scheme.id });
                if (error) { addToast(error.message, 'error'); return false; }
                
                // Delete old rules and insert new ones
                await supabase.from('grading_scheme_rules').delete().eq('grading_scheme_id', scheme.id);
                if (rules && rules.length > 0) {
                    const rulesWithSchemeId = rules.map(r => ({ ...r, grading_scheme_id: scheme.id }));
                    await supabase.from('grading_scheme_rules').insert(rulesWithSchemeId);
                }
                
                setGradingSchemes(prev => prev.map(s => s.id === scheme.id ? { ...s, ...schemeData, rules: rules || [] } as GradingScheme : s));
            } else {
                // Create new scheme
                const { data, error } = await Offline.insert('grading_schemes', { ...schemeData, school_id: userProfile.school_id });
                if (error || !data) { addToast(error?.message || 'Failed to create scheme', 'error'); return false; }
                
                if (rules && rules.length > 0) {
                    const rulesWithSchemeId = rules.map(r => ({ ...r, grading_scheme_id: data.id }));
                    await supabase.from('grading_scheme_rules').insert(rulesWithSchemeId);
                }
                
                setGradingSchemes(prev => [...prev, { ...data, rules: rules || [] } as GradingScheme]);
            }
            
            addToast('Grading scheme saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    const handleDeleteGradingScheme = useCallback(async (schemeId: number): Promise<boolean> => {
        try {
            // Rules will cascade delete via foreign key
            const { error } = await Offline.del('grading_schemes', { id: schemeId });
            if (error) { addToast(error.message, 'error'); return false; }
            setGradingSchemes(prev => prev.filter(s => s.id !== schemeId));
            addToast('Grading scheme deleted.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

    const handleSetActiveGradingScheme = useCallback(async (schemeId: number): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            const { error } = await Offline.update('school_config', { active_grading_scheme_id: schemeId }, { school_id: userProfile.school_id });
            if (error) { addToast(error.message, 'error'); return false; }
            setSchoolConfig(prev => prev ? { ...prev, active_grading_scheme_id: schemeId } : null);
            addToast('Active grading scheme updated.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    // --- Assessment Structure Handlers ---
    const handleSaveAssessmentStructure = useCallback(async (structure: Partial<AssessmentStructure>): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            if (structure.id) {
                const { error } = await Offline.update('assessment_structures', structure, { id: structure.id });
                if (error) { addToast(error.message, 'error'); return false; }
                setAssessmentStructures(prev => prev.map(s => s.id === structure.id ? { ...s, ...structure } as AssessmentStructure : s));
            } else {
                const { data, error } = await Offline.insert('assessment_structures', { ...structure, school_id: userProfile.school_id });
                if (error || !data) { addToast(error?.message || 'Failed to create structure', 'error'); return false; }
                setAssessmentStructures(prev => [...prev, data as AssessmentStructure]);
            }
            addToast('Assessment structure saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    const handleDeleteAssessmentStructure = useCallback(async (structureId: number): Promise<boolean> => {
        try {
            const { error } = await Offline.del('assessment_structures', { id: structureId });
            if (error) { addToast(error.message, 'error'); return false; }
            setAssessmentStructures(prev => prev.filter(s => s.id !== structureId));
            addToast('Assessment structure deleted.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

    // --- Assessment Handlers ---
    const handleSaveAssessment = useCallback(async (data: Partial<Assessment>): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            if (data.id) {
                const { error } = await Offline.update('assessments', data, { id: data.id });
                if (error) { addToast(error.message, 'error'); return false; }
                setAssessments(prev => prev.map(a => a.id === data.id ? { ...a, ...data } as Assessment : a));
            } else {
                const { data: newAssessment, error } = await Offline.insert('assessments', { ...data, school_id: userProfile.school_id });
                if (error || !newAssessment) { addToast(error?.message || 'Failed to create assessment', 'error'); return false; }
                setAssessments(prev => [...prev, newAssessment as Assessment]);
            }
            addToast('Assessment saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    const handleDeleteAssessment = useCallback(async (assessmentId: number): Promise<boolean> => {
        try {
            const { error } = await Offline.del('assessments', { id: assessmentId });
            if (error) { addToast(error.message, 'error'); return false; }
            setAssessments(prev => prev.filter(a => a.id !== assessmentId));
            addToast('Assessment deleted.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

    const handleSaveAssessmentScores = useCallback(async (scores: Partial<AssessmentScore>[]): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            for (const score of scores) {
                if (score.id) {
                    const { error } = await Offline.update('assessment_scores', score, { id: score.id });
                    if (error) { addToast(error.message, 'error'); return false; }
                } else {
                    const { data, error } = await Offline.insert('assessment_scores', score);
                    if (error) { addToast(error.message, 'error'); return false; }
                    if (data) {
                        setAssessmentScores(prev => [...prev, data as AssessmentScore]);
                    }
                }
            }
            // Refresh all assessment scores after bulk update
            const { data: updatedScores, error } = await Offline.from('assessment_scores')
                .select('*')
                .eq('assessment_id', scores[0]?.assessment_id);
            if (!error && updatedScores) {
                setAssessmentScores(prev => {
                    const filtered = prev.filter(s => s.assessment_id !== scores[0]?.assessment_id);
                    return [...filtered, ...(updatedScores as AssessmentScore[])];
                });
            }
            addToast('Assessment scores saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    const handleCopyAssessment = useCallback(async (sourceId: number, targetAssignmentIds: number[]): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            const sourceAssessment = assessments.find(a => a.id === sourceId);
            if (!sourceAssessment) {
                addToast('Source assessment not found', 'error');
                return false;
            }
            
            for (const targetId of targetAssignmentIds) {
                const newAssessment = {
                    teaching_assignment_id: targetId,
                    title: sourceAssessment.title,
                    assessment_type: sourceAssessment.assessment_type,
                    max_score: sourceAssessment.max_score,
                    deadline: sourceAssessment.deadline,
                    school_id: userProfile.school_id
                };
                const { data, error } = await Offline.insert('assessments', newAssessment);
                if (error) { addToast(error.message, 'error'); return false; }
                if (data) {
                    setAssessments(prev => [...prev, data as Assessment]);
                }
            }
            addToast('Assessment copied successfully.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, assessments, addToast]);

    // --- Term Handlers ---
    const handleSaveTerm = useCallback(async (term: Partial<Term>): Promise<boolean> => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return false;
        try {
            if (term.id) {
                const { error } = await Offline.update('terms', term, { id: term.id });
                if (error) { addToast(error.message, 'error'); return false; }
                setTerms(prev => prev.map(t => t.id === term.id ? { ...t, ...term } as Term : t));
                
                // Log audit action
                await logAuditAction('term_updated', {
                    term_id: term.id,
                    session_label: term.session_label,
                    term_label: term.term_label,
                    is_active: term.is_active
                });
            } else {
                const { data, error } = await Offline.insert('terms', { ...term, school_id: userProfile.school_id });
                if (error || !data) { addToast(error?.message || 'Failed to create term', 'error'); return false; }
                setTerms(prev => [...prev, data as Term]);
                
                // Auto-sync student enrollments for new term
                try {
                    const { data: syncResult, error: syncError } = await supabase.rpc(
                        'sync_all_students_for_term',
                        { p_term_id: data.id, p_school_id: userProfile.school_id }
                    );
                    if (!syncError && syncResult) {
                        console.log(`Auto-enrolled ${syncResult} students for new term ${data.id}`);
                    }
                } catch (syncErr) {
                    console.warn('Auto-enrollment failed for new term:', syncErr);
                    // Don't fail term creation if sync fails
                }
                
                // Log audit action
                await logAuditAction('term_created', {
                    term_id: data.id,
                    session_label: term.session_label,
                    term_label: term.term_label
                });
            }
            addToast('Term saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast, logAuditAction]);

    const handleDeleteTerm = useCallback(async (termId: number): Promise<boolean> => {
        try {
            const { error } = await Offline.del('terms', { id: termId });
            if (error) { addToast(error.message, 'error'); return false; }
            setTerms(prev => prev.filter(t => t.id !== termId));
            addToast('Term deleted.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

    // --- Academic Class Handlers ---
    const handleSaveAcademicClass = useCallback(async (academicClass: Partial<AcademicClass>): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            if (academicClass.id) {
                const { error } = await Offline.update('academic_classes', academicClass, { id: academicClass.id });
                if (error) { addToast(error.message, 'error'); return false; }
                setAcademicClasses(prev => prev.map(c => c.id === academicClass.id ? { ...c, ...academicClass } as AcademicClass : c));
            } else {
                const { data, error } = await Offline.insert('academic_classes', { ...academicClass, school_id: userProfile.school_id });
                if (error || !data) { addToast(error?.message || 'Failed to create class', 'error'); return false; }
                setAcademicClasses(prev => [...prev, data as AcademicClass]);
            }
            addToast('Academic class saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    const handleDeleteAcademicClass = useCallback(async (classId: number): Promise<boolean> => {
        try {
            const { error } = await Offline.del('academic_classes', { id: classId });
            if (error) { addToast(error.message, 'error'); return false; }
            setAcademicClasses(prev => prev.filter(c => c.id !== classId));
            addToast('Academic class deleted.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

    // --- Teaching Assignment Handlers ---
    const handleSaveAcademicAssignment = useCallback(async (assignment: Partial<AcademicTeachingAssignment>): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            if (assignment.id) {
                const { error } = await Offline.update('teaching_assignments', assignment, { id: assignment.id });
                if (error) { addToast(error.message, 'error'); return false; }
                setAcademicAssignments(prev => prev.map(a => a.id === assignment.id ? { ...a, ...assignment } as AcademicTeachingAssignment : a));
                
                // Log audit action
                await logAuditAction('teaching_assignment_updated', {
                    assignment_id: assignment.id,
                    updated_fields: Object.keys(assignment)
                });
            } else {
                // Validate that term_id is provided
                if (!assignment.term_id) {
                    addToast('Please select a term for the assignment', 'error');
                    return false;
                }
                const { data, error } = await Offline.insert('teaching_assignments', { ...assignment, school_id: userProfile.school_id });
                if (error || !data) { addToast(error?.message || 'Failed to create assignment', 'error'); return false; }
                setAcademicAssignments(prev => [...prev, data as AcademicTeachingAssignment]);
                
                // Log audit action
                await logAuditAction('teaching_assignment_created', {
                    assignment_id: data.id,
                    term_id: assignment.term_id,
                    subject_name: assignment.subject_name,
                    teacher_id: assignment.teacher_user_id
                });
            }
            addToast('Teaching assignment saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast, logAuditAction]);

    const handleDeleteAcademicAssignment = useCallback(async (assignmentId: number): Promise<boolean> => {
        try {
            const assignment = academicAssignments.find(a => a.id === assignmentId);
            
            const { error } = await Offline.del('teaching_assignments', { id: assignmentId });
            if (error) { addToast(error.message, 'error'); return false; }
            setAcademicAssignments(prev => prev.filter(a => a.id !== assignmentId));
            addToast('Teaching assignment deleted.', 'success');
            
            // Log audit action
            await logAuditAction('teaching_assignment_deleted', {
                assignment_id: assignmentId,
                subject_name: assignment?.subject_name,
                teacher_id: assignment?.teacher_user_id
            });
            
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast, logAuditAction, academicAssignments]);

    // ... (Calendar handlers)
     const handleSaveCalendarEvent = useCallback(async (event: any) => {
         if (!userProfile) return;
         const { error, data } = await Offline.insert('calendar_events', { ...event, school_id: userProfile.school_id, created_by: userProfile.id });
         if (error) addToast(error.message, 'error');
         else {
             if(data) addItem(setCalendarEvents, data);
             addToast('Event saved.', 'success');
         }
    }, [userProfile, addToast]);

    const handleUpdateCalendarEvent = useCallback(async (eventId: number, data: Partial<CalendarEvent>) => {
        const { error } = await Offline.update('calendar_events', data, { id: eventId });
        if (error) addToast(error.message, 'error');
        else {
            setCalendarEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...data } : e));
            addToast('Event updated.', 'success');
        }
    }, [addToast]);

    const handleDeleteCalendarEvent = useCallback(async (eventId: number) => {
        const { error } = await Offline.del('calendar_events', { id: eventId });
        if (error) addToast(error.message, 'error');
        else {
            deleteItem(setCalendarEvents, eventId);
            addToast('Event deleted.', 'success');
        }
    }, [addToast]);

    // ... (User management handlers)
    const handleInviteUser = useCallback(async (email: string, role: RoleTitle) => {
        addToast(`Invitation sent to ${email} for role ${role}.`, 'success');
    }, [addToast]);

    const handleCreateStaffAccount = useCallback(async (data: {
        name: string;
        role: RoleTitle;
        phone_number: string;
        campus_id?: number;
        sendSms?: boolean;
    }) => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return { success: false };

        try {
            const { data: result, error } = await supabase.functions.invoke('manage-users', {
                body: {
                    action: 'create_staff_account',
                    ...data,
                    school_id: userProfile.school_id
                }
            });

            if (error) {
                console.error("Edge function invoke error:", error);
                addToast(`Failed to create staff account: ${error.message}`, 'error');
                return { success: false };
            }

            if (result?.error) {
                addToast(`Failed to create staff account: ${result.error}`, 'error');
                return { success: false };
            }

            addToast(`Staff account created successfully for ${data.name}`, 'success');
            
            // Refresh users list
            if (session?.user) {
                fetchDataRef.current(session.user, true);
            }

            return {
                success: true,
                credential: result.credential,
                messagingResults: result.messagingResults
            };
        } catch (e: any) {
            console.error("Staff account creation error:", e);
            addToast(`Error creating staff account: ${e.message}`, 'error');
            return { success: false };
        }
    }, [userProfile, session, addToast]);

    const handleResetStaffPassword = useCallback(async (userId: string) => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return { success: false };

        try {
            const { data: result, error } = await supabase.functions.invoke('manage-users', {
                body: {
                    action: 'reset_staff_password',
                    userId
                }
            });

            if (error) {
                console.error("Edge function invoke error:", error);
                addToast(`Failed to reset password: ${error.message}`, 'error');
                return { success: false };
            }

            if (result?.error) {
                addToast(`Failed to reset password: ${result.error}`, 'error');
                return { success: false };
            }

            addToast('Password reset successfully', 'success');

            return {
                success: true,
                password: result.password,
                messagingResults: result.messagingResults
            };
        } catch (e: any) {
            console.error("Staff password reset error:", e);
            addToast(`Error resetting password: ${e.message}`, 'error');
            return { success: false };
        }
    }, [userProfile, addToast]);

    const handleUpdateUser = useCallback(async (userId: string, userData: Partial<UserProfile>): Promise<boolean> => {
        const supabase = requireSupabaseClient();
        try {
            // If email is being updated, sync it to auth.users via edge function
            if (userData.email) {
                try {
                    const { data, error: authError } = await supabase.functions.invoke('manage-users', {
                        body: { action: 'update_staff_email', userId: userId, email: userData.email }
                    });
                    
                    // Check for invocation error
                    if (authError) {
                        console.error(`Auth email update error for user ${userId}:`, authError);
                        addToast(`Failed to update email in authentication system: ${authError.message}`, 'error');
                        return false;
                    }
                    
                    // Check for response error
                    if (data?.error) {
                        console.error(`Auth email update response error for user ${userId}:`, data.error);
                        addToast(`Failed to update email: ${data.error}`, 'error');
                        return false;
                    }
                } catch (authErr: any) {
                    console.error(`Auth email update failed for user ${userId}:`, authErr);
                    addToast(`Failed to update email: ${authErr.message}`, 'error');
                    return false;
                }
            }
            
            // Update user_profiles table
            const { error } = await Offline.update('user_profiles', userData, { id: userId });
            if (error) {
                addToast(error.message, 'error');
                return false;
            }
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...userData } : u));
            addToast('User updated successfully.', 'success');
            
            // Log audit action
            await logAuditAction('user_updated', {
                user_id: userId,
                updated_fields: Object.keys(userData),
                changes: userData
            });
            
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast, logAuditAction]);

    const handleDeleteUser = useCallback(async (userId: string): Promise<boolean> => {
        const supabase = requireSupabaseClient();
        try {
            const userToDelete = users.find(u => u.id === userId);
            
            // DELETE THE AUTH USER via Edge Function
            // This will cascade delete the user_profiles record due to FK constraint
            const { data, error: authError } = await supabase.functions.invoke('manage-users', {
                body: { action: 'delete_staff_account', userId: userId }
            });
            
            // Check for invocation error
            if (authError) {
                console.error(`Staff user deletion error for user ${userId}:`, authError);
                addToast(`Failed to delete staff account: ${authError.message}`, 'error');
                return false;
            }
            
            // Check for response error
            if (data?.error) {
                console.error(`Staff user deletion response error for user ${userId}:`, data.error);
                addToast(`Failed to delete staff account: ${data.error}`, 'error');
                return false;
            }
            
            // Update UI state - user_profiles record is already cascade deleted
            setUsers(prev => prev.filter(u => u.id !== userId));
            addToast('User deleted successfully.', 'success');
            
            // Log audit action
            await logAuditAction('user_deleted', {
                user_id: userId,
                user_name: userToDelete?.name,
                user_role: userToDelete?.role
            });
            
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast, logAuditAction, users]);

    const handleUpdateEmploymentStatus = useCallback(async (userId: string, status: EmploymentStatus) => {
        try {
            const { error } = await Offline.update('user_profiles', { employment_status: status }, { id: userId });
            if (error) {
                addToast(error.message, 'error');
                return;
            }
            
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, employment_status: status } : u));
            addToast(`Employment status updated to ${status}.`, 'success');
            
            const userToUpdate = users.find(u => u.id === userId);
            await logAuditAction('employment_status_updated', {
                user_id: userId,
                user_name: userToUpdate?.name,
                new_status: status
            });
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
        }
    }, [addToast, logAuditAction, users]);

    const handleDeactivateUser = useCallback(async (userId: string, isActive: boolean) => {
        // For backward compatibility, this sets employment_status to Active or Resigned
        const status = isActive ? EmploymentStatus.Active : EmploymentStatus.Resigned;
        try {
            const { error } = await Offline.update('user_profiles', { employment_status: status }, { id: userId });
            if (error) {
                addToast(error.message, 'error');
                return;
            }
            
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, employment_status: status } : u));
            addToast(`User ${isActive ? 'activated' : 'deactivated'}.`, 'success');
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
        }
    }, [addToast]);

    const handleUpdateUserCampus = useCallback(async (userId: string, campusId: number | null) => {
        const { error } = await Offline.update('user_profiles', { campus_id: campusId }, { id: userId });
        if (error) addToast(error.message, 'error');
        else {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, campus_id: campusId } : u));
            addToast('User campus updated.', 'success');
        }
    }, [addToast]);

    // ... (Role management handlers)
    const handleSaveRole = useCallback(async (roleData: RoleDetails) => {
        if (!userProfile) return;
        // Convert camelCase to snake_case for database
        const dbData = {
            id: roleData.id,
            school_id: roleData.school_id,
            title: roleData.title,
            description: roleData.description,
            permissions: roleData.permissions,
            reporting_quota_days: roleData.reportingQuotaDays,
            reporting_quota_count: roleData.reportingQuotaCount,
            ai_analysis_focus: roleData.aiAnalysisFocus,
            ai_routing_instructions: roleData.aiRoutingInstructions,
        };
        
        if (roleData.id) {
            const { error } = await Offline.update('roles', dbData, { id: roleData.id });
            if (error) addToast(error.message, 'error');
            else {
                setRoles(prev => ({ ...prev, [roleData.title]: roleData }));
                addToast('Role updated.', 'success');
            }
        } else {
            const { id, ...insertData } = dbData;
            const { error, data } = await Offline.insert('roles', { ...insertData, school_id: userProfile.school_id });
             if (error) addToast(error.message, 'error');
            else {
                // Convert response back to camelCase for state
                if(data) {
                    const normalizedRole: RoleDetails = {
                        id: data.id,
                        school_id: data.school_id,
                        title: data.title,
                        description: data.description ?? '',
                        permissions: data.permissions ?? [],
                        reportingQuotaDays: data.reporting_quota_days ?? null,
                        reportingQuotaCount: data.reporting_quota_count ?? null,
                        aiAnalysisFocus: data.ai_analysis_focus ?? '',
                        aiRoutingInstructions: data.ai_routing_instructions ?? '',
                    };
                    setRoles(prev => ({ ...prev, [normalizedRole.title]: normalizedRole }));
                }
                addToast('Role created.', 'success');
            }
        }
    }, [userProfile, addToast]);

    // --- UPDATED handleUpdateRoleAssignments ---
    const handleUpdateRoleAssignments = useCallback(async (roleId: number, userIds: string[]) => {
        const supabase = requireSupabaseClient();
        if (!userProfile || !session) return;

        // 1. Fetch role details for notification text
        const roleDef = Object.values(roles).find(r => r.id === roleId);
        const roleTitle = roleDef?.title || 'New Role';

        // 2. Update Assignments (Transaction simulation)
        const { error: delError } = await supabase.from('user_role_assignments').delete().eq('role_id', roleId);
        if (delError) {
            addToast(`Error removing old assignments: ${delError.message}`, 'error');
            return;
        }

        if (userIds.length > 0) {
            const newAssignments = userIds.map(uid => ({ user_id: uid, role_id: roleId, school_id: userProfile.school_id }));
            const { error: insError } = await supabase.from('user_role_assignments').insert(newAssignments);
            if (insError) {
                 addToast(`Error saving new assignments: ${insError.message}`, 'error');
                 // Note: Old ones are already gone. In a real app, use RPC or Postgres transaction.
                 return;
            }
            
            // 3. Send Notifications
            const notifications = userIds.map(uid => ({
                user_id: uid,
                message: `You have been assigned the role: ${roleTitle}`,
                is_read: false,
                created_at: new Date().toISOString()
            }));
            await supabase.from('notifications').insert(notifications);
        }

        // 4. REFRESH LOCAL STATE IMMEDIATELY
        const { data: refreshedAssignments } = await supabase.from('user_role_assignments').select('*');
        setUserRoleAssignments(refreshedAssignments || []);
        
        addToast('Assignments updated and users notified.', 'success');
    }, [userProfile, roles, addToast, session]); // Added session/roles dependencies

    // ... (Team management handlers)
     const handleCreateTeam = useCallback(async (teamData: any) => {
        if (!userProfile) return null;
        const { error, data } = await Offline.insert('teams', { ...teamData, school_id: userProfile.school_id });
        if (error) {
            addToast(error.message, 'error');
            return null;
        }
        if(data) {
            addItem(setTeams, { ...data, members: [] }); // init members array
            return data;
        }
        return null;
    }, [userProfile, addToast]);

    const handleUpdateTeam = useCallback(async (teamId: number, teamData: Partial<Team>) => {
        const { error } = await Offline.update('teams', teamData, { id: teamId });
         if (error) {
            addToast(error.message, 'error');
            return false;
        }
        setTeams(prev => prev.map(t => t.id === teamId ? { ...t, ...teamData } : t));
        addToast('Team updated.', 'success');
        return true;
    }, [addToast]);

    const handleDeleteTeam = useCallback(async (teamId: number) => {
        const { error } = await Offline.del('teams', { id: teamId });
        if (error) {
            addToast(error.message, 'error');
            return false;
        }
        deleteItem(setTeams, teamId);
        addToast('Team deleted.', 'success');
        return true;
    }, [addToast]);

    const handleUpdateTeamMembers = useCallback(async (teamId: number, memberIds: string[]) => {
        const supabase = requireSupabaseClient();
        // Delete old
        await supabase.from('team_assignments').delete().eq('team_id', teamId);
        // Insert new
        const newMembers = memberIds.map(uid => ({ team_id: teamId, user_id: uid }));
        if (newMembers.length > 0) {
            await supabase.from('team_assignments').insert(newMembers);
        }
        // Fetch fresh team data to update UI correctly
        const { data } = await supabase.from('teams').select('*, lead:user_profiles!lead_id(*), members:team_assignments(user_id, profile:user_profiles(name))').eq('id', teamId).single();
        if (data) {
             setTeams(prev => prev.map(t => t.id === teamId ? data : t));
        }
        addToast('Team members updated.', 'success');
    }, [addToast]);

    const handleUpdateClassGroupMembers = useCallback(async (groupId: number, studentIds: number[]): Promise<boolean> => {
        const supabase = requireSupabaseClient();
        // Delete old
        const { error: delError } = await supabase.from('class_group_members').delete().eq('group_id', groupId);
        if (delError) {
             addToast(`Error removing members: ${delError.message}`, 'error');
             return false;
        }
        
        // Insert new
        const newMembers = studentIds.map(sid => ({ group_id: groupId, student_id: sid }));
        if (newMembers.length > 0) {
            const { error: insertError } = await supabase.from('class_group_members').insert(newMembers);
            if (insertError) {
                 addToast(`Error adding members: ${insertError.message}`, 'error');
                 return false;
            }
        }
        
        // Refresh
        // Updated query to fetch teaching_assignments
        const { data } = await supabase.from('class_groups').select('*, members:class_group_members(*, student:students(id, name), schedules:attendance_schedules(*), records:attendance_records(*)), teaching_entity:teaching_assignments!teaching_entity_id(*, teacher:user_profiles!teacher_user_id(name), academic_class:academic_classes!academic_class_id(name))').eq('id', groupId).single();
        if (data) {
             // Transform to map student_name from joined student data using utility function
             setClassGroups(prev => prev.map(g => g.id === groupId ? transformClassGroupsWithStudentNames(data) : g));
        }
        addToast('Class group members updated.', 'success');
        return true;
    }, [addToast]);

    const handleSaveAttendanceSchedule = useCallback(async (schedule: Partial<AttendanceSchedule>): Promise<AttendanceSchedule | null> => {
        if (schedule.id) {
            // Update existing
            const { error } = await Offline.update('attendance_schedules', schedule, { id: schedule.id });
            if (error) {
                addToast(`Error updating schedule: ${error.message}`, 'error');
                return null;
            }
            addToast('Schedule updated.', 'success');
            return schedule as AttendanceSchedule;
        } else {
            // Create new
            const { data, error } = await Offline.insert('attendance_schedules', schedule);
            if (error) {
                addToast(`Error creating schedule: ${error.message}`, 'error');
                return null;
            }
            addToast('Schedule created.', 'success');
            return data;
        }
    }, [addToast]);

    const handleDeleteAttendanceSchedule = useCallback(async (scheduleId: number): Promise<boolean> => {
        const { error } = await Offline.del('attendance_schedules', { id: scheduleId });
        if (error) {
            addToast(`Error deleting schedule: ${error.message}`, 'error');
            return false;
        }
        addToast('Schedule deleted.', 'success');
        return true;
    }, [addToast]);

    const handleSaveAttendanceRecord = useCallback(async (record: Partial<AttendanceRecord>): Promise<boolean> => {
        if (record.id) {
            // Update existing
            const { error } = await Offline.update('attendance_records', record, { id: record.id });
            if (error) {
                addToast(`Error updating attendance: ${error.message}`, 'error');
                return false;
            }
            addToast('Attendance updated.', 'success');
            return true;
        } else {
            // Create new
            const { error } = await Offline.insert('attendance_records', record);
            if (error) {
                addToast(`Error recording attendance: ${error.message}`, 'error');
                return false;
            }
            addToast('Attendance recorded.', 'success');
            return true;
        }
    }, [addToast]);

    // Helper function to refresh class groups data
    const refreshClassGroups = useCallback(async () => {
        const supabase = requireSupabaseClient();
        try {
            const { data, error } = await supabase.from('class_groups').select('*, members:class_group_members(*, student:students(id, name), schedules:attendance_schedules(*), records:attendance_records(*)), teaching_entity:teaching_assignments!teaching_entity_id(*, teacher:user_profiles!teacher_user_id(name), academic_class:academic_classes!academic_class_id(name))');
            if (error) {
                console.error('Error refreshing class groups:', error);
                addToast('Failed to refresh class groups data', 'warning');
                return;
            }
            if (data) {
                // Transform to map student_name from joined student data using utility function
                setClassGroups(transformClassGroupsWithStudentNames(data));
            }
        } catch (error: any) {
            console.error('Error refreshing class groups:', error);
            addToast('Failed to refresh class groups data', 'warning');
        }
    }, [addToast]);

    const handleCreateClassAssignment = useCallback(async (
        assignmentData: { teacher_user_id: string; subject_id: number | null; class_id: number; arm_id: number },
        groupData: { name: string; description: string; group_type: 'class_teacher' | 'subject_teacher' }
    ): Promise<boolean> => {
        if (!userProfile || userType !== 'staff') return false;
        const staffProfile = userProfile as UserProfile;
        
        try {
            // Get the active term
            const activeTerm = terms.find(t => t.is_active);
            if (!activeTerm) {
                addToast('No active term found. Please set an active term first.', 'error');
                return false;
            }
            
            // Validate arm is provided
            if (!assignmentData.arm_id) {
                addToast('Arm is required for all class groups', 'error');
                return false;
            }
            
            // Look up class name from class_id
            const classRecord = allClasses.find(c => c.id === assignmentData.class_id);
            if (!classRecord) {
                addToast('Invalid class selected', 'error');
                return false;
            }
            
            // Look up arm name from arm_id
            const armRecord = allArms.find(a => a.id === assignmentData.arm_id);
            if (!armRecord) {
                addToast('Invalid arm selected', 'error');
                return false;
            }
            
            // Find the matching academic_class for the current session
            console.log('[handleCreateClassAssignment] Looking for academic class:', {
                level: classRecord.name,
                arm: armRecord.name,
                session: activeTerm.session_label,
                availableClasses: academicClasses.length
            });
            
            let academicClass = academicClasses.find(ac => 
                ac.level === classRecord.name && 
                ac.arm === armRecord.name &&
                ac.session_label === activeTerm.session_label
            );
            
            console.log('[handleCreateClassAssignment] Found in local state:', {
                foundId: academicClass?.id,
                foundName: academicClass?.name
            });
            
            let academicClassId: number | null = null;
            
            // If not found in local state, try direct database lookup as fallback
            if (!academicClass) {
                console.log('[handleCreateClassAssignment] Not found in local state, trying database lookup...');
                const supabase = requireSupabaseClient();
                const { data: dbClass, error: lookupError } = await supabase
                    .from('academic_classes')
                    .select('id')
                    .eq('level', classRecord.name)
                    .eq('arm', armRecord.name)
                    .eq('session_label', activeTerm.session_label)
                    .single();
                
                if (lookupError) {
                    console.warn('[handleCreateClassAssignment] Database lookup error:', lookupError);
                }
                
                if (dbClass) {
                    console.log('[handleCreateClassAssignment] Found in database:', dbClass.id);
                    academicClassId = dbClass.id;
                } else {
                    addToast(`No academic class found for ${classRecord.name} ${armRecord.name} in session ${activeTerm.session_label}. Please create the academic class first.`, 'error');
                    return false;
                }
            } else {
                // Verify the academic class exists in the database
                const supabase = requireSupabaseClient();
                const { data: dbAcademicClass, error: verifyError } = await supabase
                    .from('academic_classes')
                    .select('id')
                    .eq('id', academicClass.id)
                    .single();
                
                if (verifyError || !dbAcademicClass) {
                    console.warn('[handleCreateClassAssignment] Academic class not found in database, data may be stale');
                    addToast('Data was out of sync. Please refresh the page and try again.', 'warning');
                    return false;
                }
                
                console.log('[handleCreateClassAssignment] Verified academic class exists in database:', dbAcademicClass.id);
                academicClassId = academicClass.id;
            }
            
            // Handle subject - required for Subject Teacher Groups, optional for Class Teacher Groups
            let subjectName: string | null = null;
            if (groupData.group_type === 'subject_teacher') {
                if (!assignmentData.subject_id) {
                    addToast('Subject is required for Subject Teacher groups', 'error');
                    return false;
                }
                const subject = allSubjects.find(s => s.id === assignmentData.subject_id);
                if (!subject) {
                    addToast('Invalid subject selected', 'error');
                    return false;
                }
                subjectName = subject.name;
            }
            
            // Create teaching assignment with correct academic_class_id
            const { data: assignment, error: assignmentError } = await Offline.insert('teaching_assignments', {
                teacher_user_id: assignmentData.teacher_user_id,
                subject_name: subjectName,
                academic_class_id: academicClassId,  // ✅ Now uses the correct academic_classes.id
                school_id: staffProfile.school_id,
                term_id: activeTerm.id
            });
            
            if (assignmentError || !assignment) {
                addToast(`Error creating assignment: ${assignmentError?.message || 'Unknown error'}`, 'error');
                return false;
            }
            
            // Create class group linked to the teaching assignment
            const { error: groupError } = await Offline.insert('class_groups', {
                ...groupData,
                teaching_entity_id: assignment.id,
                school_id: staffProfile.school_id,
                created_by: staffProfile.id
            });
            
            if (groupError) {
                addToast(`Error creating class group: ${groupError.message}`, 'error');
                return false;
            }
            
            // Refresh data
            await refreshClassGroups();
            
            addToast('Class assignment created successfully.', 'success');
            return true;
        } catch (error: any) {
            addToast(`Error creating class assignment: ${error.message}`, 'error');
            return false;
        }
    }, [userProfile, userType, addToast, allClasses, allArms, allSubjects, academicClasses, terms, refreshClassGroups]);

    const handleDeleteClassAssignment = useCallback(async (groupId: number): Promise<boolean> => {
        try {
            const { error } = await Offline.del('class_groups', { id: groupId });
            if (error) {
                addToast(`Error deleting class assignment: ${error.message}`, 'error');
                return false;
            }
            
            // Refresh class groups
            await refreshClassGroups();
            
            addToast('Class assignment deleted successfully.', 'success');
            return true;
        } catch (error: any) {
            addToast(`Error deleting class assignment: ${error.message}`, 'error');
            return false;
        }
    }, [addToast, refreshClassGroups]);

    const handleAddPolicySnippet = useCallback(async (content: string) => {
        if (!userProfile) return;
        const authorName = 'name' in userProfile ? userProfile.name : (userProfile as StudentProfile).full_name;
        const { error, data } = await Offline.insert('living_policy_snippets', { content, school_id: userProfile.school_id, author_id: userProfile.id });
        if(error) addToast(error.message, 'error');
        else {
            if(data) addItem(setLivingPolicy, { ...data, author: { name: authorName } });
            addToast('Policy snippet added.', 'success');
        }
    }, [userProfile, addToast]);

    const handleGenerateLivingPolicyDocument = useCallback(async (content: string) => {
        if (!schoolSettings) return false;
        await handleUpdateSchoolSettings({
            school_documents: {
                ...schoolSettings.school_documents,
                living_policy_document: { generated_at: new Date().toISOString(), content }
            }
        });
        return true;
    }, [schoolSettings, handleUpdateSchoolSettings]);

    const handleSendEmergencyBroadcast = useCallback(async (title: string, message: string) => {
        addToast(`Broadcast sent: ${title}`, 'success');
    }, [addToast]);

    const sanitizeFileName = (name: string) => name.replace(/[^A-Za-z0-9._-]/g, '_');

    const handleUpdateAvatar = useCallback(async (file: File) => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return null;
        const filePath = `avatars/${userProfile.id}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('avatars').upload(filePath, file);
        if (error) {
            addToast(error.message, 'error');
            return null;
        }
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        await handleUpdateProfile({ avatar_url: data.publicUrl });
        return data.publicUrl;
    }, [userProfile, handleUpdateProfile, addToast]);

    const handleUploadCertification = useCallback(async (file: File, metadata: { certification_type?: string; certification_number?: string; expiry_date?: string; staff_id?: string } = {}) => {
        const supabase = requireSupabaseClient();
        if (!userProfile || userType !== 'staff') return false;
        const currentUser = userProfile as UserProfile;
        const staffId = metadata.staff_id || currentUser.id;
        const privilegedRoles: RoleTitle[] = ['Admin', 'Principal', 'Team Lead'];
        const canManage = staffId === currentUser.id || privilegedRoles.includes(currentUser.role);

        if (!canManage) {
            addToast('You do not have permission to upload this certification.', 'error');
            return false;
        }

        const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!allowedTypes.includes(file.type)) {
            addToast('Only PDF, JPG, or PNG files are allowed.', 'error');
            return false;
        }

        if (file.size > maxSize) {
            addToast('File is too large. Maximum size is 10MB.', 'error');
            return false;
        }

        const sanitized = sanitizeFileName(file.name);
        const filePath = `staff/${staffId}/certifications/${Date.now()}_${sanitized}`;

        const { error: uploadError } = await supabase.storage.from('staff-certifications').upload(filePath, file, { contentType: file.type });
        if (uploadError) {
            addToast(`Upload failed: ${uploadError.message}`, 'error');
            return false;
        }

        const insertPayload = {
            staff_id: staffId,
            file_path: filePath,
            file_name: sanitized,
            mime_type: file.type,
            size: file.size,
            uploaded_by: currentUser.id,
            certification_type: metadata.certification_type || null,
            certification_number: metadata.certification_number || null,
            expiry_date: metadata.expiry_date || null,
        };

        const { data, error } = await supabase
            .from('staff_certifications')
            .insert(insertPayload)
            .select('*, uploader:user_profiles!uploaded_by(name)')
            .single();

        if (error) {
            addToast(`Failed to save certification record: ${error.message}`, 'error');
            return false;
        }

        if (data) {
            setStaffCertifications(prev => [data as StaffCertification, ...prev]);
        }

        addToast('Certification uploaded securely.', 'success');
        return true;
    }, [userProfile, userType, addToast]);

    const handleDeleteCertification = useCallback(async (certificationId: number) => {
        const supabase = requireSupabaseClient();
        if (!userProfile || userType !== 'staff') return false;
        const currentUser = userProfile as UserProfile;
        const target = staffCertifications.find(c => c.id === certificationId);
        if (!target) {
            addToast('Certification not found.', 'error');
            return false;
        }

        const privilegedRoles: RoleTitle[] = ['Admin', 'Principal', 'Team Lead'];
        const canManage = target.staff_id === currentUser.id || privilegedRoles.includes(currentUser.role);
        if (!canManage) {
            addToast('You do not have permission to delete this certification.', 'error');
            return false;
        }

        if (target.file_path) {
            await supabase.storage.from('staff-certifications').remove([target.file_path]);
        }

        const { error } = await supabase.from('staff_certifications').delete().eq('id', certificationId);
        if (error) {
            addToast(`Failed to delete certification: ${error.message}`, 'error');
            return false;
        }

        setStaffCertifications(prev => prev.filter(c => c.id !== certificationId));
        addToast('Certification deleted.', 'success');
        return true;
    }, [userProfile, userType, staffCertifications, addToast]);

    const handleGetCertificationUrl = useCallback(async (certification: StaffCertification) => {
        const supabase = requireSupabaseClient();
        const { data, error } = await supabase.storage.from('staff-certifications').createSignedUrl(certification.file_path, 3600);
        if (error) {
            addToast(`Unable to generate download link: ${error.message}`, 'error');
            return null;
        }
        return data?.signedUrl || null;
    }, [addToast]);

    const handleResetPassword = useCallback(async () => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return;
        const email = (userProfile as any).email || session?.user?.email;
        if (email) {
            await supabase.auth.resetPasswordForEmail(email);
            addToast('Password reset email sent.', 'info');
        }
    }, [userProfile, session, addToast]);

    const handleUpdateEmail = useCallback(async (email: string) => {
         const supabase = requireSupabaseClient();
         const { error } = await supabase.auth.updateUser({ email });
         if (error) addToast(error.message, 'error');
         else addToast('Confirmation email sent to new address.', 'info');
    }, [addToast]);

    // ... (Survey handlers)
    const handleSaveSurvey = useCallback(async (surveyData: any) => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return;
        const { questions, ...surveyFields } = surveyData;
        
        let surveyId = surveyData.id;
        
        // NOTE: We are using the 'quizzes' table in the DB but calling it 'surveys' in the UI
        if (surveyId) {
            await Offline.update('quizzes', surveyFields, { id: surveyId });
        } else {
             const { data, error } = await Offline.insert('quizzes', { ...surveyFields, school_id: userProfile.school_id, created_by: userProfile.id });
             if (error) { addToast(error.message, 'error'); return; }
             surveyId = data.id;
        }

        if (surveyId) {
            await supabase.from('quiz_questions').delete().eq('quiz_id', surveyId);
            const questionsWithId = questions.map((q: any) => ({ ...q, quiz_id: surveyId }));
            await supabase.from('quiz_questions').insert(questionsWithId);
        }
        
        const { data } = await supabase.from('quizzes').select('*, questions:quiz_questions(*)');
        setSurveys(data || []);
        addToast('Survey saved.', 'success');
    }, [userProfile, addToast]);

    const handleDeleteSurvey = useCallback(async (id: number) => {
        await Offline.del('quizzes', { id });
        deleteItem(setSurveys, id);
        addToast('Survey deleted.', 'success');
    }, [addToast]);

    // ... (Curriculum handlers)
    const handleSaveCurriculum = useCallback(async (
        teachingAssignmentId: number,
        weeksData: { week_number: number; expected_topics: string }[]
    ): Promise<boolean> => {
        if (!userProfile || userType !== 'staff') return false;
        const staffProfile = userProfile as UserProfile;
        
        try {
            // Check if curriculum exists for this teaching assignment
            const { data: existingCurriculum } = await supabase
                .from('curriculum')
                .select('id')
                .eq('teaching_entity_id', teachingAssignmentId)
                .maybeSingle();
            
            let curriculumId: number;
            
            if (existingCurriculum) {
                curriculumId = existingCurriculum.id;
            } else {
                // Create new curriculum
                const { data: newCurriculum, error: createError } = await Offline.insert('curriculum', {
                    teaching_entity_id: teachingAssignmentId,
                    school_id: staffProfile.school_id
                });
                
                if (createError || !newCurriculum) {
                    addToast(`Error creating curriculum: ${createError?.message || 'Unknown error'}`, 'error');
                    return false;
                }
                curriculumId = newCurriculum.id;
            }
            
            // Delete existing weeks for this curriculum
            await supabase.from('curriculum_weeks').delete().eq('curriculum_id', curriculumId);
            
            // Insert new weeks (only non-empty ones)
            const weeksToInsert = weeksData
                .filter(w => w.expected_topics && w.expected_topics.trim())
                .map(w => ({
                    curriculum_id: curriculumId,
                    week_number: w.week_number,
                    expected_topics: w.expected_topics
                }));
            
            if (weeksToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('curriculum_weeks')
                    .insert(weeksToInsert);
                
                if (insertError) {
                    addToast(`Error saving curriculum weeks: ${insertError.message}`, 'error');
                    return false;
                }
            }
            
            // Refresh curriculum data filtered by school
            const supabase = requireSupabaseClient();
            const { data: refreshedCurricula } = await supabase
                .from('curriculum')
                .select('*')
                .eq('school_id', staffProfile.school_id);
            if (refreshedCurricula) setCurricula(refreshedCurricula);
            
            const { data: refreshedWeeks } = await supabase
                .from('curriculum_weeks')
                .select('*, curriculum!inner(school_id)')
                .eq('curriculum.school_id', staffProfile.school_id);
            if (refreshedWeeks) setCurriculumWeeks(refreshedWeeks.map(w => ({
                id: w.id,
                curriculum_id: w.curriculum_id,
                week_number: w.week_number,
                expected_topics: w.expected_topics
            })));
            
            addToast('Curriculum saved successfully.', 'success');
            return true;
        } catch (error: any) {
            addToast(`Error saving curriculum: ${error.message}`, 'error');
            return false;
        }
    }, [userProfile, userType, addToast, setCurricula, setCurriculumWeeks]);

    // ... (Lesson Plan handlers)
    const handleSaveLessonPlan = useCallback(async (planData: Partial<LessonPlan>, generateWithAi: boolean, file: File | null) => {
        if (!userProfile) return null;
        let finalPlanData = { ...planData };

        if (generateWithAi) {
            const aiClient = getAIClient();
            if (aiClient) {
                const prompt = `Generate a detailed lesson plan for "${planData.title}" (Grade: ${planData.grade_level}). Include objectives, materials, activities, and assessment methods. Format as JSON matching the LessonPlan structure.`;
                try {
                    const response = await aiClient.chat.completions.create({
                        model: schoolSettings?.ai_settings?.default_model || 'llama-3.1-8b-instant',
                        messages: [{ role: 'user', content: prompt }],
                        response_format: { type: 'json_object' }
                    });
                    const generated = extractAndParseJson<Partial<LessonPlan>>(textFromAI(response));
                    if (generated) finalPlanData = { ...finalPlanData, ...generated };
                } catch (e) {
                    console.error("AI Gen failed", e);
                    addToast("AI generation failed, saving manual input.", "error");
                }
            }
        }
        
        if (file) {
             const supabase = requireSupabaseClient();
             const filePath = `lesson_plans/${Date.now()}_${file.name}`;
             const { error } = await supabase.storage.from('lesson_plans').upload(filePath, file);
             if (!error) {
                 const { data } = supabase.storage.from('lesson_plans').getPublicUrl(filePath);
                 finalPlanData.file_url = data.publicUrl;
             }
        }

        if (finalPlanData.id) {
             const { error } = await Offline.update('lesson_plans', finalPlanData, { id: finalPlanData.id });
             if (error) { addToast(error.message, 'error'); return null; }
             setLessonPlans(prev => prev.map(p => p.id === finalPlanData.id ? { ...p, ...finalPlanData } as LessonPlan : p));
        } else {
             const { error, data } = await Offline.insert('lesson_plans', { ...finalPlanData, school_id: userProfile.school_id, author_id: userProfile.id });
             if (error) { addToast(error.message, 'error'); return null; }
             if (data) addItem(setLessonPlans, data);
             return data;
        }
        addToast('Lesson plan saved.', 'success');
        return finalPlanData as LessonPlan;
    }, [userProfile, addToast]);

    // ... (Other Lesson Plan Handlers: analyze, copy, approve) ...
    const handleAnalyzeLessonPlan = useCallback(async (planId: number) => {
        const aiClient = getAIClient();
        if (!aiClient) return null;
        return { has_objectives: true, has_assessment: true, clarity_score: 8, suggestions: ["Add more details"] };
    }, []);

    const handleCopyLessonPlan = useCallback(async (sourcePlan: LessonPlan, targetEntityIds: number[]) => {
        if (!userProfile) return false;
        // Use a loop for offline client compatibility or create a bulk insert method.
        // Let's use loop for safety with current Offline client implementation.
        let successCount = 0;
        for (const tid of targetEntityIds) {
             const newPlan = {
                ...sourcePlan,
                id: undefined, // remove ID
                teaching_entity_id: tid,
                school_id: userProfile.school_id,
                author_id: userProfile.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                // Reset status fields
                submission_status: 'Pending',
                coverage_status: 'Pending',
                coverage_notes: null,
                status: 'draft'
             };
             const { error } = await Offline.insert('lesson_plans', newPlan);
             if (!error) successCount++;
        }
        
        if (successCount > 0) {
             addToast(`Successfully copied plan to ${successCount} assignments.`, 'success');
             // Refresh lesson plans
             // Updated query to fetch teaching_assignments
             const supabase = requireSupabaseClient();
             const { data } = await supabase.from('lesson_plans').select('*, author:user_profiles!author_id(name), teaching_entity:teaching_assignments!teaching_entity_id(*, teacher:user_profiles!teacher_user_id(name), academic_class:academic_classes!academic_class_id(name))').limit(10000);
             if (data) setLessonPlans(data as any);
             return true;
        } else {
            addToast("Failed to copy lesson plan.", "error");
            return false;
        }
    }, [userProfile, addToast]);

    const handleApproveLessonPlan = useCallback(async (plan: LessonPlan) => {
        const { error } = await Offline.update('lesson_plans', { status: 'approved' }, { id: plan.id });
        if (error) {
            addToast("Failed to approve plan.", "error");
        } else {
            setLessonPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: 'approved' } : p));
            addToast("Lesson plan approved.", "success");
        }
   }, [addToast]);

    const handleSubmitLessonPlanForReview = useCallback(async (plan: LessonPlan) => {
        const { error } = await Offline.update('lesson_plans', { status: 'submitted' }, { id: plan.id });
        if (error) {
            addToast("Failed to submit plan for review.", "error");
        } else {
            setLessonPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: 'submitted' } : p));
            addToast("Lesson plan submitted for review.", "success");
        }
    }, [addToast]);

    // --- Score Entry Handlers ---
    const handleSaveScores = useCallback(async (scores: Partial<ScoreEntry>[]): Promise<boolean> => {
        const supabase = requireSupabaseClient();
        if (!userProfile || userType !== 'staff') return false;
        
        try {
            // Get current valid student IDs
            const validStudentIds = new Set(students.map(s => s.id));
            
            // Filter out scores for students that no longer exist
            const validScores = scores.filter(score => {
                // student_id is required - skip if missing
                if (score.student_id == null) {
                    console.warn('Skipping score with missing student_id');
                    return false;
                }
                if (!validStudentIds.has(score.student_id)) {
                    console.warn(`Skipping score for non-existent student ID: ${score.student_id}`);
                    return false;
                }
                return true;
            });
            
            if (validScores.length === 0) {
                addToast('No valid students to save scores for. Please refresh the page.', 'error');
                return false;
            }
            
            if (validScores.length < scores.length) {
                addToast(`${scores.length - validScores.length} student(s) were skipped because they no longer exist. Saving remaining scores...`, 'info');
            }
            
            // Add entered_by_user_id and last_modified_by_user_id to each score
            const enrichedScores = validScores.map(score => ({
                ...score,
                entered_by_user_id: score.entered_by_user_id || userProfile.id,
                last_modified_by_user_id: userProfile.id
            }));

            // Bulk upsert scores using the unique constraint (term_id, academic_class_id, subject_name, student_id)
            const { error } = await supabase
                .from('score_entries')
                .upsert(enrichedScores, { onConflict: 'term_id,academic_class_id,subject_name,student_id' });
            
            if (error) {
                addToast(`Error saving scores: ${error.message}`, 'error');
                // If foreign key error, trigger data refresh
                if (error.message.includes('foreign key constraint') || error.message.includes('violates')) {
                    addToast('Data may be stale. Please refresh the page.', 'warning');
                }
                return false;
            }
            
            // Detect zero scores and log them for admin/team leader review
            // Helper function to check if a value is an explicit zero (not undefined/null)
            const isExplicitZero = (value: any): boolean => {
                return value === 0 && value !== undefined && value !== null;
            };
            
            const zeroScoreEntries: Omit<ZeroScoreEntry, 'id' | 'created_at' | 'reviewed' | 'reviewed_by' | 'reviewed_at' | 'review_notes'>[] = [];
            const staffProfile = userProfile as UserProfile;
            
            for (const score of validScores) {
                // Check if any component scores are explicitly zero
                const componentScores = score.component_scores || {};
                const hasZeroComponent = Object.entries(componentScores).some(([name, value]) => isExplicitZero(value));
                const hasZeroTotal = isExplicitZero(score.total_score);
                
                if (hasZeroComponent || hasZeroTotal) {
                    // Find which component(s) have explicit zero
                    const zeroComponents = Object.entries(componentScores)
                        .filter(([_, value]) => isExplicitZero(value))
                        .map(([name, _]) => name);
                    
                    // Create entry for each zero component, or one for zero total if no components
                    if (zeroComponents.length > 0) {
                        for (const componentName of zeroComponents) {
                            zeroScoreEntries.push({
                                school_id: score.school_id,
                                term_id: score.term_id,
                                academic_class_id: score.academic_class_id,
                                subject_name: score.subject_name,
                                student_id: score.student_id,
                                teacher_user_id: staffProfile.id,
                                component_name: componentName,
                                total_score: score.total_score || 0,
                                teacher_comment: score.remark, // Use 'remark' from ScoreEntry
                                entry_date: new Date().toISOString()
                            });
                        }
                    } else if (hasZeroTotal) {
                        zeroScoreEntries.push({
                            school_id: score.school_id,
                            term_id: score.term_id,
                            academic_class_id: score.academic_class_id,
                            subject_name: score.subject_name,
                            student_id: score.student_id,
                            teacher_user_id: staffProfile.id,
                            component_name: null,
                            total_score: 0,
                            teacher_comment: score.remark, // Use 'remark' from ScoreEntry
                            entry_date: new Date().toISOString()
                        });
                    }
                }
            }
            
            // Insert zero score entries if any were detected
            if (zeroScoreEntries.length > 0) {
                const { error: zeroScoreError } = await supabase
                    .from('zero_score_entries')
                    .insert(zeroScoreEntries);
                
                if (zeroScoreError) {
                    console.error('Error logging zero scores:', zeroScoreError);
                    // Don't fail the entire save operation if zero score logging fails
                }
                
                // Create notifications for admins and team leaders
                const { data: adminUsers } = await supabase
                    .from('user_profiles')
                    .select('id')
                    .eq('school_id', staffProfile.school_id)
                    .in('role', ['Admin', 'Team Lead', 'Principal']);
                
                if (adminUsers && adminUsers.length > 0) {
                    const notifications = adminUsers.map(admin => ({
                        user_id: admin.id,
                        message: `Zero scores have been entered by ${staffProfile.name}. ${zeroScoreEntries.length} student(s) affected. Please review.`,
                        is_read: false,
                        created_at: new Date().toISOString()
                    }));
                    
                    await supabase.from('notifications').insert(notifications);
                }
            }
            
            // Refresh score entries for the current school
            const { data: refreshedScores } = await supabase
                .from('score_entries')
                .select('*')
                .eq('school_id', staffProfile.school_id);
            if (refreshedScores) setScoreEntries(refreshedScores);
            
            addToast('Scores saved successfully.', 'success');
            return true;
        } catch (error: any) {
            addToast(`Error saving scores: ${error.message}`, 'error');
            return false;
        }
    }, [userProfile, userType, addToast, setScoreEntries, students]);

    const handleUpdateScore = useCallback(async (scoreId: number, updates: Partial<ScoreEntry>): Promise<boolean> => {
        if (!userProfile || userType !== 'staff') return false;
        const staffProfile = userProfile as UserProfile;
        
        const supabase = requireSupabaseClient();
        
        try {
            // Update the score entry
            const { error } = await supabase
                .from('score_entries')
                .update(updates)
                .eq('id', scoreId);
            
            if (error) {
                addToast(`Error updating score: ${error.message}`, 'error');
                return false;
            }
            
            // Refresh score entries for the current school
            const { data: refreshedScores } = await supabase
                .from('score_entries')
                .select('*')
                .eq('school_id', staffProfile.school_id);
            if (refreshedScores) setScoreEntries(refreshedScores);
            
            return true;
        } catch (error: any) {
            addToast(`Error updating score: ${error.message}`, 'error');
            return false;
        }
    }, [userProfile, userType, addToast, setScoreEntries]);

    const handleSubmitScoresForReview = useCallback(async (assignmentId: number): Promise<boolean> => {
        if (!userProfile || userType !== 'staff') return false;
        const staffProfile = userProfile as UserProfile;
        
        const supabase = requireSupabaseClient();
        
        try {
            const { error } = await Offline.update('teaching_assignments', 
                { submitted_at: new Date().toISOString() }, 
                { id: assignmentId }
            );
            
            if (error) {
                addToast(`Error submitting scores for review: ${error.message}`, 'error');
                return false;
            }
            
            // Refresh academic assignments for the current school
            const { data: refreshedAssignments } = await supabase
                .from('teaching_assignments')
                .select('*, term:terms(*), academic_class:academic_classes(*, assessment_structure:assessment_structures(*)), teacher:user_profiles!teacher_user_id(*)')
                .eq('school_id', staffProfile.school_id);
            
            if (refreshedAssignments) setAcademicAssignments(refreshedAssignments as any);
            
            addToast('Scores submitted for review successfully.', 'success');
            return true;
        } catch (error: any) {
            addToast(`Error submitting scores: ${error.message}`, 'error');
            return false;
        }
    }, [userProfile, userType, addToast, setAcademicAssignments]);

    // --- Campus Handlers ---
    const handleSaveCampus = useCallback(async (campus: Partial<Campus>) => {
        if (!userProfile) return false;
        // Separate ID from payload to avoid updating the primary key (which Supabase allows but might be finicky with Partial types)
        const { id, ...updates } = campus;
        const payload = { ...updates, school_id: userProfile.school_id };
        
        if (id) {
             const { error } = await Offline.update('campuses', payload, { id });
             if (error) {
                 addToast(error.message, 'error');
                 return false;
             }
             setCampuses(prev => prev.map(c => c.id === id ? { ...c, ...payload } as Campus : c));
        } else {
             const { data, error } = await Offline.insert('campuses', payload);
             if (error) {
                 addToast(error.message, 'error');
                 return false;
             }
             if (data) setCampuses(prev => [...prev, data]);
        }
        addToast('Campus saved successfully.', 'success');
        return true;
    }, [userProfile, addToast]);

    const handleDeleteCampus = useCallback(async (id: number) => {
        const { error } = await Offline.del('campuses', { id });
        if (error) {
            addToast(error.message, 'error');
            return false;
        }
        setCampuses(prev => prev.filter(c => c.id !== id));
        addToast('Campus deleted.', 'success');
        return true;
    }, [addToast]);

    // --- Order Handlers ---
    const handleCreateOrder = useCallback(async (items: { inventory_item_id: number; quantity: number; unit_price: number }[]) => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return false;
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        
        // 1. Create Order
        const { data: order, error: orderError } = await Offline.insert('orders', {
            school_id: userProfile.school_id,
            user_id: userProfile.id,
            total_amount: totalAmount,
            status: 'Paid', // Simulating instant payment
            payment_reference: `REF-${Date.now()}`
        });

        if (orderError || !order) {
            addToast(`Order creation failed: ${orderError?.message}`, 'error');
            return false;
        }

        // 2. Create Order Items & Update Inventory
        // Note: Ideally this should be a transaction or RPC, but simulating with sequential calls for now.
        for (const item of items) {
            await Offline.insert('order_items', {
                order_id: order.id,
                ...item
            });
            
            // Decrement stock (Offline client handles optimistic update if online)
            // We need to fetch current stock first to be safe, or just decrement blindly via RPC if we had one.
            // For simplicity, assume local state is correct enough for the optimistic update, but DB update handles concurrency better.
            // Since we don't have a decrement RPC ready, we'll do a read-modify-write pattern which is risky for concurrency but okay for MVP.
            // Actually, let's just skip the stock update on client side logic and rely on admin/backend, 
            // OR do a simple update if we have the item in state.
            const inventoryItem = inventory.find(i => i.id === item.inventory_item_id);
            if (inventoryItem) {
                 const newStock = Math.max(0, inventoryItem.stock - item.quantity);
                 await Offline.update('inventory_items', { stock: newStock }, { id: item.inventory_item_id });
                 setInventory(prev => prev.map(i => i.id === item.inventory_item_id ? { ...i, stock: newStock } : i));
            }
        }
        
        // Refresh orders with fallback
        try {
            const fullQuery = await supabase.from('orders')
                .select('*, items:order_items(*, inventory_item:inventory_items!inventory_item_id(name, image_url)), user:user_profiles!user_id(name, email), notes:order_notes(*, author:user_profiles!author_id(name))')
                .order('created_at', { ascending: false });
            
            if (fullQuery.error) throw fullQuery.error;
            if (fullQuery.data) setOrders(fullQuery.data as any);
        } catch (e) {
            console.warn('[Orders] Full query failed, using fallback without notes:', e);
            const fallbackQuery = await supabase.from('orders')
                .select('*, items:order_items(*, inventory_item:inventory_items!inventory_item_id(name, image_url)), user:user_profiles!user_id(name, email)')
                .order('created_at', { ascending: false });
            
            if (fallbackQuery.error) {
                console.error('[Orders] Fallback query also failed:', fallbackQuery.error);
                addToast('Order created but failed to refresh order list. Please refresh the page.', 'warning');
            } else if (fallbackQuery.data) {
                setOrders(fallbackQuery.data as any);
            }
        }

        return true;
    }, [userProfile, inventory, addToast]);

    const handleUpdateOrderStatus = useCallback(async (orderId: number, status: OrderStatus) => {
        const { error } = await Offline.update('orders', { status }, { id: orderId });
        if (error) {
            addToast(`Failed to update order: ${error.message}`, 'error');
        } else {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
            addToast('Order status updated.', 'success');
        }
    }, [addToast]);
    
    const handleAddOrderNote = useCallback(async (orderId: number, note: string) => {
        if (!userProfile) return;
        const { data, error } = await Offline.insert('order_notes', {
            order_id: orderId,
            author_id: userProfile.id,
            note
        });
        if (error) {
            addToast(`Failed to add note: ${error.message}`, 'error');
        } else {
             // Optimistic update for nested relation is tricky without deep clone or refetch.
             // Simplest is refetch or manual construct.
             const authorName = 'name' in userProfile ? userProfile.name : (userProfile as StudentProfile).full_name;
             const newNote = { ...data, author: { name: authorName } };
             setOrders(prev => prev.map(o => o.id === orderId ? { ...o, notes: [newNote, ...(o.notes || [])] } : o));
             addToast('Note added.', 'success');
        }
    }, [userProfile, addToast]);
    
    const handleDeleteOrderNote = useCallback(async (noteId: number) => {
         const { error } = await Offline.del('order_notes', { id: noteId });
         if (error) {
             addToast(`Failed to delete note: ${error.message}`, 'error');
         } else {
             setOrders(prev => prev.map(o => ({
                 ...o,
                 notes: o.notes?.filter(n => n.id !== noteId)
             })));
             addToast('Note deleted.', 'success');
         }
    }, [addToast]);
    
    const handleRunPayroll = useCallback(async (staffPay: Record<string, { base_pay: string, commission: string }>) => {
        const supabase = requireSupabaseClient();
        const items = Object.entries(staffPay).map(([userId, pay]) => ({
            user_id: userId,
            gross_amount: Number(pay.base_pay) + Number(pay.commission),
            adjustment_ids: payrollAdjustments.filter(a => a.user_id === userId && !a.payroll_run_id).map(a => a.id),
            // Bank details needed by edge function
            name: users.find(u => u.id === userId)?.name || 'Staff',
            account_number: users.find(u => u.id === userId)?.account_number || '',
            bank_code: users.find(u => u.id === userId)?.bank_code || ''
        }));
        
        const { error } = await supabase.functions.invoke('run-payroll', {
            body: { periodLabel: `Payroll ${new Date().toLocaleDateString()}`, items, reason: 'Salary' }
        });
        
        if (error) addToast(error.message, 'error');
        else { addToast('Payroll run initiated', 'success'); if(session?.user) fetchDataRef.current(session.user, true); }
    }, [payrollAdjustments, users, addToast, session]);

    // --- Shift Handlers ---
    const handleSaveShift = useCallback(async (shift: Partial<TeacherShift>): Promise<boolean> => {
        if (!userProfile) return false;
        const { id, ...updates } = shift;
        const payload = { ...updates, school_id: userProfile.school_id };
        
        if (id) {
            const { error } = await Offline.update('teacher_shifts', payload, { id });
            if (error) {
                addToast(error.message, 'error');
                return false;
            }
            setTeacherShifts(prev => prev.map(s => s.id === id ? { ...s, ...payload } as TeacherShift : s));
        } else {
            const { data, error } = await Offline.insert('teacher_shifts', payload);
            if (error) {
                addToast(error.message, 'error');
                return false;
            }
            if (data) setTeacherShifts(prev => [...prev, data]);
        }
        addToast('Shift saved successfully.', 'success');
        return true;
    }, [userProfile, addToast]);

    const handleDeleteShift = useCallback(async (id: number): Promise<boolean> => {
        const { error } = await Offline.del('teacher_shifts', { id });
        if (error) {
            addToast(error.message, 'error');
            return false;
        }
        setTeacherShifts(prev => prev.filter(s => s.id !== id));
        addToast('Shift deleted.', 'success');
        return true;
    }, [addToast]);

    // --- Leave Type Handlers ---
    const handleSaveLeaveType = useCallback(async (leaveType: Partial<LeaveType>): Promise<boolean> => {
        if (!userProfile) return false;
        const { id, ...updates } = leaveType;
        const payload = { ...updates, school_id: userProfile.school_id };
        
        if (id) {
            const { error } = await Offline.update('leave_types', payload, { id });
            if (error) {
                addToast(error.message, 'error');
                return false;
            }
            setLeaveTypes(prev => prev.map(lt => lt.id === id ? { ...lt, ...payload } as LeaveType : lt));
        } else {
            const { data, error } = await Offline.insert('leave_types', payload);
            if (error) {
                addToast(error.message, 'error');
                return false;
            }
            if (data) setLeaveTypes(prev => [...prev, data]);
        }
        addToast('Leave type saved successfully.', 'success');
        return true;
    }, [userProfile, addToast]);

    const handleDeleteLeaveType = useCallback(async (id: number): Promise<boolean> => {
        const { error } = await Offline.del('leave_types', { id });
        if (error) {
            addToast(error.message, 'error');
            return false;
        }
        setLeaveTypes(prev => prev.filter(lt => lt.id !== id));
        addToast('Leave type deleted.', 'success');
        return true;
    }, [addToast]);

    // --- Social Links Handlers ---
    const handleSaveSocialLinks = useCallback(async (links: SocialAccount): Promise<void> => {
        if (!userProfile || !schoolSettings) {
            addToast('Unable to save social links: missing profile or settings', 'error');
            return;
        }
        
        try {
            const success = await handleUpdateSchoolSettings({
                social_accounts: links
            });
            
            if (success) {
                setSocialAccounts(links);
                addToast('Social links saved successfully.', 'success');
            } else {
                addToast('Failed to save social links.', 'error');
            }
        } catch (e: unknown) {
            console.error('Error saving social links:', e);
            const errorMessage = e instanceof Error ? e.message : String(e);
            addToast(`Failed to save social links: ${errorMessage}`, 'error');
        }
    }, [userProfile, schoolSettings, handleUpdateSchoolSettings, addToast, setSocialAccounts]);

    // --- Leave Request Handlers ---
    const handleSubmitLeaveRequest = useCallback(async (request: Partial<LeaveRequest>): Promise<boolean> => {
        if (!userProfile) return false;
        const payload = { ...request, requester_id: userProfile.id, school_id: userProfile.school_id, status: LeaveRequestStatus.Pending };
        const { error, data } = await Offline.insert('leave_requests', payload);
        if (error) {
            addToast(error.message, 'error');
            return false;
        }
        if (data) {
            // Fetch the full leave request with relations
            const { data: fullRequest } = await supabase
                .from('leave_requests')
                .select('*, leave_type:leave_types(*), requester:user_profiles!requester_id(*)')
                .eq('id', data.id)
                .single();
            if (fullRequest) setLeaveRequests(prev => [...prev, fullRequest as any]);
        }
        addToast('Leave request submitted.', 'success');
        return true;
    }, [userProfile, addToast]);

    const handleApproveLeaveRequest = useCallback(async (requestId: number, status: 'Approved' | 'Rejected', notes?: string): Promise<boolean> => {
        if (!userProfile) return false;
        // Validate status
        if (status !== 'Approved' && status !== 'Rejected') {
            addToast('Invalid status value', 'error');
            return false;
        }
        const mappedStatus = status === 'Approved' ? LeaveRequestStatus.Approved : LeaveRequestStatus.Rejected;
        const { error } = await Offline.update('leave_requests', { status: mappedStatus, approved_by: userProfile.id }, { id: requestId });
        if (error) {
            addToast(error.message, 'error');
            return false;
        }
        setLeaveRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: mappedStatus } : r));
        addToast(`Leave request ${status.toLowerCase()}.`, 'success');
        return true;
    }, [userProfile, addToast]);

    const handleCreateLeaveRequest = useCallback(async (request: Partial<LeaveRequest>): Promise<boolean> => {
        return await handleSubmitLeaveRequest(request);
    }, [handleSubmitLeaveRequest]);

    const handleDeleteLeaveRequest = useCallback(async (requestId: number): Promise<boolean> => {
        try {
            const { error } = await Offline.del('leave_requests', { id: requestId });
            if (error) { addToast(error.message, 'error'); return false; }
            setLeaveRequests(prev => prev.filter(r => r.id !== requestId));
            addToast('Leave request deleted.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

    const handleUpdateLeaveRequestStatus = useCallback(async (requestId: number, status: LeaveRequestStatus): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            const { error } = await Offline.update('leave_requests', { status, approved_by: userProfile.id }, { id: requestId });
            if (error) { addToast(error.message, 'error'); return false; }
            setLeaveRequests(prev => prev.map(r => r.id === requestId ? { ...r, status } : r));
            addToast('Leave request status updated.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    // --- Absence Request Handlers ---
    const handleCreateAbsenceRequest = useCallback(async (data: {
        student_id: number;
        request_type: AbsenceRequestType;
        start_date: string;
        end_date: string;
        reason: string;
        supporting_document_url?: string;
    }): Promise<void> => {
        if (!userProfile) throw new Error('User not authenticated');
        
        const requestData = {
            ...data,
            school_id: userProfile.school_id,
            requested_by: userProfile.id,
            status: 'pending'
        };

        const { data: newRequest, error } = await Offline.insert('absence_requests', requestData);
        if (error) throw new Error(error.message);
        
        // Fetch the full request with joined data
        const { data: fullRequest, error: fetchError } = await supabase
            .from('absence_requests')
            .select('*, student:students(*, class:classes(name), arm:arms(name)), requester:user_profiles!requested_by(name), reviewer:user_profiles!reviewed_by(name)')
            .eq('id', (newRequest as any).id)
            .single();
        
        if (fetchError) throw new Error(fetchError.message);
        if (fullRequest) setAbsenceRequests(prev => [fullRequest as any, ...prev]);
        
        addToast('Absence request submitted successfully', 'success');
    }, [userProfile, addToast]);

    const handleApproveAbsenceRequest = useCallback(async (requestId: number, notes: string): Promise<void> => {
        if (!userProfile) throw new Error('User not authenticated');
        
        const { error } = await Offline.update('absence_requests', {
            status: 'approved',
            reviewed_by: userProfile.id,
            reviewed_at: new Date().toISOString(),
            review_notes: notes
        }, { id: requestId });
        
        if (error) throw new Error(error.message);
        
        // Fetch updated request with joined data
        const { data: updatedRequest, error: fetchError } = await supabase
            .from('absence_requests')
            .select('*, student:students(*, class:classes(name), arm:arms(name)), requester:user_profiles!requested_by(name), reviewer:user_profiles!reviewed_by(name)')
            .eq('id', requestId)
            .single();
        
        if (fetchError) throw new Error(fetchError.message);
        
        setAbsenceRequests(prev => prev.map(r => r.id === requestId ? updatedRequest as any : r));
        addToast('Absence request approved', 'success');
    }, [userProfile, addToast]);

    const handleDenyAbsenceRequest = useCallback(async (requestId: number, notes: string): Promise<void> => {
        if (!userProfile) throw new Error('User not authenticated');
        
        const { error } = await Offline.update('absence_requests', {
            status: 'denied',
            reviewed_by: userProfile.id,
            reviewed_at: new Date().toISOString(),
            review_notes: notes
        }, { id: requestId });
        
        if (error) throw new Error(error.message);
        
        // Fetch updated request with joined data
        const { data: updatedRequest, error: fetchError } = await supabase
            .from('absence_requests')
            .select('*, student:students(*, class:classes(name), arm:arms(name)), requester:user_profiles!requested_by(name), reviewer:user_profiles!reviewed_by(name)')
            .eq('id', requestId)
            .single();
        
        if (fetchError) throw new Error(fetchError.message);
        
        setAbsenceRequests(prev => prev.map(r => r.id === requestId ? updatedRequest as any : r));
        addToast('Absence request denied', 'success');
    }, [userProfile, addToast]);

    // --- Subject/Class/Arm Handlers ---
    const handleSaveSubject = useCallback(async (subject: Partial<Subject>): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            const payload: Partial<Subject> = {
                ...subject,
                priority: subject.priority ?? 1,
                is_solo: !!subject.is_solo,
                // Solo subjects cannot co-run; default to false if not provided
                can_co_run: subject.is_solo ? false : !!subject.can_co_run
            };
            if (subject.id) {
                const { error } = await Offline.update('subjects', payload, { id: subject.id });
                if (error) { addToast(error.message, 'error'); return false; }
                setAllSubjects(prev => prev.map(s => s.id === subject.id ? { ...s, ...payload } : s));
            } else {
                const { data, error } = await Offline.insert('subjects', { ...payload, school_id: userProfile.school_id });
                if (error || !data) { addToast(error?.message || 'Failed to create subject', 'error'); return false; }
                setAllSubjects(prev => [...prev, data as Subject]);
            }
            addToast('Subject saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    const handleDeleteSubject = useCallback(async (subjectId: number): Promise<boolean> => {
        try {
            const { error } = await Offline.del('subjects', { id: subjectId });
            if (error) { addToast(error.message, 'error'); return false; }
            setAllSubjects(prev => prev.filter(s => s.id !== subjectId));
            addToast('Subject deleted.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

    const handleSaveClass = useCallback(async (classData: Partial<BaseDataObject>): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            if (classData.id) {
                const { error } = await Offline.update('classes', classData, { id: classData.id });
                if (error) { addToast(error.message, 'error'); return false; }
                setAllClasses(prev => prev.map(c => c.id === classData.id ? { ...c, ...classData } : c));
            } else {
                const { data, error } = await Offline.insert('classes', { ...classData, school_id: userProfile.school_id });
                if (error || !data) { addToast(error?.message || 'Failed to create class', 'error'); return false; }
                setAllClasses(prev => [...prev, data as BaseDataObject]);
            }
            addToast('Class saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    const handleDeleteClass = useCallback(async (classId: number): Promise<boolean> => {
        try {
            const { error } = await Offline.del('classes', { id: classId });
            if (error) { addToast(error.message, 'error'); return false; }
            setAllClasses(prev => prev.filter(c => c.id !== classId));
            addToast('Class deleted.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

    const handleSaveArm = useCallback(async (arm: Partial<BaseDataObject>): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            if (arm.id) {
                const { error } = await Offline.update('arms', arm, { id: arm.id });
                if (error) { addToast(error.message, 'error'); return false; }
                setAllArms(prev => prev.map(a => a.id === arm.id ? { ...a, ...arm } : a));
            } else {
                const { data, error } = await Offline.insert('arms', { ...arm, school_id: userProfile.school_id });
                if (error || !data) { addToast(error?.message || 'Failed to create arm', 'error'); return false; }
                setAllArms(prev => [...prev, data as BaseDataObject]);
            }
            addToast('Arm saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    const handleDeleteArm = useCallback(async (armId: number): Promise<boolean> => {
        try {
            const { error } = await Offline.del('arms', { id: armId });
            if (error) { addToast(error.message, 'error'); return false; }
            setAllArms(prev => prev.filter(a => a.id !== armId));
            addToast('Arm deleted.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

    // --- Class Subject Handlers ---
    const handleSaveClassSubject = useCallback(async (classId: number, subjectId: number, isCompulsory: boolean): Promise<boolean> => {
        try {
            // Check if this class-subject combo already exists
            const existing = classSubjects.find(cs => cs.class_id === classId && cs.subject_id === subjectId);
            
            if (existing) {
                // Update existing record
                const { error } = await Offline.update('class_subjects', { is_compulsory: isCompulsory }, { id: existing.id });
                if (error) { addToast(error.message, 'error'); return false; }
                setClassSubjects(prev => prev.map(cs => 
                    cs.id === existing.id ? { ...cs, is_compulsory: isCompulsory } : cs
                ));
            } else {
                // Insert new record
                const { data, error } = await Offline.insert('class_subjects', { 
                    class_id: classId, 
                    subject_id: subjectId, 
                    is_compulsory: isCompulsory 
                });
                if (error || !data) { addToast(error?.message || 'Failed to save class subject', 'error'); return false; }
                setClassSubjects(prev => [...prev, data as ClassSubject]);
            }
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [classSubjects, addToast]);

    const handleDeleteClassSubject = useCallback(async (classId: number, subjectId: number): Promise<boolean> => {
        try {
            const existing = classSubjects.find(cs => cs.class_id === classId && cs.subject_id === subjectId);
            if (!existing) {
                addToast('Class subject not found', 'error');
                return false;
            }
            
            const { error } = await Offline.del('class_subjects', { id: existing.id });
            if (error) { addToast(error.message, 'error'); return false; }
            setClassSubjects(prev => prev.filter(cs => cs.id !== existing.id));
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [classSubjects, addToast]);

    // --- Reward Handlers ---
    const handleSaveReward = useCallback(async (reward: Partial<RewardStoreItem>): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            if (reward.id) {
                const { error } = await Offline.update('rewards_store_items', reward, { id: reward.id });
                if (error) { addToast(error.message, 'error'); return false; }
                setRewards(prev => prev.map(r => r.id === reward.id ? { ...r, ...reward } as RewardStoreItem : r));
            } else {
                const { data, error } = await Offline.insert('rewards_store_items', { ...reward, school_id: userProfile.school_id });
                if (error || !data) { addToast(error?.message || 'Failed to create reward', 'error'); return false; }
                setRewards(prev => [...prev, data as RewardStoreItem]);
            }
            addToast('Reward saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    const handleDeleteReward = useCallback(async (rewardId: number): Promise<boolean> => {
        try {
            const { error } = await Offline.del('rewards_store_items', { id: rewardId });
            if (error) { addToast(error.message, 'error'); return false; }
            setRewards(prev => prev.filter(r => r.id !== rewardId));
            addToast('Reward deleted.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

    // --- Report Card Announcement Handlers ---
    const handleSaveReportCardAnnouncement = useCallback(async (announcement: Partial<ReportCardAnnouncement>): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            if (announcement.id) {
                const { error } = await Offline.update('report_card_announcements', { ...announcement, updated_at: new Date().toISOString() }, { id: announcement.id });
                if (error) { addToast(error.message, 'error'); return false; }
                setReportCardAnnouncements(prev => prev.map(a => a.id === announcement.id ? { ...a, ...announcement, updated_at: new Date().toISOString() } as ReportCardAnnouncement : a));
            } else {
                const { data, error } = await Offline.insert('report_card_announcements', { ...announcement, school_id: userProfile.school_id });
                if (error || !data) { addToast(error?.message || 'Failed to create announcement', 'error'); return false; }
                setReportCardAnnouncements(prev => [...prev, data as ReportCardAnnouncement]);
            }
            addToast('Announcement saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    const handleDeleteReportCardAnnouncement = useCallback(async (id: number): Promise<boolean> => {
        try {
            const { error } = await Offline.del('report_card_announcements', { id });
            if (error) { addToast(error.message, 'error'); return false; }
            setReportCardAnnouncements(prev => prev.filter(a => a.id !== id));
            addToast('Announcement deleted.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

    const handleRedeemReward = useCallback(async (rewardId: number, studentId: number): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            const reward = rewards.find(r => r.id === rewardId);
            if (!reward) {
                addToast('Reward not found', 'error');
                return false;
            }
            if (reward.stock <= 0) {
                addToast('Reward out of stock', 'error');
                return false;
            }
            
            // Create redemption record
            const { error: redemptionError } = await Offline.insert('reward_redemptions', {
                school_id: userProfile.school_id,
                student_id: studentId,
                reward_id: rewardId,
                cost: reward.cost,
            });
            if (redemptionError) { addToast(redemptionError.message, 'error'); return false; }
            
            // Update stock
            const { error: updateError } = await Offline.update('rewards_store_items', 
                { stock: reward.stock - 1 }, 
                { id: rewardId }
            );
            if (updateError) { addToast(updateError.message, 'error'); return false; }
            
            setRewards(prev => prev.map(r => r.id === rewardId ? { ...r, stock: r.stock - 1 } : r));
            addToast('Reward redeemed successfully.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, rewards, addToast]);

    // --- Payroll Handler ---
    const handleUpdateUserPayroll = useCallback(async (userId: string, payrollData: PayrollUpdateData): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            const { error } = await Offline.update('user_profiles', payrollData, { id: userId });
            if (error) { addToast(error.message, 'error'); return false; }
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...payrollData } : u));
            addToast('User payroll information updated.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    // --- Student Account Handlers ---
    const handleOpenCreateStudentAccountModal = useCallback(() => {
        setIsCreateStudentAccountModalOpen(true);
        return true;
    }, []);

    const handleResetStudentPassword = useCallback(async (userId: string): Promise<string | null> => {
        return await handleStudentPasswordReset(userId);
    }, [handleStudentPasswordReset]);

    const handleResetStudentStrikes = useCallback(async (studentId: number): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            const { error } = await Offline.update('students', { strikes: 0 }, { id: studentId });
            if (error) { addToast(error.message, 'error'); return false; }
            setStudents(prev => prev.map(s => s.id === studentId ? { ...s, strikes: 0 } : s));
            addToast('Student strikes reset.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    const handleBulkResetStrikes = useCallback(async (): Promise<void> => {
        if (!userProfile) return;
        const supabase = requireSupabaseClient();
        try {
            // Archive all active infraction reports
            const { error: archiveError } = await supabase
                .from('reports')
                .update({ archived: true })
                .eq('report_type', 'Infraction')
                .eq('archived', false)
                .eq('school_id', userProfile.school_id);
            
            if (archiveError) throw archiveError;
            
            // Refresh reports to reflect the changes
            if (session?.user) {
                fetchDataRef.current(session.user, true);
            }
            
            addToast('All student strikes have been reset. All active infraction reports have been archived.', 'success');
            
            // Log the action
            await logAuditAction('bulk_reset_strikes', {
                description: 'Reset all student strikes and archived all active infraction reports',
                affected_count: 'all students'
            });
        } catch (e: any) {
            console.error('Error resetting strikes:', e);
            addToast(`Error resetting strikes: ${e.message}`, 'error');
        }
    }, [userProfile, session, addToast, logAuditAction]);

    const handleLogCommunication = useCallback(async (communicationData: CommunicationLogData): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            const { data, error } = await Offline.insert('communications', {
                ...communicationData,
                school_id: userProfile.school_id,
                logged_by: userProfile.id,
            });
            if (error) { addToast(error.message, 'error'); return false; }
            addToast('Communication logged successfully.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    // --- Legacy Import & Enrollment Handlers ---
    const handleImportLegacyAssignments = useCallback(async (assignments: any[]): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            for (const assignment of assignments) {
                // Validate that term_id exists in the assignment data
                if (!assignment.term_id) {
                    addToast('Invalid legacy assignment: missing term_id', 'error');
                    return false;
                }
                const { error } = await Offline.insert('teaching_assignments', {
                    ...assignment,
                    school_id: userProfile.school_id,
                });
                if (error) { addToast(error.message, 'error'); return false; }
            }
            addToast('Legacy assignments imported successfully.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    const handleUpdateClassEnrollment = useCallback(async (classId: number, termId: number, studentIds: number[]): Promise<boolean> => {
        const supabase = requireSupabaseClient();
        if (!userProfile) return false;
        
        try {
            // Step 1: Fetch existing enrollments for this class+term (only student_id needed for delta calculation)
            const { data: existingEnrollments, error: fetchError } = await supabase
                .from('academic_class_students')
                .select('student_id')
                .eq('academic_class_id', classId)
                .eq('enrolled_term_id', termId);
            
            if (fetchError) {
                addToast(`Error fetching enrollments: ${fetchError.message}`, 'error');
                return false;
            }
            
            const existingStudentIds = new Set((existingEnrollments || []).map(e => e.student_id));
            const newStudentIds = new Set(studentIds);
            
            // Step 2: Calculate which students need to be REMOVED
            const studentsToRemove = Array.from(existingStudentIds).filter(id => !newStudentIds.has(id));
            
            // Step 3: Delete only the students being removed
            if (studentsToRemove.length > 0) {
                const { error: deleteError } = await supabase
                    .from('academic_class_students')
                    .delete()
                    .eq('academic_class_id', classId)
                    .eq('enrolled_term_id', termId)
                    .in('student_id', studentsToRemove);
                
                if (deleteError) {
                    addToast(`Error removing students: ${deleteError.message}`, 'error');
                    return false;
                }
            }
            
            // Step 4: Upsert enrollments for all students in the new list
            if (studentIds.length > 0) {
                const enrollmentsToUpsert = studentIds.map(studentId => ({
                    academic_class_id: classId,
                    student_id: studentId,
                    enrolled_term_id: termId,
                    manually_enrolled: true,
                }));
                
                const { error: upsertError } = await supabase
                    .from('academic_class_students')
                    .upsert(enrollmentsToUpsert, {
                        onConflict: 'academic_class_id,student_id,enrolled_term_id'
                    });
                
                if (upsertError) {
                    addToast(`Error saving enrollments: ${upsertError.message}`, 'error');
                    return false;
                }
            }
            
            // Step 5: Re-fetch enrollment data from database to ensure UI sync
            // Note: Fetches all enrollments to maintain consistency with initial data load pattern.
            // For future optimization: consider filtering by school_id via join if dataset grows large.
            const { data: freshEnrollments, error: refreshError } = await supabase
                .from('academic_class_students')
                .select('*');
            
            if (refreshError) {
                addToast('Enrollment saved but failed to refresh. Please reload the page.', 'warning');
                console.error('Failed to refresh enrollment data:', refreshError);
            } else if (freshEnrollments) {
                // Step 6: Update local state with fresh database data
                setAcademicClassStudents(freshEnrollments);
            }
            
            addToast('Class enrollment updated.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    // --- Policy & Analytics Handlers ---
    const handleSavePolicyDocument = useCallback(async (documentData: any): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            if (documentData.id) {
                const { error } = await Offline.update('policy_documents', documentData, { id: documentData.id });
                if (error) { addToast(error.message, 'error'); return false; }
            } else {
                const { error } = await Offline.insert('policy_documents', {
                    ...documentData,
                    school_id: userProfile.school_id,
                });
                if (error) { addToast(error.message, 'error'); return false; }
            }
            addToast('Policy document saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    const handleAnalyzeCheckinAnomalies = useCallback(async (): Promise<any> => {
        if (!userProfile) return null;
        try {
            // AI-powered analysis of teacher check-in anomalies
            if (isAiInCooldown()) {
                addToast('AI service is in cooldown. Please try again in a few minutes.', 'info');
                return null;
            }
            
            const anomalies = teacherCheckins.filter(checkin => {
                // Simple heuristic: flag late check-ins (after 8:30 AM)
                const checkinTime = new Date(checkin.check_in_time);
                const hour = checkinTime.getHours();
                const minutes = checkinTime.getMinutes();
                return hour > 8 || (hour === 8 && minutes > 30);
            });
            
            addToast(`Found ${anomalies.length} potential anomalies.`, 'info');
            return anomalies;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return null;
        }
    }, [userProfile, teacherCheckins, isAiInCooldown, addToast]);

    const handleGenerateImprovementPlan = useCallback(async (): Promise<any> => {
        if (!userProfile) return null;
        const aiClient = getAIClient();
        if (!aiClient || !session) {
            addToast("AI client is not configured.", "error");
            return null;
        }
        
        try {
            if (isAiInCooldown()) {
                addToast('AI service is in cooldown. Please try again in a few minutes.', 'info');
                return null;
            }
            
            addToast('Generating School Improvement Plan...', 'info');
            
            // Collect school data for analysis
            const reportCount = reports.length;
            const taskCompletionRate = tasks.length > 0 
                ? (tasks.filter(t => t.status === TaskStatus.Completed).length / tasks.length) * 100 
                : 100;
            const atRiskCount = atRiskStudents.length;
            const positiveBehaviorCount = positiveRecords.length;
            const totalStudents = students.length;
            const lessonPlanSubmissionRate = lessonPlans.length > 0 
                ? (lessonPlans.filter(lp => lp.status === 'submitted' || lp.status === 'approved').length / lessonPlans.length) * 100
                : 100;
            
            // Build context for AI
            const context = {
                total_reports: reportCount,
                task_completion_rate: taskCompletionRate.toFixed(1),
                at_risk_students: atRiskCount,
                total_students: totalStudents,
                positive_behaviors: positiveBehaviorCount,
                lesson_plan_submission_rate: lessonPlanSubmissionRate.toFixed(1)
            };
            
            const prompt = `You are an AI school administrator analyzing school performance data. Generate a comprehensive School Improvement Plan in JSON format.

Data Summary:
- Total Reports: ${context.total_reports}
- Task Completion Rate: ${context.task_completion_rate}%
- At-Risk Students: ${context.at_risk_students} out of ${context.total_students}
- Positive Behavior Records: ${context.positive_behaviors}
- Lesson Plan Submission Rate: ${context.lesson_plan_submission_rate}%

Generate a JSON object with:
1. "executive_summary": A clear summary of the school's current state and improvement opportunities (2-3 sentences)
2. "strategic_goals": An array of 3-5 goals, each with:
   - "goal": The strategic goal statement
   - "initiatives": Array of 2-4 specific action items
   - "kpi": A measurable key performance indicator
3. "data_summary": An object with:
   - "total_reports": The total number of reports
   - "key_themes": Array of 3-5 key themes or patterns observed in the data`;

            const response = await aiClient.chat.completions.create({
                model: schoolSettings?.ai_settings?.default_model || 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            });

            const planData = extractAndParseJson<Omit<SchoolImprovementPlan, 'generated_at'>>(textFromAI(response));
            if (!planData) throw new Error("Invalid AI response");

            const improvementPlan: SchoolImprovementPlan = {
                ...planData,
                generated_at: new Date().toISOString()
            };

            // Save to school settings
            await handleUpdateSchoolSettings({
                school_documents: {
                    ...schoolSettings?.school_documents,
                    improvement_plan: improvementPlan
                }
            });

            addToast('School Improvement Plan generated successfully.', 'success');
            if (session.user) fetchDataRef.current(session.user, true);
            
            return improvementPlan;
        } catch (e: any) {
            console.error(e);
            if (isRateLimitError(e)) {
                setAiCooldown();
                addToast('AI service is temporarily busy. Please try again in a few minutes.', 'warning');
            } else {
                addToast(`Failed to generate improvement plan: ${e.message}`, 'error');
            }
            return null;
        }
    }, [userProfile, session, isAiInCooldown, addToast, reports, tasks, atRiskStudents, students, positiveRecords, lessonPlans, schoolSettings, handleUpdateSchoolSettings, isRateLimitError, setAiCooldown]);

    const handleGenerateCoverageDeviationReport = useCallback(async (): Promise<any> => {
        if (!userProfile) return null;
        const aiClient = getAIClient();
        if (!aiClient || !session) {
            addToast("AI client is not configured.", "error");
            return null;
        }
        
        try {
            if (isAiInCooldown()) {
                addToast('AI service is in cooldown. Please try again in a few minutes.', 'info');
                return null;
            }
            
            addToast('Generating Coverage Deviation Report...', 'info');
            
            // Analyze lesson plans and curriculum coverage
            const lessonPlansByTeacher = lessonPlans.reduce((acc, lp) => {
                const teacherName = lp.author?.name || 'Unknown';
                const assignment = lp.teaching_entity?.subject_name || 'Unknown Subject';
                const key = `${teacherName}-${assignment}`;
                
                if (!acc[key]) {
                    acc[key] = {
                        teacherName,
                        assignment,
                        plans: []
                    };
                }
                acc[key].plans.push(lp);
                return acc;
            }, {} as Record<string, { teacherName: string, assignment: string, plans: LessonPlan[] }>);

            // Build context for AI analysis
            const analysisData = Object.values(lessonPlansByTeacher).map(group => {
                const totalPlans = group.plans.length;
                const submittedPlans = group.plans.filter(lp => 
                    lp.status === 'submitted' || lp.status === 'approved'
                ).length;
                const fullyCovered = group.plans.filter(lp => 
                    lp.coverage_status === CoverageStatus.FullyCovered
                ).length;
                const partiallyCovered = group.plans.filter(lp => 
                    lp.coverage_status === CoverageStatus.PartiallyCovered
                ).length;
                const notCovered = group.plans.filter(lp => 
                    lp.coverage_status === CoverageStatus.NotCovered
                ).length;
                
                return {
                    teacherName: group.teacherName,
                    assignment: group.assignment,
                    totalPlans,
                    submittedPlans,
                    fullyCovered,
                    partiallyCovered,
                    notCovered
                };
            });

            const prompt = `You are an AI curriculum analyst. Analyze the following lesson plan coverage data and identify deviations from expected curriculum coverage.

Data:
${JSON.stringify(analysisData, null, 2)}

Generate a JSON array of coverage deviation reports. For each teacher-assignment combination with concerning patterns (low submission rate, many partially covered or not covered lessons), create an object with:
- "teacherName": Teacher's name
- "teachingAssignment": Subject/class assignment
- "week": Current week number (use current date to estimate)
- "status": One of "On Track", "Behind Schedule", "At Risk", "Critical"
- "justification": Brief explanation of the deviation (1-2 sentences)

Focus on assignments with low completion rates or coverage issues. Return an empty array if all assignments are on track.`;

            const response = await aiClient.chat.completions.create({
                model: schoolSettings?.ai_settings?.default_model || 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            });

            const deviations = extractAndParseJson<CoverageDeviation[]>(textFromAI(response));
            if (!deviations) throw new Error("Invalid AI response");

            const report = {
                generated_at: new Date().toISOString(),
                report: deviations
            };

            // Save to school settings
            await handleUpdateSchoolSettings({
                school_documents: {
                    ...schoolSettings?.school_documents,
                    coverage_deviation_report: report
                }
            });

            addToast('Coverage Deviation Report generated successfully.', 'success');
            if (session.user) fetchDataRef.current(session.user, true);
            
            return report;
        } catch (e: any) {
            console.error(e);
            if (isRateLimitError(e)) {
                setAiCooldown();
                addToast('AI service is temporarily busy. Please try again in a few minutes.', 'warning');
            } else {
                addToast(`Failed to generate coverage report: ${e.message}`, 'error');
            }
            return null;
        }
    }, [userProfile, session, isAiInCooldown, addToast, lessonPlans, schoolSettings, handleUpdateSchoolSettings, isRateLimitError, setAiCooldown]);

    // --- Alias for existing handler ---
    const handleUpdateReportComments = useCallback(async (reportId: number, teacherComment: string, principalComment: string): Promise<void> => {
        return await handleUpdateResultComments(reportId, teacherComment, principalComment);
    }, [handleUpdateResultComments]);

    // --- Keyboard Shortcuts Setup ---
    const keyboardShortcutsHandlers = useMemo(() => ({
        onSearch: () => {
            // Focus search input if available
            const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"]') as HTMLInputElement;
            if (searchInput) searchInput.focus();
        },
        onCommandPalette: () => {
            // Future: Open command palette
            console.log('Command palette not yet implemented');
        },
        onShowHelp: () => {
            setIsKeyboardShortcutsModalOpen(true);
        },
        onSave: () => {
            // Trigger save on current form if available
            const saveButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
            if (saveButton && !saveButton.disabled) saveButton.click();
        },
        onNew: () => {
            // Context-aware new action
            if (currentView === 'Students') {
                // Navigate to add student if permission exists
                setCurrentView('upload-data');
            } else if (currentView === 'Reports') {
                setCurrentView('reports');
            } else if (currentView === 'Tasks') {
                setIsTaskModalOpen(true);
            }
        },
        onGoToDashboard: () => setCurrentView('Dashboard'),
        onGoToStudents: () => setCurrentView('Students'),
        onGoToReports: () => setCurrentView('feed'),
        onGoToTasks: () => setCurrentView('tasks'),
        onGoToAnalytics: () => setCurrentView('analytics'),
        onEscape: () => {
            // Close any open modals
            setIsKeyboardShortcutsModalOpen(false);
            setIsTaskModalOpen(false);
            setIsCreateStudentAccountModalOpen(false);
        },
    }), [currentView]);

    const shortcuts = useMemo(() => defaultShortcuts(keyboardShortcutsHandlers), [keyboardShortcutsHandlers]);
    
    // Enable keyboard shortcuts only when logged in and not on auth pages
    const keyboardShortcutsEnabled = !!session && !AUTH_ONLY_VIEWS.includes(currentView);
    useKeyboardShortcuts(shortcuts, { enabled: keyboardShortcutsEnabled });


    // ... (Rendering Logic) ...

    // CRITICAL: Check for public routes FIRST, before any auth/booting logic
    // This prevents authenticated app routing from hijacking public report URLs
    const pathname = window.location.pathname;
    if (pathname.startsWith('/report/')) {
        // Check if this is a print route (/report/:token/:slug?/print)
        const isPrintRoute = pathname.includes('/print');
        
        if (isPrintRoute) {
            const PublicReportPrintView = React.lazy(() => import('./components/PublicReportPrintView'));
            return (
                <React.Suspense fallback={<div className="flex items-center justify-center h-screen bg-white dark:bg-slate-950"><Spinner size="lg" /></div>}>
                    <PublicReportPrintView />
                </React.Suspense>
            );
        } else {
            const PublicReportView = React.lazy(() => import('./components/PublicReportView'));
            return (
                <React.Suspense fallback={<div className="flex items-center justify-center h-screen bg-white dark:bg-slate-950"><Spinner size="lg" /></div>}>
                    <PublicReportView />
                </React.Suspense>
            );
        }
    }

    if (pathname.startsWith('/activate')) {
        return <ActivationPage />;
    }

    if (booting) {
        return <div className="flex items-center justify-center h-screen bg-white dark:bg-slate-950"><Spinner size="lg" /></div>;
    }

    if (!session) {
        if (currentView === 'student-login') return <StudentLoginPage onNavigate={(view) => { if(view === 'landing') setCurrentView('landing'); else if (view === 'teacher-login') setCurrentView('teacher-login'); else if (view === 'parent-login') setCurrentView('parent-login'); else if (view === 'public-ratings') setCurrentView('public-ratings'); }} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
        if (currentView === 'parent-login') return <ParentLoginPage onNavigate={(view) => { if(view === 'landing') setCurrentView('landing'); else if (view === 'teacher-login') setCurrentView('teacher-login'); else if (view === 'student-login') setCurrentView('student-login'); }} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
        if (currentView === 'public-ratings') return <PublicTeacherRatingsView onShowLogin={() => setCurrentView('teacher-login')} />;
        if (currentView === 'teacher-login') return <LoginPage onNavigate={(view) => { if(view === 'landing') setCurrentView('landing'); else if (view === 'student-login') setCurrentView('student-login'); else if (view === 'parent-login') setCurrentView('parent-login'); }} />;
        // Landing page default
        return <LandingPage onNavigate={(view) => setCurrentView(view)} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
    }

    if (dbError) {
         if (dbError.includes('relation') || dbError.includes('does not exist')) {
             return <DatabaseSetupError error={dbError} onLogout={handleLogout} />;
         }
         return <EnvironmentSetupError error={dbError} />;
    }
    
    // Show profile loading error with retry/logout options
    if (profileLoadError) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
                <div className="max-w-md w-full mx-4 bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-red-100 dark:border-red-900/30">
                    <div className="mb-4 text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-full inline-block">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Profile Loading Error</h2>
                    <p className="text-slate-600 dark:text-slate-300 mb-6">
                        {profileLoadError}
                    </p>
                    
                    <div className="space-y-3">
                        <button 
                            onClick={() => {
                                setProfileLoadError(null);
                                if (session?.user) {
                                    console.log('[Auth] Retrying profile load...');
                                    fetchDataRef.current(session.user, true);
                                }
                            }}
                            className="w-full px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                        >
                            Retry Loading
                        </button>
                        
                        <button 
                            onClick={handleLogout}
                            className="w-full px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                        >
                            Logout and Try Again
                        </button>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                            If this problem persists, please contact support with the error details shown above.
                        </p>
                    </div>
                </div>
            </div>
        );
    }
    
    if (!userProfile) {
        return <div className="flex items-center justify-center h-screen bg-white dark:bg-slate-950"><Spinner size="lg" text="Loading profile..." /></div>;
    }
    
    if (userType === 'parent') {
        // Parent specific layout
        return (
            <ParentDashboard
                parentProfile={parentProfile!}
                linkedChildren={linkedChildren}
                selectedChild={selectedChild}
                onSelectChild={setSelectedChild}
                onLogout={handleLogout}
            />
        );
    }
    
    if (userType === 'student') {
        // Student specific layout
        return (
            <CampusScopeProvider canViewSitewide={userCanViewSitewide}>
            <RouterWrapper currentView={currentView} setCurrentView={setCurrentView}>
              <div className={`flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 overflow-hidden`}>
                <Sidebar
                    currentView={currentView}
                    onNavigate={setCurrentView}
                    userProfile={userProfile as StudentProfile}
                    userPermissions={[]} // Students have no permissions array
                    onLogout={handleLogout}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    canAccess={canAccess}
                />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <Header
                        userProfile={userProfile as StudentProfile}
                        onLogout={handleLogout}
                        notifications={notifications}
                        onMarkNotificationsAsRead={() => { /* impl */ }}
                        onNavigate={setCurrentView}
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                        isDarkMode={isDarkMode}
                        toggleTheme={toggleTheme}
                        userPermissions={[]}
                    />
                    <main className="app-surface">
                         <ErrorBoundary>
                             <Suspense fallback={<div className="flex justify-center pt-10"><Spinner size="lg" /></div>}>
                                <AppRouter
                                    currentView={currentView}
                                    data={{
                                        userProfile,
                                        userType,
                                        users,
                                        reports,
                                        students,
                                        tasks,
                                        announcements,
                                        notifications,
                                        positiveRecords,
                                        studentAwards,
                                        staffAwards,
                                        interventionPlans,
                                        sipLogs,
                                        lessonPlans,
                                        schoolSettings,
                                        livingPolicy,
                                        calendarEvents,
                                        inventory,
                                        allSubjects,
                                        allClasses,
                                        allArms,
                                        classSubjects,
                                        surveys,
                                        classGroups,
                                        roles,
                                        userRoleAssignments,
                                        teams,
                                        teamPulse,
                                        teamFeedback,
                                        curricula,
                                        curriculumWeeks,
                                        academicClasses,
                                        academicAssignments,
                                        academicClassStudents,
                                        scoreEntries,
                                        gradingSchemes,
                                        schoolConfig,
                                        terms,
                                        assessments,
                                        assessmentScores,
                                        assessmentStructures,
                                        atRiskStudents,
                                        atRiskTeachers,
                                        socialMediaAnalytics,
                                        policyInquiries,
                                        curriculumReport,
                                        taskSuggestions,
                                        areFallbackSuggestions,
                                        alerts,
                                        coverageVotes,
                                        rewards,
                                        payrollRuns,
                                        payrollItems,
                                        payrollAdjustments,
                                        campuses,
                                        teacherCheckins,
                                        leaveTypes,
                                        leaveRequests,
                                        absenceRequests,
                                        teacherShifts,
                                        teachingEntities,
                                        orders,
                                        socialAccounts,
                                        checkinAnomalies,
                                        weeklyRatings,
                                        staffCertifications,
                                        studentTermReports,
                                        studentTermReportSubjects,
                                        auditLogs,
                                        reportCardAnnouncements,
                                        todaysCheckinForDashboard,
                                        navContext,
                                        userPermissions,
                                        isDarkMode,
                                        schoolHealthReport,
                                        improvementPlan,
                                    }}
                                    actions={{
                                        setCurrentView,
                                        setSelectedStudent: (s) => { setSelectedStudent(s); setCurrentView(`${VIEWS.STUDENT_PROFILE}/${s.id}`); },
                                        setIsPositiveModalOpen,
                                        handleLogout,
                                        toggleTheme,
                                        addToast,
                                        handleAddReport,
                                        handleAssignReport,
                                        handleAddReportComment,
                                        handleDeleteReport,
                                        handleUpdateReportStatusAndResponse,
                                        handleBulkDeleteReports,
                                        handleBulkAssignReports,
                                        handleBulkUpdateReportStatus,
                                        handleOpenAIBulkResponseModal,
                                        handleUpdateTaskStatus,
                                        handleAddTask,
                                        handleAddAnnouncement,
                                        handleUpdateAnnouncement,
                                        handleDeleteAnnouncement,
                                        handleAddStudent,
                                        handleUpdateStudent,
                                        handleGenerateStudentAwards,
                                        handleGenerateStudentInsight,
                                        handleCreateSIP,
                                        handleAddSIPLog,
                                        handleUpdateSIP,
                                        handleRunWeeklyComplianceCheck,
                                        handleUpdateClassGroupMembers,
                                        handleSaveAttendanceSchedule,
                                        handleDeleteAttendanceSchedule,
                                        handleSaveAttendanceRecord,
                                        handleCreateClassAssignment,
                                        handleDeleteClassAssignment,
                                        handleSaveSurvey,
                                        handleDeleteSurvey,
                                        handleSaveCalendarEvent,
                                        handleUpdateCalendarEvent,
                                        handleDeleteCalendarEvent,
                                        handleNavigation: handleAINavigation,
                                        handleInviteUser,
                                        handleUpdateUser,
                                        handleDeleteUser,
                                        handleDeactivateUser,
                                        handleUpdateEmploymentStatus,
                                        handleUpdateUserCampus,
                                        handleSaveRole,
                                        handleUpdateRoleAssignments,
                                        handleCreateTeam,
                                        handleUpdateTeam,
                                        handleDeleteTeam,
                                        handleUpdateTeamMembers,
                                        handleSaveTeamFeedback,
                                        handleSaveCurriculum,
                                        handleSaveLessonPlan,
                                        handleAnalyzeLessonPlan,
                                        handleCopyLessonPlan,
                                        handleApproveLessonPlan,
                                        handleSubmitLessonPlanForReview,
                                        handleSaveScores,
                                        handleUpdateScore,
                                        handleSubmitScoresForReview,
                                        handleSaveAssessment,
                                        handleDeleteAssessment,
                                        handleSaveAssessmentScores,
                                        handleCopyAssessment,
                                        handleLockScores,
                                        handleResetSubmission,
                                        handleUpdateReportComments,
                                        handleBulkAddStudents,
                                        handleAddPolicySnippet,
                                        handleSavePolicyDocument,
                                        handleSendEmergencyBroadcast,
                                        handleUpdateProfile,
                                        handleUpdateAvatar,
                                        handleResetPassword,
                                        handleUpdateEmail,
                                        handleUpdatePassword,
                                        handleUploadCertification,
                                        handleDeleteCertification,
                                        handleGetCertificationUrl,
                                        handleUpdateSchoolSettings,
                                        handleUpdateSchoolConfig,
                                        handleGenerateStaffAwards,
                                        handleAnalyzeTeacherRisk,
                                        handleGeneratePolicyInquiries,
                                        handleGenerateCurriculumReport,
                                        handleProcessDailyDigest,
                                        handleAcceptTaskSuggestion,
                                        handleDismissTaskSuggestion,
                                        handleCheckinOut,
                                        handleAnalyzeCheckinAnomalies,
                                        handleGenerateHealthReport,
                                        handleGenerateForesight,
                                        handleGenerateImprovementPlan,
                                        handleGenerateCoverageDeviationReport,
                                        handleSaveTerm,
                                        handleDeleteTerm,
                                        handleSaveAcademicClass,
                                        handleDeleteAcademicClass,
                                        handleSaveAcademicAssignment,
                                        handleDeleteAcademicAssignment,
                                        handleSaveGradingScheme,
                                        handleDeleteGradingScheme,
                                        handleSetActiveGradingScheme,
                                        handleSaveSubject,
                                        handleDeleteSubject,
                                        handleSaveClass,
                                        handleDeleteClass,
                                        handleSaveArm,
                                        handleDeleteArm,
                                        handleSaveClassSubject,
                                        handleDeleteClassSubject,
                                        handleSaveInventoryItem,
                                        handleDeleteInventoryItem,
                                        handleSaveReward,
                                        handleDeleteReward,
                                        handleSaveReportCardAnnouncement,
                                        handleDeleteReportCardAnnouncement,
                                        handleRedeemReward,
                                        handleRunPayroll,
                                        handleUpdateUserPayroll,
                                        handleCreateLeaveRequest,
                                        handleDeleteLeaveRequest,
                                        handleUpdateLeaveRequestStatus,
                                        handleApproveLeaveRequest,
                                        handleCreateAbsenceRequest,
                                        handleApproveAbsenceRequest,
                                        handleDenyAbsenceRequest,
                                        handleSaveCampus,
                                        handleDeleteCampus,
                                        handleSaveShift,
                                        handleDeleteShift,
                                        handleSaveLeaveType,
                                        handleDeleteLeaveType,
                                        handleSaveAssessmentStructure,
                                        handleDeleteAssessmentStructure,
                                        handleImportLegacyAssignments,
                                        handleUpdateClassEnrollment,
                                        handleCreateOrder,
                                        handleUpdateOrderStatus,
                                        handleAddOrderNote,
                                        handleDeleteOrderNote,
                                        handleSaveSocialLinks,
                                        handleOpenCreateStudentAccountModal,
                                        handleBulkCreateStudentAccounts,
                                        handleBulkRetrievePasswords,
                                        handleGenerateActivationLinks,
                                        handleCreateStudentAccount,
                                        handleResetStudentPassword,
                                        handleResetStudentStrikes,
                                        handleLogCommunication,
                                    }}
                                />
                             </Suspense>
                         </ErrorBoundary>
                    </main>
                </div>
                 <Toast toasts={toasts} removeToast={removeToast} />
             </div>
            </RouterWrapper>
            </CampusScopeProvider>
        )
    }

    // Staff Layout
    return (
        <CampusScopeProvider canViewSitewide={userCanViewSitewide}>
        <RouterWrapper currentView={currentView} setCurrentView={setCurrentView}>
          <div className={`flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 overflow-hidden`}>
            <Sidebar
                currentView={currentView}
                onNavigate={setCurrentView}
                userProfile={userProfile as UserProfile}
                userPermissions={userPermissions}
                onLogout={handleLogout}
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                canAccess={canAccess}
            />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <Header
                    userProfile={userProfile as UserProfile}
                    onLogout={handleLogout}
                    notifications={notifications}
                    onMarkNotificationsAsRead={() => { /* impl */ }}
                    onNavigate={setCurrentView}
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    isDarkMode={isDarkMode}
                    toggleTheme={toggleTheme}
                    userPermissions={userPermissions}
                />
                <main className="app-surface">
                    <div className="page-wrapper">
                        <ErrorBoundary>
                            <Suspense fallback={<div className="flex justify-center pt-10"><Spinner size="lg" /></div>}>
                                <AppRouter
                                    currentView={currentView}
                                    data={{
                                    userProfile,
                                    userType,
                                    users,
                                    reports,
                                    students,
                                    tasks,
                                    announcements,
                                    notifications,
                                    positiveRecords,
                                    studentAwards,
                                    staffAwards,
                                    interventionPlans,
                                    sipLogs,
                                    lessonPlans,
                                    schoolSettings,
                                    livingPolicy,
                                    calendarEvents,
                                    inventory,
                                    allSubjects,
                                    allClasses,
                                    allArms,
                                    classSubjects,
                                    surveys,
                                    classGroups,
                                    roles,
                                    userRoleAssignments,
                                    teams,
                                    teamPulse,
                                    teamFeedback,
                                    curricula,
                                    curriculumWeeks,
                                    academicClasses,
                                    academicAssignments,
                                    academicClassStudents,
                                    studentSubjectEnrollments,
                                    scoreEntries,
                                    gradingSchemes,
                                    schoolConfig,
                                    terms,
                                    assessments,
                                    assessmentScores,
                                    assessmentStructures,
                                    atRiskStudents,
                                    atRiskTeachers,
                                    socialMediaAnalytics,
                                    policyInquiries,
                                    curriculumReport,
                                    taskSuggestions,
                                    alerts,
                                    coverageVotes,
                                    rewards,
                                    payrollRuns,
                                    payrollItems,
                                    payrollAdjustments,
                                    campuses,
                                    teacherCheckins,
                                    leaveTypes,
                                    leaveRequests,
                                    teacherShifts,
                                    teachingEntities,
                                    orders,
                                    socialAccounts,
                                    checkinAnomalies,
                                    weeklyRatings,
                                    staffCertifications,
                                    studentTermReports,
                                    studentTermReportSubjects,
                                    auditLogs,
                                    reportCardAnnouncements,
                                    todaysCheckinForDashboard,
                                    navContext,
                                    userPermissions,
                                    isDarkMode,
                                    schoolHealthReport,
                                    improvementPlan,
                                }}
                                actions={{
                                    setCurrentView,
                                    setSelectedStudent: (s) => { setSelectedStudent(s); setCurrentView(`${VIEWS.STUDENT_PROFILE}/${s.id}`); },
                                    setIsPositiveModalOpen,
                                    handleLogout,
                                    toggleTheme,
                                    addToast,
                                    handleAddReport,
                                    handleAssignReport,
                                    handleAddReportComment,
                                    handleDeleteReport,
                                    handleUpdateReportStatusAndResponse,
                                    handleBulkDeleteReports,
                                    handleBulkAssignReports,
                                    handleBulkUpdateReportStatus,
                                    handleOpenAIBulkResponseModal,
                                    handleUpdateTaskStatus,
                                    handleAddTask,
                                    handleAddAnnouncement,
                                    handleUpdateAnnouncement,
                                    handleDeleteAnnouncement,
                                    handleAddStudent,
                                    handleUpdateStudent,
                                    handleGenerateStudentAwards,
                                    handleGenerateStudentInsight,
                                    handleCreateSIP,
                                    handleAddSIPLog,
                                    handleUpdateSIP,
                                    handleRunWeeklyComplianceCheck,
                                    handleUpdateClassGroupMembers,
                                    handleSaveAttendanceSchedule,
                                    handleDeleteAttendanceSchedule,
                                    handleSaveAttendanceRecord,
                                    handleCreateClassAssignment,
                                    handleDeleteClassAssignment,
                                    handleSaveSurvey,
                                    handleDeleteSurvey,
                                    handleSaveCalendarEvent,
                                    handleUpdateCalendarEvent,
                                    handleDeleteCalendarEvent,
                                    handleNavigation: handleAINavigation,
                                    handleInviteUser,
                                    handleUpdateUser,
                                    handleDeleteUser,
                                    handleDeactivateUser,
                                    handleUpdateEmploymentStatus,
                                    handleUpdateUserCampus,
                                    handleCreateStaffAccount,
                                    handleResetStaffPassword,
                                    handleSaveRole,
                                    handleUpdateRoleAssignments,
                                    handleCreateTeam,
                                    handleUpdateTeam,
                                    handleDeleteTeam,
                                    handleUpdateTeamMembers,
                                    handleSaveTeamFeedback,
                                    handleSaveCurriculum,
                                    handleSaveLessonPlan,
                                    handleAnalyzeLessonPlan,
                                    handleCopyLessonPlan,
                                    handleApproveLessonPlan,
                                    handleSubmitLessonPlanForReview,
                                    handleSaveScores,
                                    handleUpdateScore,
                                    handleSubmitScoresForReview,
                                    handleSaveAssessment,
                                    handleDeleteAssessment,
                                    handleSaveAssessmentScores,
                                    handleCopyAssessment,
                                    handleLockScores,
                                    handleResetSubmission,
                                    handleUpdateReportComments,
                                    handleGenerateReportComment,
                                    handleBulkAddStudents,
                                    handleAddPolicySnippet,
                                    handleSavePolicyDocument,
                                    handleSendEmergencyBroadcast,
                                    handleUpdateProfile,
                                    handleUpdateAvatar,
                                    handleResetPassword,
                                    handleUpdateEmail,
                                    handleUpdatePassword,
                                    handleUploadCertification,
                                    handleDeleteCertification,
                                    handleGetCertificationUrl,
                                    handleUpdateSchoolSettings,
                                    handleUpdateSchoolConfig,
                                    handleGenerateStaffAwards,
                                    handleAnalyzeTeacherRisk,
                                    handleGeneratePolicyInquiries,
                                    handleGenerateCurriculumReport,
                                    handleProcessDailyDigest,
                                    handleAcceptTaskSuggestion,
                                    handleDismissTaskSuggestion,
                                    handleCheckinOut,
                                    handleAnalyzeCheckinAnomalies,
                                    handleGenerateHealthReport,
                                    handleGenerateForesight,
                                    handleGenerateImprovementPlan,
                                    handleGenerateCoverageDeviationReport,
                                    handleSaveTerm,
                                    handleDeleteTerm,
                                    handleSaveAcademicClass,
                                    handleDeleteAcademicClass,
                                    handleSaveAcademicAssignment,
                                    handleDeleteAcademicAssignment,
                                    handleSaveGradingScheme,
                                    handleDeleteGradingScheme,
                                    handleSetActiveGradingScheme,
                                    handleSaveSubject,
                                    handleDeleteSubject,
                                    handleSaveClass,
                                    handleDeleteClass,
                                    handleSaveArm,
                                    handleDeleteArm,
                                    handleSaveClassSubject,
                                    handleDeleteClassSubject,
                                    handleSaveInventoryItem,
                                    handleDeleteInventoryItem,
                                    handleSaveReward,
                                    handleDeleteReward,
                                    handleRedeemReward,
                                    handleRunPayroll,
                                    handleUpdateUserPayroll,
                                    handleCreateLeaveRequest,
                                    handleDeleteLeaveRequest,
                                    handleUpdateLeaveRequestStatus,
                                    handleApproveLeaveRequest,
                                    handleSaveCampus,
                                    handleDeleteCampus,
                                    handleSaveShift,
                                    handleDeleteShift,
                                    handleSaveLeaveType,
                                    handleDeleteLeaveType,
                                    handleSaveAssessmentStructure,
                                    handleDeleteAssessmentStructure,
                                    handleImportLegacyAssignments,
                                    handleUpdateClassEnrollment,
                                    handleCreateOrder,
                                    handleUpdateOrderStatus,
                                    handleAddOrderNote,
                                    handleDeleteOrderNote,
                                    handleSaveSocialLinks,
                                    handleOpenCreateStudentAccountModal,
                                    handleBulkCreateStudentAccounts,
                                    handleBulkRetrievePasswords,
                                    handleGenerateActivationLinks,
                                    handleCreateStudentAccount,
                                    handleResetStudentPassword,
                                    handleResetStudentStrikes,
                                    handleLogCommunication,
                                    handleBulkDeleteStudentAccounts,
                                    handleDeleteStudent,
                                    handleBulkDeleteStudents,
                                    reloadData: async () => {
                                        if (session?.user) {
                                            await fetchDataRef.current(session.user, true);
                                        }
                                    },
                                }}
                            />
                        </Suspense>
                     </ErrorBoundary>
                     
                     {/* AI Copilot */}
                     <AICopilot
                        userProfile={userProfile as UserProfile}
                        users={users}
                        students={students}
                        reports={reports}
                        tasks={tasks}
                        roles={roles}
                        announcements={announcements}
                        classes={allClasses}
                        livingPolicy={livingPolicy}
                        scoreEntries={scoreEntries}
                        attendanceRecords={allAttendanceRecords}
                        inventory={inventory}
                        leaveRequests={leaveRequests}
                        teacherCheckins={teacherCheckins}
                        lessonPlans={lessonPlans}
                        onAddTask={handleAddTask}
                        onAddAnnouncement={handleAddAnnouncement}
                        addToast={addToast}
                        onNavigate={handleAINavigation}
                     />
                    </div>
                </main>
            </div>
            <Toast toasts={toasts} removeToast={removeToast} />
            
            {/* Policy Acknowledgment Gate */}
            {showPolicyGate && pendingPolicies.length > 0 && userProfile && (
                <PolicyAcknowledgmentGate
                    policies={pendingPolicies}
                    onAcknowledge={handlePolicyAcknowledgment}
                    userFullName={userType === 'staff' ? (userProfile as UserProfile).name : (userProfile as StudentProfile).full_name}
                />
            )}
            
            {/* Global Modals */}
            {isPositiveModalOpen && <PositiveBehaviorModal isOpen={isPositiveModalOpen} onClose={() => setIsPositiveModalOpen(false)} onSubmit={async (id, desc) => {
                 // Mock insert
                 const newRec = { id: Date.now(), student_id: id, description: desc, author_id: userProfile.id, created_at: new Date().toISOString() };
                 addItem(setPositiveRecords, newRec);
                 addToast("Positive behavior logged.", "success");
            }} students={students} defaultStudent={positiveModalDefaultStudent} />}
            
            {isCreateStudentAccountModalOpen && <CreateStudentAccountModal 
                isOpen={isCreateStudentAccountModalOpen} 
                onClose={() => setIsCreateStudentAccountModalOpen(false)} 
                onCreateAccount={handleCreateStudentAccount}
                students={students} 
            />}
            
            {isTourOpen && <TourModal isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} tourContent={MOCK_TOUR_CONTENT} />}
            
            {isAIBulkResponseModalOpen && <AIBulkResponseModal isOpen={isAIBulkResponseModalOpen} onClose={() => setIsAIBulkResponseModalOpen(false)} reports={reportsForAIBulkResponse} onSave={async (resps) => {
                 for (const [id, txt] of Object.entries(resps)) {
                     await handleUpdateReportStatusAndResponse(Number(id), 'treated', txt);
                 }
                 addToast("Bulk responses sent.", "success");
            }} />}

            <TaskFormModal
                isOpen={isTaskModalOpen}
                onClose={() => setIsTaskModalOpen(false)}
                onSubmit={handleAddTask}
                users={users}
                currentUser={userProfile as UserProfile}
                initialData={navContext?.data}
            />

            <KeyboardShortcutsModal
                isOpen={isKeyboardShortcutsModalOpen}
                onClose={() => setIsKeyboardShortcutsModalOpen(false)}
                shortcuts={shortcuts}
            />

            <FeedbackWidget
                userProfile={userProfile as { id: string; school_id: number } | null}
            />
        </div>
        </RouterWrapper>
        </CampusScopeProvider>
    );
};

export default App;
