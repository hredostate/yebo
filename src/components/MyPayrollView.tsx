import React, { useMemo, useState } from 'react';
import type { PayrollRun, PayrollItem, UserProfile, Payslip } from '../types';
import { BanknotesIcon, ChevronDownIcon } from './common/icons';
import PreRunPayslipCard from './PreRunPayslipCard';

interface MyPayrollViewProps {
    payrollRuns: PayrollRun[];
    payrollItems: PayrollItem[];
    currentUser: UserProfile;
    payslips?: Payslip[];
    onRefreshPayslips?: () => void;
}

const MyPayrollView: React.FC<MyPayrollViewProps> = ({ payrollRuns, payrollItems, currentUser, payslips = [], onRefreshPayslips }) => {
    const [expandedRunId, setExpandedRunId] = useState<number | null>(null);

    // Add null safety
    if (!currentUser || !currentUser.id) {
        return (
            <div className="text-center p-8 text-slate-500">
                <p>Unable to load payroll information. User profile not found.</p>
            </div>
        );
    }

    const myPayrollHistory = useMemo(() => {
        if (!payrollItems || !payrollRuns) return [];

        const myItems = payrollItems.filter(item => item.user_id === currentUser.id);
        const myRunIds = new Set(myItems.map(item => item.payroll_run_id));
        return payrollRuns
            .filter(run => myRunIds.has(run.id))
            .map(run => ({
                ...run,
                item: myItems.find(item => item.payroll_run_id === run.id)!
            }))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [payrollRuns, payrollItems, currentUser.id]);

    const draftPayslip = useMemo(() => {
        return payslips.find(slip => slip.status !== 'FINAL') || payslips[0];
    }, [payslips]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <BanknotesIcon className="w-8 h-8 text-green-600" />
                    My Payroll
                </h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">Your personal payroll history.</p>
            </div>
            {draftPayslip && (
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">Current Payslip (Pre-Run)</h3>
                    <PreRunPayslipCard payslip={draftPayslip} currentUserId={currentUser.id} onRefresh={onRefreshPayslips} />
                </div>
            )}
            <div className="space-y-4">
                {myPayrollHistory.map(run => (
                    <div key={run.id} className="p-4 rounded-lg border bg-slate-100 dark:bg-slate-800">
                        <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedRunId(run.id === expandedRunId ? null : run.id)}>
                            <div>
                                <p className="font-bold">{run.period_label}</p>
                                <p className="text-xs text-slate-500">Paid on {new Date(run.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-lg">₦{Number(run.item.net_amount).toLocaleString()}</p>
                                <span className="text-xs px-2 py-1 rounded-full bg-green-200 text-green-800">{run.item.transfer_status}</span>
                            </div>
                            <ChevronDownIcon className={`w-6 h-6 transform transition-transform ${expandedRunId === run.id ? 'rotate-180' : ''}`} />
                        </div>
                        {expandedRunId === run.id && (
                            <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2 text-sm">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="font-semibold text-slate-500">Gross Pay</p>
                                        <p>₦{Number(run.item.gross_amount).toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-500">Adjustments</p>
                                        {(run.item.deductions && run.item.deductions.length > 0) ? (
                                            <ul className="list-disc list-inside">
                                                {run.item.deductions.map((d, i) => (
                                                    <li key={i} className={d.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                                                        {d.label}: ₦{d.amount.toLocaleString()}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : <p>None</p>}
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                    <p className="font-bold text-lg">Net Pay: ₦{Number(run.item.net_amount).toLocaleString()}</p>
                                </div>
                                {run.item.payslip_url && (
                                    <a href={run.item.payslip_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-md">
                                        Download Payslip
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                {myPayrollHistory.length === 0 && <p className="text-center p-8 text-slate-500">You have no payroll history.</p>}
            </div>
        </div>
    );
};

export default MyPayrollView;