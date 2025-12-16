
import React, { useState, useMemo, useCallback } from 'react';
import type { AcademicTeachingAssignment, Assessment, AssessmentScore, Student, UserProfile, AcademicClassStudent } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon, DownloadIcon, UploadCloudIcon, TrashIcon, EditIcon, CopyIcon } from './common/icons';
import CopyAssessmentModal from './CopyAssessmentModal';
import { parseCsv, findColumnByVariations } from '../utils/feesCsvUtils';

// --- Prop Types ---
interface AssessmentManagerProps {
    academicAssignments: AcademicTeachingAssignment[];
    assessments: Assessment[];
    assessmentScores: AssessmentScore[];
    students: Student[];
    academicClassStudents: AcademicClassStudent[];
    userProfile: UserProfile;
    userPermissions: string[];
    onSaveAssessment: (data: Partial<Assessment>) => Promise<boolean>;
    onDeleteAssessment: (id: number) => Promise<boolean>;
    onSaveScores: (scores: Partial<AssessmentScore>[]) => Promise<boolean>;
    onCopyAssessment: (sourceId: number, targetIds: number[]) => Promise<boolean>;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// --- Main Component ---
const AssessmentManager: React.FC<AssessmentManagerProps> = (props) => {
    const { academicAssignments, assessments, userPermissions, onSaveAssessment, onDeleteAssessment, onCopyAssessment } = props;
    const [expandedAssignmentId, setExpandedAssignmentId] = useState<number | null>(null);

    const canManageAssessments = userPermissions.includes('manage-assessments') || userPermissions.includes('*');

    const myVisibleAssignments = useMemo(() => {
        if (canManageAssessments) {
            return academicAssignments; // Admins/Leads see all
        }
        // Teachers see only their own
        return academicAssignments.filter(a => a.teacher_user_id === props.userProfile.id);
    }, [academicAssignments, props.userProfile.id, canManageAssessments]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Continuous Assessment Tasks</h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">
                    Create specific tests, projects, and homework entries.
                    <br/>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        Note: These are for detailed internal tracking. Final scores for the Report Card must be entered in the "Gradebook" module.
                    </span>
                </p>
            </div>
            <div className="space-y-4">
                {myVisibleAssignments.length > 0 ? (
                    myVisibleAssignments.map(assignment => (
                        <AssignmentCard
                            key={assignment.id}
                            assignment={assignment}
                            assessments={assessments.filter(a => a.teaching_assignment_id === assignment.id)}
                            isExpanded={expandedAssignmentId === assignment.id}
                            onToggleExpand={() => setExpandedAssignmentId(prev => prev === assignment.id ? null : assignment.id)}
                            canManageAssessments={canManageAssessments}
                            onSaveAssessment={onSaveAssessment}
                            onDeleteAssessment={onDeleteAssessment}
                            onCopyAssessment={onCopyAssessment}
                            allAssignments={academicAssignments}
                            allAssessments={assessments}
                            {...props}
                        />
                    ))
                ) : (
                    <div className="text-center py-16 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                        <p className="text-slate-500">No teaching assignments found.</p>
                        <p className="text-slate-400 text-sm mt-1">Create assignments in the Super Admin Console to manage assessments here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Child Components ---

interface AssignmentCardProps extends AssessmentManagerProps {
    assignment: AcademicTeachingAssignment;
    assessments: Assessment[];
    isExpanded: boolean;
    onToggleExpand: () => void;
    canManageAssessments: boolean;
    allAssignments: AcademicTeachingAssignment[];
    allAssessments: Assessment[];
}
const AssignmentCard: React.FC<AssignmentCardProps> = (props) => {
    const { assignment, assessments, isExpanded, onToggleExpand, canManageAssessments, onSaveAssessment, onDeleteAssessment, onCopyAssessment, allAssignments, allAssessments } = props;
    const [editingAssessment, setEditingAssessment] = useState<Partial<Assessment> | null>(null);
    const [assessmentToCopy, setAssessmentToCopy] = useState<Assessment | null>(null);

    const handleSave = async (data: Partial<Assessment>) => {
        const success = await onSaveAssessment(data);
        if (success) {
            setEditingAssessment(null);
        }
    };
    
    return (
        <div className="rounded-2xl border bg-white/60 dark:bg-slate-900/40 p-4 shadow-md border-slate-200 dark:border-slate-700">
            <div onClick={onToggleExpand} className="flex justify-between items-center cursor-pointer">
                <div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">{assignment.academic_class?.name} - {assignment.subject_name}</h3>
                    <p className="text-sm text-slate-500">{assignment.teacher?.name}</p>
                </div>
                <span className={`transform transition-transform text-slate-500 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>▶</span>
            </div>

            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    {canManageAssessments && (
                        <button 
                            onClick={() => setEditingAssessment({ teaching_assignment_id: assignment.id })} 
                            className="flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 p-3 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors w-full border border-dashed border-blue-300 dark:border-blue-700 mb-2"
                        >
                            <PlusCircleIcon className="w-5 h-5"/> Create New Task/Test
                        </button>
                    )}

                    {assessments.map(assessment => (
                        <AssessmentItem 
                            key={assessment.id} 
                            assessment={assessment} 
                            canManage={canManageAssessments}
                            onEdit={() => setEditingAssessment(assessment)}
                            onDelete={() => {
                                if (window.confirm('Are you sure you want to delete this assessment? This action cannot be undone and will remove all associated scores.')) {
                                    onDeleteAssessment(assessment.id);
                                }
                            }}
                            onCopy={() => setAssessmentToCopy(assessment)}
                            {...props}
                        />
                    ))}
                    {assessments.length === 0 && !editingAssessment && (
                        <p className="text-center text-sm text-slate-500 py-4">No assessments created yet.</p>
                    )}
                </div>
            )}
            {editingAssessment && (
                <AssessmentFormModal
                    isOpen={!!editingAssessment}
                    onClose={() => setEditingAssessment(null)}
                    onSave={handleSave}
                    assessment={editingAssessment}
                />
            )}
            {assessmentToCopy && (
                 <CopyAssessmentModal
                    isOpen={!!assessmentToCopy}
                    onClose={() => setAssessmentToCopy(null)}
                    assessmentToCopy={assessmentToCopy}
                    onCopy={onCopyAssessment}
                    allAssignments={allAssignments}
                    allAssessments={allAssessments}
                />
            )}
        </div>
    );
};

interface AssessmentItemProps extends AssessmentManagerProps {
    assessment: Assessment;
    canManage: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onCopy: () => void;
}
const AssessmentItem: React.FC<AssessmentItemProps> = ({ assessment, canManage, onEdit, onDelete, onCopy, ...props }) => {
    const [isManagingScores, setIsManagingScores] = useState(false);
    return (
        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center">
                <div>
                    <p className="font-semibold text-slate-800 dark:text-white">{assessment.title} <span className="text-xs font-normal text-slate-500">({assessment.assessment_type}, Max: {assessment.max_score})</span></p>
                    {assessment.deadline && <p className="text-xs text-slate-500">Deadline: {new Date(assessment.deadline + 'T00:00:00').toLocaleDateString()}</p>}
                </div>
                <div className="flex items-center gap-2">
                    {canManage && (
                        <>
                            <button onClick={onCopy} title="Copy"><CopyIcon className="w-4 h-4 text-slate-600 hover:text-blue-600 dark:text-slate-400"/></button>
                            <button onClick={onEdit} title="Edit"><EditIcon className="w-4 h-4 text-slate-600 hover:text-blue-600 dark:text-slate-400"/></button>
                            <button onClick={onDelete} title="Delete"><TrashIcon className="w-4 h-4 text-slate-600 hover:text-red-600 dark:text-slate-400"/></button>
                        </>
                    )}
                    <button onClick={() => setIsManagingScores(!isManagingScores)} className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">Manage Scores</button>
                </div>
            </div>
            {isManagingScores && <ScoreManager assessment={assessment} {...props} />}
        </div>
    );
};

const AssessmentFormModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (data: Partial<Assessment>) => Promise<void>; assessment: Partial<Assessment> }> = ({ isOpen, onClose, onSave, assessment }) => {
    const [data, setData] = useState<Partial<Assessment>>(assessment);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(data);
        setIsSaving(false);
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex justify-center items-center animate-fade-in">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg w-full max-w-md space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">{data.id ? 'Edit' : 'Create'} Assessment Task</h3>
                <input type="text" placeholder="Title (e.g. Week 3 Quiz)" value={data.title || ''} onChange={e => setData({...data, title: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"/>
                <input type="text" placeholder="Type (e.g., Test, Project)" value={data.assessment_type || ''} onChange={e => setData({...data, assessment_type: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"/>
                <input type="number" placeholder="Max Score" value={data.max_score || ''} onChange={e => setData({...data, max_score: Number(e.target.value)})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"/>
                <input type="date" value={data.deadline || ''} onChange={e => setData({...data, deadline: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"/>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-md text-slate-800 dark:text-white">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{isSaving ? <Spinner size="sm" /> : 'Save'}</button>
                </div>
            </div>
        </div>
    );
};

const ScoreManager: React.FC<AssessmentManagerProps & { assessment: Assessment }> = ({ assessment, students, academicClassStudents, assessmentScores, onSaveScores, addToast }) => {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const roster = useMemo(() => {
        const studentIdsInClass = new Set(academicClassStudents.filter(acs => acs.academic_class_id === assessment.assignment?.academic_class_id).map(acs => acs.student_id));
        return students.filter(s => studentIdsInClass.has(s.id));
    }, [students, academicClassStudents, assessment]);

    const downloadTemplate = () => {
        const headers = 'student_id,student_name,score,comments\n';
        const rows = roster.map(s => `${s.id},"${s.name.replace(/"/g, '""')}",,`).join('\n');
        const csvContent = "data:text/csv;charset=utf-8," + headers + rows;
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `${assessment.title}_scores_template.csv`);
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
            
            // Parse CSV using the shared utility
            const parsed = parseCsv(text);
            const rows = parsed.rows;

            if (rows.length === 0) {
                addToast("CSV file is empty or invalid.", 'error');
                return;
            }

            // Get headers from first row
            const headers = parsed.headers;
            const headerMap = new Map(parsed.normalizedHeaders.map((h, idx) => [h, headers[idx]]));
            
            // Find required columns (case-insensitive)
            const studentIdCol = findColumnByVariations(headerMap, ['student_id', 'studentid', 'student id']);
            const studentNameCol = findColumnByVariations(headerMap, ['student_name', 'studentname', 'student name', 'name']);
            const scoreCol = findColumnByVariations(headerMap, ['score']);
            const commentsCol = findColumnByVariations(headerMap, ['comments', 'comment', 'remarks', 'remark']);
            
            if (!studentIdCol) {
                addToast("CSV must contain 'student_id' column.", 'error');
                return;
            }

            const scoresToUpload: Partial<AssessmentScore>[] = [];
            let processedRows = 0;
            let skippedRows = 0;

            for (const row of rows) {
                const studentId = Number(row[studentIdCol]);
                
                if (!studentId || isNaN(studentId)) {
                    skippedRows++;
                    continue;
                }
                
                if (!roster.some(s => s.id === studentId)) {
                    console.warn(`Student ID ${studentId} not found in roster, skipping`);
                    skippedRows++;
                    continue;
                }
                
                // Parse score if column exists
                let score = null;
                if (scoreCol && row[scoreCol]) {
                    const scoreValue = Number(row[scoreCol]);
                    if (!isNaN(scoreValue)) {
                        if (scoreValue < 0 || scoreValue > assessment.max_score) {
                            const studentName = studentNameCol ? row[studentNameCol] : `ID ${studentId}`;
                            addToast(
                                `Invalid score for ${studentName}: ${scoreValue}. Score must be between 0 and ${assessment.max_score}.`,
                                'error'
                            );
                            skippedRows++;
                            continue;
                        }
                        score = scoreValue;
                    }
                }
                
                // Parse comments if column exists
                const comments = commentsCol && row[commentsCol] ? String(row[commentsCol]).trim() : null;

                scoresToUpload.push({
                    assessment_id: assessment.id,
                    student_id: studentId,
                    score: score,
                    comments: comments
                });
                
                processedRows++;
            }
            
            if (scoresToUpload.length > 0) {
                await onSaveScores(scoresToUpload);
                addToast(`Uploaded ${scoresToUpload.length} scores successfully.`, 'success');
            } else {
                addToast("No valid scores found in file.", 'info');
            }

        } catch (error: any) {
            addToast(`Error processing file: ${error.message}`, 'error');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <div className="mt-4 p-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Manage Scores for {assessment.title}</p>
            <div className="flex items-center gap-4">
                <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"><DownloadIcon className="w-4 h-4"/> Download Template</button>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-md disabled:bg-indigo-400 hover:bg-indigo-700 transition-colors">
                    {isUploading ? <Spinner size="sm"/> : <UploadCloudIcon className="w-4 h-4"/>}
                    {isUploading ? 'Uploading...' : 'Upload Scores'}
                </button>
            </div>
        </div>
    );
};

export default AssessmentManager;
