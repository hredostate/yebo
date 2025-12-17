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
    const reportStudentIds = new Set(scopedReports.map(r => r.student_id));

    // Only check students who are ENROLLED in this specific class - not all active students
    // Check for enrolled students who are inactive (should not have results counted)
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
