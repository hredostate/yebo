import React from 'react';
import { FileTextIcon, ClockIcon, CheckCircleIcon } from '../../common/icons';
import type { ManualAssignment } from '../../../types/manuals';

interface ManualCardProps {
  assignment: ManualAssignment;
  onClick: () => void;
}

const ManualCard: React.FC<ManualCardProps> = ({ assignment, onClick }) => {
  const { manual, status, due_date, completed_at } = assignment;

  if (!manual) return null;

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      case 'overdue':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'in_progress':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      default:
        return 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'overdue':
        return <ClockIcon className="w-5 h-5 text-red-600" />;
      default:
        return <ClockIcon className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getDaysRemaining = () => {
    if (!due_date || status === 'completed') return null;
    const now = new Date();
    const dueDate = new Date(due_date);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = getDaysRemaining();

  return (
    <div
      onClick={onClick}
      className={`border-2 rounded-lg p-4 cursor-pointer hover:shadow-lg transition ${getStatusColor()}`}
    >
      <div className="flex items-start justify-between mb-3">
        <FileTextIcon className="w-8 h-8 text-slate-600 dark:text-slate-400" />
        {getStatusIcon()}
      </div>

      <h3 className="font-semibold text-slate-800 dark:text-white mb-2 line-clamp-2">
        {manual.title}
      </h3>

      {manual.description && (
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
          {manual.description}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-xs rounded">
          {manual.category}
        </span>
        <span className={`px-2 py-1 text-xs rounded font-semibold ${
          status === 'completed'
            ? 'bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300'
            : status === 'overdue'
            ? 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300'
            : 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
        }`}>
          {status.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      {status !== 'completed' && daysRemaining !== null && (
        <div className={`text-sm font-medium ${
          daysRemaining < 0
            ? 'text-red-600'
            : daysRemaining <= 3
            ? 'text-yellow-600'
            : 'text-slate-600 dark:text-slate-400'
        }`}>
          {daysRemaining < 0
            ? `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''}`
            : daysRemaining === 0
            ? 'Due today'
            : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`
          }
        </div>
      )}

      {status === 'completed' && completed_at && (
        <div className="text-sm text-green-600 font-medium">
          Completed on {new Date(completed_at).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};

export default ManualCard;
