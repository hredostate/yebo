import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Student, DedicatedVirtualAccount, BankProvider, PaystackApiSettings } from '../types';
import Spinner from './common/Spinner';
import * as paystackService from '../services/paystackService';
import { mapSupabaseError } from '../utils/errorHandling';

interface DVAManagerProps {
    students: Student[];
    schoolId: number;
    campusId?: number | null;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const DVAManager: React.FC<DVAManagerProps> = ({ students, schoolId, campusId, addToast }) => {
    const [dvaList, setDvaList] = useState<DedicatedVirtualAccount[]>([]);
    const [bankProviders, setBankProviders] = useState<BankProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
    const [selectedBank, setSelectedBank] = useState<string>('');
    const [apiSettings, setApiSettings] = useState<PaystackApiSettings | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadData();
    }, [schoolId, campusId]);

    const loadData = async () => {
        setLoading(true);
        try {
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
                        {studentsWithoutDVA.length}
                    </p>
                </div>
            </div>

            {/* Create DVA Form */}
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

            {/* DVA List */}
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
                                <div>
                                    {dva.active && (
                                        <button
                                            onClick={() => handleDeactivateDVA(dva)}
                                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                                        >
                                            Deactivate
                                        </button>
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
