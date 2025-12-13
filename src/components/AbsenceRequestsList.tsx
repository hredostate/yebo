import React, { useState, useMemo } from 'react';
import type { AbsenceRequest, AbsenceRequestStatus } from '../types';
import { CheckCircleIcon, XCircleIcon, ClockIcon, FilterIcon, EyeIcon } from './common/icons';

interface AbsenceRequestsListProps {
  requests: AbsenceRequest[];
  canReview: boolean;
  onReviewClick: (request: AbsenceRequest) => void;
}

const AbsenceRequestsList: React.FC<AbsenceRequestsListProps> = ({
  requests,
  canReview,
  onReviewClick
}) => {
  const [statusFilter, setStatusFilter] = useState<AbsenceRequestStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter and search requests
  const filteredRequests = useMemo(() => {
    if (!requests || !Array.isArray(requests)) return [];
    let filtered = requests;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(req => req.status === statusFilter);
    }

    // Search by student name or reason
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(req => 
        req.student?.name.toLowerCase().includes(query) ||
        req.reason.toLowerCase().includes(query)
      );
    }

    // Sort by created_at (newest first)
    return filtered.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [requests, statusFilter, searchQuery]);

  const getStatusBadge = (status: AbsenceRequestStatus) => {
    const badges = {
      pending: {
        icon: ClockIcon,
        class: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
        label: 'Pending'
      },
      approved: {
        icon: CheckCircleIcon,
        class: 'bg-green-500/20 text-green-300 border-green-500/30',
        label: 'Approved'
      },
      denied: {
        icon: XCircleIcon,
        class: 'bg-red-500/20 text-red-300 border-red-500/30',
        label: 'Denied'
      }
    };

    const badge = badges[status];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${badge.class}`}>
        <Icon className="h-3.5 w-3.5" />
        {badge.label}
      </span>
    );
  };

  const getRequestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sick: 'Sick Leave',
      family: 'Family Emergency',
      appointment: 'Medical Appointment',
      vacation: 'Vacation',
      other: 'Other'
    };
    return labels[type] || type;
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    
    if (startDate === endDate) {
      return start.toLocaleDateString('en-US', options);
    }
    
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  const calculateDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both days
    return diffDays === 1 ? '1 day' : `${diffDays} days`;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name or reason..."
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <FilterIcon className="h-5 w-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AbsenceRequestStatus | 'all')}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-400">
        Showing {filteredRequests.length} of {requests?.length || 0} requests
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-12">
          <ClockIcon className="h-12 w-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">No absence requests found</p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-sm text-blue-400 hover:text-blue-300"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map(request => (
            <div
              key={request.id}
              className="glass-panel rounded-xl p-5 hover:bg-white/5 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Main Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white text-lg">
                        {request.student?.name || 'Unknown Student'}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {getRequestTypeLabel(request.request_type)}
                      </p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  {/* Date Range & Duration */}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-300">
                      📅 {formatDateRange(request.start_date, request.end_date)}
                    </span>
                    <span className="text-gray-400">
                      ({calculateDuration(request.start_date, request.end_date)})
                    </span>
                  </div>

                  {/* Reason Preview */}
                  <p className="text-sm text-gray-300 line-clamp-2">
                    {request.reason}
                  </p>

                  {/* Supporting Document */}
                  {request.supporting_document_url && (
                    <a
                      href={request.supporting_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
                    >
                      📎 View Document
                    </a>
                  )}

                  {/* Review Info */}
                  {request.status !== 'pending' && request.reviewer && (
                    <div className="text-xs text-gray-400 pt-2 border-t border-white/5">
                      {request.status === 'approved' ? 'Approved' : 'Denied'} by{' '}
                      {request.reviewer.name}{' '}
                      {request.reviewed_at && (
                        <span>
                          on {new Date(request.reviewed_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onReviewClick(request)}
                    className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg font-medium text-sm transition-colors border border-blue-500/30"
                  >
                    <EyeIcon className="h-4 w-4 inline mr-1.5" />
                    {canReview && request.status === 'pending' ? 'Review' : 'View'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AbsenceRequestsList;
