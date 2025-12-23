import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { PaystackApiSettings } from '../types';
import Spinner from './common/Spinner';
import { mapSupabaseError } from '../utils/errorHandling';

interface Campus {
    id: number;
    name: string;
}

interface PaymentGatewaySettingsProps {
    schoolId: number;
}

const PaymentGatewaySettings: React.FC<PaymentGatewaySettingsProps> = ({ schoolId }) => {
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [settings, setSettings] = useState<PaystackApiSettings[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingCampus, setEditingCampus] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        campus_id: 0,
        secret_key: '',
        public_key: '',
        environment: 'test' as 'test' | 'live',
        enabled: true
    });

    useEffect(() => {
        fetchData();
    }, [schoolId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const supabase = requireSupabaseClient();
            // Fetch campuses
            const { data: campusData, error: campusError } = await supabase
                .from('campuses')
                .select('id, name')
                .eq('school_id', schoolId)
                .order('name');

            if (campusError) throw campusError;
            setCampuses(campusData || []);

            // Fetch existing API settings
            const { data: settingsData, error: settingsError } = await supabase
                .from('paystack_api_settings')
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

    const handleEdit = (setting: PaystackApiSettings) => {
        setEditingCampus(setting.campus_id || 0);
        setFormData({
            campus_id: setting.campus_id || 0,
            secret_key: '', // Don't show the actual key for security
            public_key: setting.public_key || '',
            environment: setting.environment,
            enabled: setting.enabled
        });
    };

    const handleSave = async () => {
        if (!formData.secret_key && editingCampus === null) {
            alert('Secret key is required');
            return;
        }

        setSaving(true);
        try {
            const supabase = requireSupabaseClient();
            const dataToSave = {
                school_id: schoolId,
                campus_id: formData.campus_id || null,
                secret_key: formData.secret_key,
                public_key: formData.public_key,
                environment: formData.environment,
                enabled: formData.enabled,
                updated_at: new Date().toISOString()
            };

            if (editingCampus !== null) {
                // Update existing
                const { error } = await supabase
                    .from('paystack_api_settings')
                    .update(dataToSave)
                    .eq('school_id', schoolId)
                    .eq('campus_id', editingCampus);

                if (error) throw error;
            } else {
                // Insert new
                const { error } = await supabase
                    .from('paystack_api_settings')
                    .insert([dataToSave]);

                if (error) throw error;
            }

            alert('Settings saved successfully');
            setEditingCampus(null);
            setFormData({
                campus_id: 0,
                secret_key: '',
                public_key: '',
                environment: 'test',
                enabled: true
            });
            fetchData();
        } catch (error: any) {
            console.error('Error saving settings:', error);
            const userFriendlyMessage = mapSupabaseError(error);
            alert(`Failed to save settings: ${userFriendlyMessage}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (campus_id: number | null) => {
        if (!confirm('Are you sure you want to delete these API settings?')) return;

        try {
            const supabase = requireSupabaseClient();
            const { error } = await supabase
                .from('paystack_api_settings')
                .delete()
                .eq('school_id', schoolId)
                .eq('campus_id', campus_id);

            if (error) throw error;
            alert('Settings deleted successfully');
            fetchData();
        } catch (error: any) {
            console.error('Error deleting settings:', error);
            const userFriendlyMessage = mapSupabaseError(error);
            alert(`Failed to delete settings: ${userFriendlyMessage}`);
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
                    Paystack Payment Gateway
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Configure Paystack API credentials for dedicated virtual accounts (DVA) per campus.
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
                                            setting.enabled
                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                        }`}>
                                            {setting.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
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
                    {editingCampus !== null ? 'Edit API Settings' : 'Add New API Settings'}
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
                            Secret Key *
                        </label>
                        <input
                            type="password"
                            value={formData.secret_key}
                            onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
                            placeholder="sk_test_..."
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Your Paystack secret key. Get it from your Paystack Dashboard.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Public Key (Optional)
                        </label>
                        <input
                            type="text"
                            value={formData.public_key}
                            onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
                            placeholder="pk_test_..."
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
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
                            id="enabled"
                            checked={formData.enabled}
                            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                            className="mr-2"
                        />
                        <label htmlFor="enabled" className="text-sm text-slate-700 dark:text-slate-300">
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
                                        secret_key: '',
                                        public_key: '',
                                        environment: 'test',
                                        enabled: true
                                    });
                                }}
                                className="px-4 py-2 bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-400 dark:hover:bg-slate-600"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                    📘 How to get your Paystack API Keys
                </h4>
                <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                    <li>Log in to your Paystack Dashboard</li>
                    <li>Go to Settings → API Keys & Webhooks</li>
                    <li>Copy your Secret Key (starts with sk_test_ or sk_live_)</li>
                    <li>Paste it in the form above</li>
                    <li>Make sure to use Test keys for testing and Live keys for production</li>
                </ol>
            </div>
        </div>
    );
};

export default PaymentGatewaySettings;
