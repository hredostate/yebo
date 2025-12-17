import type { AcademicClass, AcademicClassStudent, ScoreEntry, Student, StudentTermReport } from '../types.js';

export interface ResultScope {
    campusId?: number | null;
    termId: number;
    sessionLabel?: string;
    academicClassId?: number | null;
    armName?: string | null;
}

export interface CohortRanking {
    studentId: number;
    rank: number;
    total: number;
}

export interface LevelRanking {
    studentId: number;
    rankInArm: number;
    totalInArm: number;
    rankInLevel: number;
    totalInLevel: number;
}

export interface SubjectRanking {
    studentId: number;
    subjectName: string;
    rankInArm: number;
    totalInArm: number;
    rankInLevel: number;
    totalInLevel: number;
    score: number;
}

export interface ResultStatistics {
    enrolled: number;
    withResults: number;
    averageScore: number;
    passCount: number;
    passRate: number;
}

export interface IntegrityIssue {
    type: 'missing-assignment' | 'orphan-result' | 'duplicate-result';
    message: string;
}

const isActiveStudent = (student?: Student | null) => {
    if (!student) return false;
    const inactiveStatuses = new Set(['Withdrawn', 'Graduated', 'Expelled', 'Inactive']);
    return !inactiveStatuses.has(student.status || 'Active');
};

export const denseRank = <T>(items: T[], getScore: (item: T) => number): number[] => {
    const sorted = [...items].sort((a, b) => getScore(b) - getScore(a));
    let lastScore: number | null = null;
    let currentRank = 0;

    return sorted.map((item) => {
        const score = getScore(item);
        if (lastScore === null || score !== lastScore) {
            currentRank = currentRank === 0 ? 1 : currentRank + 1;
            lastScore = score;
        }
        const originalIndex = items.indexOf(item);
        return { originalIndex, rank: currentRank, score } as any;
    }).sort((a, b) => a.originalIndex - b.originalIndex).map(entry => entry.rank);
};

export const rankCohort = (
    reports: StudentTermReport[],
    scope: ResultScope,
    students: Student[],
    classes: AcademicClass[],
): CohortRanking[] => {
    const scopedReports = reports.filter(r => r.term_id === scope.termId &&
        (scope.academicClassId == null || r.academic_class_id === scope.academicClassId));

    const filtered = scopedReports.filter(report => {
        const student = students.find(s => s.id === report.student_id);
        if (!isActiveStudent(student)) return false;
        if (scope.campusId != null && student?.campus_id != null && student.campus_id !== scope.campusId) return false;

        const academicClass = classes.find(c => c.id === report.academic_class_id);
        if (scope.armName && academicClass?.arm && academicClass.arm !== scope.armName) return false;
        if (scope.sessionLabel && academicClass?.session_label && academicClass.session_label !== scope.sessionLabel) return false;
        return true;
    });

    if (filtered.length === 0) return [];

    const ranks = denseRank(filtered, r => r.average_score);
    return filtered.map((report, idx) => ({
        studentId: report.student_id,
        rank: ranks[idx],
        total: filtered.length,
    }));
};

/**
 * Rank students at both arm and level (grade level across all arms)
 * This provides dual ranking: position in class arm AND position in full grade level
 */
export const rankLevel = (
    reports: StudentTermReport[],
    scope: ResultScope,
    students: Student[],
    classes: AcademicClass[],
    level: string, // e.g., "SS1", "JSS2"
): LevelRanking[] => {
    const filterByScope = (report: StudentTermReport, includeArmFilter: boolean) => {
        const student = students.find(s => s.id === report.student_id);
        if (!isActiveStudent(student)) return false;
        if (scope.campusId != null && student?.campus_id != null && student.campus_id !== scope.campusId) return false;

        const academicClass = classes.find(c => c.id === report.academic_class_id);
        if (!academicClass) return false;
        if (academicClass.level !== level) return false;
        if (scope.sessionLabel && academicClass.session_label && academicClass.session_label !== scope.sessionLabel) return false;
        if (includeArmFilter && scope.armName && academicClass.arm && academicClass.arm !== scope.armName) return false;
        return true;
    };

    // Get all reports for the level (across all arms)
    const levelReports = reports.filter(r => r.term_id === scope.termId).filter(r => filterByScope(r, false));
    
    if (levelReports.length === 0) return [];

    // Calculate level-wide rankings
    const levelRanks = denseRank(levelReports, r => r.average_score);
    const levelRankMap = new Map<number, { rank: number; total: number }>();
    levelReports.forEach((report, idx) => {
        levelRankMap.set(report.student_id, { rank: levelRanks[idx], total: levelReports.length });
    });

    // Group reports by arm and calculate arm-specific rankings
    const armGroups = new Map<string, StudentTermReport[]>();
    levelReports.forEach(report => {
        const academicClass = classes.find(c => c.id === report.academic_class_id);
        const armName = academicClass?.arm || 'Unknown';
        if (!armGroups.has(armName)) {
            armGroups.set(armName, []);
        }
        armGroups.get(armName)!.push(report);
    });

    const results: LevelRanking[] = [];
    armGroups.forEach((armReports, armName) => {
        const armRanks = denseRank(armReports, r => r.average_score);
        armReports.forEach((report, idx) => {
            const levelRank = levelRankMap.get(report.student_id);
            if (levelRank) {
                results.push({
                    studentId: report.student_id,
                    rankInArm: armRanks[idx],
                    totalInArm: armReports.length,
                    rankInLevel: levelRank.rank,
                    totalInLevel: levelRank.total,
                });
            }
        });
    });

    return results;
};

