import React, { useState, useMemo, useEffect } from 'react';
import type {
    Term,
    AcademicClass,
    LevelRankingResult,
    LevelStatisticsResult,
    ArmRankingResult,
    SubjectAnalytics,
    GradingScheme
} from '../types';
import { requireSupabaseClient } from '../services/supabaseClient';
import Spinner from './common/Spinner';
import StatisticsCard from './StatisticsCard';
import GradeDistributionChart from './GradeDistributionChart';
import ArmComparisonChart from './ArmComparisonChart';
import EnhancedRankingTable from './EnhancedRankingTable';
import SubjectAnalyticsPanel from './SubjectAnalyticsPanel';
import { DownloadIcon } from './common/icons';

interface EnhancedStatisticsDashboardProps {
    termId: number;
    academicClasses: AcademicClass[];
    schoolId: number;
    gradingScheme: GradingScheme | null;
}

type ViewMode = 'per-level' | 'per-arm';

const EnhancedStatisticsDashboard: React.FC<EnhancedStatisticsDashboardProps> = ({
    termId,
    academicClasses,
    schoolId,
    gradingScheme
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>('per-level');
    const [selectedLevel, setSelectedLevel] = useState<string>('');
    const [selectedArmId, setSelectedArmId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Data from RPC calls
    const [levelStats, setLevelStats] = useState<LevelStatisticsResult | null>(null);
    const [levelRankings, setLevelRankings] = useState<LevelRankingResult[]>([]);
    const [armRankings, setArmRankings] = useState<ArmRankingResult[]>([]);

    // Extract unique grade levels from academic classes
    const gradeLevels = useMemo(() => {
        const levels = new Set<string>();
        academicClasses.forEach(ac => {
            if (ac.level) {
                levels.add(ac.level);
            }
        });
        return Array.from(levels).sort();
    }, [academicClasses]);

    // Get classes for selected level
    const classesForLevel = useMemo(() => {
        if (!selectedLevel) return [];
        return academicClasses.filter(ac => ac.level === selectedLevel && ac.is_active);
    }, [selectedLevel, academicClasses]);

    // Set default level on mount
    useEffect(() => {
        if (gradeLevels.length > 0 && !selectedLevel) {
            setSelectedLevel(gradeLevels[0]);
        }
    }, [gradeLevels]);

    // Fetch statistics when level changes
    useEffect(() => {
        if (!selectedLevel || !termId) return;
        
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            
            try {
                // Get the first class to extract session_label if available
                const firstClass = classesForLevel[0];
                const sessionLabel = firstClass?.session_label || null;
                
                // Fetch level statistics
                const { data: statsData, error: statsError } = await supabase
                    .rpc('get_level_statistics', {
                        p_school_id: schoolId,
                        p_term_id: termId,
                        p_level: selectedLevel,
                        p_session_label: sessionLabel,
                        p_campus_id: null
                    });
                
                if (statsError) throw statsError;
                setLevelStats(statsData?.[0] || null);
                
                // Fetch level rankings
                const { data: rankingsData, error: rankingsError } = await supabase
                    .rpc('calculate_level_rankings', {
                        p_school_id: schoolId,
                        p_term_id: termId,
                        p_level: selectedLevel,
                        p_session_label: sessionLabel,
                        p_campus_id: null
                    });
                
                if (rankingsError) throw rankingsError;
                setLevelRankings(rankingsData || []);
                
            } catch (err: any) {
                console.error('Error fetching statistics:', err);
                setError(err.message || 'Failed to load statistics');
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [selectedLevel, termId, schoolId, classesForLevel]);

    // Fetch arm rankings when arm is selected
    useEffect(() => {
        if (viewMode !== 'per-arm' || !selectedArmId || !termId) {
            setArmRankings([]);
            return;
        }
        
        const fetchArmRankings = async () => {
            setLoading(true);
            setError(null);
            
            try {
                const { data, error } = await supabase
                    .rpc('calculate_arm_rankings', {
                        p_school_id: schoolId,
                        p_term_id: termId,
                        p_academic_class_id: selectedArmId
                    });
                
                if (error) throw error;
                setArmRankings(data || []);
            } catch (err: any) {
                console.error('Error fetching arm rankings:', err);
                setError(err.message || 'Failed to load arm rankings');
            } finally {
                setLoading(false);
            }
        };
        
        fetchArmRankings();
    }, [viewMode, selectedArmId, termId, schoolId]);

    // Convert arm rankings to level ranking format for display
    const displayRankings = useMemo(() => {
        if (viewMode === 'per-arm' && armRankings.length > 0) {
            const selectedArm = classesForLevel.find(c => c.id === selectedArmId);
            return armRankings.map(ar => ({
                student_id: ar.student_id,
                name: ar.name,
                admission_number: ar.admission_number || undefined,
                arm: selectedArm?.arm || '',
                total_score: 0, // Not provided in arm rankings
                average_score: ar.average_score,
                subjects_count: Object.keys(ar.subject_scores || {}).length,
                level_rank: ar.arm_rank,
                level_percentile: ar.arm_percentile,
                is_ranked: true,
                rank_reason: null,
                grade_counts: {}
            } as LevelRankingResult));
        }
        return levelRankings;
    }, [viewMode, levelRankings, armRankings, selectedArmId, classesForLevel]);

    // Convert subject analytics from RPC format
    const subjectAnalytics: SubjectAnalytics[] = useMemo(() => {
        if (!levelStats?.subject_analytics) return [];
        return levelStats.subject_analytics;
    }, [levelStats]);

    // Convert grade distribution for chart
    const gradeDistribution = useMemo(() => {
        if (!levelStats?.grade_distribution) return [];
        return levelStats.grade_distribution.map(gd => ({
            grade_label: gd.grade,
            count: gd.count,
            percentage: gd.percentage
        }));
    }, [levelStats]);

    // Convert arm comparison for chart
    const armComparison = useMemo(() => {
        if (!levelStats?.arm_comparison) return [];
        return levelStats.arm_comparison.map(ac => ({
            arm_name: ac.arm,
            academic_class_id: 0, // Not provided in RPC
            student_count: ac.student_count,
            average_score: ac.average,
            highest_score: null,
            lowest_score: 0,
            pass_count: 0,
            pass_rate: ac.pass_rate,
            grade_distribution: []
        }));
    }, [levelStats]);

    if (gradeLevels.length === 0) {
        return (
            <div className="text-center p-10 rounded-xl border bg-white/60 dark:bg-slate-900/40">
                <p className="text-slate-500 dark:text-slate-400">
                    No academic classes found for this term.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="p-4 rounded-xl border bg-white/60 dark:bg-slate-900/40 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Select Grade Level
                    </label>
                    <select
                        value={selectedLevel}
                        onChange={e => {
                            setSelectedLevel(e.target.value);
                            setSelectedArmId(null);
                        }}
                        className="w-full p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                        <option value="">-- Select Level --</option>
                        {gradeLevels.map(level => (
                            <option key={level} value={level}>{level}</option>
                        ))}
                    </select>
                </div>

                {selectedLevel && (
                    <>
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                View Mode
                            </label>
                            <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-1">
                                <button
                                    onClick={() => {
                                        setViewMode('per-level');
                                        setSelectedArmId(null);
                                    }}
                                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${
                                        viewMode === 'per-level' 
                                            ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' 
                                            : 'text-slate-600 dark:text-slate-400'
                                    }`}
                                >
                                    Per Level
                                </button>
                                <button
                                    onClick={() => setViewMode('per-arm')}
                                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${
                                        viewMode === 'per-arm' 
                                            ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' 
                                            : 'text-slate-600 dark:text-slate-400'
                                    }`}
                                >
                                    Per Arm
                                </button>
                            </div>
                        </div>

                        {viewMode === 'per-arm' && (
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Select Arm
                                </label>
                                <select
                                    value={selectedArmId || ''}
                                    onChange={e => setSelectedArmId(e.target.value ? Number(e.target.value) : null)}
                                    className="w-full p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                                >
                                    <option value="">-- Select Arm --</option>
                                    {classesForLevel.map(c => (
                                        <option key={c.id} value={c.id}>{c.arm}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <Spinner />
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <h4 className="text-sm font-semibold text-red-900 dark:text-red-100">Error Loading Statistics</h4>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Statistics */}
            {selectedLevel && !loading && levelStats && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatisticsCard
                            icon="👥"
                            label="Total Enrolled"
                            value={levelStats.total_enrolled.toString()}
                            subtitle={`${levelStats.students_with_scores} with scores`}
                        />
                        <StatisticsCard
                            icon="📊"
                            label="Average Score"
                            value={`${levelStats.mean_score?.toFixed(2) || '0'}%`}
                            subtitle={`Median: ${levelStats.median_score?.toFixed(2) || '0'}%`}
                        />
                        <StatisticsCard
                            icon="✅"
                            label="Pass Rate"
                            value={`${levelStats.pass_rate?.toFixed(1) || '0'}%`}
                            subtitle={`${levelStats.pass_count || 0} students passed`}
                        />
                        <StatisticsCard
                            icon="📈"
                            label="Score Range"
                            value={`${levelStats.min_score?.toFixed(1) || '0'} - ${levelStats.max_score?.toFixed(1) || '0'}`}
                            subtitle={`Std Dev: ${levelStats.std_dev?.toFixed(2) || '0'}`}
                        />
                    </div>

                    {/* Insights Panel */}
                    {(levelStats.hardest_subject || levelStats.easiest_subject || levelStats.highest_fail_rate_subject) && (
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <span>💡</span>
                                Key Insights
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {levelStats.hardest_subject && (
                                    <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
                                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                            Most Challenging
                                        </div>
                                        <div className="text-base font-semibold text-red-600 dark:text-red-400">
                                            {levelStats.hardest_subject}
                                        </div>
                                    </div>
                                )}
                                {levelStats.easiest_subject && (
                                    <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
                                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                            Best Performance
                                        </div>
                                        <div className="text-base font-semibold text-green-600 dark:text-green-400">
                                            {levelStats.easiest_subject}
                                        </div>
                                    </div>
                                )}
                                {levelStats.highest_fail_rate_subject && (
                                    <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
                                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                            Highest Fail Rate
                                        </div>
                                        <div className="text-base font-semibold text-amber-600 dark:text-amber-400">
                                            {levelStats.highest_fail_rate_subject}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <GradeDistributionChart 
                            data={gradeDistribution}
                            title={`Grade Distribution - ${selectedLevel}`}
                        />
                        {viewMode === 'per-level' && armComparison.length > 1 && (
                            <ArmComparisonChart 
                                arms={armComparison}
                                title={`${selectedLevel} - Arm Comparison`}
                            />
                        )}
                    </div>

                    {/* Subject Analytics */}
                    {subjectAnalytics.length > 0 && (
                        <SubjectAnalyticsPanel 
                            subjectAnalytics={subjectAnalytics}
                            title={`Subject Performance - ${selectedLevel}`}
                        />
                    )}

                    {/* Rankings Table */}
                    {displayRankings.length > 0 && (
                        <EnhancedRankingTable
                            rankings={displayRankings}
                            title={`${viewMode === 'per-level' ? `${selectedLevel} Level` : classesForLevel.find(c => c.id === selectedArmId)?.arm || 'Arm'} - Student Rankings`}
                            showArmColumn={viewMode === 'per-level'}
                        />
                    )}

                    {/* Top/Bottom Students */}
                    {(levelStats.top_10_students?.length > 0 || levelStats.bottom_10_students?.length > 0) && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Top 10 */}
                            {levelStats.top_10_students?.length > 0 && (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span>🏆</span>
                                        Top 10 Students
                                    </h3>
                                    <div className="space-y-2">
                                        {levelStats.top_10_students.map((student, idx) => (
                                            <div key={student.student_id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-semibold text-slate-500 dark:text-slate-400 text-sm w-6">
                                                        {idx + 1}.
                                                    </span>
                                                    <span className="font-medium text-slate-900 dark:text-white">
                                                        {student.name}
                                                    </span>
                                                </div>
                                                <span className="font-semibold text-green-600 dark:text-green-400">
                                                    {student.average.toFixed(2)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Bottom 10 */}
                            {levelStats.bottom_10_students?.length > 0 && (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span>📉</span>
                                        Students Needing Support
                                    </h3>
                                    <div className="space-y-2">
                                        {levelStats.bottom_10_students.map((student) => (
                                            <div key={student.student_id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                                <span className="font-medium text-slate-900 dark:text-white">
                                                    {student.name}
                                                </span>
                                                <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                    {student.average.toFixed(2)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {selectedLevel && !loading && viewMode === 'per-arm' && !selectedArmId && (
                <div className="text-center p-10 rounded-xl border bg-white/60 dark:bg-slate-900/40">
                    <p className="text-slate-500 dark:text-slate-400">
                        Please select an arm to view statistics
                    </p>
                </div>
            )}
        </div>
    );
};

export default EnhancedStatisticsDashboard;
