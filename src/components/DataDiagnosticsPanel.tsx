import React, { useMemo } from 'react';
import type {
    StudentTermReport,
    Student,
    AcademicClass,
    AcademicClassStudent,
    ScoreEntry
} from '../types';
import { findIntegrityIssues, type ResultScope } from '../utils/resultAnalytics';

interface DataDiagnosticsPanelProps {
    termId: number;
    studentTermReports: StudentTermReport[];
    students: Student[];
    academicClasses: AcademicClass[];
    academicClassStudents: AcademicClassStudent[];
    scoreEntries: ScoreEntry[];
    selectedLevel?: string;
    selectedArmId?: number | null;
}

/**
 * DataDiagnosticsPanel - Admin-only component for viewing data integrity issues
 * 
 * This panel shows data integrity warnings such as orphan results, missing assignments,
 * and duplicate records. It's separated from the main statistics dashboard to avoid
 * cluttering the user experience with technical diagnostics.
 */
const DataDiagnosticsPanel: React.FC<DataDiagnosticsPanelProps> = ({
    termId,
    studentTermReports,
    students,
    academicClasses,
    academicClassStudents,
    scoreEntries,
    selectedLevel,
    selectedArmId
}) => {
    // Get classes for selected level
    const classesForLevel = useMemo(() => {
        if (!selectedLevel) return academicClasses.filter(ac => ac.is_active);
        return academicClasses.filter(ac => ac.level === selectedLevel && ac.is_active);
    }, [selectedLevel, academicClasses]);

    const buildScopeForClass = (classId?: number | null): ResultScope => {
        const academicClass = academicClasses.find(ac => ac.id === classId);
        const enrolledIds = academicClassStudents
            .filter(acs => (!classId || acs.academic_class_id === classId) && acs.enrolled_term_id === termId)
            .map(acs => acs.student_id);

        const campusId = students.find(s => enrolledIds.includes(s.id) && s.campus_id != null)?.campus_id ?? undefined;

        return {
            campusId,
            termId,
            sessionLabel: academicClass?.session_label,
            academicClassId: classId ?? undefined,
            armName: academicClass?.arm
        };
    };

    const auditIssues = useMemo(() => {
        const classIds = selectedArmId
            ? [selectedArmId]
            : classesForLevel.map(c => c.id);

        return classIds.flatMap(classId => {
            const scope = buildScopeForClass(classId);
            const scopeLabel = academicClasses.find(ac => ac.id === classId)?.name || `Class ${classId}`;

            return findIntegrityIssues(studentTermReports, academicClassStudents, students, scoreEntries, scope, academicClasses)
                .map(issue => ({ ...issue, scopeLabel }));
        });
    }, [selectedArmId, classesForLevel, studentTermReports, academicClassStudents, students, scoreEntries, academicClasses]);

    // Group issues by type
    const groupedIssues = useMemo(() => {
        const groups = {
            'orphan-result': [] as typeof auditIssues,
            'missing-assignment': [] as typeof auditIssues,
            'duplicate-result': [] as typeof auditIssues,
        };

        auditIssues.forEach(issue => {
            groups[issue.type].push(issue);
        });

        return groups;
    }, [auditIssues]);

    const issueTypeLabels = {
        'orphan-result': 'Orphan Results',
        'missing-assignment': 'Missing Assignments',
        'duplicate-result': 'Duplicate Records'
    };

    const issueTypeDescriptions = {
        'orphan-result': 'Results exist for students without enrollment records or missing student records',
        'missing-assignment': 'Enrolled students missing required assignments',
        'duplicate-result': 'Multiple result entries for the same student/term/subject combination'
    };

    return (
        <div className="space-y-6">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                            Admin Diagnostics Panel
                        </h3>
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                            This panel shows data integrity issues. Some warnings (like orphan-result) may be false positives
                            when students from multiple campuses are enrolled in the same class. Review carefully before taking action.
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Data Integrity Audit</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {auditIssues.length} total issue{auditIssues.length === 1 ? '' : 's'} detected
                        </p>
                    </div>
                    {selectedLevel && (
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            Scope: {selectedLevel} {selectedArmId && classesForLevel.find(c => c.id === selectedArmId)?.arm}
                        </div>
                    )}
                </div>

                {auditIssues.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">
                            No Integrity Issues Detected
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            All data appears to be consistent for the selected scope
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {(Object.keys(groupedIssues) as Array<keyof typeof groupedIssues>).map(issueType => {
                            const issues = groupedIssues[issueType];
                            if (issues.length === 0) return null;

                            return (
                                <div key={issueType} className="border border-slate-200 dark:border-slate-700 rounded-lg">
                                    <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {issueTypeLabels[issueType]}
                                            </h3>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                                {issues.length}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                            {issueTypeDescriptions[issueType]}
                                        </p>
                                    </div>
                                    <div className="p-4">
                                        <ul className="space-y-2">
                                            {issues.map((issue, idx) => (
                                                <li key={`${issue.type}-${idx}`} className="flex items-start gap-2 text-sm">
                                                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5"></span>
                                                    <span className="text-slate-700 dark:text-slate-300">
                                                        <span className="font-medium text-slate-900 dark:text-white">
                                                            {issue.scopeLabel}:
                                                        </span>{' '}
                                                        {issue.message}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                            How to Resolve Issues
                        </h4>
                        <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                            <li>Orphan Results: Verify enrollment records exist for students with results</li>
                            <li>Missing Assignments: Ensure all enrolled students have score entries or report records</li>
                            <li>Duplicate Records: Remove duplicate entries keeping only the most recent/accurate one</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataDiagnosticsPanel;
