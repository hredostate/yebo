
import React, { useState, useEffect } from 'react';
import type { Task, UserProfile } from '../types';
import { TaskPriority, TaskStatus } from '../types';
import Spinner from './common/Spinner';
import SearchableSelect from './common/SearchableSelect';
import { WandIcon } from './common/icons';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'report_id' | 'school_id' | 'reminder_sent'> & { school_id: number }) => Promise<boolean>;
  users: UserProfile[];
  currentUser: UserProfile;
  initialData?: {
      taskTitle?: string;
      taskDescription?: string;
      priority?: string;
  };
}

const TaskFormModal: React.FC<TaskFormModalProps> = ({ isOpen, onClose, onSubmit, users, currentUser, initialData }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.Medium);
  const [assigneeId, setAssigneeId] = useState<string>(currentUser.id);
  const [reminder, setReminder] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
      if (isOpen) {
          if (initialData) {
              setTitle(initialData.taskTitle || '');
              setDescription(initialData.taskDescription || '');
              if (initialData.priority) {
                   const matchedPriority = Object.values(TaskPriority).find(p => p.toLowerCase() === initialData.priority?.toLowerCase());
                   if (matchedPriority) setPriority(matchedPriority);
              }
          } else {
              // Reset to defaults if no initial data provided on open
              setTitle('');
              setDescription('');
              setPriority(TaskPriority.Medium);
              setAssigneeId(currentUser.id);
          }
      }
  }, [isOpen, initialData, currentUser.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !assigneeId) {
        setError('Title and assignee are required.');
        return;
    }
    setError('');
    setIsSubmitting(true);
    const success = await onSubmit({
        school_id: currentUser.school_id,
        title,
        description: description || null,
        due_date: dueDate,
        priority,
        status: TaskStatus.ToDo,
        user_id: assigneeId,
        reminder_minutes_before: reminder ? Number(reminder) : null,
    });
    if(success) {
        onClose();
        setTitle('');
        setDescription('');
        setReminder('');
    } else {
        setError('Failed to create task. Please try again.');
    }
    setIsSubmitting(false);
  };
  
  const commonInputClasses = "mt-1 block w-full pl-3 pr-10 py-3 min-h-touch text-sm rounded-xl border border-slate-300 bg-white/80 dark:border-slate-700 dark:bg-slate-800/80 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-base";

  return (
    <div className="modal-responsive bg-black/30 backdrop-blur-sm animate-fade-in">
      <div className="modal-content-responsive rounded-none md:rounded-2xl border-0 md:border md:border-slate-200/60 bg-white/80 p-4 sm:p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full md:max-w-lg m-0 md:m-4 overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">Create New Task</h2>
            <button 
              type="button" 
              onClick={onClose} 
              className="md:hidden touch-target text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {initialData && (
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
                  <WandIcon className="w-4 h-4" />
                  <span>Pre-filled by AI Copilot</span>
              </div>
          )}

          {error && <p className="text-red-500 text-sm bg-red-500/10 p-2 rounded-md">{error}</p>}
          
          <div>
            <label htmlFor="title" className="block text-sm font-medium">Title</label>
            <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} maxLength={255} required className={commonInputClasses} />
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium">Description</label>
            <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} className={commonInputClasses}></textarea>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="assignee" className="block text-sm font-medium">Assign To</label>
              <SearchableSelect
                options={users.map(user => ({ value: user.id, label: user.name }))}
                value={assigneeId}
                onChange={value => setAssigneeId(value as string)}
                placeholder="Select assignee"
              />
            </div>
            <div>
              <label htmlFor="priority" className="block text-sm font-medium">Priority</label>
              <select id="priority" value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className={commonInputClasses}>
                {(Object.values(TaskPriority) as string[]).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label htmlFor="due-date" className="block text-sm font-medium">Due Date</label>
                <input type="date" id="due-date" value={dueDate} onChange={e => setDueDate(e.target.value)} required className={commonInputClasses} />
            </div>
            <div>
              <label htmlFor="reminder" className="block text-sm font-medium">Reminder</label>
              <select id="reminder" value={reminder} onChange={e => setReminder(e.target.value)} className={commonInputClasses}>
                <option value="">No reminder</option>
                <option value="5">5 minutes before due</option>
                <option value="30">30 minutes before due</option>
                <option value="60">1 hour before due</option>
                <option value="1440">1 day before due</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="touch-target px-4 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="touch-target px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center min-w-[120px] justify-center">
                {isSubmitting ? <Spinner size="sm" /> : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskFormModal;
