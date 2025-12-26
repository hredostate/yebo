/**
 * Green-API Settings Component
 * 
 * Allows schools to configure Green-API WhatsApp integration.
 * Green-API provides WhatsApp messaging at $12/month instead of per-message pricing.
 */

import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import { testGreenApiConnection } from '../services/greenApiService';
import type { GreenApiSettings } from '../types';

interface GreenApiSettingsProps {
    schoolId: number;
    campusId?: number | null;
    onClose?: () => void;
    addToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function GreenApiSettingsComponent({ schoolId, campusId, onClose, addToast }: GreenApiSettingsProps) {
    const [settings, setSettings] = useState<GreenApiSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    
    const [formData, setFormData] = useState({
        instance_id: '',
        api_token: '',
        api_url: 'https://api.green-api.com',
        media_url: 'https://media.green-api.com',
        is_active: true,
        test_phone: '',
    });

    const supabase = requireSupabaseClient();

    // Load existing settings
    useEffect(() => {
        loadSettings();
    }, [schoolId, campusId]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            
            let query = supabase
                .from('greenapi_settings')
                .select('*')
                .eq('school_id', schoolId);

            if (campusId) {
                query = query.eq('campus_id', campusId);
            } else {
                query = query.is('campus_id', null);
            }

            const { data, error } = await query.maybeSingle();

            if (error) {
                console.error('Error loading Green-API settings:', error);
            } else if (data) {
                setSettings(data);
                setFormData({
                    instance_id: data.instance_id,
                    api_token: data.api_token,
                    api_url: data.api_url,
                    media_url: data.media_url,
                    is_active: data.is_active,
                    test_phone: '',
                });
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setTestResult(null);

            const dataToSave = {
                school_id: schoolId,
                campus_id: campusId,
                instance_id: formData.instance_id.trim(),
                api_token: formData.api_token.trim(),
                api_url: formData.api_url.trim(),
                media_url: formData.media_url.trim(),
                is_active: formData.is_active,
            };

            if (settings) {
                // Update existing
                const { error } = await supabase
                    .from('greenapi_settings')
                    .update(dataToSave)
                    .eq('id', settings.id);

                if (error) throw error;
            } else {
                // Insert new
                const { error } = await supabase
                    .from('greenapi_settings')
                    .insert(dataToSave);

                if (error) throw error;
            }

            await loadSettings();
            
            if (addToast) {
                addToast('Green-API settings saved successfully!', 'success');
            }
        } catch (error: any) {
            console.error('Error saving settings:', error);
            if (addToast) {
                addToast(`Failed to save settings: ${error.message}`, 'error');
            } else {
                alert(`Failed to save settings: ${error.message}`);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        if (!formData.test_phone.trim()) {
            if (addToast) {
                addToast('Please enter a test phone number', 'error');
            } else {
                alert('Please enter a test phone number');
            }
            return;
        }

        try {
            setTesting(true);
            setTestResult(null);

            const result = await testGreenApiConnection(
                schoolId,
                formData.test_phone,
                campusId
            );

            setTestResult({
                success: result.success,
                message: result.success
                    ? '✅ Connection successful! Test message sent.'
                    : `❌ Connection failed: ${result.error}`,
            });
        } catch (error: any) {
            setTestResult({
                success: false,
                message: `❌ Test failed: ${error.message}`,
            });
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
            <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800">
                    Green-API WhatsApp Settings
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                    Configure Green-API for WhatsApp messaging at $12/month.
                    SMS will continue to use KudiSMS at ₦5.95/message.
                </p>
            </div>

            <div className="p-6 space-y-6">
                {/* Instance ID */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Instance ID
                        <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.instance_id}
                        onChange={(e) => setFormData({ ...formData, instance_id: e.target.value })}
                        placeholder="e.g., 1101234567"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Find this in your Green-API console
                    </p>
                </div>

                {/* API Token */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Token
                        <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                        type="password"
                        value={formData.api_token}
                        onChange={(e) => setFormData({ ...formData, api_token: e.target.value })}
                        placeholder="Enter your API token"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Keep this secure - found in Green-API console
                    </p>
                </div>

                {/* API URL */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        API URL
                    </label>
                    <input
                        type="url"
                        value={formData.api_url}
                        onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Default: https://api.green-api.com
                    </p>
                </div>

                {/* Media URL */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Media URL
                    </label>
                    <input
                        type="url"
                        value={formData.media_url}
                        onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Default: https://media.green-api.com
                    </p>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-700">
                        Active (Enable WhatsApp via Green-API)
                    </label>
                </div>

                {/* Test Connection Section */}
                <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Test Connection
                    </h3>
                    <div className="space-y-3">
                        <input
                            type="tel"
                            value={formData.test_phone}
                            onChange={(e) => setFormData({ ...formData, test_phone: e.target.value })}
                            placeholder="Test phone number (e.g., 08012345678)"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                            onClick={handleTestConnection}
                            disabled={testing || !settings || !formData.test_phone.trim()}
                            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {testing ? 'Testing...' : 'Send Test Message'}
                        </button>
                        {!settings && (
                            <p className="text-sm text-yellow-600">
                                ⚠️ Save settings first before testing
                            </p>
                        )}
                    </div>
                    {testResult && (
                        <div
                            className={`mt-4 p-4 rounded-lg ${
                                testResult.success
                                    ? 'bg-green-50 border border-green-200 text-green-800'
                                    : 'bg-red-50 border border-red-200 text-red-800'
                            }`}
                        >
                            {testResult.message}
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving || !formData.instance_id.trim() || !formData.api_token.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? 'Saving...' : settings ? 'Update Settings' : 'Save Settings'}
                </button>
            </div>

            {/* Info Box */}
            <div className="p-6 bg-blue-50 border-t border-blue-100">
                <h4 className="font-semibold text-blue-900 mb-2">ℹ️ About Green-API</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Fixed monthly cost of $12 instead of per-message pricing</li>
                    <li>• Supports text messages, files, buttons, and forwarding</li>
                    <li>• Files can be uploaded for bulk sending (valid 15 days)</li>
                    <li>• SMS will continue using KudiSMS at ₦5.95/message</li>
                </ul>
            </div>
        </div>
    );
}

export default GreenApiSettingsComponent;
