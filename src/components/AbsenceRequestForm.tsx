import React, { useState } from 'react';
import type { Student, AbsenceRequestType, UserProfile } from '../types';
import { XIcon, UploadCloudIcon, FileTextIcon } from './common/icons';

interface AbsenceRequestFormProps {
  students: Student[];
  currentUserId: string;
  userRole: string;
  onSubmit: (data: {
    student_id: number;
    request_type: AbsenceRequestType;
    start_date: string;
    end_date: string;
    reason: string;
    supporting_document_url?: string;
  }) => Promise<void>;
  onClose: () => void;
}

const AbsenceRequestForm: React.FC<AbsenceRequestFormProps> = ({
  students,
  currentUserId,
  userRole,
  onSubmit,
  onClose
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [requestType, setRequestType] = useState<AbsenceRequestType>('sick');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [supportingDocumentUrl, setSupportingDocumentUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // If user is a student, auto-select their student record
  const isStudent = userRole === 'Student';
  const studentRecord = isStudent 
    ? students.find(s => s.user_id === currentUserId)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    const studentId = isStudent && studentRecord ? studentRecord.id : selectedStudentId;
    
    if (!studentId) {
      setError('Please select a student');
      return;
    }

    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be before start date');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for the absence');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        student_id: studentId as number,
        request_type: requestType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        supporting_document_url: supportingDocumentUrl || undefined
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">New Absence Request</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            <XIcon className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Student Selection (only for non-students) */}
          {!isStudent && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Student <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isSubmitting}
              >
                <option value="">Select a student...</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name} {student.admission_number ? `(${student.admission_number})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isStudent && studentRecord && (
            <div className="p-4 bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Requesting for: <span className="font-medium text-slate-900 dark:text-white">{studentRecord.name}</span>
              </p>
            </div>
          )}

          {/* Request Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Request Type <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as AbsenceRequestType)}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isSubmitting}
            >
              <option value="sick">Sick Leave</option>
              <option value="family">Family Emergency</option>
              <option value="appointment">Medical Appointment</option>
              <option value="vacation">Vacation</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Start Date <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                End Date <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Reason <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Please provide details about the absence..."
              required
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {reason.length}/500 characters
            </p>
          </div>

          {/* Supporting Document URL (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Supporting Document URL (Optional)
            </label>
            <div className="relative">
              <FileTextIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="url"
                value={supportingDocumentUrl}
                onChange={(e) => setSupportingDocumentUrl(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/document.pdf"
                disabled={isSubmitting}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Enter a URL to a supporting document (e.g., doctor's note, letter)
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg font-medium text-slate-700 dark:text-slate-300 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AbsenceRequestForm;
