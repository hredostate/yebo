
import React, { useState, useMemo } from 'react';
import type { SchoolConfig, Term, AcademicClass, AcademicTeachingAssignment, GradingScheme, UserProfile, RoleDetails, RoleTitle, AuditLog, BaseDataObject, InventoryItem, RewardStoreItem, Campus, AssessmentStructure, TeachingAssignment, Student, AcademicClassStudent } from '../types';
import RoleManager from './RoleManager';
import AuditLogView from './AuditLogView';
import BrandingSettings from './BrandingSettings';
import GradingSchemeManager from './GradingSchemeManager';
import TermsManager from './TermsManager';
import AcademicClassManager from './AcademicClassManager';
import AcademicAssignmentManager from './AcademicAssignmentManager';
import SubjectsManager from './SubjectsManager';
import ClassesManager from './ClassesManager';
import ArmsManager from './ArmsManager';
import InventoryManager from './InventoryManager';
import RewardsManager from './RewardsManager';
import UserManagement from './UserManagement';
import AssessmentStructureManager from './AssessmentStructureManager';

// Props interface for the component
interface SuperAdminConsoleProps {
    userPermissions: string[];
    schoolConfig: SchoolConfig | null;
    terms: Term[];
    academicClasses: AcademicClass[];
    academicAssignments: AcademicTeachingAssignment[];
    gradingSchemes: GradingScheme[];
    users: UserProfile[];
    roles: RoleDetails[];
    userRoleAssignments: { user_id: string; role_id: number }[];
    auditLogs: AuditLog[];
    subjects: BaseDataObject[];
    classes: BaseDataObject[];
    arms: BaseDataObject[];
    inventory: InventoryItem[];
    rewards: RewardStoreItem[];
    assessmentStructures: AssessmentStructure[];
    onSaveRole: (roleData: RoleDetails) => Promise<void>;
    onUpdateRoleAssignments: (roleId: number, userIds: string[]) => Promise<void>;
    onSaveSchoolConfig: (config: Partial<SchoolConfig>) => Promise<boolean>;
    onSaveTerm: (term: Partial<Term>) => Promise<boolean>;
    onDeleteTerm: (termId: number) => Promise<boolean>;
    onSaveAcademicClass: (ac: Partial<AcademicClass>) => Promise<boolean>;
    onDeleteAcademicClass: (acId: number) => Promise<boolean>;
    onSaveAcademicAssignment: (as: Partial<AcademicTeachingAssignment>) => Promise<boolean>;
    onDeleteAcademicAssignment: (asId: number) => Promise<boolean>;
    onSaveGradingScheme: (scheme: Partial<GradingScheme>) => Promise<boolean>;
    onDeleteGradingScheme: (schemeId: number) => Promise<boolean>;
    onSetActiveGradingScheme: (schemeId: number) => Promise<boolean>;
    onSaveSubject: (subject: Partial<BaseDataObject>) => Promise<boolean>;
    onDeleteSubject: (id: number) => Promise<boolean>;
    onSaveClass: (cls: Partial<BaseDataObject>) => Promise<boolean>;
    onDeleteClass: (id: number) => Promise<boolean>;
    onSaveArm: (arm: Partial<BaseDataObject>) => Promise<boolean>;
    onDeleteArm: (id: number) => Promise<boolean>;
    onSaveInventoryItem: (item: Partial<InventoryItem>) => Promise<boolean>;
    onDeleteInventoryItem: (id: number) => Promise<boolean>;
    onSaveReward: (reward: Partial<RewardStoreItem>) => Promise<boolean>;
    onDeleteReward: (rewardId: number) => Promise<boolean>;
    onInviteUser: (email: string, role: RoleTitle) => Promise<void>;
    onUpdateUser: (userId: string, userData: Partial<UserProfile>) => Promise<boolean>;
    onDeleteUser: (userId: string) => Promise<boolean>;
    onDeactivateUser: (userId: string, isActive: boolean) => Promise<void>;
    campuses: Campus[];
    onUpdateUserCampus: (userId: string, campusId: number | null) => Promise<void>;
    onSaveCampus: (campus: Partial<Campus>) => Promise<boolean>;
    onDeleteCampus: (id: number) => Promise<boolean>;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    teacherShifts: TeacherShift[];
    onSaveShift: (shift: Partial<TeacherShift>) => Promise<boolean>;
    onDeleteShift: (id: number) => Promise<boolean>;
    leaveTypes: LeaveType[];
    onSaveLeaveType: (leaveType: Partial<LeaveType>) => Promise<boolean>;
    onDeleteLeaveType: (id: number) => Promise<boolean>;
    onSaveAssessmentStructure: (structure: Partial<AssessmentStructure>) => Promise<boolean>;
    onDeleteAssessmentStructure: (id: number) => Promise<boolean>;
    teachingEntities: TeachingAssignment[];
    onImportLegacyAssignments: (termId: number, entityIds: number[]) => Promise<boolean>;
    students: Student[];
    academicClassStudents: AcademicClassStudent[];
    onUpdateClassEnrollment: (academicClassId: number, termId: number, studentIds: number[]) => Promise<boolean>;
    onUpdateUserPayroll: (userId: string, data: Partial<UserProfile>) => Promise<void>;
    onBulkResetStrikes?: () => Promise<void>;
}

