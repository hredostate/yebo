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

    const matchesClassScope = (academicClassId?: number | null) => {
        const classInfo = classes.find(c => c.id === academicClassId);
        if (scope.academicClassId != null && academicClassId != null && academicClassId !== scope.academicClassId) return false;
        if (scope.sessionLabel && classInfo?.session_label && classInfo.session_label !== scope.sessionLabel) return false;
        if (scope.armName && classInfo?.arm && classInfo.arm !== scope.armName) return false;
        return true;
    };

    // Get enrollments for the specific scope (class/term)
    const scopedEnrollments = enrollments.filter(e => 
        e.enrolled_term_id === scope.termId &&
        matchesClassScope(e.academic_class_id)
    );
    const enrolledStudentIds = new Set(scopedEnrollments.map(e => e.student_id));

    // Get reports for the specific scope
    const scopedReports = reports.filter(r => r.term_id === scope.termId && matchesClassScope(r.academic_class_id));

    // Only check students who are ENROLLED in this specific class - not all active students
    // Check for enrolled students whose student record doesn't exist
    scopedEnrollments.forEach(enrollment => {
        const student = students.find(s => s.id === enrollment.student_id);
        if (!student) {
            issues.push({
                type: 'orphan-result',
                message: `Enrollment exists for student ID ${enrollment.student_id} but student record not found`,
            });
        }
    });

    // Check for orphan results - results exist for students not enrolled in this class
    scopedReports.forEach(r => {
        if (!enrolledStudentIds.has(r.student_id)) {
            const student = students.find(s => s.id === r.student_id);
            issues.push({
                type: 'orphan-result',
                message: `Result exists for ${student?.name || `student ${r.student_id}`} without enrollment in this class`,
            });
        }
    });

    // Check for duplicate reports
    const seenReportKeys = new Map<string, number>();
    scopedReports.forEach(r => {
        const key = `${r.student_id}-${r.term_id}-${r.academic_class_id}`;
        seenReportKeys.set(key, (seenReportKeys.get(key) || 0) + 1);
    });
    seenReportKeys.forEach((count, key) => {
        if (count > 1) {
            const studentId = key.split('-')[0];
            const student = students.find(s => s.id === Number(studentId));
            issues.push({
                type: 'duplicate-result',
                message: `Duplicate results detected for ${student?.name || `student ${studentId}`} in the same term`,
            });
        }
    });

    // Check for duplicate score entries
    const scopedScores = scoreEntries.filter(se => se.term_id === scope.termId && matchesClassScope(se.academic_class_id));
    const scoreKeys = new Map<string, number>();
    scopedScores.forEach(se => {
        const key = `${se.student_id}-${se.academic_class_id}-${se.subject_name}-${se.term_id}`;
        scoreKeys.set(key, (scoreKeys.get(key) || 0) + 1);
    });
    scoreKeys.forEach((count, key) => {
        if (count > 1) {
            const parts = key.split('-');
            const student = students.find(s => s.id === Number(parts[0]));
            issues.push({
                type: 'duplicate-result',
                message: `Duplicate score entries for ${student?.name || `student ${parts[0]}`} in ${parts[2]}`,
            });
        }
    });

    return issues;
};
