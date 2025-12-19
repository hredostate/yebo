import React, { useState, useEffect } from 'react';
import type { TransportSubscription, TransportRoute, TransportBus, Campus } from '../../types';
import { TransportDirection } from '../../types';
import { requireSupabaseClient } from '../../services/supabaseClient';
import Spinner from '../common/Spinner';

interface TransportManifestProps {
  schoolId: number;
  currentTermId: number;
  campuses: Campus[];
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

interface ManifestEntry {
  subscription: TransportSubscription;
  stopOrder: number;
  stopName: string;
  attended?: boolean;
}

export default function TransportManifest({
  schoolId,
  currentTermId,
  campuses,
  addToast,
}: TransportManifestProps) {
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [buses, setBuses] = useState<TransportBus[]>([]);
  const [loading, setLoading] = useState(true);
  const [manifestEntries, setManifestEntries] = useState<ManifestEntry[]>([]);
  const [loadingManifest, setLoadingManifest] = useState(false);

  // Filters
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [direction, setDirection] = useState<TransportDirection>(TransportDirection.MorningPickup);
  const [viewType, setViewType] = useState<'route' | 'bus'>('route');
  const [selectedRouteId, setSelectedRouteId] = useState<number | ''>('');
  const [selectedBusId, setSelectedBusId] = useState<number | ''>('');

  useEffect(() => {
    loadData();
  }, [schoolId]);

  useEffect(() => {
    if (selectedRouteId || selectedBusId) {
      loadManifest();
    }
  }, [selectedDate, direction, selectedRouteId, selectedBusId]);

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

      // Fetch buses
      const { data: busesData, error: busesError } = await supabase
        .from('transport_buses')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('bus_number');

      if (busesError) throw busesError;
      setBuses(busesData || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      addToast(error.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadManifest = async () => {
    try {
      setLoadingManifest(true);
      const supabase = requireSupabaseClient();

      let query = supabase
        .from('transport_subscriptions')
        .select(`
          *,
          student:students(id, name, admission_number, parent_phone_number_1),
          route:transport_routes(id, route_name),
          stop:transport_stops(id, stop_name, stop_order),
          assigned_bus:transport_buses(id, bus_number)
        `)
        .eq('school_id', schoolId)
        .eq('term_id', currentTermId)
        .eq('status', 'active');

      if (viewType === 'route' && selectedRouteId) {
        query = query.eq('route_id', selectedRouteId);
      } else if (viewType === 'bus' && selectedBusId) {
        query = query.eq('assigned_bus_id', selectedBusId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform and sort by stop order
      const entries: ManifestEntry[] = (data || []).map(sub => ({
        subscription: sub,
        stopOrder: sub.stop?.stop_order || 0,
        stopName: sub.stop?.stop_name || '',
        attended: undefined,
      })).sort((a, b) => a.stopOrder - b.stopOrder);

      setManifestEntries(entries);
    } catch (error: any) {
      console.error('Error loading manifest:', error);
      addToast(error.message || 'Failed to load manifest', 'error');
    } finally {
      setLoadingManifest(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    addToast('PDF export functionality would be implemented with a library like jsPDF', 'info');
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
      <div className="flex justify-between items-center mb-6 print:mb-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 print:text-xl">Transport Manifest</h2>
          <p className="text-gray-600 text-sm mt-1 print:hidden">Daily bus roster and attendance</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Print
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-4 gap-4 print:hidden">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Direction
          </label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as TransportDirection)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={TransportDirection.MorningPickup}>Morning Pickup</option>
            <option value={TransportDirection.AfternoonDropoff}>Afternoon Dropoff</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            View By
          </label>
          <select
            value={viewType}
            onChange={(e) => {
              setViewType(e.target.value as 'route' | 'bus');
              setSelectedRouteId('');
              setSelectedBusId('');
              setManifestEntries([]);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="route">By Route</option>
            <option value="bus">By Bus</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {viewType === 'route' ? 'Select Route' : 'Select Bus'}
          </label>
          {viewType === 'route' ? (
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Route</option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.route_name}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedBusId}
              onChange={(e) => setSelectedBusId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Bus</option>
              {buses.map((bus) => (
                <option key={bus.id} value={bus.id}>
                  {bus.bus_number}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Manifest Info */}
      {(selectedRouteId || selectedBusId) && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Date:</span>{' '}
              <span className="text-gray-900">{new Date(selectedDate).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Direction:</span>{' '}
              <span className="text-gray-900">
                {direction === TransportDirection.MorningPickup ? 'Morning Pickup' : 'Afternoon Dropoff'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Total Students:</span>{' '}
              <span className="text-gray-900">{manifestEntries.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Manifest Table */}
      {loadingManifest ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : !selectedRouteId && !selectedBusId ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          Please select a route or bus to view the manifest
        </div>
      ) : manifestEntries.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          No students found for this route/bus
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stop
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Admission #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parent Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print:hidden">
                  Attendance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {manifestEntries.map((entry, index) => (
                <tr key={entry.subscription.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{entry.stopName}</div>
                    <div className="text-xs text-gray-500">Stop #{entry.stopOrder}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {entry.subscription.student?.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.subscription.student?.admission_number || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.subscription.seat_label || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.subscription.student?.parent_phone_number_1 || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm print:hidden">
                    <input
                      type="checkbox"
                      checked={entry.attended || false}
                      onChange={(e) => {
                        const newEntries = [...manifestEntries];
                        newEntries[index].attended = e.target.checked;
                        setManifestEntries(newEntries);
                      }}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          table, table * {
            visibility: visible;
          }
          table {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