type AdminTab = 'Branding' | 'Roles' | 'Users' | 'Structure' | 'Grading' | 'Inventory' | 'Rewards' | 'Audit Log' | 'Advanced';

const tabs: { name: AdminTab; permission: string }[] = [
    { name: 'Branding', permission: 'school.console.branding_edit' },
    { name: 'Roles', permission: 'school.console.role_admin' },
    { name: 'Users', permission: 'school.console.role_admin' },
    { name: 'Structure', permission: 'school.console.structure_edit' },
    { name: 'Grading', permission: 'school.console.structure_edit' },
    { name: 'Inventory', permission: 'school.console.structure_edit' },
    { name: 'Rewards', permission: 'school.console.structure_edit' },
    { name: 'Audit Log', permission: 'school.console.view_audit_log' },
    { name: 'Advanced', permission: '*' }, // Super Admin only
];

const SuperAdminConsole: React.FC<SuperAdminConsoleProps> = (props) => {
    const {
        userPermissions = [],
        addToast,
        teacherShifts = [],
        onSaveShift,
        onDeleteShift,
        leaveTypes = [],
        onSaveLeaveType,
        onDeleteLeaveType,
        assessmentStructures = [],
        onSaveAssessmentStructure,
        onDeleteAssessmentStructure,
        terms = [],
        academicClasses = [],
        academicAssignments = [],
        gradingSchemes = [],
        users = [],
        roles = [],
        userRoleAssignments = [],
        auditLogs = [],
        subjects = [],
        classes = [],
        arms = [],
        inventory = [],
        rewards = [],
        campuses = [],
        teachingEntities = [],
        students = [],
        academicClassStudents = [],
        schoolConfig,
        onSaveSchoolConfig,
        onSaveTerm, onDeleteTerm,
        onSaveAcademicClass, onDeleteAcademicClass,
        onSaveAcademicAssignment, onDeleteAcademicAssignment,
        onSaveGradingScheme, onDeleteGradingScheme, onSetActiveGradingScheme,
        onSaveSubject, onDeleteSubject,
        onSaveClass, onDeleteClass,
        onSaveArm, onDeleteArm,
        onSaveInventoryItem, onDeleteInventoryItem,
        onSaveReward, onDeleteReward,
        onInviteUser, onUpdateUser, onDeleteUser, onDeactivateUser, onUpdateUserCampus,
        onSaveCampus, onDeleteCampus,
        onImportLegacyAssignments,
        onUpdateClassEnrollment,
        onUpdateUserPayroll,
        onBulkResetStrikes
    } = props;

    const visibleTabs = useMemo(() => {
        const isSuperAdmin = userPermissions.includes('*');
        return tabs.filter(tab => isSuperAdmin || userPermissions.includes(tab.permission));
    }, [userPermissions]);

    const [activeTab, setActiveTab] = useState<AdminTab>(visibleTabs[0]?.name || 'Branding');
    const [structureSubTab, setStructureSubTab] = useState<'assessment' | 'terms' | 'classes' | 'assignments' | 'subjects' | 'classrooms' | 'arms'>('assessment');

    const structureSubTabs = [
        { id: 'assessment' as const, label: 'Assessment Templates' },
        { id: 'terms' as const, label: 'Academic Terms' },
        { id: 'classes' as const, label: 'Academic Classes' },
        { id: 'assignments' as const, label: 'Teaching Assignments' },
        { id: 'subjects' as const, label: 'Subjects' },
        { id: 'classrooms' as const, label: 'Classes' },
        { id: 'arms' as const, label: 'Arms/Streams' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'Branding':
                return <BrandingSettings schoolConfig={schoolConfig} onSave={onSaveSchoolConfig} />;
            case 'Roles':
                return <RoleManager roles={roles} users={users} onSaveRole={props.onSaveRole} userRoleAssignments={userRoleAssignments} onUpdateRoleAssignments={props.onUpdateRoleAssignments} />;
            case 'Users':
                const rolesAsRecord = roles.reduce((acc, role: RoleDetails) => {
                    acc[role.title] = role;
                    return acc;
                }, {} as Record<string, RoleDetails>);
                return <UserManagement 
                    users={users} 
                    roles={rolesAsRecord} 
                    onInviteUser={onInviteUser}
                    onUpdateUser={onUpdateUser}
                    onDeleteUser={onDeleteUser}
                    onDeactivateUser={onDeactivateUser} 
                    campuses={campuses}
                    onUpdateUserCampus={onUpdateUserCampus}
                />;
            case 'Structure':
                return (
                    <div className="space-y-6">
                        {/* Structure sub-navigation */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-1 flex flex-wrap gap-1">
                            {structureSubTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setStructureSubTab(tab.id)}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                        structureSubTab === tab.id
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        
                        {/* Structure content */}
                        <div>
                            {structureSubTab === 'assessment' && (
                                <AssessmentStructureManager 
                                    structures={assessmentStructures} 
                                    onSave={onSaveAssessmentStructure} 
                                    onDelete={onDeleteAssessmentStructure}
                                    schoolConfig={schoolConfig}
                                />
                            )}
                            {structureSubTab === 'terms' && (
                                <TermsManager terms={terms} onSave={onSaveTerm} onDelete={onDeleteTerm} />
                            )}
                            {structureSubTab === 'classes' && (
                                <AcademicClassManager 
                                    academicClasses={academicClasses} 
                                    terms={terms} 
                                    onSave={onSaveAcademicClass} 
                                    onDelete={onDeleteAcademicClass} 
                                    classes={classes} 
                                    arms={arms}
                                    assessmentStructures={assessmentStructures}
                                    students={students}
                                    academicClassStudents={academicClassStudents}
                                    onUpdateEnrollment={onUpdateClassEnrollment}
                                    gradingSchemes={gradingSchemes}
                                    schoolConfig={schoolConfig}
                                />
                            )}
                            {structureSubTab === 'assignments' && (
                                <AcademicAssignmentManager 
                                    assignments={academicAssignments} 
                                    terms={terms} 
                                    academicClasses={academicClasses} 
                                    users={users} 
                                    onSave={onSaveAcademicAssignment} 
                                    onDelete={onDeleteAcademicAssignment} 
                                    classes={classes} 
                                    arms={arms} 
                                    subjects={subjects} 
                                    teachingEntities={teachingEntities} 
                                    onImportLegacyAssignments={onImportLegacyAssignments} 
                                />
                            )}
                            {structureSubTab === 'subjects' && (
                                <SubjectsManager subjects={subjects} onSave={onSaveSubject} onDelete={onDeleteSubject} />
                            )}
                            {structureSubTab === 'classrooms' && (
                                <ClassesManager classes={classes} onSave={onSaveClass} onDelete={onDeleteClass} />
                            )}
                            {structureSubTab === 'arms' && (
                                <ArmsManager arms={arms} onSave={onSaveArm} onDelete={onDeleteArm} />
                            )}
                        </div>
                    </div>
                );
            case 'Grading':
                return <GradingSchemeManager 
                    gradingSchemes={gradingSchemes} 
                    schoolConfig={schoolConfig} 
                    onSaveScheme={onSaveGradingScheme} 
                    onDeleteScheme={onDeleteGradingScheme} 
                    onSetActiveScheme={onSetActiveGradingScheme} 
                    onSaveSchoolConfig={onSaveSchoolConfig}
                />;
            case 'Inventory':
                return <InventoryManager inventory={inventory} onSave={onSaveInventoryItem} onDelete={onDeleteInventoryItem} />;
            case 'Rewards':
                return <RewardsManager rewards={rewards} onSave={onSaveReward} onDelete={onDeleteReward} />;

            case 'Audit Log':
                return <AuditLogView logs={auditLogs} />;
            
            case 'Advanced':
                return <AdvancedOperationsPanel onBulkResetStrikes={onBulkResetStrikes} addToast={addToast} />;
            
            default:
                return <p>Select a tab to get started.</p>;
        }
    };
    
    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Super Admin Console</h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">Global school configuration and management.</p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-8">
                <nav className="flex-shrink-0 md:w-48">
                    <ul className="space-y-1">
                        {visibleTabs.map(tab => (
                            <li key={tab.name}>
                                <button
                                    onClick={() => setActiveTab(tab.name)}
                                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                                        activeTab === tab.name
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {tab.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                <main className="flex-1 rounded-2xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 min-h-[60vh]">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
};

// Advanced Operations Panel - Super Admin Only
const AdvancedOperationsPanel: React.FC<{
    onBulkResetStrikes?: () => Promise<void>;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ onBulkResetStrikes, addToast }) => {
    const [isResetting, setIsResetting] = React.useState(false);

    const handleBulkResetStrikes = async () => {
        if (!onBulkResetStrikes) {
            addToast('This feature is not available.', 'error');
            return;
        }

        const confirmed = window.confirm(
            "⚠️ WARNING: This will reset ALL student strikes and archive ALL active infraction reports across the entire school.\n\n" +
            "This action is typically performed at the start of a new term.\n\n" +
            "Are you absolutely sure you want to continue?"
        );

        if (!confirmed) return;

        // Double confirmation for safety
        const doubleConfirmed = window.confirm(
            "FINAL CONFIRMATION:\n\n" +
            "This will affect ALL students. This action cannot be undone.\n\n" +
            "Click OK to proceed with resetting all strikes."
        );

        if (!doubleConfirmed) return;

        try {
            setIsResetting(true);
            await onBulkResetStrikes();
        } catch (error) {
            console.error('Error resetting strikes:', error);
            addToast('An error occurred while resetting strikes.', 'error');
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-lg">
                <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">⚠️ Dangerous Operations</h3>
                <p className="text-sm text-red-700 dark:text-red-400">
                    These operations are powerful and can affect the entire school. Use with extreme caution.
                </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4">
                <div>
                    <h4 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">Reset All Student Strikes</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        This will reset the strike count for ALL students and archive all active infraction reports. 
                        This is typically done at the start of a new academic term to give students a fresh start.
                    </p>
                    <button
                        onClick={handleBulkResetStrikes}
                        disabled={isResetting || !onBulkResetStrikes}
                        className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {isResetting ? (
                            <>
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Resetting...
                            </>
                        ) : (
                            <>
                                🔄 Reset All Strikes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminConsole;
