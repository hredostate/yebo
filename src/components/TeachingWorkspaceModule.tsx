import React, { useState, useMemo, lazy, Suspense } from 'react';
import type { 
    UserProfile, 
    TeachingAssignment, 
    LessonPlan, 
    ClassGroup, 
    StudentProfile,
    AcademicClass,
    Subject 
} from '../types';
import { 
    ChartBarIcon, UsersIcon, DocumentTextIcon, ClipboardIcon, FolderIcon, 
    CheckCircleIcon, EditIcon, MapIcon, ClockIcon, BookOpenIcon, ClipboardListIcon
} from './common/icons';
import Spinner from './common/Spinner';

// Lazy load sub-components to break circular dependencies
const TeacherPulseView = lazy(() => import('./TeacherPulseView'));
const CurriculumPlannerView = lazy(() => import('./CurriculumPlannerView'));
const CoverageAnalyticsDashboard = lazy(() => import('./CoverageAnalyticsDashboard'));
const HomeworkManager = lazy(() => import('./HomeworkManager'));
const LearningMaterialsManager = lazy(() => import('./LearningMaterialsManager'));
const NotesComplianceView = lazy(() => import('./NotesComplianceTracker'));
const TeacherGradebookView = lazy(() => import('./TeacherGradebookView'));
const AssessmentManager = lazy(() => import('./AssessmentManager'));
const ClassAttendanceManager = lazy(() => import('./ClassGroupManager'));
const CurriculumManager = lazy(() => import('./CurriculumManager'));
const TeachingAssignmentsContainer = lazy(() => import('./TeachingAssignmentsContainer'));

type ModuleSection = 
    | 'overview' 
    | 'teacher_pulse' 
    | 'lesson_plans' 
    | 'coverage_analytics' 
    | 'homework_manager' 
    | 'learning_materials' 
    | 'notes_compliance' 
    | 'gradebook' 
    | 'assessments' 
    | 'class_groups' 
    | 'curriculum_map' 
    | 'workload_analysis';

interface TeachingWorkspaceModuleProps {
    userProfile: UserProfile;
    users: UserProfile[];
    students: StudentProfile[];
    teachingAssignments: TeachingAssignment[];
    lessonPlans: LessonPlan[];
    classGroups: ClassGroup[];
    allClasses: AcademicClass[];
    allArms: { id: number; name: string; class_id: number }[];
    allSubjects: Subject[];
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    userPermissions: string[];
    onUpdateClassGroupMembers: (groupId: number, studentIds: number[]) => Promise<boolean>;
    onSaveAttendanceSchedule: (schedule: any) => Promise<boolean>;
    onDeleteAttendanceSchedule: (scheduleId: number) => Promise<boolean>;
    onSaveAttendanceRecord: (record: any) => Promise<boolean>;
    onCreateClassAssignment: (assignment: any) => Promise<boolean>;
    onDeleteClassAssignment: (assignmentId: number) => Promise<boolean>;
    // Props for sub-components
    checkinAnomalies?: any[];
    onAnalyzeCheckinAnomalies?: () => Promise<void>;
    onNavigate?: (view: string) => void;
    teams?: any[];
    onSaveLessonPlan?: (plan: any, generateWithAi: boolean, file: File | null) => Promise<any>;
    onAnalyzeLessonPlan?: (planId: number) => Promise<any>;
    onCopyLessonPlan?: (sourcePlan: any, targetEntityIds: number[]) => Promise<boolean>;
    curricula?: any[];
    curriculumWeeks?: any[];
    onApprove?: (plan: any) => Promise<void>;
    onSubmitForReview?: (plan: any) => Promise<void>;
    coverageData?: any[];
}

