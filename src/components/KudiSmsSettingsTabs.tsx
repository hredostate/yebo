/**
 * Tab Components for KudiSmsSettings
 */
import React, { useState } from 'react';
import type { KudiSmsSettings, SmsTemplate, NotificationType } from '../types';
import Spinner from './common/Spinner';
import { saveSmsTemplate } from '../services/smsService';

interface Campus {
    id: number;
    name: string;
}

const NOTIFICATION_TYPES: Array<{ key: NotificationType; label: string }> = [
    { key: 'payment_receipt', label: 'Payment Receipt' },
    { key: 'homework_missing', label: 'Homework Missing' },
    { key: 'homework_reminder', label: 'Homework Reminder' },
    { key: 'notes_incomplete', label: 'Notes Incomplete' },
    { key: 'lesson_published', label: 'Lesson Published' },
    { key: 'attendance_present', label: 'Attendance Present' },
    { key: 'absentee_alert', label: 'Absentee Alert' },
    { key: 'late_arrival', label: 'Late Arrival' },
    { key: 'subject_absentee', label: 'Subject Absentee' },
    { key: 'subject_late', label: 'Subject Late' },
    { key: 'report_card_ready', label: 'Report Card Ready' },
    { key: 'emergency_broadcast', label: 'Emergency Broadcast' }
];

