
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { StudentProfile, AcademicClass, SubjectGroup, SubjectGroupMember } from '../types';
import Spinner from './common/Spinner';
import { SunIcon, MoonIcon, BookOpenIcon, CheckCircleIcon, LockClosedIcon, ClipboardIcon, Squares2x2Icon } from './common/icons';
import StudentAcademicGoalEditor from './StudentAcademicGoalEditor';
import SubjectSelectionReceipt from './SubjectSelectionReceipt';
import { lockStudentChoices, getElectiveCapacityInfo, type ElectiveCapacityInfo } from '../services/studentSubjectChoiceService';
import { getSubjectGroupsForClass, validateStudentSelections } from '../services/subjectGroupService';

interface StudentPortalProps {
    studentProfile: StudentProfile;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    onLogout: () => void;
    isDarkMode?: boolean;
    toggleTheme?: () => void;
}

const StudentPortal: React.FC<StudentPortalProps> = ({ studentProfile, addToast, onLogout, isDarkMode, toggleTheme }) => {
    const [activeTab, setActiveTab] = useState<'subjects' | 'goals'>('subjects');
    const [viewMode, setViewMode] = useState<'selection' | 'receipt'>('selection');
    const [availableSubjects, setAvailableSubjects] = useState<{subject_id: number, subject_name: string, is_compulsory: boolean}[]>([]);
    const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [academicClass, setAcademicClass] = useState<AcademicClass | null>(null);
    const [hasSaved, setHasSaved] = useState(false);
    const [activeTermId, setActiveTermId] = useState<number | null>(null);
    const [schoolId, setSchoolId] = useState<number | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [lockedAt, setLockedAt] = useState<string | null>(null);
    const [electiveCapacity, setElectiveCapacity] = useState<Map<number, ElectiveCapacityInfo>>(new Map());
    
    // Subject Groups state
    const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
    const [subjectGroupMembers, setSubjectGroupMembers] = useState<SubjectGroupMember[]>([]);
    const [groupValidationErrors, setGroupValidationErrors] = useState<string[]>([]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        
        try {
            // Early validation for required fields
            if (!studentProfile.student_record_id) {
                addToast('Student record not found. Please contact administrator.', 'error');
                return;
            }

            // Check if class_id exists
            if (!studentProfile.class_id) {
                console.warn('Student has no class_id assigned');
                // Still allow the component to render, just show empty subjects
                setAvailableSubjects([]);
                return;
            }

            // 1. Get Active Term & Enrollment to find the exact AcademicClass
            const supabase = requireSupabaseClient();
            const { data: activeTerms } = await supabase.from('terms').select('id, school_id').eq('is_active', true).limit(1);
            const activeTermIdLocal = activeTerms?.[0]?.id;
            const schoolIdLocal = activeTerms?.[0]?.school_id ?? studentProfile.school_id;
            
            setActiveTermId(activeTermIdLocal || null);
            setSchoolId(schoolIdLocal || null);
            
            let currentAcademicClass: AcademicClass | null = null;

            if (activeTermIdLocal && studentProfile.student_record_id) {
                 const { data: enrollment } = await supabase
                    .from('academic_class_students')
                    .select('academic_class_id, academic_class:academic_classes(*)')
                    .eq('student_id', studentProfile.student_record_id)
                    .eq('enrolled_term_id', activeTermIdLocal)
                    .maybeSingle();
                 
                 if (enrollment && enrollment.academic_class) {
                     // We have the specific academic class with limits
                     // Need to cast because Join returns object or array depending on setup, assuming standard
                     currentAcademicClass = enrollment.academic_class as unknown as AcademicClass;
                     setAcademicClass(currentAcademicClass);
                 }
            }

            // 2. Fetch subjects
            // Ideally, fetch all subjects available in the school or linked to the generic class level
            // 'class_subjects' links generic class (e.g. JSS 1) to subjects.
            let fetchedSubjects: {subject_id: number, subject_name: string, is_compulsory: boolean}[] = [];
            const { data: classSubjects, error: classSubjectsError } = await supabase
                .from('class_subjects')
                .select('subject_id, is_compulsory, subjects(name)')
                .eq('class_id', studentProfile.class_id);

            if (classSubjectsError) {
                console.error(classSubjectsError);
                addToast('Error fetching available subjects.', 'error');
            } else {
                fetchedSubjects = classSubjects ? classSubjects.map((s:any) => ({ 
                    subject_id: s.subject_id, 
                    subject_name: s.subjects.name,
                    is_compulsory: s.is_compulsory || false
                })).sort((a,b) => a.subject_name.localeCompare(b.subject_name)) : [];
                setAvailableSubjects(fetchedSubjects);
            }
            
            // 2b. Fetch subject groups for the class
            if (studentProfile.class_id && schoolIdLocal) {
                const groupsData = await getSubjectGroupsForClass(studentProfile.class_id, schoolIdLocal);
                if (groupsData) {
                    setSubjectGroups(groupsData.groups);
                    setSubjectGroupMembers(groupsData.members);
                } else {
                    setSubjectGroups([]);
                    setSubjectGroupMembers([]);
                }
            }

            // 3. Fetch existing choices & Merge Compulsory & Check Lock Status
            const { data: choices, error: choicesError } = await supabase
                .from('student_subject_choices')
                .select('subject_id, locked, locked_at')
                .eq('student_id', studentProfile.student_record_id);
            
            if (choicesError) {
                console.error(choicesError);
                addToast('Error fetching your choices.', 'error');
            } else {
                const existingIds = (choices || []).map((c: any) => Number(c.subject_id));
                // Check if any choices are locked
                const anyLocked = (choices || []).some((c: any) => c.locked === true);
                setIsLocked(anyLocked);
                
                // If locked, default to receipt view and get locked timestamp
                if (anyLocked) {
                    setViewMode('receipt');
                    const lockedChoice = choices?.find((c: any) => c.locked && c.locked_at);
                    if (lockedChoice) {
                        setLockedAt(lockedChoice.locked_at);
                    }
                }
                
                // Automatically include compulsory subjects in the selection state
                const compulsoryIds = fetchedSubjects.filter(s => s.is_compulsory).map(s => s.subject_id);
                const combinedIds = new Set<number>([...existingIds, ...compulsoryIds]);
                
                setSelectedSubjectIds(combinedIds);
            }
            
            // 4. Fetch elective capacity information if student has class and arm
            if (studentProfile.class_id && studentProfile.arm_id && schoolIdLocal) {
                const capacityInfo = await getElectiveCapacityInfo(
                    studentProfile.class_id,
                    studentProfile.arm_id,
                    schoolIdLocal
                );
                
                const capacityMap = new Map<number, ElectiveCapacityInfo>();
                capacityInfo.forEach(info => {
                    capacityMap.set(info.subjectId, info);
                });
                setElectiveCapacity(capacityMap);
            }
        } catch (error: any) {
            console.error('Error loading student portal data:', error);
            addToast('Failed to load data. Please try again.', 'error');
        } finally {
            setIsLoading(false); // Always stop loading, even on error
        }
    }, [studentProfile, addToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    // Memoized group data structures
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
    
    const subjectToGroupMap = useMemo(() => {
        const map = new Map<number, SubjectGroup>();
        subjectGroups.forEach(group => {
            const members = groupMembersMap.get(group.id) || [];
            members.forEach(subjectId => {
                map.set(subjectId, group);
            });
        });
        return map;
    }, [subjectGroups, groupMembersMap]);
    
    // Validate selections against group constraints in real-time
    useEffect(() => {
        const validateGroups = async () => {
            if (!studentProfile.class_id || !schoolId || selectedSubjectIds.size === 0) {
                setGroupValidationErrors([]);
                return;
            }
            
            const result = await validateStudentSelections(
                studentProfile.student_record_id,
                studentProfile.class_id,
                schoolId,
                Array.from(selectedSubjectIds)
            );
            
            setGroupValidationErrors(result.errors);
        };
        
        validateGroups();
    }, [selectedSubjectIds, studentProfile, schoolId]);

    const handleToggleSubject = (subjectId: number, isCompulsory: boolean) => {
        if (isCompulsory) return; // Prevent toggling compulsory subjects
        if (isLocked) return; // Prevent toggling when locked

        // Check if subject is at capacity (only for electives being added)
        const capacity = electiveCapacity.get(subjectId);
        const isAdding = !selectedSubjectIds.has(subjectId);
        
        if (isAdding && capacity && capacity.isFull) {
            addToast(`${capacity.subjectName} is at full capacity. Cannot select.`, 'error');
            return;
        }
        
        // Check group constraints
        const group = subjectToGroupMap.get(subjectId);
        if (group && isAdding) {
            // Check if adding this subject would exceed max
            const groupMembers = groupMembersMap.get(group.id) || [];
            const selectedFromGroup = Array.from(selectedSubjectIds).filter(id => groupMembers.includes(id));
            
            if (selectedFromGroup.length >= group.max_selections) {
                addToast(`You can only select ${group.max_selections} subject${group.max_selections > 1 ? 's' : ''} from "${group.group_name}"`, 'error');
                return;
            }
        }

        const newSet = new Set(selectedSubjectIds);
        if (newSet.has(subjectId)) {
            newSet.delete(subjectId);
        } else {
            newSet.add(subjectId);
        }
        setSelectedSubjectIds(newSet);
    };

    const handleSaveChoices = async () => {
        const supabase = requireSupabaseClient();
        
        if (isLocked) {
            addToast('Your choices are locked. Contact your teacher to make changes.', 'error');
            return;
        }
        
        // Validate group constraints before saving
        if (groupValidationErrors.length > 0) {
            addToast('Please fix group selection errors before saving', 'error');
            return;
        }
        
        if (!studentProfile.student_record_id) {
            addToast('Invalid student record.', 'error');
            return;
        }
        
        const count = selectedSubjectIds.size;
        const min = academicClass?.min_subjects || 0;
        const max = academicClass?.max_subjects || 100; // Default high max if not set

        if (count < min) {
            addToast(`You must select at least ${min} subjects. (Current: ${count})`, 'error');
            return;
        }
        if (count > max) {
            addToast(`You cannot select more than ${max} subjects. (Current: ${count})`, 'error');
            return;
        }

        setIsSaving(true);

        // 1. Delete existing choices for this student
        const { error: deleteError } = await supabase
            .from('student_subject_choices')
            .delete()
            .eq('student_id', studentProfile.student_record_id);

        if (deleteError) {
            addToast(`Error clearing old choices: ${deleteError.message}`, 'error');
            setIsSaving(false);
            return;
        }

        // 2. Insert new choices with locked=true (auto-lock on save)
        const newRecords = Array.from(selectedSubjectIds).map(subjectId => ({
            student_id: studentProfile.student_record_id,
            subject_id: subjectId,
            locked: true, // Auto-lock on save
            locked_at: new Date().toISOString(),
            locked_by: null // null means auto-locked by student
        }));

        if (newRecords.length > 0) {
            const { error: insertError } = await supabase
                .from('student_subject_choices')
                .insert(newRecords);
            
            if (insertError) {
                addToast(`Error saving choices: ${insertError.message}`, 'error');
                setIsSaving(false);
                return;
            }
            
            // Lock the choices using service function (redundant but ensures consistency)
            const lockResult = await lockStudentChoices(studentProfile.student_record_id);
            
            if (lockResult.success) {
                addToast('Subjects saved and locked successfully!', 'success');
                setHasSaved(true);
                setIsLocked(true); // Update UI state
                setLockedAt(new Date().toISOString());
                setViewMode('receipt'); // Transition to receipt view
            } else {
                addToast('Subjects saved but failed to lock. Please contact administrator.', 'error');
            }
        } else {
             addToast('Subjects cleared.', 'success');
             setHasSaved(true);
        }

        setIsSaving(false);
    };
    
    // Calculate stats for UI
    const selectionCount = selectedSubjectIds.size;
    const minLimit = academicClass?.min_subjects ?? 0;
    const maxLimit = academicClass?.max_subjects ?? 99;
    const isValid = selectionCount >= minLimit && selectionCount <= maxLimit;
    
    // Count mandatory subjects to inform user
    const compulsoryCount = availableSubjects.filter(s => s.is_compulsory).length;

    if (isLoading) return <div className="flex justify-center p-8"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-6 animate-fade-in p-6">
            <div className="flex justify-between items-center">
                 <div>
                     <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                         <BookOpenIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                         Welcome, {studentProfile.full_name}
                     </h1>
                     <p className="text-slate-600 dark:text-slate-400 mt-1">
                         {studentProfile.class_name} {studentProfile.arm_name && `- ${studentProfile.arm_name}`}
                     </p>
                 </div>
                 <div className="flex items-center gap-3">
                    {toggleTheme && (
                        <button onClick={toggleTheme} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                        </button>
                    )}
                    <button onClick={onLogout} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-sm font-medium">Logout</button>
                 </div>
            </div>

            <div className="border-b border-slate-200 dark:border-slate-700">
                <div className="flex space-x-6">
                    <button 
                        onClick={() => setActiveTab('subjects')} 
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'subjects' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                    >
                        <BookOpenIcon className="w-4 h-4"/> My Subjects
                    </button>
                    <button 
                        onClick={() => setActiveTab('goals')} 
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'goals' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" />
                        </svg>
                        My Goals
                    </button>
                </div>
            </div>

            {activeTab === 'subjects' && (
                <div className="space-y-4 animate-fade-in">
                    {!studentProfile.class_id ? (
                        <div className="p-8 text-center text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                            <p className="font-semibold">Class Not Assigned</p>
                            <p className="text-sm mt-2">You are not assigned to a class yet. Please contact your school administrator.</p>
                        </div>
                    ) : (
                        <>
                            {/* View Mode Toggle - Only show when locked */}
                            {isLocked && (
                                <div className="flex justify-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <button
                                        onClick={() => setViewMode('receipt')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                                            viewMode === 'receipt'
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600'
                                        }`}
                                    >
                                        <ClipboardIcon className="w-4 h-4" />
                                        Receipt View
                                    </button>
                                    <button
                                        onClick={() => setViewMode('selection')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                                            viewMode === 'selection'
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600'
                                        }`}
                                    >
                                        <Squares2x2Icon className="w-4 h-4" />
                                        Subject List View
                                    </button>
                                </div>
                            )}

                            {/* Receipt View */}
                            {isLocked && viewMode === 'receipt' ? (
                                <SubjectSelectionReceipt
                                    studentProfile={studentProfile}
                                    compulsorySubjects={availableSubjects.filter(s => s.is_compulsory && selectedSubjectIds.has(s.subject_id))}
                                    electiveSubjects={availableSubjects.filter(s => !s.is_compulsory && selectedSubjectIds.has(s.subject_id))}
                                    lockedAt={lockedAt}
                                    termName="First Term" // TODO: Get from active term
                                    sessionLabel="2024/2025" // TODO: Get from session
                                    onRequestChange={() => {
                                        addToast('To request changes, please contact your class teacher or school administrator.', 'info');
                                    }}
                                />
                            ) : (
                                <>
                                    {/* Lock Status Banner */}
                                    {isLocked && (
                                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-3">
                                            <LockClosedIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                            <div>
                                                <p className="font-semibold text-amber-800 dark:text-amber-100">🔒 Your subject selections are locked</p>
                                                <p className="text-sm text-amber-700 dark:text-amber-300">Contact your class teacher or admin to request changes to your subject choices.</p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {hasSaved && !isLocked && (
                                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-3">
                                            <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                                            <div>
                                                <p className="font-semibold text-green-800 dark:text-green-100">Selections Saved</p>
                                                <p className="text-sm text-green-700 dark:text-green-300">Your subject choices have been saved successfully.</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                                        <div>
                                            <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Subject Selection</h2>
                                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                                {isLocked ? 'Your selections are locked. Contact admin to make changes.' : 'Select the subjects you are taking this term.'}
                                                {!isLocked && minLimit > 0 && ` Minimum: ${minLimit}.`} 
                                                {!isLocked && maxLimit < 99 && ` Maximum: ${maxLimit}.`}
                                            </p>
                                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                                * {compulsoryCount} subjects are compulsory and cannot be removed.
                                            </p>
                                            <p className={`text-sm font-bold mt-1 ${isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                Total Selected: {selectionCount}
                                            </p>
                                        </div>
                                {!isLocked && (
                                    <button 
                                        onClick={handleSaveChoices} 
                                        disabled={isSaving} 
                                        className={`px-6 py-2 rounded-lg font-semibold text-white transition-colors flex items-center gap-2 shadow-md ${isValid ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-400 cursor-not-allowed'}`}
                                    >
                                        {isSaving ? <Spinner size="sm" /> : <><CheckCircleIcon className="w-5 h-5" /> Save Choices</>}
                                    </button>
                                )}
                            </div>

                            {/* Render subjects organized by groups */}
                            <div className="space-y-6">
                                {/* Render each subject group */}
                                {subjectGroups.map(group => {
                                    const groupMembers = groupMembersMap.get(group.id) || [];
                                    const groupSubjects = availableSubjects.filter(s => groupMembers.includes(s.subject_id));
                                    const selectedFromGroup = Array.from(selectedSubjectIds).filter(id => groupMembers.includes(id));
                                    
                                    if (groupSubjects.length === 0) return null;
                                    
                                    return (
                                        <div key={group.id} className="space-y-3">
                                            <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 px-4 py-3 rounded-lg border border-purple-200 dark:border-purple-800">
                                                <div>
                                                    <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                                                        📦 {group.group_name}
                                                    </h3>
                                                    <p className="text-sm text-purple-700 dark:text-purple-300">
                                                        Select {group.min_selections === group.max_selections 
                                                            ? `${group.max_selections}`
                                                            : `${group.min_selections}-${group.max_selections}`
                                                        } subject{group.max_selections > 1 ? 's' : ''} from this group
                                                    </p>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                    selectedFromGroup.length >= group.min_selections && selectedFromGroup.length <= group.max_selections
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-100'
                                                }`}>
                                                    {selectedFromGroup.length}/{group.max_selections} selected
                                                </span>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {groupSubjects.map(sub => {
                                                    const isSelected = selectedSubjectIds.has(sub.subject_id);
                                                    const isCompulsory = sub.is_compulsory;
                                                    const capacity = electiveCapacity.get(sub.subject_id);
                                                    const isFull = !isCompulsory && capacity && capacity.isFull && !isSelected;
                                                    const isDisabled = isCompulsory || isLocked || isFull;
                                                    
                                                    return (
                                                        <div 
                                                            key={sub.subject_id} 
                                                            onClick={() => !isDisabled && handleToggleSubject(sub.subject_id, isCompulsory)}
                                                            className={`p-4 border rounded-lg transition-all shadow-sm flex items-start justify-between 
                                                                ${isDisabled 
                                                                    ? 'cursor-not-allowed opacity-75' 
                                                                    : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700'
                                                                }
                                                                ${isCompulsory 
                                                                    ? 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-600' 
                                                                    : ''
                                                                }
                                                                ${isFull 
                                                                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800' 
                                                                    : ''
                                                                }
                                                                ${isSelected && !isCompulsory && !isFull ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 ring-1 ring-purple-500' : ''}
                                                                ${!isCompulsory && !isFull && !isSelected ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' : ''}
                                                            `}
                                                        >
                                                            <div className="flex flex-col flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className={`font-semibold ${isSelected ? 'text-purple-800 dark:text-purple-100' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                        {sub.subject_name}
                                                                    </p>
                                                                    {isFull && (
                                                                        <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold uppercase rounded">Full</span>
                                                                    )}
                                                                </div>
                                                                {isCompulsory && <span className="text-[10px] font-bold uppercase text-slate-500 mt-1">Compulsory</span>}
                                                                {!isCompulsory && capacity && capacity.maxStudents !== null && (
                                                                    <span className={`text-xs mt-1 ${capacity.isFull ? 'text-red-600 dark:text-red-400 font-bold' : 'text-purple-600 dark:text-purple-400'}`}>
                                                                        {capacity.currentEnrollment}/{capacity.maxStudents} enrolled
                                                                    </span>
                                                                )}
                                                            </div>
                                                            
                                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-300 dark:border-slate-500'} ${isCompulsory ? 'bg-slate-500 border-slate-500' : ''} ${isFull ? 'bg-red-600 border-red-600' : ''}`}>
                                                                {isSelected && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                                
                                {/* Render ungrouped subjects */}
                                {(() => {
                                    const groupedSubjectIds = new Set(
                                        subjectGroupMembers.map(m => m.subject_id)
                                    );
                                    const ungroupedSubjects = availableSubjects.filter(
                                        s => !groupedSubjectIds.has(s.subject_id)
                                    );
                                    
                                    if (ungroupedSubjects.length === 0) return null;
                                    
                                    return (
                                        <div className="space-y-3">
                                            {ungroupedSubjects.length > 0 && subjectGroups.length > 0 && (
                                                <h3 className="font-semibold text-slate-900 dark:text-white px-2">
                                                    Other Subjects
                                                </h3>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {ungroupedSubjects.map(sub => {
                                    const isSelected = selectedSubjectIds.has(sub.subject_id);
                                    const isCompulsory = sub.is_compulsory;
                                    const capacity = electiveCapacity.get(sub.subject_id);
                                    const isFull = !isCompulsory && capacity && capacity.isFull && !isSelected;
                                    const isDisabled = isCompulsory || isLocked || isFull;
                                    
                                    return (
                                        <div 
                                            key={sub.subject_id} 
                                            onClick={() => !isDisabled && handleToggleSubject(sub.subject_id, isCompulsory)}
                                            className={`p-4 border rounded-lg transition-all shadow-sm flex items-start justify-between 
                                                ${isDisabled 
                                                    ? 'cursor-not-allowed opacity-75' 
                                                    : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700'
                                                }
                                                ${isCompulsory 
                                                    ? 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-600' 
                                                    : ''
                                                }
                                                ${isFull 
                                                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800' 
                                                    : ''
                                                }
                                                ${isSelected && !isCompulsory && !isFull ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 ring-1 ring-blue-500' : ''}
                                                ${!isCompulsory && !isFull && !isSelected ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' : ''}
                                            `}
                                        >
                                            <div className="flex flex-col flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className={`font-semibold ${isSelected ? 'text-blue-800 dark:text-blue-100' : 'text-slate-700 dark:text-slate-200'}`}>
                                                        {sub.subject_name}
                                                    </p>
                                                    {isFull && (
                                                        <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold uppercase rounded">Full</span>
                                                    )}
                                                </div>
                                                {isCompulsory && <span className="text-[10px] font-bold uppercase text-slate-500 mt-1">Compulsory</span>}
                                                {!isCompulsory && capacity && capacity.maxStudents !== null && (
                                                    <span className={`text-xs mt-1 ${capacity.isFull ? 'text-red-600 dark:text-red-400 font-bold' : 'text-blue-600 dark:text-blue-400'}`}>
                                                        {capacity.currentEnrollment}/{capacity.maxStudents} enrolled
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-500'} ${isCompulsory ? 'bg-slate-500 border-slate-500' : ''} ${isFull ? 'bg-red-600 border-red-600' : ''}`}>
                                                {isCompulsory || isLocked ? (
                                                    <LockClosedIcon className="w-3 h-3 text-white" />
                                                ) : isFull ? (
                                                    <span className="text-white text-xs font-bold">✕</span>
                                                ) : isSelected && (
                                                    <CheckCircleIcon className="w-4 h-4 text-white" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}

            {activeTab === 'goals' && (
                <div className="animate-fade-in">
                    {activeTermId && schoolId && studentProfile.student_record_id ? (
                        <StudentAcademicGoalEditor
                            studentId={studentProfile.student_record_id}
                            termId={activeTermId}
                            schoolId={schoolId}
                            addToast={addToast}
                        />
                    ) : (
                        <div className="p-8 text-center text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl border border-dashed">
                            Unable to load goals. Please ensure you are enrolled in an active term.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StudentPortal;
