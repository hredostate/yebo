
import React, { useState, useEffect, useMemo } from 'react';
import type { Student, ReportRecord, PositiveBehaviorRecord, StudentAward, UserProfile, AIProfileInsight, BaseDataObject, StudentTermReport, CreatedCredential } from '../types';
import { StudentStatus, ReportType } from '../types';
import { STUDENT_STATUSES } from '../constants';
import Spinner from './common/Spinner';
import { WandIcon, TrashIcon } from './common/icons';
import { VIEWS } from '../constants';
import ParentCommunicationModal from './ParentCommunicationModal';
import { supa as supabase } from '../offline/client';

interface StudentProfileViewProps {
    student: Student;
    reports: ReportRecord[];
    positiveRecords: PositiveBehaviorRecord[];
    awards: StudentAward[];
    studentTermReports: StudentTermReport[];
    onBack: () => void;
    onAddPositive: (student: Student) => void;
    onGenerateInsight: (studentId: number) => Promise<AIProfileInsight | null>;
    onUpdateStudent: (studentId: number, studentData: Partial<Student>) => Promise<boolean>;
    allClasses: BaseDataObject[];
    allArms: BaseDataObject[];
    onNavigate: (view: string) => void;
    userPermissions: string[];
    onLogCommunication: (studentId: number, details: { method: string; notes: string }) => void;
    currentUser: UserProfile;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    users: UserProfile[];
    onCreateAccount?: (studentId: number) => Promise<CreatedCredential | null>;
    onResetPassword?: (userId: string) => Promise<string | null>;
    onResetStrikes?: (studentId: number) => Promise<void>;
    onDeleteAccount?: (userId: string) => Promise<boolean>;
    onDeleteStudent?: (studentId: number) => Promise<boolean>;
}

type ProfileTab = 'Overview' | 'Conduct' | 'Reports' | 'Term Reports' | 'Positive Behavior' | 'Spotlight Awards' | 'AI Insights';

// Define which report types are visible to students
// Currently, all ReportType values are internal staff reports
// Students should only see Positive Behavior records (which are in a separate table/tab)
const STUDENT_VISIBLE_REPORT_TYPES: ReportType[] = [];

