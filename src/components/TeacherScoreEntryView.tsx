
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { AcademicTeachingAssignment, Student, AcademicClassStudent, ScoreEntry, GradingScheme, SchoolConfig, AssessmentComponent, StudentSubjectEnrollment } from '../types';
import Spinner from './common/Spinner';
import { DownloadIcon, UploadCloudIcon } from './common/icons';
import { mapSupabaseError } from '../utils/errorHandling';

interface TeacherScoreEntryViewProps {
    assignmentId: number;
    academicAssignments: AcademicTeachingAssignment[];
    academicClassStudents: AcademicClassStudent[];
    students: Student[];
    allSubjects: { id: number; name: string }[];
    studentSubjectEnrollments: StudentSubjectEnrollment[];
    scoreEntries: ScoreEntry[];
    gradingSchemes: GradingScheme[];
    schoolConfig: SchoolConfig | null;
    onSaveScores: (scores: Partial<ScoreEntry>[]) => Promise<boolean>;
    onSubmitForReview: (assignmentId: number) => Promise<boolean>;
    onBack: () => void;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const TeacherScoreEntryView: React.FC<TeacherScoreEntryViewProps> = ({ 
    assignmentId, 
    academicAssignments,
    academicClassStudents,
    students,
    allSubjects,
    studentSubjectEnrollments,
    scoreEntries,
    gradingSchemes,
    schoolConfig,
    onSaveScores,
    onSubmitForReview,
    onBack,
    addToast
}) => {
    const [isSaving, setIsSaving] = useState(false);
    const [localScores, setLocalScores] = useState<Record<number, Record<string, number>>>({});
    const [localComments, setLocalComments] = useState<Record<number, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const assignment = useMemo(() => 
        academicAssignments.find(a => a.id === assignmentId), 
    [academicAssignments, assignmentId]);

    const enrolledStudents = useMemo(() => {
        if (!assignment) return [];
        
        return students.filter(s => {
            // First check if student is in the academic class
            const isInClass = academicClassStudents.some(acs => 
                acs.student_id === s.id && 
                acs.academic_class_id === assignment.academic_class_id &&
                acs.enrolled_term_id === assignment.term_id
            );
            
            if (!isInClass) return false;
            
            // Get subject ID from subject name
            const subject = allSubjects.find(sub => sub.name === assignment.subject_name);
            if (!subject) {
                console.warn(`[TeacherScoreEntryView] Subject not found for assignment: ${assignment.subject_name}. Showing all class students as fallback.`);
                return true; // Fallback: show all if subject not found
            }
            
            // Check for enrollment records for this subject in this class
            const enrollmentRecords = studentSubjectEnrollments.filter(sse =>
                sse.academic_class_id === assignment.academic_class_id &&
                sse.subject_id === subject.id &&
                sse.term_id === assignment.term_id
            );
            
            // If no enrollment records exist for this subject, show all students (backward compatibility)
            if (enrollmentRecords.length === 0) return true;
            
            // Otherwise, only show students with is_enrolled = true
            return enrollmentRecords.some(sse => 
                sse.student_id === s.id && sse.is_enrolled === true
            );
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [assignment, academicClassStudents, students, allSubjects, studentSubjectEnrollments]);

    const components = useMemo<AssessmentComponent[]>(() => {
        if (assignment?.academic_class?.assessment_structure?.components) {
            return assignment.academic_class.assessment_structure.components;
        }
        // Default fallback if no structure defined
        return [
            { name: 'CA', max_score: assignment?.max_ca_score || 40 },
            { name: 'Exam', max_score: assignment?.max_exam_score || 60 }
        ];
    }, [assignment]);

    // Initialize local state from existing score entries
    useEffect(() => {
        if (!assignment) return;
        
        const existingEntries = scoreEntries.filter(se => 
            se.term_id === assignment.term_id && 
            se.academic_class_id === assignment.academic_class_id &&
            se.subject_name === assignment.subject_name
        );

        const initialScores: Record<number, Record<string, number>> = {};
        const initialComments: Record<number, string> = {};

        existingEntries.forEach(entry => {
            // Handle both JSONB component_scores and ca_scores_breakdown
            let compScores = entry.component_scores || {};
            
            // Also check ca_scores_breakdown (JSONB field in actual DB)
            if (Object.keys(compScores).length === 0 && entry.ca_scores_breakdown) {
                compScores = { ...entry.ca_scores_breakdown };
            }
            
            // Fallback to legacy exam_score if present
            if (entry.exam_score !== undefined && entry.exam_score !== null) {
                compScores['Exam'] = Number(entry.exam_score);
            }
            
            initialScores[entry.student_id] = compScores;
            if (entry.remark) initialComments[entry.student_id] = entry.remark; // Changed from teacher_comment to remark
        });

        setLocalScores(initialScores);
        setLocalComments(initialComments);
    }, [assignment, scoreEntries]);

    const getGradingScheme = () => {
        if (assignment?.academic_class?.grading_scheme_id) {
            return gradingSchemes.find(gs => gs.id === assignment.academic_class?.grading_scheme_id);
        }
        if (schoolConfig?.active_grading_scheme_id) {
            return gradingSchemes.find(gs => gs.id === schoolConfig.active_grading_scheme_id);
        }
        return null;
    };

    const calculateGrade = (total: number) => {
        const scheme = getGradingScheme();
        if (!scheme) return 'N/A';
        const rule = scheme.rules.find(r => total >= r.min_score && total <= r.max_score);
        return rule ? rule.grade_label : 'F';
    };

    const handleScoreChange = (studentId: number, componentName: string, value: string) => {
        const numValue = value === '' ? undefined : Math.min(Math.max(0, Number(value)), 100); 
        
        // Validate against max score for component
        const componentDef = components.find(c => c.name === componentName);
        if (componentDef && numValue !== undefined && numValue > componentDef.max_score) {
             // Don't update if exceeds max
             return; 
        }

        setLocalScores(prev => {
            const studentScores = { ...prev[studentId] };
            if (numValue === undefined) delete studentScores[componentName];
            else studentScores[componentName] = numValue;
            return { ...prev, [studentId]: studentScores };
        });
    };

    const handleCommentChange = (studentId: number, value: string) => {
        setLocalComments(prev => ({ ...prev, [studentId]: value }));
    };

    const handleSave = async (): Promise<boolean> => {
        if (!assignment) return false;
        setIsSaving(true);

        const entriesToSave: Partial<ScoreEntry>[] = enrolledStudents.map(student => {
            const sScores = localScores[student.id] || {};
            // Explicitly cast to number[] to fix TS error in reduce
            const total = (Object.values(sScores) as number[]).reduce((a: number, b: number) => a + (b || 0), 0);
            const grade = calculateGrade(total);

            // Build base entry object
            const entry: Partial<ScoreEntry> = {
                school_id: assignment.school_id,
                term_id: assignment.term_id,
                academic_class_id: assignment.academic_class_id,
                subject_name: assignment.subject_name,
                student_id: student.id,
                component_scores: sScores,
                total_score: total,
                grade_label: grade, // Changed from 'grade' to 'grade_label'
                remark: localComments[student.id] || null, // Changed from 'teacher_comment' to 'remark'
            };

            // Store CA scores in ca_scores_breakdown (JSONB field in actual DB)
            const caScores: Record<string, number> = {};
            Object.entries(sScores).forEach(([key, value]) => {
                if (key.startsWith('CA')) {
                    caScores[key] = value;
                }
            });
            if (Object.keys(caScores).length > 0) {
                entry.ca_scores_breakdown = caScores;
            }
            
            // Also include exam_score for compatibility
            const examScore = sScores['Exam'];
            if (examScore !== undefined && examScore !== null) {
                entry.exam_score = examScore;
            }

            return entry;
        });

        const success = await onSaveScores(entriesToSave);
        setIsSaving(false);
        if (!success) {
            addToast('Failed to save scores. If the issue persists, try refreshing the schema cache in database settings.', 'error');
        } else {
            addToast('Scores saved successfully.', 'success');
        }
        return success;
    };
    
    const handleSubmit = async () => {
        if (!assignment) return;
        if(window.confirm("Are you sure you want to submit these scores for review? You may not be able to edit them afterwards.")) {
            setIsSubmitting(true);
            
            // First save the scores to the database
            const saveSuccess = await handleSave();
            if (!saveSuccess) {
                setIsSubmitting(false);
                return; // Don't proceed if save failed
            }
            
            // Then mark as submitted
            const success = await onSubmitForReview(assignment.id);
            setIsSubmitting(false);
            if(success) {
                onBack();
            }
        }
    };

    const downloadTemplate = () => {
        if (!assignment || !enrolledStudents.length) {
            addToast("No students to download.", 'info');
            return;
        }
        // Headers: student_id, student_name, [component_names], remark
        const componentNames = components.map(c => c.name);
        const headers = ['student_id', 'student_name', ...componentNames, 'remark'];
        
        const rows = enrolledStudents.map(s => {
            const sScores = localScores[s.id] || {};
            const comment = localComments[s.id] || '';
            
            const scoreValues = componentNames.map(cName => sScores[cName] !== undefined ? sScores[cName] : '');
            // Escape quotes in comment and name
            const safeName = `"${s.name.replace(/"/g, '""')}"`;
            const safeComment = `"${comment.replace(/"/g, '""')}"`;
            
            return [s.id, safeName, ...scoreValues, safeComment].join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + '\n' + rows.join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${assignment.subject_name}_${assignment.academic_class?.name}_scores.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const text = await file.text();
            const lines = text.split(/\r\n|\n/).filter(line => line.trim());
            if (lines.length < 2) throw new Error("CSV file is empty or missing headers.");

            const headers = lines[0].split(',').map(h => h.trim());
            
            // Identify score column indices
            const componentIndices: Record<string, number> = {};
            components.forEach(c => {
                const idx = headers.indexOf(c.name);
                if (idx !== -1) componentIndices[c.name] = idx;
            });
            
            const studentIdIndex = headers.indexOf('student_id');
            const commentIndex = headers.indexOf('remark'); // Changed from 'teacher_comment' to 'remark'

            if (studentIdIndex === -1) throw new Error("Missing 'student_id' column in CSV.");

            let updatedCount = 0;

            // Helper to handle CSV line parsing
            for (let i = 1; i < lines.length; i++) {
                // Use a simple split that respects quotes if possible, or simple split fallback
                // For robustness, regex match for CSV: values.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
                const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); 
                
                if (!values || values.length < headers.length) continue;

                const studentIdStr = values[studentIdIndex]?.replace(/"/g, '').trim();
                const studentId = Number(studentIdStr);

                if (!studentId || !enrolledStudents.some(s => s.id === studentId)) continue;

                const newScores = { ...localScores[studentId] };
                
                // Update scores
                Object.entries(componentIndices).forEach(([compName, idx]) => {
                    const valStr = values[idx]?.trim();
                    if (valStr !== '' && valStr !== undefined) {
                        const numVal = Number(valStr);
                        if (!isNaN(numVal)) {
                            // Validate max score
                            const compDef = components.find(c => c.name === compName);
                            if (compDef && numVal <= compDef.max_score && numVal >= 0) {
                                newScores[compName] = numVal;
                            }
                        }
                    }
                });

                setLocalScores(prev => ({ ...prev, [studentId]: newScores }));

                // Update comment
                if (commentIndex !== -1) {
                    const commentVal = values[commentIndex]?.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
                    if (commentVal !== undefined) {
                         setLocalComments(prev => ({ ...prev, [studentId]: commentVal }));
                    }
                }
                updatedCount++;
            }
            
            addToast(`Processed ${updatedCount} rows. Review and click 'Save Draft'.`, 'success');

        } catch (error: any) {
            console.error(error);
            const userFriendlyMessage = mapSupabaseError(error);
            addToast(`Error processing file: ${userFriendlyMessage}`, 'error');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    if (!assignment) return <div className="text-center p-10 text-slate-500">Assignment not found.</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Score Entry</h1>
                    <p className="text-slate-600 dark:text-slate-300">{assignment.academic_class?.name} - {assignment.subject_name}</p>
                    {assignment.submitted_at && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded mt-1 inline-block">Submitted on {new Date(assignment.submitted_at).toLocaleDateString()}</span>}
                    {assignment.is_locked && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded mt-1 inline-block ml-2">Locked</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                    {!assignment.is_locked && (
                        <>
                            <button onClick={downloadTemplate} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1">
                                <DownloadIcon className="w-4 h-4" /> Template
                            </button>
                            <label className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer">
                                {isUploading ? <Spinner size="sm"/> : <UploadCloudIcon className="w-4 h-4" />}
                                {isUploading ? ' Uploading...' : ' Upload CSV'}
                                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" disabled={isUploading} />
                            </label>
                        </>
                    )}
                    <button onClick={onBack} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg font-medium text-sm">Back</button>
                    {!assignment.is_locked && (
                        <>
                            <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2 text-sm">
                                {isSaving ? <Spinner size="sm"/> : 'Save Draft'}
                            </button>
                            {!assignment.submitted_at && (
                                <button onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-green-400 text-sm">
                                    {isSubmitting ? <Spinner size="sm"/> : 'Submit'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 dark:bg-slate-800 uppercase text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <tr>
                                <th className="px-4 py-3 min-w-[150px]">Student</th>
                                {components.map(c => (
                                    <th key={c.name} className="px-4 py-3 text-center">{c.name} <br/><span className="text-[10px] opacity-70">({c.max_score})</span></th>
                                ))}
                                <th className="px-4 py-3 text-center">Total</th>
                                <th className="px-4 py-3 text-center">Grade</th>
                                <th className="px-4 py-3 min-w-[200px]">Teacher Comment</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {enrolledStudents.map(student => {
                              const sScores = localScores[student.id] || {};
                              // Explicitly type accumulator and current value in reduce and cast object values
                              const total = (Object.values(sScores) as number[]).reduce((a: number, b: number) => a + (b || 0), 0);
                              
                              return (
                                <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                        {student.name}
                                        <div className="text-xs text-slate-500">{student.admission_number}</div>
                                    </td>
                                    {components.map(comp => (
                                        <td key={comp.name} className="px-4 py-3 text-center">
                                            <input 
                                                type="number" 
                                                min="0" 
                                                max={comp.max_score} 
                                                value={sScores[comp.name] !== undefined ? sScores[comp.name] : ''} 
                                                onChange={e => handleScoreChange(student.id, comp.name, e.target.value)}
                                                disabled={assignment.is_locked}
                                                className="w-16 p-1.5 text-center border border-slate-300 dark:border-slate-600 rounded bg-transparent focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                            />
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 text-center font-bold text-slate-800 dark:text-white">{total}</td>
                                    <td className="px-4 py-3 text-center font-bold text-blue-600">{calculateGrade(total)}</td>
                                    <td className="px-4 py-3">
                                        <input 
                                            type="text" 
                                            value={localComments[student.id] || ''} 
                                            onChange={e => handleCommentChange(student.id, e.target.value)}
                                            disabled={assignment.is_locked}
                                            placeholder="Optional comment..."
                                            className="w-full p-1.5 border-b border-slate-300 dark:border-slate-600 bg-transparent focus:border-blue-500 outline-none text-sm"
                                        />
                                    </td>
                                </tr>
                              )
                            })}
                        </tbody>
                    </table>
                </div>
                {enrolledStudents.length === 0 && (
                    <div className="text-center p-8 text-slate-500">No students found for this class/term. Please check 'Academic Classes' enrollment.</div>
                )}
            </div>
        </div>
    );
};

export default TeacherScoreEntryView;
