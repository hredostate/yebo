import React, { useState, useMemo, useCallback } from 'react';
import type { UserProfile, PayrollRun, PayrollItem, PayrollAdjustment, SchoolConfig, Campus, TeacherShift, LeaveType, LeaveRequest, Team } from '../types';
import { LeaveRequestStatus } from '../types';
import MyPayrollView from './MyPayrollView';
import MyAdjustmentsView from './MyAdjustmentsView';
import PayrollPage from './PayrollPage';
import StaffPayrollManager, { NIGERIAN_BANKS } from './StaffPayrollManager';
import PayrollAdjustmentsManager from './PayrollAdjustmentsManager';
import PayrollSettings from './PayrollSettings';
import PayrollManager from './PayrollManager';
import ShiftManager from './ShiftManager';
import LeaveTypesManager from './LeaveTypesManager';
import CampusesManager from './CampusesManager';
import MyLeaveView from './MyLeaveView';
import LeaveApprovalView from './LeaveApprovalView';
import { BanknotesIcon, UsersIcon, CalendarIcon, BuildingIcon, ClockIcon, EditIcon, ChartBarIcon } from './common/icons';
import Spinner from './common/Spinner';
import { supa as supabase } from '../offline/client';


interface HRPayrollModuleProps {
    userProfile: UserProfile;
    users: UserProfile[];
    payrollRuns: PayrollRun[];
    payrollItems: PayrollItem[];
    payrollAdjustments: PayrollAdjustment[];
    schoolConfig: SchoolConfig | null;
    onRunPayroll: (staffPay: Record<string, { base_pay: string, commission: string }>) => Promise<void>;
    onUpdateUserPayroll: (userId: string, data: Partial<UserProfile>) => Promise<void>;
    onSaveSchoolConfig: (config: Partial<SchoolConfig>) => Promise<boolean>;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    userPermissions: string[];
    campuses: Campus[];
    teacherShifts: TeacherShift[];
    onSaveShift: (shift: Partial<TeacherShift>) => Promise<boolean>;
    onDeleteShift: (id: number) => Promise<boolean>;
    leaveTypes: LeaveType[];
    onSaveLeaveType: (leaveType: Partial<LeaveType>) => Promise<boolean>;
    onDeleteLeaveType: (id: number) => Promise<boolean>;
    onSaveCampus: (campus: Partial<Campus>) => Promise<boolean>;
    onDeleteCampus: (id: number) => Promise<boolean>;
    leaveRequests: LeaveRequest[];
    onSubmitLeaveRequest: (request: Partial<LeaveRequest>) => Promise<boolean>;
    onApproveLeaveRequest: (requestId: number, status: 'Approved' | 'Rejected', notes?: string) => Promise<boolean>;
    teams: Team[];
}

