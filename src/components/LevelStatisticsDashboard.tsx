import React, { useState, useMemo } from 'react';
import type {
    StudentTermReport,
    Student,
    AcademicClass,
    AcademicClassStudent,
    LevelStatistics,
    ArmStatistics,
    GradeDistribution,
    StudentRanking,
    GradingScheme,
    ScoreEntry
} from '../types';
import StatisticsCard from './StatisticsCard';
import GradeDistributionChart from './GradeDistributionChart';
import ArmComparisonChart from './ArmComparisonChart';
import StudentRankingTable from './StudentRankingTable';
import { aggregateResultStatistics, findIntegrityIssues, rankCohort, type ResultScope } from '../utils/resultAnalytics';

interface LevelStatisticsDashboardProps {
    termId: number;
    studentTermReports: StudentTermReport[];
    students: Student[];
    academicClasses: AcademicClass[];
    academicClassStudents: AcademicClassStudent[];
    gradingScheme: GradingScheme | null;
    scoreEntries?: ScoreEntry[];
}

type ViewMode = 'per-level' | 'per-arm';

const LevelStatisticsDashboard: React.FC<LevelStatisticsDashboardProps> = ({
    termId,
    studentTermReports,
    students,
    academicClasses,
    academicClassStudents,
    gradingScheme,
    scoreEntries = []
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>('per-level');
    const [selectedLevel, setSelectedLevel] = useState<string>('');
    const [selectedArmId, setSelectedArmId] = useState<number | null>(null);

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

    // Helper function to get grade from score using grading scheme
    const getGradeFromScore = (score: number): string => {
        if (!gradingScheme || !gradingScheme.rules) return 'N/A';
        
        for (const rule of gradingScheme.rules) {
            if (score >= rule.min_score && score <= rule.max_score) {
                return rule.grade_label;
            }
        }
        return 'N/A';
    };

    // Calculate grade distribution
    const calculateGradeDistribution = (scores: number[]): GradeDistribution[] => {
        if (scores.length === 0) return [];
        
        const distribution = new Map<string, number>();
        
        scores.forEach(score => {
            const grade = getGradeFromScore(score);
            distribution.set(grade, (distribution.get(grade) || 0) + 1);
        });

        const total = scores.length;
        const result: GradeDistribution[] = [];
        
        distribution.forEach((count, grade) => {
            result.push({
                grade_label: grade,
                count,
                percentage: (count / total) * 100
            });
        });

        // Sort by grade (A, B, C, D, E, F)
        const gradeOrder = ['A', 'B', 'C', 'D', 'E', 'F'];
        result.sort((a, b) => {
            const aIndex = gradeOrder.indexOf(a.grade_label);
            const bIndex = gradeOrder.indexOf(b.grade_label);
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        });

        return result;
    };

    const buildScopeForClass = (classId?: number | null): ResultScope => {
        const academicClass = academicClasses.find(ac => ac.id === classId);
        const enrolledIds = academicClassStudents
            .filter(acs => (!classId || acs.academic_class_id === classId) && acs.enrolled_term_id === termId)
            .map(acs => acs.student_id);

        const reportStudentIds = studentTermReports
            .filter(r => r.term_id === termId && (!classId || r.academic_class_id === classId))
            .map(r => r.student_id);

        const scoredStudentIds = scoreEntries
            .filter(se => se.term_id === termId && (!classId || se.academic_class_id === classId))
            .map(se => se.student_id);

        const candidateIds = new Set([...enrolledIds, ...reportStudentIds, ...scoredStudentIds]);

        const campusId = students.find(s => candidateIds.has(s.id) && s.campus_id != null)?.campus_id ?? undefined;

        return {
            campusId,
            termId,
            sessionLabel: academicClass?.session_label,
            academicClassId: classId ?? undefined,
            armName: academicClass?.arm
        };
    };

    const filterReportsForScope = (scope: ResultScope) => {
        const inactiveStatuses = new Set(['Withdrawn', 'Graduated', 'Expelled', 'Inactive']);
        return studentTermReports
            .filter(r => r.term_id === scope.termId && (scope.academicClassId == null || r.academic_class_id === scope.academicClassId))
            .filter(r => {
                const student = students.find(s => s.id === r.student_id);
                if (!student || inactiveStatuses.has(student.status || 'Active')) return false;
                if (scope.campusId != null && student.campus_id != null && student.campus_id !== scope.campusId) return false;
                const academicClass = academicClasses.find(c => c.id === r.academic_class_id);
                if (scope.sessionLabel && academicClass?.session_label && academicClass.session_label !== scope.sessionLabel) return false;
                if (scope.armName && academicClass?.arm && academicClass.arm !== scope.armName) return false;
                return true;
            });
    };

    // Calculate arm statistics
    const calculateArmStatistics = (classId: number): ArmStatistics | null => {
        const academicClass = academicClasses.find(ac => ac.id === classId);
        if (!academicClass) return null;

        const scope = buildScopeForClass(classId);
        const reports = filterReportsForScope(scope);
        const stats = aggregateResultStatistics(studentTermReports, academicClassStudents, students, scope, 50, academicClasses);

        if (reports.length === 0) {
            return {
                arm_name: academicClass.arm,
                academic_class_id: classId,
                student_count: 0,
                average_score: 0,
                highest_score: 0,
                lowest_score: 0,
                pass_count: 0,
                pass_rate: 0,
                grade_distribution: []
            };
        }

        const scores = reports.map(r => r.average_score);

        let highestReport = reports[0];
        let lowestReport = reports[0];
        
        reports.forEach(r => {
            if (r.average_score > highestReport.average_score) highestReport = r;
            if (r.average_score < lowestReport.average_score) lowestReport = r;
        });

        const highestStudent = students.find(s => s.id === highestReport.student_id);
        const lowestStudent = students.find(s => s.id === lowestReport.student_id);

        return {
            arm_name: academicClass.arm,
            academic_class_id: classId,
            student_count: stats.enrolled,
            average_score: stats.averageScore,
            highest_score: highestReport.average_score,
            highest_scorer: highestStudent?.name,
            lowest_score: lowestReport.average_score,
            lowest_scorer: lowestStudent?.name,
            pass_count: stats.passCount,
            pass_rate: stats.passRate,
            grade_distribution: calculateGradeDistribution(scores)
        };
    };

    // Calculate level statistics
    const levelStatistics = useMemo((): LevelStatistics | null => {
        if (!selectedLevel) return null;

        const classes = classesForLevel;
        if (classes.length === 0) return null;

        const scopes = classes.map(c => buildScopeForClass(c.id));
        const reports = scopes.flatMap(scope => filterReportsForScope(scope));

        if (reports.length === 0) {
            return {
                level: selectedLevel,
                total_students: 0,
                overall_average: 0,
                highest_score: 0,
                lowest_score: 0,
                pass_count: 0,
                pass_rate: 0,
                grade_distribution: [],
                arms: []
            };
        }

        const scores = reports.map(r => r.average_score);
        const statsList = scopes.map(scope => aggregateResultStatistics(studentTermReports, academicClassStudents, students, scope, 50, academicClasses));
        const passCount = statsList.reduce((acc, curr) => acc + curr.passCount, 0);

        let highestReport = reports[0];
        let lowestReport = reports[0];

        reports.forEach(r => {
            if (r.average_score > highestReport.average_score) highestReport = r;
            if (r.average_score < lowestReport.average_score) lowestReport = r;
        });

        const highestStudent = students.find(s => s.id === highestReport.student_id);
        const lowestStudent = students.find(s => s.id === lowestReport.student_id);

        // Calculate statistics for each arm
        const armStats = classes
            .map(c => calculateArmStatistics(c.id))
            .filter((stat): stat is ArmStatistics => stat !== null);

        return {
            level: selectedLevel,
            total_students: statsList.reduce((sum, stat) => sum + stat.enrolled, 0),
            overall_average: scores.reduce((a, b) => a + b, 0) / scores.length,
            highest_score: highestReport.average_score,
            highest_scorer: highestStudent?.name,
            lowest_score: lowestReport.average_score,
            lowest_scorer: lowestStudent?.name,
            pass_count: passCount,
            pass_rate: reports.length ? (passCount / reports.length) * 100 : 0,
            grade_distribution: calculateGradeDistribution(scores),
            arms: armStats
        };
    }, [selectedLevel, classesForLevel, studentTermReports, students, academicClassStudents, termId, academicClasses]);

    // Calculate rankings
    const rankings = useMemo((): StudentRanking[] => {
        if (!selectedLevel) return [];
        const classIds = viewMode === 'per-arm' && selectedArmId
            ? [selectedArmId]
            : classesForLevel.map(c => c.id);

        const allRankings: StudentRanking[] = [];

        classIds.forEach(classId => {
            const scope = buildScopeForClass(classId);
            const cohortRanks = rankCohort(studentTermReports, scope, students, academicClasses);
            const scopedReports = filterReportsForScope(scope);

            cohortRanks.forEach(rank => {
                const report = scopedReports.find(r => r.student_id === rank.studentId);
                if (!report) return;
                const student = students.find(s => s.id === rank.studentId);
                const academicClass = academicClasses.find(ac => ac.id === (scope.academicClassId ?? report.academic_class_id));

                allRankings.push({
                    rank: rank.rank,
                    student_id: rank.studentId,
                    student_name: student?.name || 'Unknown',
                    admission_number: student?.admission_number,
                    class_name: academicClass?.level || 'Unknown',
                    arm_name: academicClass?.arm || 'Unknown',
                    average_score: report.average_score,
                    total_score: report.total_score,
                    grade_label: getGradeFromScore(report.average_score),
                    position_in_class: rank.rank,
                    position_change: undefined
                });
            });
        });

        return allRankings.sort((a, b) => a.rank - b.rank);
    }, [selectedLevel, viewMode, selectedArmId, classesForLevel, studentTermReports, students, academicClassStudents, academicClasses, termId]);

    const auditIssues = useMemo(() => {
        const classIds = viewMode === 'per-arm' && selectedArmId
            ? [selectedArmId]
            : classesForLevel.map(c => c.id);

        return classIds.flatMap(classId => {
            const scope = buildScopeForClass(classId);
            const scopeLabel = academicClasses.find(ac => ac.id === classId)?.name || `Class ${classId}`;

            return findIntegrityIssues(studentTermReports, academicClassStudents, students, scoreEntries, scope, academicClasses)
                .map(issue => ({ ...issue, scopeLabel }));
        });
    }, [viewMode, selectedArmId, classesForLevel, studentTermReports, academicClassStudents, students, scoreEntries, academicClasses]);

    // Set default level on mount
    React.useEffect(() => {
        if (gradeLevels.length > 0 && !selectedLevel) {
            setSelectedLevel(gradeLevels[0]);
        }
    }, [gradeLevels]);

    if (gradeLevels.length === 0) {
        return (
            <div className="text-center p-10 rounded-xl border bg-white/60">
                <p className="text-slate-500">No academic classes found for this term.</p>
            </div>
        );
    }

    const currentStats = viewMode === 'per-arm' && selectedArmId
        ? calculateArmStatistics(selectedArmId)
        : levelStatistics;

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
                        className="w-full p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
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
                                            ? 'bg-white dark:bg-slate-600 shadow' 
                                            : ''
                                    }`}
                                >
                                    Per Level
                                </button>
                                <button
                                    onClick={() => setViewMode('per-arm')}
                                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${
                                        viewMode === 'per-arm' 
                                            ? 'bg-white dark:bg-slate-600 shadow' 
                                            : ''
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
                                    className="w-full p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
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

            {/* Data Audit */}
            <div className="p-4 rounded-xl border bg-white/60 dark:bg-slate-900/40">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Data Audit</h3>
                    <span className="text-xs text-slate-500">{auditIssues.length} issue{auditIssues.length === 1 ? '' : 's'}</span>
                </div>
                {auditIssues.length === 0 ? (
                    <p className="text-sm text-green-700 dark:text-green-300">No integrity issues detected for this selection.</p>
                ) : (
                    <ul className="list-disc list-inside space-y-1 text-sm text-amber-700 dark:text-amber-300">
                        {auditIssues.map((issue, idx) => (
                            <li key={`${issue.type}-${idx}`}>{issue.scopeLabel}: {issue.message}</li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Statistics */}
            {selectedLevel && currentStats && (
                <>
                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatisticsCard
                            icon="📊"
                            label="Average Score"
                            value={`${(viewMode === 'per-level' ? levelStatistics?.overall_average : currentStats.average_score)?.toFixed(2)}%`}
                            subtitle={`${viewMode === 'per-level' ? levelStatistics?.total_students : currentStats.student_count} students`}
                        />
                        <StatisticsCard
                            icon="🏆"
                            label="Highest Score"
                            value={`${currentStats.highest_score.toFixed(2)}%`}
                            subtitle={currentStats.highest_scorer || 'N/A'}
                        />
                        <StatisticsCard
                            icon="📉"
                            label="Lowest Score"
                            value={`${currentStats.lowest_score.toFixed(2)}%`}
                            subtitle={currentStats.lowest_scorer || 'N/A'}
                        />
                        <StatisticsCard
                            icon="✅"
                            label="Pass Rate"
                            value={`${currentStats.pass_rate.toFixed(1)}%`}
                            subtitle={`${currentStats.pass_count}/${viewMode === 'per-level' ? levelStatistics?.total_students : currentStats.student_count} passed`}
                        />
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <GradeDistributionChart 
                            data={currentStats.grade_distribution}
                            title={`Grade Distribution - ${viewMode === 'per-level' ? selectedLevel : currentStats.arm_name}`}
                        />
                        {viewMode === 'per-level' && levelStatistics && levelStatistics.arms.length > 1 && (
                            <ArmComparisonChart 
                                arms={levelStatistics.arms}
                                title={`${selectedLevel} - Arm Comparison`}
                            />
                        )}
                    </div>

                    {/* Rankings Table */}
                    <StudentRankingTable
                        rankings={rankings}
                        title={`${viewMode === 'per-level' ? `${selectedLevel} Level` : currentStats.arm_name} - Student Rankings`}
                        showArmColumn={viewMode === 'per-level'}
                    />
                </>
            )}

            {selectedLevel && !currentStats && (
                <div className="text-center p-10 rounded-xl border bg-white/60">
                    <p className="text-slate-500">
                        {viewMode === 'per-arm' && !selectedArmId 
                            ? 'Please select an arm to view statistics'
                            : 'No data available for the selected level'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default LevelStatisticsDashboard;
