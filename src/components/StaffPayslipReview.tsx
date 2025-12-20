import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { Payslip, PayslipLineItem, PayslipQuery, UserProfile } from '../types';
import { approvePayslip, raisePayslipQuery, fetchStaffPayslips } from '../services/payrollPreRunService';
import Spinner from './common/Spinner';

interface StaffPayslipReviewProps {
    userProfile: UserProfile;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const StaffPayslipReview: React.FC<StaffPayslipReviewProps> = ({ userProfile, addToast }) => {
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
    const [showQueryModal, setShowQueryModal] = useState(false);
    const [queryMessage, setQueryMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadPayslips();
    }, [userProfile.id]);

    const loadPayslips = async () => {
        setLoading(true);
        try {
            const data = await fetchStaffPayslips(userProfile.id);
            setPayslips(data);
            
            // Auto-select the most recent awaiting approval payslip
            const awaitingApproval = data.find(p => p.status === 'AWAITING_APPROVAL' || p.status === 'RESOLVED');
            if (awaitingApproval) {
                setSelectedPayslip(awaitingApproval);
            } else if (data.length > 0) {
                setSelectedPayslip(data[0]);
            }
        } catch (error: any) {
            addToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedPayslip) return;
        
        setIsSubmitting(true);
        try {
            await approvePayslip(selectedPayslip.id, userProfile.id);
            addToast('Payslip approved successfully!', 'success');
            await loadPayslips();
        } catch (error: any) {
            addToast(error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRaiseQuery = async () => {
        if (!selectedPayslip || !queryMessage.trim()) {
            addToast('Please enter a query message', 'error');
            return;
        }
        
        setIsSubmitting(true);
        try {
            await raisePayslipQuery(selectedPayslip.id, userProfile.id, queryMessage);
            addToast('Query raised successfully. Admin will review and respond.', 'success');
            setShowQueryModal(false);
            setQueryMessage('');
            await loadPayslips();
        } catch (error: any) {
            addToast(error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
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
            AWAITING_APPROVAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
            APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
            QUERY_RAISED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
            RESOLVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
            FINAL: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
        };

        return (
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusColors[status] || statusColors.DRAFT}`}>
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

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Spinner />
            </div>
        );
    }

    if (payslips.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-8 text-center">
                <div className="text-6xl mb-4">💼</div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No Payslips Yet</h3>
                <p className="text-slate-600 dark:text-slate-400">
                    You don't have any payslips at the moment. They will appear here once the admin publishes a payroll run.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Payslip History */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Your Payslips</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {payslips.map((payslip) => (
                        <button
                            key={payslip.id}
                            onClick={() => setSelectedPayslip(payslip)}
                            className={`text-left p-4 rounded-lg border-2 transition-all ${
                                selectedPayslip?.id === payslip.id
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="text-sm font-medium text-slate-900 dark:text-white">
                                    {payslip.run?.period_key || 'Unknown Period'}
                                </div>
                                <div className="text-2xl">{getStatusIcon(payslip.status)}</div>
                            </div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                                {formatCurrency(payslip.net_pay)}
                            </div>
                            <div className="flex justify-between items-center">
                                {getStatusBadge(payslip.status)}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Selected Payslip Details */}
            {selectedPayslip && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                            Payslip Details - {selectedPayslip.run?.period_key}
                        </h2>
                        {getStatusBadge(selectedPayslip.status)}
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Gross Pay</div>
                            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                                {formatCurrency(selectedPayslip.gross_pay)}
                            </div>
                        </div>

                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                            <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Total Deductions</div>
                            <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                                {formatCurrency(selectedPayslip.total_deductions)}
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Net Pay</div>
                            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                {formatCurrency(selectedPayslip.net_pay)}
                            </div>
                        </div>
                    </div>

                    {/* Line Items Breakdown */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">Payment Breakdown</h3>
                        
                        <div className="space-y-2">
                            {/* Earnings */}
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Earnings</div>
                                {selectedPayslip.line_items
                                    ?.filter(item => item.type === 'EARNING')
                                    .sort((a, b) => (a.ordering || 0) - (b.ordering || 0))
                                    .map(item => (
                                        <div key={item.id} className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                                            <span>{item.label}</span>
                                            <span className="font-medium">{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                            </div>

                            {/* Deductions */}
                            {selectedPayslip.line_items?.some(item => item.type === 'DEDUCTION') && (
                                <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                                    <div className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Deductions</div>
                                    {selectedPayslip.line_items
                                        ?.filter(item => item.type === 'DEDUCTION')
                                        .sort((a, b) => (a.ordering || 0) - (b.ordering || 0))
                                        .map(item => (
                                            <div key={item.id} className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                                                <span>{item.label}</span>
                                                <span className="font-medium text-red-600 dark:text-red-400">
                                                    -{formatCurrency(item.amount)}
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    {(selectedPayslip.status === 'AWAITING_APPROVAL' || selectedPayslip.status === 'RESOLVED') && (
                        <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                onClick={handleApprove}
                                disabled={isSubmitting}
                                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 font-semibold flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <Spinner size="sm" /> : '✅'}
                                Approve Payslip
                            </button>

                            <button
                                onClick={() => setShowQueryModal(true)}
                                disabled={isSubmitting}
                                className="flex-1 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-yellow-400 font-semibold flex items-center justify-center gap-2"
                            >
                                ❓ Raise Query
                            </button>
                        </div>
                    )}

                    {/* Queries Section */}
                    {selectedPayslip.queries && selectedPayslip.queries.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">Queries & Responses</h3>
                            
                            <div className="space-y-3">
                                {selectedPayslip.queries.map((query: PayslipQuery) => (
                                    <div key={query.id} className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-semibold text-slate-700 dark:text-slate-300">Your Query</div>
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                query.status === 'RESOLVED' 
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {query.status}
                                            </span>
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-400 mb-2">{query.message}</p>
                                        <div className="text-xs text-slate-500 dark:text-slate-500">
                                            {new Date(query.created_at).toLocaleString()}
                                        </div>
                                        
                                        {query.admin_response && (
                                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                                                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Admin Response</div>
                                                <p className="text-slate-600 dark:text-slate-400">{query.admin_response}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Query Modal */}
            {showQueryModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 m-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Raise a Query</h2>
                        
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            Please describe your concern or question about this payslip. An admin will review and respond.
                        </p>

                        <textarea
                            value={queryMessage}
                            onChange={(e) => setQueryMessage(e.target.value)}
                            placeholder="Describe your query here..."
                            rows={5}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white mb-4"
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowQueryModal(false);
                                    setQueryMessage('');
                                }}
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRaiseQuery}
                                disabled={isSubmitting || !queryMessage.trim()}
                                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-yellow-400 font-semibold flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <Spinner size="sm" /> : null}
                                Submit Query
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffPayslipReview;
