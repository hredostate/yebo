import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { TermiiSettings } from '../types';
import Spinner from './common/Spinner';

interface Campus {
    id: number;
    name: string;
}

interface TermiiSettingsProps {
    schoolId: number;
}

const TermiiSettingsComponent: React.FC<TermiiSettingsProps> = ({ schoolId }) => {
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [settings, setSettings] = useState<TermiiSettings[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingCampus, setEditingCampus] = useState<number | null>(null);
    const [showApiKey, setShowApiKey] = useState(false);
    const [formData, setFormData] = useState({
        campus_id: 0,
        api_key: '',
        device_id: '',
        base_url: 'https://api.ng.termii.com',
        environment: 'test' as 'test' | 'live',
        is_active: true
    });

    useEffect(() => {
        fetchData();
    }, [schoolId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch campuses
            const { data: campusData, error: campusError } = await supabase
                .from('campuses')
                .select('id, name')
                .eq('school_id', schoolId)
                .order('name');

            if (campusError) throw campusError;
            setCampuses(campusData || []);

            // Fetch existing Termii settings
            const { data: settingsData, error: settingsError } = await supabase
                .from('termii_settings')
                .select('*, campus:campuses(name)')
                .eq('school_id', schoolId);

            if (settingsError) throw settingsError;
            setSettings(settingsData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (setting: TermiiSettings) => {
        setEditingCampus(setting.campus_id || 0);
        setFormData({
            campus_id: setting.campus_id || 0,
            api_key: '', // Don't show the actual key for security
            device_id: setting.device_id || '',
            base_url: setting.base_url || 'https://api.ng.termii.com',
            environment: setting.environment,
            is_active: setting.is_active
        });
    };

    const handleSave = async () => {
        // Only validate API key for new entries, not edits
        if (!formData.api_key && editingCampus === null) {
            alert('API key is required');
            return;
        }

        // Check for duplicate campus configuration (client-side)
        if (editingCampus === null) {
            const existingConfig = settings.find(s => 
                (s.campus_id || 0) === formData.campus_id
            );
            if (existingConfig) {
                alert('A configuration already exists for this campus. Please edit the existing one.');
                return;
            }
        }

        setSaving(true);
        try {
            const dataToSave: any = {
                school_id: schoolId,
                campus_id: formData.campus_id || null,
                device_id: formData.device_id || null,
                base_url: formData.base_url,
                environment: formData.environment,
                is_active: formData.is_active
            };

            // Only include api_key if it's been entered (for edits, it's optional)
            if (formData.api_key) {
                dataToSave.api_key = formData.api_key;
            }

            if (editingCampus !== null) {
                // Update existing
                const { error } = await supabase
                    .from('termii_settings')
                    .update(dataToSave)
                    .eq('school_id', schoolId)
                    .eq('campus_id', editingCampus);

                if (error) throw error;
            } else {
                // Insert new (api_key is required)
                const { error } = await supabase
                    .from('termii_settings')
                    .insert([dataToSave]);

                if (error) throw error;
            }

            alert('Settings saved successfully');
            setEditingCampus(null);
            setFormData({
                campus_id: 0,
                api_key: '',
                device_id: '',
                base_url: 'https://api.ng.termii.com',
                environment: 'test',
                is_active: true
            });
            setShowApiKey(false);
            fetchData();
        } catch (error: any) {
            console.error('Error saving settings:', error);
            alert(`Failed to save settings: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (campus_id: number | null) => {
        if (!confirm('Are you sure you want to delete these Termii settings?')) return;

        try {
            const { error } = await supabase
                .from('termii_settings')
                .delete()
                .eq('school_id', schoolId)
                .eq('campus_id', campus_id);

            if (error) throw error;
            alert('Settings deleted successfully');
            fetchData();
        } catch (error: any) {
            console.error('Error deleting settings:', error);
            alert(`Failed to delete settings: ${error.message}`);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-8">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                    Termii WhatsApp Messaging Gateway
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Configure Termii API credentials for WhatsApp messaging per campus.
                </p>
            </div>

            {/* Existing Settings */}
            {settings.length > 0 && (
                <div className="space-y-3">
                    <h4 className="font-medium text-slate-700 dark:text-slate-300">
                        Configured Campuses
                    </h4>
                    {settings.map((setting) => (
                        <div
                            key={setting.id}
                            className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-slate-800 dark:text-white">
                                        {setting.campus?.name || 'All Campuses'}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-600 dark:text-slate-400">
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                            setting.environment === 'live'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                        }`}>
                                            {setting.environment.toUpperCase()}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                            setting.is_active
                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                        }`}>
                                            {setting.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                        {setting.device_id && (
                                            <span className="text-xs">
                                                Device ID: {setting.device_id.substring(0, 8)}...
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(setting)}
                                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(setting.campus_id)}
                                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Form */}
            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/40">
                <h4 className="font-medium text-slate-800 dark:text-white mb-4">
                    {editingCampus !== null ? 'Edit Termii Settings' : 'Add New Termii Settings'}
                </h4>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Campus
                        </label>
                        <select
                            value={formData.campus_id}
                            onChange={(e) => setFormData({ ...formData, campus_id: Number(e.target.value) })}
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            disabled={editingCampus !== null}
                        >
                            <option value={0}>All Campuses (Default)</option>
                            {campuses.map((campus) => (
                                <option key={campus.id} value={campus.id}>
                                    {campus.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            API Key *
                        </label>
                        <div className="relative">
                            <input
                                type={showApiKey ? "text" : "password"}
                                value={formData.api_key}
                                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                                placeholder="Your Termii API Key"
                                className="w-full p-2 pr-20 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                                {showApiKey ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            {editingCampus !== null 
                                ? 'Leave blank to keep the existing API key. Enter a new key to update it.'
                                : 'Your Termii API key from the Termii Dashboard.'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            WhatsApp Device ID (Optional)
                        </label>
                        <input
                            type="text"
                            value={formData.device_id}
                            onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                            placeholder="Device ID for WhatsApp"
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Required only if you want to send WhatsApp messages.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Base URL
                        </label>
                        <input
                            type="text"
                            value={formData.base_url}
                            onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                            placeholder="https://api.ng.termii.com"
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Default is https://api.ng.termii.com
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Environment
                        </label>
                        <select
                            value={formData.environment}
                            onChange={(e) => setFormData({ ...formData, environment: e.target.value as 'test' | 'live' })}
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        >
                            <option value="test">Test</option>
                            <option value="live">Live</option>
                        </select>
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            className="mr-2"
                        />
                        <label htmlFor="is_active" className="text-sm text-slate-700 dark:text-slate-300">
                            Enable this configuration
                        </label>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                        >
                            {saving ? <Spinner size="sm" /> : (editingCampus !== null ? 'Update' : 'Save')}
                        </button>
                        {editingCampus !== null && (
                            <button
                                onClick={() => {
                                    setEditingCampus(null);
                                    setFormData({
                                        campus_id: 0,
                                        api_key: '',
                                        device_id: '',
                                        base_url: 'https://api.ng.termii.com',
                                        environment: 'test',
                                        is_active: true
                                    });
                                    setShowApiKey(false);
                                }}
                                className="px-4 py-2 bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-400 dark:hover:bg-slate-600"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Help Section */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                    📘 How to get your Termii API credentials
                </h4>
                <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                    <li>Log in to your Termii Dashboard (<a href="https://accounts.termii.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">https://accounts.termii.com</a>)</li>
                    <li>Go to API section to copy your API Key</li>
                    <li>For WhatsApp, go to Manage Devices to get your Device ID</li>
                    <li>Create and get approval for WhatsApp templates before sending messages</li>
                    <li>Paste your credentials in the form above</li>
                    <li>Use Test environment for testing and Live for production</li>
                </ol>
            </div>
        </div>
    );
};

export default TermiiSettingsComponent;
