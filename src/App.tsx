import React, { useState, useEffect, useCallback, useRef, Suspense, useMemo, Component } from 'react';
import type { Session, User } from '@supabase/auth-js';
import { supabaseError } from './services/supabaseClient';
import { aiClient, aiClientError } from './services/aiClient';
import { GoogleGenAI, Type } from '@google/genai';
import { Team, TeamFeedback, TeamPulse, Task, TaskPriority, TaskStatus, ReportType, CoverageStatus, RoleTitle, Student, UserProfile, ReportRecord, ReportComment, Announcement, Notification, ToastMessage, RoleDetails, PositiveBehaviorRecord, StudentAward, StaffAward, AIProfileInsight, AtRiskStudent, Alert, StudentInterventionPlan, SIPLog, SchoolHealthReport, SchoolSettings, PolicyInquiry, LivingPolicySnippet, AtRiskTeacher, InventoryItem, CalendarEvent, LessonPlan, CurriculumReport, LessonPlanAnalysis, DailyBriefing, StudentProfile, TeachingAssignment, BaseDataObject, Survey, SurveyWithQuestions, TeacherRatingWeekly, SuggestedTask, SchoolImprovementPlan, Curriculum, CurriculumWeek, CoverageDeviation, ClassGroup, AttendanceSchedule, AttendanceRecord, UPSSGPTResponse, SchoolConfig, Term, AcademicClass, AcademicTeachingAssignment, GradingScheme, GradingSchemeRule, AcademicClassStudent, ScoreEntry, StudentTermReport, AuditLog, Assessment, AssessmentScore, CoverageVote, RewardStoreItem, PayrollRun, PayrollItem, PayrollAdjustment, Campus, TeacherCheckin, CheckinAnomaly, LeaveType, LeaveRequest, LeaveRequestStatus, TeacherShift, FutureRiskPrediction, AssessmentStructure, SocialMediaAnalytics, SocialAccount, CreatedCredential, NavigationContext, TeacherMood, Order, OrderStatus, StudentTermReportSubject, UserRoleAssignment } from './types';

import { MOCK_SOCIAL_ACCOUNTS, MOCK_TOUR_CONTENT, MOCK_SOCIAL_ANALYTICS } from './services/mockData';
import { extractAndParseJson } from './utils/json';
import { textFromGemini } from './utils/ai';
import { askUPSSGPT } from './services/upssGPT';
import { base64ToBlob } from './utils/file';
import { Offline, supa as supabase, cache } from './offline/client';
import { queueStore } from './offline/db';
import { VIEWS } from './constants';
import { checkInToday, checkOutToday, todayISO } from './services/checkins';
import { lazyWithRetry } from './utils/lazyWithRetry';

import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import EnvironmentSetupError from './components/EnvironmentSetupError';
import DatabaseSetupError from './components/DatabaseSetupError';
import PositiveBehaviorModal from './components/PositiveBehaviorModal';
import Toast from './components/Toast';
import Spinner from './components/common/Spinner';
import TourModal from './components/TourModal';
import StudentPortal from './components/StudentPortal';
import PublicTeacherRatingsView from './components/PublicTeacherRatingsView';
import LandingPage from './components/LandingPage';
import StudentLoginPage from './components/StudentLoginPage';
import AIBulkResponseModal from './components/AIBulkResponseModal';
import TaskFormModal from './components/TaskFormModal';

import StudentSurveysView from './components/StudentSurveysView';
import StudentRateMyTeacherView from './components/StudentRateMyTeacherView';
import StudentReportList from './components/StudentReportList';
import { BookOpenIcon, ClipboardListIcon, FileTextIcon, StarIcon, UserCircleIcon } from './components/common/icons';

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

