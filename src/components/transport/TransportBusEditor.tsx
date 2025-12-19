import React, { useState, useEffect, useMemo } from 'react';
import { requireSupabaseClient } from '../../services/supabaseClient';
import type { TransportBus, TransportSubscription, Campus } from '../../types';
import Spinner from '../common/Spinner';
import { PlusCircleIcon, TrashIcon, EditIcon, EyeIcon, SearchIcon, CloseIcon } from '../common/icons';
import BusSeatSelector from './BusSeatSelector';

interface TransportBusEditorProps {
  schoolId: number;
  campuses: Campus[];
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

interface BusFormData {
  bus_number: string;
  license_plate: string;
  capacity: number;
  driver_name: string;
  driver_phone: string;
  home_campus_id: number | null;
  is_active: boolean;
}

export default function TransportBusEditor({
  schoolId,
  campuses,
  addToast,
}: TransportBusEditorProps) {
  const [buses, setBuses] = useState<TransportBus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingBus, setEditingBus] = useState<TransportBus | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<TransportBus | null>(null);
  const [showSeatMapModal, setShowSeatMapModal] = useState<TransportBus | null>(null);
  const [seatMapSubscriptions, setSeatMapSubscriptions] = useState<TransportSubscription[]>([]);
  const [formData, setFormData] = useState<BusFormData>({
    bus_number: '',
    license_plate: '',
    capacity: 40,
    driver_name: '',
    driver_phone: '',
    home_campus_id: null,
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBuses();
  }, [schoolId]);