/**
 * Rank students by subject at both arm and level
 */
export const rankSubjects = (
    scoreEntries: ScoreEntry[],
    scope: ResultScope,
    students: Student[],
    classes: AcademicClass[],
    level: string,
): SubjectRanking[] => {
    const filterByScope = (entry: ScoreEntry, includeArmFilter: boolean) => {
        const student = students.find(s => s.id === entry.student_id);
        if (!isActiveStudent(student)) return false;
        if (scope.campusId != null && student?.campus_id != null && student.campus_id !== scope.campusId) return false;

        const academicClass = classes.find(c => c.id === entry.academic_class_id);
        if (!academicClass) return false;
        if (academicClass.level !== level) return false;
        if (scope.sessionLabel && academicClass.session_label && academicClass.session_label !== scope.sessionLabel) return false;
        if (includeArmFilter && scope.armName && academicClass.arm && academicClass.arm !== scope.armName) return false;
        return true;
    };

    // Get all score entries for the level
    const levelEntries = scoreEntries.filter(e => e.term_id === scope.termId).filter(e => filterByScope(e, false));
    
    if (levelEntries.length === 0) return [];

    // Group by subject
    const subjectGroups = new Map<string, ScoreEntry[]>();
    levelEntries.forEach(entry => {
        const subjectName = entry.subject_name;
        if (!subjectGroups.has(subjectName)) {
            subjectGroups.set(subjectName, []);
        }
        subjectGroups.get(subjectName)!.push(entry);
    });

    const results: SubjectRanking[] = [];

    subjectGroups.forEach((subjectEntries, subjectName) => {
        // Calculate level-wide rankings for this subject
        const levelRanks = denseRank(subjectEntries, e => e.total_score);
        const levelRankMap = new Map<number, { rank: number; total: number; score: number }>();
        subjectEntries.forEach((entry, idx) => {
            levelRankMap.set(entry.student_id, { 
                rank: levelRanks[idx], 
                total: subjectEntries.length,
                score: entry.total_score
            });
        });

        // Group by arm
        const armGroups = new Map<string, ScoreEntry[]>();
        subjectEntries.forEach(entry => {
            const academicClass = classes.find(c => c.id === entry.academic_class_id);
            const armName = academicClass?.arm || 'Unknown';
            if (!armGroups.has(armName)) {
                armGroups.set(armName, []);
            }
            armGroups.get(armName)!.push(entry);
        });

        // Calculate arm-specific rankings
        armGroups.forEach((armEntries, armName) => {
            const armRanks = denseRank(armEntries, e => e.total_score);
            armEntries.forEach((entry, idx) => {
                const levelRank = levelRankMap.get(entry.student_id);
                if (levelRank) {
                    results.push({
                        studentId: entry.student_id,
                        subjectName,
                        rankInArm: armRanks[idx],
                        totalInArm: armEntries.length,
                        rankInLevel: levelRank.rank,
                        totalInLevel: levelRank.total,
                        score: levelRank.score,
                    });
                }
            });
        });
    });

    return results;
};

export const calculateCampusPercentile = (
    report: StudentTermReport,
    allReports: StudentTermReport[],
    scope: ResultScope,
    students: Student[],
    classes: AcademicClass[],
): number | null => {
    const campusReports = allReports.filter(r => r.term_id === scope.termId).filter(r => {
        const student = students.find(s => s.id === r.student_id);
        if (!isActiveStudent(student)) return false;
        if (scope.campusId != null && student?.campus_id != null && student.campus_id !== scope.campusId) return false;
        const academicClass = classes.find(c => c.id === r.academic_class_id);
        if (scope.sessionLabel && academicClass?.session_label && academicClass.session_label !== scope.sessionLabel) return false;
        return true;
    });

    if (campusReports.length === 0) return null;

    const sorted = campusReports.sort((a, b) => b.average_score - a.average_score);
    const rank = sorted.findIndex(r => r.student_id === report.student_id) + 1;
    if (rank === 0) return null;

    return Math.round(((campusReports.length - rank) / campusReports.length) * 100);
};

