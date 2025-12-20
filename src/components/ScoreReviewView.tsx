
import React, { useState, useMemo, useEffect } from 'react';
import type { 
    ScoreEntry, 
    Student, 
    AcademicTeachingAssignment, 
    UserProfile, 
    GradingScheme,
    AcademicClassStudent,
    AcademicClass 
} from '../types';
import Spinner from './common/Spinner';
import { SearchIcon, FilterIcon, EditIcon, CheckCircleIcon, XCircleIcon, UserCircleIcon } from './common/icons';
import { usePersistedState, getUserPersistedKey } from '../hooks/usePersistedState';
import { getCurrentUserId } from '../utils/userHelpers';

const PAGE_SIZE = 50;

interface ScoreReviewViewProps {
    scoreEntries: ScoreEntry[];
    students: Student[];
    academicAssignments: AcademicTeachingAssignment[];
    academicClassStudents: AcademicClassStudent[];
    users: UserProfile[];
    terms: any[];
    gradingSchemes: GradingScheme[];
    userPermissions: string[];
    currentUserId: string;
    onUpdateScore: (scoreId: number, updates: Partial<ScoreEntry>) => Promise<boolean>;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    academicClasses?: AcademicClass[]; // Optional - for when passed from AppRouter
}

const ScoreReviewView: React.FC<ScoreReviewViewProps> = ({ 
    scoreEntries, 
    students, 
    academicAssignments, 
    academicClassStudents,
    users, 
    terms,
    gradingSchemes,
    userPermissions, 
    currentUserId,
    onUpdateScore,
    addToast,
    academicClasses 
}) => {
    // Add null safety with default empty arrays
    const safeScoreEntries = scoreEntries || [];
    const safeStudents = students || [];
    const safeAcademicAssignments = academicAssignments || [];
    const safeAcademicClassStudents = academicClassStudents || [];
    const safeUsers = users || [];
    const safeTerms = terms || [];
    const safeGradingSchemes = gradingSchemes || [];
    const safeUserPermissions = userPermissions || [];

    // Persistent filters with user-specific keys
    const userId = getCurrentUserId();
    const [selectedTermId, setSelectedTermId] = usePersistedState<number | ''>(
        getUserPersistedKey(userId, 'score_review_term'),
        ''
    );
    const [selectedClassId, setSelectedClassId] = usePersistedState<number | ''>(
        getUserPersistedKey(userId, 'score_review_class'),
        ''
    );
    const [selectedSubject, setSelectedSubject] = usePersistedState<string>(
        getUserPersistedKey(userId, 'score_review_subject'),
        ''
    );
    const [selectedTeacherId, setSelectedTeacherId] = usePersistedState<string>(
        getUserPersistedKey(userId, 'score_review_teacher'),
        ''
    );
    
    const [searchQuery, setSearchQuery] = useState('');
    const [editingScoreId, setEditingScoreId] = useState<number | null>(null);
    const [editingValues, setEditingValues] = useState<Record<string, any>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);

    const canEdit = safeUserPermissions.includes('score_entries.edit_all') || safeUserPermissions.includes('*');
    const canView = canEdit || safeUserPermissions.includes('score_entries.view_all');

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedTermId, selectedClassId, selectedSubject, selectedTeacherId, searchQuery]);

    // Parse navigation context filters from sessionStorage
    useEffect(() => {
        try {
            const filtersJson = sessionStorage.getItem('scoreReviewFilters');
            if (!filtersJson) return;
            
            const filters = JSON.parse(filtersJson);
            
            // Validate the parsed object structure
            if (!filters || typeof filters !== 'object') {
                console.warn('Invalid score review filters structure');
                return;
            }
            
            // Only use filters if they're recent (within last 5 seconds)
            const timestamp = filters.timestamp;
            if (typeof timestamp !== 'number' || isNaN(timestamp)) {
                console.warn('Invalid or missing timestamp in filters');
                return;
            }
            
            const age = Date.now() - timestamp;
            if (age < 0 || age >= 5000) {
                // Filters are stale or timestamp is in the future (possible tampering)
                return;
            }
            
            // Validate and apply termId
            if (filters.termId !== undefined) {
                const termId = Number(filters.termId);
                if (!isNaN(termId) && termId > 0 && Number.isInteger(termId)) {
                    setSelectedTermId(termId);
                }
            }
            
            // Validate and apply classId
            if (filters.classId !== undefined) {
                const classId = Number(filters.classId);
                if (!isNaN(classId) && classId > 0 && Number.isInteger(classId)) {
                    setSelectedClassId(classId);
                }
            }
            
            // Validate and apply subject
            if (filters.subject !== undefined) {
                const subject = String(filters.subject).trim();
                if (subject && subject.length > 0 && subject.length < 200) {
                    setSelectedSubject(subject);
                }
            }
        } catch (error) {
            console.error('Error parsing score review filters:', error);
        } finally {
            // Always clear the filters from sessionStorage after attempting to use them
            sessionStorage.removeItem('scoreReviewFilters');
        }
    }, []);

    // Get unique classes from assignments, academicClasses, and score entries
    const uniqueClasses = useMemo(() => {
        const classMap = new Map();
        
        // Add classes from assignments
        safeAcademicAssignments.forEach(a => {
            if (a.academic_class) {
                classMap.set(a.academic_class_id, a.academic_class);
            }
        });
        
        // Add classes from academicClasses prop if available
        if (academicClasses) {
            academicClasses.forEach(ac => {
                if (ac && ac.id) {
                    classMap.set(ac.id, ac);
                }
            });
        }
        
        // Add any classes referenced in score entries that we don't have yet
        // This ensures we can display all scores even if assignment data is incomplete
        safeScoreEntries.forEach(se => {
            if (se.academic_class_id && !classMap.has(se.academic_class_id)) {
                // Create a minimal class object from score entry data
                // The academic_class might be embedded in the score entry
                if (se.academic_class) {
                    classMap.set(se.academic_class_id, se.academic_class);
                }
            }
        });
        
        return Array.from(classMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [safeAcademicAssignments, academicClasses, safeScoreEntries]);

    // Get unique subjects
    const uniqueSubjects = useMemo(() => {
        const subjects = new Set<string>();
        safeAcademicAssignments.forEach(a => {
            if (a.subject_name) subjects.add(a.subject_name);
        });
        return Array.from(subjects).sort();
    }, [safeAcademicAssignments]);

    // Get teachers who have entered scores
    const teachersWithScores = useMemo(() => {
        const teacherIds = new Set<string>();
        safeScoreEntries.forEach(se => {
            if (se.entered_by_user_id) teacherIds.add(se.entered_by_user_id);
        });
        return safeUsers.filter(u => teacherIds.has(u.id)).sort((a, b) => a.name.localeCompare(b.name));
    }, [safeScoreEntries, safeUsers]);

    // Enrich score entries with teacher info and student info
    const enrichedScores = useMemo(() => {
        return safeScoreEntries.map(se => {
            const student = safeStudents.find(s => s.id === se.student_id);
            const enteredBy = safeUsers.find(u => u.id === se.entered_by_user_id);
            const lastModifiedBy = safeUsers.find(u => u.id === se.last_modified_by_user_id);
            const academicClass = uniqueClasses.find(c => c.id === se.academic_class_id);
            
            return {
                ...se,
                student,
                entered_by: enteredBy,
                last_modified_by: lastModifiedBy,
                academic_class: academicClass
            };
        });
    }, [safeScoreEntries, safeStudents, safeUsers, uniqueClasses]);

    // Filter scores based on selections
    const filteredScores = useMemo(() => {
        let filtered = enrichedScores;

        if (selectedTermId) {
            filtered = filtered.filter(s => s.term_id === selectedTermId);
        }

        if (selectedClassId) {
            filtered = filtered.filter(s => s.academic_class_id === selectedClassId);
        }

        if (selectedSubject) {
            filtered = filtered.filter(s => s.subject_name === selectedSubject);
        }

        if (selectedTeacherId) {
            filtered = filtered.filter(s => s.entered_by_user_id === selectedTeacherId);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(s => 
                s.student?.name.toLowerCase().includes(query) ||
                s.subject_name?.toLowerCase().includes(query) ||
                s.entered_by?.name.toLowerCase().includes(query)
            );
        }

        return filtered.sort((a, b) => {
            // Sort by class, then subject, then student name
            if (a.academic_class?.name !== b.academic_class?.name) {
                return (a.academic_class?.name || '').localeCompare(b.academic_class?.name || '');
            }
            if (a.subject_name !== b.subject_name) {
                return a.subject_name.localeCompare(b.subject_name);
            }
            return (a.student?.name || '').localeCompare(b.student?.name || '');
        });
    }, [enrichedScores, selectedTermId, selectedClassId, selectedSubject, selectedTeacherId, searchQuery]);

    // Paginate the filtered scores
    const paginatedScores = useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const endIndex = startIndex + PAGE_SIZE;
        return filteredScores.slice(startIndex, endIndex);
    }, [filteredScores, currentPage]);

    const totalPages = useMemo(() => 
        Math.ceil(filteredScores.length / PAGE_SIZE),
        [filteredScores.length]
    );

    // Calculate pagination display range
    const paginationRange = useMemo(() => {
        const start = filteredScores.length > 0 ? ((currentPage - 1) * PAGE_SIZE) + 1 : 0;
        const end = Math.min(currentPage * PAGE_SIZE, filteredScores.length);
        return { start, end };
    }, [filteredScores.length, currentPage]);

    const handleStartEdit = (score: any) => {
        setEditingScoreId(score.id);
        setEditingValues({
            component_scores: { ...score.component_scores },
            remark: score.remark || '' // Changed from teacher_comment to remark
        });
    };

    const handleCancelEdit = () => {
        setEditingScoreId(null);
        setEditingValues({});
    };

    const handleSaveEdit = async (scoreId: number) => {
        if (!canEdit) return;

        setIsSaving(true);
        try {
            // Calculate total score from components
            const componentScores = editingValues.component_scores || {};
            const totalScore = Object.values(componentScores).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);

            // Determine grade based on grading scheme
            // For now, we'll keep the existing grade or set it to null to be recalculated
            const updates: Partial<ScoreEntry> = {
                component_scores: componentScores,
                total_score: totalScore,
                remark: editingValues.remark, // Changed from teacher_comment to remark
                last_modified_by_user_id: currentUserId
            };

            const success = await onUpdateScore(scoreId, updates);
            if (success) {
                addToast('Score updated successfully', 'success');
                setEditingScoreId(null);
                setEditingValues({});
            } else {
                addToast('Failed to update score', 'error');
            }
        } catch (error: any) {
            addToast(`Error: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleComponentScoreChange = (componentName: string, value: string) => {
        // Don't convert empty string to 0 - keep it empty/undefined
        const numValue = value === '' ? undefined : Number(value);
        
        setEditingValues(prev => {
            const updatedScores = { ...prev.component_scores };
            
            if (numValue === undefined) {
                // Remove the component if value is empty
                delete updatedScores[componentName];
            } else {
                updatedScores[componentName] = numValue;
            }
            
            return {
                ...prev,
                component_scores: updatedScores
            };
        });
    };

    if (!canView) {
        return (
            <div className="p-6">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-800 dark:text-red-200">
                        You do not have permission to view this page. Contact your administrator.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Score Review</h1>
                <p className="text-slate-600 dark:text-slate-400">
                    View and edit all teacher-entered scores. All changes are logged for accountability.
                </p>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <FilterIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Filters</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {/* Term Filter */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Term
                        </label>
                        <select
                            value={selectedTermId}
                            onChange={(e) => setSelectedTermId(e.target.value ? Number(e.target.value) : '')}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                            <option value="">All Terms</option>
                            {safeTerms.map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.session_label} - {t.term_label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Class Filter */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Class
                        </label>
                        <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : '')}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                            <option value="">All Classes</option>
                            {uniqueClasses.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Subject Filter */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Subject
                        </label>
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                            <option value="">All Subjects</option>
                            {uniqueSubjects.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Teacher Filter */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Entered By
                        </label>
                        <select
                            value={selectedTeacherId}
                            onChange={(e) => setSelectedTeacherId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                            <option value="">All Teachers</option>
                            {teachersWithScores.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by student name, subject, or teacher..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                </div>
            </div>

            {/* Results Summary */}
            <div className="mb-4 flex items-center justify-between gap-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                    Showing <span className="font-semibold text-blue-700 dark:text-blue-300">
                        {paginationRange.start} - {paginationRange.end}
                    </span> of <span className="font-semibold text-blue-700 dark:text-blue-300">{filteredScores.length}</span> score {filteredScores.length === 1 ? 'entry' : 'entries'}
                    {filteredScores.length !== safeScoreEntries.length && (
                        <span className="ml-2 text-xs">
                            (Total in system: <span className="font-semibold">{safeScoreEntries.length}</span>)
                        </span>
                    )}
                </div>
                {(selectedTermId || selectedClassId || selectedSubject || selectedTeacherId || searchQuery) && (
                    <button
                        onClick={() => {
                            setSelectedTermId('');
                            setSelectedClassId('');
                            setSelectedSubject('');
                            setSelectedTeacherId('');
                            setSearchQuery('');
                        }}
                        className="text-xs px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
                    >
                        Clear All Filters
                    </button>
                )}
            </div>

            {/* Scores Table */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Student
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Class
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Subject
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Scores
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Total
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Grade
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Entered By
                                </th>
                                {canEdit && (
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredScores.length === 0 ? (
                                <tr>
                                    <td colSpan={canEdit ? 8 : 7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                        No scores found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                paginatedScores.map((score) => {
                                    const isEditing = editingScoreId === score.id;
                                    
                                    return (
                                        <tr key={score.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                            <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                                                {score.student?.name || 'Unknown Student'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                                {score.academic_class?.name || 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                                {score.subject_name}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {isEditing ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(score.component_scores || {}).map(([comp, val]) => (
                                                            <div key={comp} className="flex items-center gap-1">
                                                                <label className="text-xs text-slate-600 dark:text-slate-400">
                                                                    {comp}:
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    value={editingValues.component_scores?.[comp] || 0}
                                                                    onChange={(e) => handleComponentScoreChange(comp, e.target.value)}
                                                                    className="w-16 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900"
                                                                    min="0"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(score.component_scores || {}).map(([comp, val]) => (
                                                            <span key={comp} className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
                                                                {comp}: {val}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                                                {isEditing ? (
                                                    Object.values(editingValues.component_scores || {}).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0)
                                                ) : (
                                                    score.total_score || 0
                                                )}
                                            </td>
                                             <td className="px-4 py-3 text-sm">
                                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded font-medium">
                                                    {score.grade_label || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <UserCircleIcon className="w-4 h-4 text-slate-400" />
                                                    <div>
                                                        <div className="text-slate-900 dark:text-white">
                                                            {score.entered_by?.name || 'Unknown'}
                                                        </div>
                                                        {score.last_modified_by && score.last_modified_by_user_id !== score.entered_by_user_id && (
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                Modified by: {score.last_modified_by.name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            {canEdit && (
                                                <td className="px-4 py-3 text-sm">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleSaveEdit(score.id)}
                                                                disabled={isSaving}
                                                                className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                                                                title="Save"
                                                            >
                                                                {isSaving ? (
                                                                    <Spinner size="sm" />
                                                                ) : (
                                                                    <CheckCircleIcon className="w-5 h-5" />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={handleCancelEdit}
                                                                disabled={isSaving}
                                                                className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                                                                title="Cancel"
                                                            >
                                                                <XCircleIcon className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleStartEdit(score)}
                                                            className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                                            title="Edit"
                                                        >
                                                            <EditIcon className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredScores.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            Showing {paginationRange.start} - {paginationRange.end} of {filteredScores.length} entries
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                First
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="px-3 py-1 text-sm text-slate-700 dark:text-slate-300">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Last
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScoreReviewView;
