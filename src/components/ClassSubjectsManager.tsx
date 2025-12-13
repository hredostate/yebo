import React, { useState, useMemo, useEffect } from 'react';
import type { BaseDataObject, ClassSubject } from '../types';
import Spinner from './common/Spinner';
import { CheckCircleIcon, LockClosedIcon } from './common/icons';

interface ClassSubjectsManagerProps {
    classes: BaseDataObject[];
    subjects: BaseDataObject[];
    classSubjects: ClassSubject[];
    onSave: (classId: number, subjectId: number, isCompulsory: boolean) => Promise<boolean>;
    onDelete: (classId: number, subjectId: number) => Promise<boolean>;
}

const ClassSubjectsManager: React.FC<ClassSubjectsManagerProps> = ({ 
    classes = [], 
    subjects = [], 
    classSubjects = [],
    onSave, 
    onDelete 
}) => {
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [savingSubjectId, setSavingSubjectId] = useState<number | null>(null);

    // Set initial class selection
    useEffect(() => {
        if (!selectedClassId && classes.length > 0) {
            setSelectedClassId(classes[0].id);
        }
    }, [classes, selectedClassId]);

    // Get class subjects for selected class
    const selectedClassSubjects = useMemo(() => {
        if (!selectedClassId) return [];
        return classSubjects.filter(cs => cs.class_id === selectedClassId);
    }, [selectedClassId, classSubjects]);

    // Create a map for quick lookup of subject configuration
    const subjectConfigMap = useMemo(() => {
        const map = new Map<number, { enabled: boolean; isCompulsory: boolean }>();
        selectedClassSubjects.forEach(cs => {
            map.set(cs.subject_id, { enabled: true, isCompulsory: cs.is_compulsory });
        });
        return map;
    }, [selectedClassSubjects]);

    const handleToggleSubject = async (subjectId: number, currentlyEnabled: boolean) => {
        if (!selectedClassId || isSaving) return;
        
        if (currentlyEnabled) {
            // Confirm before removing subject
            if (!window.confirm('Are you sure you want to remove this subject from the class? This may affect student enrollments and timetables.')) {
                return;
            }
        }
        
        setIsSaving(true);
        setSavingSubjectId(subjectId);
        
        try {
            if (currentlyEnabled) {
                // Remove subject
                await onDelete(selectedClassId, subjectId);
            } else {
                // Add subject (not compulsory by default)
                await onSave(selectedClassId, subjectId, false);
            }
        } finally {
            setIsSaving(false);
            setSavingSubjectId(null);
        }
    };

    const handleToggleCompulsory = async (subjectId: number, currentIsCompulsory: boolean) => {
        if (!selectedClassId || isSaving) return;
        
        setIsSaving(true);
        setSavingSubjectId(subjectId);
        
        try {
            // Update to toggle compulsory status
            await onSave(selectedClassId, subjectId, !currentIsCompulsory);
        } finally {
            setIsSaving(false);
            setSavingSubjectId(null);
        }
    };

    if (classes.length === 0) {
        return (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Manage Class Subjects</h3>
                <p className="text-slate-600 dark:text-slate-400">
                    No class levels found. Please add classes in the "Classes" tab first.
                </p>
            </div>
        );
    }

    if (subjects.length === 0) {
        return (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Manage Class Subjects</h3>
                <p className="text-slate-600 dark:text-slate-400">
                    No subjects found. Please add subjects in the "Subjects" tab first.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-2">Manage Class Subjects</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Configure which subjects are available for each class level. Mark subjects as compulsory to prevent students from deselecting them.
                </p>
            </div>

            {/* Class Selector */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Select Class Level
                </label>
                <select
                    value={selectedClassId || ''}
                    onChange={(e) => setSelectedClassId(Number(e.target.value))}
                    className="w-full max-w-md px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                    {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>
                            {cls.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Subjects Grid */}
            {selectedClassId && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-md font-semibold text-slate-900 dark:text-white">
                            Available Subjects for {classes.find(c => c.id === selectedClassId)?.name}
                        </h4>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            {selectedClassSubjects.length} of {subjects.length} subjects enabled
                        </div>
                    </div>

                    <div className="grid gap-3">
                        {subjects.map(subject => {
                            const config = subjectConfigMap.get(subject.id);
                            const isEnabled = config?.enabled || false;
                            const isCompulsory = config?.isCompulsory || false;
                            const isProcessing = isSaving && savingSubjectId === subject.id;

                            return (
                                <div
                                    key={subject.id}
                                    className={`p-4 border rounded-lg transition-colors ${
                                        isCompulsory
                                            ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                                            : isEnabled
                                            ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1">
                                            {/* Enable/Disable Checkbox */}
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={isEnabled}
                                                    disabled={isProcessing}
                                                    onChange={() => handleToggleSubject(subject.id, isEnabled)}
                                                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                                />
                                                <span className="font-medium text-slate-900 dark:text-white">
                                                    {subject.name}
                                                </span>
                                            </label>

                                            {/* Status Badges */}
                                            <div className="flex items-center gap-2">
                                                {isCompulsory && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-100">
                                                        <LockClosedIcon className="w-3 h-3" />
                                                        Compulsory
                                                    </span>
                                                )}
                                                {isEnabled && !isCompulsory && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                                                        <CheckCircleIcon className="w-3 h-3" />
                                                        Optional
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Compulsory Toggle (only shown when subject is enabled) */}
                                        {isEnabled && (
                                            <div className="flex items-center gap-2">
                                                {isProcessing && <Spinner size="sm" />}
                                                {!isProcessing && (
                                                    <button
                                                        onClick={() => handleToggleCompulsory(subject.id, isCompulsory)}
                                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                                            isCompulsory
                                                                ? 'bg-amber-600 text-white hover:bg-amber-700'
                                                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                                        }`}
                                                    >
                                                        {isCompulsory ? 'Remove Compulsory' : 'Make Compulsory'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Help text for compulsory subjects */}
                                    {isCompulsory && (
                                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                                            Students cannot deselect this subject - it will be automatically included in their selection.
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassSubjectsManager;