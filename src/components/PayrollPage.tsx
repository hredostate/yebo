
import React, { useState, useMemo, useEffect } from 'react';
import type { UserProfile, PayrollAdjustment, Campus } from '../types';
import Spinner from './common/Spinner';
import { SearchIcon, BanknotesIcon, CheckCircleIcon, XCircleIcon, DownloadIcon } from './common/icons';
import Pagination from './common/Pagination';
import CsvExportModal, { type CsvColumn } from './CsvExportModal';
import { exportToCsv } from '../utils/export';
import { NIGERIAN_BANKS } from '../constants/banks';

interface PayrollPageProps {
    staffForPayroll: UserProfile[];
    adjustments: PayrollAdjustment[];
    onRunPayroll: (staffPay: Record<string, { base_pay: string, commission: string }>) => Promise<void>;
    campuses: Campus[];
}

interface BulkTransferResult {
    success: boolean;
    transfer_code?: string;
    reference?: string;
    message?: string;
    recipients?: Array<{
        name: string;
        amount: number;
        status: string;
        transfer_code?: string;
    }>;
}

const PayrollPage: React.FC<PayrollPageProps> = ({ staffForPayroll, adjustments, onRunPayroll, campuses }) => {
    const [staffPay, setStaffPay] = useState<Record<string, { base_pay: string, commission: string }>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [campusFilter, setCampusFilter] = useState<number | ''>('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isBulkTransferring, setIsBulkTransferring] = useState(false);
    const [bulkTransferResult, setBulkTransferResult] = useState<BulkTransferResult | null>(null);
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const ITEMS_PER_PAGE = 15;

    const pendingAdjustments = useMemo(
        () => adjustments.filter(adj => !adj.payroll_run_id),
        [adjustments]
    );

    // Initialize state with user defaults
    useEffect(() => {
        const initialPay: Record<string, { base_pay: string, commission: string }> = {};
        staffForPayroll.forEach(u => {
            initialPay[u.id] = { base_pay: String(u.base_pay || 0), commission: String(u.commission || 0) };
        });
        setStaffPay(initialPay);
    }, [staffForPayroll]);

    // Reset pagination when search/filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, campusFilter]);

    // Filter and Paginate
    const filteredStaff = useMemo(() => {
        let filtered = staffForPayroll;
        
        if (campusFilter !== '') {
            filtered = filtered.filter(u => u.campus_id === campusFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(u => 
                u.name.toLowerCase().includes(q) || 
                u.role.toLowerCase().includes(q)
            );
        }

        return filtered;
    }, [staffForPayroll, searchQuery, campusFilter]);

    const totalPages = Math.ceil(filteredStaff.length / ITEMS_PER_PAGE);
    const paginatedStaff = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredStaff.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredStaff, currentPage]);

    // Handle run - amounts are now fixed from profile
    const handleRun = async () => {
        setIsProcessing(true);
        await onRunPayroll(staffPay);
        setIsProcessing(false);
    };

    // Get selected campus
    const selectedCampus = campusFilter ? campuses.find(c => c.id === campusFilter) : null;
    const hasPaystackConfig = selectedCampus?.paystack_secret_key;

    // Calculate bulk transfer data
    const bulkTransferData = useMemo(() => {
        return filteredStaff
            .filter(u => u.account_number && u.bank_code)
            .map(user => {
                const userAdjustments = pendingAdjustments.filter(a => a.user_id === user.id);
                const totalAdjustments = userAdjustments.reduce((sum, adj) => {
                    return adj.adjustment_type === 'addition' ? sum + adj.amount : sum - adj.amount;
                }, 0);
                
                const userPay = staffPay[user.id] as { base_pay: string; commission: string } | undefined;
                const base = Number(userPay?.base_pay) || 0;
                const commission = Number(userPay?.commission) || 0;
                const net = base + commission + totalAdjustments;

                return {
                    name: user.name,
                    account_number: user.account_number!,
                    bank_code: user.bank_code!,
                    amount: Math.round(net * 100), // Paystack uses kobo
                    reason: `Salary payment - ${new Date().toLocaleDateString()}`,
                };
            })
            .filter(t => t.amount > 0);
    }, [filteredStaff, pendingAdjustments, staffPay]);

    // Handle bulk transfer via Paystack
    const handleBulkTransfer = async () => {
        if (!selectedCampus?.paystack_secret_key) {
            alert('Please configure Paystack API keys for this campus first.');
            return;
        }

        if (bulkTransferData.length === 0) {
            alert('No valid recipients with bank details found.');
            return;
        }

        setIsBulkTransferring(true);
        setBulkTransferResult(null);

        try {
            // Step 1: Create transfer recipients
            const recipients = [];
            for (const transfer of bulkTransferData) {
                const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${selectedCampus.paystack_secret_key}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        type: 'nuban',
                        name: transfer.name,
                        account_number: transfer.account_number,
                        bank_code: transfer.bank_code,
                        currency: 'NGN',
                    }),
                });

                if (!recipientRes.ok) {
                    throw new Error(`Failed to create recipient for ${transfer.name}`);
                }

                const recipientData = await recipientRes.json();
                recipients.push({
                    ...transfer,
                    recipient_code: recipientData.data.recipient_code,
                });
            }

            // Step 2: Initiate bulk transfer
            const bulkTransferRes = await fetch('https://api.paystack.co/transfer/bulk', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${selectedCampus.paystack_secret_key}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    source: 'balance',
                    currency: 'NGN',
                    transfers: recipients.map(r => ({
                        amount: r.amount,
                        recipient: r.recipient_code,
                        reason: r.reason,
                        reference: `SAL-${Date.now()}-${r.name.replace(/\s/g, '')}`,
                    })),
                }),
            });

            const bulkResult = await bulkTransferRes.json();

            if (bulkResult.status) {
                setBulkTransferResult({
                    success: true,
                    message: 'Bulk transfer initiated successfully!',
                    recipients: recipients.map((r, i) => ({
                        name: r.name,
                        amount: r.amount / 100,
                        status: 'pending',
                        transfer_code: bulkResult.data?.[i]?.transfer_code,
                    })),
                });
            } else {
                throw new Error(bulkResult.message || 'Bulk transfer failed');
            }
        } catch (error: any) {
            setBulkTransferResult({
                success: false,
                message: error.message || 'An error occurred during bulk transfer',
            });
        }

        setIsBulkTransferring(false);
    };

    // CSV Export Configuration
    const csvColumns: CsvColumn[] = [
        { key: 'staff_name', label: 'Staff Name', defaultChecked: true },
        { key: 'role', label: 'Role', defaultChecked: true },
        { key: 'campus', label: 'Campus', defaultChecked: true },
        { key: 'base_pay', label: 'Base Pay', defaultChecked: true },
        { key: 'commission', label: 'Commission', defaultChecked: true },
        { key: 'adjustments_total', label: 'Adjustments Total', defaultChecked: true },
        { key: 'net_amount', label: 'Net Amount', defaultChecked: true },
        { key: 'bank_name', label: 'Bank Name', defaultChecked: false },
        { key: 'account_number', label: 'Account Number', defaultChecked: false },
        { key: 'email', label: 'Email', defaultChecked: false },
        { key: 'phone_number', label: 'Phone Number', defaultChecked: false },
    ];

    // Handle CSV export
    const handleCsvExport = (selectedColumns: string[]) => {
        // Create a lookup map from csvColumns for efficient access
        const columnLabels = csvColumns.reduce<Record<string, string>>((acc, col) => {
            acc[col.key] = col.label;
            return acc;
        }, {});

        // Prepare data for all filtered staff
        const exportData = filteredStaff.map(user => {
            const userAdjustments = pendingAdjustments.filter(a => a.user_id === user.id);
            const totalAdjustments = userAdjustments.reduce((sum, adj) => {
                return adj.adjustment_type === 'addition' ? sum + adj.amount : sum - adj.amount;
            }, 0);
            
            const userPay = staffPay[user.id] as { base_pay: string; commission: string } | undefined;
            const base = Number(userPay?.base_pay) || 0;
            const commission = Number(userPay?.commission) || 0;
            const net = base + commission + totalAdjustments;
            const campusName = campuses.find(c => c.id === user.campus_id)?.name || 'Main';
            const bankName = NIGERIAN_BANKS.find(b => b.code === user.bank_code)?.name || user.bank_name || '';

            // Map of all possible column values
            const columnValues: Record<string, any> = {
                'staff_name': user.name,
                'role': user.role,
                'campus': campusName,
                'base_pay': base,
                'commission': commission,
                'adjustments_total': totalAdjustments,
                'net_amount': net,
                'bank_name': bankName,
                'account_number': user.account_number || '',
                'email': user.email || '',
                'phone_number': user.phone_number || '',
            };

            // Build row with only selected columns using human-readable labels
            const row: Record<string, any> = {};
            selectedColumns.forEach(col => {
                const label = columnLabels[col];
                if (label && columnValues[col] !== undefined) {
                    row[label] = columnValues[col];
                }
            });

            return row;
        });

        // Generate filename with current date
        const date = new Date().toISOString().split('T')[0];
        const filename = `payroll-export-${date}.csv`;

        // Export to CSV
        exportToCsv(exportData, filename);
        setIsCsvModalOpen(false);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* CSV Export Modal */}
            <CsvExportModal
                isOpen={isCsvModalOpen}
                onClose={() => setIsCsvModalOpen(false)}
                onExport={handleCsvExport}
                columns={csvColumns}
            />

            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Run Payroll</h1>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsCsvModalOpen(true)} 
                        className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        Download CSV
                    </button>
                    {hasPaystackConfig && (
                        <button 
                            onClick={handleBulkTransfer} 
                            disabled={isBulkTransferring || bulkTransferData.length === 0}
                            className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:bg-purple-400 flex items-center gap-2"
                        >
                            {isBulkTransferring ? <Spinner size="sm"/> : <BanknotesIcon className="w-5 h-5" />}
                            Bulk Transfer ({bulkTransferData.length})
                        </button>
                    )}
                    <button onClick={handleRun} disabled={isProcessing} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-green-400 flex items-center">
                        {isProcessing ? <Spinner size="sm"/> : 'Process Payroll'}
                    </button>
                </div>
            </div>

            {/* Bulk Transfer Result */}
            {bulkTransferResult && (
                <div className={`p-4 rounded-lg border ${bulkTransferResult.success ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        {bulkTransferResult.success ? (
                            <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        ) : (
                            <XCircleIcon className="w-5 h-5 text-red-600" />
                        )}
                        <span className={`font-bold ${bulkTransferResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                            {bulkTransferResult.message}
                        </span>
                    </div>
                    {bulkTransferResult.recipients && (
                        <div className="mt-2 text-sm max-h-40 overflow-y-auto">
                            {bulkTransferResult.recipients.map((r, i) => (
                                <div key={i} className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700 last:border-0">
                                    <span>{r.name}</span>
                                    <span>₦{r.amount.toLocaleString()} - {r.status}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <button 
                        onClick={() => setBulkTransferResult(null)}
                        className="mt-2 text-xs text-slate-500 hover:underline"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-lg text-sm border border-blue-200 dark:border-blue-800">
                <span className="font-bold">Note:</span> Base Pay and Commission are managed in the Staff Data tab. They cannot be edited here. Use the filters below to process payroll for specific campuses.
                {hasPaystackConfig && (
                    <p className="mt-1 text-green-700 dark:text-green-300">
                        <BanknotesIcon className="w-4 h-4 inline mr-1" />
                        Paystack API configured for <strong>{selectedCampus?.name}</strong>. Bulk transfer available!
                    </p>
                )}
                {campusFilter && !hasPaystackConfig && (
                    <p className="mt-1 text-amber-700 dark:text-amber-300">
                        ⚠️ Paystack API not configured for this campus. Set it up in HR &amp; Payroll → Campuses.
                    </p>
                )}
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex gap-2 w-full md:w-auto flex-grow">
                     <select 
                        value={campusFilter} 
                        onChange={e => setCampusFilter(e.target.value === '' ? '' : Number(e.target.value))}
                        className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Campuses</option>
                        {campuses.map(c => <option key={c.id} value={c.id}>{c.name} {c.paystack_secret_key ? '✓' : ''}</option>)}
                    </select>
                    <div className="relative w-full max-w-sm">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search staff..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 p-2 text-sm border rounded-md bg-white dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                    Processing {filteredStaff.length} records | Ready for transfer: {bulkTransferData.length}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 dark:bg-slate-800 uppercase text-xs font-semibold">
                            <tr>
                                <th className="p-3">Staff Member</th>
                                <th className="p-3">Campus</th>
                                <th className="p-3">Bank Details</th>
                                <th className="p-3">Base Pay</th>
                                <th className="p-3">Commission</th>
                                <th className="p-3">Adjustments</th>
                                <th className="p-3">Net Pay</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {paginatedStaff.map(user => {
                                const userAdjustments = pendingAdjustments.filter(a => a.user_id === user.id);
                                const totalAdjustments = userAdjustments.reduce((sum, adj) => {
                                    return adj.adjustment_type === 'addition' ? sum + adj.amount : sum - adj.amount;
                                }, 0);
                                
                                const userPay = staffPay[user.id] as { base_pay: string; commission: string } | undefined;
                                const base = Number(userPay?.base_pay) || 0;
                                const commission = Number(userPay?.commission) || 0;
                                const gross = base + commission;
                                const net = gross + totalAdjustments;
                                const campusName = campuses.find(c => c.id === user.campus_id)?.name || 'Main';

                                return (
                                    <tr key={user.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="p-3 font-medium">
                                            {user.name}
                                            <span className="block text-xs text-slate-500">{user.role}</span>
                                        </td>
                                        <td className="p-3 text-xs">{campusName}</td>
                                        <td className="p-3 text-xs">
                                            {user.account_number ? (
                                                <>
                                                    {user.account_number} ({user.account_name})
                                                    <br/>
                                                    <span className="text-slate-500">{NIGERIAN_BANKS.find(b => b.code === user.bank_code)?.name || user.bank_name}</span>
                                                </>
                                            ) : (
                                                <span className="text-red-500">Missing bank details</span>
                                            )}
                                        </td>
                                        <td className="p-3 font-mono">
                                            ₦{base.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-3 font-mono">
                                            ₦{commission.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-3">
                                            {userAdjustments.length > 0 ? (
                                                <div className="text-xs">
                                                    {userAdjustments.map(adj => (
                                                        <p key={adj.id} className={adj.adjustment_type === 'addition' ? 'text-green-600' : 'text-red-600'}>
                                                            {adj.reason}: {adj.adjustment_type === 'addition' ? '+' : '-'}{adj.amount.toLocaleString()}
                                                        </p>
                                                    ))}
                                                    <p className="font-bold border-t mt-1 pt-1">Total: {totalAdjustments.toLocaleString()}</p>
                                                </div>
                                            ) : 'None'}
                                        </td>
                                        <td className="p-3 font-bold text-lg">
                                            {net > 0 ? `₦${net.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '0.00'}
                                        </td>
                                    </tr>
                                )
                            })}
                            {filteredStaff.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">No staff found matching your search.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                    <Pagination 
                        currentPage={currentPage} 
                        totalPages={totalPages} 
                        onPageChange={setCurrentPage} 
                        itemsPerPage={ITEMS_PER_PAGE}
                        totalItems={filteredStaff.length}
                    />
                </div>
            </div>
        </div>
    );
};

export default PayrollPage;
