import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { PayrollRunV2, Payslip, PayslipQuery, UserProfile } from '../types';
import {
    getPayrollRunWithApprovals,
    getApprovalSummary,
    canFinalizeRun,
    finalizePayroll,
    processOfflinePayment,
    processPaystackPayment,
    resolvePayslipQuery
} from '../services/payrollPreRunService';
import Spinner from './common/Spinner';

interface PayrollApprovalDashboardProps {
    userProfile: UserProfile;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const PayrollApprovalDashboard: React.FC<PayrollApprovalDashboardProps> = ({ userProfile, addToast }) => {
    const [runs, setRuns] = useState<PayrollRunV2[]>([]);
    const [selectedRun, setSelectedRun] = useState<PayrollRunV2 | null>(null);
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [loading, setLoading] = useState(true);
    const [approvalSummary, setApprovalSummary] = useState<any>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingMethod, setProcessingMethod] = useState<'OFFLINE' | 'PAYSTACK'>('OFFLINE');
    const [selectedQuery, setSelectedQuery] = useState<PayslipQuery | null>(null);
    const [showQueryModal, setShowQueryModal] = useState(false);
    const [adminResponse, setAdminResponse] = useState('');

    useEffect(() => {
        loadRuns();
    }, [userProfile.school_id]);

    useEffect(() => {
        if (selectedRun) {
            loadRunDetails(selectedRun.id);
        }
    }, [selectedRun]);

