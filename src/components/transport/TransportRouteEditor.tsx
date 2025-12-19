import React, { useState, useEffect } from 'react';
import type { TransportRoute, Campus } from '../../types';
import { TransportSubscriptionStatus } from '../../types';
import { requireSupabaseClient } from '../../services/supabaseClient';
import Spinner from '../common/Spinner';
import { PlusCircleIcon, CloseIcon } from '../common/icons';

interface TransportRouteEditorProps {
  schoolId: number;
  currentTermId: number;
  campuses: Campus[];
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

interface RouteWithStats extends TransportRoute {
  stops_count?: number;
  buses_count?: number;
  subscriptions_count?: number;
}

export default function TransportRouteEditor({
  schoolId,
  currentTermId,
  campuses,
  addToast,
}: TransportRouteEditorProps) {
  const [routes, setRoutes] = useState<RouteWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteWithStats | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [routeName, setRouteName] = useState('');
  const [routeCode, setRouteCode] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCampuses, setSelectedCampuses] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadRoutes();
  }, [schoolId]);

  const loadRoutes = async () => {
    try {
      setLoading(true);
      const supabase = requireSupabaseClient();

      // Fetch routes with stats
      const { data: routesData, error: routesError } = await supabase
        .from('transport_routes')
        .select('*')
        .eq('school_id', schoolId)
        .order('route_name');

      if (routesError) throw routesError;

      // Fetch stats for each route
      const routesWithStats = await Promise.all(
        (routesData || []).map(async (route) => {
          const [stopsResult, busesResult, subsResult] = await Promise.all([
            supabase
              .from('transport_stops')
              .select('id', { count: 'exact', head: true })
              .eq('route_id', route.id),
            supabase
              .from('transport_route_buses')
              .select('id', { count: 'exact', head: true })
              .eq('route_id', route.id),
            supabase
              .from('transport_subscriptions')
              .select('id', { count: 'exact', head: true })
              .eq('route_id', route.id)
              .eq('status', TransportSubscriptionStatus.Active),
          ]);

          return {
            ...route,
            stops_count: stopsResult.count || 0,
            buses_count: busesResult.count || 0,
            subscriptions_count: subsResult.count || 0,
          };
        })
      );

      setRoutes(routesWithStats);
    } catch (error: any) {
      console.error('Error loading routes:', error);
      addToast(error.message || 'Failed to load routes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingRoute(null);
    setRouteName('');
    setRouteCode('');
    setDescription('');
    setSelectedCampuses([]);
    setIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (route: RouteWithStats) => {
    setEditingRoute(route);
    setRouteName(route.route_name);
    setRouteCode(route.route_code || '');
    setDescription(route.description || '');
    setSelectedCampuses(route.serves_campus_ids || []);
    setIsActive(route.is_active);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!routeName.trim()) {
      addToast('Route name is required', 'warning');
      return;
    }

    try {
      setSaving(true);
      const supabase = requireSupabaseClient();

      const routeData = {
        school_id: schoolId,
        route_name: routeName.trim(),
        route_code: routeCode.trim() || null,
        description: description.trim() || null,
        serves_campus_ids: selectedCampuses.length > 0 ? selectedCampuses : null,
        is_active: isActive,
      };

      if (editingRoute) {
        // Update existing route
        const { error } = await supabase
          .from('transport_routes')
          .update(routeData)
          .eq('id', editingRoute.id);

        if (error) throw error;
        addToast('Route updated successfully', 'success');
      } else {
        // Create new route
        const { error } = await supabase
          .from('transport_routes')
          .insert(routeData);

        if (error) throw error;
        addToast('Route created successfully', 'success');
      }

      setShowModal(false);
      loadRoutes();
    } catch (error: any) {
      console.error('Error saving route:', error);
      addToast(error.message || 'Failed to save route', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (route: RouteWithStats) => {
    if (route.stops_count! > 0 || route.subscriptions_count! > 0) {
      addToast(
        `Cannot delete route with ${route.stops_count} stops and ${route.subscriptions_count} active subscriptions`,
        'warning'
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete route "${route.route_name}"?`)) {
      return;
    }

    try {
      const supabase = requireSupabaseClient();
      const { error } = await supabase
        .from('transport_routes')
        .delete()
        .eq('id', route.id);

      if (error) throw error;
      addToast('Route deleted successfully', 'success');
      loadRoutes();
    } catch (error: any) {
      console.error('Error deleting route:', error);
      addToast(error.message || 'Failed to delete route', 'error');
    }
  };

  const toggleCampus = (campusId: number) => {
    setSelectedCampuses((prev) =>
      prev.includes(campusId)
        ? prev.filter((id) => id !== campusId)
        : [...prev, campusId]
    );
  };

  const filteredRoutes = routes.filter((route) =>
    route.route_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.route_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCampusNames = (campusIds: number[] | null) => {
    if (!campusIds || campusIds.length === 0) return 'All Campuses';
    return campusIds
      .map((id) => campuses.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(', ');
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
          <h2 className="text-2xl font-bold text-gray-900">Transport Routes</h2>
          <p className="text-gray-600 text-sm mt-1">Manage school bus routes</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusCircleIcon className="w-5 h-5" />
          Add Route
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search routes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Routes Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Route Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Campuses Served
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stops
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Buses
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
            {filteredRoutes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  {searchTerm ? 'No routes found matching your search' : 'No routes yet. Add one to get started!'}
                </td>
              </tr>
            ) : (
              filteredRoutes.map((route) => (
                <tr key={route.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{route.route_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{route.route_code || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 max-w-xs truncate">
                      {route.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500">
                      {getCampusNames(route.serves_campus_ids)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{route.stops_count}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{route.buses_count}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        route.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {route.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEditModal(route)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(route)}
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

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingRoute ? 'Edit Route' : 'Add New Route'}
                  </h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <CloseIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Route Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Route A"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Route Code
                    </label>
                    <input
                      type="text"
                      value={routeCode}
                      onChange={(e) => setRouteCode(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., RT-A"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Brief description of the route"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Campuses Served
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3">
                      {campuses.map((campus) => (
                        <label key={campus.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedCampuses.includes(campus.id)}
                            onChange={() => toggleCampus(campus.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{campus.name}</span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Leave empty to serve all campuses
                    </p>
                  </div>

                  <div>
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
