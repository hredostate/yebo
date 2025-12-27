import React, { useState, useMemo, useEffect } from 'react';
import type { BaseDataObject, ClassSubject, SubjectGroup, SubjectGroupMember } from '../types';
import Spinner from './common/Spinner';
import { CheckCircleIcon, LockClosedIcon, TrashIcon, PlusIcon } from './common/icons';
import {
    createSubjectGroup,
    updateSubjectGroup,
    deleteSubjectGroup,
    addSubjectToGroup,
    removeSubjectFromGroup
} from '../services/subjectGroupService';

interface ClassSubjectsManagerProps {
    classes: BaseDataObject[];
    subjects: BaseDataObject[];
    classSubjects: ClassSubject[];
    subjectGroups: SubjectGroup[];
    subjectGroupMembers: SubjectGroupMember[];
    schoolId: number;
    onSave: (classId: number, subjectId: number, isCompulsory: boolean) => Promise<boolean>;
    onDelete: (classId: number, subjectId: number) => Promise<boolean>;
    onRefreshData: () => Promise<void>;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ClassSubjectsManager: React.FC<ClassSubjectsManagerProps> = ({ 
    classes = [], 
    subjects = [], 
    classSubjects = [],
    subjectGroups = [],
    subjectGroupMembers = [],
    schoolId,
    onSave, 
    onDelete,
    onRefreshData,
    addToast
}) => {
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [savingSubjectId, setSavingSubjectId] = useState<number | null>(null);
    
    // Subject Groups state
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupMin, setNewGroupMin] = useState(1);
    const [newGroupMax, setNewGroupMax] = useState(1);
    const [editingGroupId, setEditingGroupId] = useState<number | null>(null);

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
    
    // Get subject groups for selected class
    const selectedGroups = useMemo(() => {
        if (!selectedClassId || !schoolId) return [];
        return subjectGroups.filter(g => g.class_id === selectedClassId && g.school_id === schoolId);
    }, [selectedClassId, schoolId, subjectGroups]);
    
    // Map group members by group ID
    const groupMembersMap = useMemo(() => {
        const map = new Map<number, number[]>();
        subjectGroupMembers.forEach(m => {
            if (!map.has(m.group_id)) {
                map.set(m.group_id, []);
            }
            map.get(m.group_id)!.push(m.subject_id);
        });
        return map;
    }, [subjectGroupMembers]);
    
    // Get which group a subject belongs to (if any)
    const subjectGroupMap = useMemo(() => {
        const map = new Map<number, SubjectGroup>();
        selectedGroups.forEach(group => {
            const members = groupMembersMap.get(group.id) || [];
            members.forEach(subjectId => {
                map.set(subjectId, group);
            });
        });
        return map;
    }, [selectedGroups, groupMembersMap]);

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
    
