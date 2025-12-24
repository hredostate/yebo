import React, { useState, useEffect, useMemo } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { Student, DedicatedVirtualAccount, BankProvider, PaystackApiSettings, BaseDataObject, Campus } from '../types';
import Spinner from './common/Spinner';
import * as paystackService from '../services/paystackService';
import * as dvaService from '../services/dvaService';
import { mapSupabaseError } from '../utils/errorHandling';

interface DVAManagerProps {
    students: Student[];
    schoolId: number;
    campusId?: number | null;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    currentUserId?: string;
    allClasses?: BaseDataObject[];
    allCampuses?: Campus[];
}

const DVAManager: React.FC<DVAManagerProps> = ({ 
    students, 
    schoolId, 
    campusId, 
    addToast,
    currentUserId = '',
    allClasses = [],
    allCampuses = []
}) => {
    const [dvaList, setDvaList] = useState<DedicatedVirtualAccount[]>([]);
    const [bankProviders, setBankProviders] = useState<BankProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
    const [selectedBank, setSelectedBank] = useState<string>('');
    const [apiSettings, setApiSettings] = useState<PaystackApiSettings | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    // New state for enhanced features
    const [selectedCampusFilter, setSelectedCampusFilter] = useState<number | null>(null);
    const [selectedClassFilter, setSelectedClassFilter] = useState<number | null>(null);
    const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
    const [bulkCreating, setBulkCreating] = useState(false);
    const [sendingSMS, setSendingSMS] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, [schoolId, campusId]);

    const loadData = async () => {
        setLoading(true);
        const supabase = requireSupabaseClient();
        try {
            // Fetch campuses if not provided
            if (!allCampuses || allCampuses.length === 0) {
                const { data: campusesData } = await supabase
                    .from('campuses')
                    .select('*')
                    .eq('school_id', schoolId);
                
                if (campusesData) {
                    // Store in local state or use as is
                    // For now, we'll just note they should be passed as props
                }
            }

            // Fetch API settings for this campus or default
            const { data: settingsData, error: settingsError } = await supabase
                .from('paystack_api_settings')
                .select('*')
                .eq('school_id', schoolId)
                .eq('enabled', true)
                .order('campus_id', { ascending: false })
                .limit(1)
                .single();

            if (settingsError && settingsError.code !== 'PGRST116') {
                console.error('Error fetching API settings:', settingsError);
            }

            if (settingsData) {
                setApiSettings(settingsData);

                // Fetch bank providers
                try {
                    const providers = await paystackService.fetchBankProviders(settingsData.secret_key);
                    setBankProviders(providers);
                } catch (error: any) {
                    console.error('Error fetching bank providers:', error);
                    const userFriendlyMessage = mapSupabaseError(error);
                    addToast('Failed to fetch bank providers: ' + userFriendlyMessage, 'error');
                }
            }

            // Fetch existing DVAs
            const { data: dvaData, error: dvaError } = await supabase
                .from('dedicated_virtual_accounts')
                .select('*, student:students(name, admission_number)')
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false });

            if (dvaError) {
                console.error('Error fetching DVAs:', dvaError);
            } else {
                setDvaList(dvaData || []);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDVA = async () => {
        if (!selectedStudent || !selectedBank || !apiSettings) {
            addToast('Please select a student and bank', 'error');
            return;
        }

        const student = students.find(s => s.id === selectedStudent);
        if (!student) {
            addToast('Student not found', 'error');
            return;
        }

        // Validate student data before creating DVA
        if (!student.name || student.name.trim() === '') {
            addToast('Student name is missing. Please update student information first.', 'error');
            return;
        }

        // Check if DVA already exists
        const existingDVA = dvaList.find(dva => dva.student_id === selectedStudent);
        if (existingDVA) {
            addToast('This student already has a dedicated virtual account', 'error');
            return;
        }

        setCreating(true);
        const supabase = requireSupabaseClient();
        try {
            // Create or get Paystack customer
            const customerId = await paystackService.createOrGetPaystackCustomer(
                apiSettings.secret_key,
                student
            );

            // Create dedicated virtual account
            const dvaResponse = await paystackService.createDedicatedVirtualAccount(
                apiSettings.secret_key,
                customerId,
                selectedBank
            );

            // Save to database
            const { data, error } = await supabase
                .from('dedicated_virtual_accounts')
                .insert([{
                    school_id: schoolId,
                    student_id: selectedStudent,
                    account_number: dvaResponse.data.account_number,
                    account_name: dvaResponse.data.account_name,
                    bank_name: dvaResponse.data.bank.name,
                    bank_slug: dvaResponse.data.bank.slug,
                    bank_id: dvaResponse.data.bank.id,
                    currency: dvaResponse.data.currency,
                    active: dvaResponse.data.active,
                    assigned: dvaResponse.data.assigned,
                    paystack_account_id: dvaResponse.data.id,
                    paystack_customer_id: customerId
                }])
                .select('*, student:students(name, admission_number)')
                .single();

            if (error) throw error;

            setDvaList([data, ...dvaList]);
            addToast('Dedicated Virtual Account created successfully!', 'success');
            setSelectedStudent(null);
            setSelectedBank('');
        } catch (error: any) {
            console.error('Error creating DVA:', error);
            const userFriendlyMessage = mapSupabaseError(error);
            // Provide more specific error message
            const errorMsg = error.message && error.message.includes('Paystack')
                ? error.message
                : 'Failed to create DVA: ' + userFriendlyMessage;
            addToast(errorMsg, 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleDeactivateDVA = async (dva: DedicatedVirtualAccount) => {
        if (!confirm(`Are you sure you want to deactivate the virtual account for ${dva.student?.name}?`)) {
            return;
        }

        if (!apiSettings) {
            addToast('API settings not configured', 'error');
            return;
        }

        const supabase = requireSupabaseClient();
        try {
            // Deactivate on Paystack
            if (dva.paystack_account_id) {
                await paystackService.deactivateDedicatedVirtualAccount(
                    apiSettings.secret_key,
                    dva.paystack_account_id
                );
            }

            // Update in database
            const { error } = await supabase
                .from('dedicated_virtual_accounts')
                .update({ active: false, assigned: false })
                .eq('id', dva.id);

            if (error) throw error;

            setDvaList(dvaList.map(d => d.id === dva.id ? { ...d, active: false, assigned: false } : d));
            addToast('Virtual account deactivated successfully', 'success');
        } catch (error: any) {
            console.error('Error deactivating DVA:', error);
            const userFriendlyMessage = mapSupabaseError(error);
            addToast('Failed to deactivate DVA: ' + userFriendlyMessage, 'error');
        }
    };

    // New handler: Send DVA details to parents via SMS
    const handleSendToParents = async (dva: DedicatedVirtualAccount) => {
        if (!dva.student_id) {
            addToast('Student information missing', 'error');
            return;
        }

        setSendingSMS(dva.id);
        try {
            const student = students.find(s => s.id === dva.student_id);
            if (!student) {
                throw new Error('Student not found');
            }

            const result = await dvaService.sendDVADetailsToParents(
                student,
                dva,
                schoolId,
                currentUserId
            );

            if (result.sent > 0) {
                addToast(`DVA details sent to ${result.sent} parent(s)`, 'success');
            } else {
                addToast('No parent phone numbers found or SMS failed', 'error');
            }
        } catch (error: any) {
            console.error('Error sending DVA details:', error);
            addToast('Failed to send DVA details: ' + error.message, 'error');
        } finally {
            setSendingSMS(null);
        }
    };

    // New handler: Bulk create DVAs
    const handleBulkCreateDVAs = async () => {
        if (selectedStudents.size === 0) {
            addToast('Please select at least one student', 'error');
            return;
        }

        if (!selectedBank) {
            addToast('Please select a preferred bank', 'error');
            return;
        }

        if (!apiSettings) {
            addToast('API settings not configured', 'error');
            return;
        }

        const confirmed = confirm(
            `Create DVAs for ${selectedStudents.size} student(s)? This may take a few moments.`
        );
        if (!confirmed) return;

        setBulkCreating(true);
        const supabase = requireSupabaseClient();
        let successCount = 0;
        let failCount = 0;

        try {
            const studentsToCreate = students.filter(s => selectedStudents.has(s.id));

            for (const student of studentsToCreate) {
                try {
                    const dva = await dvaService.generateDVAForStudent(
                        student,
                        schoolId,
                        selectedBank
                    );

                    // Add to list
                    setDvaList(prev => [dva, ...prev]);

                    // Send SMS to parents
                    try {
                        await dvaService.sendDVADetailsToParents(
                            student,
                            dva,
                            schoolId,
                            currentUserId
                        );
                    } catch (smsError) {
                        console.error('SMS send failed:', smsError);
                        // Don't fail the whole operation if SMS fails
                    }

                    successCount++;
                } catch (error: any) {
                    console.error(`Failed to create DVA for ${student.name}:`, error);
                    failCount++;
                }
            }

            if (successCount > 0) {
                addToast(`Successfully created ${successCount} DVA(s)`, 'success');
            }
            if (failCount > 0) {
                addToast(`Failed to create ${failCount} DVA(s)`, 'error');
            }

            // Clear selection
            setSelectedStudents(new Set());
        } catch (error: any) {
            console.error('Bulk create error:', error);
            addToast('Bulk creation failed: ' + error.message, 'error');
        } finally {
            setBulkCreating(false);
        }
    };

    // New handler: Regenerate DVA
    const handleRegenerateDVA = async (studentId: number) => {
        const student = students.find(s => s.id === studentId);
        if (!student) {
            addToast('Student not found', 'error');
            return;
        }

        if (!selectedBank) {
            addToast('Please select a bank for the new account', 'error');
            return;
        }

        const confirmed = confirm(
            `Regenerate DVA for ${student.name}? The old account will be deactivated and a new one created.`
        );
        if (!confirmed) return;

        setCreating(true);
        try {
            const newDVA = await dvaService.regenerateDVA(
                studentId,
                schoolId,
                selectedBank,
                currentUserId
            );

            // Update list
            setDvaList(prev => prev.filter(d => d.student_id !== studentId).concat(newDVA));

            addToast('DVA regenerated successfully and sent to parents', 'success');
        } catch (error: any) {
            console.error('Error regenerating DVA:', error);
            addToast('Failed to regenerate DVA: ' + error.message, 'error');
        } finally {
            setCreating(false);
        }
    };

    // Toggle student selection
    const toggleStudentSelection = (studentId: number) => {
        const newSelection = new Set(selectedStudents);
        if (newSelection.has(studentId)) {
            newSelection.delete(studentId);
        } else {
            newSelection.add(studentId);
        }
        setSelectedStudents(newSelection);
    };

    // Toggle select all
    const toggleSelectAll = () => {
        if (selectedStudents.size === filteredStudentsWithoutDVA.length) {
            setSelectedStudents(new Set());
        } else {
            setSelectedStudents(new Set(filteredStudentsWithoutDVA.map(s => s.id)));
        }
    };

    // Filtered students based on campus, class, and search
    const filteredStudentsWithoutDVA = useMemo(() => {
        let filtered = students.filter(
            s => !dvaList.some(dva => dva.student_id === s.id)
        );

        // Apply campus filter
        if (selectedCampusFilter) {
            filtered = filtered.filter(s => 
                s.campus_id === selectedCampusFilter ||
                (s.class_id && allClasses.find(c => c.id === s.class_id)?.campus_id === selectedCampusFilter)
            );
        }

        // Apply class filter
        if (selectedClassFilter) {
            filtered = filtered.filter(s => s.class_id === selectedClassFilter);
        }

        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(s =>
                s.name.toLowerCase().includes(query) ||
                s.admission_number?.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [students, dvaList, selectedCampusFilter, selectedClassFilter, searchQuery, allClasses]);

    // Students without DVA
    const studentsWithoutDVA = students.filter(
        s => !dvaList.some(dva => dva.student_id === s.id)
    );

    // Filtered DVA list
    const filteredDVAs = dvaList.filter(dva =>
        dva.student?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dva.account_number.includes(searchQuery) ||
        dva.student?.admission_number?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!apiSettings) {
        return (
            <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">
                    ⚠️ Payment Gateway Not Configured
                </h3>
                <p className="text-amber-800 dark:text-amber-300">
                    Please configure your Paystack API settings in the Global Settings → Payment Gateway tab before creating virtual accounts.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                    Dedicated Virtual Accounts (DVA)
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Manage unique bank accounts for student payments via Paystack.
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-600 dark:text-blue-400">Total DVAs</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{dvaList.length}</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-600 dark:text-green-400">Active</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-200">
                        {dvaList.filter(d => d.active).length}
                    </p>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-600 dark:text-amber-400">Students Without DVA</p>
                    <p className="text-2xl font-bold text-amber-900 dark:text-amber-200">
                        {students.filter(s => !dvaList.some(dva => dva.student_id === s.id)).length}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/40">
                <h4 className="font-medium text-slate-800 dark:text-white mb-4">
                    Filters & Search
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Search
                        </label>
                        <input
                            type="text"
                            placeholder="Name or admission number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                    </div>
                    {allCampuses.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Campus
                            </label>
                            <select
                                value={selectedCampusFilter || ''}
                                onChange={(e) => setSelectedCampusFilter(e.target.value ? Number(e.target.value) : null)}
                                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            >
                                <option value="">All Campuses</option>
                                {allCampuses.map(campus => (
                                    <option key={campus.id} value={campus.id}>
                                        {campus.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {allClasses.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Class
                            </label>
                            <select
                                value={selectedClassFilter || ''}
                                onChange={(e) => setSelectedClassFilter(e.target.value ? Number(e.target.value) : null)}
                                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            >
                                <option value="">All Classes</option>
                                {allClasses.map(cls => (
                                    <option key={cls.id} value={cls.id}>
                                        {cls.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Bank
                        </label>
                        <select
                            value={selectedBank}
                            onChange={(e) => setSelectedBank(e.target.value)}
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        >
                            <option value="">Select bank...</option>
                            {bankProviders.map(bank => (
                                <option key={bank.provider_slug} value={bank.provider_slug}>
                                    {bank.bank_name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Bulk Actions */}
            {filteredStudentsWithoutDVA.length > 0 && (
                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/40">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedStudents.size === filteredStudentsWithoutDVA.length && filteredStudentsWithoutDVA.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Select All ({selectedStudents.size} selected)
                                </span>
                            </label>
                        </div>
                        {selectedStudents.size > 0 && (
                            <button
                                onClick={handleBulkCreateDVAs}
                                disabled={bulkCreating || !selectedBank}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {bulkCreating ? (
                                    <>
                                        <Spinner size="sm" />
                                        Creating...
                                    </>
                                ) : (
                                    `Generate ${selectedStudents.size} DVA(s)`
                                )}
                            </button>
                        )}
                    </div>

                    {/* Student List */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredStudentsWithoutDVA.map(student => (
                            <label
                                key={student.id}
                                className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedStudents.has(student.id)}
                                    onChange={() => toggleStudentSelection(student.id)}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-slate-800 dark:text-white">
                                        {student.name}
                                    </div>
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                        {student.admission_number && `${student.admission_number} • `}
                                        {student.class?.name || 'No class'}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Single DVA Form (legacy) */}
            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/40">
                <h4 className="font-medium text-slate-800 dark:text-white mb-4">
                    Create New DVA
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Select Student
                        </label>
                        <select
                            value={selectedStudent || ''}
                            onChange={(e) => setSelectedStudent(Number(e.target.value))}
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            disabled={creating}
                        >
                            <option value="">Choose a student...</option>
                            {studentsWithoutDVA.map(student => (
                                <option key={student.id} value={student.id}>
                                    {student.name} {student.admission_number ? `(${student.admission_number})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Preferred Bank
                        </label>
                        <select
                            value={selectedBank}
                            onChange={(e) => setSelectedBank(e.target.value)}
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            disabled={creating}
                        >
                            <option value="">Choose a bank...</option>
                            {bankProviders.map(bank => (
                                <option key={bank.provider_slug} value={bank.provider_slug}>
                                    {bank.bank_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleCreateDVA}
                            disabled={creating || !selectedStudent || !selectedBank}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                        >
                            {creating ? <Spinner size="sm" /> : 'Create DVA'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div>
                <input
                    type="text"
                    placeholder="Search by student name, admission number, or account number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
            </div>

            {/* Existing DVAs */}
            <div className="space-y-3">
                <h4 className="font-medium text-slate-700 dark:text-slate-300">
                    Existing Virtual Accounts ({filteredDVAs.length})
                </h4>
                {filteredDVAs.length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                        No virtual accounts found.
                    </p>
                ) : (
                    filteredDVAs.map(dva => (
                        <div
                            key={dva.id}
                            className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h5 className="font-semibold text-slate-800 dark:text-white">
                                            {dva.student?.name}
                                        </h5>
                                        {dva.student?.admission_number && (
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                ({dva.student.admission_number})
                                            </span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                            dva.active
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                        }`}>
                                            {dva.active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="mt-2 space-y-1 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-600 dark:text-slate-400">Bank:</span>
                                            <span className="font-medium text-slate-800 dark:text-white">
                                                {dva.bank_name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-600 dark:text-slate-400">Account Number:</span>
                                            <span className="font-mono font-bold text-lg text-blue-600 dark:text-blue-400">
                                                {dva.account_number}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-600 dark:text-slate-400">Account Name:</span>
                                            <span className="font-medium text-slate-800 dark:text-white">
                                                {dva.account_name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-600 dark:text-slate-400">Currency:</span>
                                            <span className="font-medium text-slate-800 dark:text-white">
                                                {dva.currency}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {dva.active && (
                                        <>
                                            <button
                                                onClick={() => handleSendToParents(dva)}
                                                disabled={sendingSMS === dva.id}
                                                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-400 min-w-[100px]"
                                            >
                                                {sendingSMS === dva.id ? <Spinner size="sm" /> : 'Send to Parent'}
                                            </button>
                                            <button
                                                onClick={() => handleRegenerateDVA(dva.student_id)}
                                                disabled={creating}
                                                className="px-3 py-1 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:bg-amber-400 min-w-[100px]"
                                            >
                                                Regenerate
                                            </button>
                                            <button
                                                onClick={() => handleDeactivateDVA(dva)}
                                                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 min-w-[100px]"
                                            >
                                                Delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default DVAManager;
