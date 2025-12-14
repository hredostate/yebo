import React, { useState, useEffect, useMemo } from 'react';
import type { ZeroScoreEntry } from '../types';
import { supa as supabase } from '../offline/client';
import Spinner from './common/Spinner';
import { CheckCircleIcon, XCircleIcon, TrashIcon, UserCircleIcon, FilterIcon } from './common/icons';

interface ZeroScoreReviewPanelProps {
    termId: number;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    userPermissions: string[];
}

const ZeroScoreReviewPanel: React.FC<ZeroScoreReviewPanelProps> = ({ termId, addToast, userPermissions }) => {
    const [zeroScores, setZeroScores] = useState<ZeroScoreEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterClass, setFilterClass] = useState<string>('all');
    const [filterSubject, setFilterSubject] = useState<string>('all');
    const [filterReviewed, setFilterReviewed] = useState<'all' | 'reviewed' | 'unreviewed'>('unreviewed');
    const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
    const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
    const [showConfirmModal, setShowConfirmModal] = useState<{
        type: 'unenroll' | 'delete';
        entryId: number;
        studentName: string;
        subject: string;
    } | null>(null);

    useEffect(() => {
        fetchZeroScores();
    }, [termId]);

    const fetchZeroScores = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('zero_score_entries')
                .select(`
                    *,
                    student:students(name),
                    academic_class:academic_classes(name),
                    teacher:user_profiles!teacher_user_id(name)
                `)
                .eq('term_id', termId)
                .order('entry_date', { ascending: false });

            if (error) throw error;
            setZeroScores(data || []);
        } catch (error: any) {
            addToast(`Error loading zero score entries: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkReviewed = async (entryId: number) => {
        setProcessingIds(prev => new Set(prev).add(entryId));
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id;

            if (!userId) {
                throw new Error('User not authenticated');
            }

            const { error } = await supabase
                .from('zero_score_entries')
                .update({
                    reviewed: true,
                    reviewed_by: userId,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', entryId);

            if (error) throw error;

            addToast('Entry marked as reviewed', 'success');
            await fetchZeroScores();
            setSelectedEntries(prev => {
                const newSet = new Set(prev);
                newSet.delete(entryId);
                return newSet;
            });
        } catch (error: any) {
            addToast(`Error marking as reviewed: ${error.message}`, 'error');
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(entryId);
                return newSet;
            });
        }
    };

    const handleBulkReview = async () => {
        if (selectedEntries.size === 0) {
            addToast('No entries selected', 'info');
            return;
        }

        const entriesToReview = Array.from(selectedEntries);
        setProcessingIds(new Set(entriesToReview));

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id;

            if (!userId) {
                throw new Error('User not authenticated');
            }

            const { error } = await supabase
                .from('zero_score_entries')
                .update({
                    reviewed: true,
                    reviewed_by: userId,
                    reviewed_at: new Date().toISOString()
                })
                .in('id', entriesToReview);

            if (error) throw error;

            addToast(`${entriesToReview.length} entries marked as reviewed`, 'success');
            await fetchZeroScores();
            setSelectedEntries(new Set());
        } catch (error: any) {
            addToast(`Error in bulk review: ${error.message}`, 'error');
        } finally {
            setProcessingIds(new Set());
        }
    };

    const handleUnenrollStudent = async (entryId: number) => {
        const entry = zeroScores.find(e => e.id === entryId);
        if (!entry) return;

        setProcessingIds(prev => new Set(prev).add(entryId));
        try {
            const { error } = await supabase
                .from('score_entries')
                .delete()
                .eq('student_id', entry.student_id)
                .eq('subject_name', entry.subject_name)
                .eq('term_id', termId);

            if (error) throw error;

            addToast('Student unenrolled from subject', 'success');
            await fetchZeroScores();
            setShowConfirmModal(null);
        } catch (error: any) {
            addToast(`Error unenrolling student: ${error.message}`, 'error');
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(entryId);
                return newSet;
            });
        }
    };

    const handleDeleteEntry = async (entryId: number) => {
        setProcessingIds(prev => new Set(prev).add(entryId));
        try {
            const { error } = await supabase
                .from('zero_score_entries')
                .delete()
                .eq('id', entryId);

            if (error) throw error;

            addToast('Zero score entry deleted', 'success');
            await fetchZeroScores();
            setShowConfirmModal(null);
        } catch (error: any) {
            addToast(`Error deleting entry: ${error.message}`, 'error');
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(entryId);
                return newSet;
            });
        }
    };

    const filteredEntries = useMemo(() => {
        let filtered = [...zeroScores];

        if (filterClass !== 'all') {
            filtered = filtered.filter(e => e.academic_class_id === Number(filterClass));
        }

        if (filterSubject !== 'all') {
            filtered = filtered.filter(e => e.subject_name === filterSubject);
        }

        if (filterReviewed === 'reviewed') {
            filtered = filtered.filter(e => e.reviewed);
        } else if (filterReviewed === 'unreviewed') {
            filtered = filtered.filter(e => !e.reviewed);
        }

        return filtered;
    }, [zeroScores, filterClass, filterSubject, filterReviewed]);

    const uniqueClasses = useMemo(() => {
        const classMap = new Map();
        zeroScores.forEach(z => {
            if (z.academic_class?.name && !classMap.has(z.academic_class_id)) {
                classMap.set(z.academic_class_id, z.academic_class.name);
            }
        });
        return Array.from(classMap.entries()).map(([id, name]) => ({ id, name }));
    }, [zeroScores]);

    const uniqueSubjects = useMemo(() => {
        return [...new Set(zeroScores.map(z => z.subject_name))].sort();
    }, [zeroScores]);

    const stats = useMemo(() => {
        const total = filteredEntries.length;
        const unreviewed = filteredEntries.filter(z => !z.reviewed).length;
        const reviewed = total - unreviewed;
        
        // By subject breakdown
        const bySubject = filteredEntries.reduce((acc, entry) => {
            if (!entry.reviewed) {
                acc[entry.subject_name] = (acc[entry.subject_name] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        return { total, reviewed, unreviewed, bySubject };
    }, [filteredEntries]);

    const toggleSelectAll = () => {
        if (selectedEntries.size === filteredEntries.length) {
            setSelectedEntries(new Set());
        } else {
            setSelectedEntries(new Set(filteredEntries.map(e => e.id)));
        }
    };

    const toggleSelectEntry = (entryId: number) => {
        setSelectedEntries(prev => {
            const newSet = new Set(prev);
            if (newSet.has(entryId)) {
                newSet.delete(entryId);
            } else {
                newSet.add(entryId);
            }
            return newSet;
        });
    };

    const canManageZeroScores = userPermissions.includes('results.manage_zero_scores') || 
                                userPermissions.includes('results.lock_and_publish') || 
                                userPermissions.includes('*');

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Zero Score Review</h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                    Review and manage instances where zero scores were entered
                </p>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Entries</h3>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{stats.total}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Unreviewed</h3>
                    <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">{stats.unreviewed}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Reviewed</h3>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{stats.reviewed}</p>
                </div>
            </div>

            {/* By Subject Breakdown */}
            {Object.keys(stats.bySubject).length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <FilterIcon className="w-4 h-4" />
                        Unreviewed by Subject
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.bySubject)
                            .sort((a, b) => b[1] - a[1])
                            .map(([subject, count]) => (
                                <span
                                    key={subject}
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm font-medium"
                                >
                                    {subject}: {count}
                                </span>
                            ))}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                    <FilterIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Filters</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Review Status
                        </label>
                        <select
                            value={filterReviewed}
                            onChange={(e) => setFilterReviewed(e.target.value as any)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        >
                            <option value="all">All</option>
                            <option value="unreviewed">Unreviewed</option>
                            <option value="reviewed">Reviewed</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Class
                        </label>
                        <select
                            value={filterClass}
                            onChange={(e) => setFilterClass(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        >
                            <option value="all">All Classes</option>
                            {uniqueClasses.map(cls => (
                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Subject
                        </label>
                        <select
                            value={filterSubject}
                            onChange={(e) => setFilterSubject(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        >
                            <option value="all">All Subjects</option>
                            {uniqueSubjects.map(subject => (
                                <option key={subject} value={subject}>{subject}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Bulk Actions */}
            {canManageZeroScores && selectedEntries.size > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                            {selectedEntries.size} {selectedEntries.size === 1 ? 'entry' : 'entries'} selected
                        </p>
                        <button
                            onClick={handleBulkReview}
                            disabled={processingIds.size > 0}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {processingIds.size > 0 ? <Spinner size="sm" /> : <CheckCircleIcon className="w-4 h-4" />}
                            Mark All as Reviewed
                        </button>
                    </div>
                </div>
            )}

            {/* Entries Table */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-700">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-100 dark:bg-slate-700">
                            <tr>
                                {canManageZeroScores && (
                                    <th className="px-4 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            checked={filteredEntries.length > 0 && selectedEntries.size === filteredEntries.length}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                        />
                                    </th>
                                )}
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Date
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Student
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Subject
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Class
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Total Score
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Teacher
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Status
                                </th>
                                {canManageZeroScores && (
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={canManageZeroScores ? 9 : 7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                        No zero score entries found for this term
                                    </td>
                                </tr>
                            ) : (
                                filteredEntries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        {canManageZeroScores && (
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEntries.has(entry.id)}
                                                    onChange={() => toggleSelectEntry(entry.id)}
                                                    disabled={entry.reviewed}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                                                />
                                            </td>
                                        )}
                                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                                            {new Date(entry.entry_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                                            {entry.student?.name || 'Unknown'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                                            {entry.subject_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                                            {entry.academic_class?.name || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white font-semibold">
                                            {entry.total_score}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                                            {entry.teacher?.name || 'Unknown'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {entry.reviewed ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                                                    <CheckCircleIcon className="w-3 h-3" />
                                                    Reviewed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400">
                                                    <XCircleIcon className="w-3 h-3" />
                                                    Unreviewed
                                                </span>
                                            )}
                                        </td>
                                        {canManageZeroScores && (
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex gap-2">
                                                    {!entry.reviewed && (
                                                        <button
                                                            onClick={() => handleMarkReviewed(entry.id)}
                                                            disabled={processingIds.has(entry.id)}
                                                            className="text-green-600 dark:text-green-400 hover:underline disabled:opacity-50"
                                                            title="Mark as reviewed"
                                                        >
                                                            {processingIds.has(entry.id) ? '...' : 'Review'}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setShowConfirmModal({
                                                            type: 'unenroll',
                                                            entryId: entry.id,
                                                            studentName: entry.student?.name || 'Unknown',
                                                            subject: entry.subject_name
                                                        })}
                                                        disabled={processingIds.has(entry.id)}
                                                        className="text-orange-600 dark:text-orange-400 hover:underline disabled:opacity-50"
                                                        title="Unenroll student from subject"
                                                    >
                                                        Unenroll
                                                    </button>
                                                    <button
                                                        onClick={() => setShowConfirmModal({
                                                            type: 'delete',
                                                            entryId: entry.id,
                                                            studentName: entry.student?.name || 'Unknown',
                                                            subject: entry.subject_name
                                                        })}
                                                        disabled={processingIds.has(entry.id)}
                                                        className="text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                                                        title="Delete zero score entry"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                            {showConfirmModal.type === 'unenroll' ? 'Unenroll Student' : 'Delete Entry'}
                        </h3>
                        <p className="text-slate-700 dark:text-slate-300 mb-6">
                            {showConfirmModal.type === 'unenroll' ? (
                                <>
                                    Are you sure you want to unenroll <strong>{showConfirmModal.studentName}</strong> from{' '}
                                    <strong>{showConfirmModal.subject}</strong>? This will delete their score entry for this subject.
                                </>
                            ) : (
                                <>
                                    Are you sure you want to delete this zero score entry for{' '}
                                    <strong>{showConfirmModal.studentName}</strong> in{' '}
                                    <strong>{showConfirmModal.subject}</strong>?
                                </>
                            )}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowConfirmModal(null)}
                                disabled={processingIds.has(showConfirmModal.entryId)}
                                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (showConfirmModal.type === 'unenroll') {
                                        handleUnenrollStudent(showConfirmModal.entryId);
                                    } else {
                                        handleDeleteEntry(showConfirmModal.entryId);
                                    }
                                }}
                                disabled={processingIds.has(showConfirmModal.entryId)}
                                className={`px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                                    showConfirmModal.type === 'unenroll'
                                        ? 'bg-orange-600 hover:bg-orange-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {processingIds.has(showConfirmModal.entryId) ? (
                                    <>
                                        <Spinner size="sm" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        {showConfirmModal.type === 'unenroll' ? (
                                            <>
                                                <UserCircleIcon className="w-4 h-4" />
                                                Unenroll
                                            </>
                                        ) : (
                                            <>
                                                <TrashIcon className="w-4 h-4" />
                                                Delete
                                            </>
                                        )}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZeroScoreReviewPanel;
