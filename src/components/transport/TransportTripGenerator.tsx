import React, { useState, useEffect } from 'react';
import type { TransportTrip, TransportRoute, Campus } from '../../types';
import { TransportDirection, TransportTripStatus } from '../../types';
import { requireSupabaseClient } from '../../services/supabaseClient';
import Spinner from '../common/Spinner';
import { PlusCircleIcon, CloseIcon } from '../common/icons';

interface TransportTripGeneratorProps {
  schoolId: number;
  currentTermId: number;
  campuses: Campus[];
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

interface TripWithDetails extends TransportTrip {
  route?: TransportRoute;
  buses_count?: number;
}

export default function TransportTripGenerator({
  schoolId,
  currentTermId,
  campuses,
  addToast,
}: TransportTripGeneratorProps) {
  const [trips, setTrips] = useState<TripWithDetails[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Generate form
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRoutes, setSelectedRoutes] = useState<number[]>([]);
  const [generateMorning, setGenerateMorning] = useState(true);
  const [generateAfternoon, setGenerateAfternoon] = useState(true);

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

      // Fetch trips
      const { data: tripsData, error: tripsError } = await supabase
        .from('transport_trips')
        .select(`
          *,
          route:transport_routes(id, route_name, route_code)
        `)
        .in('route_id', (routesData || []).map(r => r.id))
        .gte('trip_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('trip_date', { ascending: false })
        .order('direction');

      if (tripsError) throw tripsError;

      // Fetch bus counts for each trip
      const tripsWithDetails = await Promise.all(
        (tripsData || []).map(async (trip) => {
          const { count } = await supabase
            .from('transport_trip_buses')
            .select('id', { count: 'exact', head: true })
            .eq('trip_id', trip.id);

          return {
            ...trip,
            buses_count: count || 0,
          };
        })
      );

      setTrips(tripsWithDetails);
    } catch (error: any) {
      console.error('Error loading data:', error);
      addToast(error.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openGenerateModal = () => {
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    setSelectedRoutes([]);
    setGenerateMorning(true);
    setGenerateAfternoon(true);
    setShowGenerateModal(true);
  };

  const generateTrips = async () => {
    if (selectedRoutes.length === 0) {
      addToast('Please select at least one route', 'warning');
      return;
    }

    if (!generateMorning && !generateAfternoon) {
      addToast('Please select at least one direction', 'warning');
      return;
    }

    try {
      setGenerating(true);
      const supabase = requireSupabaseClient();

      const start = new Date(startDate);
      const end = new Date(endDate);
      const tripsToCreate: any[] = [];

      // Generate trips for each day in the range
      // We use a mutable currentDate and increment it each iteration
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];

        for (const routeId of selectedRoutes) {
          if (generateMorning) {
            tripsToCreate.push({
              route_id: routeId,
              trip_date: dateStr,
              direction: TransportDirection.MorningPickup,
              status: TransportTripStatus.Scheduled,
            });
          }

          if (generateAfternoon) {
            tripsToCreate.push({
              route_id: routeId,
              trip_date: dateStr,
              direction: TransportDirection.AfternoonDropoff,
              status: TransportTripStatus.Scheduled,
            });
          }
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const { error } = await supabase
        .from('transport_trips')
        .insert(tripsToCreate);

      if (error) throw error;

      addToast(`${tripsToCreate.length} trip(s) generated successfully`, 'success');
      setShowGenerateModal(false);
      loadData();
    } catch (error: any) {
      console.error('Error generating trips:', error);
      addToast(error.message || 'Failed to generate trips', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const generateBulk = async (period: 'week' | 'month') => {
    const today = new Date();
    const end = new Date(today);
    
    if (period === 'week') {
      end.setDate(today.getDate() + 7);
    } else {
      end.setMonth(today.getMonth() + 1);
    }

    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    setSelectedRoutes(routes.map(r => r.id));
    setShowGenerateModal(true);
  };

  const updateTripStatus = async (tripId: number, status: TransportTripStatus) => {
    try {
      const supabase = requireSupabaseClient();

      const { error } = await supabase
        .from('transport_trips')
        .update({ status })
        .eq('id', tripId);

      if (error) throw error;

      addToast(`Trip status updated to ${status}`, 'success');
      loadData();
    } catch (error: any) {
      console.error('Error updating trip status:', error);
      addToast(error.message || 'Failed to update trip status', 'error');
    }
  };

  const toggleRoute = (routeId: number) => {
    setSelectedRoutes((prev) =>
      prev.includes(routeId)
        ? prev.filter((id) => id !== routeId)
        : [...prev, routeId]
    );
  };

  const getStatusColor = (status: TransportTripStatus) => {
    switch (status) {
      case TransportTripStatus.Scheduled:
        return 'bg-blue-100 text-blue-800';
      case TransportTripStatus.InProgress:
        return 'bg-yellow-100 text-yellow-800';
      case TransportTripStatus.Completed:
        return 'bg-green-100 text-green-800';
      case TransportTripStatus.Cancelled:
        return 'bg-red-100 text-red-800';
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
          <h2 className="text-2xl font-bold text-gray-900">Trip Generator</h2>
          <p className="text-gray-600 text-sm mt-1">Generate and manage daily transport trips</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => generateBulk('week')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Generate Week
          </button>
          <button
            onClick={() => generateBulk('month')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Generate Month
          </button>
          <button
            onClick={openGenerateModal}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <PlusCircleIcon className="w-5 h-5" />
            Custom Generate
          </button>
        </div>
      </div>

      {/* Trips Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Route
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Direction
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Buses
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {trips.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No trips generated yet. Click a button above to get started!
                </td>
              </tr>
            ) : (
              trips.map((trip) => (
                <tr key={trip.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(trip.trip_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{trip.route?.route_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {trip.direction === TransportDirection.MorningPickup ? 'Morning Pickup' : 'Afternoon Dropoff'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(trip.status)}`}>
                      {trip.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {trip.buses_count || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {trip.status === TransportTripStatus.Scheduled && (
                      <>
                        <button
                          onClick={() => updateTripStatus(trip.id, TransportTripStatus.InProgress)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Start
                        </button>
                        <button
                          onClick={() => updateTripStatus(trip.id, TransportTripStatus.Cancelled)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {trip.status === TransportTripStatus.InProgress && (
                      <button
                        onClick={() => updateTripStatus(trip.id, TransportTripStatus.Completed)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowGenerateModal(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Generate Trips
                  </h3>
                  <button
                    onClick={() => setShowGenerateModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <CloseIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Routes
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedRoutes.length === routes.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRoutes(routes.map(r => r.id));
                            } else {
                              setSelectedRoutes([]);
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-700">All Routes</span>
                      </label>
                      <hr />
                      {routes.map((route) => (
                        <label key={route.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedRoutes.includes(route.id)}
                            onChange={() => toggleRoute(route.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{route.route_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Directions
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={generateMorning}
                          onChange={(e) => setGenerateMorning(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Morning Pickup</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={generateAfternoon}
                          onChange={(e) => setGenerateAfternoon(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Afternoon Dropoff</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  onClick={generateTrips}
                  disabled={generating}
                  className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? 'Generating...' : 'Generate'}
                </button>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  disabled={generating}
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
