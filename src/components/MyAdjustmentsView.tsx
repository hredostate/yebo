
import React, { useMemo } from 'react';
import type { UserProfile, PayrollAdjustment } from '../types';
import Spinner from './common/Spinner';
import { BanknotesIcon } from './common/icons';

interface MyAdjustmentsViewProps {
    currentUser: UserProfile;
    adjustments?: PayrollAdjustment[];
    isLoading?: boolean;
}

const MyAdjustmentsView: React.FC<MyAdjustmentsViewProps> = ({ 
    currentUser, 
    adjustments = [], 
    isLoading = false 
}) => {

    const { totalAdditions, totalDeductions, pendingCount } = useMemo(() => {
        let additions = 0;
        let deductions = 0;
        let pending = 0;

        adjustments.forEach(adj => {
            if (adj.adjustment_type === 'addition') {
                additions += Number(adj.amount);
            } else {
                deductions += Number(adj.amount);
            }
            if (!adj.payroll_run_id) {
                pending++;
            }
        });

        return { totalAdditions: additions, totalDeductions: deductions, pendingCount: pending };
    }, [adjustments]);

    const formatCurrency = (amount: number) => `₦${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <BanknotesIcon className="w-8 h-8 text-indigo-600" />
                    My Payroll Adjustments
                </h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">A history of all bonuses, deductions, and reimbursements.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Earnings (Additions)</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(totalAdditions)}</p>
                </div>
                <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Deductions</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{formatCurrency(totalDeductions)}</p>
                </div>
                <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Processing</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{pendingCount}</p>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
                {isLoading ? (
                    <div className="flex justify-center py-12"><Spinner size="lg" /></div>
                ) : adjustments.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        No payroll adjustments found.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-500/10">
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Description</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3">Amount</th>
                                    <th className="px-6 py-3">Recurring</th>
                                    <th className="px-6 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {adjustments.map(adj => (
                                    <tr key={adj.id} className="border-b border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-500/10">
                                        <td className="px-6 py-4">{new Date(adj.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{adj.reason}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${adj.adjustment_type === 'addition' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                                                {adj.adjustment_type === 'addition' ? 'Addition' : 'Deduction'}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 font-bold ${adj.adjustment_type === 'addition' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {adj.adjustment_type === 'addition' ? '+' : '-'}{formatCurrency(Number(adj.amount))}
                                        </td>
                                        <td className="px-6 py-4">
                                            {adj.is_recurring ? <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Yes</span> : 'No'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {adj.payroll_run_id ? (
                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Processed</span>
                                            ) : (
                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">Pending</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyAdjustmentsView;
