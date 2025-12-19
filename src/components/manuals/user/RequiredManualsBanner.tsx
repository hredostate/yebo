import React, { useState, useEffect } from 'react';
import { FileTextIcon, CloseIcon } from '../../common/icons';
import type { UserProfile } from '../../../types';
import { useManualAssignments } from '../hooks/useManualAssignments';
import type { ManualAssignment } from '../../../types/manuals';

interface RequiredManualsBannerProps {
  userProfile: UserProfile;
  onViewManuals: () => void;
}

const RequiredManualsBanner: React.FC<RequiredManualsBannerProps> = ({ userProfile, onViewManuals }) => {
  const [pendingManuals, setPendingManuals] = useState<ManualAssignment[]>([]);
  const [isDismissed, setIsDismissed] = useState(false);
  const { fetchUserAssignments } = useManualAssignments();

  useEffect(() => {
    loadPendingManuals();
  }, []);

  const loadPendingManuals = async () => {
    const data = await fetchUserAssignments(userProfile.id, {
      includeCompleted: false,
    });
    setPendingManuals(data.filter(a => a.status !== 'completed'));
  };

  // Don't show if dismissed or no pending manuals
  if (isDismissed || pendingManuals.length === 0) {
    return null;
  }

  const overdueManuals = pendingManuals.filter(a => {
    if (!a.due_date) return false;
    return new Date(a.due_date) < new Date();
  });

  const isUrgent = overdueManuals.length > 0;

  return (
    <div className={`rounded-lg p-4 mb-6 border-l-4 ${
      isUrgent
        ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <FileTextIcon className={`w-6 h-6 flex-shrink-0 ${
            isUrgent ? 'text-red-600' : 'text-blue-600'
          }`} />
          <div className="flex-1">
            <h3 className={`font-semibold mb-1 ${
              isUrgent
                ? 'text-red-800 dark:text-red-300'
                : 'text-blue-800 dark:text-blue-300'
            }`}>
              {isUrgent ? 'Urgent: Overdue Required Manuals' : 'Required Reading'}
            </h3>
            <p className={`text-sm ${
              isUrgent
                ? 'text-red-700 dark:text-red-300'
                : 'text-blue-700 dark:text-blue-300'
            }`}>
              {isUrgent ? (
                <>
                  You have <strong>{overdueManuals.length}</strong> overdue manual{overdueManuals.length !== 1 ? 's' : ''} that must be completed immediately.
                </>
              ) : (
                <>
                  You have <strong>{pendingManuals.length}</strong> required manual{pendingManuals.length !== 1 ? 's' : ''} waiting to be read.
                </>
              )}
            </p>
            <button
              onClick={onViewManuals}
              className={`mt-2 px-4 py-2 rounded-lg font-semibold text-sm transition ${
                isUrgent
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              View My Manuals
            </button>
          </div>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default RequiredManualsBanner;
