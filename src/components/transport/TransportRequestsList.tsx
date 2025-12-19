import React, { useState, useEffect } from 'react';
import type { TransportRequest, TransportBus, TransportSubscription, Campus } from '../../types';
import { TransportRequestStatus, TransportSubscriptionStatus } from '../../types';
import { requireSupabaseClient } from '../../services/supabaseClient';
import Spinner from '../common/Spinner';
import { CloseIcon } from '../common/icons';
import BusSeatSelector from './BusSeatSelector';

interface TransportRequestsListProps {
  schoolId: number;
  currentTermId: number;
  campuses: Campus[];
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function TransportRequestsList({
  schoolId,
  currentTermId,
  campuses,
  addToast,
}: TransportRequestsListProps) {
  const [requests, setRequests] = useState<TransportRequest[]>([]);
  const [buses, setBuses] = useState<TransportBus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<TransportRequestStatus | ''>('');
  const [filterRouteId, setFilterRouteId] = useState<number | ''>('');
  const [selectedRequests, setSelectedRequests] = useState<number[]>([]);

  // Approval modal
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvingRequest, setApprovingRequest] = useState<TransportRequest | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<number | ''>('');
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [occupiedSeats, setOccupiedSeats] = useState<TransportSubscription[]>([]);
  const [processing, setProcessing] = useState(false);

