import React, { useMemo, useState } from 'react';
import type { PayrollRun, PayrollItem, UserProfile, SchoolConfig, PensionContribution, PayrollLineItem } from '../types';
import { BanknotesIcon, ChevronDownIcon } from './common/icons';

interface MyPayrollViewProps {
    payrollRuns: PayrollRun[];
    payrollItems: PayrollItem[];
    currentUser: UserProfile;
    schoolConfig?: SchoolConfig | null;
    pensionContributions?: PensionContribution[];
}

const formatCurrency = (value: number | undefined | null) =>
    `₦${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const buildLineItems = (item: PayrollItem): PayrollLineItem[] => {
    if (item.line_items && item.line_items.length > 0) return item.line_items;

    const fallback: PayrollLineItem[] = [];
    if (item.user?.base_pay) {
        fallback.push({
            id: Number(`100${item.id}`),
            payroll_item_id: item.id,
            label: 'Basic Salary',
            category: 'earning',
            amount: item.user.base_pay,
        } as PayrollLineItem);
    }

    (item.deductions || []).forEach((deduction, idx) => {
        fallback.push({
            id: Number(`200${item.id}${idx}`),
            payroll_item_id: item.id,
            label: deduction.label,
            category: deduction.amount >= 0 ? 'earning' : 'deduction',
            amount: deduction.amount,
        } as PayrollLineItem);
    });

    return fallback;
};

const MyPayrollView: React.FC<MyPayrollViewProps> = ({ payrollRuns, payrollItems, currentUser, schoolConfig, pensionContributions = [] }) => {
    const [expandedRunId, setExpandedRunId] = useState<number | null>(null);

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
                item: myItems.find(item => item.payroll_run_id === run.id)!,
            }))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [payrollRuns, payrollItems, currentUser.id]);

    const pensionHistory = useMemo(
        () =>
            pensionContributions
                .filter(pc => pc.user_id === currentUser.id)
                .sort((a, b) => new Date(a.contribution_month).getTime() - new Date(b.contribution_month).getTime()),
        [pensionContributions, currentUser.id]
    );

    const latestPensionChange = useMemo(() => {
        if (pensionHistory.length < 2) return null;
        const last = pensionHistory[pensionHistory.length - 1];
        const prev = pensionHistory[pensionHistory.length - 2];
        const delta = last.total_contribution - prev.total_contribution;
        const pct = prev.total_contribution === 0 ? 0 : (delta / prev.total_contribution) * 100;
        return { delta, pct };
    }, [pensionHistory]);

    const handleDownloadCsv = (run: { item: PayrollItem; period_label: string; pay_period_label?: string | null }) => {
        const items = buildLineItems(run.item);
        const earnings = items.filter(li => li.category === 'earning');
        const deductions = items.filter(li => li.category === 'deduction');
        const employer = items.filter(li => li.category === 'employer_contrib');

        const rows = [
            ['Payslip Reference', run.item.reference_number || run.pay_period_label || run.period_label],
            ['Period', run.pay_period_label || run.period_label],
            ['Pay Date', run.item.pay_date || 'N/A'],
            ['Staff Name', currentUser.name],
            ['Staff ID', currentUser.staff_code || 'N/A'],
            [],
            ['EARNINGS'],
            ['Component', 'Amount'],
            ...earnings.map(e => [e.label, `${e.amount}`]),
            ['Gross Pay', `${run.item.gross_amount}`],
            [],
            ['DEDUCTIONS'],
            ['Component', 'Amount'],
            ...deductions.map(d => [d.label, `${Math.abs(d.amount)}`]),
            ['Total Deductions', `${deductions.reduce((sum, d) => sum + Math.abs(d.amount), 0)}`],
            [],
            ['EMPLOYER CONTRIBUTIONS'],
            ...employer.map(e => [e.label, `${e.amount}`]),
            ['Employer Total', `${employer.reduce((sum, e) => sum + e.amount, 0)}`],
            [],
            ['NET PAY', `${run.item.net_amount}`],
        ];

        const csvContent = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${currentUser.name.replace(/\s+/g, '_')}_${run.period_label}_payslip.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadPdf = (run: { item: PayrollItem }) => {
        if (run.item.payslip_url) {
            window.open(run.item.payslip_url, '_blank');
            return;
        }
        window.print();
    };

    const yearToDate = useMemo(() => {
        const thisYearRuns = myPayrollHistory.filter(run => new Date(run.created_at).getFullYear() === new Date().getFullYear());
        return thisYearRuns.reduce(
            (acc, run) => {
                const items = buildLineItems(run.item);
                const earningsSum = items.filter(li => li.category === 'earning').reduce((sum, li) => sum + li.amount, 0);
                const deductionsSum = items.filter(li => li.category === 'deduction').reduce((sum, li) => sum + Math.abs(li.amount), 0);
                const pensionEmployee = items
                    .filter(li => li.label.toLowerCase().includes('pension') && li.category === 'deduction')
                    .reduce((sum, li) => sum + Math.abs(li.amount), 0);
                const pensionEmployer = items
                    .filter(li => li.label.toLowerCase().includes('pension') && li.category === 'employer_contrib')
                    .reduce((sum, li) => sum + li.amount, 0);

                return {
                    gross: acc.gross + earningsSum,
                    tax:
                        acc.tax +
                        items
                            .filter(li => li.label.toLowerCase().includes('tax'))
                            .reduce((sum, li) => sum + Math.abs(li.amount), 0),
                    pensionEmployee: acc.pensionEmployee + pensionEmployee,
                    pensionEmployer: acc.pensionEmployer + pensionEmployer,
                    net: acc.net + run.item.net_amount,
                    deductions: acc.deductions + deductionsSum,
                };
            },
            { gross: 0, tax: 0, pensionEmployee: 0, pensionEmployer: 0, net: 0, deductions: 0 }
        );
    }, [myPayrollHistory]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <BanknotesIcon className="w-8 h-8 text-green-600" />
                        My Payslips
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">World-class payslips with every payroll component, exports, and pension history.</p>
                </div>
                {schoolConfig && (
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
                        {schoolConfig.logo_url && <img src={schoolConfig.logo_url} alt="School logo" className="h-10 w-10 rounded" />}
                        <div>
                            <p className="text-xs text-slate-500">Employer</p>
                            <p className="font-semibold">{schoolConfig.display_name}</p>
                            <p className="text-xs text-slate-500">{schoolConfig.address || 'Address not set'}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 shadow-sm lg:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-sm text-slate-500">Year-to-date</p>
                            <p className="text-xl font-bold">{formatCurrency(yearToDate.net)} net</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-slate-500">Gross</p>
                                <p className="font-semibold">{formatCurrency(yearToDate.gross)}</p>
                            </div>
                            <div>
                                <p className="text-slate-500">Tax</p>
                                <p className="font-semibold">{formatCurrency(yearToDate.tax)}</p>
                            </div>
                            <div>
                                <p className="text-slate-500">Pension (EE)</p>
                                <p className="font-semibold">{formatCurrency(yearToDate.pensionEmployee)}</p>
                            </div>
                            <div>
                                <p className="text-slate-500">Pension (ER)</p>
                                <p className="font-semibold">{formatCurrency(yearToDate.pensionEmployer)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-xs text-slate-500">Includes finalized payroll runs for the current calendar year.</div>
                </div>

                <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">Pension trend</p>
                            <p className="text-xl font-bold">{formatCurrency(pensionHistory.at(-1)?.total_contribution || 0)}</p>
                        </div>
                        {latestPensionChange && (
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${latestPensionChange.pct >= 0 ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                                {latestPensionChange.pct >= 0 ? '+' : ''}
                                {latestPensionChange.pct.toFixed(1)}% vs last period
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Running total contributions (employee + employer).</p>
                </div>
            </div>

            <div className="space-y-4">
                {myPayrollHistory.map(run => {
                    const lineItems = buildLineItems(run.item);
                    const earnings = lineItems.filter(li => li.category === 'earning');
                    const deductions = lineItems.filter(li => li.category === 'deduction');
                    const employerContribs = lineItems.filter(li => li.category === 'employer_contrib');
                    const totalDeductions = deductions.reduce((sum, d) => sum + Math.abs(d.amount), 0);
                    const earningsTotal = earnings.reduce((sum, e) => sum + e.amount, 0);
                    const employerTotal = employerContribs.reduce((sum, e) => sum + e.amount, 0);
                    const pensionRows = pensionHistory.filter(row => row.payroll_run_id === run.id);

                    return (
                        <div key={run.id} className="p-4 rounded-2xl border bg-white dark:bg-slate-900 shadow-sm">
                            <div
                                className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 cursor-pointer"
                                onClick={() => setExpandedRunId(run.id === expandedRunId ? null : run.id)}
                            >
                                <div>
                                    <p className="font-bold text-lg">{run.pay_period_label || run.period_label}</p>
                                    <p className="text-xs text-slate-500">
                                        Pay date:{' '}
                                        {run.item.pay_date
                                            ? new Date(run.item.pay_date).toLocaleDateString()
                                            : new Date(run.created_at).toLocaleDateString()}
                                    </p>
                                    <p className="text-xs text-slate-500">Reference: {run.item.reference_number || run.reference_number || 'Pending reference'}</p>
                                </div>
                                <div className="flex items-center gap-3 md:text-right">
                                    <div>
                                        <p className="text-sm text-slate-500">Net Pay</p>
                                        <p className="text-2xl font-extrabold text-green-700">{formatCurrency(run.item.net_amount)}</p>
                                        <p className="text-xs text-slate-500">Gross: {formatCurrency(run.item.gross_amount)} • Deductions: {formatCurrency(totalDeductions)}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span
                                            className={`text-xs px-2 py-1 rounded-full ${
                                                run.item.status === 'paid' || run.status === 'success'
                                                    ? 'bg-green-100 text-green-700'
                                                    : run.item.status === 'draft' || run.status === 'draft'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-blue-100 text-blue-700'
                                            }`}
                                        >
                                            {run.item.status || run.status || 'Finalized'}
                                        </span>
                                        <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                                            {run.item.payment_method || run.payment_method || 'Offline/Manual'}
                                        </span>
                                    </div>
                                    <ChevronDownIcon className={`w-6 h-6 transform transition-transform ${expandedRunId === run.id ? 'rotate-180' : ''}`} />
                                </div>
                            </div>

                            {expandedRunId === run.id && (
                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4 text-sm">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-semibold text-slate-600">Staff Details</h4>
                                            <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
                                                <p className="text-slate-500">Name</p>
                                                <p className="font-semibold">{currentUser.name}</p>
                                                <p className="text-slate-500">Staff ID</p>
                                                <p className="font-semibold">{currentUser.staff_code || 'N/A'}</p>
                                                <p className="text-slate-500">Role/Title</p>
                                                <p className="font-semibold">{run.item.role_title || currentUser.role || 'N/A'}</p>
                                                <p className="text-slate-500">Department</p>
                                                <p className="font-semibold">{run.item.department || 'Not set'}</p>
                                                <p className="text-slate-500">Employment Type</p>
                                                <p className="font-semibold">{run.item.employment_type || 'Full Time'}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-semibold text-slate-600">Run Metadata</h4>
                                            <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
                                                <p className="text-slate-500">Payslip ID</p>
                                                <p className="font-semibold">{run.item.reference_number || run.reference_number || `RUN-${run.id}`}</p>
                                                <p className="text-slate-500">Period</p>
                                                <p className="font-semibold">{run.pay_period_label || run.period_label}</p>
                                                <p className="text-slate-500">Pay Date</p>
                                                <p className="font-semibold">{run.item.pay_date ? new Date(run.item.pay_date).toLocaleDateString() : new Date(run.created_at).toLocaleDateString()}</p>
                                                <p className="text-slate-500">Payment Method</p>
                                                <p className="font-semibold">{run.item.payment_method || run.payment_method || 'Offline/Manual'}</p>
                                                <p className="text-slate-500">Status</p>
                                                <p className="font-semibold">{run.item.transfer_status || run.status || 'Finalized'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-600 mb-2">Earnings</h4>
                                            <div className="overflow-hidden border rounded-xl">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-slate-50 dark:bg-slate-800">
                                                        <tr>
                                                            <th className="p-2 text-left">Component</th>
                                                            <th className="p-2 text-right">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {earnings.map(item => (
                                                            <tr key={`${item.id}-${item.label}`} className="border-t border-slate-100 dark:border-slate-700">
                                                                <td className="p-2">{item.label}</td>
                                                                <td className="p-2 text-right">{formatCurrency(item.amount)}</td>
                                                            </tr>
                                                        ))}
                                                        <tr className="bg-slate-100 dark:bg-slate-800 font-semibold">
                                                            <td className="p-2">Gross Pay</td>
                                                            <td className="p-2 text-right">{formatCurrency(earningsTotal)}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-600 mb-2">Deductions</h4>
                                            <div className="overflow-hidden border rounded-xl">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-slate-50 dark:bg-slate-800">
                                                        <tr>
                                                            <th className="p-2 text-left">Component</th>
                                                            <th className="p-2 text-right">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {deductions.map(item => (
                                                            <tr key={`${item.id}-${item.label}`} className="border-t border-slate-100 dark:border-slate-700">
                                                                <td className="p-2">{item.label}</td>
                                                                <td className="p-2 text-right text-red-600">{formatCurrency(Math.abs(item.amount))}</td>
                                                            </tr>
                                                        ))}
                                                        <tr className="bg-slate-100 dark:bg-slate-800 font-semibold">
                                                            <td className="p-2">Total Deductions</td>
                                                            <td className="p-2 text-right">{formatCurrency(totalDeductions)}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                                            <p className="text-sm font-semibold text-green-800 dark:text-green-200">Net Pay</p>
                                            <p className="text-2xl font-extrabold text-green-700">{formatCurrency(run.item.net_amount)}</p>
                                            <p className="text-xs text-green-700/70">Highlighting take-home pay after statutory deductions.</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                            <p className="text-sm font-semibold text-slate-700">Employer Contributions</p>
                                            {employerContribs.length === 0 ? (
                                                <p className="text-xs text-slate-500">None recorded</p>
                                            ) : (
                                                <div className="mt-2 space-y-1">
                                                    {employerContribs.map(item => (
                                                        <div key={item.id} className="flex justify-between text-xs">
                                                            <span>{item.label}</span>
                                                            <span className="font-semibold">{formatCurrency(item.amount)}</span>
                                                        </div>
                                                    ))}
                                                    <div className="flex justify-between text-xs font-semibold border-t border-dashed border-slate-300 pt-1">
                                                        <span>Total Employer Costs</span>
                                                        <span>{formatCurrency(employerTotal)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {pensionRows.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-600 mb-2">Pension Contributions for this Period</h4>
                                            <div className="overflow-hidden border rounded-xl">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-slate-50 dark:bg-slate-800">
                                                        <tr>
                                                            <th className="p-2 text-left">Base</th>
                                                            <th className="p-2 text-right">Employee</th>
                                                            <th className="p-2 text-right">Employer</th>
                                                            <th className="p-2 text-right">Total</th>
                                                            <th className="p-2 text-right">Cumulative</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pensionRows.map(row => (
                                                            <tr key={row.id} className="border-t border-slate-100 dark:border-slate-700">
                                                                <td className="p-2">{formatCurrency(row.pension_base || row.gross_salary)}</td>
                                                                <td className="p-2 text-right">{formatCurrency(row.employee_contribution)}</td>
                                                                <td className="p-2 text-right">{formatCurrency(row.employer_contribution)}</td>
                                                                <td className="p-2 text-right">{formatCurrency(row.total_contribution)}</td>
                                                                <td className="p-2 text-right">{formatCurrency(row.cumulative_total)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid md:grid-cols-2 gap-4 text-xs">
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                            <p className="font-semibold mb-2">YTD / Period-to-date</p>
                                            <div className="space-y-1">
                                                <div className="flex justify-between">
                                                    <span>Gross</span>
                                                    <span className="font-semibold">{formatCurrency(yearToDate.gross)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Tax</span>
                                                    <span className="font-semibold">{formatCurrency(yearToDate.tax)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Pension (EE)</span>
                                                    <span className="font-semibold">{formatCurrency(yearToDate.pensionEmployee)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Pension (ER)</span>
                                                    <span className="font-semibold">{formatCurrency(yearToDate.pensionEmployer)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Net</span>
                                                    <span className="font-semibold">{formatCurrency(yearToDate.net)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                            <p className="font-semibold mb-2">Notes & Support</p>
                                            <p>This payslip is computer-generated. For queries, contact Payroll.</p>
                                            {schoolConfig?.motto && <p className="text-xs text-slate-500 mt-1">{schoolConfig.motto}</p>}
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <button onClick={() => handleDownloadPdf(run)} className="px-3 py-1 text-xs font-semibold rounded-md bg-blue-600 text-white">
                                                    Download PDF
                                                </button>
                                                <button onClick={() => handleDownloadCsv(run)} className="px-3 py-1 text-xs font-semibold rounded-md bg-emerald-600 text-white">
                                                    Download CSV
                                                </button>
                                                <button className="px-3 py-1 text-xs font-semibold rounded-md bg-amber-500 text-white">Raise a Query</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                {myPayrollHistory.length === 0 && <p className="text-center p-8 text-slate-500">You have no payroll history.</p>}
            </div>

            <div className="p-4 rounded-2xl border bg-white dark:bg-slate-900 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-sm text-slate-500">Pension contribution history</p>
                        <p className="text-xl font-bold">Cumulative growth over time</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                                <th className="p-2 text-left">Month/Period</th>
                                <th className="p-2 text-right">Pensionable Base</th>
                                <th className="p-2 text-right">Employee</th>
                                <th className="p-2 text-right">Employer</th>
                                <th className="p-2 text-right">Total</th>
                                <th className="p-2 text-right">Cumulative</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pensionHistory.map(row => (
                                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-700">
                                    <td className="p-2">{row.period_label}</td>
                                    <td className="p-2 text-right">{formatCurrency(row.pension_base || row.gross_salary)}</td>
                                    <td className="p-2 text-right">{formatCurrency(row.employee_contribution)}</td>
                                    <td className="p-2 text-right">{formatCurrency(row.employer_contribution)}</td>
                                    <td className="p-2 text-right">{formatCurrency(row.total_contribution)}</td>
                                    <td className="p-2 text-right font-semibold">{formatCurrency(row.cumulative_total)}</td>
                                </tr>
                            ))}
                            {pensionHistory.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-3 text-center text-slate-500">
                                        No pension contributions recorded yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MyPayrollView;
