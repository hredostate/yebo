
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { PayrollAdjustment, UserProfile, Campus } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon, TrashIcon, SearchIcon, EditIcon } from './common/icons';
import SearchableSelect from './common/SearchableSelect';
import Pagination from './common/Pagination';
import { mapSupabaseError } from '../utils/errorHandling';

interface PayrollAdjustmentsManagerProps {
    users: UserProfile[];
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    campuses?: Campus[];
}

const PayrollAdjustmentsManager: React.FC<PayrollAdjustmentsManagerProps> = ({ users, addToast, campuses }) => {
    const [adjustments, setAdjustments] = useState<PayrollAdjustment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAdjustment, setEditingAdjustment] = useState<PayrollAdjustment | null>(null);
    
    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [campusFilter, setCampusFilter] = useState<number | ''>('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    
    // Bulk selection states
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('payroll_adjustments')
            .select('*, user:user_profiles(name, campus_id)')
            .is('payroll_run_id', null) // Only show unprocessed adjustments
            .order('created_at', { ascending: false });

        if (error) {
            addToast('Failed to load adjustments.', 'error');
        } else {
            setAdjustments(data || []);
        }
        setIsLoading(false);
    }, [addToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Filter Logic
    const filteredAdjustments = useMemo(() => {
        let filtered = adjustments;

        if (campusFilter !== '') {
            // Filter based on user's campus_id joined in query or local lookup
            // Since join returns user object, we check user.campus_id
            filtered = filtered.filter(adj => {
                const user = users.find(u => u.id === adj.user_id);
                return user?.campus_id === campusFilter;
            });
        }

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(adj => 
                adj.reason.toLowerCase().includes(q) ||
                adj.user?.name.toLowerCase().includes(q)
            );
        }
        
        return filtered;
    }, [adjustments, searchTerm, campusFilter, users]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredAdjustments.length / ITEMS_PER_PAGE);
    const paginatedAdjustments = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAdjustments.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredAdjustments, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, campusFilter]);


    const handleSave = async (data: Partial<Omit<PayrollAdjustment, 'id' | 'user_id'>> & { id?: number, user_ids?: string[] }) => {
        const { user_ids, id, ...rest } = data;
        
        // Fix: Store all amounts as positive values to prevent double-negation bug where deductions were incorrectly added instead of subtracted during payroll calculation
        const amount = Math.abs(Number(rest.amount));

        if (id) {
            // Update existing
            const { error } = await supabase.from('payroll_adjustments').update({ ...rest, amount }).eq('id', id);
             if (error) {
                const userFriendlyMessage = mapSupabaseError(error);
                addToast(`Failed to update adjustment: ${userFriendlyMessage}`, 'error');
                return false;
            } else {
                addToast('Adjustment updated successfully.', 'success');
                await fetchData();
                return true;
            }
        } else {
            // Create new (possibly bulk)
            if (!user_ids || user_ids.length === 0) return false;
            const recordsToInsert = user_ids.map(user_id => ({
                ...rest,
                amount,
                user_id,
                school_id: users.find(u => u.id === user_id)?.school_id
            }));

            const { error } = await supabase.from('payroll_adjustments').insert(recordsToInsert);
            
            if (error) {
                const userFriendlyMessage = mapSupabaseError(error);
                addToast(`Failed to save adjustments: ${userFriendlyMessage}`, 'error');
                return false;
            } else {
                addToast('Adjustments saved successfully.', 'success');
                await fetchData();
                return true;
            }
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this unprocessed adjustment?')) {
            const { error } = await supabase.from('payroll_adjustments').delete().eq('id', id);
            if (error) {
                const userFriendlyMessage = mapSupabaseError(error);
                addToast(`Failed to delete: ${userFriendlyMessage}`, 'error');
            } else {
                addToast('Adjustment deleted.', 'success');
                setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                await fetchData();
            }
        }
    };

    // Bulk delete handler
    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected adjustment(s)?`)) {
            return;
        }
        
        setIsBulkDeleting(true);
        const idsToDelete = Array.from(selectedIds);
        
        const { error } = await supabase
            .from('payroll_adjustments')
            .delete()
            .in('id', idsToDelete);
            
        if (error) {
            const userFriendlyMessage = mapSupabaseError(error);
            addToast(`Failed to delete adjustments: ${userFriendlyMessage}`, 'error');
        } else {
            addToast(`Successfully deleted ${idsToDelete.length} adjustment(s).`, 'success');
            setSelectedIds(new Set());
            await fetchData();
        }
        setIsBulkDeleting(false);
    };

    // Bulk update handler
    const handleBulkUpdate = async (updates: { adjustment_type?: 'addition' | 'deduction'; is_recurring?: boolean }) => {
        if (selectedIds.size === 0) return false;
        
        const idsToUpdate = Array.from(selectedIds);
        
        const { error } = await supabase
            .from('payroll_adjustments')
            .update(updates)
            .in('id', idsToUpdate);
            
        if (error) {
            const userFriendlyMessage = mapSupabaseError(error);
            addToast(`Failed to update adjustments: ${userFriendlyMessage}`, 'error');
            return false;
        } else {
            addToast(`Successfully updated ${idsToUpdate.length} adjustment(s).`, 'success');
            setSelectedIds(new Set());
            setIsBulkUpdateOpen(false);
            await fetchData();
            return true;
        }
    };

    // Selection handlers
    const handleSelectAll = () => {
        const allPageItemsSelected = paginatedAdjustments.every(adj => selectedIds.has(adj.id));
        if (allPageItemsSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(paginatedAdjustments.map(adj => adj.id)));
        }
    };

    const handleSelectOne = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleEdit = (adjustment: PayrollAdjustment) => {
        setEditingAdjustment(adjustment);
        setIsFormOpen(true);
    };
    
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Manage Payroll Adjustments</h3>
            
            {/* Filters & Action Bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex gap-2 w-full md:w-auto flex-grow">
                     {campuses && (
                         <select 
                            value={campusFilter} 
                            onChange={e => setCampusFilter(e.target.value === '' ? '' : Number(e.target.value))}
                            className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Campuses</option>
                            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                     )}
                     <div className="relative w-full max-w-xs">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search adjustment..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 p-2 text-sm border rounded-md bg-white dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                
                <button onClick={() => { setEditingAdjustment(null); setIsFormOpen(!isFormOpen); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 whitespace-nowrap">
                    <PlusCircleIcon className="w-5 h-5"/> {isFormOpen ? 'Cancel' : 'Add New Adjustment'}
                </button>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex flex-wrap gap-3 items-center justify-between animate-fade-in">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        {selectedIds.size} adjustment(s) selected
                    </span>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setIsBulkUpdateOpen(true)}
                            className="px-3 py-1.5 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"
                        >
                            <EditIcon className="w-4 h-4" /> Bulk Update
                        </button>
                        <button 
                            onClick={handleBulkDelete}
                            disabled={isBulkDeleting}
                            className="px-3 py-1.5 text-sm bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-red-400 flex items-center gap-1.5"
                        >
                            {isBulkDeleting ? <Spinner size="sm" /> : <TrashIcon className="w-4 h-4" />}
                            Delete Selected
                        </button>
                        <button 
                            onClick={() => setSelectedIds(new Set())}
                            className="px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                        >
                            Clear Selection
                        </button>
                    </div>
                </div>
            )}

            {/* Bulk Update Modal */}
            {isBulkUpdateOpen && (
                <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/50 mb-4 animate-fade-in">
                    <BulkUpdateForm 
                        selectedCount={selectedIds.size}
                        onSave={handleBulkUpdate}
                        onClose={() => setIsBulkUpdateOpen(false)}
                    />
                </div>
            )}

            {isFormOpen && (
                <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/50 mb-4">
                    <AdjustmentForm 
                        users={users} 
                        onSave={handleSave} 
                        onClose={() => { setIsFormOpen(false); setEditingAdjustment(null); }} 
                        initialData={editingAdjustment}
                    />
                </div>
            )}

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">Pending Adjustments</h2>
                    {paginatedAdjustments.length > 0 && (
                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={paginatedAdjustments.length > 0 && paginatedAdjustments.every(adj => selectedIds.has(adj.id))}
                                onChange={handleSelectAll}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                            />
                            Select All on Page
                        </label>
                    )}
                </div>
                {isLoading && <Spinner />}
                {!isLoading && filteredAdjustments.length === 0 && <p className="text-slate-500 text-center py-8">No pending adjustments found.</p>}
                {!isLoading && paginatedAdjustments.map((adj) => (
                    <div key={adj.id} className={`p-3 border rounded-lg flex justify-between items-center bg-white dark:bg-slate-900 hover:shadow-md transition-shadow ${selectedIds.has(adj.id) ? 'ring-2 ring-blue-500 border-blue-300' : ''}`}>
                        <div className="flex items-center gap-3">
                            <input 
                                type="checkbox"
                                checked={selectedIds.has(adj.id)}
                                onChange={() => handleSelectOne(adj.id)}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                                <p className="font-semibold">{adj.reason} <span className="text-sm font-normal text-slate-500">({adj.user?.name})</span></p>
                                <p className={`text-lg font-bold ${adj.adjustment_type === 'addition' ? 'text-green-600' : 'text-red-600'}`}>
                                    {adj.adjustment_type === 'addition' ? '+' : '-'}₦{Math.abs(adj.amount).toLocaleString()}
                                </p>
                                 {adj.is_recurring && <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-200 text-indigo-800 rounded-full">Recurring</span>}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleEdit(adj)} className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-full transition-colors" title="Edit"><EditIcon className="w-5 h-5"/></button>
                            <button onClick={() => handleDelete(adj.id)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-full transition-colors" title="Delete"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    </div>
                ))}
            </div>
            
            <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={filteredAdjustments.length}
            />
        </div>
    )
};


const AdjustmentForm: React.FC<{
    users: UserProfile[];
    onSave: (data: Partial<Omit<PayrollAdjustment, 'id' | 'user_id'>> & { id?: number, user_ids?: string[] }) => Promise<boolean>;
    onClose: () => void;
    initialData: PayrollAdjustment | null;
}> = ({ users, onSave, onClose, initialData }) => {
    const [amount, setAmount] = useState(initialData ? String(Math.abs(initialData.amount)) : '');
    const [reason, setReason] = useState(initialData?.reason || '');
    const [type, setType] = useState<'addition' | 'deduction'>(initialData?.adjustment_type || 'deduction');
    const [isRecurring, setIsRecurring] = useState(initialData?.is_recurring || false);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>(initialData ? [initialData.user_id] : []);
    const [isSaving, setIsSaving] = useState(false);
    const ALL_STAFF_VALUE = 'ALL_STAFF';

    // If editing, lock user selection to the single user
    const isEditing = !!initialData;

    const userOptions = [{ value: ALL_STAFF_VALUE, label: 'All Staff' }, ...users.map(u => ({ value: u.id, label: u.name }))];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        
        let targetUserIds = selectedUserIds;
        if (selectedUserIds.includes(ALL_STAFF_VALUE)) {
             targetUserIds = users.filter(u => u.role !== 'Admin').map(u => u.id);
        }

        const success = await onSave({
            id: initialData?.id,
            amount: Number(amount),
            reason,
            adjustment_type: type,
            is_recurring: isRecurring,
            user_ids: targetUserIds
        });
        if (success) {
            onClose();
        }
        setIsSaving(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-slate-800 dark:text-white">{isEditing ? 'Edit Adjustment' : 'New Adjustment'}</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (NGN)" required className="p-2 border rounded-md" />
                <select value={type} onChange={e => setType(e.target.value as 'addition' | 'deduction')} className="p-2 border rounded-md">
                    <option value="deduction">Deduction</option>
                    <option value="addition">Addition / Reimbursement</option>
                </select>
            </div>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for adjustment" required className="w-full p-2 border rounded-md" />
            
            {!isEditing && (
                <div>
                    <label className="block text-sm font-medium">Assign To</label>
                     <SearchableSelect
                        options={userOptions}
                        value={selectedUserIds[0]} 
                        onChange={(value) => setSelectedUserIds([value as string])}
                        placeholder="Select staff or 'All Staff'"
                    />
                </div>
            )}
            
            <label className="flex items-center gap-2"><input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} /> Make this a recurring monthly adjustment</label>
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-md text-sm font-medium">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium flex items-center gap-2">
                    {isSaving ? <Spinner size="sm"/> : 'Save'}
                </button>
            </div>
        </form>
    );
};

// Bulk Update Form Component
const BulkUpdateForm: React.FC<{
    selectedCount: number;
    onSave: (updates: { adjustment_type?: 'addition' | 'deduction'; is_recurring?: boolean }) => Promise<boolean>;
    onClose: () => void;
}> = ({ selectedCount, onSave, onClose }) => {
    const [updateType, setUpdateType] = useState(false);
    const [type, setType] = useState<'addition' | 'deduction'>('deduction');
    const [updateRecurring, setUpdateRecurring] = useState(false);
    const [isRecurring, setIsRecurring] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!updateType && !updateRecurring) {
            return; // No updates selected
        }
        
        setIsSaving(true);
        
        const updates: { adjustment_type?: 'addition' | 'deduction'; is_recurring?: boolean } = {};
        if (updateType) {
            updates.adjustment_type = type;
        }
        if (updateRecurring) {
            updates.is_recurring = isRecurring;
        }
        
        await onSave(updates);
        setIsSaving(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-slate-800 dark:text-white">Bulk Update {selectedCount} Adjustment(s)</h4>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400">
                Select the fields you want to update for all selected adjustments.
            </p>
            
            <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 border rounded-lg bg-white dark:bg-slate-900">
                    <input 
                        type="checkbox" 
                        id="updateType"
                        checked={updateType} 
                        onChange={e => setUpdateType(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                        <label htmlFor="updateType" className="block font-medium text-sm">Update Adjustment Type</label>
                        {updateType && (
                            <select 
                                value={type} 
                                onChange={e => setType(e.target.value as 'addition' | 'deduction')} 
                                className="mt-2 p-2 border rounded-md w-full bg-white dark:bg-slate-800 dark:border-slate-700"
                            >
                                <option value="deduction">Deduction</option>
                                <option value="addition">Addition / Reimbursement</option>
                            </select>
                        )}
                    </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 border rounded-lg bg-white dark:bg-slate-900">
                    <input 
                        type="checkbox" 
                        id="updateRecurring"
                        checked={updateRecurring} 
                        onChange={e => setUpdateRecurring(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                        <label htmlFor="updateRecurring" className="block font-medium text-sm">Update Recurring Status</label>
                        {updateRecurring && (
                            <label className="mt-2 flex items-center gap-2 text-sm">
                                <input 
                                    type="checkbox" 
                                    checked={isRecurring} 
                                    onChange={e => setIsRecurring(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Make selected adjustments recurring monthly
                            </label>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-md text-sm font-medium">Cancel</button>
                <button 
                    type="submit" 
                    disabled={isSaving || (!updateType && !updateRecurring)} 
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium flex items-center gap-2 disabled:bg-indigo-400"
                >
                    {isSaving ? <Spinner size="sm"/> : 'Apply to Selected'}
                </button>
            </div>
        </form>
    );
};

export default PayrollAdjustmentsManager;
