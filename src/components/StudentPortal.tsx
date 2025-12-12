
import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { supabase } from '../services/supabaseClient';
import type { StudentProfile, AcademicClass } from '../types';
import Spinner from './common/Spinner';
import { SunIcon, MoonIcon, BookOpenIcon, ClockIcon, CheckCircleIcon, LockClosedIcon } from './common/icons';
import StudentWalletWidget from './StudentWalletWidget';

// Lazy load TimetableView to avoid chunking warnings
const TimetableView = React.lazy(() => import('./TimetableView'));

interface StudentPortalProps {
    studentProfile: StudentProfile;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    onLogout: () => void;
    isDarkMode?: boolean;
    toggleTheme?: () => void;
}

const StudentPortal: React.FC<StudentPortalProps> = ({ studentProfile, addToast, onLogout, isDarkMode, toggleTheme }) => {
    const [activeTab, setActiveTab] = useState<'subjects' | 'timetable' | 'wallet'>('subjects');
    const [availableSubjects, setAvailableSubjects] = useState<{subject_id: number, subject_name: string, is_compulsory: boolean}[]>([]);
    const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [academicClass, setAcademicClass] = useState<AcademicClass | null>(null);
    const [hasSaved, setHasSaved] = useState(false);

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
            const { data: activeTerms } = await supabase.from('terms').select('id').eq('is_active', true).limit(1);
            const activeTermId = activeTerms?.[0]?.id;
            
            let currentAcademicClass: AcademicClass | null = null;

            if (activeTermId && studentProfile.student_record_id) {
                 const { data: enrollment } = await supabase
                    .from('academic_class_students')
                    .select('academic_class_id, academic_class:academic_classes(*)')
                    .eq('student_id', studentProfile.student_record_id)
                    .eq('enrolled_term_id', activeTermId)
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

            // 3. Fetch existing choices & Merge Compulsory
            const { data: choices, error: choicesError } = await supabase
                .from('student_subject_choices')
                .select('subject_id')
                .eq('student_id', studentProfile.student_record_id);
            
            if (choicesError) {
                console.error(choicesError);
                addToast('Error fetching your choices.', 'error');
            } else {
                const existingIds = (choices || []).map((c: any) => Number(c.subject_id));
                // Automatically include compulsory subjects in the selection state
                const compulsoryIds = fetchedSubjects.filter(s => s.is_compulsory).map(s => s.subject_id);
                const combinedIds = new Set<number>([...existingIds, ...compulsoryIds]);
                
                setSelectedSubjectIds(combinedIds);
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

    const handleToggleSubject = (subjectId: number, isCompulsory: boolean) => {
        if (isCompulsory) return; // Prevent toggling compulsory subjects

        const newSet = new Set(selectedSubjectIds);
        if (newSet.has(subjectId)) {
            newSet.delete(subjectId);
        } else {
            newSet.add(subjectId);
        }
        setSelectedSubjectIds(newSet);
    };

    const handleSaveChoices = async () => {
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

        // 2. Insert new choices
        const newRecords = Array.from(selectedSubjectIds).map(subjectId => ({
            student_id: studentProfile.student_record_id,
            subject_id: subjectId,
            locked: false // Default unlocked
        }));

        if (newRecords.length > 0) {
            const { error: insertError } = await supabase
                .from('student_subject_choices')
                .insert(newRecords);
            
            if (insertError) {
                addToast(`Error saving choices: ${insertError.message}`, 'error');
            } else {
                addToast('Subjects saved successfully!', 'success');
                setHasSaved(true); // Mark as saved
            }
        } else {
             addToast('Subjects cleared.', 'success');
             setHasSaved(true); // Mark as saved
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
                 <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Student Portal</h1>
                 <div className="flex items-center gap-3">
                    {toggleTheme && (
                        <button onClick={toggleTheme} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                        </button>
                    )}
                    <button onClick={onLogout} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-sm font-medium">Logout</button>
                 </div>
            </div>

            <div className="border-b border-slate-200 dark:border-slate-700">
                <div className="flex space-x-6">
                    <button 
                        onClick={() => setActiveTab('subjects')} 
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'subjects' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <BookOpenIcon className="w-4 h-4"/> My Subjects
                    </button>
                    <button 
                        onClick={() => setActiveTab('timetable')} 
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'timetable' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <ClockIcon className="w-4 h-4"/> Timetable
                    </button>
                    <button 
                        onClick={() => setActiveTab('wallet')} 
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'wallet' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
                            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/>
                        </svg>
                        My Wallet
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
                            {hasSaved && (
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
                                        Select the subjects you are taking this term.
                                        {minLimit > 0 && ` Minimum: ${minLimit}.`} 
                                        {maxLimit < 99 && ` Maximum: ${maxLimit}.`}
                                    </p>
                                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                        * {compulsoryCount} subjects are compulsory and cannot be removed.
                                    </p>
                                    <p className={`text-sm font-bold mt-1 ${isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        Total Selected: {selectionCount}
                                    </p>
                                </div>
                                <button 
                                    onClick={handleSaveChoices} 
                                    disabled={isSaving} 
                                    className={`px-6 py-2 rounded-lg font-semibold text-white transition-colors flex items-center gap-2 shadow-md ${isValid ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-400 cursor-not-allowed'}`}
                                >
                                    {isSaving ? <Spinner size="sm" /> : <><CheckCircleIcon className="w-5 h-5" /> Save Choices</>}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {availableSubjects.length > 0 ? availableSubjects.map(sub => {
                                    const isSelected = selectedSubjectIds.has(sub.subject_id);
                                    const isCompulsory = sub.is_compulsory;
                                    
                                    return (
                                        <div 
                                            key={sub.subject_id} 
                                            onClick={() => handleToggleSubject(sub.subject_id, isCompulsory)}
                                            className={`p-4 border rounded-lg transition-all shadow-sm flex items-center justify-between 
                                                ${isCompulsory 
                                                    ? 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-600 cursor-not-allowed opacity-90' 
                                                    : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700'
                                                }
                                                ${isSelected && !isCompulsory ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 ring-1 ring-blue-500' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}
                                            `}
                                        >
                                            <div className="flex flex-col">
                                                <p className={`font-semibold ${isSelected ? 'text-blue-800 dark:text-blue-100' : 'text-slate-700 dark:text-slate-200'}`}>
                                                    {sub.subject_name}
                                                </p>
                                                {isCompulsory && <span className="text-[10px] font-bold uppercase text-slate-500">Compulsory</span>}
                                            </div>
                                            
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-500'} ${isCompulsory ? 'bg-slate-500 border-slate-500' : ''}`}>
                                                {isCompulsory ? (
                                                    <LockClosedIcon className="w-3 h-3 text-white" />
                                                ) : isSelected && (
                                                    <CheckCircleIcon className="w-4 h-4 text-white" />
                                                )}
                                            </div>
                                        </div>
                                    )
                                }) : (
                                    <div className="col-span-full p-8 text-center text-slate-500 border-2 border-dashed rounded-xl">
                                        No subjects available for selection. Please contact your administrator.
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === 'timetable' && (
                <div className="animate-fade-in">
                     {academicClass ? (
                        <Suspense fallback={<div className="flex justify-center p-8"><Spinner size="lg" /></div>}>
                            <TimetableView 
                                addToast={addToast} 
                                studentViewClassId={academicClass.id}
                            />
                        </Suspense>
                     ) : (
                        <div className="p-8 text-center text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl border border-dashed">
                            You are not currently enrolled in an active academic class for this term. Please contact your administrator.
                        </div>
                     )}
                </div>
            )}

            {activeTab === 'wallet' && studentProfile.student_record_id && (
                <div className="animate-fade-in">
                    <StudentWalletWidget studentRecordId={studentProfile.student_record_id} />
                </div>
            )}
        </div>
    );
};

export default StudentPortal;
