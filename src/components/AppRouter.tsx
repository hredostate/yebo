
import React, { Suspense, lazy } from 'react';
import { VIEWS } from '../constants';
import type { PayrollAdjustment, StudentTermReport } from '../types';
import Dashboard from './Dashboard';
import ReportForm from './ReportForm';
import ReportFeed from './ReportFeed';
import TaskManager from './TaskManager';
import BulletinBoard from './BulletinBoard';
import StudentProfileView from './StudentProfileView';
import SIPView from './SIPView';
import ComplianceTracker from './ComplianceTracker';
import ClassGroupManager from './ClassGroupManager';
import SurveyManager from './SurveyManager';
import CalendarView from './CalendarView';
import AICopilot from './AICopilot';
import UserManagement from './UserManagement';
import RoleManager from './RoleManager';
import TeamManager from './TeamManager';
import CurriculumManager from './CurriculumManager';
import CurriculumPlannerContainer from './CurriculumPlannerContainer';
import TeacherGradebookView from './TeacherGradebookView';
import TeacherScoreEntryView from './TeacherScoreEntryView';
import AssessmentManager from './AssessmentManager';
import TeachingAssignmentsContainer from './TeachingAssignmentsContainer';
import ResultManager from './ResultManager';
import CoverageFeedbackReport from './CoverageFeedbackReport';
import DataUploader from './DataUploader';
import LivingPolicyManager from './LivingPolicyManager';
import EmergencyBroadcast from './EmergencyBroadcast';
import ProfilePage from './ProfilePage';
import SettingsView from './SettingsView';
import StaffTeacherRatingsView from './StaffTeacherRatingsView';
import TeacherCheckinView from './TeacherCheckinView';
import TeacherPulseView from './TeacherPulseView';
import AIStrategicCenterView from './AIStrategicCenterView';
import SupportHubView from './SupportHubView';
import DataAnalysisView from './DataAnalysisView';
import RewardsStoreView from './RewardsStoreView';
import RoleDirectoryView from './RoleDirectoryView';
import StudentReportView from './StudentReportView';
import MyPayrollView from './MyPayrollView';
import MyLeaveView from './MyLeaveView';
import LeaveApprovalView from './LeaveApprovalView';
import MyAdjustmentsView from './MyAdjustmentsView';
import StudentFinanceView from './StudentFinanceView';
import IdCardGenerator from './IdCardGenerator';
import StorefrontView from './StorefrontView';
import OrderManager from './OrderManager';
import StoreManager from './StoreManager';
import Spinner from './common/Spinner';
import StudentPortal from './StudentPortal';
import StudentRateMyTeacherView from './StudentRateMyTeacherView';
import StudentReportList from './StudentReportList';
import StudentSurveysView from './StudentSurveysView';
import QuizTakerView from './QuizTakerView';

// Lazy load heavy components and those used dynamically elsewhere to fix build warnings and reduce chunk size
const TimetableView = lazy(() => import('./TimetableView'));
const SurveyListView = lazy(() => import('./SurveyListView'));
const StudentListView = lazy(() => import('./StudentListView'));
const AnalyticsView = lazy(() => import('./AnalyticsView'));
const SuperAdminConsole = lazy(() => import('./SuperAdminConsole'));
const PayrollPortal = lazy(() => import('./PayrollPortal'));
const SocialMediaHubView = lazy(() => import('./SocialMediaHubView'));
const TeacherAttendanceDashboard = lazy(() => import('./TeacherAttendanceDashboard'));

interface AppRouterProps {
    currentView: string;
    data: any;
    actions: any;
}

