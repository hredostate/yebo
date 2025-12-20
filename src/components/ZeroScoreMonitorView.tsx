import React, { useState, useEffect, useMemo } from 'react';
import type { ZeroScoreEntry, Student, UserProfile, AcademicClass, Term } from '../types';
import { requireSupabaseClient } from '../services/supabaseClient';
import Spinner from './common/Spinner';
import { CheckCircleIcon, XCircleIcon, SettingsIcon } from './common/icons';

interface ZeroScoreMonitorViewProps {
    userProfile: UserProfile;
    onBack: () => void;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ZeroScoreMonitorView: React.FC<ZeroScoreMonitorViewProps> = ({ userProfile, onBack, addToast }) => {
    const [zeroScores, setZeroScores] = useState<ZeroScoreEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterReviewed, setFilterReviewed] = useState<'all' | 'reviewed' | 'unreviewed'>('unreviewed');
    const [filterTeacher, setFilterTeacher] = useState<string>('all');
    const [filterSubject, setFilterSubject] = useState<string>('all');
    const [filterTerm, setFilterTerm] = useState<string>('all');
    const [filterDateFrom, setFilterDateFrom] = useState<string>('');
    const [filterDateTo, setFilterDateTo] = useState<string>('');
    const [selectedEntry, setSelectedEntry] = useState<ZeroScoreEntry | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [isReviewing, setIsReviewing] = useState(false);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const PAGE_SIZE = 50;
    const [allTeachers, setAllTeachers] = useState<UserProfile[]>([]);
    const [allSubjects, setAllSubjects] = useState<string[]>([]);
    const [allTerms, setAllTerms] = useState<Term[]>([]);

    useEffect(() => {
        fetchZeroScores();
    }, [userProfile.school_id, page, filterReviewed, filterTeacher, filterTerm, filterDateFrom, filterDateTo]);

    useEffect(() => {
        fetchFilterOptions();
    }, [userProfile.school_id]);

    // Reset page to 1 when server-side filters change
    useEffect(() => {
        setPage(1);
    }, [filterReviewed, filterTeacher, filterTerm, filterDateFrom, filterDateTo]);

    const fetchFilterOptions = async () => {
        try {
            const supabase = requireSupabaseClient();
            
            // Fetch all unique teachers
            const { data: teacherData, error: teacherError } = await supabase
                .from('zero_score_entries')
                .select('teacher_user_id, teacher:user_profiles!teacher_user_id(id, name)')
                .eq('school_id', userProfile.school_id)
                .not('teacher_user_id', 'is', null);
            
            if (teacherError) throw teacherError;
            
            // Get unique teachers
            const seenTeacherIds = new Set<string>();
            const uniqueTeachers = (teacherData || [])
                .map(entry => entry.teacher)
                .filter(t => t && !seenTeacherIds.has(t.id) && seenTeacherIds.add(t.id)) as UserProfile[];
            setAllTeachers(uniqueTeachers);
            
            // Fetch all unique subjects
            const { data: subjectData, error: subjectError } = await supabase
                .from('zero_score_entries')
                .select('subject_name')
                .eq('school_id', userProfile.school_id);
            
            if (subjectError) throw subjectError;
            
            const uniqueSubjects = [...new Set((subjectData || []).map(s => s.subject_name))].sort();
            setAllSubjects(uniqueSubjects);
            
            // Fetch all unique terms
            const { data: termData, error: termError } = await supabase
                .from('zero_score_entries')
                .select('term_id, term:terms(id, name)')
                .eq('school_id', userProfile.school_id)
                .not('term_id', 'is', null);
            
            if (termError) throw termError;
            
            // Get unique terms
            const seenTermIds = new Set<number>();
            const uniqueTerms = (termData || [])
                .map(entry => entry.term)
                .filter(t => t && !seenTermIds.has(t.id) && seenTermIds.add(t.id)) as Term[];
            setAllTerms(uniqueTerms);
        } catch (error: any) {
            // Silently fail for filter options - they're not critical
            console.error('Error fetching filter options:', error);
        }
    };