    // Subject Group Handlers
    const handleCreateGroup = async () => {
        if (!selectedClassId || !newGroupName.trim()) {
            addToast('Please enter a group name', 'error');
            return;
        }
        
        if (newGroupMin < 0 || newGroupMax < newGroupMin) {
            addToast('Invalid min/max selections', 'error');
            return;
        }
        
        setIsSaving(true);
        try {
            const result = await createSubjectGroup({
                school_id: schoolId,
                class_id: selectedClassId,
                group_name: newGroupName.trim(),
                min_selections: newGroupMin,
                max_selections: newGroupMax
            });
            
            if (result) {
                addToast('Group created successfully', 'success');
                setNewGroupName('');
                setNewGroupMin(1);
                setNewGroupMax(1);
                setIsCreatingGroup(false);
                await onRefreshData();
            } else {
                addToast('Failed to create group', 'error');
            }
        } catch (error) {
            addToast('Error creating group', 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleUpdateGroup = async (groupId: number, updates: { group_name?: string; min_selections?: number; max_selections?: number }) => {
        setIsSaving(true);
        try {
            const success = await updateSubjectGroup(groupId, updates);
            if (success) {
                addToast('Group updated successfully', 'success');
                setEditingGroupId(null);
                await onRefreshData();
            } else {
                addToast('Failed to update group', 'error');
            }
        } catch (error) {
            addToast('Error updating group', 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteGroup = async (groupId: number, groupName: string) => {
        if (!window.confirm(`Are you sure you want to delete the group "${groupName}"? This will remove all subjects from the group.`)) {
            return;
        }
        
        setIsSaving(true);
        try {
            const success = await deleteSubjectGroup(groupId);
            if (success) {
                addToast('Group deleted successfully', 'success');
                await onRefreshData();
            } else {
                addToast('Failed to delete group', 'error');
            }
        } catch (error) {
            addToast('Error deleting group', 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleAddSubjectToGroup = async (groupId: number, subjectId: number) => {
        setIsSaving(true);
        try {
            const success = await addSubjectToGroup(groupId, subjectId);
            if (success) {
                addToast('Subject added to group', 'success');
                await onRefreshData();
            } else {
                addToast('Failed to add subject to group', 'error');
            }
        } catch (error) {
            addToast('Error adding subject to group', 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleRemoveSubjectFromGroup = async (groupId: number, subjectId: number) => {
        setIsSaving(true);
        try {
            const success = await removeSubjectFromGroup(groupId, subjectId);
            if (success) {
                addToast('Subject removed from group', 'success');
                await onRefreshData();
            } else {
                addToast('Failed to remove subject from group', 'error');
            }
        } catch (error) {
            addToast('Error removing subject from group', 'error');
        } finally {
            setIsSaving(false);
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
                                                {/* Show group badge if subject belongs to a group */}
                                                {subjectGroupMap.has(subject.id) && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100">
                                                        📦 {subjectGroupMap.get(subject.id)!.group_name}
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
            
            {/* Subject Groups Section */}
            {selectedClassId && (
                <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-md font-semibold text-slate-900 dark:text-white">
                                Subject Groups
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                Create groups of mutually exclusive subjects where students can select a limited number
                            </p>
                        </div>
                        {!isCreatingGroup && (
                            <button
                                onClick={() => setIsCreatingGroup(true)}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                            >
                                <PlusIcon className="w-4 h-4" />
                                Create Group
                            </button>
                        )}
                    </div>
                    
                    {/* Create Group Form */}
                    {isCreatingGroup && (
                        <div className="p-4 border border-purple-300 dark:border-purple-700 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                            <h5 className="font-medium text-slate-900 dark:text-white mb-3">New Subject Group</h5>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Group Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        placeholder="e.g., Religious Studies"
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Min Selections
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={newGroupMin}
                                        onChange={(e) => setNewGroupMin(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Max Selections
                                    </label>
                                    <input
                                        type="number"
                                        min={newGroupMin}
                                        value={newGroupMax}
                                        onChange={(e) => setNewGroupMax(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreateGroup}
                                    disabled={isSaving || !newGroupName.trim()}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                                >
                                    {isSaving ? 'Creating...' : 'Create'}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsCreatingGroup(false);
                                        setNewGroupName('');
                                        setNewGroupMin(1);
                                        setNewGroupMax(1);
                                    }}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* Existing Groups */}
                    {selectedGroups.length === 0 && !isCreatingGroup && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                            No subject groups created yet. Click "Create Group" to add one.
                        </p>
                    )}
                    
                    <div className="space-y-3">
                        {selectedGroups.map(group => {
                            const memberSubjectIds = groupMembersMap.get(group.id) || [];
                            const availableOptionalSubjects = subjects.filter(s => {
                                const config = subjectConfigMap.get(s.id);
                                // Only show enabled, non-compulsory subjects that aren't already in a group
                                return config?.enabled && !config.isCompulsory && !subjectGroupMap.has(s.id);
                            });
                            
                            return (
                                <div key={group.id} className="p-4 border border-purple-200 dark:border-purple-800 rounded-lg bg-white dark:bg-slate-800">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h5 className="font-medium text-slate-900 dark:text-white">
                                                📦 {group.group_name}
                                            </h5>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Pick {group.min_selections === group.max_selections 
                                                    ? `${group.max_selections}`
                                                    : `${group.min_selections}-${group.max_selections}`
                                                } subject{group.max_selections > 1 ? 's' : ''}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteGroup(group.id, group.group_name)}
                                            disabled={isSaving}
                                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                                            title="Delete group"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                    
                                    {/* Group Members */}
                                    {memberSubjectIds.length > 0 ? (
                                        <div className="mb-3 space-y-2">
                                            {memberSubjectIds.map(subjectId => {
                                                const subject = subjects.find(s => s.id === subjectId);
                                                if (!subject) return null;
                                                
                                                return (
                                                    <div key={subjectId} className="flex items-center justify-between px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                                        <span className="text-sm text-slate-900 dark:text-white">
                                                            {subject.name}
                                                        </span>
                                                        <button
                                                            onClick={() => handleRemoveSubjectFromGroup(group.id, subjectId)}
                                                            disabled={isSaving}
                                                            className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500 dark:text-slate-400 italic mb-3">
                                            No subjects in this group yet
                                        </p>
                                    )}
                                    
                                    {/* Add Subject Dropdown */}
                                    {availableOptionalSubjects.length > 0 && (
                                        <div className="flex gap-2">
                                            <select
                                                onChange={(e) => {
                                                    const subjectId = Number(e.target.value);
                                                    if (subjectId) {
                                                        handleAddSubjectToGroup(group.id, subjectId);
                                                        e.target.value = '';
                                                    }
                                                }}
                                                disabled={isSaving}
                                                className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-50"
                                            >
                                                <option value="">Add subject to group...</option>
                                                {availableOptionalSubjects.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
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