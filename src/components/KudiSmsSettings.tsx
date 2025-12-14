import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { KudiSmsSettings } from '../types';
import Spinner from './common/Spinner';
import { mapSupabaseError } from '../utils/errorHandling';

interface Campus {
    id: number;
    name: string;
}

interface KudiSmsSettingsProps {
    schoolId: number;
}

const KudiSmsSettingsComponent: React.FC<KudiSmsSettingsProps> = ({ schoolId }) => {
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [settings, setSettings] = useState<KudiSmsSettings[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingCampus, setEditingCampus] = useState<number | null>(null);
    const [showToken, setShowToken] = useState(false);
    const [formData, setFormData] = useState({
        campus_id: 0,
        token: '',
        sender_id: '',
        payment_receipt_template_code: '',
        fee_reminder_template_code: '',
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

            // Fetch existing Kudi SMS settings
            const { data: settingsData, error: settingsError } = await supabase
                .from('kudisms_settings')
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

    const handleEdit = (setting: KudiSmsSettings) => {
        setEditingCampus(setting.campus_id || 0);
        setFormData({
            campus_id: setting.campus_id || 0,
            token: '', // Don't show the actual token for security
            sender_id: setting.sender_id || '',
            payment_receipt_template_code: setting.payment_receipt_template_code || '',
            fee_reminder_template_code: setting.fee_reminder_template_code || '',
            is_active: setting.is_active
        });
    };

    const handleSave = async () => {
        // Only validate token for new entries, not edits
        if (!formData.token && editingCampus === null) {
            alert('API token is required');
            return;
        }

        if (!formData.sender_id) {
            alert('Sender ID is required');
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
                sender_id: formData.sender_id,
                payment_receipt_template_code: formData.payment_receipt_template_code || null,
                fee_reminder_template_code: formData.fee_reminder_template_code || null,
                is_active: formData.is_active
            };

            // Only include token if it's been entered (for edits, it's optional)
            if (formData.token) {
                dataToSave.token = formData.token;
            }

            if (editingCampus !== null) {
                // Update existing
                const { error } = await supabase
                    .from('kudisms_settings')
                    .update(dataToSave)
                    .eq('school_id', schoolId)
                    .eq('campus_id', editingCampus);

                if (error) throw error;
            } else {
                // Insert new (token is required)
                const { error } = await supabase
                    .from('kudisms_settings')
                    .insert([dataToSave]);

                if (error) throw error;
            }

            alert('Settings saved successfully');
            setEditingCampus(null);
            setFormData({
                campus_id: 0,
                token: '',
                sender_id: '',
                payment_receipt_template_code: '',
                fee_reminder_template_code: '',
                is_active: true
            });
            setShowToken(false);
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
        if (!confirm('Are you sure you want to delete these Kudi SMS settings?')) return;

        try {
            const { error } = await supabase
                .from('kudisms_settings')
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
                    Kudi SMS WhatsApp Messaging Gateway
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Configure Kudi SMS API credentials for WhatsApp messaging per campus.
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
                                            setting.is_active
                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                        }`}>
                                            {setting.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                        <span className="text-xs">
                                            Sender ID: {setting.sender_id}
                                        </span>
                                        {setting.payment_receipt_template_code && (
                                            <span className="text-xs">
                                                Payment Template: {setting.payment_receipt_template_code}
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
                    {editingCampus !== null ? 'Edit Kudi SMS Settings' : 'Add New Kudi SMS Settings'}
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
                            API Token *
                        </label>
                        <div className="relative">
                            <input
                                type={showToken ? "text" : "password"}
                                value={formData.token}
                                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                                placeholder="Your Kudi SMS API Token"
                                className="w-full p-2 pr-20 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                            <button
                                type="button"
                                onClick={() => setShowToken(!showToken)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                                {showToken ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            {editingCampus !== null 
                                ? 'Leave blank to keep the existing API token. Enter a new token to update it.'
                                : 'Your Kudi SMS API token from the Kudi SMS Dashboard.'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Sender ID *
                        </label>
                        <input
                            type="text"
                            value={formData.sender_id}
                            onChange={(e) => setFormData({ ...formData, sender_id: e.target.value })}
                            placeholder="Your approved Sender ID"
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Sender ID must be approved in your Kudi SMS dashboard
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Payment Receipt Template Code
                        </label>
                        <input
                            type="text"
                            value={formData.payment_receipt_template_code}
                            onChange={(e) => setFormData({ ...formData, payment_receipt_template_code: e.target.value })}
                            placeholder="e.g., 25XXXXX"
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            WhatsApp template code for payment receipts (must be pre-approved)
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Fee Reminder Template Code
                        </label>
                        <input
                            type="text"
                            value={formData.fee_reminder_template_code}
                            onChange={(e) => setFormData({ ...formData, fee_reminder_template_code: e.target.value })}
                            placeholder="e.g., 25XXXXX"
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            WhatsApp template code for fee reminders (must be pre-approved)
                        </p>
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
                                        token: '',
                                        sender_id: '',
                                        payment_receipt_template_code: '',
                                        fee_reminder_template_code: '',
                                        is_active: true
                                    });
                                    setShowToken(false);
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
                    📘 How to get your Kudi SMS API credentials
                </h4>
                <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                    <li>Log in to your Kudi SMS Dashboard (<a href="https://my.kudisms.net" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">https://my.kudisms.net</a>)</li>
                    <li>Navigate to API section to get your API Token</li>
                    <li>Request and get approval for your Sender ID</li>
                    <li>Create and get approval for WhatsApp templates before use</li>
                    <li>Note down your template codes (e.g., 25XXXXX)</li>
                    <li>Paste your credentials in the form above</li>
                    <li>Phone numbers must be in format 234XXXXXXXXXX (Nigerian format)</li>
                </ol>
            </div>
        </div>
    );
};

export default KudiSmsSettingsComponent;
