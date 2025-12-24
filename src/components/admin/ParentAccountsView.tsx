
import React, { useState, useEffect } from 'react';
import type { ParentProfile, ParentStudentLink, Student } from '../../types';
import { requireSupabaseClient } from '../../services/supabaseClient';
import Spinner from '../common/Spinner';
import { PlusIcon, UserCircleIcon } from '../common/icons';

interface ParentAccountsViewProps {
    schoolId: number;
    students: Student[];
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ParentAccountsView: React.FC<ParentAccountsViewProps> = ({ schoolId, students, addToast }) => {
    const [loading, setLoading] = useState(true);
    const [parents, setParents] = useState<(ParentProfile & { links?: ParentStudentLink[] })[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showBulkCreate, setShowBulkCreate] = useState(false);
    
    useEffect(() => {
        loadParents();
    }, [schoolId]);

    const loadParents = async () => {
        setLoading(true);
        const supabase = requireSupabaseClient();
        
        try {
            const { data: parentProfiles, error } = await supabase
                .from('parent_profiles')
                .select(`
                    *,
                    links:parent_student_links(
                        *,
                        student:students(*)
                    )
                `)
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setParents(parentProfiles || []);
        } catch (error: any) {
            console.error('Error loading parents:', error);
            addToast('Failed to load parent accounts', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkCreate = async () => {
        if (!confirm('This will create parent accounts for all students with parent contact information. Continue?')) {
            return;
        }

        setLoading(true);
        try {
            const supabase = requireSupabaseClient();
            const { data, error } = await supabase.functions.invoke('manage-users', {
                body: {
                    action: 'bulk_create_parent_accounts',
                    school_id: schoolId
                }
            });

            if (error) throw error;

            const successCount = data?.results?.filter((r: any) => r.status === 'Success').length || 0;
            addToast(`Successfully created ${successCount} parent accounts`, 'success');
            loadParents();
        } catch (error: any) {
            console.error('Error creating parent accounts:', error);
            addToast('Failed to create parent accounts: ' + error.message, 'error');
        } finally {
            setLoading(false);
            setShowBulkCreate(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Parent Accounts</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Manage parent/guardian accounts and their linked students
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowBulkCreate(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Bulk Create from Students
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Create Parent Account
                    </button>
                </div>
            </div>

            {showBulkCreate && (
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">
                        Bulk Create Parent Accounts
                    </h3>
                    <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
                        This will automatically create parent accounts from existing student father/mother contact information.
                        If a phone number already exists, the student will be linked to that existing account.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={handleBulkCreate}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
                        >
                            Create Accounts
                        </button>
                        <button
                            onClick={() => setShowBulkCreate(false)}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                {parents.length === 0 ? (
                    <div className="p-12 text-center">
                        <UserCircleIcon className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                        <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                            No parent accounts yet
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            Create parent accounts to give guardians access to their children's information
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                        >
                            Create First Parent Account
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        {parents.map(parent => (
                            <div key={parent.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-bold">
                                                {parent.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                                    {parent.name}
                                                </h3>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                                    {parent.phone_number}
                                                    {parent.phone_number_2 && ` • ${parent.phone_number_2}`}
                                                </p>
                                            </div>
                                        </div>
                                        {parent.links && parent.links.length > 0 && (
                                            <div className="ml-13 mt-2">
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                    Linked Children ({parent.links.length}):
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {parent.links.map(link => (
                                                        <span
                                                            key={link.id}
                                                            className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 rounded-full text-sm"
                                                        >
                                                            {link.student?.name || 'Unknown'}
                                                            <span className="text-xs text-indigo-600 dark:text-indigo-400">
                                                                ({link.relationship})
                                                            </span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                        >
                                            Link Student
                                        </button>
                                        <button
                                            className="px-3 py-1 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                                        >
                                            Reset Password
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ParentAccountsView;
