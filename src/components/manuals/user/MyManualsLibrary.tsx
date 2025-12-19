import React, { useState, useEffect } from 'react';
import { BookOpenIcon, ClockIcon, CheckCircleIcon } from '../../common/icons';
import type { UserProfile } from '../../../types';
import { useManualAssignments } from '../hooks/useManualAssignments';
import type { ManualAssignment } from '../../../types/manuals';
import ManualCard from './ManualCard';
import ManualViewer from './ManualViewer';
import Spinner from '../../common/Spinner';

interface MyManualsLibraryProps {
  userProfile: UserProfile;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const MyManualsLibrary: React.FC<MyManualsLibraryProps> = ({ userProfile, addToast }) => {
  const [assignments, setAssignments] = useState<ManualAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<ManualAssignment | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const { loading, error, fetchUserAssignments } = useManualAssignments();

  useEffect(() => {
    loadAssignments();
  }, []);

  useEffect(() => {
    if (error) {
      addToast(error, 'error');
    }
  }, [error]);

  const loadAssignments = async () => {
    const data = await fetchUserAssignments(userProfile.id, {
      includeCompleted: true,
    });
    setAssignments(data);
  };

  const filteredAssignments = assignments.filter(a => {
    if (filter === 'pending') return a.status !== 'completed';
    if (filter === 'completed') return a.status === 'completed';
    return true;
  });

  const pendingCount = assignments.filter(a => a.status !== 'completed').length;
  const completedCount = assignments.filter(a => a.status === 'completed').length;

  if (selectedAssignment) {
    return (
      <ManualViewer
        assignment={selectedAssignment}
        userProfile={userProfile}
        onClose={() => {
          setSelectedAssignment(null);
          loadAssignments(); // Refresh after viewing
        }}
        addToast={addToast}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">My Manuals</h1>
        <p className="text-slate-600 dark:text-slate-400">
          View and complete your assigned instruction manuals
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <BookOpenIcon className="w-8 h-8 text-blue-600" />
            <div>
              <div className="text-sm text-blue-800 dark:text-blue-300">Total Manuals</div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                {assignments.length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ClockIcon className="w-8 h-8 text-yellow-600" />
            <div>
              <div className="text-sm text-yellow-800 dark:text-yellow-300">Pending</div>
              <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-200">
                {pendingCount}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-8 h-8 text-green-600" />
            <div>
              <div className="text-sm text-green-800 dark:text-green-300">Completed</div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-200">
                {completedCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          All ({assignments.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'pending'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'completed'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          Completed ({completedCount})
        </button>
      </div>

      {/* Manuals List */}
      {loading && assignments.length === 0 ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <BookOpenIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No manuals to display.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssignments.map(assignment => (
            <ManualCard
              key={assignment.id}
              assignment={assignment}
              onClick={() => setSelectedAssignment(assignment)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyManualsLibrary;