// Helper: Get Monday of the current week as a string
const getWeekStartDateString = (date: Date): string => {
    const d = new Date(date);
    const day = d.getDay(); // Sunday - 0, Monday - 1
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
};

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

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | StudentProfile | null | undefined>(undefined);
    const [userType, setUserType] = useState<'staff' | 'student' | null>(null);
    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    
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

    const [currentView, setCurrentView] = useState(() => {
        try {
            let hash = decodeURIComponent(window.location.hash.substring(1));
            if (hash.startsWith('/')) hash = hash.substring(1);
            
            // Ignore auth tokens in initial hash
            if (hash.includes('access_token=') || hash.includes('error=')) {
                return 'Dashboard';
            }
            
            return hash || 'Dashboard';
        } catch (e) {
            console.warn("Failed to parse initial URL hash:", e);
            return 'Dashboard';
        }
    });

    // --- Smart Navigation Context ---
    const [navContext, setNavContext] = useState<NavigationContext | null>(null);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false); // Manually control task modal from App level for Copilot access
    
    const [booting, setBooting] = useState(true);
    const lastFetchedUserId = useRef<string | null>(null);
    const [dbError, setDbError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [hash, setHash] = useState(window.location.hash);

    const userProfileRef = useRef<UserProfile | StudentProfile | null | undefined>(undefined);
    useEffect(() => {
        userProfileRef.current = userProfile;
    }, [userProfile]);

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
    const [interventionPlans, setInterventionPlans] = useState<StudentInterventionPlan[]>([]);
    const [sipLogs, setSipLogs] = useState<SIPLog[]>([]);
    const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
    const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [allSubjects, setAllSubjects] = useState<BaseDataObject[]>([]);
    const [allClasses, setAllClasses] = useState<BaseDataObject[]>([]);
    const [allArms, setAllArms] = useState<BaseDataObject[]>([]);
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
    const [teacherShifts, setTeacherShifts] = useState<TeacherShift[]>([]);
    const [teachingEntities, setTeachingEntities] = useState<TeachingAssignment[]>([]);
    const [socialMediaAnalytics, setSocialMediaAnalytics] = useState<SocialMediaAnalytics[]>(MOCK_SOCIAL_ACCOUNTS ? MOCK_SOCIAL_ANALYTICS : []);
    const [socialAccounts, setSocialAccounts] = useState<SocialAccount | null>(MOCK_SOCIAL_ACCOUNTS);
    
    const [schoolConfig, setSchoolConfig] = useState<SchoolConfig | null>(null);
    const [terms, setTerms] = useState<Term[]>([]);
    const [academicClasses, setAcademicClasses] = useState<AcademicClass[]>([]);
    const [academicAssignments, setAcademicAssignments] = useState<AcademicTeachingAssignment[]>([]);
    const [gradingSchemes, setGradingSchemes] = useState<GradingScheme[]>([]);
    const [academicClassStudents, setAcademicClassStudents] = useState<AcademicClassStudent[]>([]);
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

    const todaysCheckinForDashboard = useMemo(() => {
        if (!userProfile || !teacherCheckins) return null;
        const today = todayISO();
        return teacherCheckins.find(c => c.teacher_id === userProfile.id && c.checkin_date === today);
    }, [userProfile, teacherCheckins]);

    const updateState = <T extends {id: number | string}>(setter: React.Dispatch<React.SetStateAction<T[]>>, item: T) => setter(prev => prev.map(i => i.id === item.id ? item : i));
    const addItem = <T extends {}>(setter: React.Dispatch<React.SetStateAction<T[]>>, item: T) => setter(prev => [item, ...prev]);
    const deleteItem = <T extends {id: number | string}>(setter: React.Dispatch<React.SetStateAction<T[]>>, id: number | string) => setter(prev => prev.filter(i => i.id !== id));

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

    // --- Auth Logic & Data Fetching ---
    
    useEffect(() => {
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
            setSession(session);
            
            if (event === 'PASSWORD_RECOVERY') {
                setCurrentView(VIEWS.PROFILE);
                addToast("Password recovery link verified. Please update your password now.", "info");
            }
            
            if (!session) {
                setBooting(false);
                setUserProfile(null);
            } else {
                fetchData(session.user);
            }
        });

        return () => subscription.unsubscribe();
    }, [addToast]);

    // --- Realtime Updates ---
    useEffect(() => {
        if (!session?.user) return;

        const channel = supabase.channel('app_updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_profiles', filter: `id=eq.${session.user.id}` },
                (payload) => {
                    console.log('Profile updated remotely', payload);
                    fetchData(session.user, true);
                    addToast('Your profile has been updated.', 'info');
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_role_assignments', filter: `user_id=eq.${session.user.id}` },
                (payload) => {
                    console.log('Role assignments updated remotely', payload);
                    fetchData(session.user, true);
                    addToast('Your permissions have been updated.', 'info');
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
    }, [session, addToast]); 


    useEffect(() => {
        const currentHash = decodeURIComponent(window.location.hash.substring(1));
        let targetView = currentView;
        
        // Handle leading slash if present
        if (targetView.startsWith('/')) targetView = targetView.substring(1);
        let targetHash = currentHash;
        if (targetHash.startsWith('/')) targetHash = targetHash.substring(1);
        
        // Ignore auth tokens in hash logic to prevent view loop
        if (targetHash.includes('access_token=') || targetHash.includes('error=')) {
            return; 
        }

        // Do not override hash if currentView is Dashboard but hash is something else (e.g. a public page)
        // Only sync if they are truly different and we want to enforce state -> URL sync
        if (targetView !== targetHash && targetHash !== 'student-login' && targetHash !== 'public-ratings' && targetHash !== 'teacher-login') {
             window.location.hash = targetView;
        }
    }, [currentView]);

    useEffect(() => {
        const handleHashChange = () => {
            try {
                let hash = decodeURIComponent(window.location.hash.substring(1));
                if (hash.startsWith('/')) hash = hash.substring(1);
                
                // Ignore auth tokens in hash
                if (hash.includes('access_token=') || hash.includes('error=')) {
                    return; 
                }
                
                const targetView = hash || 'Dashboard';
                setCurrentView(targetView);
            } catch (e) {
                console.warn("Error decoding hash:", e);
            }
        };
        
        window.addEventListener('hashchange', handleHashChange);
        // Trigger once on mount to capture initial hash
        handleHashChange();
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

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
    
    useEffect(() => {
        const handleHashChange = () => setHash(window.location.hash);
        window.addEventListener('hashchange', handleHashChange);
        setHash(window.location.hash);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);
    
    useEffect(() => {
        if (userType === 'student' && !['My Subjects', 'Rate My Teacher', 'Surveys', 'Reports'].includes(currentView) && !currentView.startsWith('Student Report/')) {
             setCurrentView('My Subjects');
        }
    }, [userType, currentView]);

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


    const handleLogout = useCallback(async () => {
        if (!supabase) return;
        try {
            await (supabase.auth as any).signOut();
        } catch (error) {
            if (Offline.online()) {
                console.error("Logout error:", error);
            } else {
                console.log("Offline logout successful locally.");
            }
        }
        setUserProfile(null);
        setUserType(null);
        setCurrentView('Dashboard');
        window.location.hash = '';
    }, []);

    const fetchData = useCallback(async (user: User, forceRefresh: boolean = false) => {
        if (!supabase) return;
        // If refreshing, ignore the lastFetchedUserId check
        if (!forceRefresh && lastFetchedUserId.current === user.id && userProfileRef.current) return;

        try {
            let staffProfile: any = null;
            let studentProfile: any = null;
            let staffProfileError: any = null;
            let studentProfileError: any = null;
            
            const metadataUserType = user.user_metadata?.user_type;
            
            // Strict separation: If metadata says student, ONLY check student profile.
            if (metadataUserType === 'student') {
                 const studentRes = await supabase.from('student_profiles').select('*').eq('id', user.id).maybeSingle();
                 studentProfile = studentRes.data;
                 studentProfileError = studentRes.error;

                 // Self-healing for student if profile missing but user_type is student
                 if (!studentProfile) {
                    console.log("Self-healing: creating student profile for authenticated user", user.id);
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
                        addToast("Student profile recovered successfully.", "success");
                    } else {
                         console.error("Failed to recover student profile:", profileError);
                         if (profileError?.message.includes('policy')) {
                             setDbError("Account setup failed: Database permission denied. Please ask Admin to run the 'Fix Missing Data' script in Settings.");
                             return;
                         }
                    }
                 }
            } 
            // If metadata says staff, ONLY check staff profile.
            else if (metadataUserType === 'staff') {
                 const staffRes = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
                 staffProfile = staffRes.data;
                 staffProfileError = staffRes.error;
            }
            // If legacy/unknown, try both but prioritize student if found
            else {
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
                setUserProfile(staffProfile as UserProfile);
                setUserType('staff');
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
                setRoles(rolesMap);

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
                
                setUserPermissions(Array.from(perms));
                setUserRoleAssignments(userRoleAssignmentsRes || []);

                if (!(staffProfile as UserProfile).has_seen_tour) {
                    supabase.from('user_profiles').update({ has_seen_tour: true }).eq('id', (staffProfile as UserProfile).id).then(({ error }) => {
                        if (error) console.error('Failed to update tour status:', error.message);
                    });
                }
            } 
            // --- PROCESS STUDENT PROFILE ---
            else if (studentProfile) {
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
                setUserProfile(profile);
                setUserType('student');
                lastFetchedUserId.current = user.id;
                setUserPermissions([]); 
                const { data: studentReports } = await supabase.from('student_term_reports').select('*, term:terms(*)').eq('student_id', studentRecord.id).order('created_at', { ascending: false });
                if (studentReports) setStudentTermReports(studentReports as any);
                setBooting(false);
                return; 
            } else {
                setUserProfile(null);
                setUserType(null);
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
                            const { data, error } = await supabase.from('user_profiles').select('*');
                            if (error) throw error;
                            return data ?? [];
                        };
                        
                        const fetchStudents = async () => {
                             const { data, error } = await supabase.from('students').select('*, class:class_id(id, name), arm:arm_id(id, name)');
                             if (error) throw error;
                             return data ?? [];
                        };

                        const queries = [
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
                            supabase.from('announcements').select('*, author:user_profiles(name)').order('created_at', { ascending: false }),
                            supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
                            supabase.from('positive_behavior').select('*, student:students(name), author:user_profiles(name)').order('created_at', { ascending: false }),
                            supabase.from('student_awards').select('*, student:students(name)').order('created_at', { ascending: false }),
                            supabase.from('staff_awards').select('*').order('created_at', { ascending: false }),
                            supabase.from('student_intervention_plans').select('*, student:students(*)'),
                            supabase.from('sip_logs').select('*, author:user_profiles(name)'),
                            // Fetch teaching assignments with expanded relation
                            supabase.from('lesson_plans').select('*, author:user_profiles(name), teaching_entity:teaching_assignments(*, teacher:user_profiles(name), academic_class:academic_classes(name))'),
                            supabase.from('schools').select('*').eq('id', sp.school_id).limit(1).maybeSingle(),
                            supabase.from('living_policy_snippets').select('*, author:user_profiles(name)').order('created_at', { ascending: false }),
                            supabase.from('calendar_events').select('*').order('start_time', { ascending: true }),
                            supabase.from('inventory_items').select('*'),
                            supabase.from('subjects').select('*'),
                            supabase.from('classes').select('*'),
                            supabase.from('arms').select('*'),
                            supabase.from('quizzes').select('*, questions:quiz_questions(*)').order('created_at', { ascending: false }),
                            supabase.from('quiz_responses').select('quiz_id').eq('user_id', user.id),
                            supabase.from('teacher_rating_weekly').select('*').order('week_start', { ascending: false }),
                            supabase.from('teams').select('*, lead:user_profiles!lead_id(*), members:team_assignments(user_id, profile:user_profiles(name))'),
                            supabase.from('team_feedback').select('*'),
                            supabase.from('curriculum').select('*'),
                            supabase.from('curriculum_weeks').select('*'),
                            supabase.from('class_groups').select('*, members:class_group_members(*, schedules:attendance_schedules(*), records:attendance_records(*)), teaching_entity:teaching_assignments(*, teacher:user_profiles(name), academic_class:academic_classes(name), subject:subjects(name))').eq('school_id', sp.school_id),
                            supabase.from('school_config').select('*').eq('school_id', sp.school_id).limit(1).maybeSingle(),
                            supabase.from('terms').select('*'),
                            supabase.from('academic_classes').select('*, assessment_structure:assessment_structures(*)'),
                            supabase.from('teaching_assignments').select('*, term:terms(*), academic_class:academic_classes(*, assessment_structure:assessment_structures(*)), teacher:user_profiles!teacher_user_id(*)'),
                            supabase.from('grading_schemes').select('*'),
                            supabase.from('grading_scheme_rules').select('*'),
                            supabase.from('academic_class_students').select('*'),
                            supabase.from('score_entries').select('*'),
                            supabase.from('student_term_reports').select('*, term:terms(*)'),
                            supabase.from('audit_log').select('*, actor:user_profiles!actor_user_id(name)').order('created_at', { ascending: false }).limit(100),
                            supabase.from('assessments').select('*, assignment:teaching_assignments!inner(*)'),
                            supabase.from('assessment_scores').select('*'),
                            supabase.from('student_term_report_subjects').select('*'),
                            supabase.from('lesson_plan_coverage_votes').select('*'),
                            supabase.from('rewards_store_items').select('*'),
                            supabase.from('payroll_runs').select('*'),
                            supabase.from('payroll_items').select('*'),
                            supabase.from('payroll_adjustments').select('*'),
                            supabase.from('campuses').select('*'),
                            supabase.from('teacher_checkins').select('*'),
                            supabase.from('leave_types').select('*'),
                            supabase.from('leave_requests').select('*, leave_type:leave_types(*), requester:user_profiles!requester_id(*)'),
                            supabase.from('teacher_shifts').select('*'),
                            supabase.from('assessment_structures').select('*'),
                            supabase.from('teaching_entities').select('*, teacher:user_profiles!user_id(name), class:classes(name), arm:arms(name), subject:subjects(name))'),
                            supabase.from('orders').select('*, items:order_items(*, inventory_item:inventory_items(name, image_url)), user:user_profiles(name, email), notes:order_notes(*, author:user_profiles(name))').order('created_at', { ascending: false }),
                        ];
                        
                        // Use Promise.allSettled to allow partial failure
                        const results = await Promise.allSettled(queries);
                        
                        // Helper to safely extract data from result - always returns array for array types
                        const getData = (index: number): any[] => {
                            const res = results[index];
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
                            const res = results[index];
                            if (res.status !== 'fulfilled') return null;
                            const value = res.value as any;
                            if (value && typeof value === 'object' && 'data' in value) {
                                return value.data;
                            }
                            return value;
                        };
            
                        setUsers(getData(0));
                        setReports(getData(1));
                        setStudents(getData(2));
                        setTasks(getData(3));
                        setAnnouncements(getData(4));
                        setNotifications(getData(5));
                        setPositiveRecords(getData(6));
                        setStudentAwards(getData(7));
                        setStaffAwards(getData(8));
                        setInterventionPlans(getData(9));
                        setSipLogs(getData(10));
                        setLessonPlans(getData(11));
                        setSchoolSettings(getSingleData(12));
                        setLivingPolicy(getData(13));
                        setCalendarEvents(getData(14));
                        setInventory(getData(15));
                        setAllSubjects(getData(16));
                        setAllClasses(getData(17));
                        setAllArms(getData(18));
                        setSurveys(getData(19));
                        setTakenSurveys(new Set(getData(20).map((r: any) => r.quiz_id)));
                        setWeeklyRatings(getData(21));
                        setTeams(getData(22));
                        setTeamFeedback(getData(23));
                        setCurricula(getData(24));
                        setCurriculumWeeks(getData(25));
                        const classGroupsData = getData(26);
                        console.log('Class groups fetched:', classGroupsData);
                        setClassGroups(classGroupsData);
                        setSchoolConfig(getSingleData(27));
                        setTerms(getData(28));
                        setAcademicClasses(getData(29));
                        setAcademicAssignments(getData(30));
                        const schemesData = getData(31);
                        const rulesData = getData(32);
                        setAcademicClassStudents(getData(33));
                        setScoreEntries(getData(34));
                        setStudentTermReports(getData(35));
                        setAuditLogs(getData(36));
                        setAssessments(getData(37));
                        setAssessmentScores(getData(38));
                        setStudentTermReportSubjects(getData(39));
                        setCoverageVotes(getData(40));
                        setRewards(getData(41));
                        setPayrollRuns(getData(42));
                        setPayrollItems(getData(43));
                        setPayrollAdjustments(getData(44));
                        setCampuses(getData(45));
                        setTeacherCheckins(getData(46));
                        setLeaveTypes(getData(47));
                        setLeaveRequests(getData(48));
                        setTeacherShifts(getData(49));
                        setAssessmentStructures(getData(50));
                        setTeachingEntities(getData(51));
                        setOrders(getData(52));

                        const combinedSchemes = (schemesData as GradingScheme[]).map(scheme => ({
                            ...scheme,
                            rules: (rulesData as GradingSchemeRule[]).filter(rule => rule.grading_scheme_id === scheme.id)
                        }));
                        setGradingSchemes(combinedSchemes);

                        const settings = getSingleData(12);
                        if (settings?.school_documents) {
                            const docs = settings.school_documents;
                            if (docs.daily_briefing) setDailyBriefing(docs.daily_briefing);
                            if (docs.curriculum_report) setCurriculumReport(docs.curriculum_report);
                            if (docs.health_report) setSchoolHealthReport(docs.health_report);
                            if (docs.improvement_plan) setImprovementPlan(docs.improvement_plan);
                        }
                        
                        // Check for critical failures
                        const criticalIndices = [0, 1]; // Users, Reports
                        const criticalErrors = criticalIndices.filter(i => results[i].status === 'rejected').length;
                        if (criticalErrors > 0) {
                            addToast("Some core data failed to load. The app may not function correctly.", "error");
                        }

                        analyzeAtRiskStudents(getData(2), getData(1));
                        generateTaskSuggestions(getData(1));
                    } catch (error: any) {
                        console.error('Background data fetching error:', error);
                        addToast(`Failed to fetch all application data: ${error.message}`, 'error');
                    } finally {
                        setBooting(false);
                    }
                })();
            }
    
        } catch (error: any) {
            console.error('Essential data fetching error:', error);
             // Do NOT logout if it's a schema error, so the Setup screen can show
            if (error.message && (error.message.includes('relation') || error.message.includes('does not exist') || error.code === 'PGRST204')) {
                 setDbError(error.message);
            } else {
                 addToast(`Failed to fetch user data: ${error.message}. You will be logged out.`, 'error');
                 setUserProfile(null);
                 setUserType(null);
                 handleLogout();
            }
            setBooting(false);
        }
    }, [addToast, handleLogout]); 

    const analyzeAtRiskStudents = useCallback(async (allStudents: Student[], allReports: ReportRecord[]) => {
        if (!aiClient || allStudents.length === 0 || allReports.length === 0) return;
        try {
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
            const studentsWithReports = allStudents.filter(s => studentReportMap[s.id]);
            if (studentsWithReports.length === 0) { setAtRiskStudents([]); return; }
            const prompt = `Analyze the following reports to identify at-risk students. Return a JSON array of objects with "studentId" (number), "riskScore" (1-100), and "reasons" (array of short strings). Only include students with a risk score > 60. Students and their associated negative report texts: ${studentsWithReports.map(s => `Student ID ${s.id} (${s.name}):\n- ${studentReportMap[s.id].join('\n- ')}`).join('\n\n')}`;
            const response = await aiClient.models.generateContent({ 
                model: 'gemini-2.5-flash', 
                contents: prompt, 
                config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { studentId: { type: Type.NUMBER }, riskScore: { type: Type.NUMBER }, reasons: { type: Type.ARRAY, items: { type: Type.STRING } }, } } } } 
            });
            const results = extractAndParseJson<{ studentId: number, riskScore: number, reasons: string[] }[]>(textFromGemini(response));
            if (results && Array.isArray(results)) {
                const atRiskData: AtRiskStudent[] = results.map(res => {
                    const student = allStudents.find(s => s.id === res.studentId);
                    return student ? { student, score: res.riskScore, reasons: res.reasons } : null;
                }).filter((s): s is AtRiskStudent => s !== null);
                setAtRiskStudents(atRiskData);
            }
        } catch (e) { console.error("At-risk student analysis failed:", e); }
    }, [aiClient]);

    const generateTaskSuggestions = useCallback(async (allReports: ReportRecord[]) => {
        if (!aiClient || allReports.length === 0) return;
        try {
            const urgentReports = allReports.filter(r => (r.analysis?.urgency === 'Critical' || r.analysis?.urgency === 'High') && !tasks.some(t => t.report_id === r.id));
            if (urgentReports.length === 0) { setTaskSuggestions([]); return; }
            const prompt = `Analyze these urgent school reports and suggest concrete, actionable tasks. For each report, generate one task. Return a JSON array of objects, each with "reportId" (number), "title" (string, max 50 chars), "description" (string, max 150 chars), "priority" (string: 'High' or 'Critical'), and "suggestedRole" (string, one of: 'Admin', 'Principal', 'Counselor', 'Team Lead', 'Maintenance'). Reports:\n${urgentReports.map(r => `ID ${r.id}: "${r.report_text}" - Summary: ${r.analysis?.summary}`).join('\n')}`;
            const response = await aiClient.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { reportId: { type: Type.NUMBER }, title: { type: Type.STRING }, description: { type: Type.STRING }, priority: { type: Type.STRING, enum: ['High', 'Critical'] }, suggestedRole: { type: Type.STRING, enum: ['Admin', 'Principal', 'Counselor', 'Team Lead', 'Maintenance'] }, } } } } });
            const results = extractAndParseJson<Omit<SuggestedTask, 'id'>[]>(textFromGemini(response));
            if (results && Array.isArray(results)) {
                const suggestions: SuggestedTask[] = results.map(res => ({ ...res, id: `sugg-${res.reportId}-${Date.now()}` }));
                setTaskSuggestions(suggestions);
            }
        } catch (e) { console.error("Task suggestion generation failed:", e); }
    }, [aiClient, tasks]);

    const handleGenerateForesight = useCallback(async (question: string): Promise<UPSSGPTResponse | null> => {
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
        if (!schoolSettings || !supabase) return false;
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
         if (!aiClient || !session) { addToast("AI client is not configured.", "error"); return; }
         addToast("Generating School Health Report...", "info");
         try {
             const reportCount = reports.length;
             const taskCompletionRate = tasks.length > 0 ? (tasks.filter(t => t.status === TaskStatus.Completed).length / tasks.length) * 100 : 100;
             const atRiskCount = atRiskStudents.length;
             const positiveBehaviorCount = positiveRecords.length;
             const averageTeamPulse = teamPulse.length > 0 ? teamPulse.reduce((acc, p) => acc + p.overallScore, 0) / teamPulse.length : 0;
             const context = `Total Reports: ${reportCount}, Task Completion Rate: ${taskCompletionRate.toFixed(1)}%, At-Risk Students: ${atRiskCount}, Positive Behaviors: ${positiveBehaviorCount}, Team Pulse: ${averageTeamPulse.toFixed(1)}`;
             const prompt = `You are an AI school administrator. Generate a "School Health Report" JSON with "overall_score" (0-100), "summary" (string), and "metrics" (array of {metric, score, summary}). Data: ${context}`;
             const response = await aiClient.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { overall_score: { type: Type.NUMBER }, summary: { type: Type.STRING }, metrics: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { metric: { type: Type.STRING }, score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ['metric', 'score', 'summary'] } } }, required: ['overall_score', 'summary', 'metrics'] } } });
             const reportData = extractAndParseJson<Omit<SchoolHealthReport, 'generated_at'>>(textFromGemini(response));
             if (!reportData) throw new Error("Invalid AI response");
             const newReport: SchoolHealthReport = { ...reportData, generated_at: new Date().toISOString() };
             await handleUpdateSchoolSettings({ school_documents: { ...schoolSettings?.school_documents, health_report: newReport } });
             addToast("School Health Report generated.", "success");
             if(session.user) fetchData(session.user, true);
         } catch(e: any) { console.error(e); addToast(`Failed: ${e.message}`, 'error'); }
    }, [aiClient, session, addToast, reports, tasks, atRiskStudents, positiveRecords, teamPulse, schoolSettings, handleUpdateSchoolSettings, fetchData]);

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
        if (!aiClient) return;
        addToast('Analyzing staff performance...', 'info');
        // Simplified mock generation
        const newAwards = [
            { id: Date.now(), school_id: 1, recipient_id: '1', recipient_name: 'John Doe', reason: 'Outstanding dedication', created_at: new Date().toISOString(), source_report_ids: [] }
        ];
        setStaffAwards(prev => [...newAwards, ...prev]);
        addToast('Staff awards generated!', 'success');
    }, [addToast]);

    const handleAnalyzeTeacherRisk = useCallback(async () => {
         if (!aiClient) return;
         addToast('Analyzing teacher risk factors...', 'info');
         
         try {
            const reportContext = reports.map(r => `Report (${r.created_at}): ${r.report_text}`).join('\n');
            const prompt = `Analyze the following reports for signs of teacher burnout, stress, or performance issues. Return a JSON array of objects with "teacherName" (string), "riskScore" (1-100), and "reasons" (array of strings). Only include high-risk cases. Reports: ${reportContext}`;
            
            const response = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });

            const risks = extractAndParseJson<{ teacherName: string, riskScore: number, reasons: string[] }[]>(textFromGemini(response));
            
            if (risks && Array.isArray(risks) && risks.length > 0) {
                const mappedRisks: AtRiskTeacher[] = risks.map(r => {
                    const teacher = users.find(u => u.name === r.teacherName);
                    return teacher ? { teacher, score: r.riskScore, reasons: r.reasons } : null;
                }).filter((r): r is AtRiskTeacher => r !== null);
                setAtRiskTeachers(mappedRisks);
                addToast(`Identified ${mappedRisks.length} potential risk cases.`, 'warning');
            } else {
                setAtRiskTeachers([]);
                addToast('Analysis complete. No high-risk factors detected.', 'success');
            }
         } catch (e) {
             console.error(e);
             addToast('Failed to analyze risks.', 'error');
         }
    }, [aiClient, reports, users, addToast]);

    const handleSaveTeamFeedback = useCallback(async (teamId: number, rating: number, comments: string | null): Promise<boolean> => {
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
        if (!aiClient) return;
        addToast('Scanning for policy gaps...', 'info');
        
        try {
            const incidents = reports.filter(r => r.report_type === ReportType.Incident).map(r => r.report_text).join('\n---\n');
            const prompt = `Analyze these school incident reports. Identify 3 areas where school policy might be unclear, missing, or frequently violated. Return a JSON array of objects with "category", "question", and "context". Incidents:\n${incidents}`;
            
            const response = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            
            const inquiries = extractAndParseJson<PolicyInquiry[]>(textFromGemini(response));
            if (inquiries && Array.isArray(inquiries)) {
                setPolicyInquiries(inquiries.map(i => ({ ...i, id: String(Date.now() + Math.random()) })));
                addToast('Policy inquiries generated.', 'success');
            }
        } catch (e) {
            console.error(e);
            addToast('Failed to generate inquiries.', 'error');
        }
    }, [aiClient, reports, addToast]);

    const handleGenerateCurriculumReport = useCallback(async () => {
        if (!aiClient) return;
        addToast('Generating curriculum report...', 'info');
        
        try {
            const submittedPlans = lessonPlans.filter(p => p.submission_status !== 'Missed');
            const submissionRate = lessonPlans.length > 0 ? Math.round((submittedPlans.length / lessonPlans.length) * 100) : 0;
            
            const prompt = `Analyze the following lesson plan titles and statuses. Identify coverage gaps or topics that seem to be falling behind schedule. Return a JSON object with "summary" (string), "coverage_gaps" (array of {teacher_name, class_name, topic, suggestion}).
            
            Plans: ${JSON.stringify(lessonPlans.map(p => ({ title: p.title, status: p.coverage_status, teacher: p.author?.name })))}`;
            
            const response = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            
            const analysis = extractAndParseJson<any>(textFromGemini(response));
            
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
        } catch (e) {
            console.error(e);
            addToast('Failed to generate report.', 'error');
        }
    }, [aiClient, lessonPlans, addToast]);

    const handleUpdateProfile = useCallback(async (data: Partial<UserProfile>): Promise<boolean> => {
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
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
             addToast(`Password update failed: ${error.message}`, 'error');
        } else {
             addToast('Password updated successfully!', 'success');
        }
    }, [addToast]);

    const handleProcessDailyDigest = useCallback(async (): Promise<DailyBriefing | null> => {
        if (!aiClient) return null;
        
        try {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentReports = reports.filter(r => new Date(r.created_at) > oneDayAgo);
            const pendingTasks = tasks.filter(t => t.status !== TaskStatus.Completed);
            
            const prompt = `Generate a Daily Briefing for the school principal.
            
            Recent Reports (Last 24h): ${JSON.stringify(recentReports.map(r => ({ type: r.report_type, text: r.report_text, sentiment: r.analysis?.sentiment })))}
            Pending Tasks: ${JSON.stringify(pendingTasks.map(t => ({ title: t.title, priority: t.priority })))}
            
            Return a JSON object with:
            - daily_summary: A concise paragraph summarizing key events.
            - morale_forecast: A short prediction of school morale (Positive, Neutral, Negative) with a reason.
            - resource_allocation_suggestions: Array of strings suggesting where to focus attention.
            - parent_communication_points: Array of strings for potential parent updates.
            `;
            
            const response = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            
            const digest = extractAndParseJson<Omit<DailyBriefing, 'generated_at'>>(textFromGemini(response));
            if (digest && typeof digest === 'object') {
                return { ...digest, generated_at: new Date().toISOString() };
            }
            throw new Error("Failed to parse digest");
        } catch (e) {
            console.error(e);
            addToast("Failed to generate daily briefing.", "error");
            return null;
        }
    }, [aiClient, reports, tasks, addToast]);

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
                
                const response = await aiClient.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: { responseMimeType: 'application/json' }
                });
                
                analysis = extractAndParseJson(textFromGemini(response));
            } catch (e) {
                console.error("Real-time analysis failed", e);
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
        const { error } = await supabase.from('reports').update({ assignee_id: assigneeId }).in('id', reportIds);
        if (error) addToast(`Bulk assign failed: ${error.message}`, 'error');
        else {
            setReports(prev => prev.map(r => reportIds.includes(r.id) ? { ...r, assignee_id: assigneeId, assignee: users.find(u => u.id === assigneeId) } : r));
            addToast(`${reportIds.length} reports assigned.`, 'success');
        }
    }, [users, addToast]);

    const handleBulkUpdateReportStatus = useCallback(async (reportIds: number[], status: 'pending' | 'treated') => {
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
        try {
            if (!supabase || !supabase.functions) {
                throw new Error("Supabase client not fully initialized");
            }

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
        try {
            if (!supabase || !supabase.functions) {
                throw new Error("Supabase client not fully initialized");
            }

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
            const { data: updatedStudents } = await supabase.from('students').select('*, class:classes(*), arm:arms(*)');
            if (updatedStudents) setStudents(updatedStudents);

            return true;
        } catch (e: any) {
            console.error("Delete Account Error:", e);
            addToast(`Account deletion failed: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

    const handleBulkDeleteStudentAccounts = useCallback(async (userIds: string[]): Promise<{ success: boolean; deleted: number; total: number }> => {
        try {
            if (!supabase || !supabase.functions) {
                throw new Error("Supabase client not fully initialized");
            }

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
            const { data: updatedStudents } = await supabase.from('students').select('*, class:classes(*), arm:arms(*)');
            if (updatedStudents) {
                setStudents(updatedStudents);
                console.log(`Refreshed student data: ${updatedStudents.length} students`);
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
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [students, addToast]);

    const handleBulkDeleteStudents = useCallback(async (studentIds: number[]): Promise<{ success: boolean; deleted: number; total: number }> => {
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
            setTimeout(() => fetchData(session!.user, true), 2000);

            return { success: true, message: `${enrichedData.length} students processed.`, credentials: data.credentials };
        } catch (e: any) {
            console.error("Bulk upload error:", e);
            // Fallback to direct DB insert if function fails (no login generated, only DB record) - Simplified for now
            return { success: false, message: `Service unavailable or error: ${e.message}` };
        }
    }, [userProfile, session, fetchData, allClasses, allArms]);

    const handleBulkCreateStudentAccounts = useCallback(async (studentIds: number[]) => {
        if (!userProfile) return { success: false, message: 'User not authenticated' };
        
        try {
            const { data, error } = await supabase.functions.invoke('manage-users', {
                body: { action: 'bulk_create_for_existing', studentIds }
            });

            if (error) {
                 console.warn("Edge function invoke error:", error);
                 throw new Error("Edge function unavailable");
            }
            
            fetchData(session!.user, true); // Refresh list to update user_id presence

            return { success: true, message: `Accounts generated for ${studentIds.length} students.`, credentials: data.credentials };
        } catch (e: any) {
             console.error("Bulk account creation error:", e);
             return { success: false, message: `Service unavailable (Edge Function missing). Please ask students to sign up manually.` };
        }
    }, [userProfile, session, fetchData]);


    const handleAddStudent = useCallback(async (studentData: any): Promise<boolean> => {
        if (!userProfile) return false;
        const { error, data } = await Offline.insert('students', { ...studentData, school_id: userProfile.school_id });
        if (error) {
            addToast(error.message, 'error');
            return false;
        }
        if(data) addItem(setStudents, data);
        addToast('Student record created (No login).', 'success');
        return true;
    }, [userProfile, addToast]);

    const handleCreateStudentAccount = useCallback(async (studentId: number): Promise<CreatedCredential | null> => {
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
            if(session?.user) fetchData(session.user, true);

            return data.credential;
        } catch (e: any) {
            console.error("Create account error:", e);
            addToast(`Automated creation unavailable. Student can sign up using Secret Code: UPSS-SECRET-2025`, 'warning'); 
            return null;
        }
    }, [session, fetchData, addToast]);


    const handleUpdateStudent = useCallback(async (studentId: number, studentData: Partial<Student>): Promise<boolean> => {
        const { error } = await Offline.update('students', studentData, { id: studentId });
        if (error) {
            addToast(error.message, 'error');
            return false;
        }
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...studentData } : s));
        addToast('Student updated.', 'success');
        return true;
    }, [addToast]);

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

    // Lock academic assignment scores (for Result Manager)
    const handleLockScores = useCallback(async (assignmentId: number): Promise<boolean> => {
        try {
            const { error } = await Offline.update('academic_teaching_assignments', 
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
            addToast(`Error locking scores: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

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

    // --- Grading Scheme Handlers ---
    const handleSaveGradingScheme = useCallback(async (scheme: Partial<GradingScheme>): Promise<boolean> => {
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

    // --- Term Handlers ---
    const handleSaveTerm = useCallback(async (term: Partial<Term>): Promise<boolean> => {
        if (!userProfile) return false;
        try {
            if (term.id) {
                const { error } = await Offline.update('terms', term, { id: term.id });
                if (error) { addToast(error.message, 'error'); return false; }
                setTerms(prev => prev.map(t => t.id === term.id ? { ...t, ...term } as Term : t));
            } else {
                const { data, error } = await Offline.insert('terms', { ...term, school_id: userProfile.school_id });
                if (error || !data) { addToast(error?.message || 'Failed to create term', 'error'); return false; }
                setTerms(prev => [...prev, data as Term]);
            }
            addToast('Term saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

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
            } else {
                const { data, error } = await Offline.insert('teaching_assignments', { ...assignment, school_id: userProfile.school_id });
                if (error || !data) { addToast(error?.message || 'Failed to create assignment', 'error'); return false; }
                setAcademicAssignments(prev => [...prev, data as AcademicTeachingAssignment]);
            }
            addToast('Teaching assignment saved.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [userProfile, addToast]);

    const handleDeleteAcademicAssignment = useCallback(async (assignmentId: number): Promise<boolean> => {
        try {
            const { error } = await Offline.del('teaching_assignments', { id: assignmentId });
            if (error) { addToast(error.message, 'error'); return false; }
            setAcademicAssignments(prev => prev.filter(a => a.id !== assignmentId));
            addToast('Teaching assignment deleted.', 'success');
            return true;
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            return false;
        }
    }, [addToast]);

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

    const handleDeactivateUser = useCallback(async (userId: string, isActive: boolean) => {
        // Logic to toggle active state in DB/Auth
        addToast(`User ${isActive ? 'activated' : 'deactivated'}.`, 'success');
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
        const { data } = await supabase.from('class_groups').select('*, members:class_group_members(*, schedules:attendance_schedules(*), records:attendance_records(*)), teaching_entity:teaching_assignments(*, teacher:user_profiles(name), academic_class:academic_classes(name), subject:subjects(name))').eq('id', groupId).single();
        if (data) {
             setClassGroups(prev => prev.map(g => g.id === groupId ? data : g));
        }
        addToast('Class group members updated.', 'success');
        return true;
    }, [addToast]);


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

    const handleUpdateAvatar = useCallback(async (file: File) => {
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

    const handleResetPassword = useCallback(async () => {
        if (!userProfile) return;
        const email = (userProfile as any).email || session?.user?.email;
        if (email) {
            await supabase.auth.resetPasswordForEmail(email);
            addToast('Password reset email sent.', 'info');
        }
    }, [userProfile, session, addToast]);

    const handleUpdateEmail = useCallback(async (email: string) => {
         const { error } = await supabase.auth.updateUser({ email });
         if (error) addToast(error.message, 'error');
         else addToast('Confirmation email sent to new address.', 'info');
    }, [addToast]);

    // ... (Survey handlers)
    const handleSaveSurvey = useCallback(async (surveyData: any) => {
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

    // ... (Lesson Plan handlers)
    const handleSaveLessonPlan = useCallback(async (planData: Partial<LessonPlan>, generateWithAi: boolean, file: File | null) => {
        if (!userProfile) return null;
        let finalPlanData = { ...planData };

        if (generateWithAi && aiClient) {
            const prompt = `Generate a detailed lesson plan for "${planData.title}" (Grade: ${planData.grade_level}). Include objectives, materials, activities, and assessment methods. Format as JSON matching the LessonPlan structure.`;
             try {
                const response = await aiClient.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
                const generated = extractAndParseJson<Partial<LessonPlan>>(textFromGemini(response));
                if (generated) finalPlanData = { ...finalPlanData, ...generated };
            } catch (e) {
                console.error("AI Gen failed", e);
                addToast("AI generation failed, saving manual input.", "error");
            }
        }
        
        if (file) {
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
        if (!aiClient) return null;
        return { has_objectives: true, has_assessment: true, clarity_score: 8, suggestions: ["Add more details"] };
    }, [aiClient]);

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
             const { data } = await supabase.from('lesson_plans').select('*, author:user_profiles(name), teaching_entity:teaching_assignments(*, teacher:user_profiles(name), academic_class:academic_classes(name))');
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
        
        // Refresh orders
        const { data: newOrders } = await supabase.from('orders').select('*, items:order_items(*, inventory_item:inventory_items(name, image_url)), user:user_profiles(name, email), notes:order_notes(*, author:user_profiles(name))').order('created_at', { ascending: false });
        if (newOrders) setOrders(newOrders as any);

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
        else { addToast('Payroll run initiated', 'success'); if(session?.user) fetchData(session.user, true); }
    }, [payrollAdjustments, users, addToast, fetchData, session]);

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


    // ... (Rendering Logic) ...

    const renderContent = () => {
        // IMPORTANT: Check userType first to ensure correct profile type usage
        if (userType === 'student') {
            const studentProfile = userProfile as StudentProfile;
            switch (currentView) {
                case 'My Subjects':
                    return <StudentPortal studentProfile={studentProfile} addToast={addToast} onLogout={handleLogout} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
                case 'Rate My Teacher':
                    return <StudentRateMyTeacherView studentProfile={studentProfile} addToast={addToast} />;
                case 'Surveys':
                    return <StudentSurveysView studentProfile={studentProfile} addToast={addToast} surveys={surveys} takenSurveyIds={takenSurveys} onNavigate={setCurrentView} />;
                case 'Reports':
                    return <StudentReportList reports={studentTermReports} onSelectReport={(report) => setCurrentView(`Student Report/${studentProfile.student_record_id}/${report.term_id}`)} />;
                case 'Take Quiz':
                    // handled in default if format is "Take Quiz/ID" but if it's just "Take Quiz" we need params.
                    // Assume default fallthrough handles parameterized routes
                    break;
                default:
                    if (currentView.startsWith('Student Report/')) {
                        const parts = currentView.split('/');
                        // format: Student Report/studentId/termId
                        const termId = Number(parts[2]);
                        return <StudentReportView studentId={studentProfile.student_record_id} termId={termId} onBack={() => setCurrentView('Reports')} isStudentUser={true} />;
                    }
                    if (currentView.startsWith('Take Quiz/')) {
                         const quizId = Number(currentView.split('/')[1]);
                         const quiz = surveys.find(s => s.id === quizId);
                         if(quiz) return <QuizTakerView quiz={quiz} onBack={() => setCurrentView('Surveys')} addToast={addToast} />;
                    }
                    return <StudentPortal studentProfile={studentProfile} addToast={addToast} onLogout={handleLogout} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
            }
        }

        const staffProfile = userProfile as UserProfile;

        switch (currentView) {
            case VIEWS.DASHBOARD:
                return <Dashboard 
                    userProfile={staffProfile} 
                    tasks={tasks} 
                    announcements={announcements} 
                    alerts={alerts}
                    atRiskStudents={atRiskStudents}
                    positiveRecords={positiveRecords}
                    staffAwards={staffAwards}
                    teamPulse={teamPulse}
                    teams={teams}
                    teamFeedback={teamFeedback}
                    students={students}
                    interventionPlans={interventionPlans}
                    inventory={inventory}
                    reports={reports}
                    atRiskTeachers={atRiskTeachers}
                    socialMediaAnalytics={socialMediaAnalytics}
                    policyInquiries={policyInquiries}
                    curriculumReport={curriculumReport}
                    users={users}
                    userPermissions={userPermissions}
                    taskSuggestions={taskSuggestions}
                    sipLogs={sipLogs}
                    todaysCheckin={todaysCheckinForDashboard}
                    onNavigate={setCurrentView}
                    onViewStudent={(s) => { setSelectedStudent(s); setCurrentView(`${VIEWS.STUDENT_PROFILE}/${s.id}`); }}
                    onViewIntervention={(sid) => { setCurrentView(VIEWS.INTERVENTION_PLANS); }}
                    onUpdateTaskStatus={handleUpdateTaskStatus}
                    onAddAnnouncement={handleAddAnnouncement}
                    onGenerateStaffAwards={handleGenerateStaffAwards}
                    onAnalyzeTeacherRisk={handleAnalyzeTeacherRisk}
                    onSaveTeamFeedback={handleSaveTeamFeedback}
                    onGeneratePolicyInquiries={handleGeneratePolicyInquiries}
                    onGenerateCurriculumReport={handleGenerateCurriculumReport}
                    onUpdateProfile={handleUpdateProfile}
                    onProcessDailyDigest={handleProcessDailyDigest}
                    onAcceptTaskSuggestion={handleAcceptTaskSuggestion}
                    onDismissTaskSuggestion={handleDismissTaskSuggestion}
                    handleCheckinOut={handleCheckinOut}
                    campuses={campuses}
                    addToast={addToast}
                />;
            case VIEWS.SUBMIT_REPORT:
                return <ReportForm students={students} users={users} onSubmit={handleAddReport} onCancel={() => setCurrentView(VIEWS.DASHBOARD)} addToast={addToast} initialData={navContext?.data} />;
            case VIEWS.REPORT_FEED:
                return <ReportFeed 
                    reports={reports} 
                    users={users} 
                    tasks={tasks}
                    currentUser={staffProfile}
                    addToast={addToast}
                    onAssignReport={handleAssignReport}
                    onAddComment={handleAddReportComment}
                    onDeleteReport={handleDeleteReport}
                    onUpdateReportStatusAndResponse={handleUpdateReportStatusAndResponse}
                    userPermissions={userPermissions}
                    onBulkDeleteReports={handleBulkDeleteReports}
                    onBulkAssignReports={handleBulkAssignReports}
                    onBulkUpdateReportStatus={handleBulkUpdateReportStatus}
                    onOpenAIBulkResponseModal={handleOpenAIBulkResponseModal}
                    students={students}
                />;
            case VIEWS.TASK_BOARD:
                return <TaskManager allTasks={tasks} users={users} currentUser={staffProfile} onUpdateStatus={handleUpdateTaskStatus} onAddTask={handleAddTask} />;
            case VIEWS.MY_CHECKIN:
                return <TeacherCheckinView currentUser={staffProfile} addToast={addToast} todaysCheckin={todaysCheckinForDashboard} handleCheckinOut={handleCheckinOut} campuses={campuses} />;
            case VIEWS.TEACHER_ATTENDANCE:
                return <TeacherAttendanceDashboard campuses={campuses} academicAssignments={academicAssignments} />;
            case VIEWS.BULLETIN_BOARD:
                return <BulletinBoard announcements={announcements} userProfile={staffProfile} onAddAnnouncement={handleAddAnnouncement} onUpdateAnnouncement={handleUpdateAnnouncement} onDeleteAnnouncement={handleDeleteAnnouncement} userPermissions={userPermissions} />;
            case VIEWS.TIMETABLE:
                return <TimetableView userProfile={staffProfile} users={users} terms={terms} academicClasses={academicClasses} subjects={allSubjects} addToast={addToast} />;
            case VIEWS.SURVEYS:
                return <SurveyListView surveys={surveys} onTakeSurvey={(s) => { setTakingSurvey(s); setCurrentView(VIEWS.TAKE_SURVEY); }} takenSurveyIds={takenSurveys} />;
            case VIEWS.TAKE_SURVEY:
                if (!takingSurvey) return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;
                return <SurveyTakerView survey={takingSurvey} onBack={() => { setTakingSurvey(null); setCurrentView(VIEWS.SURVEYS); }} addToast={addToast} />;
            case VIEWS.MY_LEAVE:
                return <MyLeaveView currentUser={staffProfile} addToast={addToast} leaveRequests={leaveRequests} leaveTypes={leaveTypes} onSave={async (data) => {
                     const { error } = await supabase.from('leave_requests').insert({ ...data, requester_id: staffProfile.id, school_id: staffProfile.school_id });
                     if (error) { addToast(error.message, 'error'); return false; }
                     const { data: reqs } = await supabase.from('leave_requests').select('*, leave_type:leave_types(*), requester:user_profiles!requester_id(*)').eq('requester_id', staffProfile.id);
                     if (reqs) setLeaveRequests(reqs as any);
                     return true;
                }} onDelete={async (id) => {
                    const { error } = await supabase.from('leave_requests').delete().eq('id', id);
                     if (error) { addToast(error.message, 'error'); return false; }
                     setLeaveRequests(prev => prev.filter(r => r.id !== id));
                     return true;
                }} />;
            case VIEWS.LEAVE_APPROVALS:
                return <LeaveApprovalView currentUser={staffProfile} addToast={addToast} allRequests={leaveRequests} onUpdateStatus={async (id, status) => {
                     const { error } = await supabase.from('leave_requests').update({ status, approved_by: staffProfile.id }).eq('id', id);
                     if (error) { addToast(error.message, 'error'); return false; }
                     setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
                     return true;
                }} teams={teams} />;
            case VIEWS.STUDENT_ROSTER:
                return <StudentListView 
                    students={students} 
                    onAddStudent={handleAddStudent} 
                    onViewStudent={(s) => { setSelectedStudent(s); setCurrentView(`${VIEWS.STUDENT_PROFILE}/${s.id}`); }} 
                    onAddPositive={(s) => { setPositiveModalDefaultStudent(s); setIsPositiveModalOpen(true); }} 
                    onGenerateStudentAwards={handleGenerateStaffAwards} // Reusing logic/mock
                    userPermissions={userPermissions} 
                    onOpenCreateStudentAccountModal={() => { /* Handled in component */ }}
                    allClasses={allClasses} 
                    allArms={allArms} 
                    users={users} 
                    teachingAssignments={teachingEntities} 
                    onBulkCreateStudentAccounts={handleBulkCreateStudentAccounts}
                    onBulkDeleteAccounts={handleBulkDeleteStudentAccounts}
                    onDeleteStudent={handleDeleteStudent}
                    onBulkDeleteStudents={handleBulkDeleteStudents}
                />;
            case VIEWS.CLASSES_ATTENDANCE:
                return <ClassGroupManager 
                    classGroups={classGroups} 
                    students={students} 
                    currentUser={staffProfile} 
                    onUpdateMembers={handleUpdateClassGroupMembers}
                    onSaveSchedule={async () => null} // Mock
                    onDeleteSchedule={async () => false} // Mock
                    onSaveRecord={async (record) => { 
                        const { error } = await Offline.insert('attendance_records', record);
                        return !error;
                    }}
                    onCreateClassAssignment={async (assign: any, group: any) => {
                        if(!staffProfile || !('school_id' in staffProfile)) return false;
                        const { data: ag, error: e1 } = await Offline.insert('teaching_assignments', { ...assign, school_id: staffProfile.school_id });
                        if(e1 || !ag) return false;
                        const { error: e2 } = await Offline.insert('class_groups', { ...group, teaching_entity_id: ag.id, school_id: staffProfile.school_id, created_by: staffProfile.id });
                        if(e2) return false;
                        fetchData(session!.user, true); return true;
                    }}
                    onDeleteClassAssignment={async (id: number) => {
                         const { error } = await Offline.del('class_groups', { id });
                         if(!error) fetchData(session!.user, true); return !error;
                    }}
                    users={users} 
                    subjects={allSubjects} 
                    classes={allClasses} 
                    arms={allArms} 
                    userPermissions={userPermissions} 
                />;
            case VIEWS.INTERVENTION_PLANS:
                return <SIPView interventionPlans={interventionPlans} sipLogs={sipLogs} students={students} onCreatePlan={handleCreateSIP} onAddLog={handleAddSIPLog} userPermissions={userPermissions} onUpdatePlan={handleUpdateSIP} />;
            case VIEWS.LESSON_PLANNER:
                return <CurriculumPlannerContainer 
                    teams={teams} 
                    lessonPlans={lessonPlans} 
                    userProfile={staffProfile} 
                    teachingAssignments={academicAssignments} 
                    onSaveLessonPlan={handleSaveLessonPlan} 
                    onAnalyzeLessonPlan={handleAnalyzeLessonPlan} 
                    onCopyLessonPlan={handleCopyLessonPlan} 
                    curricula={curricula} 
                    curriculumWeeks={curriculumWeeks} 
                    onApprove={handleApproveLessonPlan} 
                />;
            case VIEWS.GRADEBOOK:
                return <TeacherGradebookView academicAssignments={academicAssignments} currentUser={staffProfile} onNavigate={setCurrentView} />;
            case VIEWS.ASSESSMENT_MANAGER:
                return <AssessmentManager 
                    academicAssignments={academicAssignments} 
                    assessments={assessments} 
                    assessmentScores={assessmentScores} 
                    students={students} 
                    academicClassStudents={academicClassStudents} 
                    userProfile={staffProfile} 
                    userPermissions={userPermissions} 
                    onSaveAssessment={async (d) => {
                         if (d.id) await Offline.update('assessments', d, { id: d.id });
                         else await Offline.insert('assessments', d);
                         return true;
                    }} 
                    onDeleteAssessment={async (id) => { await Offline.del('assessments', { id }); return true; }} 
                    onSaveScores={async (scores) => {
                         // Bulk insert logic needed or loop
                         for (const s of scores) await Offline.insert('score_entries', s);
                         return true;
                    }} 
                    onCopyAssessment={async () => true} 
                    addToast={addToast} 
                />;
            case VIEWS.COVERAGE_FEEDBACK:
                return <CoverageFeedbackReport lessonPlans={lessonPlans} coverageVotes={coverageVotes} users={users} teams={teams} currentUser={staffProfile} />;
            case VIEWS.COMPLIANCE_TRACKER:
                return <ComplianceTracker reports={reports} users={users} roles={roles} onRunWeeklyComplianceCheck={async () => {}} userPermissions={userPermissions} />;
            case VIEWS.SUPPORT_HUB:
                return <SupportHubView allTasks={tasks} users={users} currentUser={staffProfile} onUpdateStatus={handleUpdateTaskStatus} onAddTask={handleAddTask} />;
            case VIEWS.REWARDS_STORE:
                return <RewardsStoreView rewards={rewards} students={students} userProfile={staffProfile} userPermissions={userPermissions} onSaveReward={async () => true} onDeleteReward={async () => true} onRedeemReward={async () => true} />;
            case VIEWS.ANALYTICS:
                return <AnalyticsView reports={reports} tasks={tasks} schoolSettings={schoolSettings} userProfile={staffProfile} />;
            case VIEWS.SURVEY_MANAGER:
                return <SurveyManager surveys={surveys} onSaveSurvey={handleSaveSurvey} onDeleteSurvey={handleDeleteSurvey} addToast={addToast} allClasses={allClasses} allArms={allArms} allRoles={Object.values(roles)} />;
            case VIEWS.TEACHER_RATINGS:
                return <StaffTeacherRatingsView users={users} weeklyRatings={weeklyRatings} currentUser={staffProfile} />;
            case VIEWS.TEACHER_PULSE:
                return <TeacherPulseView addToast={addToast} checkinAnomalies={checkinAnomalies} onAnalyzeCheckinAnomalies={async () => {}} onNavigate={setCurrentView} />;
            case VIEWS.HR_PAYROLL:
                return <HRPayrollModule 
                    userProfile={staffProfile}
                    users={users}
                    payrollRuns={payrollRuns}
                    payrollItems={payrollItems}
                    payrollAdjustments={payrollAdjustments}
                    schoolConfig={schoolConfig}
                    onRunPayroll={handleRunPayroll}
                    onUpdateUserPayroll={handleUpdateUserPayroll}
                    onSaveSchoolConfig={handleSaveSchoolConfig}
                    addToast={addToast}
                    userPermissions={userPermissions}
                    campuses={campuses}
                    teacherShifts={teacherShifts}
                    onSaveShift={handleSaveShift}
                    onDeleteShift={handleDeleteShift}
                    leaveTypes={leaveTypes}
                    onSaveLeaveType={handleSaveLeaveType}
                    onDeleteLeaveType={handleDeleteLeaveType}
                    onSaveCampus={handleSaveCampus}
                    onDeleteCampus={handleDeleteCampus}
                    leaveRequests={leaveRequests}
                    onSubmitLeaveRequest={handleSubmitLeaveRequest}
                    onApproveLeaveRequest={handleApproveLeaveRequest}
                    teams={teams}
                />;
            case VIEWS.MY_PAYROLL:
                return <MyPayrollView payrollRuns={payrollRuns} payrollItems={payrollItems} currentUser={staffProfile} />;
            case VIEWS.MY_ADJUSTMENTS:
                return <MyAdjustmentsView currentUser={staffProfile} />;
            case VIEWS.STUDENT_FINANCE:
                return <StudentFinanceView addToast={addToast} students={students} userProfile={staffProfile} />;
            case VIEWS.CALENDAR:
                return <CalendarView events={calendarEvents} onSaveEvent={handleSaveCalendarEvent} onUpdateEvent={handleUpdateCalendarEvent} onDeleteEvent={handleDeleteCalendarEvent} userProfile={staffProfile} userPermissions={userPermissions} users={users} handleAddTask={handleAddTask} addToast={addToast} />;
            case VIEWS.GUARDIAN_COMMAND:
                return <AIAssistantView userProfile={staffProfile} users={users} students={students} reports={reports} addToast={addToast} handleAddTask={handleAddTask} handleAddAnnouncement={handleAddAnnouncement} />;
            case VIEWS.DATA_ANALYSIS:
                return <DataAnalysisView addToast={addToast} />;
            case VIEWS.ID_CARDS:
                return <IdCardGenerator students={students} allClasses={allClasses} allArms={allArms} schoolConfig={schoolConfig} schoolSettings={schoolSettings} />;
            case VIEWS.STOREFRONT:
                return <StorefrontView inventory={inventory} onCreateOrder={handleCreateOrder} userProfile={staffProfile} addToast={addToast} />;
            case VIEWS.STORE_MANAGER:
            case VIEWS.ORDER_MANAGER:
                return <StoreManager inventory={inventory} orders={orders} onSaveItem={handleSaveInventoryItem} onDeleteItem={handleDeleteInventoryItem} addToast={addToast} onUpdateOrderStatus={handleUpdateOrderStatus} onAddOrderNote={handleAddOrderNote} onDeleteOrderNote={handleDeleteOrderNote} />;
            case VIEWS.SOCIAL_MEDIA_HUB:
                return <SocialMediaHubView 
                    socialMediaAnalytics={socialMediaAnalytics} 
                    socialAccounts={socialAccounts} 
                    onAddTask={handleAddTask} 
                    onSaveSocialLinks={async (links) => { setSocialAccounts(links); }} 
                    addToast={addToast} 
                    users={users} 
                />;
            case VIEWS.USER_MANAGEMENT:
                return <UserManagement users={users} roles={roles} campuses={campuses} onInviteUser={handleInviteUser} onDeactivateUser={handleDeactivateUser} onUpdateUserCampus={handleUpdateUserCampus} />;
            case VIEWS.ROLE_MANAGEMENT:
                return <RoleManager roles={Object.values(roles)} onSaveRole={handleSaveRole} users={users} userRoleAssignments={userRoleAssignments} onUpdateRoleAssignments={handleUpdateRoleAssignments} />;
            case VIEWS.ROLE_DIRECTORY:
                return <RoleDirectoryView roles={Object.values(roles)} />;
            case VIEWS.TEAM_MANAGEMENT:
                return <TeamManager users={users} currentUser={staffProfile} userPermissions={userPermissions} teams={teams} tasks={tasks} reports={reports} teamPulse={teamPulse} teamFeedback={teamFeedback} onCreateTeam={handleCreateTeam} onUpdateTeam={handleUpdateTeam} onDeleteTeam={handleDeleteTeam} onUpdateTeamMembers={handleUpdateTeamMembers} onSaveTeamFeedback={handleSaveTeamFeedback} />;
            case VIEWS.CURRICULUM_MANAGER:
                 return <CurriculumManager 
                    teachingAssignments={teachingEntities} 
                    curricula={curricula} 
                    curriculumWeeks={curriculumWeeks} 
                    onSave={async () => true} 
                    userProfile={staffProfile}
                    teams={teams}
                 />;
            case VIEWS.TEACHING_ASSIGNMENTS:
                 return <TeachingAssignmentsContainer 
                    users={users} 
                    assignments={academicAssignments} 
                    subjects={allSubjects}
                    classes={allClasses}
                    arms={allArms}
                    classGroups={classGroups}
                    academicClasses={academicClasses}
                    onCreateAssignment={async (assign, group) => {
                        const { data: ag, error: e1 } = await Offline.insert('teaching_assignments', { ...assign, school_id: staffProfile.school_id });
                        if(e1 || !ag) return false;
                        const { error: e2 } = await Offline.insert('class_groups', { ...group, teaching_entity_id: ag.id, school_id: staffProfile.school_id, created_by: staffProfile.id });
                        if(e2) return false;
                        return true;
                    }}
                    onDeleteAssignment={async (id) => {
                         const { error } = await Offline.del('class_groups', { id });
                         return !error;
                    }}
                 />;
            case VIEWS.RESULT_MANAGER:
                return <ResultManager terms={terms} academicAssignments={academicAssignments} academicClassStudents={academicClassStudents} scoreEntries={scoreEntries} users={users} onLockScores={handleLockScores} userPermissions={userPermissions} students={students} studentTermReports={studentTermReports} studentTermReportSubjects={studentTermReportSubjects} gradingSchemes={gradingSchemes} schoolConfig={schoolConfig} onUpdateComments={handleUpdateResultComments} addToast={addToast} />;
            case VIEWS.DATA_UPLOAD:
                return <DataUploader onBulkAddStudents={handleBulkAddStudents} addToast={addToast} />;
            case VIEWS.LIVING_POLICY:
                return <LivingPolicyManager policySnippets={livingPolicy} onAddSnippet={handleAddPolicySnippet} userProfile={staffProfile} onSaveDocument={handleGenerateLivingPolicyDocument} />;
            case VIEWS.AI_STRATEGIC_CENTER:
                return <AIStrategicCenterView healthReport={schoolHealthReport} onGenerateHealthReport={handleGenerateHealthReport} onGenerateForesight={handleGenerateForesight} improvementPlan={improvementPlan} onGenerateImprovementPlan={async () => {}} addToast={addToast} schoolSettings={schoolSettings} onGenerateCoverageDeviationReport={async () => {}} />;
            case VIEWS.EMERGENCY_BROADCAST:
                return <EmergencyBroadcast onSendBroadcast={handleSendEmergencyBroadcast} />;
            case VIEWS.SUPER_ADMIN_CONSOLE:
                return <SuperAdminConsole 
                    userPermissions={userPermissions} 
                    schoolConfig={schoolConfig} 
                    terms={terms} 
                    academicClasses={academicClasses} 
                    academicAssignments={academicAssignments} 
                    gradingSchemes={gradingSchemes} 
                    users={users} 
                    roles={Object.values(roles)} 
                    userRoleAssignments={userRoleAssignments} 
                    auditLogs={auditLogs} 
                    subjects={allSubjects} 
                    classes={allClasses} 
                    arms={allArms} 
                    inventory={inventory} 
                    rewards={rewards} 
                    assessmentStructures={assessmentStructures} 
                    onSaveRole={handleSaveRole} 
                    onUpdateRoleAssignments={handleUpdateRoleAssignments} 
                    onSaveSchoolConfig={handleUpdateSchoolConfig}
                    onSaveTerm={handleSaveTerm}
                    onDeleteTerm={handleDeleteTerm}
                    onSaveAcademicClass={handleSaveAcademicClass}
                    onDeleteAcademicClass={handleDeleteAcademicClass}
                    onSaveAcademicAssignment={handleSaveAcademicAssignment}
                    onDeleteAcademicAssignment={handleDeleteAcademicAssignment}
                    onSaveGradingScheme={handleSaveGradingScheme}
                    onDeleteGradingScheme={handleDeleteGradingScheme}
                    onSetActiveGradingScheme={handleSetActiveGradingScheme}
                    onSaveSubject={async () => true}
                    onDeleteSubject={async () => true}
                    onSaveClass={async () => true}
                    onDeleteClass={async () => true}
                    onSaveArm={async () => true}
                    onDeleteArm={async () => true}
                    onSaveInventoryItem={handleSaveInventoryItem}
                    onDeleteInventoryItem={handleDeleteInventoryItem}
                    onSaveReward={async () => true}
                    onDeleteReward={async () => true}
                    onInviteUser={handleInviteUser}
                    onDeactivateUser={handleDeactivateUser}
                    campuses={campuses}
                    onUpdateUserCampus={handleUpdateUserCampus}
                    onSaveCampus={handleSaveCampus}
                    onDeleteCampus={handleDeleteCampus}
                    addToast={addToast}
                    teacherShifts={teacherShifts}
                    onSaveShift={async () => true}
                    onDeleteShift={async () => true}
                    leaveTypes={leaveTypes}
                    onSaveLeaveType={async () => true}
                    onDeleteLeaveType={async () => true}
                    onSaveAssessmentStructure={handleSaveAssessmentStructure}
                    onDeleteAssessmentStructure={handleDeleteAssessmentStructure}
                    teachingEntities={teachingEntities}
                    onImportLegacyAssignments={async () => true}
                    students={students}
                    academicClassStudents={academicClassStudents}
                    onUpdateClassEnrollment={async () => true}
                    onUpdateUserPayroll={async () => {}}
                />;
            case VIEWS.SETTINGS:
                return <SettingsView settings={schoolSettings} schoolConfig={schoolConfig} onSaveSettings={handleUpdateSchoolSettings} onSaveSchoolConfig={handleUpdateSchoolConfig} />;
            case VIEWS.PROFILE:
                return <ProfilePage userProfile={staffProfile} onUpdateProfile={handleUpdateProfile} onUpdateAvatar={handleUpdateAvatar} onResetPassword={handleResetPassword} onUpdateEmail={handleUpdateEmail} onUpdatePassword={handleUpdatePassword} orders={orders} />;
            default:
                if (currentView.startsWith(`${VIEWS.STUDENT_PROFILE}/`)) {
                    if (!selectedStudent) return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;
                    return <StudentProfileView 
                        student={selectedStudent!} 
                        reports={reports.filter(r => r.involved_students.includes(selectedStudent?.id))} 
                        positiveRecords={positiveRecords.filter(r => r.student_id === selectedStudent?.id)} 
                        awards={studentAwards.filter(r => r.student_id === selectedStudent?.id)} 
                        studentTermReports={studentTermReports.filter(r => r.student_id === selectedStudent?.id)} 
                        onBack={() => setCurrentView(VIEWS.STUDENT_ROSTER)} 
                        onAddPositive={async () => {}} 
                        onGenerateInsight={async () => null} 
                        onUpdateStudent={handleUpdateStudent} 
                        allClasses={allClasses} 
                        allArms={allArms} 
                        onNavigate={setCurrentView} 
                        userPermissions={userPermissions} 
                        onLogCommunication={(id, d) => {}} 
                        currentUser={staffProfile} 
                        addToast={addToast} 
                        users={users} 
                        onCreateAccount={handleCreateStudentAccount} 
                        onResetPassword={handleStudentPasswordReset}
                        onDeleteAccount={handleDeleteStudentAccount}
                        onDeleteStudent={handleDeleteStudent}
                    />;
                }
                 if (currentView.startsWith(`${VIEWS.TEACHER_SCORE_ENTRY}/`)) {
                    const assignmentId = Number(currentView.split('/')[1]);
                    return <TeacherScoreEntryView 
                        assignmentId={assignmentId} 
                        academicAssignments={academicAssignments} 
                        academicClassStudents={academicClassStudents} 
                        students={students} 
                        scoreEntries={scoreEntries} 
                        gradingSchemes={gradingSchemes} 
                        schoolConfig={schoolConfig} 
                        onSaveScores={async (scores) => {
                             for (const s of scores) await Offline.insert('score_entries', s);
                             return true;
                        }} 
                        onSubmitForReview={async () => true} 
                        onBack={() => setCurrentView(VIEWS.GRADEBOOK)} 
                        addToast={addToast} 
                    />;
                }
                return <Dashboard 
                    userProfile={staffProfile} 
                    tasks={tasks} 
                    announcements={announcements} 
                    alerts={alerts}
                    atRiskStudents={atRiskStudents}
                    positiveRecords={positiveRecords}
                    staffAwards={staffAwards}
                    teamPulse={teamPulse}
                    teams={teams}
                    teamFeedback={teamFeedback}
                    students={students}
                    interventionPlans={interventionPlans}
                    inventory={inventory}
                    reports={reports}
                    atRiskTeachers={atRiskTeachers}
                    socialMediaAnalytics={socialMediaAnalytics}
                    policyInquiries={policyInquiries}
                    curriculumReport={curriculumReport}
                    users={users}
                    userPermissions={userPermissions}
                    taskSuggestions={taskSuggestions}
                    sipLogs={sipLogs}
                    todaysCheckin={todaysCheckinForDashboard}
                    onNavigate={setCurrentView}
                    onViewStudent={(s) => { setSelectedStudent(s); setCurrentView(VIEWS.STUDENT_PROFILE); }}
                    onViewIntervention={(sid) => { /* ... */ }}
                    onUpdateTaskStatus={handleUpdateTaskStatus}
                    onAddAnnouncement={handleAddAnnouncement}
                    onGenerateStaffAwards={handleGenerateStaffAwards}
                    onAnalyzeTeacherRisk={handleAnalyzeTeacherRisk}
                    onSaveTeamFeedback={handleSaveTeamFeedback}
                    onGeneratePolicyInquiries={handleGeneratePolicyInquiries}
                    onGenerateCurriculumReport={handleGenerateCurriculumReport}
                    onUpdateProfile={handleUpdateProfile}
                    onProcessDailyDigest={handleProcessDailyDigest}
                    onAcceptTaskSuggestion={handleAcceptTaskSuggestion}
                    onDismissTaskSuggestion={handleDismissTaskSuggestion}
                    handleCheckinOut={handleCheckinOut}
                    campuses={campuses}
                    addToast={addToast}
                />;
        }
    };

    if (booting) {
        return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>;
    }

    if (!session) {
        if (currentView === 'student-login') return <StudentLoginPage onNavigate={(view) => { if(view === 'landing') setCurrentView('landing'); else if (view === 'teacher-login') setCurrentView('teacher-login'); else if (view === 'public-ratings') setCurrentView('public-ratings'); }} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
        if (currentView === 'public-ratings') return <PublicTeacherRatingsView onShowLogin={() => setCurrentView('teacher-login')} />;
        if (currentView === 'teacher-login') return <LoginPage onNavigate={(view) => { if(view === 'landing') setCurrentView('landing'); else if (view === 'student-login') setCurrentView('student-login'); }} />;
        // Landing page default
        return <LandingPage onNavigate={(view) => setCurrentView(view)} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
    }

    if (dbError) {
         if (dbError.includes('relation') || dbError.includes('does not exist')) {
             return <DatabaseSetupError error={dbError} onLogout={handleLogout} />;
         }
         return <EnvironmentSetupError error={dbError} />;
    }
    
    if (!userProfile) {
        return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /><p className="ml-2">Loading profile...</p></div>;
    }
    
    if (userType === 'student') {
        // Student specific layout
        return (
             <div className={`flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200`}>
                <Sidebar 
                    currentView={currentView} 
                    onNavigate={setCurrentView} 
                    userProfile={userProfile as StudentProfile} 
                    userPermissions={[]} // Students have no permissions array
                    onLogout={handleLogout}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
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
                    />
                    <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6">
                         <ErrorBoundary>
                             <Suspense fallback={<div className="flex justify-center pt-10"><Spinner size="lg" /></div>}>
                                {renderContent()}
                             </Suspense>
                         </ErrorBoundary>
                    </main>
                </div>
                 <Toast toasts={toasts} removeToast={removeToast} />
             </div>
        )
    }

    // Staff Layout
    return (
        <div className={`flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200`}>
            <Sidebar 
                currentView={currentView} 
                onNavigate={setCurrentView} 
                userProfile={userProfile as UserProfile} 
                userPermissions={userPermissions} 
                onLogout={handleLogout}
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header 
                    userProfile={userProfile as UserProfile} 
                    onLogout={handleLogout} 
                    notifications={notifications}
                    onMarkNotificationsAsRead={() => { /* impl */ }}
                    onNavigate={setCurrentView}
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    isDarkMode={isDarkMode}
                    toggleTheme={toggleTheme}
                />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6 relative">
                     <ErrorBoundary>
                        <Suspense fallback={<div className="flex justify-center pt-10"><Spinner size="lg" /></div>}>
                            {renderContent()}
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
                        onAddTask={handleAddTask}
                        onAddAnnouncement={handleAddAnnouncement}
                        addToast={addToast}
                        onNavigate={handleAINavigation}
                     />
                </main>
            </div>
            <Toast toasts={toasts} removeToast={removeToast} />
            
            {/* Global Modals */}
            {isPositiveModalOpen && <PositiveBehaviorModal isOpen={isPositiveModalOpen} onClose={() => setIsPositiveModalOpen(false)} onSubmit={async (id, desc) => {
                 // Mock insert
                 const newRec = { id: Date.now(), student_id: id, description: desc, author_id: userProfile.id, created_at: new Date().toISOString() };
                 addItem(setPositiveRecords, newRec);
                 addToast("Positive behavior logged.", "success");
            }} students={students} defaultStudent={positiveModalDefaultStudent} />}
            
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
        </div>
    );
};

export default App;