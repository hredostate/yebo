
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
}

type AdminTab = 'Branding' | 'Roles' | 'Users' | 'Structure' | 'Grading' | 'Inventory' | 'Rewards' | 'Audit Log';

const tabs: { name: AdminTab; permission: string }[] = [
    { name: 'Branding', permission: 'school.console.branding_edit' },
    { name: 'Roles', permission: 'school.console.role_admin' },
    { name: 'Users', permission: 'school.console.role_admin' },
    { name: 'Structure', permission: 'school.console.structure_edit' },
    { name: 'Grading', permission: 'school.console.structure_edit' },
    { name: 'Inventory', permission: 'school.console.structure_edit' },
    { name: 'Rewards', permission: 'school.console.structure_edit' },
    { name: 'Audit Log', permission: 'school.console.view_audit_log' },
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
        onUpdateUserPayroll
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

export default SuperAdminConsole;
