import React, { useState, useMemo } from 'react';
import { CheckCircleIcon, XCircleIcon } from './common/icons';
import type { AcademicTeachingAssignment, LessonPlanAssignment } from '../types';

interface LessonPlanAssignmentSelectorProps {
    userAssignments: AcademicTeachingAssignment[];
    currentAssignments: LessonPlanAssignment[];
    onAssignmentsChange: (assignmentIds: number[]) => void;
    lessonPlanSubject?: string;
    lessonPlanGradeLevel?: string;
}

const LessonPlanAssignmentSelector: React.FC<LessonPlanAssignmentSelectorProps> = ({
    userAssignments,
    currentAssignments,
    onAssignmentsChange,
    lessonPlanSubject,
    lessonPlanGradeLevel
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(
        new Set(currentAssignments.map(a => a.teaching_entity_id))
    );

    // Auto-populate suggested classes (same subject, same level)
    const suggestedAssignments = useMemo(() => {
        if (!lessonPlanSubject) return [];
        
        return userAssignments.filter(assignment => {
            // Match by subject
            if (assignment.subject_name !== lessonPlanSubject) return false;
            
            // Optionally match by grade level if provided
            if (lessonPlanGradeLevel && assignment.academic_class) {
                const classLevel = assignment.academic_class.level;
                if (classLevel !== lessonPlanGradeLevel) return false;
            }
            
            return true;
        });
    }, [userAssignments, lessonPlanSubject, lessonPlanGradeLevel]);

    // Group assignments by subject
    const groupedAssignments = useMemo(() => {
        const groups: Record<string, AcademicTeachingAssignment[]> = {};
        
        userAssignments.forEach(assignment => {
            const subject = assignment.subject_name || 'Other';
            if (!groups[subject]) {
                groups[subject] = [];
            }
            groups[subject].push(assignment);
        });
        
        return groups;
    }, [userAssignments]);

    const handleToggle = (assignmentId: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(assignmentId)) {
            newSet.delete(assignmentId);
        } else {
            newSet.add(assignmentId);
        }
        setSelectedIds(newSet);
        onAssignmentsChange(Array.from(newSet));
    };

    const handleSelectAll = () => {
        const allIds = userAssignments.map(a => a.id);
        setSelectedIds(new Set(allIds));
        onAssignmentsChange(allIds);
    };

    const handleSelectSuggested = () => {
        const suggestedIds = suggestedAssignments.map(a => a.id);
        setSelectedIds(new Set(suggestedIds));
        onAssignmentsChange(suggestedIds);
    };

    const handleClearAll = () => {
        setSelectedIds(new Set());
        onAssignmentsChange([]);
    };

    const formatClassName = (assignment: AcademicTeachingAssignment) => {
        if (!assignment.academic_class) return 'Unknown Class';
        return `${assignment.academic_class.name} - ${assignment.subject_name}`;
    };

    return (
        <div className="space-y-4">
            {/* Header and Actions */}
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-700 dark:text-slate-300">
                    Assign to Classes ({selectedIds.size} selected)
                </h3>
                <div className="flex gap-2">
                    {suggestedAssignments.length > 0 && (
                        <button
                            onClick={handleSelectSuggested}
                            className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                        >
                            Select Suggested ({suggestedAssignments.length})
                        </button>
                    )}
                    <button
                        onClick={handleSelectAll}
                        className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                    >
                        Select All
                    </button>
                    <button
                        onClick={handleClearAll}
                        className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Suggested Classes Notice */}
            {suggestedAssignments.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                        💡 {suggestedAssignments.length} suggested class{suggestedAssignments.length !== 1 ? 'es' : ''} based on subject
                        {lessonPlanGradeLevel && ' and grade level'}
                    </p>
                </div>
            )}

            {/* Visual Preview of Selected Classes */}
            {selectedIds.size > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                        Selected Classes:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {Array.from(selectedIds).map(id => {
                            const assignment = userAssignments.find(a => a.id === id);
                            if (!assignment) return null;
                            return (
                                <span
                                    key={id}
                                    className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-sm"
                                >
                                    <CheckCircleIcon className="w-4 h-4" />
                                    {formatClassName(assignment)}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Assignment Selection - Grouped by Subject */}
            <div className="max-h-96 overflow-y-auto space-y-4 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                {Object.entries(groupedAssignments).map(([subject, assignments]) => (
                    <div key={subject}>
                        <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                            {subject}
                        </h4>
                        <div className="space-y-1">
                            {assignments.map(assignment => {
                                const isSelected = selectedIds.has(assignment.id);
                                const isSuggested = suggestedAssignments.some(s => s.id === assignment.id);
                                
                                return (
                                    <label
                                        key={assignment.id}
                                        className={`flex items-center gap-3 p-3 rounded cursor-pointer transition ${
                                            isSelected
                                                ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700'
                                                : isSuggested
                                                ? 'bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20'
                                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggle(assignment.id)}
                                            className="w-5 h-5 text-blue-600 rounded"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                                    {formatClassName(assignment)}
                                                </span>
                                                {isSuggested && (
                                                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                                        Suggested
                                                    </span>
                                                )}
                                            </div>
                                            {assignment.academic_class && (
                                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                                    {assignment.academic_class.level} • {assignment.term?.session_label} {assignment.term?.term_label}
                                                </p>
                                            )}
                                        </div>
                                        {isSelected ? (
                                            <CheckCircleIcon className="w-6 h-6 text-blue-600" />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* No Assignments Message */}
            {userAssignments.length === 0 && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <p>No teaching assignments found</p>
                    <p className="text-sm mt-2">You need to have teaching assignments to create lesson plans</p>
                </div>
            )}
        </div>
    );
};

export default LessonPlanAssignmentSelector;
