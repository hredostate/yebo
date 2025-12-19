
import React, { useState, useMemo, useEffect } from 'react';
import type { UserProfile, Campus } from '../types';
import Spinner from './common/Spinner';
import { SearchIcon, EditIcon, BanknotesIcon } from './common/icons';
import Pagination from './common/Pagination';
import { NIGERIAN_BANKS } from '../constants/banks';

interface StaffPayrollManagerProps {
    users: UserProfile[];
    onUpdateUserPayroll: (userId: string, data: Partial<UserProfile>) => Promise<void>;
    campuses: Campus[];
}

const StaffPayrollManager: React.FC<StaffPayrollManagerProps> = ({ users, onUpdateUserPayroll, campuses }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [campusFilter, setCampusFilter] = useState<number | ''>('');
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    // Exclude students
    const staff = useMemo(() => {
        return users.filter(u => (u.role as string) !== 'Student' && (u.role as string) !== 'Guardian'); 
    }, [users]);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, campusFilter]);

    const filteredStaff = useMemo(() => {
        let filtered = staff;

        if (campusFilter !== '') {
            filtered = filtered.filter(u => u.campus_id === campusFilter);
        }

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(u => 
                u.name.toLowerCase().includes(q) || 
                u.role.toLowerCase().includes(q) ||
                u.staff_code?.toLowerCase().includes(q)
            );
        }
        
        return filtered;
    }, [staff, searchTerm, campusFilter]);

    const paginatedStaff = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredStaff.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredStaff, currentPage]);
    
    const totalPages = Math.ceil(filteredStaff.length / ITEMS_PER_PAGE);

    const handleEdit = (user: UserProfile) => {
        setEditingUser(user);
    };

    const handleClose = () => {
        setEditingUser(null);
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Staff Payroll Data</h3>
                <div className="flex gap-2 w-full md:w-auto">
                    <select 
                        value={campusFilter} 
                        onChange={e => setCampusFilter(e.target.value === '' ? '' : Number(e.target.value))}
                        className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Campuses</option>
                        {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <div className="relative w-full md:w-64">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search staff..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 p-2 text-sm border rounded-md bg-white dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 uppercase text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <tr>
                            <th className="px-4 py-3">Staff Name</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Campus</th>
                            <th className="px-4 py-3">Base Pay</th>
                            <th className="px-4 py-3">Bank</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {paginatedStaff.map(user => {
                            const campusName = campuses.find(c => c.id === user.campus_id)?.name || '-';
                            return (
                                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                        {user.name}
                                        {user.staff_code && <span className="block text-xs text-slate-500">{user.staff_code}</span>}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{user.role}</td>
                                    <td className="px-4 py-3 text-xs text-slate-500">{campusName}</td>
                                    <td className="px-4 py-3 font-mono">
                                        {user.base_pay ? `₦${Number(user.base_pay).toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.bank_name ? (
                                            <div>
                                                <p className="truncate w-32" title={user.bank_name}>{user.bank_name}</p>
                                                <p className="text-xs text-slate-500 font-mono">
                                                    {user.account_number ? `...${user.account_number.slice(-4)}` : ''}
                                                </p>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Missing</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => handleEdit(user)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30">
                                            <EditIcon className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredStaff.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No staff members found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={filteredStaff.length}
            />

            {editingUser && (
                <PayrollDetailsModal 
                    user={editingUser} 
                    onClose={handleClose} 
                    onSave={onUpdateUserPayroll} 
                />
            )}
        </div>
    );
};

const PayrollDetailsModal: React.FC<{
    user: UserProfile;
    onClose: () => void;
    onSave: (userId: string, data: Partial<UserProfile>) => Promise<void>;
}> = ({ user, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        base_pay: user.base_pay || 0,
        commission: user.commission || 0,
        bank_code: user.bank_code || '',
        account_number: user.account_number || '',
        account_name: user.account_name || '',
        staff_code: user.staff_code || '',
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
            base_pay: Number(formData.base_pay),
            commission: Number(formData.commission),
            bank_code: formData.bank_code,
            bank_name: bankName,
            account_number: formData.account_number,
            account_name: formData.account_name,
            staff_code: formData.staff_code,
        });
        
        setIsSaving(false);
        onClose();
    };

    const inputClasses = "mt-1 block w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-800/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm";
    const labelClasses = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <BanknotesIcon className="w-6 h-6 text-green-600"/>
                        Payroll Details: {user.name}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">{user.role}</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClasses}>Staff Code</label>
                            <input type="text" name="staff_code" value={formData.staff_code} onChange={handleChange} className={inputClasses} placeholder="EMP-001" />
                        </div>
                         <div className="col-span-2 border-t border-slate-200 dark:border-slate-700 my-2"></div>
                        <div>
                            <label className={labelClasses}>Base Pay (NGN)</label>
                            <input type="number" name="base_pay" value={formData.base_pay} onChange={handleChange} className={inputClasses} min="0" step="0.01" />
                        </div>
                        <div>
                            <label className={labelClasses}>Commission (NGN)</label>
                            <input type="number" name="commission" value={formData.commission} onChange={handleChange} className={inputClasses} min="0" step="0.01" />
                        </div>
                        <div className="col-span-2 border-t border-slate-200 dark:border-slate-700 my-2"></div>
                        <div className="col-span-2">
                            <label className={labelClasses}>Bank</label>
                            <select name="bank_code" value={formData.bank_code} onChange={handleChange} className={inputClasses}>
                                <option value="">Select Bank...</option>
                                {NIGERIAN_BANKS.map(bank => (
                                    <option key={bank.code} value={bank.code}>{bank.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Account Number</label>
                            <input type="text" name="account_number" value={formData.account_number} onChange={handleChange} className={inputClasses} maxLength={10} placeholder="10 digits" />
                        </div>
                        <div>
                            <label className={labelClasses}>Account Name</label>
                            <input type="text" name="account_name" value={formData.account_name} onChange={handleChange} className={inputClasses} placeholder="As per bank records" />
                        </div>
                    </div>
                </form>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={isSaving} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2">
                        {isSaving ? <Spinner size="sm" /> : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StaffPayrollManager;
