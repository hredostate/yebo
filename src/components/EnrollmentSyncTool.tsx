import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../offline/client';
import type { Term } from '../types';

interface EnrollmentSyncToolProps {
    terms: Term[];
    schoolId: number;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface SyncStats {
    created: number;
    updated: number;
    removed: number;
    errors: number;
    total_processed: number;
}

interface SyncResult {
    success: boolean;
    term_id: number;
    school_id: number;
    before_count: number;
    after_count: number;
    sync_stats: SyncStats;
}

interface DiagnosticRecord {
    student_id: number;
    student_name: string;
    current_class_id: number | null;
    current_arm_id: number | null;
    current_class_name: string | null;
    current_arm_name: string | null;
    expected_academic_class_id: number | null;
    expected_academic_class_name: string | null;
    enrolled_academic_class_id: number | null;
    enrolled_academic_class_name: string | null;
    sync_status: 'no_assignment' | 'no_matching_class' | 'not_enrolled' | 'mismatched' | 'synced';
    issue_description: string;
}

const EnrollmentSyncTool: React.FC<EnrollmentSyncToolProps> = ({ terms, schoolId, addToast }) => {
    const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
    const [diagnostics, setDiagnostics] = useState<DiagnosticRecord[]>([]);
    const [showDiagnostics, setShowDiagnostics] = useState(false);

    // Auto-select first active term
    useEffect(() => {
        if (!selectedTermId && terms.length > 0) {
            const activeTerm = terms.find(t => t.is_active);
            setSelectedTermId(activeTerm?.id || terms[0]?.id || null);
        }
    }, [terms, selectedTermId]);

    const handleSync = useCallback(async () => {
        if (!selectedTermId) {
            addToast('Please select a term to sync', 'error');
            return;
        }

        setSyncing(true);
        setSyncResult(null);

        try {
            const { data, error } = await supabase.rpc('admin_sync_student_enrollments', {
                p_term_id: selectedTermId,
                p_school_id: schoolId
            });

            if (error) throw error;

            setSyncResult(data as SyncResult);
            
            const stats = data.sync_stats;
            addToast(
                `Sync completed: ${stats.created} created, ${stats.updated} updated, ${stats.removed} removed`,
                'success'
            );

            // Auto-load diagnostics after sync if there are issues
            if (stats.errors > 0) {
                loadDiagnostics();
            }
        } catch (error: any) {
            console.error('Sync error:', error);
            addToast(`Sync failed: ${error.message}`, 'error');
        } finally {
            setSyncing(false);
        }
    }, [selectedTermId, schoolId, addToast]);

    const loadDiagnostics = useCallback(async () => {
        if (!selectedTermId) {
            addToast('Please select a term to diagnose', 'error');
            return;
        }

        setLoadingDiagnostics(true);
        setDiagnostics([]);

        try {
            const { data, error } = await supabase.rpc('get_enrollment_sync_diagnostics', {
                p_term_id: selectedTermId,
                p_school_id: schoolId
            });

            if (error) throw error;

            setDiagnostics(data || []);
            setShowDiagnostics(true);

            if (data && data.length === 0) {
                addToast('No sync issues found! All students are properly enrolled.', 'success');
            } else {
                addToast(`Found ${data?.length || 0} students with enrollment issues`, 'info');
            }
        } catch (error: any) {
            console.error('Diagnostics error:', error);
            addToast(`Failed to load diagnostics: ${error.message}`, 'error');
        } finally {
            setLoadingDiagnostics(false);
        }
    }, [selectedTermId, schoolId, addToast]);

    const selectedTerm = terms.find(t => t.id === selectedTermId);

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'synced':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'not_enrolled':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'mismatched':
                return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
            case 'no_assignment':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
            case 'no_matching_class':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            default:
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Enrollment Synchronization
                </h2>
                <p className="text-slate-600 dark:text-slate-300">
                    Sync student enrollments based on their class and arm assignments. 
                    The students table (class_id, arm_id) is the source of truth.
                </p>
            </div>

            {/* Term Selector and Sync Button */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Select Term to Sync
                    </label>
                    <select
                        value={selectedTermId || ''}
                        onChange={(e) => setSelectedTermId(Number(e.target.value))}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={syncing || loadingDiagnostics}
                    >
                        <option value="">-- Select a term --</option>
                        {terms.map(term => (
                            <option key={term.id} value={term.id}>
                                {term.session_label} - {term.term_label} 
                                {term.is_active ? ' (Active)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleSync}
                        disabled={!selectedTermId || syncing || loadingDiagnostics}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {syncing ? (
                            <>
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Syncing...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Sync Enrollments
                            </>
                        )}
                    </button>

                    <button
                        onClick={loadDiagnostics}
                        disabled={!selectedTermId || syncing || loadingDiagnostics}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loadingDiagnostics ? (
                            <>
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Loading...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                                Run Diagnostics
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Sync Results */}
            {syncResult && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                        Last Sync Results
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Before</div>
                            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                                {syncResult.before_count}
                            </div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                            <div className="text-sm text-green-600 dark:text-green-400 font-medium">Created</div>
                            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                                {syncResult.sync_stats.created}
                            </div>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                            <div className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Updated</div>
                            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                                {syncResult.sync_stats.updated}
                            </div>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                            <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">Removed</div>
                            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                                {syncResult.sync_stats.removed}
                            </div>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                            <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">After</div>
                            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                                {syncResult.after_count}
                            </div>
                        </div>
                    </div>
                    {syncResult.sync_stats.errors > 0 && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-red-800 dark:text-red-200 text-sm">
                                ⚠️ {syncResult.sync_stats.errors} errors occurred during sync. 
                                Run diagnostics to see details.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Diagnostics Results */}
            {showDiagnostics && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Enrollment Diagnostics
                            {diagnostics.length > 0 && (
                                <span className="ml-2 text-sm font-normal text-slate-500">
                                    ({diagnostics.length} issues found)
                                </span>
                            )}
                        </h3>
                        <button
                            onClick={() => setShowDiagnostics(false)}
                            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {diagnostics.length === 0 ? (
                        <div className="text-center py-8">
                            <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-slate-600 dark:text-slate-400">
                                All students are properly enrolled! No sync issues detected.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Student</th>
                                        <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Current Assignment</th>
                                        <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Expected Enrollment</th>
                                        <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Actual Enrollment</th>
                                        <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {diagnostics.map((record, idx) => (
                                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-slate-900 dark:text-white">
                                                    {record.student_name}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    ID: {record.student_id}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                {record.current_class_name && record.current_arm_name ? (
                                                    <div>
                                                        <div className="text-slate-900 dark:text-white">
                                                            {record.current_class_name} {record.current_arm_name}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            Class ID: {record.current_class_id}, Arm ID: {record.current_arm_id}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">Not assigned</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {record.expected_academic_class_name ? (
                                                    <div className="text-slate-900 dark:text-white">
                                                        {record.expected_academic_class_name}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">None found</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {record.enrolled_academic_class_name ? (
                                                    <div className="text-slate-900 dark:text-white">
                                                        {record.enrolled_academic_class_name}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">Not enrolled</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div>
                                                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getStatusBadgeColor(record.sync_status)}`}>
                                                        {record.sync_status.replace(/_/g, ' ').toUpperCase()}
                                                    </span>
                                                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                                        {record.issue_description}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Information Panel */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    How Enrollment Sync Works
                </h3>
                <ul className="space-y-2 text-sm text-blue-900 dark:text-blue-100">
                    <li className="flex gap-2">
                        <span className="text-blue-600 dark:text-blue-400">•</span>
                        <span><strong>Source of Truth:</strong> The students table (class_id and arm_id) determines where students should be enrolled.</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="text-blue-600 dark:text-blue-400">•</span>
                        <span><strong>Auto-Sync:</strong> Enrollments are automatically updated when students' class/arm assignments change or when new terms are created.</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="text-blue-600 dark:text-blue-400">•</span>
                        <span><strong>Manual Sync:</strong> Use the "Sync Enrollments" button to manually synchronize all students for a selected term.</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="text-blue-600 dark:text-blue-400">•</span>
                        <span><strong>Diagnostics:</strong> Use "Run Diagnostics" to identify students with enrollment issues before or after syncing.</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="text-blue-600 dark:text-blue-400">•</span>
                        <span><strong>Matching:</strong> Students are enrolled in academic classes where level matches their class name and arm matches their arm name.</span>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default EnrollmentSyncTool;
