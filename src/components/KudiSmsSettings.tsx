import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { KudiSmsSettings } from '../types';
import Spinner from './common/Spinner';
import KudiSmsTestPanel from './KudiSmsTestPanel';
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
    const [showApiToken, setShowApiToken] = useState(false);
    const [activeTab, setActiveTab] = useState<'config' | 'test'>('config');
    const [formData, setFormData] = useState({
        campus_id: 0,
        api_token: '',
        sender_id: '',
        template_codes: {} as Record<string, string>,
        is_active: true
    });
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateCode, setNewTemplateCode] = useState('');

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
            api_token: '', // Don't show the actual token for security
            sender_id: setting.sender_id || '',
            template_codes: setting.template_codes || {},
            is_active: setting.is_active
        });
    };

    const handleAddTemplate = () => {
        if (!newTemplateName.trim() || !newTemplateCode.trim()) {
            alert('Please enter both template name and code');
            return;
        }

        setFormData({
            ...formData,
            template_codes: {
                ...formData.template_codes,
                [newTemplateName.trim()]: newTemplateCode.trim()
            }
        });
        setNewTemplateName('');
        setNewTemplateCode('');
    };

    const handleRemoveTemplate = (name: string) => {
        const updated = { ...formData.template_codes };
        delete updated[name];
        setFormData({ ...formData, template_codes: updated });
    };

    const handleSave = async () => {
        // Only validate API token for new entries, not edits
        if (!formData.api_token && editingCampus === null) {
            alert('API token is required');
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
                sender_id: formData.sender_id || null,
                template_codes: Object.keys(formData.template_codes).length > 0 
                    ? formData.template_codes 
                    : null,
                is_active: formData.is_active,
            };

            // Only include API token if it's being changed
            if (formData.api_token) {
                dataToSave.api_token = formData.api_token;
            }

            if (editingCampus !== null) {
                // Update existing record
                const { error } = await supabase
                    .from('kudisms_settings')
                    .update(dataToSave)
                    .eq('school_id', schoolId)
                    .eq('campus_id', editingCampus);

                if (error) throw error;
            } else {
                // Insert new record
                const { error } = await supabase
                    .from('kudisms_settings')
                    .insert(dataToSave);

                if (error) throw error;
            }

            // Reset form
            setFormData({
                campus_id: 0,
                api_token: '',
                sender_id: '',
                template_codes: {},
                is_active: true
            });
            setEditingCampus(null);
            await fetchData();
            alert('Settings saved successfully!');
        } catch (error: any) {
            console.error('Error saving settings:', error);
            alert(`Error saving settings: ${mapSupabaseError(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (campusId: number | null) => {
        if (!confirm('Are you sure you want to delete this configuration?')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('kudisms_settings')
                .delete()
                .eq('school_id', schoolId)
                .eq('campus_id', campusId);

            if (error) throw error;
            await fetchData();
            alert('Configuration deleted successfully!');
        } catch (error: any) {
            console.error('Error deleting configuration:', error);
            alert(`Error deleting configuration: ${mapSupabaseError(error)}`);
        }
    };

    const handleCancel = () => {
        setFormData({
            campus_id: 0,
            api_token: '',
            sender_id: '',
            template_codes: {},
            is_active: true
        });
        setEditingCampus(null);
    };

    // Get the active setting for test panel
    const activeSettings = settings.find(s => s.is_active);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`${
                            activeTab === 'config'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Configuration
                    </button>
                    <button
                        onClick={() => setActiveTab('test')}
                        className={`${
                            activeTab === 'test'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Test Panel
                    </button>
                </nav>
            </div>

            {/* Configuration Tab */}
            {activeTab === 'config' && (
                <div>
                    <h2 className="text-2xl font-bold mb-6">Kudi SMS Configuration</h2>

                    {/* Existing Configurations */}
                    {settings.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-lg font-semibold mb-4">Existing Configurations</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Campus
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Sender ID
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Templates
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
                                        {settings.map((setting) => (
                                            <tr key={setting.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {setting.campus_id === null
                                                        ? 'All Campuses'
                                                        : campuses.find((c) => c.id === setting.campus_id)?.name || 'Unknown'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {setting.sender_id || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900">
                                                    {setting.template_codes && Object.keys(setting.template_codes).length > 0
                                                        ? Object.keys(setting.template_codes).length + ' templates'
                                                        : 'None'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span
                                                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                            setting.is_active
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-red-100 text-red-800'
                                                        }`}
                                                    >
                                                        {setting.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    <button
                                                        onClick={() => handleEdit(setting)}
                                                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(setting.campus_id)}
                                                        className="text-red-600 hover:text-red-900"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Configuration Form */}
                    <div className="border-t pt-6">
                        <h3 className="text-lg font-semibold mb-4">
                            {editingCampus !== null ? 'Edit Configuration' : 'Add New Configuration'}
                        </h3>

                        <div className="space-y-4">
                            {/* Campus Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Campus
                                </label>
                                <select
                                    value={formData.campus_id}
                                    onChange={(e) =>
                                        setFormData({ ...formData, campus_id: parseInt(e.target.value) })
                                    }
                                    disabled={editingCampus !== null}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value={0}>All Campuses</option>
                                    {campuses.map((campus) => (
                                        <option key={campus.id} value={campus.id}>
                                            {campus.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* API Token */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    API Token
                                </label>
                                <div className="relative">
                                    <input
                                        type={showApiToken ? 'text' : 'password'}
                                        value={formData.api_token}
                                        onChange={(e) =>
                                            setFormData({ ...formData, api_token: e.target.value })
                                        }
                                        placeholder={editingCampus !== null ? 'Leave blank to keep current token' : 'Enter API token'}
                                        autoComplete="off"
                                        spellCheck="false"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiToken(!showApiToken)}
                                        className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
                                    >
                                        {showApiToken ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            {/* Sender ID */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Sender ID (for SMS)
                                </label>
                                <input
                                    type="text"
                                    value={formData.sender_id}
                                    onChange={(e) =>
                                        setFormData({ ...formData, sender_id: e.target.value })
                                    }
                                    placeholder="YourSenderID"
                                    maxLength={11}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Maximum 11 characters. Must be approved in Kudi SMS dashboard.
                                </p>
                            </div>

                            {/* Template Codes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    WhatsApp Template Codes
                                </label>
                                
                                {/* Existing Templates */}
                                {Object.keys(formData.template_codes).length > 0 && (
                                    <div className="mb-3 space-y-2">
                                        {Object.entries(formData.template_codes).map(([name, code]) => (
                                            <div key={name} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded">
                                                <span className="flex-1 text-sm">
                                                    <strong>{name}:</strong> {code}
                                                </span>
                                                <button
                                                    onClick={() => handleRemoveTemplate(name)}
                                                    className="text-red-600 hover:text-red-800 text-sm"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add Template Form */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newTemplateName}
                                        onChange={(e) => setNewTemplateName(e.target.value)}
                                        placeholder="Template name (e.g., payment_receipt)"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                        type="text"
                                        value={newTemplateCode}
                                        onChange={(e) => setNewTemplateCode(e.target.value)}
                                        placeholder="Code (e.g., 25XXXXX)"
                                        className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        onClick={handleAddTemplate}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                                    >
                                        Add
                                    </button>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Template codes must be pre-approved in your Kudi SMS dashboard
                                </p>
                            </div>

                            {/* Active Status */}
                            <div>
                                <label className="inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) =>
                                            setFormData({ ...formData, is_active: e.target.checked })
                                        }
                                        className="form-checkbox h-4 w-4 text-blue-600"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Active</span>
                                </label>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                                >
                                    {saving ? <Spinner /> : 'Save Configuration'}
                                </button>
                                {editingCampus !== null && (
                                    <button
                                        onClick={handleCancel}
                                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
                        <h4 className="font-semibold mb-2 text-blue-900">Setup Instructions</h4>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                            <li>Log in to your Kudi SMS Dashboard (<a href="https://my.kudisms.net" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">https://my.kudisms.net</a>)</li>
                            <li>Navigate to Settings {'>'} API to get your API token</li>
                            <li>Request and get approval for your Sender ID (for SMS)</li>
                            <li>Create and get approval for WhatsApp message templates</li>
                            <li>Copy the template codes and add them to the configuration above</li>
                            <li>Use the Test Panel tab to verify your configuration</li>
                        </ol>
                    </div>
                </div>
            )}

            {/* Test Panel Tab */}
            {activeTab === 'test' && (
                <div>
                    {activeSettings ? (
                        <KudiSmsTestPanel
                            schoolId={schoolId}
                            apiToken={activeSettings.api_token}
                            defaultSenderId={activeSettings.sender_id || ''}
                            templateCodes={activeSettings.template_codes || {}}
                        />
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-gray-500 mb-4">
                                No active Kudi SMS configuration found.
                            </p>
                            <button
                                onClick={() => setActiveTab('config')}
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                            >
                                Configure Kudi SMS
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default KudiSmsSettingsComponent;
