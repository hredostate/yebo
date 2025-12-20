
import React, { useState, useMemo, useEffect, lazy } from 'react';
import type { UserProfile, Task, Announcement, Alert, AtRiskStudent, PositiveBehaviorRecord, StaffAward, TeamPulse, TeamFeedback, Team, Student, StudentInterventionPlan, InventoryItem, ReportRecord, AtRiskTeacher, SocialMediaAnalytics, PolicyInquiry, CurriculumReport, SuggestedTask, SIPLog, TeacherCheckin, Campus, TeacherMood } from '../types';
import { VIEWS } from '../constants';
import { ALL_WIDGETS } from '../dashboardWidgets';
import MyTasksWidget from './widgets/MyTasksWidget';
import AnnouncementsWidget from './widgets/AnnouncementsWidget';
import AlertsWidget from './widgets/AlertsWidget';
import AtRiskStudentsWidget from './widgets/AtRiskStudentsWidget';
import DailyReportStatusWidget from './widgets/DailyReportStatusWidget';
import PositiveTrendsWidget from './widgets/PositiveTrendsWidget';
import KudosWidget from './widgets/KudosWidget';
import TeamPulseSummary from './TeamPulseSummary';
import CounselorCaseloadWidget from './widgets/CounselorCaseloadWidget';
import InventoryWidget from './widgets/InventoryWidget';
import PreventativeMaintenanceWidget from './widgets/PreventativeMaintenanceWidget';
import StudentRecordsWidget from './widgets/StudentRecordsWidget';
import SIPWidget from './widgets/SIPWidget';
import AtRiskTeachersWidget from './widgets/AtRiskTeachersWidget';
import SocialMediaSummaryWidget from './widgets/SocialMediaSummaryWidget';
import PolicyInquiryWidget from './widgets/PolicyInquiryWidget';
import RequiredManualsBanner from './manuals/user/RequiredManualsBanner';
import CurriculumReportWidget from './widgets/CurriculumReportWidget';
import CustomizeDashboardModal from './CustomizeDashboardModal';
import { CogIcon } from './common/icons';
import DailyBriefing from './DailyBriefing';
import SmsWalletCard from './widgets/SmsWalletCard';
import { VIEWS } from '../constants';
import CheckinWidget from './widgets/CheckinWidget';
import Spinner from './common/Spinner';

const TaskSuggestionsWidget = lazy(() => import('./widgets/TaskSuggestionsWidget'));

// Error boundary for individual widgets
class WidgetErrorBoundary extends React.Component<
    {children: React.ReactNode, widgetId: string},
    {hasError: boolean, error: Error | null}
> {
    constructor(props: {children: React.ReactNode, widgetId: string}) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error(`[Dashboard] Widget ${this.props.widgetId} error:`, error, errorInfo);
    }
    
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 text-center text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="font-semibold">Widget Error</p>
                    <p className="text-sm">Failed to load: {this.props.widgetId}</p>
                </div>
            );
        }
        
        return (
            <React.Suspense fallback={<div className="p-4 text-center"><Spinner /></div>}>
                {this.props.children}
            </React.Suspense>
        );
    }
}


