import React, { useState, useEffect } from 'react';
import type { TransportBus, TransportSubscription, Campus } from '../../types';
import { TransportSubscriptionStatus } from '../../types';
import { requireSupabaseClient } from '../../services/supabaseClient';
import Spinner from '../common/Spinner';
import { PlusCircleIcon, CloseIcon, EyeIcon } from '../common/icons';
import BusSeatSelector from './BusSeatSelector';

interface TransportBusEditorProps {
  schoolId: number;
  currentTermId: number;
  campuses: Campus[];
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

interface BusWithStats extends TransportBus {
  occupied_seats?: number;
}

export default function TransportBusEditor({
  schoolId,
  currentTermId,
  campuses,
  addToast,
}: TransportBusEditorProps) {
  const [buses, setBuses] = useState<BusWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBus, setEditingBus] = useState<BusWithStats | null>(null);
  const [saving, setSaving] = useState(false);

  // Seat map modal
  const [showSeatMap, setShowSeatMap] = useState(false);
  const [selectedBusForSeats, setSelectedBusForSeats] = useState<TransportBus | null>(null);
  const [occupiedSeats, setOccupiedSeats] = useState<TransportSubscription[]>([]);

  // Form state
  const [busNumber, setBusNumber] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [capacity, setCapacity] = useState('40');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [homeCampusId, setHomeCampusId] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadBuses();
  }, [schoolId, currentTermId]);

  const loadBuses = async () => {
    try {
      setLoading(true);
      const supabase = requireSupabaseClient();

      // Fetch buses with campus info
      const { data: busesData, error: busesError } = await supabase
        .from('transport_buses')
        .select(`
          *,
          campus:campuses(id, name)
        `)
        .eq('school_id', schoolId)
        .order('bus_number');

      if (busesError) throw busesError;

      // Fetch occupied seats count for each bus
      const busesWithStats = await Promise.all(
        (busesData || []).map(async (bus) => {
          const { count } = await supabase
            .from('transport_subscriptions')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_bus_id', bus.id)
            .eq('status', TransportSubscriptionStatus.Active)
            .eq('term_id', currentTermId);

          return {
            ...bus,
            occupied_seats: count || 0,
          };
        })
      );

      setBuses(busesWithStats);
    } catch (error: any) {
      console.error('Error loading buses:', error);
      addToast(error.message || 'Failed to load buses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingBus(null);
    setBusNumber('');
    setLicensePlate('');
    setCapacity('40');
    setDriverName('');
    setDriverPhone('');
    setHomeCampusId('');
    setIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (bus: BusWithStats) => {
    setEditingBus(bus);
    setBusNumber(bus.bus_number);
    setLicensePlate(bus.license_plate || '');
    setCapacity(bus.capacity.toString());
    setDriverName(bus.driver_name || '');
    setDriverPhone(bus.driver_phone || '');
    setHomeCampusId(bus.home_campus_id || '');
    setIsActive(bus.is_active);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!busNumber.trim()) {
      addToast('Bus number is required', 'warning');
      return;
    }
    if (!capacity || Number(capacity) <= 0) {
      addToast('Valid capacity is required', 'warning');
      return;
    }

    try {
      setSaving(true);
      const supabase = requireSupabaseClient();

      const busData = {
        school_id: schoolId,
        bus_number: busNumber.trim(),
        license_plate: licensePlate.trim() || null,
        capacity: Number(capacity),
        driver_name: driverName.trim() || null,
        driver_phone: driverPhone.trim() || null,
        home_campus_id: homeCampusId || null,
        is_active: isActive,
      };

      if (editingBus) {
        // Update existing bus
        const { error } = await supabase
          .from('transport_buses')
          .update(busData)
          .eq('id', editingBus.id);

        if (error) throw error;
        addToast('Bus updated successfully', 'success');
      } else {
        // Create new bus
        const { error } = await supabase
          .from('transport_buses')
          .insert(busData);

        if (error) throw error;
        addToast('Bus created successfully', 'success');
      }

      setShowModal(false);
      loadBuses();
    } catch (error: any) {
      console.error('Error saving bus:', error);
      addToast(error.message || 'Failed to save bus', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bus: BusWithStats) => {
    if (bus.occupied_seats! > 0) {
      addToast(
        `Cannot delete bus with ${bus.occupied_seats} active subscriptions`,
        'warning'
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete bus "${bus.bus_number}"?`)) {
      return;
    }

    try {
      const supabase = requireSupabaseClient();
      const { error } = await supabase
        .from('transport_buses')
        .delete()
        .eq('id', bus.id);

      if (error) throw error;
      addToast('Bus deleted successfully', 'success');
      loadBuses();
    } catch (error: any) {
      console.error('Error deleting bus:', error);
      addToast(error.message || 'Failed to delete bus', 'error');
    }
  };

  const openSeatMap = async (bus: TransportBus) => {
    try {
      const supabase = requireSupabaseClient();
      
      // Fetch occupied seats for this bus
      const { data, error } = await supabase
        .from('transport_subscriptions')
        .select(`
          *,
          student:students(id, name, admission_number)
        `)
        .eq('assigned_bus_id', bus.id)
        .eq('status', TransportSubscriptionStatus.Active)
        .eq('term_id', currentTermId);

      if (error) throw error;

      setOccupiedSeats(data || []);
      setSelectedBusForSeats(bus);
      setShowSeatMap(true);
    } catch (error: any) {
      console.error('Error loading seat map:', error);
      addToast(error.message || 'Failed to load seat map', 'error');
    }
  };

  const filteredBuses = buses.filter((bus) =>
    bus.bus_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bus.license_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bus.driver_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h2 className="text-2xl font-bold text-gray-900">Transport Buses</h2>
          <p className="text-gray-600 text-sm mt-1">Manage school buses and capacity</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusCircleIcon className="w-5 h-5" />
          Add Bus
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search buses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Buses Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bus Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                License Plate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Capacity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Occupied/Available
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Driver
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
            {filteredBuses.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  {searchTerm ? 'No buses found matching your search' : 'No buses yet. Add one to get started!'}
                </td>
              </tr>
            ) : (
              filteredBuses.map((bus) => (
                <tr key={bus.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{bus.bus_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{bus.license_plate || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{bus.capacity}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <span className="font-medium text-red-600">{bus.occupied_seats}</span>
                      {' / '}
                      <span className="text-green-600">{bus.capacity - (bus.occupied_seats || 0)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{bus.driver_name || '-'}</div>
                    {bus.driver_phone && (
                      <div className="text-xs text-gray-500">{bus.driver_phone}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{bus.campus?.name || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        bus.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {bus.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openSeatMap(bus)}
                      className="text-purple-600 hover:text-purple-900 mr-4"
                      title="View Seat Map"
                    >
                      <EyeIcon className="w-5 h-5 inline" />
                    </button>
                    <button
                      onClick={() => openEditModal(bus)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(bus)}
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
                    {editingBus ? 'Edit Bus' : 'Add New Bus'}
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
                      Bus Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={busNumber}
                      onChange={(e) => setBusNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Bus 1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      License Plate
                    </label>
                    <input
                      type="text"
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., ABC-123"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Capacity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Home Campus
                    </label>
                    <select
                      value={homeCampusId}
                      onChange={(e) => setHomeCampusId(e.target.value ? Number(e.target.value) : '')}
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
                      Driver Name
                    </label>
                    <input
                      type="text"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Driver's name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Driver Phone
                    </label>
                    <input
                      type="tel"
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Phone number"
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

      {/* Seat Map Modal */}
      {showSeatMap && selectedBusForSeats && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowSeatMap(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Seat Map - {selectedBusForSeats.bus_number}
                  </h3>
                  <button
                    onClick={() => setShowSeatMap(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <CloseIcon className="w-6 h-6" />
                  </button>
                </div>

                <BusSeatSelector
                  bus={selectedBusForSeats}
                  selectedSeat={null}
                  onSeatSelect={() => {}}
                  occupiedSeats={occupiedSeats}
                  disabled={true}
                  showOccupantInfo={true}
                />
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end">
                <button
                  onClick={() => setShowSeatMap(false)}
                  className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
