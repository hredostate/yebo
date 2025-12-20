import React, { useState } from 'react';
import type { Student, StudentTermReport } from '../types';
import Spinner from './common/Spinner';
import { CheckCircleIcon, WandIcon } from './common/icons';

interface TeacherCommentEditorProps {
  students: Student[];
  termId: number;
  classId: number;
  className: string;
  termName: string;
  studentTermReports: StudentTermReport[];
  onSave: (reportId: number, teacherComment: string, principalComment: string) => Promise<void>;
  onClose: () => void;
  onGenerateComments?: (classId: number, termId: number, useAI: boolean) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

interface CommentEdit {
  reportId: number;
  teacherComment: string;
  principalComment: string;
}

const TeacherCommentEditor: React.FC<TeacherCommentEditorProps> = ({
  students,
  termId,
  classId,
  className,
  termName,
  studentTermReports,
  onSave,
  onClose,
  onGenerateComments,
  addToast
}) => {
  const [editedComments, setEditedComments] = useState<Map<number, CommentEdit>>(new Map());
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Get students with their reports
  const studentsWithReports = students.map(student => {
    const report = studentTermReports.find(r => r.student_id === student.id && r.term_id === termId);
    return {
      student,
      report,
      hasReport: !!report
    };
  }).filter(s => s.hasReport);

  // Filter by search query
  const filteredStudents = studentsWithReports.filter(s =>
    s.student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCommentChange = (reportId: number, field: 'teacher' | 'principal', value: string) => {
    const report = studentTermReports.find(r => r.id === reportId);
    if (!report) return;

    const existing = editedComments.get(reportId) || {
      reportId,
      teacherComment: report.teacher_comment || '',
      principalComment: report.principal_comment || ''
    };

    if (field === 'teacher') {
      existing.teacherComment = value;
    } else {
      existing.principalComment = value;
    }

    setEditedComments(new Map(editedComments.set(reportId, existing)));
  };

  const handleSaveIndividual = async (reportId: number) => {
    const edit = editedComments.get(reportId);
    if (!edit) return;

    setSavingIds(new Set(savingIds.add(reportId)));
    try {
      await onSave(reportId, edit.teacherComment, edit.principalComment);
      // Remove from edited map after successful save
      const newEdited = new Map(editedComments);
      newEdited.delete(reportId);
      setEditedComments(newEdited);
    } catch (error) {
      console.error('Error saving comment:', error);
    } finally {
      const newSaving = new Set(savingIds);
      newSaving.delete(reportId);
      setSavingIds(newSaving);
    }
  };

  const handleSaveAll = async () => {
    if (editedComments.size === 0) {
      addToast('No changes to save', 'info');
      return;
    }

    const editArray = Array.from(editedComments.values());
    let successCount = 0;
    let errorCount = 0;

    // Set all IDs as saving at once
    const allIds = editArray.map(e => e.reportId);
    setSavingIds(new Set(allIds));

    for (const edit of editArray) {
      try {
        await onSave(edit.reportId, edit.teacherComment, edit.principalComment);
        successCount++;
      } catch (error) {
        console.error('Error saving comment:', error);
        errorCount++;
      }
    }

    // Clear all saving IDs at once
    setSavingIds(new Set());

    if (errorCount === 0) {
      addToast(`Successfully saved ${successCount} comment(s)!`, 'success');
      setEditedComments(new Map());
    } else {
      addToast(`Saved ${successCount} comment(s), ${errorCount} failed`, 'warning');
    }
  };

  const handleGenerateComments = async (useAI: boolean) => {
    if (!onGenerateComments) return;

    setIsGenerating(true);
    try {
      await onGenerateComments(classId, termId, useAI);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Edit Teacher Comments
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {className} - {termName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          <div className="flex gap-3 flex-wrap">
            {/* Search */}
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />

            {/* Generate Buttons */}
            {onGenerateComments && (
              <>
                <button
                  onClick={() => handleGenerateComments(false)}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {isGenerating ? <Spinner size="sm" /> : <WandIcon className="w-4 h-4" />}
                  Generate (Rule-Based)
                </button>
                <button
                  onClick={() => handleGenerateComments(true)}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isGenerating ? <Spinner size="sm" /> : <WandIcon className="w-4 h-4" />}
                  Generate (AI)
                </button>
              </>
            )}

            {/* Save All */}
            <button
              onClick={handleSaveAll}
              disabled={editedComments.size === 0 || savingIds.size > 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Save All ({editedComments.size})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              No students found with reports for this class
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStudents.map(({ student, report }) => {
                if (!report) return null;

                const currentEdit = editedComments.get(report.id);
                const teacherComment = currentEdit?.teacherComment ?? report.teacher_comment ?? '';
                const isSaving = savingIds.has(report.id);
                const hasChanges = editedComments.has(report.id);

                return (
                  <div
                    key={student.id}
                    className={`p-4 rounded-lg border ${
                      hasChanges
                        ? 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                          {student.name}
                        </h3>
                        <div className="flex gap-4 text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {report.average_score !== null && (
                            <span>Average: {report.average_score.toFixed(1)}%</span>
                          )}
                          {report.position_in_class !== null && (
                            <span>Position: {report.position_in_class}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSaveIndividual(report.id)}
                        disabled={!hasChanges || isSaving}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {isSaving ? <Spinner size="sm" /> : <CheckCircleIcon className="w-4 h-4" />}
                        Save
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Teacher's Comment
                      </label>
                      <textarea
                        value={teacherComment}
                        onChange={e => handleCommentChange(report.id, 'teacher', e.target.value)}
                        placeholder="Enter teacher's comment for this student..."
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} •{' '}
            {editedComments.size} unsaved change{editedComments.size !== 1 ? 's' : ''}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherCommentEditor;
