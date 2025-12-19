import React, { useState } from 'react';
import { EyeIcon, CheckCircleIcon, FileTextIcon, UsersIcon } from '../../common/icons';
import type { Manual } from '../../../types/manuals';
import type { UserProfile } from '../../../types';
import { useManuals } from '../hooks/useManuals';
import Spinner from '../../common/Spinner';

interface ManualsListProps {
  manuals: Manual[];
  loading: boolean;
  schoolId: number;
  userProfile: UserProfile;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onRefresh: () => void;
}

const ManualsList: React.FC<ManualsListProps> = ({ manuals, loading, schoolId, userProfile, addToast, onRefresh }) => {
  const { publishManual, archiveManual, deleteManual } = useManuals(schoolId);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const handlePublish = async (manualId: number) => {
    setActionLoading(manualId);
    const result = await publishManual(manualId, userProfile.id);
    setActionLoading(null);

    if (result.success) {
      addToast('Manual published successfully!', 'success');
      onRefresh();
    } else {
      addToast(result.error || 'Failed to publish manual', 'error');
    }
  };

  const handleArchive = async (manualId: number) => {
    if (!confirm('Are you sure you want to archive this manual?')) return;

    setActionLoading(manualId);
    const result = await archiveManual(manualId);
    setActionLoading(null);

    if (result.success) {
      addToast('Manual archived successfully!', 'success');
      onRefresh();
    } else {
      addToast(result.error || 'Failed to archive manual', 'error');
    }
  };

  const handleDelete = async (manualId: number) => {
    if (!confirm('Are you sure you want to delete this manual? This action cannot be undone.')) return;

    setActionLoading(manualId);
    const result = await deleteManual(manualId);
    setActionLoading(null);

    if (result.success) {
      addToast('Manual deleted successfully!', 'success');
      onRefresh();
    } else {
      addToast(result.error || 'Failed to delete manual', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[status as keyof typeof colors] || colors.draft}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading && manuals.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner />
      </div>
    );
  }

  if (manuals.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <FileTextIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>No manuals uploaded yet.</p>
        <p className="text-sm">Click "Upload Manual" to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {manuals.map(manual => (
        <div
          key={manual.id}
          className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {manual.title}
                </h3>
                {getStatusBadge(manual.status)}
                {manual.is_compulsory && (
                  <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                    COMPULSORY
                  </span>
                )}
              </div>

              {manual.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  {manual.description}
                </p>
              )}

              <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span>Category: {manual.category}</span>
                <span>Version: {manual.version}</span>
                <span>Size: {(manual.file_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                {manual.is_compulsory && (
                  <span>Complete in: {manual.days_to_complete} days</span>
                )}
              </div>
            </div>

            <div className="flex gap-2 ml-4">
              <a
                href={manual.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition"
                title="View PDF"
              >
                <EyeIcon className="w-5 h-5" />
              </a>

              {manual.status === 'draft' && (
                <button
                  onClick={() => handlePublish(manual.id)}
                  disabled={actionLoading === manual.id}
                  className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition"
                  title="Publish"
                >
                  {actionLoading === manual.id ? (
                    <Spinner size="sm" />
                  ) : (
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  )}
                </button>
              )}

              {manual.status === 'published' && (
                <button
                  onClick={() => handleArchive(manual.id)}
                  disabled={actionLoading === manual.id}
                  className="px-3 py-1 text-sm hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition"
                >
                  Archive
                </button>
              )}

              {manual.status !== 'published' && (
                <button
                  onClick={() => handleDelete(manual.id)}
                  disabled={actionLoading === manual.id}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ManualsList;
