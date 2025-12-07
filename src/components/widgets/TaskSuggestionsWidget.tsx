import React, { useState, useMemo, useEffect } from 'react';
import type { SuggestedTask, UserProfile } from '../../types';
import { WandIcon } from '../common/icons';
import SearchableSelect from '../common/SearchableSelect';

interface TaskSuggestionsWidgetProps {
  taskSuggestions: SuggestedTask[];
  areFallbackSuggestions?: boolean;
  onAcceptSuggestion: (suggestion: SuggestedTask, assigneeId: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  users: UserProfile[];
}

const TaskSuggestionsWidget: React.FC<TaskSuggestionsWidgetProps> = ({ taskSuggestions, areFallbackSuggestions, onAcceptSuggestion, onDismissSuggestion, users }) => {
  const [assigneeIds, setAssigneeIds] = useState<Record<string, string>>({});

  const assignableUsers = useMemo(() => 
    users.filter(u => ['Admin', 'Principal', 'Team Lead', 'Teacher', 'Counselor', 'IT Support', 'Maintenance', 'School Secretary'].includes(u.role))
    .sort((a, b) => a.name.localeCompare(b.name))
  , [users]);

  useEffect(() => {
    const initialAssignees: Record<string, string> = {};
    if (taskSuggestions.length > 0 && assignableUsers.length > 0) {
        taskSuggestions.forEach(suggestion => {
            const suggestedUser = assignableUsers.find(u => u.role === suggestion.suggestedRole);
            if (suggestedUser) {
                initialAssignees[suggestion.id] = suggestedUser.id;
            }
        });
    }
    setAssigneeIds(initialAssignees);
  }, [taskSuggestions, assignableUsers]);

  const handleAssigneeChange = (suggestionId: string, userId: string) => {
    setAssigneeIds(prev => ({ ...prev, [suggestionId]: userId }));
  };
  
  const handleAccept = (suggestion: SuggestedTask) => {
    const assigneeId = assigneeIds[suggestion.id];
    if (assigneeId) {
        onAcceptSuggestion(suggestion, assigneeId);
    }
  };

  if (taskSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 animate-fade-in col-span-1 md:col-span-2">
      <div className="flex items-center mb-3">
        <WandIcon className="w-6 h-6 text-purple-600 mr-2" />
        <h3 className="font-bold text-slate-900 dark:text-white">
          {areFallbackSuggestions ? 'Recommended Tasks' : 'AI Task Suggestions'}
        </h3>
      </div>
      {areFallbackSuggestions && (
        <div className="mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <span className="font-semibold">⚠️ AI suggestions temporarily unavailable</span> - Showing recommended tasks based on your role and recent activity.
          </p>
        </div>
      )}
      <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
        {taskSuggestions.map(suggestion => {
          const selectedAssigneeId = assigneeIds[suggestion.id] || '';
          return (
            <div key={suggestion.id} className="p-3 bg-purple-500/10 rounded-lg border border-purple-200/60 dark:border-purple-800/60 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-grow">
                <p className="font-semibold text-sm text-purple-800 dark:text-purple-300">{suggestion.title}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {areFallbackSuggestions 
                    ? `Recommended for: ${suggestion.suggestedRole}` 
                    : `From Recent Report Analysis (AI suggests: ${suggestion.suggestedRole})`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-48">
                  <SearchableSelect
                    options={assignableUsers.map(u => ({ value: u.id, label: `${u.name} (${u.role})` }))}
                    value={selectedAssigneeId}
                    onChange={(value) => handleAssigneeChange(suggestion.id, value as string)}
                    placeholder="Assign to..."
                  />
                </div>
                <button
                  onClick={() => handleAccept(suggestion)}
                  disabled={!selectedAssigneeId}
                  className="px-3 py-2 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  Create Task
                </button>
                <button
                  onClick={() => onDismissSuggestion(suggestion.id)}
                  className="px-3 py-2 text-xs font-semibold bg-slate-500/20 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-500/30"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TaskSuggestionsWidget;