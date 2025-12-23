import React, { useState, useEffect } from 'react';
import type { Student } from '../types';
import Spinner from './common/Spinner';
import SearchableSelect from './common/SearchableSelect';

interface PositiveBehaviorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (studentId: number, description: string) => Promise<void>;
  students: Student[];
  defaultStudent?: Student;
}

const PositiveBehaviorModal: React.FC<PositiveBehaviorModalProps> = ({ isOpen, onClose, onSubmit, students, defaultStudent }) => {
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedStudentId(defaultStudent ? defaultStudent.id : null);
      setDescription('');
      setError(null);
    }
  }, [isOpen, defaultStudent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !description) {
      setError('Please select a student and provide a description.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    await onSubmit(selectedStudentId, description);
    setIsSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex justify-center items-center z-50 animate-fade-in">
      <div className="glass-panel-strong rounded-2xl p-6 shadow-glass-strong w-full max-w-md m-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white dark:text-white">Log Positive Behavior</h2>
          <button onClick={onClose} className="text-slate-200 hover:text-white dark:hover:text-white text-3xl font-light focus-visible-ring">&times;</button>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/40 backdrop-blur-sm p-3 text-sm text-red-200 dark:text-red-300">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="student" className="block text-sm font-medium text-slate-100 dark:text-slate-200">Student</label>
            <SearchableSelect
              options={students.map(s => ({ value: s.id, label: s.name }))}
              value={selectedStudentId}
              onChange={value => setSelectedStudentId(value as number)}
              placeholder="Select a student"
              disabled={!!defaultStudent}
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-100 dark:text-slate-200">Description of Behavior</label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-xl shadow-sm py-2 px-3 sm:text-sm glass-panel-subtle text-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              placeholder="e.g., Helped a classmate who was struggling with their work."
            ></textarea>
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 glass-panel-subtle text-white font-semibold rounded-lg hover:glass-panel transition-all focus-visible-ring">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-green-400 flex items-center shadow-lg shadow-green-600/30 focus-visible-ring">
              {isSubmitting && <Spinner size="sm" />}
              <span className={isSubmitting ? 'ml-2' : ''}>Log Behavior</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PositiveBehaviorModal;
