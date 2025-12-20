import React, { useState, useMemo } from 'react';
import type { Student, StudentTermReport } from '../types';
import Spinner from './common/Spinner';
import { WandIcon, CheckCircleIcon, XIcon } from './common/icons';

interface TeacherCommentModalProps {
    classId: number;
    className: string;
    termId: number;
    students: Student[];
    studentTermReports: StudentTermReport[];
    onUpdateComment: (reportId: number, teacherComment: string, principalComment: string) => Promise<void>;
    onBulkGenerate: (overwrite: boolean) => Promise<void>;
    isGenerating: boolean;
    onClose: () => void;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface CommentEdit {
    reportId: number;
    studentId: number;
    studentName: string;
    currentComment: string;
    editedComment: string;
    averageScore: number;
    positionInClass: number;
    isDirty: boolean;
}

const TeacherCommentModal: React.FC<TeacherCommentModalProps> = ({
    className,
    termId,
    students,
    studentTermReports,
    onUpdateComment,
    onBulkGenerate,
    isGenerating,
    onClose,
    addToast,
}) => {
    const [commentEdits, setCommentEdits] = useState<CommentEdit[]>(() => {
        // Initialize comment edits from reports
        return studentTermReports.map(report => {
            const student = students.find(s => s.id === report.student_id);
            return {
                reportId: report.id,
                studentId: report.student_id,
                studentName: student?.name || 'Unknown Student',
                currentComment: report.teacher_comment || '',
                editedComment: report.teacher_comment || '',
                averageScore: report.average_score || 0,
                positionInClass: report.position_in_class || 0,
                isDirty: false,
            };
        }).sort((a, b) => a.studentName.localeCompare(b.studentName));
    });

    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter students based on search
    const filteredComments = useMemo(() => {
        if (!searchQuery.trim()) return commentEdits;
        const query = searchQuery.toLowerCase();
        return commentEdits.filter(edit => 
            edit.studentName.toLowerCase().includes(query)
        );
    }, [commentEdits, searchQuery]);

    // Count dirty entries
    const dirtyCount = commentEdits.filter(e => e.isDirty).length;

    const handleCommentChange = (reportId: number, newComment: string) => {
        setCommentEdits(prev => prev.map(edit => {
            if (edit.reportId === reportId) {
                return {
                    ...edit,
                    editedComment: newComment,
                    isDirty: newComment !== edit.currentComment,
                };
            }
            return edit;
        }));
    };

    const handleSaveAll = async () => {
        const dirtyEdits = commentEdits.filter(e => e.isDirty);
        
        if (dirtyEdits.length === 0) {
            addToast('No changes to save.', 'info');
            return;
        }

        setIsSaving(true);
        try {
            let successCount = 0;
            let errorCount = 0;

            for (const edit of dirtyEdits) {
                try {
                    // Get the report to preserve principal_comment
                    const report = studentTermReports.find(r => r.id === edit.reportId);
                    await onUpdateComment(
                        edit.reportId,
                        edit.editedComment,
                        report?.principal_comment || ''
                    );
                    successCount++;
                    
                    // Update current comment to match edited
                    setCommentEdits(prev => prev.map(e => 
                        e.reportId === edit.reportId 
                            ? { ...e, currentComment: e.editedComment, isDirty: false }
                            : e
                    ));
                } catch (err) {
                    console.error(`Failed to save comment for report ${edit.reportId}:`, err);
                    errorCount++;
                }
            }

            if (errorCount === 0) {
                addToast(`Successfully saved ${successCount} comment(s)!`, 'success');
            } else {
                addToast(`Saved ${successCount} comments, ${errorCount} failed.`, 'info');
            }
        } catch (e: any) {
            addToast(`Error saving comments: ${e.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveOne = async (edit: CommentEdit) => {
        if (!edit.isDirty) return;

        setIsSaving(true);
        try {
            const report = studentTermReports.find(r => r.id === edit.reportId);
            await onUpdateComment(
                edit.reportId,
                edit.editedComment,
                report?.principal_comment || ''
            );
            
            // Update current comment to match edited
            setCommentEdits(prev => prev.map(e => 
                e.reportId === edit.reportId 
                    ? { ...e, currentComment: e.editedComment, isDirty: false }
                    : e
            ));
            
            addToast('Comment saved successfully!', 'success');
        } catch (e: any) {
            addToast(`Error saving comment: ${e.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBulkGenerate = async (overwrite: boolean) => {
        if (dirtyCount > 0 && !window.confirm('You have unsaved changes. Generate will overwrite them. Continue?')) {
            return;
        }
        
        await onBulkGenerate(overwrite);
        
        // Refresh the comment edits from reports after generation
        // (In a real scenario, the parent component would refresh data and this modal would update)
        onClose(); // Close modal and let parent refresh
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in"
            aria-modal="true"
            role="dialog"
        >
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col p-6 m-4">
                {/* Header */}
                <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                            Edit Teacher Comments
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {className} - {filteredComments.length} students
                            {dirtyCount > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">({dirtyCount} unsaved)</span>}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold"
                        aria-label="Close"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap gap-3 mb-4 items-center">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search students..."
                        className="flex-1 min-w-[200px] px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-sm"
                    />
                    <button
                        onClick={() => handleBulkGenerate(false)}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        title="Generate comments for students who don't have one"
                    >
                        {isGenerating ? <Spinner size="sm" /> : <WandIcon className="w-4 h-4" />}
                        Generate (Empty Only)
                    </button>
                    <button
                        onClick={() => handleBulkGenerate(true)}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        title="Regenerate all comments, overwriting existing ones"
                    >
                        {isGenerating ? <Spinner size="sm" /> : <WandIcon className="w-4 h-4" />}
                        Regenerate All
                    </button>
                    <button
                        onClick={handleSaveAll}
                        disabled={isSaving || dirtyCount === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                        {isSaving ? <Spinner size="sm" /> : <CheckCircleIcon className="w-4 h-4" />}
                        Save All Changes
                    </button>
                </div>

                {/* Comment List */}
                <div className="flex-grow overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                    {filteredComments.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-slate-500 dark:text-slate-400">No students found.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredComments.map(edit => (
                                <div
                                    key={edit.reportId}
                                    className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${edit.isDirty ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="flex-shrink-0 w-48">
                                            <p className="font-semibold text-gray-800 dark:text-gray-200">
                                                {edit.studentName}
                                            </p>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                                                <p>Avg: {edit.averageScore.toFixed(1)}%</p>
                                                <p>Position: {edit.positionInClass}</p>
                                            </div>
                                        </div>
                                        <div className="flex-grow">
                                            <textarea
                                                value={edit.editedComment}
                                                onChange={e => handleCommentChange(edit.reportId, e.target.value)}
                                                placeholder="Enter teacher comment..."
                                                rows={3}
                                                className="w-full px-3 py-2 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            />
                                        </div>
                                        <div className="flex-shrink-0">
                                            {edit.isDirty && (
                                                <button
                                                    onClick={() => handleSaveOne(edit)}
                                                    disabled={isSaving}
                                                    className="px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
                                                    title="Save this comment"
                                                >
                                                    Save
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {dirtyCount > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                {dirtyCount} unsaved change(s)
                            </span>
                        ) : (
                            'All changes saved'
                        )}
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TeacherCommentModal;
