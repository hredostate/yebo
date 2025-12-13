
import React, { useState } from 'react';
import type { Campus } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon, MapPinIcon, BanknotesIcon, EyeIcon, EyeOffIcon } from './common/icons';

interface CampusesManagerProps {
    campuses: Campus[];
    onSave: (campus: Partial<Campus>) => Promise<boolean>;
    onDelete: (id: number) => Promise<boolean>;
}

const DVA_PROVIDERS = [
    { value: 'titan-paystack', label: 'Titan (Paystack Default)' },
    { value: 'wema-bank', label: 'Wema Bank' },
    { value: 'access-bank', label: 'Access Bank' },
    { value: 'test-bank', label: 'Test Bank (Development)' },
];

const CampusesManager: React.FC<CampusesManagerProps> = ({ campuses, onSave, onDelete }) => {
    const [editing, setEditing] = useState<Partial<Campus> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (data: Partial<Campus>) => {
        setIsSaving(true);
        const success = await onSave(data);
        if (success) {
            setEditing(null);
        }
        setIsSaving(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Manage Campuses</h3>
                <p className="text-xs text-slate-500">Each campus can have its own Paystack API for payments and salaries</p>
            </div>
            {!editing && (
                <button onClick={() => setEditing({})} className="flex items-center gap-2 text-sm font-semibold text-blue-600 p-2 rounded-md hover:bg-blue-100">
                    <PlusCircleIcon className="w-5 h-5"/> Add New Campus
                </button>
            )}
            {editing && (
                <CampusForm 
                    campus={editing} 
                    onSave={handleSave} 
                    onCancel={() => setEditing(null)} 
                    isSaving={isSaving} 
                />
            )}
            <div className="space-y-2">
                {campuses.map(campus => (
                    <div key={campus.id} className="p-4 border rounded-lg bg-white dark:bg-slate-900">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <p className="font-semibold">{campus.name}</p>
                                <p className="text-xs text-slate-500">{campus.address}</p>
                                {campus.geofence_lat && campus.geofence_lng && (
                                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                                        <MapPinIcon className="w-3 h-3"/> 
                                        Geofence Active ({campus.geofence_radius_meters}m radius)
                                    </p>
                                )}
                                {campus.paystack_secret_key && (
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                                        <BanknotesIcon className="w-3 h-3"/> 
                                        Paystack API Configured ({campus.dva_provider || 'titan-paystack'})
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditing(campus)} className="text-sm font-semibold text-blue-600 hover:underline">Edit</button>
                                <button onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this campus? This action cannot be undone and may affect users, classes, and other campus-specific data.')) {
                                        onDelete(campus.id);
                                    }
                                }} className="text-sm font-semibold text-red-600 hover:underline">Delete</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CampusForm: React.FC<{
    campus: Partial<Campus>;
    onSave: (campus: Partial<Campus>) => void;
    onCancel: () => void;
    isSaving: boolean;
}> = ({ campus, onSave, onCancel, isSaving }) => {
    const [localCampus, setLocalCampus] = useState(campus);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
    const [showSecretKey, setShowSecretKey] = useState(false);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const numericFields = ['geofence_lat', 'geofence_lng', 'geofence_radius_meters'];
        
        if (numericFields.includes(name)) {
            setLocalCampus(prev => ({ ...prev, [name]: value === '' ? null : Number(value) }));
        } else {
            setLocalCampus(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleUseCurrentLocation = () => {
        setIsFetchingLocation(true);
        setGpsAccuracy(null);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const acc = position.coords.accuracy;
                setGpsAccuracy(acc);
                
                setLocalCampus(prev => ({
                    ...prev, 
                    geofence_lat: position.coords.latitude, 
                    geofence_lng: position.coords.longitude,
                    // Set default radius based on accuracy to ensure it's usable
                    geofence_radius_meters: prev.geofence_radius_meters || Math.max(Math.round(acc) + 50, 200) 
                }));
                setIsFetchingLocation(false);
            },
            (error) => {
                alert(`Error getting location: ${error.message}`);
                setIsFetchingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };
    
    const googleMapsUrl = localCampus.geofence_lat && localCampus.geofence_lng 
        ? `https://www.google.com/maps/search/?api=1&query=${localCampus.geofence_lat},${localCampus.geofence_lng}` 
        : null;
    
    return (
        <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 gap-4">
                <input name="name" value={localCampus.name || ''} onChange={handleChange} placeholder="Campus Name" className="p-2 border rounded w-full"/>
                <input name="address" value={localCampus.address || ''} onChange={handleChange} placeholder="Address" className="p-2 border rounded w-full"/>
            </div>
            
            {/* Paystack API Settings */}
            <fieldset className="p-3 border rounded-md bg-white dark:bg-slate-900">
                <legend className="text-sm font-medium text-slate-700 dark:text-slate-300 px-1 flex items-center gap-2">
                    <BanknotesIcon className="w-4 h-4 text-green-600"/> Paystack Integration
                </legend>
                <p className="text-xs text-slate-500 mb-3">
                    Configure Paystack API keys for this campus. Used for DVA generation, fee collection, and bulk salary transfers.
                </p>
                
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Paystack Public Key</label>
                        <input 
                            type="text" 
                            name="paystack_public_key" 
                            value={localCampus.paystack_public_key || ''} 
                            onChange={handleChange} 
                            placeholder="pk_live_xxxx or pk_test_xxxx" 
                            className="p-2 border rounded w-full text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Paystack Secret Key</label>
                        <div className="relative">
                            <input 
                                type={showSecretKey ? 'text' : 'password'} 
                                name="paystack_secret_key" 
                                value={localCampus.paystack_secret_key || ''} 
                                onChange={handleChange} 
                                placeholder="sk_live_xxxx or sk_test_xxxx" 
                                className="p-2 border rounded w-full pr-10 text-sm"
                            />
                            <button 
                                type="button" 
                                onClick={() => setShowSecretKey(!showSecretKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showSecretKey ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-red-500 mt-1">⚠️ Keep secret key confidential. Never share publicly.</p>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">DVA Provider</label>
                        <select 
                            name="dva_provider" 
                            value={localCampus.dva_provider || 'titan-paystack'} 
                            onChange={handleChange}
                            className="p-2 border rounded w-full text-sm"
                        >
                            {DVA_PROVIDERS.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-400 mt-1">Bank provider for Dedicated Virtual Accounts</p>
                    </div>
                </div>
            </fieldset>
            
            <fieldset className="p-3 border rounded-md bg-white dark:bg-slate-900">
                <legend className="text-sm font-medium text-slate-700 dark:text-slate-300 px-1">Geofence Settings</legend>
                <p className="text-xs text-slate-500 mb-3">
                    Set coordinates to restrict check-ins to this location. Leave blank to allow check-ins from anywhere.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Latitude</label>
                        <input type="number" step="any" name="geofence_lat" value={localCampus.geofence_lat ?? ''} onChange={handleChange} placeholder="e.g., 6.5244" className="p-2 border rounded w-full"/>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Longitude</label>
                        <input type="number" step="any" name="geofence_lng" value={localCampus.geofence_lng ?? ''} onChange={handleChange} placeholder="e.g., 3.3792" className="p-2 border rounded w-full"/>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Radius (Meters)</label>
                        <input type="number" name="geofence_radius_meters" value={localCampus.geofence_radius_meters ?? ''} onChange={handleChange} placeholder="e.g., 500" className="p-2 border rounded w-full"/>
                        <p className="text-xs text-slate-400 mt-1">Recommended: 200-500 meters to account for GPS drift.</p>
                    </div>
                </div>

                 <div className="flex justify-between items-center mt-3">
                    <button type="button" onClick={handleUseCurrentLocation} disabled={isFetchingLocation} className="text-xs px-3 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-md flex items-center gap-1 hover:bg-blue-200">
                        {isFetchingLocation ? <Spinner size="sm" /> : <><MapPinIcon className="w-3 h-3"/> Use My Current Location</>}
                    </button>
                    
                    {googleMapsUrl && (
                        <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            Verify on Map ↗
                        </a>
                    )}
                </div>
                
                {gpsAccuracy !== null && (
                    <div className={`mt-2 text-xs p-2 rounded ${gpsAccuracy > 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                        <strong>GPS Accuracy:</strong> +/- {Math.round(gpsAccuracy)} meters. 
                        {gpsAccuracy > 50 ? ' (Signal weak - consider increasing radius)' : ' (Signal good)'}
                    </div>
                )}
            </fieldset>
            
            <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm bg-slate-200 dark:bg-slate-700 rounded-md">Cancel</button>
                <button onClick={() => onSave(localCampus)} disabled={isSaving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md flex items-center gap-2">
                    {isSaving && <Spinner size="sm"/>} Save Campus
                </button>
            </div>
        </div>
    );
};

export default CampusesManager;