const StudentProfileView: React.FC<StudentProfileViewProps> = ({
    student,
    reports,
    positiveRecords,
    awards,
    studentTermReports,
    onBack,
    onAddPositive,
    onGenerateInsight,
    onUpdateStudent,
    allClasses,
    allArms,
    onNavigate,
    userPermissions,
    onLogCommunication,
    currentUser,
    addToast,
    users,
    onCreateAccount,
    onResetPassword,
    onResetStrikes,
    onDeleteAccount,
    onDeleteStudent
}) => {
    const [activeTab, setActiveTab] = useState<ProfileTab>('Overview');
    const [insight, setInsight] = useState<AIProfileInsight | null>(null);
    const [isInsightLoading, setIsInsightLoading] = useState(false);
    const [isCommModalOpen, setIsCommModalOpen] = useState(false);
    const [initialPassword, setInitialPassword] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [isRetrieving, setIsRetrieving] = useState(false);
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [isResettingStrikes, setIsResettingStrikes] = useState(false);
    const [accountJustCreated, setAccountJustCreated] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [isDeletingStudent, setIsDeletingStudent] = useState(false);

    // Editing state
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<Partial<Student>>({});
    
    // Determine if the current viewer is a student
    const isStudentViewer = currentUser.role === 'Student';
    
    // Filter reports based on viewer type
    const visibleReports = useMemo(() => {
        // First, filter to only show reports involving this student
        const studentInvolvedReports = reports.filter(r => r.involved_students.includes(student.id));
        
        // If viewer is a student, further filter to only show student-visible report types
        if (isStudentViewer) {
            return studentInvolvedReports.filter(r => STUDENT_VISIBLE_REPORT_TYPES.includes(r.report_type));
        }
        
        // Staff can see all reports involving this student
        return studentInvolvedReports;
    }, [reports, student.id, isStudentViewer]);
    
    const studentReports = studentTermReports.filter(r => r.student_id === student.id);
    
    // Calculate Strikes (Filter out archived reports)
    const infractionReports = useMemo(() => {
        return reports.filter(r => 
            r.report_type === ReportType.Infraction && 
            r.involved_students.includes(student.id) &&
            !r.archived
        ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [reports, student.id]);

    const strikeCount = infractionReports.length;

    const canEditStructure = userPermissions.includes('school.console.structure_edit') || userPermissions.includes('*');
    const canManageAccount = ['Admin', 'Principal', 'Team Lead'].includes(currentUser.role);
    const canResetStrikes = ['Admin', 'Principal'].includes(currentUser.role);


    useEffect(() => {
        // When student prop changes, reset form data and editing state
        setFormData(student);
        setIsEditing(false);
        setInitialPassword(null);
        setUserEmail(null);
        
        // Fetch user email if student has an account
        const fetchUserEmail = async () => {
            if (student.user_id) {
                try {
                    const { data, error } = await supabase
                        .from('user_profiles')
                        .select('email')
                        .eq('id', student.user_id)
                        .single();
                    
                    if (!error && data?.email) {
                        setUserEmail(data.email);
                    } else {
                        // Fallback to student email if available
                        setUserEmail(student.email || null);
                    }
                } catch (e) {
                    console.error('Error fetching user email:', e);
                    setUserEmail(student.email || null);
                }
            }
        };
        
        fetchUserEmail();
    }, [student]);

    const handleTabClick = async (tabName: ProfileTab) => {
        setActiveTab(tabName);
        if (tabName === 'AI Insights' && !insight && !isInsightLoading) {
            setIsInsightLoading(true);
            const result = await onGenerateInsight(student.id);
            setInsight(result);
            setIsInsightLoading(false);
        }
    }
    
    const handleSave = async () => {
        setIsSaving(true);
        // Exclude id, class, arm, and user_id from update data
        // user_id should never be updated via this form - it's set by account creation
        const { id, class: _class, arm: _arm, user_id: _userId, ...updateData } = formData;
        const success = await onUpdateStudent(student.id, updateData);
        if(success) {
            setIsEditing(false);
        }
        setIsSaving(false);
    };

    const handleCopyUsername = () => {
        if (userEmail) {
            try {
                navigator.clipboard.writeText(userEmail);
                addToast('Username copied to clipboard!', 'success');
            } catch (error) {
                // Fallback for browsers that don't support clipboard API
                console.error('Failed to copy username:', error);
                addToast('Failed to copy username. Please copy manually.', 'error');
            }
        }
    };

    const handleRetrievePassword = async () => {
        if (!student.user_id) {
            addToast("This student does not have a login account.", 'error');
            return;
        }
        setIsRetrieving(true);
        setInitialPassword(null);
        const { data, error } = await supabase.rpc('get_student_initial_password', {
            p_student_user_id: student.user_id,
        });

        if (error) {
            addToast(`Error: ${error.message}`, 'error');
        } else if (data) {
            setInitialPassword(data);
            addToast("Password retrieved. It will be hidden in 15 seconds.", 'info');
            setTimeout(() => setInitialPassword(null), 15000); // Auto-hide for security
        } else {
            addToast("No initial password found for this student. They may have changed it.", 'info');
        }
        setIsRetrieving(false);
    };
    
    const handleResetPasswordAction = async () => {
        if (!student.user_id || !onResetPassword) return;
        
        if (!window.confirm(`Are you sure you want to reset the password for ${student.name}? The old password will stop working immediately.`)) {
            return;
        }
        
        try {
            setIsResettingPassword(true);
            setInitialPassword(null);
            
            // IMPORTANT: Pass the user_id (auth UUID), NOT the student.id (integer)
            const newPassword = await onResetPassword(student.user_id);
            
            if (newPassword) {
                 setInitialPassword(newPassword);
                 addToast("Password reset successfully. Please share the new credentials with the student.", 'success');
            }
        } catch (e) {
            console.error("Reset password error", e);
            addToast("An error occurred while resetting the password.", "error");
        } finally {
            setIsResettingPassword(false);
        }
    };

    const handleCreateLogin = async () => {
        if (onCreateAccount) {
            setIsCreatingAccount(true);
            const creds = await onCreateAccount(student.id);
            setIsCreatingAccount(false);
            if (creds && creds.password) {
                 setInitialPassword(creds.password);
                 // Set the username/email from the credentials
                 if (creds.email || creds.username) {
                     setUserEmail(creds.email || creds.username || null);
                 }
                 // Mark that account was just created so UI reflects account existence
                 // without using a fake UUID that would cause database errors
                 setAccountJustCreated(true);
            }
        }
    }

    const handleDeleteAccountAction = async () => {
        if (!student.user_id || !onDeleteAccount) return;
        
        if (!window.confirm(`Are you sure you want to DELETE the login account for ${student.name}? This action cannot be undone. The student will no longer be able to log in.`)) {
            return;
        }
        
        // Double confirmation for safety
        if (!window.confirm(`FINAL WARNING: This will permanently delete the authentication account. Type OK to confirm.`)) {
            return;
        }
        
        try {
            setIsDeletingAccount(true);
            const success = await onDeleteAccount(student.user_id);
            
            if (success) {
                addToast("Account deleted successfully. The student can no longer log in.", 'success');
                // Navigate back to roster since the account is deleted
                onBack();
            }
        } catch (e) {
            console.error("Delete account error", e);
            addToast("An error occurred while deleting the account.", "error");
        } finally {
            setIsDeletingAccount(false);
        }
    };

    const handleDeleteStudentAction = async () => {
        if (!onDeleteStudent) return;
        
        if (!window.confirm(`WARNING: You are about to PERMANENTLY DELETE ${student.name} from the system. This will remove all their data including reports, scores, and login credentials. This action CANNOT be undone!\n\nAre you sure?`)) {
            return;
        }
        
        if (!window.confirm(`FINAL CONFIRMATION: Delete ${student.name} permanently?`)) {
            return;
        }
        
        setIsDeletingStudent(true);
        const success = await onDeleteStudent(student.id);
        setIsDeletingStudent(false);
        
        if (success) {
            onBack(); // Navigate back to roster after deletion
        }
    };

    const handleResetStrikesClick = async () => {
        if (!onResetStrikes) return;
        if (!window.confirm(`Are you sure you want to reset strikes for ${student.name}? This will archive the infraction reports.`)) return;

        setIsResettingStrikes(true);
        await onResetStrikes(student.id);
        setIsResettingStrikes(false);
    };
    
    const copyPassword = () => {
        if (initialPassword) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(initialPassword)
                    .then(() => addToast('Password copied!', 'success'))
                    .catch(err => {
                        console.error('Clipboard error:', err);
                        addToast('Failed to copy to clipboard.', 'error');
                    });
            } else {
                addToast('Clipboard access not available.', 'info');
            }
        }
    };

    const TabButton: React.FC<{ tabName: ProfileTab, icon?: React.ReactNode }> = ({ tabName, icon }) => (
        <button
            type="button"
            onClick={() => handleTabClick(tabName)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === tabName ? 'bg-blue-600 text-white' : 'bg-slate-500/20 text-slate-700 dark:text-slate-200 hover:bg-slate-500/30'}`}
        >
            {icon}
            {tabName}
        </button>
    );
    
    const renderContent = () => {
        switch (activeTab) {
            case 'Conduct':
                return (
                    <div className="space-y-6">
                        <div className="p-6 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 text-center relative">
                             <h3 className="text-lg font-bold text-red-900 dark:text-red-200 mb-2">Strike Count</h3>
                             <div className="flex justify-center gap-4 text-4xl mb-4">
                                 {/* Strike Indicators */}
                                 <span title="Strike 1">{strikeCount >= 1 ? '🔴' : '⚪'}</span>
                                 <span title="Strike 2">{strikeCount >= 2 ? '🔴' : '⚪'}</span>
                                 <span title="Strike 3">{strikeCount >= 3 ? '🔴' : '⚪'}</span>
                             </div>
                             <p className="text-sm text-red-800 dark:text-red-300 font-semibold">
                                {strikeCount >= 3 ? 'Status: SUSPENDED (3 Strikes)' : `${strikeCount} / 3 Strikes Recorded`}
                             </p>
                             <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                Policy: 3 minor infraction strikes in a term result in an automatic suspension.
                             </p>
                             {canResetStrikes && strikeCount > 0 && (
                                 <button 
                                    onClick={handleResetStrikesClick} 
                                    disabled={isResettingStrikes}
                                    className="mt-4 px-4 py-2 text-xs font-bold text-red-700 border border-red-300 rounded hover:bg-red-100 disabled:opacity-50"
                                >
                                    {isResettingStrikes ? 'Resetting...' : 'Reset Strikes'}
                                </button>
                             )}
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-white mb-3">Active Infractions</h4>
                            {infractionReports.length > 0 ? (
                                <div className="space-y-3">
                                    {infractionReports.map((report, idx) => (
                                        <div key={report.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800/50 flex items-start gap-4">
                                             <div className="font-bold text-lg text-red-500 min-w-[2rem]">#{infractionReports.length - idx}</div>
                                             <div>
                                                 <p className="text-sm text-slate-800 dark:text-slate-200">{report.report_text}</p>
                                                 <p className="text-xs text-slate-500 mt-1">Reported by {report.author?.name} on {new Date(report.created_at).toLocaleDateString()}</p>
                                             </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 italic">No active infractions for this student.</p>
                            )}
                        </div>
                    </div>
                );
            case 'Reports':
                return (
                    <div className="space-y-4">
                        {visibleReports.length > 0 ? visibleReports.map(report => (
                            <div key={report.id} className={`p-4 border rounded-lg ${report.archived ? 'bg-slate-100 dark:bg-slate-900 opacity-60 border-slate-200' : 'bg-slate-500/10 border-slate-200/60 dark:border-slate-700/60'}`}>
                                <div className="flex justify-between">
                                    <p className="font-semibold text-slate-800 dark:text-white">{report.report_type} Report #{report.id}</p>
                                    {report.archived && <span className="text-xs bg-slate-300 text-slate-700 px-2 py-0.5 rounded">Archived</span>}
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{report.report_text}</p>
                                {report.involved_staff.length > 0 && (
                                     <div className="mt-2">
                                        <h4 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Involved Staff</h4>
                                        <p className="text-sm text-slate-700 dark:text-slate-200">{report.involved_staff.map(staffId => users.find(u => u.id === staffId)?.name).filter(Boolean).join(', ')}</p>
                                    </div>
                                )}
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">By {report.author?.name || 'Unknown User'} on {new Date(report.created_at).toLocaleDateString()}</p>
                            </div>
                        )) : (
                            <p className="text-slate-600 dark:text-slate-400">
                                {isStudentViewer 
                                    ? "No reports available. Check the 'Positive Behavior' tab for recognitions." 
                                    : "No reports involving this student."}
                            </p>
                        )}
                    </div>
                );
            case 'Term Reports':
                return (
                    <div className="space-y-4">
                        {studentReports.length > 0 ? studentReports.map(report => (
                            <div key={report.id} className="p-4 bg-slate-500/10 border border-slate-200/60 dark:border-slate-700/60 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-slate-800 dark:text-white">{report.term?.term_label}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{report.term?.session_label}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onNavigate(`${VIEWS.STUDENT_REPORT}/${student.id}/${report.term_id}`)}
                                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg"
                                >
                                    View Report Card
                                </button>
                            </div>
                        )) : <p className="text-slate-600 dark:text-slate-400">No final term reports available for this student.</p>}
                    </div>
                );
            case 'Positive Behavior':
                 return (
                    <div className="space-y-4">
                        {positiveRecords.length > 0 ? positiveRecords.map(record => (
                            <div key={record.id} className="p-4 bg-green-500/10 border border-green-200/60 dark:border-green-700/60 rounded-lg">
                                <p className="text-sm text-green-800 dark:text-green-300">"{record.description}"</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-right">
                                    Logged by {record.author?.name || 'Unknown User'} on {new Date(record.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        )) : <p className="text-slate-600 dark:text-slate-400">No positive behavior logged yet.</p>}
                    </div>
                );
            case 'Spotlight Awards':
                return (
                    <div className="space-y-4">
                        {awards.length > 0 ? awards.map(award => (
                            <div key={award.id} className="p-4 bg-amber-500/10 border border-amber-200/60 dark:border-amber-700/60 rounded-lg">
                                <p className="font-semibold text-amber-800 dark:text-amber-300">{award.award_type}</p>
                                <p className="italic text-slate-700 dark:text-slate-200 mt-1">"{award.reason}"</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                    Awarded on {new Date(award.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        )) : <p className="text-slate-600 dark:text-slate-400">No spotlight awards received yet.</p>}
                    </div>
                );
            case 'AI Insights':
                if (isInsightLoading) {
                    return <div className="text-center p-10"><Spinner size="lg"/><p className="mt-2 text-slate-500">Generating AI Insights...</p></div>;
                }
                if (!insight) {
                    return <div className="text-center p-10 text-slate-500">Could not generate AI insights for this student.</div>;
                }
                return (
                    <div className="space-y-6">
                        <div className="p-4 bg-purple-500/10 border-l-4 border-purple-400 rounded-r-lg">
                            <h4 className="font-semibold text-purple-800 dark:text-purple-200">Behavioral Synopsis</h4>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{insight.synopsis}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-3 bg-green-500/10 rounded-lg">
                                <h4 className="font-semibold text-green-800 dark:text-green-300">Potential Strengths</h4>
                                <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 mt-1">
                                    {insight.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                            <div className="p-3 bg-yellow-500/10 rounded-lg">
                                <h4 className="font-semibold text-yellow-800 dark:text-yellow-300">Areas for Growth</h4>
                                <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 mt-1">
                                    {insight.growthAreas.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                             <div className="p-3 bg-blue-500/10 rounded-lg">
                                <h4 className="font-semibold text-blue-800 dark:text-blue-300">Suggested Next Steps</h4>
                                <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 mt-1">
                                    {insight.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                        </div>
                    </div>
                )
            case 'Overview':
            default:
                 return (
                    <>
                        {/* Login Account Information - Show username if account exists */}
                        {student.user_id && userEmail && (
                            <div className="mb-4 p-4 bg-blue-100 border-l-4 border-blue-500 rounded-r-lg dark:bg-blue-900/30 dark:border-blue-400">
                                <h4 className="font-semibold text-blue-800 dark:text-blue-300">Student Login Account</h4>
                                <div className="mt-2 space-y-2">
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1">
                                            <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">Username/Email:</p>
                                            <p className="font-mono text-sm font-bold text-blue-900 dark:text-blue-100">{userEmail}</p>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={handleCopyUsername} 
                                            className="px-3 py-1 text-sm bg-slate-200 rounded-md hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
                                        >
                                            Copy Username
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">Students log in using this username/email. Use "Retrieve Password" above to get their current password.</p>
                            </div>
                        )}
                        
                        {initialPassword && (
                            <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 rounded-r-lg animate-fade-in dark:bg-yellow-900/30 dark:border-yellow-400">
                                <h4 className="font-semibold text-yellow-800 dark:text-yellow-300">Student Password (Temporary)</h4>
                                <div className="flex items-center gap-4 mt-2">
                                    <p className="font-mono text-lg font-bold text-yellow-900 dark:text-yellow-100">{initialPassword}</p>
                                    <button 
                                        type="button" 
                                        onClick={copyPassword} 
                                        className="px-3 py-1 text-sm bg-slate-200 rounded-md hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
                                    >
                                        Copy Password
                                    </button>
                                </div>
                                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">This password is shown temporarily. Please share it with the student immediately.</p>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-500/10 p-4 rounded-lg text-slate-700 dark:text-slate-200 md:col-span-2">
                                <h4 className="font-semibold text-slate-800 dark:text-white mb-2">Student Details</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                                   {/* Render fields or inputs based on isEditing */}
                                   <EditableField label="Full Name" value={formData.name || ''} isEditing={isEditing} onChange={v => setFormData(p => ({...p, name: v}))} />
                                   <EditableField label="Admission #" value={formData.admission_number || ''} isEditing={isEditing && canEditStructure} onChange={v => setFormData(p => ({...p, admission_number: v}))} />
                                   <EditableField label="Class" value={formData.class_id || ''} isEditing={isEditing} onChange={v => setFormData(p => ({...p, class_id: Number(v)}))} type="select" options={allClasses} displayValue={student.class?.name} />
                                   <EditableField label="Arm" value={formData.arm_id || ''} isEditing={isEditing} onChange={v => setFormData(p => ({...p, arm_id: Number(v)}))} type="select" options={allArms} displayValue={student.arm?.name} />
                                   <EditableField label="Enrollment Status" value={formData.status || ''} isEditing={isEditing} onChange={v => setFormData(p => ({...p, status: v as any}))} type="status-select" />
                                   <EditableField label="Date of Birth" value={formData.date_of_birth || ''} isEditing={isEditing} onChange={v => setFormData(p => ({...p, date_of_birth: v}))} type="date" />
                                   <EditableField label="Email" value={formData.email || ''} isEditing={isEditing} onChange={v => setFormData(p => ({...p, email: v}))} />
                                   <EditableField label="Parent's Phone 1" value={formData.parent_phone_number_1 || ''} isEditing={isEditing} onChange={v => setFormData(p => ({...p, parent_phone_number_1: v}))} />
                                   <EditableField label="Parent's Phone 2" value={formData.parent_phone_number_2 || ''} isEditing={isEditing} onChange={v => setFormData(p => ({...p, parent_phone_number_2: v}))} />
                                   <EditableField label="Address" value={formData.address || ''} isEditing={isEditing} onChange={v => setFormData(p => ({...p, address: v}))} type="textarea" className="col-span-full" />
                                </div>
                            </div>
                            <div className="bg-red-500/10 p-4 rounded-lg text-center">
                                <h4 className="font-semibold text-red-700 dark:text-red-300 mb-1">Reports</h4>
                                <p className="text-4xl font-bold text-red-600 dark:text-red-400">{visibleReports.length}</p>
                            </div>
                            <div className="bg-green-500/10 p-4 rounded-lg text-center">
                                 <h4 className="font-semibold text-green-700 dark:text-green-300 mb-1">Recognitions</h4>
                                 <p className="text-4xl font-bold text-green-600 dark:text-green-400">{positiveRecords.length}</p>
                            </div>
                            <div className="bg-amber-500/10 p-4 rounded-lg text-center col-span-2 md:col-span-1">
                                 <h4 className="font-semibold text-amber-700 dark:text-amber-300 mb-1">Reward Points ⭐</h4>
                                 <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">{student.reward_points || 0}</p>
                            </div>
                        </div>
                    </>
                );
        }
    }

    return (
        <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 animate-fade-in">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        {student.name}
                        {student.status === StudentStatus.DisciplinarySuspension && (
                            <span className="px-2 py-1 text-xs bg-red-600 text-white rounded-full">SUSPENDED</span>
                        )}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">Student Profile</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    {isEditing ? (
                        <>
                         <button type="button" onClick={() => setIsEditing(false)} disabled={isSaving} className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30">Cancel</button>
                         <button type="button" onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-green-400 flex items-center min-w-[80px] justify-center">
                             {isSaving ? <Spinner size="sm"/> : 'Save'}
                         </button>
                        </>
                    ) : (
                        <button type="button" onClick={() => setIsEditing(true)} className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30">Edit Profile</button>
                    )}
                    <button type="button" onClick={() => setIsCommModalOpen(true)} className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700">Log Communication</button>
                    
                    {/* Account Management */}
                    {canManageAccount && (
                         (student.user_id || accountJustCreated) ? (
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleRetrievePassword}
                                    disabled={isRetrieving || accountJustCreated}
                                    className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 disabled:bg-yellow-300 flex items-center min-w-[160px] justify-center"
                                >
                                    {isRetrieving ? <Spinner size="sm"/> : 'Retrieve Password'}
                                </button>
                                {onResetPassword && (
                                    <button
                                        type="button"
                                        onClick={handleResetPasswordAction}
                                        disabled={isResettingPassword || accountJustCreated}
                                        className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 disabled:bg-red-300 flex items-center justify-center"
                                    >
                                        {isResettingPassword ? <Spinner size="sm"/> : 'Reset'}
                                    </button>
                                )}
                                {onDeleteAccount && student.user_id && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteAccountAction}
                                        disabled={isDeletingAccount || accountJustCreated}
                                        className="px-4 py-2 bg-red-700 text-white font-semibold rounded-lg hover:bg-red-800 disabled:bg-red-400 flex items-center justify-center"
                                        title="Permanently delete login account"
                                    >
                                        {isDeletingAccount ? <Spinner size="sm"/> : 'Delete Account'}
                                    </button>
                                )}
                            </div>
                         ) : (
                             <button 
                                type="button"
                                onClick={handleCreateLogin}
                                disabled={isCreatingAccount}
                                className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-purple-400 flex items-center min-w-[150px] justify-center"
                             >
                                 {isCreatingAccount ? <Spinner size="sm"/> : 'Create Login'}
                             </button>
                         )
                    )}

                    <button type="button" onClick={() => onAddPositive(student)} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Log Positive Behavior</button>
                    
                    {onDeleteStudent && canManageAccount && (
                        <button
                            type="button"
                            onClick={handleDeleteStudentAction}
                            disabled={isDeletingStudent}
                            className="px-4 py-2 bg-red-700 text-white font-semibold rounded-lg hover:bg-red-800 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isDeletingStudent ? <Spinner size="sm" /> : <TrashIcon className="w-4 h-4" />}
                            Delete Student
                        </button>
                    )}
                    
                    <button type="button" onClick={onBack} className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30">Back</button>
                </div>
            </div>

            <div className="mb-6">
                <div className="flex space-x-2 border-b border-slate-200/60 dark:border-slate-700/60 pb-2 overflow-x-auto">
                   <TabButton tabName="Overview" />
                   <TabButton tabName="Conduct" />
                   <TabButton tabName="Reports" />
                   <TabButton tabName="Term Reports" />
                   <TabButton tabName="Positive Behavior" />
                   <TabButton tabName="Spotlight Awards" />
                   <TabButton tabName="AI Insights" icon={<WandIcon className="w-4 h-4" />} />
                </div>
            </div>

            <div className="mt-4 min-h-[200px]">
                {renderContent()}
            </div>
            
            <ParentCommunicationModal 
                isOpen={isCommModalOpen}
                onClose={() => setIsCommModalOpen(false)}
                student={student}
                onLogCommunication={async (studentId, details) => {
                    onLogCommunication(studentId, details);
                    setIsCommModalOpen(false);
                }}
            />
        </div>
    );
};

// Helper component for editable fields
const EditableField: React.FC<{
    label: string;
    value: string | number;
    isEditing: boolean;
    onChange: (value: string) => void;
    type?: 'text' | 'date' | 'select' | 'status-select' | 'textarea';
    options?: BaseDataObject[];
    displayValue?: string | null;
    className?: string;
}> = ({ label, value, isEditing, onChange, type = 'text', options, displayValue, className = '' }) => {
    const commonInputClasses = "w-full p-2 mt-1 text-sm bg-slate-500/10 border border-slate-300/60 dark:border-slate-700/60 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-200/50 dark:disabled:bg-slate-700/50 disabled:cursor-not-allowed";
    const statusInfo = STUDENT_STATUSES.find(s => s.value === value);

    return (
        <div className={className}>
            <strong className="text-xs text-slate-500 dark:text-slate-400 uppercase">{label}</strong>
            {isEditing ? (
                <>
                    {type === 'select' && options && (
                        <select value={value} onChange={e => onChange(e.target.value)} className={commonInputClasses} disabled={!isEditing}>
                            <option value="">Select...</option>
                            {options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                    )}
                    {type === 'status-select' && (
                        <select value={value} onChange={e => onChange(e.target.value)} className={commonInputClasses} disabled={!isEditing}>
                             {STUDENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    )}
                    {type === 'textarea' && <textarea value={value as string} onChange={e => onChange(e.target.value)} className={commonInputClasses} rows={2} disabled={!isEditing} />}
                    {(type === 'text' || type === 'date') && <input type={type} value={value as string} onChange={e => onChange(e.target.value)} className={commonInputClasses} disabled={!isEditing} />}
                </>
            ) : (
                <p className="truncate mt-1">
                    {type === 'status-select' 
                        ? (statusInfo?.label || value) 
                        : (type === 'date' && value ? new Date(value as string).toLocaleDateString() : displayValue || value || 'N/A')}
                </p>
            )}
        </div>
    );
};


export default StudentProfileView;
