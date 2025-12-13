import React, { useState, useMemo } from 'react';
import type { AbsenceRequest, Student, UserProfile, AbsenceRequestType } from '../types';
import AbsenceRequestForm from './AbsenceRequestForm';
import AbsenceRequestsList from './AbsenceRequestsList';
import AbsenceRequestReview from './AbsenceRequestReview';
import { PlusCircleIcon, ClockIcon, CheckCircleIcon, XCircleIcon, CalendarIcon } from './common/icons';

interface AbsenceRequestsViewProps {
  absenceRequests: AbsenceRequest[];
  students: Student[];
  currentUserId: string;
  userRole: string;
  userPermissions: string[];
  onCreateRequest: (data: {
    student_id: number;
    request_type: AbsenceRequestType;
    start_date: string;
    end_date: string;
    reason: string;
    supporting_document_url?: string;
  }) => Promise<void>;
  onApproveRequest: (requestId: number, notes: string) => Promise<void>;
  onDenyRequest: (requestId: number, notes: string) => Promise<void>;
}

const AbsenceRequestsView: React.FC<AbsenceRequestsViewProps> = ({
  absenceRequests,
  students,
  currentUserId,
  userRole,
  userPermissions,
  onCreateRequest,
  onApproveRequest,
  onDenyRequest
}) => {
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AbsenceRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');

  // Determine if user can review requests (teachers, admins, principals)
  const canReview = useMemo(() => {
    return userPermissions.includes('*') || 
           userPermissions.includes('manage-students') ||
           ['Admin', 'Principal', 'Team Lead', 'Teacher'].includes(userRole);
  }, [userPermissions, userRole]);

  // Filter requests based on active tab
  const filteredRequests = useMemo(() => {
    if (!absenceRequests || !Array.isArray(absenceRequests)) return [];
    if (activeTab === 'all') return absenceRequests;
    return absenceRequests.filter(req => req.status === activeTab);
  }, [absenceRequests, activeTab]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!absenceRequests || !Array.isArray(absenceRequests)) {
      return { pending: 0, approved: 0, denied: 0, approvedThisMonth: 0 };
    }
    const pending = absenceRequests.filter(r => r.status === 'pending').length;
    const approved = absenceRequests.filter(r => r.status === 'approved').length;
    const denied = absenceRequests.filter(r => r.status === 'denied').length;
    
    // Get approved this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const approvedThisMonth = absenceRequests.filter(r => 
      r.status === 'approved' && new Date(r.reviewed_at || r.created_at) >= startOfMonth
    ).length;

    return { pending, approved, denied, approvedThisMonth };
  }, [absenceRequests]);

  const handleReviewClick = (request: AbsenceRequest) => {
    setSelectedRequest(request);
  };

  const handleCloseReview = () => {
    setSelectedRequest(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Absence Requests</h1>
          <p className="text-gray-400 mt-1">
            {canReview 
              ? 'Manage student absence and time-off requests'
              : 'Submit and track your absence requests'
            }
          </p>
        </div>
        <button
          onClick={() => setShowNewRequestModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg font-medium text-white transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
        >
          <PlusCircleIcon className="h-5 w-5" />
          New Request
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Pending</p>
              <p className="text-3xl font-bold text-yellow-400 mt-1">{stats.pending}</p>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <ClockIcon className="h-8 w-8 text-yellow-400" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Awaiting review</p>
        </div>

        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Approved</p>
              <p className="text-3xl font-bold text-green-400 mt-1">{stats.approved}</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <CheckCircleIcon className="h-8 w-8 text-green-400" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Total approved</p>
        </div>

        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Denied</p>
              <p className="text-3xl font-bold text-red-400 mt-1">{stats.denied}</p>
            </div>
            <div className="p-3 bg-red-500/20 rounded-lg">
              <XCircleIcon className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Total denied</p>
        </div>

        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">This Month</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">{stats.approvedThisMonth}</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <CalendarIcon className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Approved absences</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-panel rounded-xl p-1 inline-flex gap-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
            activeTab === 'all'
              ? 'bg-white/10 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          All ({absenceRequests?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
            activeTab === 'pending'
              ? 'bg-yellow-500/20 text-yellow-300 shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Pending ({stats.pending})
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
            activeTab === 'approved'
              ? 'bg-green-500/20 text-green-300 shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Approved ({stats.approved})
        </button>
        <button
          onClick={() => setActiveTab('denied')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
            activeTab === 'denied'
              ? 'bg-red-500/20 text-red-300 shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Denied ({stats.denied})
        </button>
      </div>

      {/* Requests List */}
      <div className="glass-panel rounded-xl p-6">
        <AbsenceRequestsList
          requests={filteredRequests}
          canReview={canReview}
          onReviewClick={handleReviewClick}
        />
      </div>

      {/* Modals */}
      {showNewRequestModal && (
        <AbsenceRequestForm
          students={students}
          currentUserId={currentUserId}
          userRole={userRole}
          onSubmit={onCreateRequest}
          onClose={() => setShowNewRequestModal(false)}
        />
      )}

      {selectedRequest && (
        <AbsenceRequestReview
          request={selectedRequest}
          canReview={canReview}
          onApprove={onApproveRequest}
          onDeny={onDenyRequest}
          onClose={handleCloseReview}
        />
      )}
    </div>
  );
};

export default AbsenceRequestsView;