  // Rejection modal
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<TransportRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadData();
  }, [schoolId, currentTermId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const supabase = requireSupabaseClient();

      // Fetch requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('transport_requests')
        .select(`
          *,
          student:students(id, name, admission_number, parent_phone_number_1),
          route:transport_routes(id, route_name, route_code),
          stop:transport_stops(id, stop_name),
          preferred_bus:transport_buses(id, bus_number)
        `)
        .eq('school_id', schoolId)
        .eq('term_id', currentTermId)
        .order('requested_at', { ascending: false });

      if (requestsError) throw requestsError;
      setRequests(requestsData || []);

      // Fetch active buses
      const { data: busesData, error: busesError } = await supabase
        .from('transport_buses')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('bus_number');

      if (busesError) throw busesError;
      setBuses(busesData || []);
    } catch (error: any) {
      console.error('Error loading requests:', error);
      addToast(error.message || 'Failed to load requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openApprovalModal = async (request: TransportRequest) => {
    setApprovingRequest(request);
    setSelectedBusId(request.preferred_bus_id || '');
    setSelectedSeat(request.preferred_seat_label || null);

    if (request.preferred_bus_id) {
      await loadOccupiedSeats(request.preferred_bus_id);
    }

    setShowApprovalModal(true);
  };

  const loadOccupiedSeats = async (busId: number) => {
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('transport_subscriptions')
        .select(`
          *,
          student:students(id, name, admission_number)
        `)
        .eq('assigned_bus_id', busId)
        .eq('status', TransportSubscriptionStatus.Active)
        .eq('term_id', currentTermId);

      if (error) throw error;
      setOccupiedSeats(data || []);
    } catch (error: any) {
      console.error('Error loading occupied seats:', error);
    }
  };

  const handleBusChange = async (busId: number) => {
    setSelectedBusId(busId);
    setSelectedSeat(null);
    await loadOccupiedSeats(busId);
  };

  const handleApprove = async () => {
    if (!approvingRequest) return;
    if (!selectedBusId) {
      addToast('Please select a bus', 'warning');
      return;
    }

    try {
      setProcessing(true);
      const supabase = requireSupabaseClient();

      // Update request status
      const { error: requestError } = await supabase
        .from('transport_requests')
        .update({
          status: TransportRequestStatus.Approved,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', approvingRequest.id);

      if (requestError) throw requestError;

      // Create subscription
      const { error: subscriptionError } = await supabase
        .from('transport_subscriptions')
        .insert({
          school_id: schoolId,
          student_id: approvingRequest.student_id,
          term_id: currentTermId,
          route_id: approvingRequest.route_id,
          stop_id: approvingRequest.stop_id,
          assigned_bus_id: selectedBusId,
          seat_label: selectedSeat,
          status: TransportSubscriptionStatus.Active,
          started_at: new Date().toISOString(),
        });

      if (subscriptionError) throw subscriptionError;

      addToast('Request approved successfully', 'success');
      setShowApprovalModal(false);
      loadData();
    } catch (error: any) {
      console.error('Error approving request:', error);
      addToast(error.message || 'Failed to approve request', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const openRejectionModal = (request: TransportRequest) => {
    setRejectingRequest(request);
    setRejectionReason('');
    setShowRejectionModal(true);
  };

  const handleReject = async () => {
    if (!rejectingRequest) return;
    if (!rejectionReason.trim()) {
      addToast('Please provide a rejection reason', 'warning');
      return;
    }

    try {
      setProcessing(true);
      const supabase = requireSupabaseClient();

      const { error } = await supabase
        .from('transport_requests')
        .update({
          status: TransportRequestStatus.Rejected,
          rejection_reason: rejectionReason.trim(),
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', rejectingRequest.id);

      if (error) throw error;

      addToast('Request rejected', 'success');
      setShowRejectionModal(false);
      loadData();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      addToast(error.message || 'Failed to reject request', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleWaitlist = async (request: TransportRequest) => {
    try {
      const supabase = requireSupabaseClient();

      const { error } = await supabase
        .from('transport_requests')
        .update({
          status: TransportRequestStatus.Waitlisted,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (error) throw error;

      addToast('Request moved to waitlist', 'success');
      loadData();
    } catch (error: any) {
      console.error('Error waitlisting request:', error);
      addToast(error.message || 'Failed to waitlist request', 'error');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRequests.length === 0) {
      addToast('Please select requests to approve', 'warning');
      return;
    }

    if (!confirm(`Approve ${selectedRequests.length} selected request(s)?`)) {
      return;
    }

    try {
      const supabase = requireSupabaseClient();

      const { error } = await supabase
        .from('transport_requests')
        .update({
          status: TransportRequestStatus.Approved,
          reviewed_at: new Date().toISOString(),
        })
        .in('id', selectedRequests);

      if (error) throw error;

      addToast(`${selectedRequests.length} request(s) approved`, 'success');
      setSelectedRequests([]);
      loadData();
    } catch (error: any) {
      console.error('Error bulk approving:', error);
      addToast(error.message || 'Failed to approve requests', 'error');
    }
  };

  const toggleRequestSelection = (requestId: number) => {
    setSelectedRequests((prev) =>
      prev.includes(requestId)
        ? prev.filter((id) => id !== requestId)
        : [...prev, requestId]
    );
  };

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.student?.admission_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || request.status === filterStatus;
    const matchesRoute = !filterRouteId || request.route_id === filterRouteId;
    return matchesSearch && matchesStatus && matchesRoute;
  });

  const routes = [...new Map(requests.map(r => [r.route?.id, r.route]).filter(([id]) => id)).values()];

  const getStatusColor = (status: TransportRequestStatus) => {
    switch (status) {
      case TransportRequestStatus.Pending:
        return 'bg-yellow-100 text-yellow-800';
      case TransportRequestStatus.Approved:
        return 'bg-green-100 text-green-800';
      case TransportRequestStatus.Rejected:
        return 'bg-red-100 text-red-800';
      case TransportRequestStatus.Waitlisted:
        return 'bg-blue-100 text-blue-800';
      case TransportRequestStatus.Cancelled:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transport Requests</h2>
          <p className="text-gray-600 text-sm mt-1">Review and manage student transport requests</p>
        </div>
        {selectedRequests.length > 0 && (
          <button
            onClick={handleBulkApprove}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Approve Selected ({selectedRequests.length})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Search students..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TransportRequestStatus | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Status</option>
          <option value={TransportRequestStatus.Pending}>Pending</option>
          <option value={TransportRequestStatus.Approved}>Approved</option>
          <option value={TransportRequestStatus.Rejected}>Rejected</option>
          <option value={TransportRequestStatus.Waitlisted}>Waitlisted</option>
          <option value={TransportRequestStatus.Cancelled}>Cancelled</option>
        </select>
        <select
          value={filterRouteId}
          onChange={(e) => setFilterRouteId(e.target.value ? Number(e.target.value) : '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Routes</option>
          {routes.map((route) => route && (
            <option key={route.id} value={route.id}>
              {route.route_name}
            </option>
          ))}
        </select>
      </div>

      {/* Requests Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={filteredRequests.length > 0 && filteredRequests.every(r => selectedRequests.includes(r.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRequests(filteredRequests.map(r => r.id));
                    } else {
                      setSelectedRequests([]);
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Student
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Route
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stop
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preferred Bus
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Requested
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  No requests found
                </td>
              </tr>
            ) : (
              filteredRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedRequests.includes(request.id)}
                      onChange={() => toggleRequestSelection(request.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{request.student?.name}</div>
                    <div className="text-xs text-gray-500">{request.student?.admission_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{request.route?.route_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{request.stop?.stop_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{request.preferred_bus?.bus_number || '-'}</div>
                    {request.preferred_seat_label && (
                      <div className="text-xs text-gray-400">Seat {request.preferred_seat_label}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(request.requested_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {request.status === TransportRequestStatus.Pending && (
                      <>
                        <button
                          onClick={() => openApprovalModal(request)}
                          className="text-green-600 hover:text-green-900 mr-3"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => openRejectionModal(request)}
                          className="text-red-600 hover:text-red-900 mr-3"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleWaitlist(request)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Waitlist
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && approvingRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowApprovalModal(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Approve Request - {approvingRequest.student?.name}
                  </h3>
                  <button
                    onClick={() => setShowApprovalModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <CloseIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Bus <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedBusId}
                    onChange={(e) => handleBusChange(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Bus</option>
                    {buses.map((bus) => (
                      <option key={bus.id} value={bus.id}>
                        {bus.bus_number} - Capacity: {bus.capacity}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedBusId && (
                  <div className="mt-4">
                    <BusSeatSelector
                      bus={buses.find(b => b.id === selectedBusId)!}
                      selectedSeat={selectedSeat}
                      onSeatSelect={setSelectedSeat}
                      occupiedSeats={occupiedSeats}
                      showOccupantInfo={true}
                    />
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  onClick={handleApprove}
                  disabled={processing || !selectedBusId}
                  className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Approving...' : 'Approve'}
                </button>
                <button
                  onClick={() => setShowApprovalModal(false)}
                  disabled={processing}
                  className="mt-3 sm:mt-0 w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && rejectingRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowRejectionModal(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Reject Request - {rejectingRequest.student?.name}
                  </h3>
                  <button
                    onClick={() => setShowRejectionModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <CloseIcon className="w-6 h-6" />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Explain why this request is being rejected"
                  />
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  onClick={handleReject}
                  disabled={processing}
                  className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Rejecting...' : 'Reject'}
                </button>
                <button
                  onClick={() => setShowRejectionModal(false)}
                  disabled={processing}
                  className="mt-3 sm:mt-0 w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
