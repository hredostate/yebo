import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { PayrollRunV2, Payslip, UserProfile } from '../types';
import {
    createPayrollRun,
    generatePayslipsForRun,
    publishPayrollPreRun,
    getApprovalSummary
} from '../services/payrollPreRunService';
import Spinner from './common/Spinner';

interface PayrollPreRunManagerProps {
    userProfile: UserProfile;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const PayrollPreRunManager: React.FC<PayrollPreRunManagerProps> = ({ userProfile, addToast }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [currentRuns, setCurrentRuns] = useState<PayrollRunV2[]>([]);
    const [selectedRun, setSelectedRun] = useState<PayrollRunV2 | null>(null);
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [loadingPayslips, setLoadingPayslips] = useState(false);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    useEffect(() => {
        loadPayrollRuns();
    }, [userProfile.school_id]);

    const loadPayrollRuns = async () => {
        try {
            const supabase = requireSupabaseClient();
            const { data, error } = await supabase
                .from('payroll_runs_v2')
                .select('*')
                .eq('school_id', userProfile.school_id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            setCurrentRuns((data || []) as PayrollRunV2[]);
        } catch (error: any) {
            addToast(error.message, 'error');
        }
    };

    const handleCreateRun = async () => {
        setIsCreating(true);
        try {
            const periodKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
            const run = await createPayrollRun(userProfile.school_id, periodKey, userProfile.id);
            addToast(`Payroll run created for ${months[selectedMonth - 1]} ${selectedYear}`, 'success');
            setSelectedRun(run);
            await loadPayrollRuns();
        } catch (error: any) {
            addToast(error.message, 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleGeneratePayslips = async (runId: string) => {
        setIsGenerating(true);
        try {
            const generated = await generatePayslipsForRun(runId, userProfile.school_id);
            addToast(`Generated ${generated.length} payslips`, 'success');
            await loadPayslipsForRun(runId);
            await loadPayrollRuns();
        } catch (error: any) {
            addToast(error.message, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const loadPayslipsForRun = async (runId: string) => {
        setLoadingPayslips(true);
        try {
            const supabase = requireSupabaseClient();
            const { data, error } = await supabase
                .from('payslips')
                .select('*, staff:user_profiles(id, name, email), line_items:payslip_line_items(*)')
                .eq('payroll_run_id', runId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPayslips((data || []) as Payslip[]);
        } catch (error: any) {
            addToast(error.message, 'error');
        } finally {
            setLoadingPayslips(false);
        }
    };

    const handlePublishRun = async (runId: string) => {
        setIsPublishing(true);
        try {
            await publishPayrollPreRun(runId, userProfile.id);
            addToast('Payroll pre-run published! Staff can now review their payslips.', 'success');
            await loadPayrollRuns();
            if (selectedRun?.id === runId) {
                await loadPayslipsForRun(runId);
            }
        } catch (error: any) {
            addToast(error.message, 'error');
        } finally {
            setIsPublishing(false);
        }
    };

    const handleViewRun = async (run: PayrollRunV2) => {
        setSelectedRun(run);
        await loadPayslipsForRun(run.id);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN'
        }).format(amount);
    };

    const getStatusBadge = (status: string) => {
        const statusColors: Record<string, string> = {
            DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
            PRE_RUN_PUBLISHED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
            FINALIZED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
            PROCESSING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
            PROCESSED_OFFLINE: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
            PROCESSED_PAYSTACK: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
            FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
        };

        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[status] || statusColors.DRAFT}`}>
                {status.replace(/_/g, ' ')}
            </span>
        );
    };

    const getPayslipStatusBadge = (status: string) => {
        const statusColors: Record<string, string> = {
            DRAFT: 'bg-gray-100 text-gray-800',
            AWAITING_APPROVAL: 'bg-yellow-100 text-yellow-800',
            APPROVED: 'bg-green-100 text-green-800',
            QUERY_RAISED: 'bg-red-100 text-red-800',
            RESOLVED: 'bg-blue-100 text-blue-800',
            FINAL: 'bg-purple-100 text-purple-800'
        };

        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[status] || statusColors.DRAFT}`}>
                {status.replace(/_/g, ' ')}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Create New Payroll Run</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Month
                        </label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            disabled={isCreating}
                        >
                            {months.map((month, idx) => (
                                <option key={idx} value={idx + 1}>{month}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Year
                        </label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            disabled={isCreating}
                        >
                            {[0, 1, 2].map((offset) => {
                                const year = new Date().getFullYear() + offset;
                                return <option key={year} value={year}>{year}</option>;
                            })}
                        </select>
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={handleCreateRun}
                            disabled={isCreating}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium flex items-center justify-center gap-2"
                        >
                            {isCreating ? <Spinner size="sm" /> : null}
                            Create Run
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Recent Payroll Runs</h2>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            <tr>
                                <th className="px-4 py-3">Period</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Created</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentRuns.map((run) => (
                                <tr key={run.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                        {run.period_key}
                                    </td>
                                    <td className="px-4 py-3">
                                        {getStatusBadge(run.status)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                        {new Date(run.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleViewRun(run)}
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                                            >
                                                View
                                            </button>
                                            {run.status === 'DRAFT' && (
                                                <>
                                                    <button
                                                        onClick={() => handleGeneratePayslips(run.id)}
                                                        disabled={isGenerating}
                                                        className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-medium disabled:opacity-50"
                                                    >
                                                        Generate
                                                    </button>
                                                    <button
                                                        onClick={() => handlePublishRun(run.id)}
                                                        disabled={isPublishing}
                                                        className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-medium disabled:opacity-50"
                                                    >
                                                        Publish
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {currentRuns.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                        No payroll runs found. Create one to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedRun && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                            Payslips for {selectedRun.period_key}
                        </h2>
                        <button
                            onClick={() => setSelectedRun(null)}
                            className="text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            Close
                        </button>
                    </div>

                    {loadingPayslips ? (
                        <div className="flex justify-center py-8">
                            <Spinner />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                    <tr>
                                        <th className="px-4 py-3">Staff</th>
                                        <th className="px-4 py-3">Gross Pay</th>
                                        <th className="px-4 py-3">Deductions</th>
                                        <th className="px-4 py-3">Net Pay</th>
                                        <th className="px-4 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payslips.map((payslip) => (
                                        <tr key={payslip.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                                {payslip.staff?.name || 'Unknown'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                {formatCurrency(payslip.gross_pay)}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                {formatCurrency(payslip.total_deductions)}
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                                                {formatCurrency(payslip.net_pay)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {getPayslipStatusBadge(payslip.status)}
                                            </td>
                                        </tr>
                                    ))}
                                    {payslips.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                                No payslips generated yet. Click "Generate" to create payslips.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PayrollPreRunManager;