    const fetchZeroScores = async () => {
        setLoading(true);
        try {
            const supabase = requireSupabaseClient();
            
            // Build query with server-side filters
            let query = supabase
                .from('zero_score_entries')
                .select(`
                    *,
                    student:students(*),
                    teacher:user_profiles!teacher_user_id(*),
                    academic_class:academic_classes(*),
                    term:terms(*)
                `, { count: 'exact' })
                .eq('school_id', userProfile.school_id)
                .order('entry_date', { ascending: false })
                .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

            // Apply server-side filters
            if (filterReviewed === 'reviewed') {
                query = query.eq('reviewed', true);
            } else if (filterReviewed === 'unreviewed') {
                query = query.eq('reviewed', false);
            }
            
            if (filterTeacher !== 'all') {
                query = query.eq('teacher_user_id', filterTeacher);
            }
            
            if (filterTerm !== 'all') {
                query = query.eq('term_id', Number(filterTerm));
            }
            
            if (filterDateFrom) {
                query = query.gte('entry_date', filterDateFrom);
            }
            
            if (filterDateTo) {
                query = query.lte('entry_date', filterDateTo);
            }

            const { data, error, count } = await query;

            if (error) throw error;
            setZeroScores(data || []);
            setTotalCount(count || 0);
        } catch (error: any) {
            addToast(`Error loading zero score entries: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkReviewed = async (entry: ZeroScoreEntry, reviewed: boolean) => {
        setIsReviewing(true);
        try {
            const supabase = requireSupabaseClient();
            const { error } = await supabase
                .from('zero_score_entries')
                .update({
                    reviewed,
                    reviewed_by: reviewed ? userProfile.id : null,
                    reviewed_at: reviewed ? new Date().toISOString() : null,
                    review_notes: reviewed ? reviewNotes : null
                })
                .eq('id', entry.id);

            if (error) throw error;

            addToast(reviewed ? 'Entry marked as reviewed' : 'Review removed', 'success');
            setSelectedEntry(null);
            setReviewNotes('');
            await fetchZeroScores();
        } catch (error: any) {
            addToast(`Error updating entry: ${error.message}`, 'error');
        } finally {
            setIsReviewing(false);
        }
    };

    const filteredEntries = useMemo(() => {
        let filtered = [...zeroScores];

        // Filter by subject (client-side only, since it's not in the database structure)
        if (filterSubject !== 'all') {
            filtered = filtered.filter(e => e.subject_name === filterSubject);
        }

        return filtered;
    }, [zeroScores, filterSubject]);

    const uniqueTeachers = useMemo(() => {
        return allTeachers;
    }, [allTeachers]);

    const uniqueSubjects = useMemo(() => {
        return allSubjects;
    }, [allSubjects]);

    const uniqueTerms = useMemo(() => {
        return allTerms;
    }, [allTerms]);

    const stats = useMemo(() => {
        // Stats now reflect the total counts from the server, not filtered entries
        const total = totalCount;
        // We can't calculate reviewed/unreviewed here since we only have the current page
        // These would need separate queries if needed
        return { total, reviewed: 0, unreviewed: 0 };
    }, [totalCount]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="mb-6">
                <button
                    onClick={onBack}
                    className="text-blue-600 dark:text-blue-400 hover:underline mb-4"
                >
                    ← Back
                </button>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Zero Score Monitor</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2">
                    Track and review instances where zero scores were entered by teachers
                </p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Zero Scores</h3>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{stats.total}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Unreviewed</h3>
                    <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">{stats.unreviewed}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Reviewed</h3>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{stats.reviewed}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <SettingsIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Filters</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                            Teacher
                        </label>
                        <select
                            value={filterTeacher}
                            onChange={(e) => setFilterTeacher(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        >
                            <option value="all">All Teachers</option>
                            {uniqueTeachers.map(teacher => (
                                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
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
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Term
                        </label>
                        <select
                            value={filterTerm}
                            onChange={(e) => setFilterTerm(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        >
                            <option value="all">All Terms</option>
                            {uniqueTerms.map(term => (
                                <option key={term.id} value={term.id}>{term.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Date From
                        </label>
                        <input
                            type="date"
                            value={filterDateFrom}
                            onChange={(e) => setFilterDateFrom(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Date To
                        </label>
                        <input
                            type="date"
                            value={filterDateTo}
                            onChange={(e) => setFilterDateTo(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* Entries List */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
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
                                    Component
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Teacher
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                        No zero score entries found
                                    </td>
                                </tr>
                            ) : (
                                filteredEntries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
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
                                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                                            {entry.component_name || 'Total'}
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
                                        <td className="px-4 py-3 text-sm">
                                            <button
                                                onClick={() => {
                                                    setSelectedEntry(entry);
                                                    setReviewNotes(entry.review_notes || '');
                                                }}
                                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                {entry.reviewed ? 'View' : 'Review'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        Showing {totalCount === 0 ? 0 : ((page - 1) * PAGE_SIZE) + 1} - {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} entries
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1 text-slate-700 dark:text-slate-300">
                            Page {page} of {Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
                        </span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={page * PAGE_SIZE >= totalCount}
                            className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Review Modal */}
            {selectedEntry && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                                Zero Score Entry Details
                            </h2>
                            
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Student</label>
                                    <p className="text-slate-900 dark:text-white">{selectedEntry.student?.name}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Subject</label>
                                        <p className="text-slate-900 dark:text-white">{selectedEntry.subject_name}</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Component</label>
                                        <p className="text-slate-900 dark:text-white">{selectedEntry.component_name || 'Total Score'}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Class</label>
                                        <p className="text-slate-900 dark:text-white">{selectedEntry.academic_class?.name}</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Term</label>
                                        <p className="text-slate-900 dark:text-white">{selectedEntry.term?.name}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Teacher</label>
                                        <p className="text-slate-900 dark:text-white">{selectedEntry.teacher?.name}</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Entry Date</label>
                                        <p className="text-slate-900 dark:text-white">
                                            {new Date(selectedEntry.entry_date).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                {selectedEntry.teacher_comment && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Teacher Comment</label>
                                        <p className="text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 p-3 rounded">
                                            {selectedEntry.teacher_comment}
                                        </p>
                                    </div>
                                )}
                                
                                {!selectedEntry.reviewed && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Review Notes
                                        </label>
                                        <textarea
                                            value={reviewNotes}
                                            onChange={(e) => setReviewNotes(e.target.value)}
                                            rows={4}
                                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                            placeholder="Enter your review notes (optional)..."
                                        />
                                    </div>
                                )}
                                
                                {selectedEntry.reviewed && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Review Notes</label>
                                        <p className="text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 p-3 rounded">
                                            {selectedEntry.review_notes || 'No notes provided'}
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                            Reviewed on {selectedEntry.reviewed_at ? new Date(selectedEntry.reviewed_at).toLocaleString() : 'Unknown'}
                                        </p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setSelectedEntry(null);
                                        setReviewNotes('');
                                    }}
                                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                                    disabled={isReviewing}
                                >
                                    Close
                                </button>
                                {!selectedEntry.reviewed ? (
                                    <button
                                        onClick={() => handleMarkReviewed(selectedEntry, true)}
                                        disabled={isReviewing}
                                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isReviewing ? 'Marking...' : 'Mark as Reviewed'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleMarkReviewed(selectedEntry, false)}
                                        disabled={isReviewing}
                                        className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isReviewing ? 'Removing...' : 'Remove Review'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZeroScoreMonitorView;
