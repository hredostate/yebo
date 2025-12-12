
import React, { useState, useMemo } from 'react';
import type { AcademicTeachingAssignment, AcademicClassStudent, ScoreEntry, UserProfile, Student, StudentTermReport, GradingScheme, SchoolConfig, AcademicClass } from '../types';
import Spinner from './common/Spinner';
import { LockClosedIcon, CheckCircleIcon, WandIcon, GlobeIcon, UsersIcon, PaintBrushIcon, SearchIcon, DownloadIcon, RefreshIcon } from './common/icons';
import { aiClient } from '../services/aiClient';
import { textFromGemini } from '../utils/ai';
import { supa as supabase } from '../offline/client';
import LevelStatisticsDashboard from './LevelStatisticsDashboard';

type ViewMode = 'by-class' | 'by-subject' | 'statistics';

interface ResultManagerProps {
    terms: any[];
    academicAssignments: AcademicTeachingAssignment[];
    academicClassStudents: AcademicClassStudent[];
    academicClasses: AcademicClass[];
    scoreEntries: ScoreEntry[];
    users: UserProfile[];
    onLockScores: (assignmentId: number) => Promise<boolean>;
    onResetSubmission: (assignmentId: number) => Promise<boolean>;
    userPermissions: string[];
    students: Student[];
    studentTermReports: StudentTermReport[];
    studentTermReportSubjects: any[];
    gradingSchemes: GradingScheme[];
    schoolConfig: SchoolConfig | null;
    onUpdateComments: (reportId: number, teacherComment: string, principalComment: string) => Promise<void>;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ResultManager: React.FC<ResultManagerProps> = ({ 
    terms, academicAssignments, academicClassStudents, academicClasses, scoreEntries, users, onLockScores, onResetSubmission, userPermissions, 
    students, studentTermReports, studentTermReportSubjects, gradingSchemes, schoolConfig, onUpdateComments, addToast 
}) => {
    const [selectedTermId, setSelectedTermId] = useState<number | ''>('');
    const [isProcessing, setIsProcessing] = useState<number | null>(null); // assignment ID
    const [isGeneratingComments, setIsGeneratingComments] = useState<number | null>(null); // assignment ID or report ID
    const [isPublishing, setIsPublishing] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('by-class');
    const [publishingClassId, setPublishingClassId] = useState<number | null>(null);
    const [showDesignPicker, setShowDesignPicker] = useState(false);
    const [selectedResultSheet, setSelectedResultSheet] = useState<string>('default');
    const [searchQuery, setSearchQuery] = useState('');
    const [showBulkGenerator, setShowBulkGenerator] = useState(false);
    const [selectedClassForBulk, setSelectedClassForBulk] = useState<{ id: number; name: string } | null>(null);
    
    // Result sheet design options
    const resultSheetOptions = [
        { id: 'default', name: 'Default', description: 'Standard result sheet layout' },
        { id: 'compact', name: 'Compact', description: 'Space-efficient layout' },
        { id: 'detailed', name: 'Detailed', description: 'Comprehensive view with extra details' }
    ];

    const assignmentsForTerm = useMemo(() => {
        if (!selectedTermId) return [];
        let filtered = academicAssignments.filter(a => a.term_id === selectedTermId);
        
        // Apply search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(a => 
                a.academic_class?.name.toLowerCase().includes(q) ||
                a.subject_name.toLowerCase().includes(q) ||
                a.teacher?.name.toLowerCase().includes(q)
            );
        }
        
        return filtered;
    }, [selectedTermId, academicAssignments, searchQuery]);

    // Group assignments by class for class-level view
    const classesByTerm = useMemo(() => {
        if (!selectedTermId) return [];
        const classMap = new Map<number, {
            id: number;
            name: string;
            assignments: AcademicTeachingAssignment[];
            totalAssignments: number;
            lockedAssignments: number;
            submittedAssignments: number;
            studentCount: number;
            isFullyLocked: boolean;
            reportsCount: number;
            publishedCount: number;
        }>();

        assignmentsForTerm.forEach(a => {
            if (!a.academic_class) return;
            const classId = a.academic_class_id;
            if (!classMap.has(classId)) {
                const studentsInClass = academicClassStudents.filter(acs => acs.academic_class_id === classId);
                const reportsForClass = studentTermReports.filter(r => 
                    r.term_id === selectedTermId && 
                    studentsInClass.some(s => s.student_id === r.student_id)
                );
                classMap.set(classId, {
                    id: classId,
                    name: a.academic_class.name,
                    assignments: [],
                    totalAssignments: 0,
                    lockedAssignments: 0,
                    submittedAssignments: 0,
                    studentCount: studentsInClass.length,
                    isFullyLocked: false,
                    reportsCount: reportsForClass.length,
                    publishedCount: reportsForClass.filter(r => r.is_published).length,
                });
            }
            const classData = classMap.get(classId)!;
            classData.assignments.push(a);
            classData.totalAssignments++;
            if (a.is_locked) classData.lockedAssignments++;
            if (a.submitted_at) classData.submittedAssignments++;
        });

        // Mark classes as fully locked if all assignments are locked
        classMap.forEach(c => {
            c.isFullyLocked = c.totalAssignments > 0 && c.lockedAssignments === c.totalAssignments;
        });

        let classes = Array.from(classMap.values());
        
        // Apply search filter for class names
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            classes = classes.filter(c => c.name.toLowerCase().includes(q));
        }
        
        return classes.sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedTermId, assignmentsForTerm, academicClassStudents, studentTermReports, searchQuery]);
    
    const getGradingSchemeForAssignment = (assignment: AcademicTeachingAssignment) => {
        // 1. Try Class Specific
        const classSchemeId = assignment.academic_class?.grading_scheme_id;
        if (classSchemeId) {
            const scheme = gradingSchemes.find(gs => gs.id === classSchemeId);
            if (scheme) return scheme;
        }
        // 2. Fallback to School Default
        if (schoolConfig?.active_grading_scheme_id) {
            return gradingSchemes.find(gs => gs.id === schoolConfig.active_grading_scheme_id);
        }
        return null;
    };

    const canLock = userPermissions.includes('results.lock_and_publish') || userPermissions.includes('*');

    // Publish results for an entire class
    const handlePublishClass = async (classId: number, className: string) => {
        if (!canLock || !selectedTermId) return;
        
        if (!window.confirm(`Are you sure you want to PUBLISH all results for ${className}? Students will be able to see their reports immediately.`)) return;

        setPublishingClassId(classId);
        try {
            // Get all students in this class
            const studentsInClass = academicClassStudents.filter(acs => acs.academic_class_id === classId);
            const studentIds = studentsInClass.map(s => s.student_id);

            if (studentIds.length === 0) {
                addToast('No students found in this class.', 'error');
                return;
            }

            // Update all student_term_reports for this class and term
            const { error } = await supabase
                .from('student_term_reports')
                .update({ is_published: true })
                .eq('term_id', selectedTermId)
                .in('student_id', studentIds);
            
            if (error) throw error;
            
            addToast(`Results for ${className} published successfully!`, 'success');
        } catch (e: any) {
            addToast(`Publish failed: ${e.message}`, 'error');
        } finally {
            setPublishingClassId(null);
        }
    };

    // Lock all subjects for an entire class
    const handleLockClass = async (classId: number, className: string) => {
        if (!canLock) return;
        
        const classAssignments = assignmentsForTerm.filter(a => a.academic_class_id === classId && !a.is_locked);
        
        if (classAssignments.length === 0) {
            addToast('All subjects for this class are already locked.', 'info');
            return;
        }

        if (!window.confirm(`Lock all ${classAssignments.length} subject(s) for ${className}? This will finalize all scores and cannot be easily undone.`)) return;

        setPublishingClassId(classId);
        try {
            for (const assignment of classAssignments) {
                await onLockScores(assignment.id);
            }
            addToast(`All subjects for ${className} have been locked.`, 'success');
        } catch (e: any) {
            addToast(`Lock failed: ${e.message}`, 'error');
        } finally {
            setPublishingClassId(null);
        }
    };

    const handleLock = async (assignmentId: number) => {
        if (!canLock) return;
        if (window.confirm("Locking scores will publish them to student report cards. This cannot be easily undone. Continue?")) {
            setIsProcessing(assignmentId);
            await onLockScores(assignmentId);
            setIsProcessing(null);
        }
    };
    
    const handleReset = async (assignmentId: number) => {
        if (!canLock) return;
        
        const assignment = assignmentsForTerm.find(a => a.id === assignmentId);
        if (!assignment) return;
        
        // First confirmation
        const resetConfirmed = window.confirm(
            "Are you sure you want to reset this submission? The teacher will be able to edit and re-submit scores."
        );
        
        if (!resetConfirmed) return;
        
        setIsProcessing(assignmentId);
        await onResetSubmission(assignmentId);
        setIsProcessing(null);
    };
    
    // Generate Subject Teacher Comments
    const handleGenerateComments = async (assignment: AcademicTeachingAssignment) => {
        const activeGradingScheme = getGradingSchemeForAssignment(assignment);

        if (!activeGradingScheme) {
            addToast('Cannot generate comments: No active grading scheme found for this class or school.', 'error');
            return;
        }
        setIsGeneratingComments(assignment.id);
        addToast(`Generating comments for ${assignment.academic_class?.name} - ${assignment.subject_name}...`, 'info');
        
        try {
            if (!aiClient) throw new Error("AI Client not ready");
            
            // Find scores for this assignment
            const relevantScores = scoreEntries.filter(s => 
                s.term_id === assignment.term_id && 
                s.academic_class_id === assignment.academic_class_id && 
                s.subject_name === assignment.subject_name
            );
            
            // Prepare context for AI
            const scoresContext = relevantScores.map(s => {
                const student = students.find(st => st.id === s.student_id);
                return {
                    studentName: student?.name,
                    score: s.total_score,
                    grade: s.grade_label // Changed from 'grade' to 'grade_label'
                };
            });

            // Mock implementation for now as bulk update logic would be complex here
            await new Promise(resolve => setTimeout(resolve, 1500));
            addToast("AI Comment generation logic would run here. In production, this iterates through scores and updates the DB.", "info");

        } catch (e: any) {
            addToast(`Error generating comments: ${e.message}`, 'error');
        } finally {
            setIsGeneratingComments(null);
        }
    };

    // Publish Reports for a Term
    const handlePublishTerm = async () => {
        if (!selectedTermId) return;
        if (!window.confirm("Are you sure you want to PUBLISH results for this term? Students will be able to see their reports immediately.")) return;

        setIsPublishing(true);
        try {
            const { error } = await supabase
                .from('student_term_reports')
                .update({ is_published: true })
                .eq('term_id', selectedTermId);
            
            if (error) throw error;
            addToast("Results published successfully!", "success");
        } catch (e: any) {
            addToast(`Publish failed: ${e.message}`, "error");
        } finally {
            setIsPublishing(false);
        }
    };

    const handleGeneratePrincipalComments = async () => {
        if (!selectedTermId) return;
        setIsGeneratingComments(9999); // Using a dummy ID for loading state
        addToast("Generating Principal's remarks based on overall performance...", "info");

        try {
            if (!aiClient) throw new Error("AI Client not ready");

            // 1. Fetch all report summaries for this term
            // We rely on studentTermReports prop which should be pre-fetched
            const reportsToProcess = studentTermReports.filter(r => r.term_id === selectedTermId);

            if (reportsToProcess.length === 0) {
                throw new Error("No reports found for this term to comment on.");
            }

            // Process in batches to avoid token limits? For MVP, let's do a small sample or just structure the logic.
            // We will simulate the batching for now.
            
            // Example logic for ONE report:
            /*
            const report = reportsToProcess[0];
            const student = students.find(s => s.id === report.student_id);
            const prompt = `Generate a formal, encouraging Principal's remark for ${student?.name}. 
            Average: ${report.average_score}%. Position: ${report.position_in_class}.
            Tone: Professional, inspiring. Max 20 words.`;
            */

            // Mocking the update
            await new Promise(resolve => setTimeout(resolve, 2000));
            addToast("Principal comments generated and saved. (Simulated)", "success");

        } catch (e: any) {
            addToast(`Error: ${e.message}`, "error");
        } finally {
            setIsGeneratingComments(null);
        }
    };

    const handleOpenBulkGenerator = (classId: number, className: string) => {
        setSelectedClassForBulk({ id: classId, name: className });
        setShowBulkGenerator(true);
    };

    const handleCloseBulkGenerator = () => {
        setShowBulkGenerator(false);
        setSelectedClassForBulk(null);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Result Manager</h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">Review, approve, and publish academic results by class.</p>
            </div>

            <div className="p-4 rounded-xl border bg-white/60 dark:bg-slate-900/40 flex flex-wrap items-center gap-4 justify-between">
                <div className="flex flex-wrap gap-4 flex-1">
                    <div className="flex-1 min-w-[250px]">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select Term to Manage</label>
                        <select 
                            value={selectedTermId} 
                            onChange={e => setSelectedTermId(e.target.value ? Number(e.target.value) : '')} 
                            className="w-full p-2 rounded-md bg-transparent border border-slate-300 dark:border-slate-700"
                        >
                            <option value="">-- Select Term --</option>
                            {terms.map(t => <option key={t.id} value={t.id}>{t.session_label} - {t.term_label}</option>)}
                        </select>
                    </div>
                    {selectedTermId && (
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Search</label>
                            <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)} 
                                    placeholder="Search class, subject, or teacher..." 
                                    className="w-full pl-9 p-2 rounded-md bg-transparent border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>
                {selectedTermId && (
                    <div className="flex gap-3 flex-wrap">
                        {/* View Mode Toggle */}
                        <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('by-class')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition ${viewMode === 'by-class' ? 'bg-white dark:bg-slate-600 shadow' : ''}`}
                            >
                                By Class
                            </button>
                            <button
                                onClick={() => setViewMode('by-subject')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition ${viewMode === 'by-subject' ? 'bg-white dark:bg-slate-600 shadow' : ''}`}
                            >
                                By Subject
                            </button>
                            <button
                                onClick={() => setViewMode('statistics')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition ${viewMode === 'statistics' ? 'bg-white dark:bg-slate-600 shadow' : ''}`}
                            >
                                Statistics
                            </button>
                        </div>
                        {/* Result Sheet Design Selector */}
                        <div className="relative">
                            <button 
                                onClick={() => setShowDesignPicker(!showDesignPicker)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
                            >
                                <PaintBrushIcon className="w-5 h-5" />
                                Result Sheet Design
                            </button>
                            {showDesignPicker && (
                                <div className="absolute top-full mt-2 right-0 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 p-2">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 px-2 py-1 mb-1">Select Result Sheet Design:</p>
                                    {resultSheetOptions.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => { setSelectedResultSheet(opt.id); setShowDesignPicker(false); addToast(`Result sheet design changed to "${opt.name}"`, 'success'); }}
                                            className={`w-full text-left p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition ${selectedResultSheet === opt.id ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700' : ''}`}
                                        >
                                            <p className="font-medium text-sm">{opt.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{opt.description}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={handleGeneratePrincipalComments} 
                            disabled={!!isGeneratingComments}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-purple-400"
                        >
                            {isGeneratingComments === 9999 ? <Spinner size="sm"/> : <WandIcon className="w-5 h-5" />}
                            Gen. Principal Comments
                        </button>
                        <button 
                            onClick={handlePublishTerm} 
                            disabled={isPublishing}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-green-400"
                        >
                            {isPublishing ? <Spinner size="sm"/> : <GlobeIcon className="w-5 h-5" />}
                            Publish All Results
                        </button>
                    </div>
                )}
            </div>

            {selectedTermId && viewMode === 'by-class' && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2"><UsersIcon className="w-6 h-6" /> Publish Results by Class</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Select a class to lock scores and publish complete results for all students.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {classesByTerm.map(c => (
                            <div key={c.id} className="rounded-xl border bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-md transition">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="text-lg font-bold">{c.name}</h3>
                                        <p className="text-xs text-slate-500">{c.studentCount} students</p>
                                    </div>
                                    {c.isFullyLocked ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold">
                                            <LockClosedIcon className="w-3 h-3"/> All Locked
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold">
                                            {c.lockedAssignments}/{c.totalAssignments} Locked
                                        </span>
                                    )}
                                </div>
                                
                                <div className="space-y-2 text-sm mb-4">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Subjects:</span>
                                        <span className="font-medium">{c.totalAssignments}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Submitted:</span>
                                        <span className="font-medium text-blue-600">{c.submittedAssignments}/{c.totalAssignments}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Reports Ready:</span>
                                        <span className="font-medium">{c.reportsCount}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Published:</span>
                                        <span className={`font-medium ${c.publishedCount === c.reportsCount && c.reportsCount > 0 ? 'text-green-600' : ''}`}>
                                            {c.publishedCount}/{c.reportsCount}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Progress bar */}
                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-4">
                                    <div 
                                        className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
                                        style={{ width: `${c.totalAssignments > 0 ? (c.lockedAssignments / c.totalAssignments) * 100 : 0}%` }}
                                    />
                                </div>
                                
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        {canLock && !c.isFullyLocked && (
                                            <button
                                                onClick={() => handleLockClass(c.id, c.name)}
                                                disabled={publishingClassId === c.id}
                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50"
                                            >
                                                {publishingClassId === c.id ? <Spinner size="sm" /> : <LockClosedIcon className="w-4 h-4" />}
                                                Lock All Scores
                                            </button>
                                        )}
                                        {canLock && (
                                            <button
                                                onClick={() => handlePublishClass(c.id, c.name)}
                                                disabled={publishingClassId === c.id || c.reportsCount === 0}
                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
                                            >
                                                {publishingClassId === c.id ? <Spinner size="sm" /> : <GlobeIcon className="w-4 h-4" />}
                                                Publish Class
                                            </button>
                                        )}
                                    </div>
                                    {/* Generate Report Cards Button */}
                                    <button
                                        onClick={() => handleOpenBulkGenerator(c.id, c.name)}
                                        disabled={c.reportsCount === 0}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={c.reportsCount === 0 ? "No reports available for this class" : "Generate report cards for this class"}
                                    >
                                        <DownloadIcon className="w-4 h-4" />
                                        Generate Report Cards
                                    </button>
                                </div>
                            </div>
                        ))}
                        {classesByTerm.length === 0 && (
                            <div className="col-span-full text-center p-10 rounded-xl border bg-white/60">
                                <p className="text-slate-500">No classes found for this term.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {selectedTermId && viewMode === 'by-subject' && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold">Teaching Assignments Status</h2>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="p-3">Class</th>
                                    <th className="p-3">Subject</th>
                                    <th className="p-3">Teacher</th>
                                    <th className="p-3 text-center">Status</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                {assignmentsForTerm.map(as => (
                                    <tr key={as.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="p-3">{as.academic_class?.name}</td>
                                        <td className="p-3">{as.subject_name}</td>
                                        <td className="p-3">{as.teacher?.name}</td>
                                        <td className="p-3 text-center">
                                            {as.is_locked ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold">
                                                    <LockClosedIcon className="w-3 h-3"/> Locked
                                                </span>
                                            ) : as.submitted_at ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                                                    <CheckCircleIcon className="w-3 h-3"/> Submitted
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold">
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right flex justify-end gap-2">
                                            {!as.is_locked && (
                                                <button 
                                                    onClick={() => handleGenerateComments(as)} 
                                                    disabled={!!isGeneratingComments}
                                                    className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 disabled:opacity-50 flex items-center gap-1"
                                                    title="Generate AI Comments for Students"
                                                >
                                                    {isGeneratingComments === as.id ? <Spinner size="sm"/> : <WandIcon className="w-3 h-3"/>} AI Comments
                                                </button>
                                            )}
                                            {canLock && as.submitted_at !== null && (
                                                <button 
                                                    onClick={() => handleReset(as.id)} 
                                                    disabled={isProcessing === as.id}
                                                    className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200 disabled:opacity-50 flex items-center gap-1"
                                                    title="Reset submission to allow teacher to re-enter scores"
                                                >
                                                    {isProcessing === as.id ? <Spinner size="sm"/> : <RefreshIcon className="w-3 h-3"/>} Reset
                                                </button>
                                            )}
                                            {canLock && !as.is_locked && (
                                                <button 
                                                    onClick={() => handleLock(as.id)} 
                                                    disabled={isProcessing === as.id}
                                                    className="text-xs bg-slate-800 text-white px-3 py-1 rounded hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    {isProcessing === as.id ? <Spinner size="sm"/> : 'Lock'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {assignmentsForTerm.length === 0 && (
                                    <tr><td colSpan={5} className="p-4 text-center text-slate-500">No assignments found for this term.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedTermId && viewMode === 'statistics' && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold">Level Statistics & Rankings</h2>
                    <LevelStatisticsDashboard
                        termId={Number(selectedTermId)}
                        studentTermReports={studentTermReports}
                        students={students}
                        academicClasses={academicClasses}
                        academicClassStudents={academicClassStudents}
                        gradingScheme={schoolConfig?.active_grading_scheme_id 
                            ? gradingSchemes.find(gs => gs.id === schoolConfig.active_grading_scheme_id) || null
                            : null
                        }
                    />
                </div>
            )}
        </div>
    );
};

export default ResultManager;
