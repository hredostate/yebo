
import React, { useState, useMemo, lazy } from 'react';
import type { UserProfile, Task, Announcement, Alert, AtRiskStudent, PositiveBehaviorRecord, StaffAward, TeamPulse, TeamFeedback, Team, Student, StudentInterventionPlan, InventoryItem, ReportRecord, AtRiskTeacher, SocialMediaAnalytics, PolicyInquiry, CurriculumReport, SuggestedTask, SIPLog, TeacherCheckin, Campus, TeacherMood } from '../types';
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
import CurriculumReportWidget from './widgets/CurriculumReportWidget';
import CustomizeDashboardModal from './CustomizeDashboardModal';
import { CogIcon } from './common/icons';
import DailyBriefing from './DailyBriefing';
import SmsWalletCard from './widgets/SmsWalletCard';
import { VIEWS } from '../constants';
import CheckinWidget from './widgets/CheckinWidget';

const TaskSuggestionsWidget = lazy(() => import('./widgets/TaskSuggestionsWidget'));

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
    
    const userWidgetConfig = useMemo(() => {
        if (userProfile.dashboard_config && userProfile.dashboard_config.length > 0) {
            return userProfile.dashboard_config;
        }
        // Role-specific defaults if config is empty
        switch (userProfile.role) {
            case 'Team Lead':
                return ['daily-briefing', 'my-tasks', 'daily-report-status', 'team-pulse', 'at-risk-students', 'announcements', 'alerts'];
            case 'Principal':
                 return ['daily-briefing', 'team-pulse', 'at-risk-students', 'at-risk-teachers', 'alerts', 'policy-inquiry', 'curriculum-report'];
            case 'Admin':
                 return ['daily-briefing', 'sms-wallet', 'student-records', 'inventory', 'team-pulse', 'at-risk-teachers', 'alerts'];
            case 'Accountant':
                return ['sms-wallet', 'student-records', 'inventory', 'announcements'];
            case 'Counselor':
                return ['counselor-caseload', 'sip-status', 'my-tasks', 'at-risk-students', 'announcements'];
            case 'Teacher':
                 return ['my-tasks', 'daily-report-status', 'announcements', 'student-records', 'alerts', 'inventory'];
            case 'Maintenance':
                 return ['maintenance-schedule', 'inventory', 'my-tasks', 'announcements'];
            default:
                return ['my-tasks', 'daily-report-status', 'announcements', 'alerts'];
        }
    }, [userProfile.dashboard_config, userProfile.role]);

    const [widgetConfig, setWidgetConfig] = useState<string[]>(userWidgetConfig);

    const availableWidgets = useMemo(() => {
        const permissions = new Set(props.userPermissions);
        const isAllPowerful = permissions.has('*');
        return ALL_WIDGETS.filter(w => isAllPowerful || permissions.has(w.requiredPermission));
    }, [props.userPermissions]);
    
    const handleSaveConfig = async (newConfig: string[]) => {
        setWidgetConfig(newConfig);
        await props.onUpdateProfile({ dashboard_config: newConfig });
    };

    const renderWidget = (widgetId: string) => {
        switch (widgetId) {
            case 'my-tasks':
                return <MyTasksWidget tasks={props.tasks} userProfile={userProfile} onUpdateStatus={props.onUpdateTaskStatus} />;
            case 'daily-report-status':
                return <DailyReportStatusWidget userProfile={userProfile} reports={props.reports} onNavigate={onNavigate} />;
            case 'daily-briefing':
                return <DailyBriefing onProcessDailyDigest={props.onProcessDailyDigest} />;
            case 'announcements':
                return <AnnouncementsWidget announcements={props.announcements} userProfile={userProfile} onAddAnnouncement={props.onAddAnnouncement} userPermissions={props.userPermissions} />;
            case 'alerts':
                return <AlertsWidget 
                    alerts={props.alerts} 
                    onNavigate={props.onNavigate}
                    onViewStudent={props.onViewStudent}
                    students={props.students}
                />;
            case 'at-risk-students':
                return <AtRiskStudentsWidget atRiskStudents={props.atRiskStudents} onViewStudent={onViewStudent} />;
            case 'positive-trends':
                return <PositiveTrendsWidget positiveRecords={props.positiveRecords} />;
            case 'kudos':
                return <KudosWidget kudos={props.staffAwards} onGenerateStaffAwards={props.onGenerateStaffAwards} userProfile={userProfile} userPermissions={props.userPermissions} />;
            case 'team-pulse':
                return <TeamPulseSummary teamPulse={props.teamPulse} userProfile={userProfile} teams={props.teams} teamFeedback={props.teamFeedback} onSaveTeamFeedback={props.onSaveTeamFeedback} />;
            case 'counselor-caseload':
                return <CounselorCaseloadWidget atRiskStudents={props.atRiskStudents} interventionPlans={props.interventionPlans} onViewIntervention={onViewIntervention} sipLogs={sipLogs} />;
            case 'inventory':
                return <InventoryWidget inventory={props.inventory} userProfile={userProfile} />;
            case 'maintenance-schedule':
                return <PreventativeMaintenanceWidget userProfile={userProfile} tasks={props.tasks} users={props.users} />;
            case 'student-records':
                return <StudentRecordsWidget students={props.students} onViewStudent={onViewStudent} />;
            case 'sip-status':
                return <SIPWidget interventionPlans={props.interventionPlans} onNavigate={onNavigate} />;
            case 'at-risk-teachers':
                return <AtRiskTeachersWidget atRiskTeachers={props.atRiskTeachers} onAnalyzeTeacherRisk={props.onAnalyzeTeacherRisk} />;
            case 'social-media':
                return <SocialMediaSummaryWidget socialMediaAnalytics={props.socialMediaAnalytics} onNavigate={onNavigate} />;
            case 'policy-inquiry':
                return <PolicyInquiryWidget inquiries={props.policyInquiries} onGenerate={props.onGeneratePolicyInquiries} />;
            case 'curriculum-report':
                return <CurriculumReportWidget report={props.curriculumReport} onGenerate={props.onGenerateCurriculumReport} />;
            case 'sms-wallet':
                return <SmsWalletCard />;
            default:
                return null;
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {widgetsInThisSection.map(widgetId => (
                         <div key={widgetId} className="glass-panel rounded-2xl transition-all duration-300 hover:shadow-xl hover:scale-[1.01] flex flex-col h-full">
                            {renderWidget(widgetId)}
                         </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">Welcome back, <span className="font-semibold text-indigo-600 dark:text-indigo-400">{userProfile.name}</span>.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                      onClick={() => setIsCustomizeModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-800/80 border border-white/50 dark:border-slate-700 backdrop-blur-md text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm hover:shadow-md"
                    >
                        <CogIcon className="w-5 h-5" />
                        Customize View
                    </button>
                </div>
            </div>

            {/* Check-in is always visible at the top */}
            <div className="mb-8 glass-panel rounded-2xl">
                <CheckinWidget 
                    todaysCheckin={todaysCheckin}
                    onCheckinOut={handleCheckinOut}
                    isLoading={false} 
                    userProfile={userProfile}
                    campuses={campuses}
                    addToast={addToast}
                />
            </div>
            
            {taskSuggestions.length > 0 && (
                <div className="mb-8 glass-panel rounded-2xl p-1">
                     <TaskSuggestionsWidget 
                        taskSuggestions={taskSuggestions}
                        areFallbackSuggestions={areFallbackSuggestions}
                        onAcceptSuggestion={onAcceptTaskSuggestion}
                        onDismissSuggestion={onDismissTaskSuggestion}
                        users={users}
                    />
                </div>
            )}

            {/* Render Grouped Sections */}
            {renderSection("My Daily Actions", categories["My Daily Actions"])}
            {renderSection("School Pulse & Intelligence", categories["School Pulse & Intelligence"])}
            {renderSection("Operational Tools", categories["Operational Tools"])}
            
            {displayedWidgets.length === 0 && (
                <div className="col-span-full text-center py-20 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <p className="text-slate-500 text-lg">Your dashboard is empty!</p>
                    <button onClick={() => setIsCustomizeModalOpen(true)} className="text-blue-600 font-semibold hover:underline mt-2">
                        Customize your dashboard to add widgets.
                    </button>
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
