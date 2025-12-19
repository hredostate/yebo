import React, { useState, useEffect } from 'react';
import { PlusCircleIcon, BookOpenIcon, ChartBarIcon } from '../../common/icons';
import type { UserProfile } from '../../../types';
import { useManuals } from '../hooks/useManuals';
import ManualUploadModal from './ManualUploadModal';
import ManualsList from './ManualsList';
import ComplianceDashboard from './ComplianceDashboard';

interface ManualsManagerProps {
  userProfile: UserProfile;
  schoolId: number;
  roles: string[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type ViewTab = 'manuals' | 'compliance';

const ManualsManager: React.FC<ManualsManagerProps> = ({ userProfile, schoolId, roles, addToast }) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('manuals');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const { manuals, loading, error, fetchManuals, uploadManual } = useManuals(schoolId);

  useEffect(() => {
    fetchManuals();
  }, []);

  useEffect(() => {
    if (error) {
      addToast(error, 'error');
    }
  }, [error]);

  const handleUpload = async (file: File, formData: any) => {
    const result = await uploadManual(file, formData, userProfile.id);
    if (result.data) {
      addToast('Manual uploaded successfully!', 'success');
      return { success: true, error: null };
    }
    return { success: false, error: result.error };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Instruction Manuals</h1>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <PlusCircleIcon className="w-5 h-5" />
          Upload Manual
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('manuals')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition ${
            activeTab === 'manuals'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 dark:text-slate-400'
          }`}
        >
          <BookOpenIcon className="w-5 h-5" />
          Manuals
        </button>
        <button
          onClick={() => setActiveTab('compliance')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition ${
            activeTab === 'compliance'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 dark:text-slate-400'
          }`}
        >
          <ChartBarIcon className="w-5 h-5" />
          Compliance Dashboard
        </button>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'manuals' && (
          <ManualsList
            manuals={manuals}
            loading={loading}
            schoolId={schoolId}
            userProfile={userProfile}
            addToast={addToast}
            onRefresh={fetchManuals}
          />
        )}

        {activeTab === 'compliance' && (
          <ComplianceDashboard schoolId={schoolId} addToast={addToast} />
        )}
      </div>

      {/* Upload Modal */}
      <ManualUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
        roles={roles as any[]}
      />
    </div>
  );
};

export default ManualsManager;
