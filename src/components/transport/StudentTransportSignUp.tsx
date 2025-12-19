import React, { useState, useEffect } from 'react';
import { supabase } from '../../offline/client';
import type { 
  TransportRoute, 
  TransportStop, 
  TransportBus, 
  RouteAvailability,
  Student,
  Term,
  TransportRequest,
  TransportRequestStatus
} from '../../types';
import BusSeatSelector from './BusSeatSelector';
import { handleSupabaseError } from '../../utils/errorHandling';

interface StudentTransportSignUpProps {
  student: Student;
  currentTerm: Term;
  onClose: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

type SignUpStep = 'route' | 'stop' | 'seat' | 'confirm' | 'success';

export default function StudentTransportSignUp({
  student,
  currentTerm,
  onClose,
  addToast,
}: StudentTransportSignUpProps) {
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

  // Check if student already has a request for this term
  useEffect(() => {
    checkExistingRequest();
  }, []);

  const checkExistingRequest = async () => {
    try {
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Transport Sign-Up</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

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
      </div>
    </div>
  );
}