  const fetchBuses = async () => {
    setLoading(true);
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('transport_buses')
        .select('*, campus:home_campus_id(id, name)')
        .eq('school_id', schoolId)
        .order('bus_number');

      if (error) throw error;
      setBuses(data || []);
    } catch (error: any) {
      addToast(`Failed to load buses: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchOccupiedSeats = async (busId: number) => {
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('transport_subscriptions')
        .select('*, student:student_id(id, name)')
        .eq('assigned_bus_id', busId)
        .eq('status', 'active');

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      addToast(`Failed to load seat information: ${error.message}`, 'error');
      return [];
    }
  };

  const handleOpenSeatMap = async (bus: TransportBus) => {
    setShowSeatMapModal(bus);
    const subscriptions = await fetchOccupiedSeats(bus.id);
    setSeatMapSubscriptions(subscriptions);
  };

  const handleCloseSeatMap = () => {
    setShowSeatMapModal(null);
    setSeatMapSubscriptions([]);
  };

  const handleOpenForm = (bus?: TransportBus) => {
    if (bus) {
      setEditingBus(bus);
      setFormData({
        bus_number: bus.bus_number,
        license_plate: bus.license_plate || '',
        capacity: bus.capacity,
        driver_name: bus.driver_name || '',
        driver_phone: bus.driver_phone || '',
        home_campus_id: bus.home_campus_id || null,
        is_active: bus.is_active,
      });
    } else {
      setEditingBus(null);
      setFormData({
        bus_number: '',
        license_plate: '',
        capacity: 40,
        driver_name: '',
        driver_phone: '',
        home_campus_id: null,
        is_active: true,
      });
    }
    setShowFormModal(true);
  };

  const handleCloseForm = () => {
    setShowFormModal(false);
    setEditingBus(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.bus_number.trim()) {
      addToast('Bus number is required', 'error');
      return;
    }
    if (formData.capacity < 1) {
      addToast('Capacity must be at least 1', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = requireSupabaseClient();

      if (editingBus) {
        // Update existing bus
        const { error } = await supabase
          .from('transport_buses')
          .update({
            bus_number: formData.bus_number,
            license_plate: formData.license_plate || null,
            capacity: formData.capacity,
            driver_name: formData.driver_name || null,
            driver_phone: formData.driver_phone || null,
            home_campus_id: formData.home_campus_id,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingBus.id);

        if (error) throw error;
        addToast('Bus updated successfully', 'success');
      } else {
        // Create new bus
        const { error } = await supabase
          .from('transport_buses')
          .insert({
            school_id: schoolId,
            bus_number: formData.bus_number,
            license_plate: formData.license_plate || null,
            capacity: formData.capacity,
            driver_name: formData.driver_name || null,
            driver_phone: formData.driver_phone || null,
            home_campus_id: formData.home_campus_id,
            is_active: formData.is_active,
          });

        if (error) throw error;
        addToast('Bus created successfully', 'success');
      }

      handleCloseForm();
      fetchBuses();
    } catch (error: any) {
      addToast(`Failed to save bus: ${error.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (bus: TransportBus) => {
    try {
      const supabase = requireSupabaseClient();

      // Check for active subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from('transport_subscriptions')
        .select('id')
        .eq('assigned_bus_id', bus.id)
        .eq('status', 'active');

      if (subError) throw subError;

      if (subscriptions && subscriptions.length > 0) {
        addToast(
          `Cannot delete bus: ${subscriptions.length} active subscription(s) found. Please reassign or cancel subscriptions first.`,
          'warning'
        );
        setShowDeleteConfirm(null);
        return;
      }

      // Proceed with deletion
      const { error } = await supabase
        .from('transport_buses')
        .delete()
        .eq('id', bus.id);

      if (error) throw error;

      addToast('Bus deleted successfully', 'success');
      setShowDeleteConfirm(null);
      fetchBuses();
    } catch (error: any) {
      addToast(`Failed to delete bus: ${error.message}`, 'error');
    }
  };

  const filteredBuses = useMemo(() => {
    if (!searchQuery.trim()) return buses;
    const query = searchQuery.toLowerCase();
    return buses.filter(
      (bus) =>
        bus.bus_number.toLowerCase().includes(query) ||
        bus.license_plate?.toLowerCase().includes(query) ||
        bus.driver_name?.toLowerCase().includes(query) ||
        bus.campus?.name.toLowerCase().includes(query)
    );
  }, [buses, searchQuery]);

  const getOccupiedSeatsCount = (busId: number): number => {
    // This is a placeholder - in real use, we'd need to fetch this data
    // For now, we'll show it as 0 since we don't have it in the bus list
    return 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bus Management</h2>
          <p className="text-gray-600 mt-1">Manage school buses and view seat assignments</p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusCircleIcon className="w-5 h-5" />
          Add New Bus
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by bus number, license plate, driver name, or campus..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Bus List */}
      {filteredBuses.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            {searchQuery ? 'No buses found matching your search' : 'No buses yet. Add your first bus to get started.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
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
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Home Campus
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBuses.map((bus) => (
                <tr key={bus.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {bus.bus_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {bus.license_plate || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {bus.capacity} seats
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      <div>{bus.driver_name || '-'}</div>
                      {bus.driver_phone && (
                        <div className="text-xs text-gray-400">{bus.driver_phone}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {bus.campus?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        bus.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {bus.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenSeatMap(bus)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Seat Map"
                      >
                        <EyeIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleOpenForm(bus)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Edit Bus"
                      >
                        <EditIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(bus)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete Bus"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingBus ? 'Edit Bus' : 'Add New Bus'}
                </h3>
                <button
                  onClick={handleCloseForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <CloseIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bus Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.bus_number}
                      onChange={(e) =>
                        setFormData({ ...formData, bus_number: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      License Plate
                    </label>
                    <input
                      type="text"
                      value={formData.license_plate}
                      onChange={(e) =>
                        setFormData({ ...formData, license_plate: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacity (Number of Seats) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Rows will be calculated as: {Math.ceil(formData.capacity / 4)} rows × 4 seats
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Driver Name
                    </label>
                    <input
                      type="text"
                      value={formData.driver_name}
                      onChange={(e) =>
                        setFormData({ ...formData, driver_name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Driver Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.driver_phone}
                      onChange={(e) =>
                        setFormData({ ...formData, driver_phone: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Home Campus
                  </label>
                  <select
                    value={formData.home_campus_id || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        home_campus_id: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a campus</option>
                    {campuses.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        {campus.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                    Active
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={handleCloseForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Spinner size="sm" />
                        Saving...
                      </>
                    ) : (
                      editingBus ? 'Update Bus' : 'Create Bus'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Deletion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete bus <strong>{showDeleteConfirm.bus_number}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Bus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seat Map Modal */}
      {showSeatMapModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Seat Map - Bus {showSeatMapModal.bus_number}
                </h3>
                <button
                  onClick={handleCloseSeatMap}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <CloseIcon className="w-6 h-6" />
                </button>
              </div>

              <BusSeatSelector
                bus={showSeatMapModal}
                selectedSeat={null}
                onSeatSelect={() => {}} // Read-only for admin view
                occupiedSeats={seatMapSubscriptions}
                seatLayoutConfig={{
                  rows: Math.ceil(showSeatMapModal.capacity / 4),
                  columns: ['A', 'B', 'C', 'D'],
                }}
                disabled={true} // Read-only mode
                showOccupantInfo={true} // Show student names on hover
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