// Configuration Tab Component
export const ConfigurationTab: React.FC<{
    settings: KudiSmsSettings[];
    campuses: Campus[];
    formData: any;
    setFormData: (data: any) => void;
    showToken: boolean;
    setShowToken: (show: boolean) => void;
    editingCampus: number | null;
    setEditingCampus: (id: number | null) => void;
    saving: boolean;
    handleSave: () => void;
    handleEdit: (setting: KudiSmsSettings) => void;
    handleDelete: (campusId: number | null) => void;
}> = ({
    settings,
    campuses,
    formData,
    setFormData,
    showToken,
    setShowToken,
    editingCampus,
    setEditingCampus,
    saving,
    handleSave,
    handleEdit,
    handleDelete
}) => {
    return (
        <div className="space-y-6">
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
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                        }`}>
                                            {setting.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                        <span className="text-xs">
                                            Sender ID: {setting.sender_id}
                                        </span>
                                        <span className="text-xs">
                                            Fallback: {setting.enable_fallback ? 'Enabled' : 'Disabled'}
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
                                ? 'Leave blank to keep the existing token. Enter a new token to update it.'
                                : 'Your Kudi SMS API token from your Kudi SMS account.'}
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
                            placeholder="e.g., SchoolName"
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            The sender ID that will appear on SMS messages. Must be approved by Kudi SMS.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
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

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="enable_fallback"
                                checked={formData.enable_fallback}
                                onChange={(e) => setFormData({ ...formData, enable_fallback: e.target.checked })}
                                className="mr-2"
                            />
                            <label htmlFor="enable_fallback" className="text-sm text-slate-700 dark:text-slate-300">
                                Enable fallback (WhatsApp → SMS)
                            </label>
                        </div>
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
                                        is_active: true,
                                        enable_fallback: true
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
                    📘 How to get your Kudi SMS credentials
                </h4>
                <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                    <li>Log in to your Kudi SMS account (<a href="https://my.kudisms.net" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">https://my.kudisms.net</a>)</li>
                    <li>Navigate to API section to get your API Token</li>
                    <li>Create and get approval for a Sender ID</li>
                    <li>Copy your credentials and paste them in the form above</li>
                    <li>Make sure you have sufficient credit balance for sending messages</li>
                </ol>
            </div>
        </div>
    );
};

// Channels Tab Component
export const ChannelsTab: React.FC<{
    channelPreferences: Record<string, 'sms' | 'whatsapp' | 'both'>;
    setChannelPreferences: (prefs: Record<string, 'sms' | 'whatsapp' | 'both'>) => void;
    saving: boolean;
    handleSave: () => void;
}> = ({ channelPreferences, setChannelPreferences, saving, handleSave }) => {
    const updateChannel = (notifType: string, channel: 'sms' | 'whatsapp' | 'both') => {
        setChannelPreferences({
            ...channelPreferences,
            [notifType]: channel
        });
    };

    return (
        <div className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                    Configure which channel (SMS, WhatsApp, or Both) should be used for each type of notification.
                    If "Both" is selected or fallback is enabled, the system will try WhatsApp first and fall back to SMS if it fails.
                </p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border border-slate-200 dark:border-slate-700">
                    <thead className="bg-slate-100 dark:bg-slate-800">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                                Notification Type
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                                Channel
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {NOTIFICATION_TYPES.map((notif) => (
                            <tr key={notif.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-200">
                                    {notif.label}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={notif.key}
                                                value="sms"
                                                checked={(channelPreferences[notif.key] || 'sms') === 'sms'}
                                                onChange={() => updateChannel(notif.key, 'sms')}
                                                className="text-blue-600"
                                            />
                                            <span className="text-sm text-slate-700 dark:text-slate-300">SMS</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={notif.key}
                                                value="whatsapp"
                                                checked={channelPreferences[notif.key] === 'whatsapp'}
                                                onChange={() => updateChannel(notif.key, 'whatsapp')}
                                                className="text-blue-600"
                                            />
                                            <span className="text-sm text-slate-700 dark:text-slate-300">WhatsApp</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={notif.key}
                                                value="both"
                                                checked={channelPreferences[notif.key] === 'both'}
                                                onChange={() => updateChannel(notif.key, 'both')}
                                                className="text-blue-600"
                                            />
                                            <span className="text-sm text-slate-700 dark:text-slate-300">Both</span>
                                        </label>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                >
                    {saving ? <Spinner size="sm" /> : 'Save Channel Preferences'}
                </button>
            </div>
        </div>
    );
};

// SMS Templates Tab Component
export const SmsTemplatesTab: React.FC<{
    templates: SmsTemplate[];
    fetchTemplates: () => void;
    schoolId: number;
}> = ({ templates, fetchTemplates, schoolId }) => {
    const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [saving, setSaving] = useState(false);

    const openEditModal = (template: SmsTemplate) => {
        setEditingTemplate(template);
        setEditContent(template.message_content);
        setModalOpen(true);
    };

    const handleSaveTemplate = async () => {
        if (!editingTemplate) return;

        setSaving(true);
        try {
            await saveSmsTemplate({
                ...editingTemplate,
                message_content: editContent
            });
            alert('Template saved successfully');
            setModalOpen(false);
            setEditingTemplate(null);
            fetchTemplates();
        } catch (error: any) {
            alert('Failed to save template: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const getCharacterCount = () => {
        const hasUnicode = /[^\x00-\x7F]/.test(editContent);
        const charLimit = hasUnicode ? 70 : 160;
        const pages = Math.ceil(editContent.length / charLimit);
        return { length: editContent.length, charLimit, pages };
    };

    const charCount = getCharacterCount();

    return (
        <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                    SMS templates are used for sending SMS messages. All templates are signed "- UPSS".
                    Variables are replaced with actual values when sending.
                </p>
            </div>

            {templates.length === 0 ? (
                <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                    No templates found. Templates are created automatically.
                </div>
            ) : (
                <div className="grid gap-4">
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/40"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h5 className="font-medium text-slate-800 dark:text-white">
                                        {template.template_name}
                                    </h5>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {template.variables?.map((variable) => (
                                            <span
                                                key={variable}
                                                className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded"
                                            >
                                                {`{{${variable}}}`}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={() => openEditModal(template)}
                                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Edit
                                </button>
                            </div>
                            <pre className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded">
                                {template.message_content}
                            </pre>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            {modalOpen && editingTemplate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 space-y-4">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                                Edit Template: {editingTemplate.template_name}
                            </h3>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Available Variables:
                                </label>
                                <div className="flex flex-wrap gap-1">
                                    {editingTemplate.variables?.map((variable) => (
                                        <span
                                            key={variable}
                                            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded"
                                        >
                                            {`{{${variable}}}`}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Message Content:
                                </label>
                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    rows={10}
                                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">
                                        {charCount.length}/{charCount.charLimit} ({charCount.pages} SMS page{charCount.pages !== 1 ? 's' : ''})
                                    </span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${
                                            charCount.pages > 6 ? 'bg-red-500' : 'bg-blue-500'
                                        }`}
                                        style={{ width: `${Math.min((charCount.length / (charCount.charLimit * 6)) * 100, 100)}%` }}
                                    />
                                </div>
                                {charCount.pages > 6 && (
                                    <p className="text-xs text-red-600 dark:text-red-400">
                                        Warning: Message exceeds 6 SMS pages (maximum allowed)
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => {
                                        setModalOpen(false);
                                        setEditingTemplate(null);
                                    }}
                                    className="px-4 py-2 bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-400 dark:hover:bg-slate-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveTemplate}
                                    disabled={saving || charCount.pages > 6}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                                >
                                    {saving ? <Spinner size="sm" /> : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// WhatsApp Templates Tab Component
export const WhatsAppTemplatesTab: React.FC<{
    whatsappCodes: Record<string, string>;
    setWhatsappCodes: (codes: Record<string, string>) => void;
    saving: boolean;
    handleSave: () => void;
}> = ({ whatsappCodes, setWhatsappCodes, saving, handleSave }) => {
    return (
        <div className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                    📱 WhatsApp Template Codes
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                    Enter the template codes from your Kudi SMS WhatsApp dashboard for each notification type.
                    These templates must be pre-approved by WhatsApp.
                </p>
            </div>

            <div className="grid gap-4">
                {NOTIFICATION_TYPES.map((notif) => (
                    <div key={notif.key} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {notif.label}
                        </label>
                        <input
                            type="text"
                            value={whatsappCodes[notif.key] || ''}
                            onChange={(e) => setWhatsappCodes({
                                ...whatsappCodes,
                                [notif.key]: e.target.value
                            })}
                            placeholder="Enter template code"
                            className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                    </div>
                ))}
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                >
                    {saving ? <Spinner size="sm" /> : 'Save WhatsApp Template Codes'}
                </button>
            </div>
        </div>
    );
};

// Test Panel Tab Component
export const TestPanelTab: React.FC<{
    balance: string;
    balanceLoading: boolean;
    testPhone: string;
    setTestPhone: (phone: string) => void;
    testMessageType: 'sms' | 'whatsapp';
    setTestMessageType: (type: 'sms' | 'whatsapp') => void;
    testTemplate: string;
    setTestTemplate: (template: string) => void;
    testParameters: string;
    setTestParameters: (params: string) => void;
    testResult: string;
    testing: boolean;
    templates: SmsTemplate[];
    handleRefreshBalance: () => void;
    handleTestSend: () => void;
}> = ({
    balance,
    balanceLoading,
    testPhone,
    setTestPhone,
    testMessageType,
    setTestMessageType,
    testTemplate,
    setTestTemplate,
    testParameters,
    setTestParameters,
    testResult,
    testing,
    templates,
    handleRefreshBalance,
    handleTestSend
}) => {
    return (
        <div className="space-y-6">
            {/* Balance Display */}
            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                <div className="flex justify-between items-center">
                    <div>
                        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Current Balance
                        </h4>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                            {balanceLoading ? <Spinner size="sm" /> : (balance || 'Not loaded')}
                        </p>
                    </div>
                    <button
                        onClick={handleRefreshBalance}
                        disabled={balanceLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                    >
                        {balanceLoading ? <Spinner size="sm" /> : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Test Message Form */}
            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/40 space-y-4">
                <h4 className="font-medium text-slate-800 dark:text-white">
                    Send Test Message
                </h4>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Message Type
                    </label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="messageType"
                                value="sms"
                                checked={testMessageType === 'sms'}
                                onChange={() => setTestMessageType('sms')}
                                className="text-blue-600"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">SMS</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="messageType"
                                value="whatsapp"
                                checked={testMessageType === 'whatsapp'}
                                onChange={() => setTestMessageType('whatsapp')}
                                className="text-blue-600"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">WhatsApp</span>
                        </label>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Recipient Phone (234XXXXXXXXXX)
                    </label>
                    <input
                        type="text"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        placeholder="2348012345678"
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Template
                    </label>
                    <select
                        value={testTemplate}
                        onChange={(e) => setTestTemplate(e.target.value)}
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                        <option value="">Select a template</option>
                        {templates.map((template) => (
                            <option key={template.id} value={template.template_name}>
                                {template.template_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Parameters (comma-separated for WhatsApp)
                    </label>
                    <input
                        type="text"
                        value={testParameters}
                        onChange={(e) => setTestParameters(e.target.value)}
                        placeholder="John Doe, 2024-01-15, Mathematics"
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        For SMS, will be mapped to variables. For WhatsApp, sent as-is to template.
                    </p>
                </div>

                <button
                    onClick={handleTestSend}
                    disabled={testing || !testPhone || !testTemplate}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400"
                >
                    {testing ? <Spinner size="sm" /> : 'Send Test Message'}
                </button>

                {/* Result Display */}
                {testResult && (
                    <div className={`p-4 rounded-lg ${
                        testResult.startsWith('✅') 
                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                    }`}>
                        <p className="text-sm font-medium">{testResult}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
