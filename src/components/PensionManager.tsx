import React, { useState, useMemo, useEffect } from 'react';
import type { UserProfile, StaffPension, PensionContribution, ContributionInputType } from '../types';
import { supa as supabase } from '../offline/client';
import { 
    BanknotesIcon, 
    SearchIcon, 
    EditIcon, 
    CheckCircleIcon, 
    XCircleIcon,
    CloseIcon,
    PlusCircleIcon,
    ChartBarIcon
} from './common/icons';
import Spinner from './common/Spinner';
import Pagination from './common/Pagination';
import { 
    calculateMonthlyPension, 
    formatNaira, 
    formatContributionType,
    calculatePensionSummary 
} from '../utils/pensionCalculator';

interface PensionManagerProps {
    users: UserProfile[];
    schoolId: number;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const PensionManager: React.FC<PensionManagerProps> = ({ users, schoolId, addToast }) => {
    const [staffPensions, setStaffPensions] = useState<StaffPension[]>([]);
    const [contributions, setContributions] = useState<PensionContribution[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
    const [viewingHistory, setViewingHistory] = useState<UserProfile | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    // Filter to staff only (exclude students and guardians)
    const staff = useMemo(() => {
        return users.filter(u => u.role !== 'Student' && u.role !== 'Guardian');
    }, [users]);

    // Load pension data
    useEffect(() => {
        loadPensionData();
    }, [schoolId]);

    const loadPensionData = async () => {
        setLoading(true);
        try {
            // Fetch all staff pensions for this school
            const { data: pensionData, error: pensionError } = await supabase
                .from('staff_pension')
                .select('*')
                .eq('school_id', schoolId);

            if (pensionError) throw pensionError;
            setStaffPensions(pensionData || []);

            // Fetch all contributions for this school
            const { data: contributionData, error: contributionError } = await supabase
                .from('pension_contributions')
                .select('*')
                .eq('school_id', schoolId)
                .order('contribution_month', { ascending: true });

            if (contributionError) throw contributionError;
            setContributions(contributionData || []);
        } catch (error: any) {
            console.error('Error loading pension data:', error);
            addToast(`Failed to load pension data: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filter staff based on search
    const filteredStaff = useMemo(() => {
        if (!searchTerm.trim()) return staff;
        const q = searchTerm.toLowerCase();
        return staff.filter(s => 
            s.name.toLowerCase().includes(q) || 
            s.role.toLowerCase().includes(q) ||
            s.staff_code?.toLowerCase().includes(q)
        );
    }, [staff, searchTerm]);

    // Paginate filtered staff
    const paginatedStaff = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredStaff.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredStaff, currentPage]);

    const totalPages = Math.ceil(filteredStaff.length / ITEMS_PER_PAGE);

    // Get pension config for a staff member - memoized for performance
    const pensionConfigMap = useMemo(() => {
        const map = new Map<string, StaffPension>();
        staffPensions.forEach(p => map.set(p.user_id, p));
        return map;
    }, [staffPensions]);

    // Get contributions for a staff member - memoized for performance
    const contributionsMap = useMemo(() => {
        const map = new Map<string, PensionContribution[]>();
        contributions.forEach(c => {
            if (!map.has(c.user_id)) {
                map.set(c.user_id, []);
            }
            map.get(c.user_id)!.push(c);
        });
        return map;
    }, [contributions]);

    const getPensionConfig = (userId: string): StaffPension | undefined => {
        return pensionConfigMap.get(userId);
    };

    const getContributions = (userId: string): PensionContribution[] => {
        return contributionsMap.get(userId) || [];
    };

    const handleEdit = (staff: UserProfile) => {
        setEditingStaff(staff);
    };

    const handleViewHistory = (staff: UserProfile) => {
        setViewingHistory(staff);
    };

    const handleSavePension = async (config: Partial<StaffPension>) => {
        try {
            const existingConfig = getPensionConfig(editingStaff!.id);
            
            if (existingConfig) {
                // Update existing
                const { error } = await supabase
                    .from('staff_pension')
                    .update(config)
                    .eq('id', existingConfig.id);
                
                if (error) throw error;
                addToast('Pension configuration updated successfully', 'success');
            } else {
                // Insert new
                const { error } = await supabase
                    .from('staff_pension')
                    .insert({
                        ...config,
                        user_id: editingStaff!.id,
                        school_id: schoolId,
                    });
                
                if (error) throw error;
                addToast('Pension configuration created successfully', 'success');
            }

            await loadPensionData();
            setEditingStaff(null);
        } catch (error: any) {
            console.error('Error saving pension config:', error);
            addToast(`Failed to save: ${error.message}`, 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                    <BanknotesIcon className="w-6 h-6 text-green-600" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                        Pension Management
                    </h3>
                </div>
                <div className="relative w-full md:w-64">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search staff..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full pl-10 pr-4 py-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Staff List */}
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Staff</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Role</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Base Pay</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Provider</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Months</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {paginatedStaff.map(staff => {
                                const config = getPensionConfig(staff.id);
                                const staffContributions = getContributions(staff.id);
                                const totalMonths = staffContributions.length + (config?.preexisting_pension_months || 0);
                                
                                return (
                                    <tr key={staff.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-white">
                                            {staff.name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                            {staff.role}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                            {formatNaira(staff.base_pay || 0)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {config?.is_enrolled ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                                                    <CheckCircleIcon className="w-3 h-3" />
                                                    Enrolled
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium">
                                                    <XCircleIcon className="w-3 h-3" />
                                                    Not Enrolled
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                            {config?.pension_provider || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                            {totalMonths > 0 ? `${totalMonths} months` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(staff)}
                                                    className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md text-blue-600 dark:text-blue-400 transition-colors"
                                                    title="Configure Pension"
                                                >
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                                {config?.is_enrolled && staffContributions.length > 0 && (
                                                    <button
                                                        onClick={() => handleViewHistory(staff)}
                                                        className="p-1 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md text-green-600 dark:text-green-400 transition-colors"
                                                        title="View History"
                                                    >
                                                        <ChartBarIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            )}

            {/* Configuration Modal */}
            {editingStaff && (
                <PensionConfigModal
                    staff={editingStaff}
                    existingConfig={getPensionConfig(editingStaff.id)}
                    onSave={handleSavePension}
                    onClose={() => setEditingStaff(null)}
                />
            )}

            {/* History Modal */}
            {viewingHistory && (
                <PensionHistoryModal
                    staff={viewingHistory}
                    config={getPensionConfig(viewingHistory.id)!}
                    contributions={getContributions(viewingHistory.id)}
                    onClose={() => setViewingHistory(null)}
                />
            )}
        </div>
    );
};

// Configuration Modal Component
const PensionConfigModal: React.FC<{
    staff: UserProfile;
    existingConfig?: StaffPension;
    onSave: (config: Partial<StaffPension>) => Promise<void>;
    onClose: () => void;
}> = ({ staff, existingConfig, onSave, onClose }) => {
    const [formData, setFormData] = useState<Partial<StaffPension>>({
        is_enrolled: existingConfig?.is_enrolled || false,
        enrollment_date: existingConfig?.enrollment_date || new Date().toISOString().split('T')[0],
        pension_provider: existingConfig?.pension_provider || '',
        pension_pin: existingConfig?.pension_pin || '',
        
        employee_contribution_type: existingConfig?.employee_contribution_type || 'percentage',
        employee_contribution_value: existingConfig?.employee_contribution_value || 8.00,
        
        employer_contribution_enabled: existingConfig?.employer_contribution_enabled ?? true,
        employer_contribution_type: existingConfig?.employer_contribution_type || 'percentage',
        employer_contribution_value: existingConfig?.employer_contribution_value || 10.00,
        
        voluntary_contribution_enabled: existingConfig?.voluntary_contribution_enabled || false,
        voluntary_contribution_type: existingConfig?.voluntary_contribution_type || 'fixed',
        voluntary_contribution_value: existingConfig?.voluntary_contribution_value || 0,
        
        has_preexisting_pension: existingConfig?.has_preexisting_pension || false,
        preexisting_pension_amount: existingConfig?.preexisting_pension_amount || 0,
        preexisting_pension_months: existingConfig?.preexisting_pension_months || 0,
        preexisting_pension_provider: existingConfig?.preexisting_pension_provider || '',
        preexisting_pension_pin: existingConfig?.preexisting_pension_pin || '',
        preexisting_pension_transfer_date: existingConfig?.preexisting_pension_transfer_date || '',
        preexisting_pension_verified: existingConfig?.preexisting_pension_verified || false,
    });

    const [isSaving, setIsSaving] = useState(false);

    // Calculate preview
    const preview = useMemo(() => {
        if (!formData.is_enrolled || !staff.base_pay) return null;
        
        const mockConfig: StaffPension = {
            id: 0,
            user_id: staff.id,
            school_id: 0,
            is_enrolled: formData.is_enrolled!,
            employee_contribution_type: formData.employee_contribution_type!,
            employee_contribution_value: formData.employee_contribution_value!,
            employer_contribution_enabled: formData.employer_contribution_enabled!,
            employer_contribution_type: formData.employer_contribution_type!,
            employer_contribution_value: formData.employer_contribution_value!,
            voluntary_contribution_enabled: formData.voluntary_contribution_enabled!,
            voluntary_contribution_type: formData.voluntary_contribution_type!,
            voluntary_contribution_value: formData.voluntary_contribution_value!,
            has_preexisting_pension: formData.has_preexisting_pension!,
            preexisting_pension_amount: formData.preexisting_pension_amount!,
            preexisting_pension_months: formData.preexisting_pension_months!,
            preexisting_pension_verified: formData.preexisting_pension_verified!,
            created_at: '',
            updated_at: '',
        };

        return calculateMonthlyPension(staff.base_pay, mockConfig);
    }, [formData, staff.base_pay]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(formData);
        setIsSaving(false);
    };

    const inputClasses = "mt-1 block w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-800/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm";
    const labelClasses = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <BanknotesIcon className="w-6 h-6 text-green-600" />
                            Configure Pension - {staff.name}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {staff.role} • Base Pay: {formatNaira(staff.base_pay || 0)}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <CloseIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Enrollment */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="is_enrolled"
                            checked={formData.is_enrolled}
                            onChange={(e) => setFormData({ ...formData, is_enrolled: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="is_enrolled" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Staff is enrolled in pension scheme
                        </label>
                    </div>

                    {formData.is_enrolled && (
                        <>
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClasses}>Enrollment Date</label>
                                    <input
                                        type="date"
                                        value={formData.enrollment_date || ''}
                                        onChange={(e) => setFormData({ ...formData, enrollment_date: e.target.value })}
                                        className={inputClasses}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>Pension Provider</label>
                                    <input
                                        type="text"
                                        value={formData.pension_provider || ''}
                                        onChange={(e) => setFormData({ ...formData, pension_provider: e.target.value })}
                                        placeholder="e.g., ARM Pension"
                                        className={inputClasses}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>RSA PIN</label>
                                    <input
                                        type="text"
                                        value={formData.pension_pin || ''}
                                        onChange={(e) => setFormData({ ...formData, pension_pin: e.target.value })}
                                        placeholder="RSA PIN"
                                        className={inputClasses}
                                    />
                                </div>
                            </div>

                            {/* Employee Contribution */}
                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                                    Employee Contribution (Required)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClasses}>Type</label>
                                        <select
                                            value={formData.employee_contribution_type}
                                            onChange={(e) => setFormData({ 
                                                ...formData, 
                                                employee_contribution_type: e.target.value as ContributionInputType 
                                            })}
                                            className={inputClasses}
                                        >
                                            <option value="percentage">Percentage (%)</option>
                                            <option value="fixed">Fixed Amount (₦)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClasses}>
                                            Value {formData.employee_contribution_type === 'percentage' ? '(%)' : '(₦)'}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.employee_contribution_value}
                                            onChange={(e) => setFormData({ 
                                                ...formData, 
                                                employee_contribution_value: parseFloat(e.target.value) || 0 
                                            })}
                                            className={inputClasses}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Employer Contribution */}
                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Employer Contribution
                                    </h4>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.employer_contribution_enabled}
                                            onChange={(e) => setFormData({ 
                                                ...formData, 
                                                employer_contribution_enabled: e.target.checked 
                                            })}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">Enable</span>
                                    </label>
                                </div>
                                {formData.employer_contribution_enabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClasses}>Type</label>
                                            <select
                                                value={formData.employer_contribution_type}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    employer_contribution_type: e.target.value as ContributionInputType 
                                                })}
                                                className={inputClasses}
                                            >
                                                <option value="percentage">Percentage (%)</option>
                                                <option value="fixed">Fixed Amount (₦)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClasses}>
                                                Value {formData.employer_contribution_type === 'percentage' ? '(%)' : '(₦)'}
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={formData.employer_contribution_value}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    employer_contribution_value: parseFloat(e.target.value) || 0 
                                                })}
                                                className={inputClasses}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Voluntary Contribution */}
                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Voluntary Contribution
                                    </h4>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.voluntary_contribution_enabled}
                                            onChange={(e) => setFormData({ 
                                                ...formData, 
                                                voluntary_contribution_enabled: e.target.checked 
                                            })}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">Enable</span>
                                    </label>
                                </div>
                                {formData.voluntary_contribution_enabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClasses}>Type</label>
                                            <select
                                                value={formData.voluntary_contribution_type}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    voluntary_contribution_type: e.target.value as ContributionInputType 
                                                })}
                                                className={inputClasses}
                                            >
                                                <option value="percentage">Percentage (%)</option>
                                                <option value="fixed">Fixed Amount (₦)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClasses}>
                                                Value {formData.voluntary_contribution_type === 'percentage' ? '(%)' : '(₦)'}
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={formData.voluntary_contribution_value}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    voluntary_contribution_value: parseFloat(e.target.value) || 0 
                                                })}
                                                className={inputClasses}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Preexisting Pension */}
                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <input
                                        type="checkbox"
                                        id="has_preexisting"
                                        checked={formData.has_preexisting_pension}
                                        onChange={(e) => setFormData({ 
                                            ...formData, 
                                            has_preexisting_pension: e.target.checked 
                                        })}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="has_preexisting" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Has Preexisting Pension from Previous Employment
                                    </label>
                                </div>
                                {formData.has_preexisting_pension && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                                        <div>
                                            <label className={labelClasses}>Amount (₦)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={formData.preexisting_pension_amount}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    preexisting_pension_amount: parseFloat(e.target.value) || 0 
                                                })}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Months</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.preexisting_pension_months}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    preexisting_pension_months: parseInt(e.target.value) || 0 
                                                })}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Provider</label>
                                            <input
                                                type="text"
                                                value={formData.preexisting_pension_provider || ''}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    preexisting_pension_provider: e.target.value 
                                                })}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>PIN</label>
                                            <input
                                                type="text"
                                                value={formData.preexisting_pension_pin || ''}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    preexisting_pension_pin: e.target.value 
                                                })}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Transfer Date</label>
                                            <input
                                                type="date"
                                                value={formData.preexisting_pension_transfer_date || ''}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    preexisting_pension_transfer_date: e.target.value 
                                                })}
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div className="flex items-center gap-3 mt-6">
                                            <input
                                                type="checkbox"
                                                id="preexisting_verified"
                                                checked={formData.preexisting_pension_verified}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    preexisting_pension_verified: e.target.checked 
                                                })}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <label htmlFor="preexisting_verified" className="text-sm text-slate-700 dark:text-slate-300">
                                                Verified
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Preview */}
                            {preview && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3">
                                        Monthly Contribution Preview (Based on Base Pay: {formatNaira(staff.base_pay || 0)})
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <div className="text-slate-600 dark:text-slate-400">Employee</div>
                                            <div className="font-semibold text-slate-800 dark:text-white">
                                                {formatNaira(preview.employeeContribution)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-slate-600 dark:text-slate-400">Employer</div>
                                            <div className="font-semibold text-slate-800 dark:text-white">
                                                {formatNaira(preview.employerContribution)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-slate-600 dark:text-slate-400">Voluntary</div>
                                            <div className="font-semibold text-slate-800 dark:text-white">
                                                {formatNaira(preview.voluntaryContribution)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-slate-600 dark:text-slate-400">Total</div>
                                            <div className="font-semibold text-green-600 dark:text-green-400">
                                                {formatNaira(preview.totalContribution)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                                        <div className="text-slate-600 dark:text-slate-400 text-sm">
                                            Deduction from Salary: <span className="font-semibold text-red-600 dark:text-red-400">
                                                {formatNaira(preview.deductionFromSalary)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </form>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving && <Spinner />}
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// History Modal Component
const PensionHistoryModal: React.FC<{
    staff: UserProfile;
    config: StaffPension;
    contributions: PensionContribution[];
    onClose: () => void;
}> = ({ staff, config, contributions, onClose }) => {
    const summary = useMemo(() => {
        return calculatePensionSummary(config, contributions, staff.name);
    }, [config, contributions, staff.name]);

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <ChartBarIcon className="w-6 h-6 text-green-600" />
                            Pension History - {staff.name}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {summary.pensionProvider} • {summary.pensionPin}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <CloseIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total Service Months</div>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {summary.totalServiceMonths}
                            </div>
                            {summary.preexistingMonths > 0 && (
                                <div className="text-xs text-slate-500 mt-1">
                                    ({summary.preexistingMonths} preexisting)
                                </div>
                            )}
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Employee Total</div>
                            <div className="text-xl font-bold text-green-600 dark:text-green-400">
                                {formatNaira(summary.cumulativeEmployee)}
                            </div>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Employer Total</div>
                            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                                {formatNaira(summary.cumulativeEmployer)}
                            </div>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Grand Total</div>
                            <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                                {formatNaira(summary.grandTotal)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contributions Table */}
                <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
                        Monthly Contributions ({contributions.length})
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Period</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">Gross Salary</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">Employee</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">Employer</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">Voluntary</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">Total</th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {contributions.map(contrib => (
                                    <tr key={contrib.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-2 text-sm text-slate-800 dark:text-white">
                                            {contrib.period_label}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right text-slate-600 dark:text-slate-400">
                                            {formatNaira(contrib.gross_salary)}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right text-slate-600 dark:text-slate-400">
                                            {formatNaira(contrib.employee_contribution)}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right text-slate-600 dark:text-slate-400">
                                            {formatNaira(contrib.employer_contribution)}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right text-slate-600 dark:text-slate-400">
                                            {formatNaira(contrib.voluntary_contribution)}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right font-medium text-green-600 dark:text-green-400">
                                            {formatNaira(contrib.total_contribution)}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                                contrib.status === 'confirmed' 
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                    : contrib.status === 'remitted'
                                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                            }`}>
                                                {contrib.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PensionManager;
