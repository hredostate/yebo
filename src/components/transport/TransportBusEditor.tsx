import React, { useState, useEffect, useMemo } from 'react';
import type { TransportBus, Campus } from '../../types';
import { requireSupabaseClient } from '../../services/supabaseClient';
import Spinner from '../common/Spinner';
import { PlusCircleIcon, SearchIcon } from '../common/icons';

interface TransportBusEditorProps {
    schoolId: number;
    campuses: Campus[];
    addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

interface TransportSubscription {
    id: number;
    bus_id: number;
}

interface TransportRouteBus {
    id: number;
    bus_id: number;
}

const TransportBusEditor: React.FC<TransportBusEditorProps> = ({ schoolId, campuses, addToast }) => {
    const [buses, setBuses] = useState<TransportBus[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingBus, setEditingBus] = useState<Partial<TransportBus> | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [subscriptionCounts, setSubscriptionCounts] = useState<Record<number, number>>({});

    useEffect(() => {
        fetchBuses();
    }, [schoolId]);

    const fetchBuses = async () => {
        setLoading(true);
        try {
            const supabase = requireSupabaseClient();
            
            // Fetch buses with campus data
            const { data: busData, error: busError } = await supabase
                .from('transport_buses')
                .select('*, campus:home_campus_id(id, name)')
                .eq('school_id', schoolId)
                .order('bus_number', { ascending: true });

            if (busError) throw busError;

            // Fetch subscription counts for each bus
            const { data: subscriptions, error: subsError } = await supabase
                .from('transport_subscriptions')
                .select('bus_id, id')
                .in('bus_id', busData?.map(b => b.id) || []);

            if (subsError) throw subsError;

            // Count subscriptions per bus
            const counts: Record<number, number> = {};
            subscriptions?.forEach((sub: TransportSubscription) => {
                counts[sub.bus_id] = (counts[sub.bus_id] || 0) + 1;
            });
            
            setSubscriptionCounts(counts);
            setBuses(busData || []);
        } catch (error: any) {
            console.error('Error fetching buses:', error);
            addToast(`Failed to load buses: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (bus: Partial<TransportBus>) => {
        try {
            const supabase = requireSupabaseClient();

            // Validate required fields
            if (!bus.bus_number?.trim()) {
                addToast('Bus number is required', 'error');
                return;
            }
            if (!bus.capacity || bus.capacity < 1) {
                addToast('Capacity must be at least 1', 'error');
                return;
            }

            const busData = {
                school_id: schoolId,
                bus_number: bus.bus_number.trim(),
                license_plate: bus.license_plate?.trim() || null,
                capacity: bus.capacity,
                driver_name: bus.driver_name?.trim() || null,
                driver_phone: bus.driver_phone?.trim() || null,
                home_campus_id: bus.home_campus_id || null,
                is_active: bus.is_active ?? true,
            };

            if (bus.id) {
                // Update existing bus
                const { error } = await supabase
                    .from('transport_buses')
                    .update(busData)
                    .eq('id', bus.id);

                if (error) throw error;
                addToast('Bus updated successfully', 'success');
            } else {
                // Check for duplicate bus number
                const { data: existing, error: checkError } = await supabase
                    .from('transport_buses')
                    .select('id')
                    .eq('school_id', schoolId)
                    .eq('bus_number', busData.bus_number)
                    .maybeSingle();

                if (checkError) throw checkError;

                if (existing) {
                    addToast('A bus with this number already exists', 'error');
                    return;
                }

                // Insert new bus
                const { error } = await supabase
                    .from('transport_buses')
                    .insert(busData);

                if (error) throw error;
                addToast('Bus added successfully', 'success');
            }

            setIsModalOpen(false);
            setEditingBus(null);
            fetchBuses();
        } catch (error: any) {
            console.error('Error saving bus:', error);
            addToast(`Failed to save bus: ${error.message}`, 'error');
        }
    };

    const handleDelete = async (bus: TransportBus) => {
        try {
            const supabase = requireSupabaseClient();

            // Check for active subscriptions
            const { data: subscriptions, error: subsError } = await supabase
                .from('transport_subscriptions')
                .select('id')
                .eq('bus_id', bus.id);

            if (subsError) throw subsError;

            if (subscriptions && subscriptions.length > 0) {
                addToast(`Cannot delete bus: ${subscriptions.length} active subscription(s) found. Please remove subscriptions first.`, 'warning');
                return;
            }

            // Check for route assignments
            const { data: routeBuses, error: routeError } = await supabase
                .from('transport_route_buses')
                .select('id')
                .eq('bus_id', bus.id);

            if (routeError) throw routeError;

            if (routeBuses && routeBuses.length > 0) {
                const confirmDelete = window.confirm(
                    `This bus is assigned to ${routeBuses.length} route(s). Are you sure you want to delete it? This will remove it from those routes.`
                );
                if (!confirmDelete) return;
            } else {
                const confirmDelete = window.confirm(
                    `Are you sure you want to delete bus "${bus.bus_number}"? This action cannot be undone.`
                );
                if (!confirmDelete) return;
            }

            // Delete the bus
            const { error } = await supabase
                .from('transport_buses')
                .delete()
                .eq('id', bus.id);

            if (error) throw error;

            addToast('Bus deleted successfully', 'success');
            fetchBuses();
        } catch (error: any) {
            console.error('Error deleting bus:', error);
            addToast(`Failed to delete bus: ${error.message}`, 'error');
        }
    };

    const openAddModal = () => {
        setEditingBus({ is_active: true });
        setIsModalOpen(true);
    };

    const openEditModal = (bus: TransportBus) => {
        setEditingBus(bus);
        setIsModalOpen(true);
    };

    const filteredBuses = useMemo(() => {
        if (!searchQuery.trim()) return buses;
        const query = searchQuery.toLowerCase();
        return buses.filter(bus =>
            bus.bus_number.toLowerCase().includes(query) ||
            bus.license_plate?.toLowerCase().includes(query) ||
            bus.driver_name?.toLowerCase().includes(query) ||
            (bus.campus?.name && bus.campus.name.toLowerCase().includes(query))
        );
    }, [buses, searchQuery]);

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8">
                <Spinner size="lg" text="Loading buses..." />
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">School Buses</h2>
                    <p className="text-gray-600 text-sm mt-1">Manage your fleet of school buses</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <PlusCircleIcon className="w-5 h-5" />
                    Add New Bus
                </button>
            </div>

            {/* Search */}
            <div className="mb-4">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <SearchIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by bus number, license plate, driver, or campus..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Bus List */}
            {filteredBuses.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-lg">
                        {searchQuery ? 'No buses found matching your search' : 'No buses added yet'}
                    </p>
                    {!searchQuery && (
                        <button
                            onClick={openAddModal}
                            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                        >
                            Add your first bus
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredBuses.map((bus) => {
                        const occupiedSeats = subscriptionCounts[bus.id] || 0;
                        const availableSeats = bus.capacity - occupiedSeats;
                        const occupancyPercentage = (occupiedSeats / bus.capacity) * 100;

                        return (
                            <div
                                key={bus.id}
                                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-900">
                                            Bus {bus.bus_number}
                                        </h3>
                                        {bus.license_plate && (
                                            <p className="text-sm text-gray-600">{bus.license_plate}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center">
                                        {bus.is_active ? (
                                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Capacity Bar */}
                                <div className="mb-3">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Capacity</span>
                                        <span className="font-medium text-gray-900">
                                            {occupiedSeats} / {bus.capacity} seats
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all ${
                                                occupancyPercentage > 90
                                                    ? 'bg-red-500'
                                                    : occupancyPercentage > 70
                                                    ? 'bg-yellow-500'
                                                    : 'bg-green-500'
                                            }`}
                                            style={{ width: `${Math.min(occupancyPercentage, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {availableSeats} seat{availableSeats !== 1 ? 's' : ''} available
                                    </p>
                                </div>

                                {/* Details */}
                                <div className="space-y-2 text-sm">
                                    {bus.driver_name && (
                                        <div className="flex items-center gap-2 text-gray-700">
                                            <span className="font-medium">Driver:</span>
                                            <span>{bus.driver_name}</span>
                                        </div>
                                    )}
                                    {bus.driver_phone && (
                                        <div className="flex items-center gap-2 text-gray-700">
                                            <span className="font-medium">Phone:</span>
                                            <span>{bus.driver_phone}</span>
                                        </div>
                                    )}
                                    {bus.campus && (
                                        <div className="flex items-center gap-2 text-gray-700">
                                            <span className="font-medium">Campus:</span>
                                            <span>{bus.campus.name}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
                                    <button
                                        onClick={() => openEditModal(bus)}
                                        className="flex-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(bus)}
                                        className="flex-1 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && editingBus && (
                <BusFormModal
                    bus={editingBus}
                    campuses={campuses}
                    onSave={handleSave}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditingBus(null);
                    }}
                />
            )}
        </div>
    );
};

interface BusFormModalProps {
    bus: Partial<TransportBus>;
    campuses: Campus[];
    onSave: (bus: Partial<TransportBus>) => void;
    onClose: () => void;
}

const BusFormModal: React.FC<BusFormModalProps> = ({ bus, campuses, onSave, onClose }) => {
    const [formData, setFormData] = useState<Partial<TransportBus>>(bus);
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setFormData((prev) => ({
            ...prev,
            [name]:
                type === 'checkbox'
                    ? checked
                    : type === 'number'
                    ? value === ''
                        ? null
                        : isNaN(Number(value))
                        ? prev[name as keyof TransportBus]
                        : Number(value)
                    : value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(formData);
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    {/* Header */}
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {bus.id ? 'Edit Bus' : 'Add New Bus'}
                        </h2>
                        <p className="text-gray-600 text-sm mt-1">
                            {bus.id
                                ? 'Update bus information and capacity'
                                : 'Enter details for the new bus'}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Bus Number & License Plate */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Bus Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="bus_number"
                                    value={formData.bus_number || ''}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., 001"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    License Plate
                                </label>
                                <input
                                    type="text"
                                    name="license_plate"
                                    value={formData.license_plate || ''}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., ABC-1234"
                                />
                            </div>
                        </div>

                        {/* Capacity */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Capacity (Number of Seats) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                name="capacity"
                                value={formData.capacity || ''}
                                onChange={handleChange}
                                required
                                min="1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g., 50"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Total number of seats available on this bus
                            </p>
                        </div>

                        {/* Driver Name & Phone */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Driver Name
                                </label>
                                <input
                                    type="text"
                                    name="driver_name"
                                    value={formData.driver_name || ''}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., John Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Driver Phone
                                </label>
                                <input
                                    type="tel"
                                    name="driver_phone"
                                    value={formData.driver_phone || ''}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., +234 123 456 7890"
                                />
                            </div>
                        </div>

                        {/* Home Campus */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Home Campus
                            </label>
                            <select
                                name="home_campus_id"
                                value={formData.home_campus_id || ''}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Select a campus (optional)</option>
                                {campuses.map((campus) => (
                                    <option key={campus.id} value={campus.id}>
                                        {campus.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Is Active */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                name="is_active"
                                id="is_active"
                                checked={formData.is_active ?? true}
                                onChange={handleChange}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">
                                Bus is active
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSaving}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <Spinner size="sm" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Bus'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TransportBusEditor;