const BankDetailsModal: React.FC<{
    user: UserProfile;
    onClose: () => void;
    onSave: (userId: string, data: Partial<UserProfile>) => Promise<void>;
}> = ({ user, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        bank_code: user.bank_code || '',
        account_number: user.account_number || '',
        account_name: user.account_name || '',
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        
        const bankName = NIGERIAN_BANKS.find(b => b.code === formData.bank_code)?.name || '';

        await onSave(user.id, {
            bank_code: formData.bank_code,
            bank_name: bankName,
            account_number: formData.account_number,
            account_name: formData.account_name,
        });
        
        setIsSaving(false);
        onClose();
    };

    const inputClasses = "mt-1 block w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-800/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm";
    const labelClasses = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <BanknotesIcon className="w-6 h-6 text-green-600"/>
                        Update Bank Details
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Ensure your payment information is accurate.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className={labelClasses}>Bank</label>
                        <select name="bank_code" value={formData.bank_code} onChange={handleChange} className={inputClasses} required>
                            <option value="">Select Bank...</option>
                            {NIGERIAN_BANKS.map(bank => (
                                <option key={bank.code} value={bank.code}>{bank.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClasses}>Account Number</label>
                        <input type="text" name="account_number" value={formData.account_number} onChange={handleChange} className={inputClasses} maxLength={10} placeholder="10 digits" required />
                    </div>
                    <div>
                        <label className={labelClasses}>Account Name</label>
                        <input type="text" name="account_name" value={formData.account_name} onChange={handleChange} className={inputClasses} placeholder="As per bank records" required />
                    </div>
                    
                    <div className="pt-4 flex justify-end gap-3">
                         <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSaving} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2">
                            {isSaving ? <Spinner size="sm" /> : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

type ModuleSection = 'overview' | 'my_payslips' | 'my_leave' | 'my_adjustments' | 'run_payroll' | 'payroll_history' | 'staff_data' | 'adjustments' | 'leave_approvals' | 'shifts' | 'leave_types' | 'campuses' | 'settings';

const HRPayrollModule: React.FC<HRPayrollModuleProps> = ({
    userProfile,
    users,
    payrollRuns,
    payrollItems,
    payrollAdjustments,
    schoolConfig,
    onRunPayroll,
    onUpdateUserPayroll,
    onSaveSchoolConfig,
    addToast,
    userPermissions,
    campuses,
    teacherShifts,
    onSaveShift,
    onDeleteShift,
    leaveTypes,
    onSaveLeaveType,
    onDeleteLeaveType,
    onSaveCampus,
    onDeleteCampus,
    leaveRequests,
    onSubmitLeaveRequest,
    onApproveLeaveRequest,
    teams
}) => {
    // Add null safety for all props including userProfile
    if (!userProfile) {
        return (
            <div className="flex flex-col items-center justify-center h-96 space-y-4">
                <p className="text-lg text-slate-500">Loading user profile...</p>
            </div>
        );
    }
    
    const safeUserProfile = userProfile;
    const safeUsers = users || [];
    const safePayrollRuns = payrollRuns || [];
    const safePayrollItems = payrollItems || [];
    const safePayrollAdjustments = payrollAdjustments || [];
    const safeCampuses = campuses || [];
    const safeTeacherShifts = teacherShifts || [];
    const safeLeaveTypes = leaveTypes || [];
    const safeLeaveRequests = leaveRequests || [];
    const safeUserPermissions = userPermissions || [];
    const safeTeams = teams || [];

    const canManagePayroll = safeUserPermissions.includes('manage-payroll') || safeUserPermissions.includes('*');
    const canManageHR = safeUserPermissions.includes('school.console.structure_edit') || safeUserPermissions.includes('*');
    
    // All hooks MUST be called before any conditional returns (React rules of hooks)
    const [activeSection, setActiveSection] = useState<ModuleSection>(canManagePayroll ? 'overview' : 'my_payslips');
    const [isBankModalOpen, setIsBankModalOpen] = useState(false);

    // Calculate overview stats
    const stats = useMemo(() => {
        const staffCount = safeUsers.filter(u => u.role !== 'Student' && u.role !== 'Guardian').length;
        const pendingLeave = safeLeaveRequests.filter(r => r.status === 'Pending').length;
        const sortedRuns = [...safePayrollRuns].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const lastPayroll = sortedRuns[0];
        const totalPayrollAmount = lastPayroll 
            ? safePayrollItems.filter(i => i.payroll_run_id === lastPayroll.id).reduce((sum, i) => sum + (i.net_pay || 0), 0)
            : 0;
        
        return { staffCount, pendingLeave, lastPayroll, totalPayrollAmount };
    }, [safeUsers, safeLeaveRequests, safePayrollRuns, safePayrollItems]);

    // Reconstruct runs for history view
    const richRuns = useMemo(() => {
        return safePayrollRuns.map(run => ({
            ...run,
            items: safePayrollItems.filter(item => item.payroll_run_id === run.id).map(item => ({
                ...item,
                user: safeUsers.find(u => u.id === item.user_id)
            }))
        }));
    }, [safePayrollRuns, safePayrollItems, safeUsers]);

    const handleDeleteLeaveRequest = useCallback(async (id: number): Promise<boolean> => {
        try {
            if (!supabase) {
                addToast('Database client not available', 'error');
                return false;
            }
            
            const { error } = await supabase.from('leave_requests').delete().eq('id', id);
            if (error) {
                console.error('Failed to delete leave request:', error);
                addToast('Failed to delete leave request', 'error');
                return false;
            }
            addToast('Leave request deleted', 'success');
            return true;
        } catch (e: any) {
            console.error('Exception deleting leave request:', e);
            addToast(e.message, 'error');
            return false;
        }
    }, [addToast]);

    const handleGeneratePayslips = async (runId: number) => {
        try {
            if (!supabase || !supabase.functions) {
                throw new Error('Supabase functions not available');
            }
            const { error } = await supabase.functions.invoke('generate-payslips', { body: { run_id: runId } });
            if(error) throw error;
            addToast('Payslips generated successfully.', 'success');
        } catch(e: any) {
            addToast(e.message, 'error');
        }
    };

    const navSections = [
        { id: 'overview' as const, label: 'Overview', icon: ChartBarIcon, show: canManagePayroll || canManageHR },
        { id: 'my_payslips' as const, label: 'My Payslips', icon: BanknotesIcon, show: true },
        { id: 'my_leave' as const, label: 'My Leave', icon: CalendarIcon, show: true },
        { id: 'my_adjustments' as const, label: 'My Adjustments', icon: EditIcon, show: true },
        { id: 'run_payroll' as const, label: 'Run Payroll', icon: BanknotesIcon, show: canManagePayroll, divider: true },
        { id: 'payroll_history' as const, label: 'Payroll History', icon: ClockIcon, show: canManagePayroll },
        { id: 'staff_data' as const, label: 'Staff Data', icon: UsersIcon, show: canManagePayroll },
        { id: 'adjustments' as const, label: 'Manage Adjustments', icon: EditIcon, show: canManagePayroll },
        { id: 'leave_approvals' as const, label: 'Leave Approvals', icon: CalendarIcon, show: canManagePayroll || canManageHR, divider: true },
        { id: 'shifts' as const, label: 'Shifts', icon: ClockIcon, show: canManageHR },
        { id: 'leave_types' as const, label: 'Leave Types', icon: CalendarIcon, show: canManageHR },
        { id: 'campuses' as const, label: 'Campuses', icon: BuildingIcon, show: canManageHR },
        { id: 'settings' as const, label: 'Payroll Settings', icon: EditIcon, show: canManagePayroll, divider: true },
    ];

    const renderContent = () => {
        switch (activeSection) {
            case 'overview':
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-blue-100 text-sm">Total Staff</p>
                                        <p className="text-3xl font-bold mt-1">{stats.staffCount}</p>
                                    </div>
                                    <UsersIcon className="w-8 h-8 text-blue-200" />
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-5 text-white">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-amber-100 text-sm">Pending Leave</p>
                                        <p className="text-3xl font-bold mt-1">{stats.pendingLeave}</p>
                                    </div>
                                    <CalendarIcon className="w-8 h-8 text-amber-200" />
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-green-100 text-sm">Last Payroll</p>
                                        <p className="text-3xl font-bold mt-1">₦{stats.totalPayrollAmount.toLocaleString()}</p>
                                    </div>
                                    <BanknotesIcon className="w-8 h-8 text-green-200" />
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-5 text-white">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-purple-100 text-sm">Campuses</p>
                                        <p className="text-3xl font-bold mt-1">{safeCampuses.length}</p>
                                    </div>
                                    <BuildingIcon className="w-8 h-8 text-purple-200" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <CalendarIcon className="w-5 h-5 text-amber-500" />
                                    Pending Leave Requests
                                </h3>
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {safeLeaveRequests.filter(r => r.status === 'Pending').slice(0, 5).map(req => {
                                        const user = safeUsers.find(u => u.id === req.user_id);
                                        const leaveType = safeLeaveTypes.find(lt => lt.id === req.leave_type_id);
                                        return (
                                            <div key={req.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <div>
                                                    <p className="font-medium">{user?.name || 'Unknown'}</p>
                                                    <p className="text-xs text-slate-500">{leaveType?.name} • {new Date(req.start_date).toLocaleDateString()}</p>
                                                </div>
                                                <button 
                                                    onClick={() => setActiveSection('leave_approvals')}
                                                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                                                >
                                                    Review
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {safeLeaveRequests.filter(r => r.status === 'Pending').length === 0 && (
                                        <p className="text-slate-500 text-center py-4">No pending leave requests</p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <ClockIcon className="w-5 h-5 text-blue-500" />
                                    Recent Payroll Runs
                                </h3>
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {richRuns.slice(0, 5).map(run => (
                                        <div key={run.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                            <div>
                                                <p className="font-medium">{run.pay_period_label || `Run #${run.id}`}</p>
                                                <p className="text-xs text-slate-500">{new Date(run.created_at).toLocaleDateString()} • {run.items?.length || 0} staff</p>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded ${run.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {run.status}
                                            </span>
                                        </div>
                                    ))}
                                    {richRuns.length === 0 && (
                                        <p className="text-slate-500 text-center py-4">No payroll runs yet</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'my_payslips':
                return <MyPayrollView currentUser={userProfile} payrollRuns={safePayrollRuns} payrollItems={safePayrollItems} />;
            case 'my_leave':
                return <MyLeaveView 
                    currentUser={safeUserProfile} 
                    leaveTypes={safeLeaveTypes} 
                    leaveRequests={safeLeaveRequests} 
                    onSave={onSubmitLeaveRequest}
                    onDelete={handleDeleteLeaveRequest}
                    addToast={addToast}
                />;
            case 'my_adjustments':
                return <MyAdjustmentsView currentUser={userProfile} />;
            case 'run_payroll':
                return <PayrollPage staffForPayroll={safeUsers.filter(u => u.role !== 'Student' && u.role !== 'Guardian')} adjustments={safePayrollAdjustments} onRunPayroll={onRunPayroll} campuses={safeCampuses} />;
            case 'payroll_history':
                return <PayrollManager runs={richRuns} handleGeneratePayslips={handleGeneratePayslips} />;
            case 'staff_data':
                return <StaffPayrollManager users={safeUsers} onUpdateUserPayroll={onUpdateUserPayroll} campuses={safeCampuses} />;
            case 'adjustments':
                return <PayrollAdjustmentsManager users={safeUsers} addToast={addToast} campuses={safeCampuses} />;
            case 'leave_approvals':
                return <LeaveApprovalView 
                    currentUser={safeUserProfile}
                    addToast={addToast}
                    allRequests={safeLeaveRequests}
                    onUpdateStatus={async (requestId: number, status: LeaveRequestStatus): Promise<boolean> => {
                        // LeaveApprovalView uses LeaveRequestStatus enum (lowercase: 'approved', 'rejected')
                        // but the parent handler expects capitalized strings ('Approved', 'Rejected')
                        // This conversion maintains the existing API contract
                        const mappedStatus = status === LeaveRequestStatus.Approved ? 'Approved' : 
                                            status === LeaveRequestStatus.Rejected ? 'Rejected' : 
                                            null;
                        if (!mappedStatus) {
                            addToast('Invalid status update', 'error');
                            return false;
                        }
                        return await onApproveLeaveRequest(requestId, mappedStatus);
                    }}
                    teams={safeTeams}
                />;
            case 'shifts':
                return <ShiftManager shifts={safeTeacherShifts} users={safeUsers} onSave={onSaveShift} onDelete={onDeleteShift} />;
            case 'leave_types':
                return <LeaveTypesManager leaveTypes={safeLeaveTypes} onSave={onSaveLeaveType} onDelete={onDeleteLeaveType} />;
            case 'campuses':
                return <CampusesManager campuses={safeCampuses} onSave={onSaveCampus} onDelete={onDeleteCampus} />;
            case 'settings':
                return <PayrollSettings schoolConfig={schoolConfig} onSave={onSaveSchoolConfig} />;
            default:
                return (
                    <div className="text-center py-8 text-slate-500">
                        <p>Section not found. Please select a valid option from the menu.</p>
                    </div>
                );
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <BanknotesIcon className="w-8 h-8 text-green-600" />
                        HR & Payroll
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">Manage staff, salaries, leave, and HR operations.</p>
                </div>
                
                {['my_payslips', 'my_leave', 'my_adjustments'].includes(activeSection) && (
                    <button 
                        onClick={() => setIsBankModalOpen(true)} 
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors"
                    >
                        <EditIcon className="w-4 h-4 text-blue-600" />
                        Update Bank Details
                    </button>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar Navigation */}
                <nav className="lg:w-56 flex-shrink-0">
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-2 space-y-1 sticky top-4">
                        {navSections.filter(s => s.show).map((section, idx, arr) => {
                            const prevSection = arr[idx - 1];
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
                            {renderContent()}
                        </ErrorBoundary>
                    </div>
                </main>
            </div>
            
            {isBankModalOpen && (
                <BankDetailsModal 
                    user={userProfile} 
                    onClose={() => setIsBankModalOpen(false)} 
                    onSave={onUpdateUserPayroll} 
                />
            )}
        </div>
    );
};

// Simple Error Boundary Component for HR Payroll Module
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; errorMessage?: string }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        // In production, use a generic message. In development, show the actual error.
        const safeMessage = process.env.NODE_ENV === 'development' 
            ? (error.message || 'An unexpected error occurred')
            : 'An unexpected error occurred';
        return { hasError: true, errorMessage: safeMessage };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log full error details to console for debugging
        console.error('HR Payroll Module Error:', error, errorInfo);
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
                    {/* Only show error details in development mode */}
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

export default HRPayrollModule;