    const loadRuns = async () => {
        setLoading(true);
        try {
            const supabase = requireSupabaseClient();
            const { data, error } = await supabase
                .from('payroll_runs_v2')
                .select('*')
                .eq('school_id', userProfile.school_id)
                .in('status', ['PRE_RUN_PUBLISHED', 'FINALIZED'])
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            const runsData = (data || []) as PayrollRunV2[];
            setRuns(runsData);
            
            // Auto-select the first published run
            if (runsData.length > 0 && !selectedRun) {
                setSelectedRun(runsData[0]);
            }
        } catch (error: any) {
            addToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadRunDetails = async (runId: string) => {
        try {
            const { run, payslips: slips } = await getPayrollRunWithApprovals(runId);
            setPayslips(slips);
            
            const summary = await getApprovalSummary(runId);
            setApprovalSummary(summary);
        } catch (error: any) {
            addToast(error.message, 'error');
        }
    };

    const handleFinalizeRun = async () => {
        if (!selectedRun) return;
        
        const canFinalize = await canFinalizeRun(selectedRun.id);
        if (!canFinalize) {
            addToast('Cannot finalize: Not all payslips are approved', 'error');
            return;
        }

        setIsProcessing(true);
        try {
            await finalizePayroll(selectedRun.id, userProfile.id, processingMethod);
            addToast('Payroll finalized successfully!', 'success');
            await loadRuns();
            if (selectedRun) {
                await loadRunDetails(selectedRun.id);
            }
        } catch (error: any) {
            addToast(error.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleProcessPayment = async () => {
        if (!selectedRun) return;

        setIsProcessing(true);
        try {
            if (processingMethod === 'OFFLINE') {
                await processOfflinePayment(selectedRun.id, userProfile.id);
                addToast('Marked as processed offline. Complete bank transfers manually.', 'success');
            } else {
                await processPaystackPayment(selectedRun.id, userProfile.id);
                addToast('Processing via Paystack...', 'info');
            }
            await loadRuns();
            if (selectedRun) {
                await loadRunDetails(selectedRun.id);
            }
        } catch (error: any) {
            addToast(error.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResolveQuery = async () => {
        if (!selectedQuery || !adminResponse.trim()) {
            addToast('Please enter a response', 'error');
            return;
        }

        setIsProcessing(true);
        try {
            await resolvePayslipQuery(selectedQuery.id, userProfile.id, adminResponse);
            addToast('Query resolved successfully!', 'success');
            setShowQueryModal(false);
            setSelectedQuery(null);
            setAdminResponse('');
            if (selectedRun) {
                await loadRunDetails(selectedRun.id);
            }
        } catch (error: any) {
            addToast(error.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const openQueryModal = (query: PayslipQuery) => {
        setSelectedQuery(query);
        setAdminResponse('');
        setShowQueryModal(true);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN'
        }).format(amount);
    };

    const getStatusBadge = (status: string) => {
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

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return '✅';
            case 'AWAITING_APPROVAL':
                return '⏳';
            case 'QUERY_RAISED':
                return '❓';
            case 'RESOLVED':
                return '✔️';
            case 'FINAL':
                return '🎉';
            default:
                return '📄';
        }
    };

    const filteredPayslips = payslips.filter(p => {
        if (filterStatus === 'all') return true;
        return p.status === filterStatus;
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Spinner />
            </div>
        );
    }

    if (runs.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-8 text-center">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No Published Runs</h3>
                <p className="text-slate-600 dark:text-slate-400">
                    No payroll runs have been published yet. Publish a run from the Pre-Run Manager to see approval status here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Run Selector */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Select Payroll Run</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {runs.map((run) => (
                        <button
                            key={run.id}
                            onClick={() => setSelectedRun(run)}
                            className={`text-left p-4 rounded-lg border-2 transition-all ${
                                selectedRun?.id === run.id
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                            }`}
                        >
                            <div className="font-semibold text-slate-900 dark:text-white mb-1">
                                {run.period_key}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                                {run.status.replace(/_/g, ' ')}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Approval Summary */}
            {selectedRun && approvalSummary && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
                        Approval Progress - {selectedRun.period_key}
                    </h2>

                    {/* Progress Bar */}
                    <div className="mb-6">
                        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-2">
                            <span>
                                {approvalSummary.approved} of {approvalSummary.total} Approved
                            </span>
                            <span>
                                {approvalSummary.total > 0 
                                    ? Math.round((approvalSummary.approved / approvalSummary.total) * 100)
                                    : 0}%
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                            <div
                                className="bg-green-600 h-full transition-all duration-300"
                                style={{
                                    width: `${approvalSummary.total > 0 
                                        ? (approvalSummary.approved / approvalSummary.total) * 100
                                        : 0}%`
                                }}
                            />
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Approved</div>
                            <div className="text-3xl font-bold text-green-900 dark:text-green-100">
                                {approvalSummary.approved}
                            </div>
                        </div>

                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <div className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Pending</div>
                            <div className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">
                                {approvalSummary.pending}
                            </div>
                        </div>

                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                            <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Queries</div>
                            <div className="text-3xl font-bold text-red-900 dark:text-red-100">
                                {approvalSummary.queried}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {selectedRun.status === 'PRE_RUN_PUBLISHED' && (
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                            <button
                                onClick={handleFinalizeRun}
                                disabled={isProcessing || approvalSummary.approved !== approvalSummary.total}
                                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-semibold flex items-center justify-center gap-2"
                            >
                                {isProcessing ? <Spinner size="sm" /> : '🎯'}
                                Finalize Payroll
                                {approvalSummary.approved !== approvalSummary.total && ' (Waiting for all approvals)'}
                            </button>
                        </div>
                    )}

                    {selectedRun.status === 'FINALIZED' && (
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Process Payment</h3>
                            
                            <div className="flex gap-4 mb-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        value="OFFLINE"
                                        checked={processingMethod === 'OFFLINE'}
                                        onChange={(e) => setProcessingMethod(e.target.value as any)}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-slate-700 dark:text-slate-300">💵 Offline (Manual Transfer)</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        value="PAYSTACK"
                                        checked={processingMethod === 'PAYSTACK'}
                                        onChange={(e) => setProcessingMethod(e.target.value as any)}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-slate-700 dark:text-slate-300">💳 Paystack (Automated)</span>
                                </label>
                            </div>

                            <button
                                onClick={handleProcessPayment}
                                disabled={isProcessing}
                                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 font-semibold flex items-center justify-center gap-2"
                            >
                                {isProcessing ? <Spinner size="sm" /> : '💰'}
                                Process Payment via {processingMethod === 'OFFLINE' ? 'Offline' : 'Paystack'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Payslips List */}
            {selectedRun && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Staff Payslips</h2>
                        
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        >
                            <option value="all">All Statuses</option>
                            <option value="AWAITING_APPROVAL">Awaiting Approval</option>
                            <option value="APPROVED">Approved</option>
                            <option value="QUERY_RAISED">Query Raised</option>
                            <option value="RESOLVED">Resolved</option>
                            <option value="FINAL">Final</option>
                        </select>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                <tr>
                                    <th className="px-4 py-3">Staff</th>
                                    <th className="px-4 py-3">Gross Pay</th>
                                    <th className="px-4 py-3">Net Pay</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPayslips.map((payslip) => (
                                    <tr key={payslip.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">{getStatusIcon(payslip.status)}</span>
                                                {payslip.staff?.name || 'Unknown'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                            {formatCurrency(payslip.gross_pay)}
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                                            {formatCurrency(payslip.net_pay)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {getStatusBadge(payslip.status)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {payslip.queries && payslip.queries.length > 0 && (
                                                <button
                                                    onClick={() => openQueryModal(payslip.queries![0])}
                                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                                                >
                                                    View Query
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredPayslips.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                            No payslips found with the selected filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Query Resolution Modal */}
            {showQueryModal && selectedQuery && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Resolve Query</h2>
                        
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg mb-4">
                            <div className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Staff Query</div>
                            <p className="text-slate-600 dark:text-slate-400 mb-2">{selectedQuery.message}</p>
                            <div className="text-xs text-slate-500 dark:text-slate-500">
                                Raised on {new Date(selectedQuery.created_at).toLocaleString()}
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Your Response
                            </label>
                            <textarea
                                value={adminResponse}
                                onChange={(e) => setAdminResponse(e.target.value)}
                                placeholder="Enter your response to resolve this query..."
                                rows={5}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowQueryModal(false);
                                    setSelectedQuery(null);
                                    setAdminResponse('');
                                }}
                                disabled={isProcessing}
                                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResolveQuery}
                                disabled={isProcessing || !adminResponse.trim()}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-semibold flex items-center justify-center gap-2"
                            >
                                {isProcessing ? <Spinner size="sm" /> : null}
                                Resolve Query
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayrollApprovalDashboard;
