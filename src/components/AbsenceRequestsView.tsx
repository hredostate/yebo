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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            Absence Requests
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">
            {canReview 
              ? 'Manage student absence and time-off requests'
              : 'Submit and track your absence requests'
            }
          </p>
        </div>
        <button
          onClick={() => setShowNewRequestModal(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md transition-colors flex items-center gap-2"
        >
          <PlusCircleIcon className="h-5 w-5" />
          New Request
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-5 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-amber-100 text-sm">Pending</p>
              <p className="text-3xl font-bold mt-1">{stats.pending}</p>
            </div>
            <ClockIcon className="w-8 h-8 text-amber-200" />
          </div>
          <p className="text-xs text-amber-100 mt-2">Awaiting review</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-100 text-sm">Approved</p>
              <p className="text-3xl font-bold mt-1">{stats.approved}</p>
            </div>
            <CheckCircleIcon className="w-8 h-8 text-green-200" />
          </div>
          <p className="text-xs text-green-100 mt-2">Total approved</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-5 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-red-100 text-sm">Denied</p>
              <p className="text-3xl font-bold mt-1">{stats.denied}</p>
            </div>
            <XCircleIcon className="w-8 h-8 text-red-200" />
          </div>
          <p className="text-xs text-red-100 mt-2">Total denied</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-sm">This Month</p>
              <p className="text-3xl font-bold mt-1">{stats.approvedThisMonth}</p>
            </div>
            <CalendarIcon className="w-8 h-8 text-blue-200" />
          </div>
          <p className="text-xs text-blue-100 mt-2">Approved absences</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-1 inline-flex gap-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
            activeTab === 'all'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          All ({absenceRequests?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
            activeTab === 'pending'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Pending ({stats.pending})
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
            activeTab === 'approved'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Approved ({stats.approved})
        </button>
        <button
          onClick={() => setActiveTab('denied')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
            activeTab === 'denied'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Denied ({stats.denied})
        </button>
      </div>

      {/* Requests List */}
      <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6 shadow-xl">
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