const TeachingWorkspaceModule: React.FC<TeachingWorkspaceModuleProps> = ({
    userProfile,
    users,
    students,
    teachingAssignments,
    lessonPlans,
    classGroups,
    allClasses,
    allArms,
    allSubjects,
    addToast,
    userPermissions,
    onUpdateClassGroupMembers,
    onSaveAttendanceSchedule,
    onDeleteAttendanceSchedule,
    onSaveAttendanceRecord,
    onCreateClassAssignment,
    onDeleteClassAssignment,
    // Sub-component props with safe defaults
    checkinAnomalies = [],
    onAnalyzeCheckinAnomalies = async () => {},
    onNavigate = () => {},
    teams = [],
    onSaveLessonPlan,
    onAnalyzeLessonPlan,
    onCopyLessonPlan,
    curricula = [],
    curriculumWeeks = [],
    onApprove,
    onSubmitForReview,
    coverageData = [],
}) => {
    // Safe defaults for permissions
    const safeUserPermissions = Array.isArray(userPermissions) ? userPermissions : [];
    const safeUsers = Array.isArray(users) ? users : [];
    const safeStudents = Array.isArray(students) ? students : [];
    const safeTeachingAssignments = Array.isArray(teachingAssignments) ? teachingAssignments : [];
    const safeLessonPlans = Array.isArray(lessonPlans) ? lessonPlans : [];
    const safeClassGroups = Array.isArray(classGroups) ? classGroups : [];

    // Permission checks
    const canManageCurriculum = safeUserPermissions.includes('manage-curriculum') || safeUserPermissions.includes('*');
    const canViewMyLessonPlans = safeUserPermissions.includes('view-my-lesson-plans') || safeUserPermissions.includes('*');
    const canEditScores = safeUserPermissions.includes('score_entries.edit_self') || safeUserPermissions.includes('*');
    const canManageClassGroups = safeUserPermissions.includes('manage-class-groups') || safeUserPermissions.includes('*');
    const canTakeAttendance = safeUserPermissions.includes('take-class-attendance') || safeUserPermissions.includes('*');
    const isAdminOrTeamLead = ['Admin', 'Team Lead', 'Principal'].includes(userProfile.role);

    const [activeSection, setActiveSection] = useState<ModuleSection>(
        canViewMyLessonPlans || canManageCurriculum ? 'overview' : 'gradebook'
    );

    // Calculate overview stats
    const stats = useMemo(() => {
        const myLessonPlans = safeLessonPlans.filter(lp => lp.teacher_id === userProfile.id);
        const totalLessonPlans = myLessonPlans.length;
        const approvedPlans = myLessonPlans.filter(lp => lp.status === 'Approved').length;
        const pendingReview = myLessonPlans.filter(lp => lp.status === 'Pending').length;
        const coverageRate = totalLessonPlans > 0 
            ? Math.round((approvedPlans / totalLessonPlans) * 100) 
            : 0;

        return { totalLessonPlans, approvedPlans, pendingReview, coverageRate };
    }, [safeLessonPlans, userProfile.id]);

    // Navigation sections with permission checks
    const navSections = [
        { 
            id: 'overview' as const, 
            label: 'Overview', 
            icon: ChartBarIcon, 
            show: true 
        },
        { 
            id: 'teacher_pulse' as const, 
            label: 'Teacher Pulse', 
            icon: UsersIcon, 
            show: isAdminOrTeamLead,
            divider: true
        },
        { 
            id: 'lesson_plans' as const, 
            label: 'Lesson Plans', 
            icon: DocumentTextIcon, 
            show: canViewMyLessonPlans || canManageCurriculum 
        },
        { 
            id: 'coverage_analytics' as const, 
            label: 'Coverage Analytics', 
            icon: ChartBarIcon, 
            show: canManageCurriculum 
        },
        { 
            id: 'homework_manager' as const, 
            label: 'Homework Manager', 
            icon: ClipboardIcon, 
            show: canViewMyLessonPlans || canManageCurriculum 
        },
        { 
            id: 'learning_materials' as const, 
            label: 'Learning Materials', 
            icon: FolderIcon, 
            show: canViewMyLessonPlans || canManageCurriculum 
        },
        { 
            id: 'notes_compliance' as const, 
            label: 'Notes Compliance', 
            icon: CheckCircleIcon, 
            show: canManageCurriculum,
            divider: true
        },
        { 
            id: 'gradebook' as const, 
            label: 'My Gradebook', 
            icon: EditIcon, 
            show: canEditScores 
        },
        { 
            id: 'assessments' as const, 
            label: 'Assessments', 
            icon: ClipboardListIcon, 
            show: canEditScores 
        },
        { 
            id: 'class_groups' as const, 
            label: 'Class Groups', 
            icon: UsersIcon, 
            show: canManageClassGroups || canTakeAttendance,
            divider: true
        },
        { 
            id: 'curriculum_map' as const, 
            label: 'Curriculum Map', 
            icon: MapIcon, 
            show: canViewMyLessonPlans || canManageCurriculum 
        },
        { 
            id: 'workload_analysis' as const, 
            label: 'Workload Analysis', 
            icon: ClockIcon, 
            show: canManageCurriculum 
        },
    ];

    const renderContent = () => {
        switch (activeSection) {
            case 'overview':
                return (
                    <div className="space-y-6">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-blue-100 text-sm">Total Lesson Plans</p>
                                        <p className="text-3xl font-bold mt-1">{stats.totalLessonPlans}</p>
                                    </div>
                                    <DocumentTextIcon className="w-8 h-8 text-blue-200" />
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-green-100 text-sm">Approved Plans</p>
                                        <p className="text-3xl font-bold mt-1">{stats.approvedPlans}</p>
                                    </div>
                                    <CheckCircleIcon className="w-8 h-8 text-green-200" />
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-5 text-white">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-amber-100 text-sm">Pending Review</p>
                                        <p className="text-3xl font-bold mt-1">{stats.pendingReview}</p>
                                    </div>
                                    <ClockIcon className="w-8 h-8 text-amber-200" />
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-5 text-white">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-purple-100 text-sm">Coverage Rate</p>
                                        <p className="text-3xl font-bold mt-1">{stats.coverageRate}%</p>
                                    </div>
                                    <ChartBarIcon className="w-8 h-8 text-purple-200" />
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions Panel */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <BookOpenIcon className="w-5 h-5 text-blue-500" />
                                Quick Actions
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {(canViewMyLessonPlans || canManageCurriculum) && (
                                    <button
                                        onClick={() => setActiveSection('lesson_plans')}
                                        className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium"
                                    >
                                        Create Lesson Plan
                                    </button>
                                )}
                                {canEditScores && (
                                    <button
                                        onClick={() => setActiveSection('gradebook')}
                                        className="px-4 py-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-sm font-medium"
                                    >
                                        Enter Scores
                                    </button>
                                )}
                                {(canManageClassGroups || canTakeAttendance) && (
                                    <button
                                        onClick={() => setActiveSection('class_groups')}
                                        className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-sm font-medium"
                                    >
                                        Take Attendance
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* My Teaching Assignments */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <UsersIcon className="w-5 h-5 text-indigo-500" />
                                    My Teaching Assignments
                                </h3>
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {safeTeachingAssignments
                                        .filter(ta => ta.teacher_id === userProfile.id)
                                        .slice(0, 5)
                                        .map(assignment => (
                                            <div key={assignment.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <div>
                                                    <p className="font-medium">{assignment.subject_name || 'Subject'}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {assignment.class_name} {assignment.arm_name || ''}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    {safeTeachingAssignments.filter(ta => ta.teacher_id === userProfile.id).length === 0 && (
                                        <p className="text-slate-500 text-sm text-center py-4">No teaching assignments found</p>
                                    )}
                                </div>
                            </div>

                            {/* Recent Lesson Plans */}
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <DocumentTextIcon className="w-5 h-5 text-green-500" />
                                    Recent Lesson Plans
                                </h3>
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {safeLessonPlans
                                        .filter(lp => lp.teacher_id === userProfile.id)
                                        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                                        .slice(0, 5)
                                        .map(plan => (
                                            <div key={plan.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{plan.topic || 'Lesson Plan'}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {plan.subject_name || 'Subject'} • {plan.status || 'Draft'}
                                                    </p>
                                                </div>
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    plan.status === 'Approved' 
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : plan.status === 'Pending'
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                    {plan.status || 'Draft'}
                                                </span>
                                            </div>
                                        ))}
                                    {safeLessonPlans.filter(lp => lp.teacher_id === userProfile.id).length === 0 && (
                                        <p className="text-slate-500 text-sm text-center py-4">No lesson plans found</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'teacher_pulse':
                return <TeacherPulseView 
                    addToast={(msg, type) => addToast(msg, type)}
                    checkinAnomalies={checkinAnomalies}
                    onAnalyzeCheckinAnomalies={onAnalyzeCheckinAnomalies}
                    onNavigate={onNavigate}
                />;

            case 'lesson_plans':
                return <CurriculumPlannerView 
                    teams={teams}
                    lessonPlans={safeLessonPlans}
                    userProfile={userProfile}
                    onSaveLessonPlan={onSaveLessonPlan || (async () => null)}
                    onAnalyzeLessonPlan={onAnalyzeLessonPlan || (async () => null)}
                    teachingAssignments={safeTeachingAssignments}
                    onCopyLessonPlan={onCopyLessonPlan || (async () => false)}
                    curricula={curricula}
                    curriculumWeeks={curriculumWeeks}
                    onApprove={onApprove || (async () => {})}
                    onSubmitForReview={onSubmitForReview}
                />;

            case 'coverage_analytics':
                return <CoverageAnalyticsDashboard 
                    schoolId={userProfile.school_id}
                    lessonPlans={safeLessonPlans}
                    coverageData={coverageData}
                    addToast={(msg) => addToast(msg.message, msg.type)}
                />;

            case 'homework_manager':
                return <HomeworkManager 
                    userProfile={userProfile}
                    teachingAssignments={safeTeachingAssignments}
                    onNavigate={onNavigate}
                />;

            case 'learning_materials':
                return <LearningMaterialsManager />;

            case 'notes_compliance':
                return <NotesComplianceView />;

            case 'gradebook':
                return <TeacherGradebookView />;

            case 'assessments':
                return <AssessmentManager />;

            case 'class_groups':
                return <ClassAttendanceManager 
                    classGroups={safeClassGroups}
                    students={safeStudents}
                    currentUser={userProfile}
                    onUpdateMembers={onUpdateClassGroupMembers}
                    onSaveSchedule={onSaveAttendanceSchedule}
                    onDeleteSchedule={onDeleteAttendanceSchedule}
                    onSaveRecord={onSaveAttendanceRecord}
                    onCreateClassAssignment={onCreateClassAssignment}
                    onDeleteClassAssignment={onDeleteClassAssignment}
                    users={safeUsers}
                    subjects={allSubjects}
                    classes={allClasses}
                    arms={allArms}
                    userPermissions={safeUserPermissions}
                />;

            case 'curriculum_map':
                return <CurriculumManager />;

            case 'workload_analysis':
                return <TeachingAssignmentsContainer />;

            default:
                return (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-slate-500">Select a section to view</p>
                    </div>
                );
        }
    };

    return (
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <BookOpenIcon className="w-8 h-8 text-blue-500" />
                        Teaching Workspace
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Manage your teaching activities and resources
                    </p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar Navigation */}
                <nav className="lg:w-56 flex-shrink-0">
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-2 space-y-1 sticky top-4">
                        {navSections.filter(s => s.show).map((section, idx, arr) => {
                            const showDivider = section.divider && idx > 0;
                            return (
                                <React.Fragment key={section.id}>
                                    {showDivider && <hr className="my-2 border-slate-200 dark:border-slate-700" />}
                                    <button
                                        onClick={() => setActiveSection(section.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                            activeSection === section.id
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <section.icon className="w-4 h-4" />
                                        {section.label}
                                    </button>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </nav>

                {/* Main Content with Error Boundary */}
                <main className="flex-1 min-w-0">
                    <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6 shadow-xl min-h-[60vh]">
                        <ErrorBoundary>
                            <Suspense fallback={<div className="flex justify-center items-center py-12"><Spinner size="lg" /></div>}>
                                {renderContent()}
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                </main>
            </div>
        </div>
    );
};

// Simple Error Boundary Component for Teaching Workspace Module
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; errorMessage?: string }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        // Log full error for debugging but sanitize what we store
        console.error('Error caught by Teaching Workspace boundary:', error);
        
        // In production, never expose error details
        // In development, sanitize the message to remove potential sensitive data
        const safeMessage = process.env.NODE_ENV === 'development' 
            ? (error.message || 'An unexpected error occurred').replace(/token|password|secret|key|auth/gi, '[REDACTED]')
            : 'An unexpected error occurred';
        return { hasError: true, errorMessage: safeMessage };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Teaching Workspace Module Error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="text-red-500 text-6xl">⚠️</div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Something went wrong
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">
                        An error occurred while loading this section. Please try refreshing the page or contact support if the problem persists.
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, errorMessage: undefined })}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                    {process.env.NODE_ENV === 'development' && this.state.errorMessage && (
                        <details className="mt-4 text-xs text-slate-500 max-w-md">
                            <summary className="cursor-pointer">Error details (dev only)</summary>
                            <pre className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded overflow-auto">
                                {this.state.errorMessage}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default TeachingWorkspaceModule;
