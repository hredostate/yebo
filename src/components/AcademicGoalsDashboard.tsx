import React, { useState, useEffect, useMemo } from 'react';
import type { AcademicClass, Student, AcademicClassStudent, StudentAcademicGoal } from '../types';
import { requireSupabaseClient } from '../services/supabaseClient';
import Spinner from './common/Spinner';
import { 
    CheckCircleIcon, 
    StarIcon, 
    SearchIcon, 
    DownloadIcon, 
    EyeIcon, 
    WandIcon,
    FilterIcon,
    UsersIcon
} from './common/icons';

interface AcademicGoalsDashboardProps {
    termId: number;
    academicClasses: AcademicClass[];
    students: Student[];
    academicClassStudents: AcademicClassStudent[];
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface GoalWithAnalysis extends StudentAcademicGoal {
    student_name: string;
    class_name: string;
    goal_analysis_report?: string | null;
    goal_achievement_rating?: 'exceeded' | 'met' | 'partially_met' | 'not_met' | null;
    goal_analysis_generated_at?: string | null;
}

const AcademicGoalsDashboard: React.FC<AcademicGoalsDashboardProps> = ({
    termId,
    academicClasses,
    students,
    academicClassStudents,
    addToast,
}) => {
    const [loading, setLoading] = useState(true);
    const [goals, setGoals] = useState<GoalWithAnalysis[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<number | 'all'>('all');
    const [goalStatusFilter, setGoalStatusFilter] = useState<'all' | 'has-goal' | 'no-goal'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [generatingAnalysis, setGeneratingAnalysis] = useState<Set<number>>(new Set());

    useEffect(() => {
        fetchGoals();
    }, [termId]);

    const fetchGoals = async () => {
        setLoading(true);
        try {
            const supabase = requireSupabaseClient();
            // Get all students for the term with their goals and analysis
            const { data: goalsData, error: goalsError } = await supabase
                .from('student_academic_goals')
                .select('*')
                .eq('term_id', termId);

            if (goalsError) throw goalsError;

            // Get analysis data from student_term_reports
            const { data: reportsData, error: reportsError } = await supabase
                .from('student_term_reports')
                .select('student_id, goal_analysis_report, goal_achievement_rating, goal_analysis_generated_at')
                .eq('term_id', termId)
                .not('academic_goal_id', 'is', null);

            if (reportsError && reportsError.code !== 'PGRST116') {
                console.error('Error fetching reports:', reportsError);
            }

            // Combine goals with student and class info
            const goalsWithInfo: GoalWithAnalysis[] = (goalsData || []).map(goal => {
                const student = students.find(s => s.id === goal.student_id);
                const classStudent = academicClassStudents.find(
                    cs => cs.student_id === goal.student_id && cs.term_id === termId
                );
                const academicClass = classStudent 
                    ? academicClasses.find(ac => ac.id === classStudent.academic_class_id)
                    : null;
                const report = (reportsData || []).find(r => r.student_id === goal.student_id);

                return {
                    ...goal,
                    student_name: student?.name || 'Unknown',
                    class_name: academicClass?.name || 'Unknown',
                    goal_analysis_report: report?.goal_analysis_report || null,
                    goal_achievement_rating: report?.goal_achievement_rating || null,
                    goal_analysis_generated_at: report?.goal_analysis_generated_at || null,
                };
            });

            setGoals(goalsWithInfo);
        } catch (error: any) {
            addToast(`Error loading goals: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Get students in selected class for the term
    const studentsInClass = useMemo(() => {
        if (selectedClassId === 'all') {
            return academicClassStudents
                .filter(acs => acs.term_id === termId)
                .map(acs => {
                    const student = students.find(s => s.id === acs.student_id);
                    const academicClass = academicClasses.find(ac => ac.id === acs.academic_class_id);
                    return {
                        studentId: acs.student_id,
                        studentName: student?.name || 'Unknown',
                        className: academicClass?.name || 'Unknown',
                    };
                });
        }
        return academicClassStudents
            .filter(acs => acs.term_id === termId && acs.academic_class_id === selectedClassId)
            .map(acs => {
                const student = students.find(s => s.id === acs.student_id);
                const academicClass = academicClasses.find(ac => ac.id === acs.academic_class_id);
                return {
                    studentId: acs.student_id,
                    studentName: student?.name || 'Unknown',
                    className: academicClass?.name || 'Unknown',
                };
            });
    }, [selectedClassId, termId, academicClassStudents, students, academicClasses]);

    // Filter goals based on selected filters
    const filteredGoals = useMemo(() => {
        let filtered = goals;

        // Filter by class
        if (selectedClassId !== 'all') {
            filtered = filtered.filter(goal => {
                const classStudent = academicClassStudents.find(
                    cs => cs.student_id === goal.student_id && cs.term_id === termId
                );
                return classStudent?.academic_class_id === selectedClassId;
            });
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(goal =>
                goal.student_name.toLowerCase().includes(query) ||
                goal.goal_text.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [goals, selectedClassId, searchQuery, academicClassStudents, termId]);

    // Calculate statistics
    const statistics = useMemo(() => {
        const totalStudents = studentsInClass.length;
        const goalsSet = new Set(filteredGoals.map(g => g.student_id)).size;
        const analysisGenerated = filteredGoals.filter(g => g.goal_analysis_report).length;

        const achievementCounts = {
            exceeded: filteredGoals.filter(g => g.goal_achievement_rating === 'exceeded').length,
            met: filteredGoals.filter(g => g.goal_achievement_rating === 'met').length,
            partially_met: filteredGoals.filter(g => g.goal_achievement_rating === 'partially_met').length,
            not_met: filteredGoals.filter(g => g.goal_achievement_rating === 'not_met').length,
        };

        return {
            totalStudents,
            goalsSet,
            goalsSetPercentage: totalStudents > 0 ? Math.round((goalsSet / totalStudents) * 100) : 0,
            analysisGenerated,
            achievementCounts,
        };
    }, [studentsInClass, filteredGoals]);

    // Display data based on goal status filter
    const displayData = useMemo(() => {
        if (goalStatusFilter === 'has-goal') {
            return filteredGoals;
        } else if (goalStatusFilter === 'no-goal') {
            // Show students without goals
            const goalsSet = new Set(goals.map(g => g.student_id));
            return studentsInClass
                .filter(sc => !goalsSet.has(sc.studentId))
                .map(sc => ({
                    id: 0,
                    student_id: sc.studentId,
                    term_id: termId,
                    school_id: 0,
                    goal_text: '',
                    student_name: sc.studentName,
                    class_name: sc.className,
                    created_at: '',
                    updated_at: '',
                }));
        }
        // 'all' - combine goals with students without goals
        const studentsWithGoals = new Set(filteredGoals.map(g => g.student_id));
        const studentsWithoutGoals = studentsInClass
            .filter(sc => !studentsWithGoals.has(sc.studentId))
            .map(sc => ({
                id: 0,
                student_id: sc.studentId,
                term_id: termId,
                school_id: 0,
                goal_text: '',
                student_name: sc.studentName,
                class_name: sc.className,
                created_at: '',
                updated_at: '',
            }));
        return [...filteredGoals, ...studentsWithoutGoals];
    }, [goalStatusFilter, filteredGoals, studentsInClass, goals, termId]);

    const handleExportCSV = () => {
        try {
            const headers = [
                'Student Name',
                'Class',
                'Goal Set',
                'Goal Text',
                'Target Average',
                'Target Position',
                'Subject Targets Count',
                'Achievement Rating'
            ];

            const rows = displayData.map(goal => [
                goal.student_name,
                goal.class_name,
                goal.goal_text ? 'Yes' : 'No',
                goal.goal_text || '',
                goal.target_average?.toString() || '',
                goal.target_position?.toString() || '',
                goal.target_subjects ? Object.keys(goal.target_subjects).length.toString() : '0',
                goal.goal_achievement_rating || ''
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `academic-goals-term-${termId}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            addToast('Goals exported to CSV', 'success');
        } catch (error: any) {
            addToast(`Error exporting CSV: ${error.message}`, 'error');
        }
    };

    const handleGenerateAnalysis = async (goalId: number, studentId: number) => {
        setGeneratingAnalysis(prev => new Set(prev).add(goalId));
        try {
            // This would call the goal analysis service
            // For now, we'll just show a toast
            addToast('Goal analysis generation not yet implemented in this view', 'info');
            // In a real implementation, you would call:
            // await generateGoalAnalysis(studentId, termId);
            // await fetchGoals();
        } catch (error: any) {
            addToast(`Error generating analysis: ${error.message}`, 'error');
        } finally {
            setGeneratingAnalysis(prev => {
                const newSet = new Set(prev);
                newSet.delete(goalId);
                return newSet;
            });
        }
    };

    const getAchievementBadge = (rating: string | null | undefined) => {
        if (!rating) return null;

        const badges = {
            exceeded: {
                bg: 'bg-green-100 dark:bg-green-900/30',
                text: 'text-green-800 dark:text-green-200',
                icon: StarIcon,
                label: 'Exceeded'
            },
            met: {
                bg: 'bg-blue-100 dark:bg-blue-900/30',
                text: 'text-blue-800 dark:text-blue-200',
                icon: CheckCircleIcon,
                label: 'Met'
            },
            partially_met: {
                bg: 'bg-amber-100 dark:bg-amber-900/30',
                text: 'text-amber-800 dark:text-amber-200',
                icon: CheckCircleIcon,
                label: 'Partially Met'
            },
            not_met: {
                bg: 'bg-red-100 dark:bg-red-900/30',
                text: 'text-red-800 dark:text-red-200',
                icon: CheckCircleIcon,
                label: 'Not Met'
            }
        };

        const badge = badges[rating as keyof typeof badges];
        if (!badge) return null;

        const Icon = badge.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                <Icon className="w-3 h-3" />
                {badge.label}
            </span>
        );
    };

    const truncateText = (text: string, maxLength: number = 50) => {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Academic Goals Dashboard</h2>
                <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                    <DownloadIcon className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Total Students</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{statistics.totalStudents}</p>
                        </div>
                        <UsersIcon className="w-8 h-8 text-slate-400" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Goals Set</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {statistics.goalsSet}
                                <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
                                    ({statistics.goalsSetPercentage}%)
                                </span>
                            </p>
                        </div>
                        <CheckCircleIcon className="w-8 h-8 text-green-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Analysis Generated</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{statistics.analysisGenerated}</p>
                        </div>
                        <WandIcon className="w-8 h-8 text-purple-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
                    <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Achievement Breakdown</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span className="text-slate-700 dark:text-slate-300">{statistics.achievementCounts.exceeded} Exceeded</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <span className="text-slate-700 dark:text-slate-300">{statistics.achievementCounts.met} Met</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                <span className="text-slate-700 dark:text-slate-300">{statistics.achievementCounts.partially_met} Partial</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                <span className="text-slate-700 dark:text-slate-300">{statistics.achievementCounts.not_met} Not Met</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Class Filter */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Filter by Class
                        </label>
                        <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        >
                            <option value="all">All Classes</option>
                            {academicClasses.map(ac => (
                                <option key={ac.id} value={ac.id}>{ac.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Goal Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Goal Status
                        </label>
                        <select
                            value={goalStatusFilter}
                            onChange={(e) => setGoalStatusFilter(e.target.value as 'all' | 'has-goal' | 'no-goal')}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        >
                            <option value="all">All Students</option>
                            <option value="has-goal">Has Goal</option>
                            <option value="no-goal">No Goal</option>
                        </select>
                    </div>

                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Search Student
                        </label>
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name..."
                                className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Goals Table */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Student Name
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Class
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Goal Set
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Goal Text
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Target Avg
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Target Pos
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Subjects
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Achievement
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {displayData.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                        No students found
                                    </td>
                                </tr>
                            ) : (
                                displayData.map((goal, index) => (
                                    <tr key={goal.id || `no-goal-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                                            {goal.student_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                            {goal.class_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {goal.goal_text ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                                                    Yes
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                                                    No
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                            {goal.goal_text ? (
                                                <span title={goal.goal_text}>
                                                    {truncateText(goal.goal_text)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 dark:text-slate-500">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                            {goal.target_average ? `${goal.target_average}%` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                            {goal.target_position || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                            {goal.target_subjects ? Object.keys(goal.target_subjects).length : 0}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {getAchievementBadge(goal.goal_achievement_rating)}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                {goal.goal_text && (
                                                    <>
                                                        <button
                                                            title="View full goal details"
                                                            className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                                        >
                                                            <EyeIcon className="w-4 h-4" />
                                                        </button>
                                                        {!goal.goal_analysis_report && (
                                                            <button
                                                                onClick={() => handleGenerateAnalysis(goal.id, goal.student_id)}
                                                                disabled={generatingAnalysis.has(goal.id)}
                                                                title="Generate goal analysis"
                                                                className="p-1 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 disabled:opacity-50"
                                                            >
                                                                {generatingAnalysis.has(goal.id) ? (
                                                                    <Spinner size="sm" />
                                                                ) : (
                                                                    <WandIcon className="w-4 h-4" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Summary */}
            <div className="text-sm text-slate-600 dark:text-slate-400">
                Showing {displayData.length} of {studentsInClass.length} students
            </div>
        </div>
    );
};

export default AcademicGoalsDashboard;
