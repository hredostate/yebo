import React, { useState, useEffect } from 'react';
import { CloseIcon } from '../../common/icons';
import type { ManualAssignment } from '../../../types/manuals';
import type { UserProfile } from '../../../types';
import { useManualAssignments } from '../hooks/useManualAssignments';
import AcknowledgmentModal from './AcknowledgmentModal';

interface ManualViewerProps {
  assignment: ManualAssignment;
  userProfile: UserProfile;
  onClose: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ManualViewer: React.FC<ManualViewerProps> = ({ assignment, userProfile, onClose, addToast }) => {
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const { startReading, createReadSession } = useManualAssignments();

  useEffect(() => {
    // Start reading session if not already started
    if (assignment.status === 'pending') {
      startReading(assignment.id, userProfile.id, assignment.manual_id);
    }

    // Create a read session
    createReadSession(assignment.id, userProfile.id, assignment.manual_id).then(result => {
      if (result.sessionId) {
        setSessionId(result.sessionId);
      }
    });
  }, []);

  const handleComplete = () => {
    if (assignment.manual?.requires_acknowledgment) {
      setShowAcknowledgment(true);
    } else {
      addToast('Manual marked as complete!', 'success');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 p-4 flex justify-between items-center">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">{assignment.manual?.title}</h2>
          <p className="text-sm text-slate-300">{assignment.manual?.category}</p>
        </div>
        <div className="flex gap-2">
          {assignment.status !== 'completed' && (
            <button
              onClick={handleComplete}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Complete Reading
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition text-white"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={`${assignment.manual?.file_url}#view=FitH`}
          className="w-full h-full"
          title="Manual PDF"
        />
      </div>

      {/* Acknowledgment Modal */}
      {showAcknowledgment && assignment.manual && (
        <AcknowledgmentModal
          assignment={assignment}
          userProfile={userProfile}
          onComplete={() => {
            addToast('Manual completed and acknowledged!', 'success');
            onClose();
          }}
          onCancel={() => setShowAcknowledgment(false)}
          addToast={addToast}
        />
      )}
    </div>
  );
};

export default ManualViewer;
