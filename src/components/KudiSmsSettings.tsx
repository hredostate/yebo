import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { KudiSmsSettings, SmsTemplate, NotificationChannel, NotificationType } from '../types';
import Spinner from './common/Spinner';
import { mapSupabaseError } from '../utils/errorHandling';

interface Campus {
    id: number;
    name: string;
}

interface KudiSmsSettingsProps {
    schoolId: number;
}

type TabType = 'configuration' | 'channels' | 'sms-templates' | 'whatsapp-templates' | 'test';

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
    { key: 'emergency_broadcast', label: 'Emergency Broadcast' },
];

const KudiSmsSettingsComponent: React.FC<KudiSmsSettingsProps> = ({ schoolId }) => {
    const [activeTab, setActiveTab] = useState<TabType>('configuration');
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [settings, setSettings] = useState<KudiSmsSettings | null>(null);
    const [templates, setTemplates] = useState<SmsTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [selectedCampus, setSelectedCampus] = useState<number>(0);
    const [balance, setBalance] = useState<string>('');
    const [loadingBalance, setLoadingBalance] = useState(false);
    
    // Configuration tab state
    const [configForm, setConfigForm] = useState({
        campus_id: 0,
        token: '',
        sender_id: '',
        enable_fallback: true,
        is_active: true
    });

    // Channels tab state
    const [channelConfig, setChannelConfig] = useState<Record<string, NotificationChannel>>({});

    // WhatsApp templates tab state
    const [whatsappTemplates, setWhatsappTemplates] = useState<Record<string, string>>({});

    // SMS Template editor state
    const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
    const [editedContent, setEditedContent] = useState('');

    // Test panel state
    const [testForm, setTestForm] = useState({
        messageType: 'sms' as 'sms' | 'whatsapp',
        recipient: '',
        template: '',
        params: ''
    });
    const [testResult, setTestResult] = useState<string>('');

    useEffect(() => {
        fetchData();
    }, [schoolId, selectedCampus]);

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

            // Fetch Kudi SMS settings
            let query = supabase
                .from('kudisms_settings')
                .select('*')
                .eq('school_id', schoolId);

            if (selectedCampus > 0) {
                query = query.eq('campus_id', selectedCampus);
            } else {
                query = query.is('campus_id', null);
            }

            const { data: settingsData, error: settingsError } = await query.single();

            if (!settingsError && settingsData) {
                setSettings(settingsData);
                setConfigForm({
                    campus_id: settingsData.campus_id || 0,
                    token: '',
                    sender_id: settingsData.sender_id || '',
                    enable_fallback: settingsData.enable_fallback ?? true,
                    is_active: settingsData.is_active
                });
                setChannelConfig(settingsData.notification_channels || {});
                setWhatsappTemplates(settingsData.whatsapp_template_codes || {});
            }

            // Fetch SMS templates
            const { data: templatesData, error: templatesError } = await supabase
                .from('sms_templates')
                .select('*')
                .eq('school_id', schoolId)
                .eq('is_active', true)
                .order('template_name');

            if (!templatesError) {
                setTemplates(templatesData || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfiguration = async () => {
        if (!configForm.sender_id) {
            alert('Sender ID is required');
            return;
        }

        if (!configForm.token && !settings) {
            alert('Token is required for new configuration');
            return;
        }

        setSaving(true);
        try {
            const dataToSave: any = {
                school_id: schoolId,
                campus_id: configForm.campus_id || null,
                sender_id: configForm.sender_id,
                enable_fallback: configForm.enable_fallback,
                is_active: configForm.is_active
            };

            if (configForm.token) {
                dataToSave.token = configForm.token;
            }

            if (settings) {
                // Update existing
                const { error } = await supabase
                    .from('kudisms_settings')
                    .update(dataToSave)
                    .eq('id', settings.id);

                if (error) throw error;
            } else {
                // Insert new
                const { error } = await supabase
                    .from('kudisms_settings')
                    .insert([dataToSave]);

                if (error) throw error;
            }

            alert('Configuration saved successfully');
            fetchData();
        } catch (error: any) {
            console.error('Error saving configuration:', error);
            alert(`Failed to save configuration: ${mapSupabaseError(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveChannels = async () => {
        if (!settings) {
            alert('Please configure basic settings first');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('kudisms_settings')
                .update({
                    notification_channels: channelConfig
                })
                .eq('id', settings.id);

            if (error) throw error;
            alert('Channel preferences saved successfully');
            fetchData();
        } catch (error: any) {
            console.error('Error saving channels:', error);
            alert(`Failed to save channels: ${mapSupabaseError(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveWhatsAppTemplates = async () => {
        if (!settings) {
            alert('Please configure basic settings first');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('kudisms_settings')
                .update({
                    whatsapp_template_codes: whatsappTemplates
                })
                .eq('id', settings.id);

            if (error) throw error;
            alert('WhatsApp template codes saved successfully');
            fetchData();
        } catch (error: any) {
            console.error('Error saving WhatsApp templates:', error);
            alert(`Failed to save WhatsApp templates: ${mapSupabaseError(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const handleEditTemplate = (template: SmsTemplate) => {
        setEditingTemplate(template);
        setEditedContent(template.message_content);
    };

    const handleSaveTemplate = async () => {
        if (!editingTemplate) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('sms_templates')
                .update({ message_content: editedContent })
                .eq('id', editingTemplate.id);

            if (error) throw error;
            alert('Template saved successfully');
            setEditingTemplate(null);
            fetchData();
        } catch (error: any) {
            console.error('Error saving template:', error);
            alert(`Failed to save template: ${mapSupabaseError(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const fetchBalance = async () => {
        if (!settings) return;

        setLoadingBalance(true);
        try {
            const { data, error } = await supabase.functions.invoke('kudisms-balance');

            if (error) {
                setBalance('Error fetching balance');
            } else if (data?.balanceFormatted) {
                setBalance(data.balanceFormatted);
            } else {
                setBalance('₦0.00');
            }
        } catch (error) {
            console.error('Error fetching balance:', error);
            setBalance('Error');
        } finally {
            setLoadingBalance(false);
        }
    };

    const handleSendTest = async () => {
        if (!testForm.recipient) {
            alert('Recipient phone number is required');
            return;
        }

        setTestResult('Sending...');
        try {
            const template = templates.find(t => t.template_name === testForm.template);
            if (!template && testForm.messageType === 'sms') {
                throw new Error('Template not found');
            }

            const body: any = {
                phone_number: testForm.recipient,
                school_id: schoolId,
            };

            if (testForm.messageType === 'whatsapp') {
                body.gateway = '2';
                body.template_code = whatsappTemplates[testForm.template] || '';
                body.params = testForm.params;
            } else {
                body.gateway = '1';
                body.message = template?.message_content || 'Test message';
            }

            const { data, error } = await supabase.functions.invoke('kudisms-send', { body });

            if (error || !data?.success) {
                setTestResult(`❌ Failed: ${error?.message || data?.error || 'Unknown error'}`);
            } else {
                setTestResult(`✅ Success! Message sent via ${testForm.messageType.toUpperCase()}`);
                fetchBalance(); // Refresh balance after sending
            }
        } catch (error: any) {
            console.error('Test send error:', error);
            setTestResult(`❌ Error: ${error.message}`);
        }
    };

    const getCharacterCount = (text: string) => {
        const length = text.length;
        const pages = Math.ceil(length / 160);
        return { length, pages };
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
                    Kudi SMS Messaging Gateway
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Configure SMS and WhatsApp messaging for your school
                </p>
            </div>

            {/* Campus Selector */}
            <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Campus:
                </label>
                <select
                    value={selectedCampus}
                    onChange={(e) => setSelectedCampus(Number(e.target.value))}
                    className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                    <option value={0}>All Campuses (Default)</option>
                    {campuses.map((campus) => (
                        <option key={campus.id} value={campus.id}>
                            {campus.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-8">
                    {[
                        { id: 'configuration', label: 'Configuration' },
                        { id: 'channels', label: 'Channels' },
                        { id: 'sms-templates', label: 'SMS Templates' },
                        { id: 'whatsapp-templates', label: 'WhatsApp Templates' },
                        { id: 'test', label: 'Test Panel' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {/* Tab 1: Configuration */}
                {activeTab === 'configuration' && (
                    <div className="space-y-4">
                        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/40">
                            <h4 className="font-medium text-slate-800 dark:text-white mb-4">
                                Basic Configuration
                            </h4>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        API Token *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showToken ? "text" : "password"}
                                            value={configForm.token}
                                            onChange={(e) => setConfigForm({ ...configForm, token: e.target.value })}
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
                                        {settings 
                                            ? 'Leave blank to keep existing token. Enter new token to update.'
                                            : 'Required for new configuration'}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Sender ID *
                                    </label>
                                    <input
                                        type="text"
                                        value={configForm.sender_id}
                                        onChange={(e) => setConfigForm({ ...configForm, sender_id: e.target.value })}
                                        placeholder="e.g., UPSS"
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Sender ID approved by Kudi SMS (default: UPSS)
                                    </p>
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="enable_fallback"
                                        checked={configForm.enable_fallback}
                                        onChange={(e) => setConfigForm({ ...configForm, enable_fallback: e.target.checked })}
                                        className="mr-2"
                                    />
                                    <label htmlFor="enable_fallback" className="text-sm text-slate-700 dark:text-slate-300">
                                        Enable fallback (if WhatsApp fails, try SMS)
                                    </label>
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={configForm.is_active}
                                        onChange={(e) => setConfigForm({ ...configForm, is_active: e.target.checked })}
                                        className="mr-2"
                                    />
                                    <label htmlFor="is_active" className="text-sm text-slate-700 dark:text-slate-300">
                                        Active
                                    </label>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Status:
                                    </span>
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                        settings?.is_active
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                    }`}>
                                        {settings?.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                <button
                                    onClick={handleSaveConfiguration}
                                    disabled={saving}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                                >
                                    {saving ? <Spinner size="sm" /> : 'Save Configuration'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 2: Channels */}
                {activeTab === 'channels' && (
                    <div className="space-y-4">
                        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/40">
                            <h4 className="font-medium text-slate-800 dark:text-white mb-4">
                                Per-Notification Channel Selection
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                Select the preferred channel for each notification type
                            </p>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="text-left py-2 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Notification Type
                                            </th>
                                            <th className="text-left py-2 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Channel
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {NOTIFICATION_TYPES.map((notif) => (
                                            <tr key={notif.key} className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="py-3 px-4 text-sm text-slate-800 dark:text-white">
                                                    {notif.label}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex gap-4">
                                                        <label className="flex items-center">
                                                            <input
                                                                type="radio"
                                                                name={`channel-${notif.key}`}
                                                                value="sms"
                                                                checked={channelConfig[notif.key] === 'sms'}
                                                                onChange={() => setChannelConfig({ ...channelConfig, [notif.key]: 'sms' })}
                                                                className="mr-2"
                                                            />
                                                            <span className="text-sm text-slate-700 dark:text-slate-300">SMS</span>
                                                        </label>
                                                        <label className="flex items-center">
                                                            <input
                                                                type="radio"
                                                                name={`channel-${notif.key}`}
                                                                value="whatsapp"
                                                                checked={channelConfig[notif.key] === 'whatsapp'}
                                                                onChange={() => setChannelConfig({ ...channelConfig, [notif.key]: 'whatsapp' })}
                                                                className="mr-2"
                                                            />
                                                            <span className="text-sm text-slate-700 dark:text-slate-300">WhatsApp</span>
                                                        </label>
                                                        <label className="flex items-center">
                                                            <input
                                                                type="radio"
                                                                name={`channel-${notif.key}`}
                                                                value="both"
                                                                checked={channelConfig[notif.key] === 'both'}
                                                                onChange={() => setChannelConfig({ ...channelConfig, [notif.key]: 'both' })}
                                                                className="mr-2"
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

                            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                                <p className="text-xs text-blue-800 dark:text-blue-300">
                                    <strong>Both:</strong> Try WhatsApp first, fallback to SMS if fails
                                </p>
                            </div>

                            <button
                                onClick={handleSaveChannels}
                                disabled={saving}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                            >
                                {saving ? <Spinner size="sm" /> : 'Save Channel Preferences'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Tab 3: SMS Templates */}
                {activeTab === 'sms-templates' && (
                    <div className="space-y-4">
                        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/40">
                            <h4 className="font-medium text-slate-800 dark:text-white mb-4">
                                SMS Templates
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                Click a template to edit its content
                            </p>

                            <div className="space-y-2">
                                {templates.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => handleEditTemplate(template)}
                                        className="w-full text-left p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                    >
                                        <div className="font-medium text-slate-800 dark:text-white">
                                            {template.template_name}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1 truncate">
                                            {template.message_content.substring(0, 100)}...
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Template Editor Modal */}
                        {editingTemplate && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
                                        Edit Template: {editingTemplate.template_name}
                                    </h3>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Available Variables:
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {editingTemplate.variables?.map((variable) => (
                                                <span
                                                    key={variable}
                                                    className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded"
                                                >
                                                    {`{{${variable}}}`}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Message Content:
                                        </label>
                                        <textarea
                                            value={editedContent}
                                            onChange={(e) => setEditedContent(e.target.value)}
                                            rows={10}
                                            className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm"
                                        />
                                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                                            <span>{getCharacterCount(editedContent).length} characters</span>
                                            <span>{getCharacterCount(editedContent).pages} page(s) (max 6)</span>
                                        </div>
                                        <div className="mt-2 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${
                                                    getCharacterCount(editedContent).pages > 6
                                                        ? 'bg-red-500'
                                                        : getCharacterCount(editedContent).pages > 3
                                                        ? 'bg-yellow-500'
                                                        : 'bg-green-500'
                                                }`}
                                                style={{ width: `${Math.min(100, (getCharacterCount(editedContent).length / 960) * 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSaveTemplate}
                                            disabled={saving || getCharacterCount(editedContent).pages > 6}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                                        >
                                            {saving ? <Spinner size="sm" /> : 'Save'}
                                        </button>
                                        <button
                                            onClick={() => setEditingTemplate(null)}
                                            className="px-4 py-2 bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-400 dark:hover:bg-slate-600"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 4: WhatsApp Templates */}
                {activeTab === 'whatsapp-templates' && (
                    <div className="space-y-4">
                        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/40">
                            <h4 className="font-medium text-slate-800 dark:text-white mb-4">
                                WhatsApp Template Codes
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                Enter template codes from your Kudi SMS Dashboard
                            </p>

                            <div className="space-y-3">
                                {NOTIFICATION_TYPES.map((notif) => (
                                    <div key={notif.key}>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            {notif.label}
                                        </label>
                                        <input
                                            type="text"
                                            value={whatsappTemplates[notif.key] || ''}
                                            onChange={(e) => setWhatsappTemplates({ ...whatsappTemplates, [notif.key]: e.target.value })}
                                            placeholder="Enter template code"
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                        />
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleSaveWhatsAppTemplates}
                                disabled={saving}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                            >
                                {saving ? <Spinner size="sm" /> : 'Save Template Codes'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Tab 5: Test Panel */}
                {activeTab === 'test' && (
                    <div className="space-y-4">
                        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/40">
                            <h4 className="font-medium text-slate-800 dark:text-white mb-4">
                                Test Panel
                            </h4>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Balance:
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                                            {balance || '—'}
                                        </span>
                                        <button
                                            onClick={fetchBalance}
                                            disabled={loadingBalance}
                                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
                                        >
                                            {loadingBalance ? <Spinner size="xs" /> : 'Refresh'}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Message Type:
                                    </label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                value="sms"
                                                checked={testForm.messageType === 'sms'}
                                                onChange={() => setTestForm({ ...testForm, messageType: 'sms' })}
                                                className="mr-2"
                                            />
                                            <span className="text-sm text-slate-700 dark:text-slate-300">SMS</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                value="whatsapp"
                                                checked={testForm.messageType === 'whatsapp'}
                                                onChange={() => setTestForm({ ...testForm, messageType: 'whatsapp' })}
                                                className="mr-2"
                                            />
                                            <span className="text-sm text-slate-700 dark:text-slate-300">WhatsApp</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Recipient Phone:
                                    </label>
                                    <input
                                        type="text"
                                        value={testForm.recipient}
                                        onChange={(e) => setTestForm({ ...testForm, recipient: e.target.value })}
                                        placeholder="2348012345678"
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Template:
                                    </label>
                                    <select
                                        value={testForm.template}
                                        onChange={(e) => setTestForm({ ...testForm, template: e.target.value })}
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

                                {testForm.messageType === 'whatsapp' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Parameters (comma-separated):
                                        </label>
                                        <input
                                            type="text"
                                            value={testForm.params}
                                            onChange={(e) => setTestForm({ ...testForm, params: e.target.value })}
                                            placeholder="param1,param2,param3"
                                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                        />
                                    </div>
                                )}

                                <button
                                    onClick={handleSendTest}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    Send Test
                                </button>

                                {testResult && (
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                        <p className="text-sm text-slate-800 dark:text-white whitespace-pre-wrap">
                                            {testResult}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KudiSmsSettingsComponent;
