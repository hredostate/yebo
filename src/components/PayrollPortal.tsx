
import React, { useState, useEffect } from 'react';
import type { UserProfile, PayrollRun, PayrollItem, PayrollAdjustment, SchoolConfig, Campus } from '../types';
import MyPayrollView from './MyPayrollView';
import MyAdjustmentsView from './MyAdjustmentsView';
import PayrollPage from './PayrollPage';
import StaffPayrollManager, { NIGERIAN_BANKS } from './StaffPayrollManager';
import PayrollAdjustmentsManager from './PayrollAdjustmentsManager';
import PayrollSettings from './PayrollSettings';
import PayrollManager from './PayrollManager'; // For History view
import { BanknotesIcon, EditIcon } from './common/icons';
import Spinner from './common/Spinner';
import { useCan } from '../security/permissions';

interface PayrollPortalProps {
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

const PayrollPortal: React.FC<PayrollPortalProps> = ({
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
    campuses
}) => {
    const canAccess = useCan({ role: userProfile.role, permissions: userPermissions, userId: userProfile.id });
    const canViewPayroll = canAccess('view', 'payroll');
    const canViewOwnPayslip = canAccess('view', 'payroll_self', userProfile.id);

    if (!canViewPayroll && !canViewOwnPayslip) {
        return <div className="p-6 text-red-600 bg-red-50 border border-red-200 rounded-lg">You are not authorized to view payroll data.</div>;
    }

    const canManage = canAccess('manage', 'payroll');
    const [activeTab, setActiveTab] = useState(canManage ? 'run' : 'slips');
    const [isBankModalOpen, setIsBankModalOpen] = useState(false);

    // Reconstruct runs to include items and user info for history view
    const richRuns = React.useMemo(() => {
        return payrollRuns.map(run => ({
            ...run,
            items: payrollItems.filter(item => item.payroll_run_id === run.id).map(item => ({
                ...item,
                user: users.find(u => u.id === item.user_id)
            }))
        }));
    }, [payrollRuns, payrollItems, users]);

    const tabs = [
        { id: 'slips', label: 'My Payslips', show: true },
        { id: 'my_adjustments', label: 'My Adjustments', show: true },
        { id: 'run', label: 'Run Payroll', show: canManage },
        { id: 'history', label: 'Payroll History', show: canManage },
        { id: 'staff', label: 'Staff Data', show: canManage },
        { id: 'adjustments', label: 'Manage Adjustments', show: canManage },
        { id: 'settings', label: 'Settings', show: canManage },
    ];
    
    const handleGeneratePayslips = async (runId: number) => {
       try {
           const { error } = await (window as any).supa.functions.invoke('generate-payslips', { body: { run_id: runId } });
           if(error) throw error;
           addToast('Payslips generated successfully.', 'success');
       } catch(e: any) {
           addToast(e.message, 'error');
       }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <BanknotesIcon className="w-8 h-8 text-green-600" />
                        Payroll Portal
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">Manage salary, view payslips, and handle financial adjustments.</p>
                </div>
                
                {(activeTab === 'slips' || activeTab === 'my_adjustments') && (
                    <button 
                        onClick={() => setIsBankModalOpen(true)} 
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors"
                    >
                        <EditIcon className="w-4 h-4 text-blue-600" />
                        Update Bank Details
                    </button>
                )}
            </div>

            <div className="border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                <nav className="-mb-px flex space-x-6">
                    {tabs.filter(t => t.show).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="min-h-[400px] pt-4">
                {activeTab === 'slips' && (
                    <MyPayrollView 
                        currentUser={userProfile} 
                        payrollRuns={payrollRuns} 
                        payrollItems={payrollItems} 
                    />
                )}
                {activeTab === 'my_adjustments' && (
                    <MyAdjustmentsView 
                        currentUser={userProfile} 
                        adjustments={canManage 
                            ? payrollAdjustments 
                            : payrollAdjustments.filter(a => a.user_id === userProfile.id)
                        } 
                    />
                )}
                {activeTab === 'run' && canManage && (
                    <PayrollPage 
                        staffForPayroll={users.filter(u => u.role !== 'Student' && u.role !== 'Guardian')}
                        adjustments={payrollAdjustments}
                        onRunPayroll={onRunPayroll}
                        campuses={campuses}
                    />
                )}
                {activeTab === 'history' && canManage && (
                    <PayrollManager 
                        runs={richRuns} 
                        handleGeneratePayslips={handleGeneratePayslips} 
                    />
                )}
                {activeTab === 'staff' && canManage && (
                    <StaffPayrollManager 
                        users={users} 
                        onUpdateUserPayroll={onUpdateUserPayroll} 
                        campuses={campuses}
                    />
                )}
                {activeTab === 'adjustments' && canManage && (
                    <PayrollAdjustmentsManager 
                        users={users} 
                        addToast={addToast}
                        campuses={campuses}
                    />
                )}
                {activeTab === 'settings' && canManage && (
                    <PayrollSettings 
                        schoolConfig={schoolConfig} 
                        onSave={onSaveSchoolConfig} 
                    />
                )}
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

export default PayrollPortal;
