import React, { useState } from 'react';
import { CloseIcon } from '../../common/icons';
import type { ManualAssignment } from '../../../types/manuals';
import type { UserProfile } from '../../../types';
import { useManualAssignments } from '../hooks/useManualAssignments';
import Spinner from '../../common/Spinner';

interface AcknowledgmentModalProps {
  assignment: ManualAssignment;
  userProfile: UserProfile;
  onComplete: () => void;
  onCancel: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AcknowledgmentModal: React.FC<AcknowledgmentModalProps> = ({
  assignment,
  userProfile,
  onComplete,
  onCancel,
  addToast,
}) => {
  const [signature, setSignature] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { completeAndAcknowledge, getUserIP } = useManualAssignments();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signature.trim().toLowerCase() !== userProfile.name.trim().toLowerCase()) {
      addToast('Signature must match your name exactly', 'error');
      return;
    }

    setIsSubmitting(true);
    const ipAddress = await getUserIP();
    
    const result = await completeAndAcknowledge(
      assignment.id,
      userProfile.id,
      assignment.manual_id,
      signature,
      ipAddress || undefined
    );

    setIsSubmitting(false);

    if (result.success) {
      onComplete();
    } else {
      addToast(result.error || 'Failed to acknowledge manual', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full m-4 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Acknowledgment Required</h2>
          <button onClick={onCancel} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            {assignment.manual?.acknowledgment_text || 'I confirm that I have read and understood this manual.'}
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Manual:</strong> {assignment.manual?.title}
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
              <strong>Date:</strong> {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Type your full name to acknowledge *
            </label>
            <input
              type="text"
              value={signature}
              onChange={e => setSignature(e.target.value)}
              placeholder={userProfile.name}
              required
              className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
            />
            <p className="text-xs text-slate-500 mt-1">
              Your signature and IP address will be recorded for compliance purposes.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-500/20 font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg flex items-center disabled:opacity-50"
            >
              {isSubmitting && <Spinner size="sm" />}
              <span className={isSubmitting ? 'ml-2' : ''}>
                {isSubmitting ? 'Submitting...' : 'I Acknowledge'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AcknowledgmentModal;
