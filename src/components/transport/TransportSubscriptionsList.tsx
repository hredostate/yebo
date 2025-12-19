import React, { useState, useEffect } from 'react';
import type { TransportSubscription, TransportBus, Campus } from '../../types';
import { TransportSubscriptionStatus } from '../../types';
import { requireSupabaseClient } from '../../services/supabaseClient';
import Spinner from '../common/Spinner';
import { CloseIcon, EyeIcon } from '../common/icons';
import BusSeatSelector from './BusSeatSelector';

interface TransportSubscriptionsListProps {
  schoolId: number;
  currentTermId: number;
  campuses: Campus[];
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function TransportSubscriptionsList({
  schoolId,
  currentTermId,
  campuses,
  addToast,
}: TransportSubscriptionsListProps) {
  const [subscriptions, setSubscriptions] = useState<TransportSubscription[]>([]);
  const [buses, setBuses] = useState<TransportBus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<TransportSubscriptionStatus | ''>('');
  const [filterRouteId, setFilterRouteId] = useState<number | ''>('');
  const [filterBusId, setFilterBusId] = useState<number | ''>('');
  const [filterCampusId, setFilterCampusId] = useState<number | ''>('');

  // Change seat modal
  const [showChangeSeatModal, setShowChangeSeatModal] = useState(false);
  const [changingSeatSubscription, setChangingSeatSubscription] = useState<TransportSubscription | null>(null);
  const [newSeat, setNewSeat] = useState<string | null>(null);
  const [occupiedSeats, setOccupiedSeats] = useState<TransportSubscription[]>([]);
  const [processing, setProcessing] = useState(false);

  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState<TransportSubscription | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  useEffect(() => {
    loadData();
  }, [schoolId, currentTermId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const supabase = requireSupabaseClient();

      // Fetch subscriptions
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from('transport_subscriptions')
        .select(`
          *,
          student:students(id, name, admission_number, parent_phone_number_1),
          route:transport_routes(id, route_name, route_code),
          stop:transport_stops(id, stop_name),
          assigned_bus:transport_buses(id, bus_number),
          campus:campuses(id, name)
        `)
        .eq('school_id', schoolId)
        .eq('term_id', currentTermId)
        .order('started_at', { ascending: false });

      if (subscriptionsError) throw subscriptionsError;
      setSubscriptions(subscriptionsData || []);

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
      console.error('Error loading subscriptions:', error);
      addToast(error.message || 'Failed to load subscriptions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (subscription: TransportSubscription) => {
    if (!confirm(`Suspend transport subscription for ${subscription.student?.name}?`)) {
      return;
    }

    try {
      const supabase = requireSupabaseClient();
      const { error } = await supabase
        .from('transport_subscriptions')
        .update({ status: TransportSubscriptionStatus.Suspended })
        .eq('id', subscription.id);

      if (error) throw error;
      addToast('Subscription suspended', 'success');
      loadData();
    } catch (error: any) {
      console.error('Error suspending subscription:', error);
      addToast(error.message || 'Failed to suspend subscription', 'error');
    }
  };

  const handleReactivate = async (subscription: TransportSubscription) => {
    try {
      const supabase = requireSupabaseClient();
      const { error } = await supabase
        .from('transport_subscriptions')
        .update({ status: TransportSubscriptionStatus.Active })
        .eq('id', subscription.id);

      if (error) throw error;
      addToast('Subscription reactivated', 'success');
      loadData();
    } catch (error: any) {
      console.error('Error reactivating subscription:', error);
      addToast(error.message || 'Failed to reactivate subscription', 'error');
    }
  };

  const openCancelModal = (subscription: TransportSubscription) => {
    setCancellingSubscription(subscription);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  const handleCancel = async () => {
    if (!cancellingSubscription) return;

    try {
      setProcessing(true);
      const supabase = requireSupabaseClient();

      const { error } = await supabase
        .from('transport_subscriptions')
        .update({
          status: TransportSubscriptionStatus.Cancelled,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: cancellationReason.trim() || null,
        })
        .eq('id', cancellingSubscription.id);

      if (error) throw error;

      addToast('Subscription cancelled', 'success');
      setShowCancelModal(false);
      loadData();
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      addToast(error.message || 'Failed to cancel subscription', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const openChangeSeatModal = async (subscription: TransportSubscription) => {
    setChangingSeatSubscription(subscription);
    setNewSeat(subscription.seat_label || null);

    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('transport_subscriptions')
        .select(`
          *,
          student:students(id, name, admission_number)
        `)
        .eq('assigned_bus_id', subscription.assigned_bus_id)
        .eq('status', TransportSubscriptionStatus.Active)
        .eq('term_id', currentTermId)
        .neq('id', subscription.id);

      if (error) throw error;
      setOccupiedSeats(data || []);
      setShowChangeSeatModal(true);
    } catch (error: any) {
      console.error('Error loading seat map:', error);
      addToast(error.message || 'Failed to load seat map', 'error');
    }
  };

  const handleChangeSeat = async () => {
    if (!changingSeatSubscription) return;

    try {
      setProcessing(true);
      const supabase = requireSupabaseClient();

      const { error } = await supabase
        .from('transport_subscriptions')
        .update({ seat_label: newSeat })
        .eq('id', changingSeatSubscription.id);

      if (error) throw error;

      addToast('Seat changed successfully', 'success');
      setShowChangeSeatModal(false);
      loadData();
    } catch (error: any) {
      console.error('Error changing seat:', error);
      addToast(error.message || 'Failed to change seat', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Student Name', 'Admission #', 'Route', 'Stop', 'Bus', 'Seat', 'Campus', 'Status', 'Start Date'];
    const rows = filteredSubscriptions.map(sub => [
      sub.student?.name || '',
      sub.student?.admission_number || '',
      sub.route?.route_name || '',
      sub.stop?.stop_name || '',
      sub.assigned_bus?.bus_number || '',
      sub.seat_label || '',
      sub.campus?.name || '',
      sub.status,
      new Date(sub.started_at).toLocaleDateString(),
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transport_subscriptions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesSearch =
      sub.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.student?.admission_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || sub.status === filterStatus;
    const matchesRoute = !filterRouteId || sub.route_id === filterRouteId;
    const matchesBus = !filterBusId || sub.assigned_bus_id === filterBusId;
    const matchesCampus = !filterCampusId || sub.student_campus_id === filterCampusId;
    return matchesSearch && matchesStatus && matchesRoute && matchesBus && matchesCampus;
  });

  const routes = [...new Map(subscriptions.map(s => [s.route?.id, s.route]).filter(([id]) => id)).values()];

  const getStatusColor = (status: TransportSubscriptionStatus) => {
    switch (status) {
      case TransportSubscriptionStatus.Active:
        return 'bg-green-100 text-green-800';
      case TransportSubscriptionStatus.Suspended:
        return 'bg-yellow-100 text-yellow-800';
      case TransportSubscriptionStatus.Cancelled:
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
          <h2 className="text-2xl font-bold text-gray-900">Transport Subscriptions</h2>
          <p className="text-gray-600 text-sm mt-1">Manage active transport subscriptions</p>
        </div>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Export to CSV
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-5 gap-4">
        <input
          type="text"
          placeholder="Search students..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="col-span-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TransportSubscriptionStatus | '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Status</option>
          <option value={TransportSubscriptionStatus.Active}>Active</option>
          <option value={TransportSubscriptionStatus.Suspended}>Suspended</option>
          <option value={TransportSubscriptionStatus.Cancelled}>Cancelled</option>
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
        <select
          value={filterBusId}
          onChange={(e) => setFilterBusId(e.target.value ? Number(e.target.value) : '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Buses</option>
          {buses.map((bus) => (
            <option key={bus.id} value={bus.id}>
              {bus.bus_number}
            </option>
          ))}
        </select>
      </div>

      {/* Subscriptions Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
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
                Bus
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Seat
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Campus
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Start Date
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSubscriptions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  No subscriptions found
                </td>
              </tr>
            ) : (
              filteredSubscriptions.map((subscription) => (
                <tr key={subscription.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{subscription.student?.name}</div>
                    <div className="text-xs text-gray-500">{subscription.student?.admission_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{subscription.route?.route_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{subscription.stop?.stop_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{subscription.assigned_bus?.bus_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{subscription.seat_label || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{subscription.campus?.name || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(subscription.status)}`}>
                      {subscription.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(subscription.started_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {subscription.status === TransportSubscriptionStatus.Active && (
                      <>
                        <button
                          onClick={() => openChangeSeatModal(subscription)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Change Seat
                        </button>
                        <button
                          onClick={() => handleSuspend(subscription)}
                          className="text-yellow-600 hover:text-yellow-900 mr-3"
                        >
                          Suspend
                        </button>
                        <button
                          onClick={() => openCancelModal(subscription)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {subscription.status === TransportSubscriptionStatus.Suspended && (
                      <button
                        onClick={() => handleReactivate(subscription)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Change Seat Modal */}
      {showChangeSeatModal && changingSeatSubscription && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowChangeSeatModal(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Change Seat - {changingSeatSubscription.student?.name}
                  </h3>
                  <button
                    onClick={() => setShowChangeSeatModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <CloseIcon className="w-6 h-6" />
                  </button>
                </div>

                <BusSeatSelector
                  bus={changingSeatSubscription.assigned_bus!}
                  selectedSeat={newSeat}
                  onSeatSelect={setNewSeat}
                  occupiedSeats={occupiedSeats}
                  showOccupantInfo={true}
                />
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  onClick={handleChangeSeat}
                  disabled={processing}
                  className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setShowChangeSeatModal(false)}
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

      {/* Cancel Modal */}
      {showCancelModal && cancellingSubscription && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowCancelModal(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Cancel Subscription - {cancellingSubscription.student?.name}
                  </h3>
                  <button
                    onClick={() => setShowCancelModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <CloseIcon className="w-6 h-6" />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cancellation Reason (optional)
                  </label>
                  <textarea
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Reason for cancellation"
                  />
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  onClick={handleCancel}
                  disabled={processing}
                  className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Cancelling...' : 'Cancel Subscription'}
                </button>
                <button
                  onClick={() => setShowCancelModal(false)}
                  disabled={processing}
                  className="mt-3 sm:mt-0 w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
