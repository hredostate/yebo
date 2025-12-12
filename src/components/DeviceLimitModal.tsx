import React, { useState, useEffect } from 'react';
import { UserSession, getActiveSessions, terminateOldestSession } from '../services/sessionManager';
import Spinner from './common/Spinner';

interface DeviceLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onLogoutOldest: () => Promise<void>;
}

const DeviceLimitModal: React.FC<DeviceLimitModalProps> = ({ isOpen, onClose, userId, onLogoutOldest }) => {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      loadSessions();
    }
  }, [isOpen, userId]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const activeSessions = await getActiveSessions(userId);
      setSessions(activeSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutOldest = async () => {
    setActionLoading(true);
    try {
      await onLogoutOldest();
      onClose();
    } catch (error) {
      console.error('Failed to logout oldest device:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative max-w-lg w-full mx-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Device Limit Reached
          </h2>
          <p className="text-white/90 text-sm mt-1">
            You've reached the maximum of 2 concurrent devices
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-slate-700 dark:text-slate-300 mb-4">
            You are currently logged in on 2 devices. To continue on this device, you must log out from one of your active sessions.
          </p>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Active Sessions:
              </h3>
              
              {sessions.map((session, index) => (
                <div
                  key={session.id}
                  className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {session.device_info || 'Unknown Device'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      IP: {session.ip_address || 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Last active: {formatDate(session.last_active)}
                    </p>
                    {index === sessions.length - 1 && sessions.length > 1 && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 rounded">
                        Oldest session
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            disabled={actionLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleLogoutOldest}
            disabled={actionLoading || loading}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {actionLoading ? (
              <>
                <Spinner size="sm" />
                <span>Logging out...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Log out oldest device</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceLimitModal;
