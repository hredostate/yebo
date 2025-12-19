import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../../services/supabaseClient';
import type { 
  TransportRoute, 
  TransportStop, 
  TransportBus, 
  RouteAvailability,
  Student,
  Term,
  TransportRequest,
  TransportRequestStatus,
  TransportSubscription,
  TransportSubscriptionStatus
} from '../../types';
import BusSeatSelector from './BusSeatSelector';
import { handleSupabaseError } from '../../utils/errorHandling';

interface StudentTransportationProps {
  student: Student;
  currentTerm: Term;
  onClose: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  initialTab?: 'my-transport' | 'sign-up' | 'history';
}

type SignUpStep = 'route' | 'stop' | 'seat' | 'confirm' | 'success';
type TabType = 'my-transport' | 'sign-up' | 'history';

export default function StudentTransportation({
  student,
  currentTerm,
  onClose,
  addToast,
  initialTab,
}: StudentTransportationProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'sign-up');
  const [activeSubscription, setActiveSubscription] = useState<TransportSubscription | null>(null);
  const [transportHistory, setTransportHistory] = useState<TransportRequest[]>([]);
  
  // Sign-up wizard state
  const [step, setStep] = useState<SignUpStep>('route');
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<RouteAvailability[]>([]);
  const [stops, setStops] = useState<TransportStop[]>([]);
  const [buses, setBuses] = useState<TransportBus[]>([]);
  
  // Form state
  const [selectedRoute, setSelectedRoute] = useState<RouteAvailability | null>(null);
  const [selectedStop, setSelectedStop] = useState<TransportStop | null>(null);
  const [selectedBus, setSelectedBus] = useState<TransportBus | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  
  // Result state
  const [submittedRequest, setSubmittedRequest] = useState<TransportRequest | null>(null);

  // Initial data load
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    await Promise.all([
      fetchActiveSubscription(),
      fetchTransportHistory(),
      checkExistingRequest(),
    ]);
  };

  const fetchActiveSubscription = async () => {
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('transport_subscriptions')
        .select('*, route:transport_routes(*), stop:transport_stops(*), assigned_bus:transport_buses(*)')
        .eq('student_id', student.id)
        .eq('term_id', currentTerm.id)
        .eq('status', 'active')
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setActiveSubscription(data);
        if (!initialTab) {
          setActiveTab('my-transport');
        }
      } else if (!initialTab) {
        setActiveTab('sign-up');
      }
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to fetch active subscription');
    }
  };

  const fetchTransportHistory = async () => {
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('transport_requests')
        .select('*, route:transport_routes(*), stop:transport_stops(*), preferred_bus:transport_buses(*)')
        .eq('student_id', student.id)
        .eq('term_id', currentTerm.id)
        .order('requested_at', { ascending: false });
      
      if (error) throw error;
      setTransportHistory(data || []);
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to fetch transport history');
    }
  };

  const checkExistingRequest = async () => {
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('transport_requests')
        .select('*, route:transport_routes(*), stop:transport_stops(*)')
        .eq('student_id', student.id)
        .eq('term_id', currentTerm.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        // Student already has a request
        setSubmittedRequest(data);
        setStep('success');
      } else {
        // Load available routes
        loadRoutes();
      }
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to check existing request');
    }
  };

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase.rpc('get_route_availability', {
        p_school_id: student.school_id,
        p_term_id: currentTerm.id,
        p_student_campus_id: student.campus_id,
      });

      if (error) throw error;
      setRoutes(data || []);
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  };

  const handleRouteSelect = async (route: RouteAvailability) => {
    setSelectedRoute(route);
    
    // Load stops for this route
    setLoading(true);
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('transport_stops')
        .select('*')
        .eq('route_id', route.route_id)
        .eq('is_active', true)
        .order('stop_order');

      if (error) throw error;
      setStops(data || []);

      // Load buses for this route
      const { data: busData, error: busError } = await supabase
        .from('transport_route_buses')
        .select('*, bus:transport_buses(*)')
        .eq('route_id', route.route_id);

      if (busError) throw busError;
      setBuses(busData?.map(rb => rb.bus).filter(Boolean) || []);

      setStep('stop');
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to load route details');
    } finally {
      setLoading(false);
    }
  };

  const handleStopSelect = (stop: TransportStop) => {
    setSelectedStop(stop);
    setStep('seat');
  };

  const handleSeatConfirm = () => {
    setStep('confirm');
  };

  const handleSubmit = async () => {
    if (!selectedRoute || !selectedStop) {
      addToast('Please complete all required selections', 'error');
      return;
    }

    setLoading(true);
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('transport_requests')
        .insert({
          school_id: student.school_id,
          student_id: student.id,
          term_id: currentTerm.id,
          route_id: selectedRoute.route_id,
          stop_id: selectedStop.id,
          preferred_bus_id: selectedBus?.id,
          preferred_seat_label: selectedSeat,
          status: 'pending' as TransportRequestStatus,
        })
        .select('*, route:transport_routes(*), stop:transport_stops(*)')
        .single();

      if (error) throw error;
      
      setSubmittedRequest(data);
      setStep('success');
      addToast('Transport request submitted successfully!', 'success');
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'route', label: 'Route', number: 1 },
      { key: 'stop', label: 'Stop', number: 2 },
      { key: 'seat', label: 'Seat', number: 3 },
      { key: 'confirm', label: 'Confirm', number: 4 },
    ];

    const currentStepIndex = steps.findIndex(s => s.key === step);

    return (
      <div className="flex items-center justify-between mb-6">
        {steps.map((s, index) => (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  index <= currentStepIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {s.number}
              </div>
              <span className="text-xs mt-1 text-gray-600">{s.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              ></div>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderRouteSelection = () => (
    <div>
      <h3 className="text-xl font-semibold mb-4">Select Your Route</h3>
      
      {loading ? (
        <div className="text-center py-8">Loading routes...</div>
      ) : routes.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          No routes available for your campus at this time.
        </div>
      ) : (
        <div className="space-y-3">
          {routes.map(route => (
            <div
              key={route.route_id}
              onClick={() => !route.is_full && handleRouteSelect(route)}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                route.is_full
                  ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-60'
                  : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-lg">{route.route_name}</h4>
                  {route.route_code && (
                    <p className="text-sm text-gray-600">Code: {route.route_code}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {route.available_seats} / {route.total_capacity} available
                  </p>
                  {route.is_full && (
                    <span className="inline-block mt-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                      FULL
                    </span>
                  )}
                </div>
              </div>
              
              {/* Capacity Bar */}
              <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${
                    route.available_seats === 0
                      ? 'bg-red-500'
                      : route.available_seats < 5
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{
                    width: `${(route.occupied_seats / route.total_capacity) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStopSelection = () => (
    <div>
      <h3 className="text-xl font-semibold mb-4">Select Your Stop</h3>
      <p className="text-sm text-gray-600 mb-4">
        Route: <strong>{selectedRoute?.route_name}</strong>
      </p>

      {stops.length === 0 ? (
        <div className="text-center py-8 text-gray-600">No stops available</div>
      ) : (
        <div className="space-y-3">
          {stops.map((stop, index) => (
            <div
              key={stop.id}
              onClick={() => handleStopSelect(stop)}
              className="p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                      {index + 1}
                    </span>
                    <h4 className="font-semibold">{stop.stop_name}</h4>
                  </div>
                  {stop.stop_address && (
                    <p className="text-sm text-gray-600 mt-1 ml-8">{stop.stop_address}</p>
                  )}
                </div>
                <div className="text-right text-sm">
                  {stop.pickup_time && (
                    <p className="text-gray-700">
                      <span className="text-gray-500">Morning:</span> {stop.pickup_time}
                    </p>
                  )}
                  {stop.dropoff_time && (
                    <p className="text-gray-700">
                      <span className="text-gray-500">Afternoon:</span> {stop.dropoff_time}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setStep('route')}
        className="mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        ← Back to Routes
      </button>
    </div>
  );

  const renderSeatSelection = () => (
    <div>
      <h3 className="text-xl font-semibold mb-4">Select Your Seat (Optional)</h3>
      <p className="text-sm text-gray-600 mb-4">
        You can select a preferred seat. Final seat assignment will be confirmed by the transport manager.
      </p>

      {buses.length > 0 ? (
        <div className="space-y-4">
          {!selectedBus && (
            <div>
              <p className="font-semibold mb-2">Choose a bus:</p>
              <div className="space-y-2">
                {buses.map(bus => (
                  <button
                    key={bus.id}
                    onClick={() => setSelectedBus(bus)}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left"
                  >
                    Bus {bus.bus_number} - {bus.capacity} seats
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedBus && (
            <div>
              <BusSeatSelector
                bus={selectedBus}
                selectedSeat={selectedSeat}
                onSeatSelect={setSelectedSeat}
                occupiedSeats={[]} // Students don't see occupied seats during sign-up
                disabled={false}
                showOccupantInfo={false}
              />
              <button
                onClick={() => {
                  setSelectedBus(null);
                  setSelectedSeat(null);
                }}
                className="mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Choose Different Bus
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-600">
          No buses available for seat selection
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => setStep('stop')}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          onClick={handleSeatConfirm}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Continue to Confirm →
        </button>
      </div>
    </div>
  );

  const renderConfirmation = () => (
    <div>
      <h3 className="text-xl font-semibold mb-4">Confirm Your Request</h3>
      
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
        <div>
          <p className="text-sm text-gray-600">Student</p>
          <p className="font-semibold">{student.name}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-600">Route</p>
          <p className="font-semibold">{selectedRoute?.route_name}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-600">Stop</p>
          <p className="font-semibold">{selectedStop?.stop_name}</p>
          {selectedStop?.pickup_time && (
            <p className="text-sm">Morning pickup: {selectedStop.pickup_time}</p>
          )}
          {selectedStop?.dropoff_time && (
            <p className="text-sm">Afternoon dropoff: {selectedStop.dropoff_time}</p>
          )}
        </div>
        
        {selectedBus && (
          <div>
            <p className="text-sm text-gray-600">Preferred Bus</p>
            <p className="font-semibold">Bus {selectedBus.bus_number}</p>
          </div>
        )}
        
        {selectedSeat && (
          <div>
            <p className="text-sm text-gray-600">Preferred Seat</p>
            <p className="font-semibold">Seat {selectedSeat}</p>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> Your request will be reviewed by the transport manager. 
          You will be notified once your request is approved or if you are placed on the waitlist.
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => setStep('seat')}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          disabled={loading}
        >
          ← Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Request'}
        </button>
      </div>
    </div>
  );

  const renderSuccess = () => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
      waitlisted: 'bg-orange-100 text-orange-800 border-orange-300',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-300',
    };

    return (
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h3 className="text-2xl font-semibold mb-2">Request Submitted!</h3>
        <p className="text-gray-600 mb-6">
          Your transport request has been submitted for review.
        </p>

        {submittedRequest && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left space-y-3 mb-6">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${statusColors[submittedRequest.status]}`}>
                {submittedRequest.status.toUpperCase()}
              </span>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Route</p>
              <p className="font-semibold">{submittedRequest.route?.route_name}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Stop</p>
              <p className="font-semibold">{submittedRequest.stop?.stop_name}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Submitted</p>
              <p>{new Date(submittedRequest.requested_at).toLocaleDateString()}</p>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    );
  };

  const handleCancelSubscription = async () => {
    if (!activeSubscription) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to cancel your transport subscription? This action cannot be undone.'
    );
    
    if (!confirmed) return;
    
    setLoading(true);
    try {
      const supabase = requireSupabaseClient();
      const { error } = await supabase
        .from('transport_subscriptions')
        .update({
          status: 'cancelled' as TransportSubscriptionStatus,
          cancelled_at: new Date().toISOString(),
          cancelled_by: student.user_id,
          cancellation_reason: 'Cancelled by student',
        })
        .eq('id', activeSubscription.id);
      
      if (error) throw error;
      
      addToast('Transport subscription cancelled successfully', 'success');
      setActiveSubscription(null);
      setActiveTab('sign-up');
      await fetchTransportHistory(); // Refresh history
    } catch (error) {
      handleSupabaseError(error, addToast, 'Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  const renderTabNavigation = () => (
    <div className="flex border-b border-gray-200 mb-6">
      <button
        onClick={() => setActiveTab('my-transport')}
        className={`flex items-center gap-2 px-4 py-2 font-medium border-b-2 transition-colors ${
          activeTab === 'my-transport'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-600 hover:text-gray-900'
        }`}
      >
        🚌 My Transport
      </button>
      <button
        onClick={() => setActiveTab('sign-up')}
        className={`flex items-center gap-2 px-4 py-2 font-medium border-b-2 transition-colors ${
          activeTab === 'sign-up'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-600 hover:text-gray-900'
        }`}
      >
        📝 Sign Up
      </button>
      <button
        onClick={() => setActiveTab('history')}
        className={`flex items-center gap-2 px-4 py-2 font-medium border-b-2 transition-colors ${
          activeTab === 'history'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-600 hover:text-gray-900'
        }`}
      >
        📋 History
      </button>
    </div>
  );

  const renderMyTransportTab = () => {
    if (!activeSubscription) {
      return (
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">No Active Subscription</h3>
          <p className="text-gray-600 mb-4">You don't have an active transport subscription.</p>
          <button
            onClick={() => setActiveTab('sign-up')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Sign Up for Transport
          </button>
        </div>
      );
    }

    return (
      <div>
        <h3 className="text-xl font-semibold mb-4">Your Active Transport Subscription</h3>
        
        <div className="space-y-4">
          {/* Subscription Status Card */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                ACTIVE
              </span>
              <span className="text-sm text-gray-600">
                Since {new Date(activeSubscription.started_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Route Information */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-sm text-gray-600">Route</p>
              <p className="font-semibold text-lg">{activeSubscription.route?.route_name}</p>
              {activeSubscription.route?.route_code && (
                <p className="text-sm text-gray-600">Code: {activeSubscription.route.route_code}</p>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-600">Your Stop</p>
              <p className="font-semibold">{activeSubscription.stop?.stop_name}</p>
              {activeSubscription.stop?.stop_address && (
                <p className="text-sm text-gray-600">{activeSubscription.stop.stop_address}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {activeSubscription.stop?.pickup_time && (
                <div>
                  <p className="text-sm text-gray-600">Morning Pickup</p>
                  <p className="font-semibold">{activeSubscription.stop.pickup_time}</p>
                </div>
              )}
              {activeSubscription.stop?.dropoff_time && (
                <div>
                  <p className="text-sm text-gray-600">Afternoon Dropoff</p>
                  <p className="font-semibold">{activeSubscription.stop.dropoff_time}</p>
                </div>
              )}
            </div>

            {activeSubscription.assigned_bus && (
              <div>
                <p className="text-sm text-gray-600">Assigned Bus</p>
                <p className="font-semibold">Bus {activeSubscription.assigned_bus.bus_number}</p>
                {activeSubscription.assigned_bus.license_plate && (
                  <p className="text-sm text-gray-600">
                    License: {activeSubscription.assigned_bus.license_plate}
                  </p>
                )}
                {activeSubscription.assigned_bus.driver_name && (
                  <p className="text-sm text-gray-600">
                    Driver: {activeSubscription.assigned_bus.driver_name}
                    {activeSubscription.assigned_bus.driver_phone && 
                      ` (${activeSubscription.assigned_bus.driver_phone})`
                    }
                  </p>
                )}
              </div>
            )}

            {activeSubscription.seat_label && (
              <div>
                <p className="text-sm text-gray-600">Assigned Seat</p>
                <p className="font-semibold">Seat {activeSubscription.seat_label}</p>
              </div>
            )}
          </div>

          {/* Cancel Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleCancelSubscription}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Cancelling...' : 'Cancel Subscription'}
            </button>
            <p className="text-sm text-gray-600 mt-2">
              Note: Cancelling your subscription cannot be undone. You will need to submit a new request to re-enroll.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderSignUpTab = () => {
    if (activeSubscription) {
      return (
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Already Subscribed</h3>
          <p className="text-gray-600 mb-4">You already have an active transport subscription.</p>
          <button
            onClick={() => setActiveTab('my-transport')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            View My Transport
          </button>
        </div>
      );
    }

    // Show the existing 4-step wizard
    return (
      <div>
        {/* Step Indicator (hidden on success) */}
        {step !== 'success' && renderStepIndicator()}

        {/* Step Content */}
        <div>
          {step === 'route' && renderRouteSelection()}
          {step === 'stop' && renderStopSelection()}
          {step === 'seat' && renderSeatSelection()}
          {step === 'confirm' && renderConfirmation()}
          {step === 'success' && renderSuccess()}
        </div>
      </div>
    );
  };

  const renderHistoryTab = () => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
      waitlisted: 'bg-orange-100 text-orange-800 border-orange-300',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-300',
    };

    if (transportHistory.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">No Transport History</h3>
          <p className="text-gray-600">You haven't made any transport requests yet.</p>
        </div>
      );
    }

    return (
      <div>
        <h3 className="text-xl font-semibold mb-4">Transport Request History</h3>
        
        <div className="space-y-3">
          {transportHistory.map((request) => (
            <div
              key={request.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold">{request.route?.route_name}</h4>
                  <p className="text-sm text-gray-600">{request.stop?.stop_name}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[request.status]}`}>
                  {request.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">Requested</p>
                  <p className="font-medium">{new Date(request.requested_at).toLocaleDateString()}</p>
                </div>

                {request.reviewed_at && (
                  <div>
                    <p className="text-gray-600">Reviewed</p>
                    <p className="font-medium">{new Date(request.reviewed_at).toLocaleDateString()}</p>
                  </div>
                )}

                {request.preferred_bus && (
                  <div>
                    <p className="text-gray-600">Preferred Bus</p>
                    <p className="font-medium">Bus {request.preferred_bus.bus_number}</p>
                  </div>
                )}

                {request.preferred_seat_label && (
                  <div>
                    <p className="text-gray-600">Preferred Seat</p>
                    <p className="font-medium">Seat {request.preferred_seat_label}</p>
                  </div>
                )}
              </div>

              {request.rejection_reason && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm">
                  <p className="font-semibold text-red-900">Rejection Reason:</p>
                  <p className="text-red-800">{request.rejection_reason}</p>
                </div>
              )}

              {request.notes && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <p className="font-semibold text-blue-900">Notes:</p>
                  <p className="text-blue-800">{request.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Transportation</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Tab Navigation */}
          {renderTabNavigation()}

          {/* Tab Content */}
          <div>
            {activeTab === 'my-transport' && renderMyTransportTab()}
            {activeTab === 'sign-up' && renderSignUpTab()}
            {activeTab === 'history' && renderHistoryTab()}
          </div>
        </div>
      </div>
    </div>
  );
}