interface DashboardProps {
  userProfile: UserProfile;
  tasks: Task[];
  announcements: Announcement[];
  alerts: Alert[];
  atRiskStudents: AtRiskStudent[];
  positiveRecords: PositiveBehaviorRecord[];
  staffAwards: StaffAward[];
  teamPulse: TeamPulse[];
  teams: Team[];
  teamFeedback: TeamFeedback[];
  students: Student[];
  interventionPlans: StudentInterventionPlan[];
  inventory: InventoryItem[];
  reports: ReportRecord[];
  atRiskTeachers: AtRiskTeacher[];
  socialMediaAnalytics: SocialMediaAnalytics[];
  policyInquiries: PolicyInquiry[];
  curriculumReport: CurriculumReport | null;
  users: UserProfile[];
  userPermissions: string[];
  taskSuggestions: SuggestedTask[];
  areFallbackSuggestions?: boolean;
  sipLogs: SIPLog[];
  todaysCheckin: TeacherCheckin | null | undefined;
  onNavigate: (view: string) => void;
  onViewStudent: (student: Student) => void;
  onViewIntervention: (studentId: number) => void;
  onUpdateTaskStatus: (taskId: number, status: any) => Promise<void>;
  onAddAnnouncement: (title: string, content: string) => Promise<void>;
  onGenerateStaffAwards: () => Promise<void>;
  onAnalyzeTeacherRisk: () => Promise<void>;
  onSaveTeamFeedback: (teamId: number, rating: number, comments: string | null) => Promise<boolean>;
  onGeneratePolicyInquiries: () => Promise<void>;
  onGenerateCurriculumReport: () => Promise<void>;
  onUpdateProfile: (data: Partial<UserProfile>) => Promise<boolean>;
  onProcessDailyDigest: () => Promise<any | null>;
  onAcceptTaskSuggestion: (suggestion: SuggestedTask, assigneeId: string) => void;
  onDismissTaskSuggestion: (suggestionId: string) => void;
  handleCheckinOut: (notes?: string | null, isRemote?: boolean, location?: { lat: number; lng: number } | null, photoUrl?: string | null, mood?: TeacherMood | null) => Promise<boolean>;
  campuses: Campus[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const Dashboard: React.FC<DashboardProps> = (props) => {
    const { userProfile, onNavigate, onViewStudent, taskSuggestions, areFallbackSuggestions, onAcceptTaskSuggestion, onDismissTaskSuggestion, users, onViewIntervention, sipLogs, todaysCheckin, handleCheckinOut, campuses, addToast } = props;
    const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
    
    // Helper function to check if user has permission
    const hasPermission = (permission: string) => {
        return props.userPermissions.includes('*') || props.userPermissions.includes(permission);
    };
    
    const userWidgetConfig = useMemo(() => {
        let config: string[] = [];
        if (userProfile.dashboard_config && userProfile.dashboard_config.length > 0) {
            config = userProfile.dashboard_config;
        } else {
            // Role-specific defaults if config is empty
            switch (userProfile.role) {
                case 'Team Lead':
                    config = ['daily-briefing', 'my-tasks', 'daily-report-status', 'team-pulse', 'at-risk-students', 'announcements', 'alerts'];
                    break;
                case 'Principal':
                    config = ['daily-briefing', 'team-pulse', 'at-risk-students', 'at-risk-teachers', 'alerts', 'policy-inquiry', 'curriculum-report'];
                    break;
                case 'Admin':
                    config = ['daily-briefing', 'sms-wallet', 'student-records', 'inventory', 'team-pulse', 'at-risk-teachers', 'alerts'];
                    break;
                case 'Accountant':
                    config = ['sms-wallet', 'student-records', 'inventory', 'announcements'];
                    break;
                case 'Counselor':
                    config = ['counselor-caseload', 'sip-status', 'my-tasks', 'at-risk-students', 'announcements'];
                    break;
                case 'Teacher':
                    config = ['my-tasks', 'daily-report-status', 'announcements', 'alerts', 'inventory'];
                    break;
                case 'Maintenance':
                    config = ['maintenance-schedule', 'inventory', 'my-tasks', 'announcements'];
                    break;
                default:
                    config = ['my-tasks', 'daily-report-status', 'announcements', 'alerts'];
            }
        }
        
        // Filter out widgets the user doesn't have permission to see
        // Use the widget definitions to get the required permission for each widget
        config = config.filter(widgetId => {
            const widgetDef = ALL_WIDGETS.find(w => w.id === widgetId);
            if (!widgetDef) return true; // Keep widget if not found in definitions (shouldn't happen)
            return hasPermission(widgetDef.requiredPermission);
        });
        
        return config;
    }, [userProfile.dashboard_config, userProfile.role, props.userPermissions]);

    // Debug logging to help diagnose blank dashboard issues
    useEffect(() => {
        console.log('[Dashboard] Widget config:', {
            userConfig: userProfile.dashboard_config,
            computedConfig: userWidgetConfig,
            userPermissions: props.userPermissions?.length || 0,
        });
    }, [userWidgetConfig, userProfile.dashboard_config, props.userPermissions]);

    // Ensure we always have some widgets - safety fallback
    const safeWidgetConfig = useMemo(() => {
        if (userWidgetConfig.length === 0) {
            console.warn('[Dashboard] No widgets in config, using fallback');
            return ['my-tasks', 'announcements', 'alerts'];
        }
        return userWidgetConfig;
    }, [userWidgetConfig]);

    const [widgetConfig, setWidgetConfig] = useState<string[]>(safeWidgetConfig);
    
    // Sync widgetConfig when user profile changes (but not when manually customized)
    useEffect(() => {
        setWidgetConfig(safeWidgetConfig);
    }, [safeWidgetConfig]);

    const availableWidgets = useMemo(() => {
        const permissions = new Set(props.userPermissions);
        const isAllPowerful = permissions.has('*');
        return ALL_WIDGETS.filter(w => isAllPowerful || permissions.has(w.requiredPermission));
    }, [props.userPermissions]);

    const openTasks = props.tasks.filter(task => (task as any).status !== 'Completed').length;
    const summaryStats = [
        { label: 'Open tasks', value: openTasks, hint: 'Across your assignments' },
        { label: 'Active alerts', value: props.alerts.length, hint: 'Items needing attention' },
        { label: 'Announcements', value: props.announcements.length, hint: 'Latest staff updates' },
    ];
    
    const handleSaveConfig = async (newConfig: string[]) => {
        setWidgetConfig(newConfig);
        await props.onUpdateProfile({ dashboard_config: newConfig });
    };

    const renderWidget = (widgetId: string) => {
        try {
            switch (widgetId) {
                case 'my-tasks':
                    return <MyTasksWidget tasks={props.tasks || []} userProfile={userProfile} onUpdateStatus={props.onUpdateTaskStatus} />;
                case 'daily-report-status':
                    return <DailyReportStatusWidget userProfile={userProfile} reports={props.reports || []} onNavigate={onNavigate} />;
                case 'daily-briefing':
                    return <DailyBriefing onProcessDailyDigest={props.onProcessDailyDigest} />;
                case 'announcements':
                    return <AnnouncementsWidget announcements={props.announcements || []} userProfile={userProfile} onAddAnnouncement={props.onAddAnnouncement} userPermissions={props.userPermissions || []} />;
                case 'alerts':
                    return <AlertsWidget 
                        alerts={props.alerts || []} 
                        onNavigate={props.onNavigate}
                        onViewStudent={props.onViewStudent}
                        students={props.students || []}
                    />;
                case 'at-risk-students':
                    return <AtRiskStudentsWidget atRiskStudents={props.atRiskStudents || []} onViewStudent={onViewStudent} />;
                case 'positive-trends':
                    return <PositiveTrendsWidget positiveRecords={props.positiveRecords || []} />;
                case 'kudos':
                    return <KudosWidget kudos={props.staffAwards || []} onGenerateStaffAwards={props.onGenerateStaffAwards} userProfile={userProfile} userPermissions={props.userPermissions || []} />;
                case 'team-pulse':
                    return <TeamPulseSummary teamPulse={props.teamPulse || []} userProfile={userProfile} teams={props.teams || []} teamFeedback={props.teamFeedback || []} onSaveTeamFeedback={props.onSaveTeamFeedback} />;
                case 'counselor-caseload':
                    return <CounselorCaseloadWidget atRiskStudents={props.atRiskStudents || []} interventionPlans={props.interventionPlans || []} onViewIntervention={onViewIntervention} sipLogs={sipLogs || []} />;
                case 'inventory':
                    return <InventoryWidget inventory={props.inventory || []} userProfile={userProfile} />;
                case 'maintenance-schedule':
                    return <PreventativeMaintenanceWidget userProfile={userProfile} tasks={props.tasks || []} users={props.users || []} />;
                case 'student-records':
                    return <StudentRecordsWidget students={props.students || []} onViewStudent={onViewStudent} />;
                case 'sip-status':
                    return <SIPWidget interventionPlans={props.interventionPlans || []} onNavigate={onNavigate} />;
                case 'at-risk-teachers':
                    return <AtRiskTeachersWidget atRiskTeachers={props.atRiskTeachers || []} onAnalyzeTeacherRisk={props.onAnalyzeTeacherRisk} />;
                case 'social-media':
                    return <SocialMediaSummaryWidget socialMediaAnalytics={props.socialMediaAnalytics || []} onNavigate={onNavigate} />;
                case 'policy-inquiry':
                    return <PolicyInquiryWidget inquiries={props.policyInquiries || []} onGenerate={props.onGeneratePolicyInquiries} />;
                case 'curriculum-report':
                    return <CurriculumReportWidget report={props.curriculumReport} onGenerate={props.onGenerateCurriculumReport} />;
                case 'sms-wallet':
                    return <SmsWalletCard />;
                default:
                    console.warn(`[Dashboard] Unknown widget ID: ${widgetId}`);
                    return null;
            }
        } catch (error) {
            console.error(`[Dashboard] Error rendering widget ${widgetId}:`, error);
            return (
                <div className="p-4 text-red-500 text-center bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="font-semibold">Error loading widget</p>
                    <p className="text-sm">{widgetId}</p>
                </div>
            );
        }
    };
    
    const displayedWidgets = widgetConfig;
    
    // Define categories for visual grouping
    const categories = {
        "My Daily Actions": ['daily-briefing', 'my-tasks', 'daily-report-status', 'counselor-caseload', 'maintenance-schedule'],
        "School Pulse & Intelligence": ['alerts', 'announcements', 'at-risk-students', 'at-risk-teachers', 'team-pulse', 'positive-trends', 'kudos'],
        "Operational Tools": ['inventory', 'student-records', 'sip-status', 'sms-wallet', 'policy-inquiry', 'curriculum-report', 'social-media']
    };
    
    const renderSection = (title: string, widgetIds: string[]) => {
        const widgetsInThisSection = displayedWidgets.filter(id => widgetIds.includes(id));
        if (widgetsInThisSection.length === 0) return null;
        
        return (
            <div className="mb-10 animate-fade-in">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200/60 dark:border-slate-700/60 pb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block shadow-lg shadow-indigo-500/50"></span>
                    {title}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                    {widgetsInThisSection.map(widgetId => (
                         <div key={widgetId} className="glass-panel rounded-2xl transition-all duration-300 hover:shadow-xl hover:scale-[1.01] flex flex-col h-full">
                            <WidgetErrorBoundary widgetId={widgetId}>
                                {renderWidget(widgetId)}
                            </WidgetErrorBoundary>
                         </div>
                    ))}
                </div>
            </div>
        )
    }

    // Check if data is still loading
    const isDataLoading = !userProfile || props.userPermissions === undefined;

    if (isDataLoading) {
        return (
            <div className="flex flex-col justify-center items-center h-64">
                <Spinner size="lg" />
                <p className="ml-4 text-slate-600 dark:text-slate-300 mt-4">Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-1">Welcome back, <span className="font-semibold text-indigo-600 dark:text-indigo-400">{userProfile.name}</span>.</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button 
                      onClick={() => setIsCustomizeModalOpen(true)}
                      className="flex items-center justify-center gap-2 px-4 py-2 min-h-touch bg-white/80 dark:bg-slate-800/80 border border-white/50 dark:border-slate-700 backdrop-blur-md text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm hover:shadow-md w-full sm:w-auto touch-target"
                    >
                        <CogIcon className="w-5 h-5" />
                        <span className="sm:inline">Customize</span>
                    </button>
                </div>
            </div>

            {/* Required Manuals Banner */}
            <RequiredManualsBanner
                userProfile={userProfile}
                onViewManuals={() => onNavigate(VIEWS.MANUALS)}
            />

            <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {summaryStats.map((stat) => (
                    <div key={stat.label} className="glass-panel rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase text-slate-500">{stat.label}</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                            <p className="text-xs text-slate-500 mt-1">{stat.hint}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-200 text-sm font-bold">
                            ✓
                        </div>
                    </div>
                ))}
            </section>

            {/* Check-in is always visible at the top */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-8">
                <div className="glass-panel rounded-2xl xl:col-span-2">
                    <CheckinWidget
                        todaysCheckin={todaysCheckin}
                        onCheckinOut={handleCheckinOut}
                        isLoading={false}
                        userProfile={userProfile}
                        campuses={campuses}
                        addToast={addToast}
                    />
                </div>
                {hasPermission('view-ai-task-suggestions') && taskSuggestions.length > 0 && (
                    <div className="glass-panel rounded-2xl p-1">
                        <TaskSuggestionsWidget
                            taskSuggestions={taskSuggestions}
                            areFallbackSuggestions={areFallbackSuggestions}
                            onAcceptSuggestion={onAcceptTaskSuggestion}
                            onDismissSuggestion={onDismissTaskSuggestion}
                            users={users}
                        />
                    </div>
                )}
            </div>

            {/* Render Grouped Sections */}
            {renderSection("My Daily Actions", categories["My Daily Actions"])}
            {renderSection("School Pulse & Intelligence", categories["School Pulse & Intelligence"])}
            {renderSection("Operational Tools", categories["Operational Tools"])}
            
            {displayedWidgets.length === 0 && (
                <div className="col-span-full text-center py-20 rounded-2xl border-2 border-dashed border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-900/20">
                    <div className="text-4xl mb-4">📊</div>
                    <p className="text-slate-700 dark:text-slate-300 text-lg font-semibold">No widgets configured</p>
                    <p className="text-slate-500 text-sm mt-2">
                        Your dashboard is empty. This might be due to:
                    </p>
                    <ul className="text-slate-500 text-sm mt-2 list-disc list-inside">
                        <li>No dashboard configuration saved</li>
                        <li>Missing permissions for available widgets</li>
                    </ul>
                    <button 
                        onClick={() => setIsCustomizeModalOpen(true)} 
                        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                    >
                        Customize Dashboard
                    </button>
                    <p className="text-xs text-slate-400 mt-4">
                        Debug: Permissions count: {props.userPermissions?.length || 0}, 
                        Available widgets: {availableWidgets.length}
                    </p>
                </div>
            )}
            
            <CustomizeDashboardModal 
              isOpen={isCustomizeModalOpen}
              onClose={() => setIsCustomizeModalOpen(false)}
              allWidgets={availableWidgets}
              currentConfig={widgetConfig}
              onSave={handleSaveConfig}
            />
        </div>
    );
};

export default Dashboard;
