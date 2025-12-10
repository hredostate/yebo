import React, { useState } from 'react';
import type { Term } from '../types';
import { supabase } from '../services/supabaseClient';
import Spinner from './common/Spinner';
import { CheckCircleIcon, RefreshIcon, AlertCircleIcon } from './common/icons';

interface EnrollmentSyncToolProps {
    terms: Term[];
    schoolId: number;
}

interface SyncResult {
    success: boolean;
    terms_processed: number;
    enrollments_changed: number;
    timestamp: string;
}

const EnrollmentSyncTool: React.FC<EnrollmentSyncToolProps> = ({ terms, schoolId }) => {
    const [selectedTermId, setSelectedTermId] = useState<number | 'all'>('all');
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastResult, setLastResult] = useState<SyncResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSync = async () => {
        setIsSyncing(true);
        setError(null);
        setLastResult(null);

        try {
            const termId = selectedTermId === 'all' ? null : selectedTermId;
            
            const { data, error: syncError } = await supabase.rpc(
                'admin_sync_student_enrollments',
                { 
                    p_school_id: schoolId,
                    p_term_id: termId
                }
            );

            if (syncError) {
                throw syncError;
            }

            setLastResult(data as SyncResult);
        } catch (err: any) {
            console.error('Sync error:', err);
            setError(err.message || 'Failed to sync enrollments');
        } finally {
            setIsSyncing(false);
        }
    };

    // Sort terms by date (most recent first)
    const sortedTerms = [...terms].sort((a, b) => {
        if (a.is_active) return -1;
        if (b.is_active) return 1;
        return b.id - a.id;
    });

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6 space-y-6">
            <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    Student Enrollment Synchronization
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Synchronize student enrollments in academic_class_students based on their class and arm assignments in the students table.
                </p>
            </div>

            {/* Information Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex gap-3">
                    <AlertCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900 dark:text-blue-200">
                        <p className="font-semibold mb-1">Source of Truth: Students Table</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-300">
                            <li>Student class/arm is defined by <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">students.class_id</code> and <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">students.arm_id</code></li>
                            <li>Enrollments are automatically synced when students are added/updated</li>
                            <li>Use this tool to manually sync if data gets out of sync</li>
                            <li>Sync matches students to academic classes by level, arm, and session</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Sync Controls */}
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Select Term to Sync
                    </label>
                    <select
                        value={selectedTermId}
                        onChange={(e) => setSelectedTermId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Recent Terms (up to 10)</option>
                        {sortedTerms.map(term => (
                            <option key={term.id} value={term.id}>
                                {term.session_label} - {term.term_label}
                                {term.is_active ? ' (Active)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    {isSyncing ? (
                        <>
                            <Spinner size="sm" />
                            <span>Syncing Enrollments...</span>
                        </>
                    ) : (
                        <>
                            <RefreshIcon className="w-5 h-5" />
                            <span>Sync Enrollments</span>
                        </>
                    )}
                </button>
            </div>

            {/* Results Display */}
            {lastResult && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex gap-3">
                        <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <div className="flex-1">
                            <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">
                                Sync Completed Successfully
                            </h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-green-700 dark:text-green-300">Terms Processed:</span>
                                    <span className="ml-2 font-semibold text-green-900 dark:text-green-100">
                                        {lastResult.terms_processed}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-green-700 dark:text-green-300">Enrollments Changed:</span>
                                    <span className="ml-2 font-semibold text-green-900 dark:text-green-100">
                                        {lastResult.enrollments_changed}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                                Completed at: {new Date(lastResult.timestamp).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex gap-3">
                        <AlertCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                        <div>
                            <h4 className="font-semibold text-red-900 dark:text-red-200 mb-1">
                                Sync Failed
                            </h4>
                            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* How It Works */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    How Synchronization Works
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <li>For each active student, reads their <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">class_id</code> and <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">arm_id</code></li>
                    <li>Finds matching academic class (by level, arm, and session)</li>
                    <li>Creates or updates enrollment in <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">academic_class_students</code></li>
                    <li>Removes any incorrect or outdated enrollments</li>
                    <li>Reports total changes made</li>
                </ol>
            </div>

            {/* Automatic Sync Info */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Automatic Synchronization
                </h4>
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <p>✓ Enrollments are automatically synced when:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>A new term is created</li>
                        <li>A student's class or arm is changed</li>
                        <li>A new student is added with class/arm assigned</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default EnrollmentSyncTool;
