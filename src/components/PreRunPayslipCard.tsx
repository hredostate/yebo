import React, { useMemo, useState } from 'react';
import type { Payslip, PayslipQuery } from '../types';
import { approvePayslip, raisePayslipQuery } from '../services/payrollPreRunService';
import Spinner from './common/Spinner';

interface Props {
    payslip: Payslip;
    currentUserId: string;
    onRefresh?: () => void;
}

const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-200 text-slate-800',
    AWAITING_APPROVAL: 'bg-amber-100 text-amber-800',
    APPROVED: 'bg-emerald-100 text-emerald-800',
    QUERY_RAISED: 'bg-red-100 text-red-800',
    RESOLVED: 'bg-blue-100 text-blue-800',
    FINAL: 'bg-slate-900 text-white'
};

const PreRunPayslipCard: React.FC<Props> = ({ payslip, currentUserId, onRefresh }) => {
    const [isWorking, setIsWorking] = useState(false);
    const [queryText, setQueryText] = useState('');
    const [error, setError] = useState<string | null>(null);

    const earningItems = useMemo(() => payslip.line_items?.filter(li => li.type === 'EARNING') || [], [payslip]);
    const deductionItems = useMemo(() => payslip.line_items?.filter(li => li.type === 'DEDUCTION') || [], [payslip]);
    const infoItems = useMemo(() => payslip.line_items?.filter(li => li.type === 'INFO') || [], [payslip]);
    const latestQuery: PayslipQuery | undefined = payslip.queries?.[0];

    const badgeClass = statusColors[payslip.status] || 'bg-slate-200 text-slate-800';

    const handleApprove = async () => {
        setIsWorking(true);
        setError(null);
        try {
            await approvePayslip(payslip.id, currentUserId);
            onRefresh?.();
        } catch (e: any) {
            setError(e.message || 'Failed to approve payslip');
        } finally {
            setIsWorking(false);
        }
    };

    const handleRaiseQuery = async () => {
        if (!queryText.trim()) {
            setError('Please include a comment for the query.');
            return;
        }
        setIsWorking(true);
        setError(null);
        try {
            await raisePayslipQuery(payslip.id, currentUserId, queryText.trim());
            setQueryText('');
            onRefresh?.();
        } catch (e: any) {
            setError(e.message || 'Failed to raise query');
        } finally {
            setIsWorking(false);
        }
    };

    const canAct = payslip.status === 'AWAITING_APPROVAL';

    return (
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm text-slate-500">Payroll Period</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{payslip.run?.period_key || 'Current'}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>{payslip.status.replace('_', ' ')}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-xl">
                    <p className="text-sm text-emerald-800 dark:text-emerald-200">Gross Pay</p>
                    <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{payslip.currency} {Number(payslip.gross_pay).toLocaleString()}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-xl">
                    <p className="text-sm text-red-800 dark:text-red-200">Total Deductions</p>
                    <p className="text-2xl font-bold text-red-900 dark:text-red-100">{payslip.currency} {Number(payslip.total_deductions).toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl">
                    <p className="text-sm text-blue-800 dark:text-blue-200">Net Pay</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{payslip.currency} {Number(payslip.net_pay).toLocaleString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 className="font-semibold mb-2 text-slate-800 dark:text-slate-100">Earnings</h4>
                    <div className="space-y-2">
                        {earningItems.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <span>{item.label}</span>
                                <span className="font-semibold">{payslip.currency} {Number(item.amount).toLocaleString()}</span>
                            </div>
                        ))}
                        {earningItems.length === 0 && <p className="text-sm text-slate-500">No earnings listed.</p>}
                    </div>
                </div>
                <div>
                    <h4 className="font-semibold mb-2 text-slate-800 dark:text-slate-100">Deductions</h4>
                    <div className="space-y-2">
                        {deductionItems.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <span>{item.label}</span>
                                <span className="font-semibold">{payslip.currency} {Number(item.amount).toLocaleString()}</span>
                            </div>
                        ))}
                        {deductionItems.length === 0 && <p className="text-sm text-slate-500">No deductions listed.</p>}
                    </div>
                </div>
            </div>

            {infoItems.length > 0 && (
                <div className="space-y-2">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100">Info</h4>
                    {infoItems.map(item => (
                        <p key={item.id} className="text-sm text-slate-600 dark:text-slate-300">{item.label}</p>
                    ))}
                </div>
            )}

            {latestQuery && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Latest Query</p>
                    <p className="text-sm text-amber-900 dark:text-amber-100 mt-1">{latestQuery.message}</p>
                    {latestQuery.admin_response && (
                        <p className="text-sm text-emerald-800 dark:text-emerald-200 mt-2">Admin response: {latestQuery.admin_response}</p>
                    )}
                </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            {canAct && (
                <div className="flex flex-col md:flex-row gap-3 pt-2">
                    <button
                        onClick={handleApprove}
                        disabled={isWorking}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-70 flex items-center gap-2"
                    >
                        {isWorking ? <Spinner size="sm" /> : null}
                        Approve Payslip
                    </button>
                    <div className="flex-1">
                        <textarea
                            value={queryText}
                            onChange={e => setQueryText(e.target.value)}
                            placeholder="Raise a Query (comment required)"
                            className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm bg-white dark:bg-slate-800"
                            rows={2}
                        />
                        <div className="flex justify-end mt-2">
                            <button
                                onClick={handleRaiseQuery}
                                disabled={isWorking}
                                className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-70 flex items-center gap-2"
                            >
                                {isWorking ? <Spinner size="sm" /> : null}
                                Raise a Query
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PreRunPayslipCard;