export const aggregateResultStatistics = (
    reports: StudentTermReport[],
    enrollments: AcademicClassStudent[],
    students: Student[],
    scope: ResultScope,
    passingScore = 50,
    classes: AcademicClass[] = [],
): ResultStatistics => {
    const matchesClassScope = (academicClassId?: number | null) => {
        const classInfo = classes.find(c => c.id === academicClassId);
        if (scope.sessionLabel && classInfo?.session_label && classInfo.session_label !== scope.sessionLabel) return false;
        if (scope.armName && classInfo?.arm && classInfo.arm !== scope.armName) return false;
        return true;
    };

    const activeStudentIds = new Set(
        students.filter(s => isActiveStudent(s) && (scope.campusId == null || s.campus_id === scope.campusId)).map(s => s.id),
    );

    const scopedEnrollment = enrollments.filter(e => e.enrolled_term_id === scope.termId &&
        (scope.academicClassId == null || e.academic_class_id === scope.academicClassId) &&
        matchesClassScope(e.academic_class_id) &&
        activeStudentIds.has(e.student_id));

    const enrolled = new Set(scopedEnrollment.map(e => e.student_id)).size;

    const scopedReports = reports.filter(r => r.term_id === scope.termId &&
        (scope.academicClassId == null || r.academic_class_id === scope.academicClassId) &&
        matchesClassScope(r.academic_class_id) &&
        activeStudentIds.has(r.student_id));

    const withResults = new Set(scopedReports.map(r => r.student_id)).size;
    const averageScore = scopedReports.length > 0
        ? scopedReports.reduce((acc, r) => acc + (r.average_score || 0), 0) / scopedReports.length
        : 0;

    const passCount = scopedReports.filter(r => (r.average_score || 0) >= passingScore).length;
    const passRate = scopedReports.length > 0 ? (passCount / scopedReports.length) * 100 : 0;

    return { enrolled, withResults, averageScore, passCount, passRate };
};

export const findIntegrityIssues = (
    reports: StudentTermReport[],
    enrollments: AcademicClassStudent[],
    students: Student[],
    scoreEntries: ScoreEntry[],
    scope: ResultScope,
    classes: AcademicClass[] = [],
): IntegrityIssue[] => {
    const issues: IntegrityIssue[] = [];
    const activeStudents = students.filter(s => isActiveStudent(s) && (scope.campusId == null || s.campus_id === scope.campusId));
    const activeIds = new Set(activeStudents.map(s => s.id));

    const matchesClassScope = (academicClassId?: number | null) => {
        const classInfo = classes.find(c => c.id === academicClassId);
        if (scope.academicClassId != null && academicClassId != null && academicClassId !== scope.academicClassId) return false;
        if (scope.sessionLabel && classInfo?.session_label && classInfo.session_label !== scope.sessionLabel) return false;
        if (scope.armName && classInfo?.arm && classInfo.arm !== scope.armName) return false;
        return true;
    };

    const scopedEnrollments = enrollments.filter(e => e.enrolled_term_id === scope.termId &&
        matchesClassScope(e.academic_class_id) &&
        activeIds.has(e.student_id));
    const enrolledIds = new Set(scopedEnrollments.map(e => e.student_id));

    activeStudents.forEach(student => {
        const hasEnrollment = scopedEnrollments.some(e => e.student_id === student.id);
        if (!hasEnrollment) {
            issues.push({
                type: 'missing-assignment',
                message: `${student.name || 'Student'} is active but not enrolled for the selected term/scope`,
            });
        }
    });

    const scopedReports = reports.filter(r => r.term_id === scope.termId && matchesClassScope(r.academic_class_id));
    const seenReportKeys = new Map<string, number>();
    scopedReports.forEach(r => {
        const key = `${r.student_id}-${r.term_id}-${r.academic_class_id}`;
        seenReportKeys.set(key, (seenReportKeys.get(key) || 0) + 1);
        if (!enrolledIds.has(r.student_id)) {
            issues.push({
                type: 'orphan-result',
                message: `Result exists for student ${r.student_id} without enrollment in scope`,
            });
        }
    });

    seenReportKeys.forEach((count, key) => {
        if (count > 1) {
            issues.push({
                type: 'duplicate-result',
                message: `Duplicate results detected for ${key.split('-')[0]} in the same term`,
            });
        }
    });

    const scopedScores = scoreEntries.filter(se => se.term_id === scope.termId && matchesClassScope(se.academic_class_id));
    const scoreKeys = new Map<string, number>();
    scopedScores.forEach(se => {
        const key = `${se.student_id}-${se.academic_class_id}-${se.subject_name}-${se.term_id}`;
        scoreKeys.set(key, (scoreKeys.get(key) || 0) + 1);
    });
    scoreKeys.forEach((count, key) => {
        if (count > 1) {
            issues.push({
                type: 'duplicate-result',
                message: `Duplicate score rows detected for ${key}`,
            });
        }
    });

    return issues;
};