const AppRouter: React.FC<AppRouterProps> = ({ currentView, data, actions }) => {
    const [baseView, param1, param2] = currentView.split('/');

    // --- Student Views ---
    if (data.userType === 'student') {
        switch (baseView) {
            case VIEWS.MY_SUBJECTS:
                return <StudentPortal 
                    studentProfile={data.userProfile} 
                    addToast={actions.addToast} 
                    onLogout={actions.handleLogout} 
                    isDarkMode={data.isDarkMode}
                    toggleTheme={actions.toggleTheme}
                />;
            case VIEWS.RATE_MY_TEACHER:
                return <StudentRateMyTeacherView 
                    studentProfile={data.userProfile} 
                    addToast={actions.addToast} 
                />;
            case VIEWS.STUDENT_REPORTS:
                 // Filter reports to show only the logged-in student's reports for privacy/security
                 const studentReports = data.studentTermReports.filter(
                     (r: StudentTermReport) => r.student_id === data.userProfile.student_record_id
                 );
                 return <StudentReportList 
                    reports={studentReports} 
                    onSelectReport={(r) => actions.setCurrentView(`${VIEWS.STUDENT_REPORT}/${r.student_id}/${r.term_id}`)} 
                 />;
            case VIEWS.STUDENT_SURVEYS:
                 return <StudentSurveysView 
                    studentProfile={data.userProfile} 
                    addToast={actions.addToast} 
                    surveys={data.surveys}
                    takenSurveyIds={new Set()} 
                    onNavigate={actions.setCurrentView}
                 />;
            case VIEWS.TAKE_QUIZ:
                 const quiz = data.surveys.find((s: any) => s.id === Number(param1));
                 if(quiz) return <QuizTakerView 
                    quiz={quiz} 
                    onBack={() => actions.setCurrentView(VIEWS.STUDENT_SURVEYS)} 
                    addToast={actions.addToast} 
                 />;
                 return <div>Quiz not found</div>;
            case VIEWS.STUDENT_REPORT:
                 if (param1 && param2) {
                    return <StudentReportView 
                        studentId={Number(param1)} 
                        termId={Number(param2)} 
                        onBack={() => actions.setCurrentView(VIEWS.STUDENT_REPORTS)} 
                    />;
                 }
                 return <div>Report not found.</div>;
            default:
                // Redirect unknown to My Subjects
                return <StudentPortal studentProfile={data.userProfile} addToast={actions.addToast} onLogout={actions.handleLogout} />;
        }
    }

    // --- Staff Views ---
    switch (baseView) {
        case VIEWS.DASHBOARD:
            return <Dashboard 
                userProfile={data.userProfile}
                tasks={data.tasks}
                announcements={data.announcements}
                alerts={data.alerts}
                atRiskStudents={data.atRiskStudents}
                positiveRecords={data.positiveRecords}
                staffAwards={data.staffAwards}
                teamPulse={data.teamPulse}
                teams={data.teams}
                teamFeedback={data.teamFeedback}
                students={data.students}
                interventionPlans={data.interventionPlans}
                inventory={data.inventory}
                reports={data.reports}
                atRiskTeachers={data.atRiskTeachers}
                socialMediaAnalytics={data.socialMediaAnalytics}
                policyInquiries={data.policyInquiries}
                curriculumReport={data.curriculumReport}
                users={data.users}
                userPermissions={data.userPermissions}
                taskSuggestions={data.taskSuggestions}
                areFallbackSuggestions={data.areFallbackSuggestions}
                sipLogs={data.sipLogs}
                todaysCheckin={data.todaysCheckinForDashboard}
                onNavigate={actions.setCurrentView}
                onViewStudent={actions.setSelectedStudent}
                onViewIntervention={(studentId) => actions.setCurrentView(`${VIEWS.INTERVENTION_PLANS}/${studentId}`)}
                onUpdateTaskStatus={actions.handleUpdateTaskStatus}
                onAddAnnouncement={actions.handleAddAnnouncement}
                onGenerateStaffAwards={actions.handleGenerateStaffAwards}
                onAnalyzeTeacherRisk={actions.handleAnalyzeTeacherRisk}
                onSaveTeamFeedback={actions.handleSaveTeamFeedback}
                onGeneratePolicyInquiries={actions.handleGeneratePolicyInquiries}
                onGenerateCurriculumReport={actions.handleGenerateCurriculumReport}
                onUpdateProfile={actions.handleUpdateProfile}
                onProcessDailyDigest={actions.handleProcessDailyDigest}
                onAcceptTaskSuggestion={actions.handleAcceptTaskSuggestion}
                onDismissTaskSuggestion={actions.handleDismissTaskSuggestion}
                handleCheckinOut={actions.handleCheckinOut}
                campuses={data.campuses}
                addToast={actions.addToast}
            />;
        case VIEWS.SUBMIT_REPORT:
            return <ReportForm 
                students={data.students} 
                users={data.users} 
                onSubmit={async (formData) => {
                    await actions.handleAddReport(formData);
                    actions.setCurrentView(VIEWS.REPORT_FEED);
                }}
                onCancel={() => actions.setCurrentView(VIEWS.DASHBOARD)} 
                addToast={actions.addToast}
                initialData={data.navContext?.data}
            />;
        case VIEWS.REPORT_FEED:
            return <ReportFeed 
                reports={data.reports} 
                users={data.users} 
                tasks={data.tasks} 
                currentUser={data.userProfile} 
                addToast={actions.addToast}
                onAssignReport={actions.handleAssignReport}
                onAddComment={actions.handleAddReportComment}
                onDeleteReport={actions.handleDeleteReport}
                onUpdateReportStatusAndResponse={actions.handleUpdateReportStatusAndResponse}
                userPermissions={data.userPermissions}
                onBulkDeleteReports={actions.handleBulkDeleteReports}
                onBulkAssignReports={actions.handleBulkAssignReports}
                onBulkUpdateReportStatus={actions.handleBulkUpdateReportStatus}
                onOpenAIBulkResponseModal={actions.handleOpenAIBulkResponseModal}
                students={data.students}
            />;
        case VIEWS.TASK_BOARD:
            return <TaskManager 
                allTasks={data.tasks} 
                users={data.users} 
                currentUser={data.userProfile} 
                onUpdateStatus={actions.handleUpdateTaskStatus} 
                onAddTask={actions.handleAddTask} 
            />;
        case VIEWS.BULLETIN_BOARD:
            return <BulletinBoard 
                announcements={data.announcements} 
                userProfile={data.userProfile} 
                onAddAnnouncement={actions.handleAddAnnouncement} 
                onUpdateAnnouncement={actions.handleUpdateAnnouncement}
                onDeleteAnnouncement={actions.handleDeleteAnnouncement}
                userPermissions={data.userPermissions} 
            />;
        case VIEWS.STUDENT_ROSTER:
            return <StudentListView 
                students={data.students} 
                onAddStudent={actions.handleAddStudent} 
                onViewStudent={actions.setSelectedStudent} 
                onAddPositive={actions.setIsPositiveModalOpen} 
                onGenerateStudentAwards={actions.handleGenerateStudentAwards} 
                userPermissions={data.userPermissions} 
                onOpenCreateStudentAccountModal={actions.handleOpenCreateStudentAccountModal}
                allClasses={data.allClasses}
                allArms={data.allArms}
                users={data.users}
                teachingAssignments={data.academicAssignments}
                onBulkCreateStudentAccounts={actions.handleBulkCreateStudentAccounts}
                onBulkResetStrikes={actions.handleResetStudentStrikes}
                onBulkDeleteAccounts={actions.handleBulkDeleteStudentAccounts}
                onDeleteStudent={actions.handleDeleteStudent}
                onBulkDeleteStudents={actions.handleBulkDeleteStudents}
            />;
        case VIEWS.STUDENT_PROFILE:
            if (param1) {
                 const student = data.students.find((s: any) => s.id === Number(param1));
                 if (student) {
                     return <StudentProfileView 
                         student={student} 
                         reports={data.reports} 
                         positiveRecords={data.positiveRecords} 
                         awards={data.studentAwards} 
                         studentTermReports={data.studentTermReports}
                         onBack={() => actions.setCurrentView(VIEWS.STUDENT_ROSTER)} 
                         onAddPositive={actions.setIsPositiveModalOpen} 
                         onGenerateInsight={actions.handleGenerateStudentInsight}
                         onUpdateStudent={actions.handleUpdateStudent}
                         allClasses={data.allClasses}
                         allArms={data.allArms}
                         onNavigate={actions.setCurrentView}
                         userPermissions={data.userPermissions}
                         onLogCommunication={actions.handleLogCommunication}
                         currentUser={data.userProfile}
                         addToast={actions.addToast}
                         users={data.users}
                         onCreateAccount={actions.handleCreateStudentAccount}
                         onResetPassword={actions.handleResetStudentPassword}
                         onResetStrikes={actions.handleResetStudentStrikes}
                     />;
                 }
            }
            return <div>Student not found</div>;
        case VIEWS.INTERVENTION_PLANS:
             return <SIPView 
                interventionPlans={data.interventionPlans} 
                sipLogs={data.sipLogs} 
                students={data.students} 
                onCreatePlan={actions.handleCreateSIP} 
                onAddLog={actions.handleAddSIPLog} 
                userPermissions={data.userPermissions}
                onUpdatePlan={actions.handleUpdateSIP}
                studentIdToSelect={param1 ? Number(param1) : undefined}
            />;
        case VIEWS.ANALYTICS:
            return <AnalyticsView 
                reports={data.reports} 
                tasks={data.tasks} 
                schoolSettings={data.schoolSettings} 
                userProfile={data.userProfile} 
            />;
        case VIEWS.COMPLIANCE_TRACKER:
            return <ComplianceTracker 
                reports={data.reports} 
                users={data.users} 
                roles={data.roles} 
                onRunWeeklyComplianceCheck={actions.handleRunWeeklyComplianceCheck}
                userPermissions={data.userPermissions}
            />;
        case VIEWS.CLASSES_ATTENDANCE:
            return <ClassGroupManager 
                classGroups={data.classGroups} 
                students={data.students} 
                currentUser={data.userProfile} 
                onUpdateMembers={actions.handleUpdateClassGroupMembers}
                onSaveSchedule={actions.handleSaveAttendanceSchedule}
                onDeleteSchedule={actions.handleDeleteAttendanceSchedule}
                onSaveRecord={actions.handleSaveAttendanceRecord}
                onCreateClassAssignment={actions.handleCreateClassAssignment}
                onDeleteClassAssignment={actions.handleDeleteClassAssignment}
                users={data.users}
                subjects={data.allSubjects}
                classes={data.allClasses}
                arms={data.allArms}
                userPermissions={data.userPermissions}
            />;
        case VIEWS.SURVEY_MANAGER:
             return <SurveyManager 
                surveys={data.surveys}
                onSaveSurvey={actions.handleSaveSurvey}
                onDeleteSurvey={actions.handleDeleteSurvey}
                addToast={actions.addToast}
                allClasses={data.allClasses}
                allArms={data.allArms}
                allRoles={Object.values(data.roles)}
            />;
        case VIEWS.CALENDAR:
            return <CalendarView 
                events={data.calendarEvents} 
                onSaveEvent={actions.handleSaveCalendarEvent} 
                onUpdateEvent={actions.handleUpdateCalendarEvent}
                onDeleteEvent={actions.handleDeleteCalendarEvent}
                userProfile={data.userProfile} 
                userPermissions={data.userPermissions}
                users={data.users}
                handleAddTask={actions.handleAddTask}
                addToast={actions.addToast}
            />;
        case VIEWS.GUARDIAN_COMMAND:
             return <AICopilot 
                userProfile={data.userProfile} 
                users={data.users} 
                students={data.students} 
                reports={data.reports} 
                tasks={data.tasks}
                roles={data.roles}
                announcements={data.announcements}
                classes={data.allClasses}
                livingPolicy={data.livingPolicy}
                onAddTask={actions.handleAddTask}
                onAddAnnouncement={actions.handleAddAnnouncement}
                addToast={actions.addToast}
                onNavigate={actions.handleNavigation}
                isPageView={true}
             />;
        case VIEWS.USER_MANAGEMENT:
             return <UserManagement 
                users={data.users} 
                roles={data.roles} 
                campuses={data.campuses}
                onInviteUser={actions.handleInviteUser} 
                onDeactivateUser={actions.handleDeactivateUser}
                onUpdateUserCampus={actions.handleUpdateUserCampus}
             />;
        case VIEWS.ROLE_MANAGEMENT:
             return <RoleManager 
                roles={Object.values(data.roles)} 
                onSaveRole={actions.handleSaveRole} 
                users={data.users} 
                userRoleAssignments={data.userRoleAssignments} 
                onUpdateRoleAssignments={actions.handleUpdateRoleAssignments} 
             />;
        case VIEWS.TEAM_MANAGEMENT:
             return <TeamManager 
                users={data.users} 
                currentUser={data.userProfile}
                userPermissions={data.userPermissions}
                teams={data.teams} 
                tasks={data.tasks}
                reports={data.reports}
                teamPulse={data.teamPulse} 
                teamFeedback={data.teamFeedback}
                onCreateTeam={actions.handleCreateTeam}
                onUpdateTeam={actions.handleUpdateTeam}
                onDeleteTeam={actions.handleDeleteTeam}
                onUpdateTeamMembers={actions.handleUpdateTeamMembers}
                onSaveTeamFeedback={actions.handleSaveTeamFeedback}
             />;
        case VIEWS.CURRICULUM_MANAGER:
             return <CurriculumManager 
                teachingAssignments={data.teachingEntities} 
                curricula={data.curricula} 
                curriculumWeeks={data.curriculumWeeks} 
                onSave={actions.handleSaveCurriculum} 
                userProfile={data.userProfile}
                teams={data.teams}
             />;
        case VIEWS.LESSON_PLANNER:
             return <CurriculumPlannerContainer 
                teams={data.teams}
                lessonPlans={data.lessonPlans}
                userProfile={data.userProfile}
                teachingAssignments={data.academicAssignments} // Use Academic assignments
                onSaveLessonPlan={actions.handleSaveLessonPlan}
                onAnalyzeLessonPlan={actions.handleAnalyzeLessonPlan}
                onCopyLessonPlan={actions.handleCopyLessonPlan}
                curricula={data.curricula}
                curriculumWeeks={data.curriculumWeeks}
                onApprove={actions.handleApproveLessonPlan}
             />;
        case VIEWS.GRADEBOOK:
             return <TeacherGradebookView 
                academicAssignments={data.academicAssignments}
                currentUser={data.userProfile}
                onNavigate={actions.setCurrentView}
             />;
        case `${VIEWS.TEACHER_SCORE_ENTRY}`:
             if (param1) {
                 return <TeacherScoreEntryView 
                    assignmentId={Number(param1)}
                    academicAssignments={data.academicAssignments}
                    academicClassStudents={data.academicClassStudents}
                    students={data.students}
                    scoreEntries={data.scoreEntries}
                    gradingSchemes={data.gradingSchemes}
                    schoolConfig={data.schoolConfig}
                    onSaveScores={actions.handleSaveScores}
                    onSubmitForReview={actions.handleSubmitScoresForReview}
                    onBack={() => actions.setCurrentView(VIEWS.GRADEBOOK)}
                    addToast={actions.addToast}
                 />
             }
             return <div>Assignment not found</div>;
        case VIEWS.ASSESSMENT_MANAGER:
             return <AssessmentManager 
                academicAssignments={data.academicAssignments}
                assessments={data.assessments}
                assessmentScores={data.assessmentScores}
                students={data.students}
                academicClassStudents={data.academicClassStudents}
                userProfile={data.userProfile}
                userPermissions={data.userPermissions}
                onSaveAssessment={actions.handleSaveAssessment}
                onDeleteAssessment={actions.handleDeleteAssessment}
                onSaveScores={actions.handleSaveAssessmentScores}
                onCopyAssessment={actions.handleCopyAssessment}
                addToast={actions.addToast}
             />;
        case VIEWS.TEACHING_ASSIGNMENTS:
             return <TeachingAssignmentsContainer 
                users={data.users} 
                assignments={data.academicAssignments} 
                subjects={data.allSubjects}
                classes={data.allClasses}
                arms={data.allArms}
                classGroups={data.classGroups}
                academicClasses={data.academicClasses}
                terms={data.terms}
                onCreateAssignment={actions.handleCreateClassAssignment}
                onDeleteAssignment={actions.handleDeleteClassAssignment}
             />;
        case VIEWS.RESULT_MANAGER:
             return <ResultManager 
                terms={data.terms}
                academicAssignments={data.academicAssignments}
                academicClassStudents={data.academicClassStudents}
                scoreEntries={data.scoreEntries}
                users={data.users}
                onLockScores={actions.handleLockScores}
                userPermissions={data.userPermissions}
                students={data.students}
                studentTermReports={data.studentTermReports}
                studentTermReportSubjects={data.studentTermReportSubjects}
                gradingSchemes={data.gradingSchemes}
                schoolConfig={data.schoolConfig}
                onUpdateComments={actions.handleUpdateReportComments}
                addToast={actions.addToast}
             />;
        case VIEWS.COVERAGE_FEEDBACK:
             return <CoverageFeedbackReport 
                lessonPlans={data.lessonPlans} 
                coverageVotes={data.coverageVotes} 
                users={data.users} 
                teams={data.teams} 
                currentUser={data.userProfile} 
             />;
        case VIEWS.DATA_UPLOAD:
             return <DataUploader 
                onBulkAddStudents={actions.handleBulkAddStudents} 
                addToast={actions.addToast} 
             />;
        case VIEWS.LIVING_POLICY:
             return <LivingPolicyManager 
                policySnippets={data.livingPolicy} 
                onAddSnippet={actions.handleAddPolicySnippet} 
                userProfile={data.userProfile} 
                onSaveDocument={actions.handleSavePolicyDocument}
             />;
        case VIEWS.EMERGENCY_BROADCAST:
             return <EmergencyBroadcast onSendBroadcast={actions.handleSendEmergencyBroadcast} />;
        case VIEWS.PROFILE:
             return <ProfilePage 
                userProfile={data.userProfile} 
                onUpdateProfile={actions.handleUpdateProfile} 
                onUpdateAvatar={actions.handleUpdateAvatar}
                onResetPassword={actions.handleResetPassword}
                onUpdateEmail={actions.handleUpdateEmail}
                onUpdatePassword={actions.handleUpdatePassword}
                orders={data.orders}
             />;
        case VIEWS.SETTINGS:
             return <SettingsView 
                settings={data.schoolSettings} 
                schoolConfig={data.schoolConfig}
                onSaveSettings={actions.handleUpdateSchoolSettings} 
                onSaveSchoolConfig={actions.handleUpdateSchoolConfig}
             />;
        case VIEWS.TEACHER_RATINGS:
             return <StaffTeacherRatingsView 
                users={data.users} 
                weeklyRatings={data.weeklyRatings} 
                currentUser={data.userProfile} 
             />;
        case VIEWS.MY_CHECKIN:
             return <TeacherCheckinView 
                currentUser={data.userProfile} 
                addToast={actions.addToast}
                todaysCheckin={data.todaysCheckinForDashboard}
                handleCheckinOut={actions.handleCheckinOut}
                campuses={data.campuses}
             />;
        case VIEWS.TEACHER_ATTENDANCE:
             // Admin/Lead view of all teachers
             return <TeacherAttendanceDashboard campuses={data.campuses} academicAssignments={data.academicAssignments} />;
        case VIEWS.TEACHER_PULSE:
             return <TeacherPulseView 
                addToast={actions.addToast}
                checkinAnomalies={data.checkinAnomalies}
                onAnalyzeCheckinAnomalies={actions.handleAnalyzeCheckinAnomalies}
                onNavigate={actions.setCurrentView}
             />;
        case VIEWS.AI_STRATEGIC_CENTER:
             return <AIStrategicCenterView 
                healthReport={data.schoolHealthReport}
                onGenerateHealthReport={actions.handleGenerateHealthReport}
                onGenerateForesight={actions.handleGenerateForesight}
                improvementPlan={data.improvementPlan}
                onGenerateImprovementPlan={actions.handleGenerateImprovementPlan}
                addToast={actions.addToast}
                schoolSettings={data.schoolSettings}
                onGenerateCoverageDeviationReport={actions.handleGenerateCoverageDeviationReport}
             />;
        case VIEWS.SUPER_ADMIN_CONSOLE:
             return <SuperAdminConsole 
                userPermissions={data.userPermissions}
                schoolConfig={data.schoolConfig}
                terms={data.terms}
                academicClasses={data.academicClasses}
                academicAssignments={data.academicAssignments}
                gradingSchemes={data.gradingSchemes}
                users={data.users}
                roles={Object.values(data.roles)}
                userRoleAssignments={data.userRoleAssignments}
                auditLogs={data.auditLogs}
                subjects={data.allSubjects}
                classes={data.allClasses}
                arms={data.allArms}
                inventory={data.inventory}
                rewards={data.rewards}
                assessmentStructures={data.assessmentStructures}
                onSaveRole={actions.handleSaveRole}
                onUpdateRoleAssignments={actions.handleUpdateRoleAssignments}
                onSaveSchoolConfig={actions.handleUpdateSchoolConfig}
                onSaveTerm={actions.handleSaveTerm}
                onDeleteTerm={actions.handleDeleteTerm}
                onSaveAcademicClass={actions.handleSaveAcademicClass}
                onDeleteAcademicClass={actions.handleDeleteAcademicClass}
                onSaveAcademicAssignment={actions.handleSaveAcademicAssignment}
                onDeleteAcademicAssignment={actions.handleDeleteAcademicAssignment}
                onSaveGradingScheme={actions.handleSaveGradingScheme}
                onDeleteGradingScheme={actions.handleDeleteGradingScheme}
                onSetActiveGradingScheme={actions.handleSetActiveGradingScheme}
                onSaveSubject={actions.handleSaveSubject}
                onDeleteSubject={actions.handleDeleteSubject}
                onSaveClass={actions.handleSaveClass}
                onDeleteClass={actions.handleDeleteClass}
                onSaveArm={actions.handleSaveArm}
                onDeleteArm={actions.handleDeleteArm}
                onSaveInventoryItem={actions.handleSaveInventoryItem}
                onDeleteInventoryItem={actions.handleDeleteInventoryItem}
                onSaveReward={actions.handleSaveReward}
                onDeleteReward={actions.handleDeleteReward}
                onInviteUser={actions.handleInviteUser}
                onUpdateUser={actions.handleUpdateUser}
                onDeleteUser={actions.handleDeleteUser}
                onDeactivateUser={actions.handleDeactivateUser}
                campuses={data.campuses}
                onUpdateUserCampus={actions.handleUpdateUserCampus}
                onSaveCampus={actions.handleSaveCampus}
                onDeleteCampus={actions.handleDeleteCampus}
                addToast={actions.addToast}
                teacherShifts={data.teacherShifts}
                onSaveShift={actions.handleSaveShift}
                onDeleteShift={actions.handleDeleteShift}
                leaveTypes={data.leaveTypes}
                onSaveLeaveType={actions.handleSaveLeaveType}
                onDeleteLeaveType={actions.handleDeleteLeaveType}
                onSaveAssessmentStructure={actions.handleSaveAssessmentStructure}
                onDeleteAssessmentStructure={actions.handleDeleteAssessmentStructure}
                teachingEntities={data.teachingEntities}
                onImportLegacyAssignments={actions.handleImportLegacyAssignments}
                students={data.students}
                academicClassStudents={data.academicClassStudents}
                onUpdateClassEnrollment={actions.handleUpdateClassEnrollment}
                onUpdateUserPayroll={actions.handleUpdateUserPayroll}
             />;
        case VIEWS.SUPPORT_HUB:
             return <SupportHubView 
                allTasks={data.tasks} 
                users={data.users} 
                currentUser={data.userProfile} 
                onUpdateStatus={actions.handleUpdateTaskStatus} 
                onAddTask={actions.handleAddTask} 
             />;
        case VIEWS.DATA_ANALYSIS:
             return <DataAnalysisView addToast={actions.addToast} />;
        case VIEWS.REWARDS_STORE:
             return <RewardsStoreView 
                rewards={data.rewards}
                students={data.students}
                userProfile={data.userProfile}
                userPermissions={data.userPermissions}
                onSaveReward={actions.handleSaveReward}
                onDeleteReward={actions.handleDeleteReward}
                onRedeemReward={actions.handleRedeemReward}
             />;
        case VIEWS.ROLE_DIRECTORY:
             return <RoleDirectoryView roles={Object.values(data.roles)} />;
        case VIEWS.STUDENT_REPORT:
             // Viewer for individual student report
             if (param1 && param2) {
                return <StudentReportView studentId={Number(param1)} termId={Number(param2)} onBack={() => actions.setCurrentView(VIEWS.STUDENT_ROSTER)} />;
             }
             return <div>Report not found.</div>;
        case VIEWS.HR_PAYROLL:
        case VIEWS.PAYROLL:
             return <PayrollPortal 
                userProfile={data.userProfile}
                users={data.users}
                payrollRuns={data.payrollRuns}
                payrollItems={data.payrollItems}
                payrollAdjustments={data.payrollAdjustments}
                schoolConfig={data.schoolConfig}
                onRunPayroll={actions.handleRunPayroll}
                onUpdateUserPayroll={actions.handleUpdateUserPayroll}
                onSaveSchoolConfig={actions.handleUpdateSchoolConfig}
                addToast={actions.addToast}
                userPermissions={data.userPermissions}
                campuses={data.campuses}
             />;
        case VIEWS.MY_PAYROLL:
             return <MyPayrollView 
                payrollRuns={data.payrollRuns}
                payrollItems={data.payrollItems}
                currentUser={data.userProfile}
             />;
        case VIEWS.MY_LEAVE:
             return <MyLeaveView 
                currentUser={data.userProfile}
                addToast={actions.addToast}
                leaveRequests={data.leaveRequests}
                leaveTypes={data.leaveTypes}
                onSave={actions.handleCreateLeaveRequest}
                onDelete={actions.handleDeleteLeaveRequest}
             />;
        case VIEWS.LEAVE_APPROVALS:
             return <LeaveApprovalView 
                currentUser={data.userProfile}
                addToast={actions.addToast}
                allRequests={data.leaveRequests}
                onUpdateStatus={actions.handleUpdateLeaveRequestStatus}
                teams={data.teams}
             />;
        case VIEWS.MY_ADJUSTMENTS:
             return <MyAdjustmentsView 
                currentUser={data.userProfile} 
                adjustments={data.payrollAdjustments?.filter((a: PayrollAdjustment) => a.user_id === data.userProfile.id)}
             />;
        case VIEWS.STUDENT_FINANCE:
             return <StudentFinanceView 
                addToast={actions.addToast}
                students={data.students}
                userProfile={data.userProfile}
             />;
        case VIEWS.TIMETABLE:
             return <TimetableView 
                userProfile={data.userProfile}
                users={data.users}
                terms={data.terms}
                academicClasses={data.academicClasses}
                subjects={data.allSubjects}
                addToast={actions.addToast}
             />;
        case VIEWS.ID_CARDS:
             return <IdCardGenerator 
                students={data.students}
                allClasses={data.allClasses}
                allArms={data.allArms}
                schoolConfig={data.schoolConfig}
                schoolSettings={data.schoolSettings}
             />;
        case VIEWS.STOREFRONT:
             return <StorefrontView 
                inventory={data.inventory}
                onCreateOrder={actions.handleCreateOrder}
                userProfile={data.userProfile}
                addToast={actions.addToast}
             />;
        case VIEWS.ORDER_MANAGER:
             return <OrderManager 
                orders={data.orders}
                users={data.users}
                onUpdateStatus={actions.handleUpdateOrderStatus}
                onAddNote={actions.handleAddOrderNote}
                onDeleteNote={actions.handleDeleteOrderNote}
             />;
        case VIEWS.STORE_MANAGER:
             return <StoreManager 
                inventory={data.inventory}
                orders={data.orders}
                onSaveItem={actions.handleSaveInventoryItem}
                onDeleteItem={actions.handleDeleteInventoryItem}
                addToast={actions.addToast}
                onUpdateOrderStatus={actions.handleUpdateOrderStatus}
                onAddOrderNote={actions.handleAddOrderNote}
                onDeleteOrderNote={actions.handleDeleteOrderNote}
             />;
        case VIEWS.SOCIAL_MEDIA_HUB:
             return <SocialMediaHubView 
                socialMediaAnalytics={data.socialMediaAnalytics}
                socialAccounts={data.socialAccounts}
                onAddTask={actions.handleAddTask}
                onSaveSocialLinks={actions.handleSaveSocialLinks}
                addToast={actions.addToast}
                users={data.users}
             />;
        case VIEWS.SURVEYS: // Added fallback for Surveys View
             return <SurveyListView 
                surveys={data.surveys}
                onTakeSurvey={(survey) => actions.setCurrentView(`${VIEWS.TAKE_SURVEY}/${survey.id}`)}
                takenSurveyIds={new Set(data.surveyResponses?.map((r: any) => r.survey_id) || [])} 
             />;
        case VIEWS.TAKE_SURVEY:
            if (param1) {
                const surveyToTake = data.surveys.find((s: any) => s.id === Number(param1));
                if (surveyToTake) {
                    return <QuizTakerView 
                        quiz={surveyToTake} 
                        onBack={() => actions.setCurrentView(VIEWS.SURVEYS)} 
                        addToast={actions.addToast} 
                    />;
                }
            }
            return <div>Survey not found</div>;
        default:
            return <div>View not found: {baseView}</div>;
    }
};

export default AppRouter;
