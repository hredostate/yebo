import React, { useState, useEffect } from 'react';
import type { TransportStop, TransportRoute, Campus } from '../../types';
import { requireSupabaseClient } from '../../services/supabaseClient';
import Spinner from '../common/Spinner';
import { PlusCircleIcon, CloseIcon } from '../common/icons';

interface TransportStopEditorProps {
  schoolId: number;
  currentTermId: number;
  campuses: Campus[];
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

interface StopWithRoute extends TransportStop {
  route?: TransportRoute;
}

export default function TransportStopEditor({
  schoolId,
  currentTermId,
  campuses,
  addToast,
}: TransportStopEditorProps) {
  const [stops, setStops] = useState<StopWithRoute[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRouteId, setFilterRouteId] = useState<number | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editingStop, setEditingStop] = useState<StopWithRoute | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [stopName, setStopName] = useState('');
  const [stopAddress, setStopAddress] = useState('');
  const [routeId, setRouteId] = useState<number | ''>('');
  const [pickupTime, setPickupTime] = useState('');
  const [dropoffTime, setDropoffTime] = useState('');
  const [stopOrder, setStopOrder] = useState(1);
  const [nearCampusId, setNearCampusId] = useState<number | ''>('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadData();
  }, [schoolId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const supabase = requireSupabaseClient();

      // Fetch routes
      const { data: routesData, error: routesError } = await supabase
        .from('transport_routes')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('route_name');

      if (routesError) throw routesError;
      setRoutes(routesData || []);

      // Fetch stops with route info
      const { data: stopsData, error: stopsError } = await supabase
        .from('transport_stops')
        .select(`
          *,
          route:transport_routes(id, route_name, route_code),
          campus:campuses(id, name)
        `)
        .in('route_id', (routesData || []).map(r => r.id))
        .order('route_id')
        .order('stop_order');

      if (stopsError) throw stopsError;
      setStops(stopsData || []);
    } catch (error: any) {
      console.error('Error loading stops:', error);
      addToast(error.message || 'Failed to load stops', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingStop(null);
    setStopName('');
    setStopAddress('');
    setRouteId('');
    setPickupTime('');
    setDropoffTime('');
    setStopOrder(1);
    setNearCampusId('');
    setLatitude('');
    setLongitude('');
    setIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (stop: StopWithRoute) => {
    setEditingStop(stop);
    setStopName(stop.stop_name);
    setStopAddress(stop.stop_address || '');
    setRouteId(stop.route_id);
    setPickupTime(stop.pickup_time || '');
    setDropoffTime(stop.dropoff_time || '');
    setStopOrder(stop.stop_order);
    setNearCampusId(stop.near_campus_id || '');
    setLatitude(stop.latitude?.toString() || '');
    setLongitude(stop.longitude?.toString() || '');
    setIsActive(stop.is_active);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!stopName.trim()) {
      addToast('Stop name is required', 'warning');
      return;
    }
    if (!routeId) {
      addToast('Route is required', 'warning');
      return;
    }

    try {
      setSaving(true);
      const supabase = requireSupabaseClient();

      const stopData = {
        route_id: routeId,
        stop_name: stopName.trim(),
        stop_address: stopAddress.trim() || null,
        pickup_time: pickupTime || null,
        dropoff_time: dropoffTime || null,
        stop_order: stopOrder,
        near_campus_id: nearCampusId || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        is_active: isActive,
      };

      if (editingStop) {
        // Update existing stop
        const { error } = await supabase
          .from('transport_stops')
          .update(stopData)
          .eq('id', editingStop.id);

        if (error) throw error;
        addToast('Stop updated successfully', 'success');
      } else {
        // Create new stop
        const { error } = await supabase
          .from('transport_stops')
          .insert(stopData);

        if (error) throw error;
        addToast('Stop created successfully', 'success');
      }

      setShowModal(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving stop:', error);
      addToast(error.message || 'Failed to save stop', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (stop: StopWithRoute) => {
    if (!confirm(`Are you sure you want to delete stop "${stop.stop_name}"?`)) {
      return;
    }

    try {
      const supabase = requireSupabaseClient();
      const { error } = await supabase
        .from('transport_stops')
        .delete()
        .eq('id', stop.id);

      if (error) throw error;
      addToast('Stop deleted successfully', 'success');
      loadData();
    } catch (error: any) {
      console.error('Error deleting stop:', error);
      addToast(error.message || 'Failed to delete stop', 'error');
    }
  };

  const filteredStops = stops.filter((stop) => {
    const matchesSearch = 
      stop.stop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stop.stop_address?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRoute = !filterRouteId || stop.route_id === filterRouteId;
    return matchesSearch && matchesRoute;
  });

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
          <h2 className="text-2xl font-bold text-gray-900">Transport Stops</h2>
          <p className="text-gray-600 text-sm mt-1">Manage stops along routes</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusCircleIcon className="w-5 h-5" />
          Add Stop
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Search stops..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={filterRouteId}
          onChange={(e) => setFilterRouteId(e.target.value ? Number(e.target.value) : '')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Routes</option>
          {routes.map((route) => (
            <option key={route.id} value={route.id}>
              {route.route_name}
            </option>
          ))}
        </select>
      </div>

      {/* Stops Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stop Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Route
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pickup Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dropoff Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Campus
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredStops.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  {searchTerm || filterRouteId ? 'No stops found matching your filters' : 'No stops yet. Add one to get started!'}
                </td>
              </tr>
            ) : (
              filteredStops.map((stop) => (
                <tr key={stop.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{stop.stop_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 max-w-xs truncate">
                      {stop.stop_address || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{stop.route?.route_name || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{stop.stop_order}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{stop.pickup_time || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{stop.dropoff_time || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{stop.campus?.name || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        stop.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {stop.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEditModal(stop)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(stop)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowModal(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingStop ? 'Edit Stop' : 'Add New Stop'}
                  </h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <CloseIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stop Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={stopName}
                      onChange={(e) => setStopName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Main Gate"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Route <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={routeId}
                      onChange={(e) => setRouteId(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Route</option>
                      {routes.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.route_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={stopAddress}
                      onChange={(e) => setStopAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Full address"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pickup Time
                    </label>
                    <input
                      type="time"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dropoff Time
                    </label>
                    <input
                      type="time"
                      value={dropoffTime}
                      onChange={(e) => setDropoffTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stop Order
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={stopOrder}
                      onChange={(e) => setStopOrder(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Near Campus
                    </label>
                    <select
                      value={nearCampusId}
                      onChange={(e) => setNearCampusId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Campus</option>
                      {campuses.map((campus) => (
                        <option key={campus.id} value={campus.id}>
                          {campus.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 6.5244"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 3.3792"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Active</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  disabled={saving}
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
