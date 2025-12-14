import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { KudiSmsSettings, SmsTemplate, NotificationType } from '../types';
import Spinner from './common/Spinner';
import { mapSupabaseError } from '../utils/errorHandling';
import { getKudiSmsBalance, testSendMessage } from '../services/kudiSmsService';
import { getSmsTemplates, saveSmsTemplate } from '../services/smsService';
import {
    ConfigurationTab,
    ChannelsTab,
    SmsTemplatesTab,
    WhatsAppTemplatesTab,
    TestPanelTab
} from './KudiSmsSettingsTabs';

interface Campus {
    id: number;
    name: string;
}

interface KudiSmsSettingsProps {
    schoolId: number;
}

type TabType = 'configuration' | 'channels' | 'sms_templates' | 'whatsapp_templates' | 'test_panel';

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

const KudiSmsSettingsComponent: React.FC<KudiSmsSettingsProps> = ({ schoolId }) => {
    const [activeTab, setActiveTab] = useState<TabType>('configuration');
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
        is_active: true,
        enable_fallback: true
    });

    // SMS Templates state
    const [templates, setTemplates] = useState<SmsTemplate[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
    const [templateModalOpen, setTemplateModalOpen] = useState(false);

    // Channel preferences state
    const [channelPreferences, setChannelPreferences] = useState<Record<string, 'sms' | 'whatsapp' | 'both'>>({});
    
    // WhatsApp template codes state
    const [whatsappCodes, setWhatsappCodes] = useState<Record<string, string>>({});

    // Test panel state
    const [balance, setBalance] = useState<string>('');
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [testMessageType, setTestMessageType] = useState<'sms' | 'whatsapp'>('sms');
    const [testTemplate, setTestTemplate] = useState('');
    const [testParameters, setTestParameters] = useState('');
    const [testResult, setTestResult] = useState<string>('');
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        fetchData();
    }, [schoolId]);

    useEffect(() => {
        if (activeTab === 'sms_templates') {
            fetchTemplates();
        }
    }, [activeTab]);

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

            // Load channel preferences and WhatsApp codes from first active setting
            const activeSetting = settingsData?.find(s => s.is_active);
            if (activeSetting) {
                setChannelPreferences(activeSetting.notification_channels || {});
                setWhatsappCodes(activeSetting.whatsapp_template_codes || {});
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async () => {
        const templatesData = await getSmsTemplates(schoolId);
        setTemplates(templatesData);
    };

    const handleEdit = (setting: KudiSmsSettings) => {
        setEditingCampus(setting.campus_id || 0);
        setFormData({
            campus_id: setting.campus_id || 0,
            token: '', // Don't show the actual token for security
            sender_id: setting.sender_id || '',
            is_active: setting.is_active,
            enable_fallback: setting.enable_fallback ?? true
        });
        setChannelPreferences(setting.notification_channels || {});
        setWhatsappCodes(setting.whatsapp_template_codes || {});
    };

    const handleSave = async () => {
        // Validate required fields
        if (!formData.sender_id) {
            alert('Sender ID is required');
            return;
        }

        // Only validate token for new entries, not edits
        if (!formData.token && editingCampus === null) {
            alert('Token is required');
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
                is_active: formData.is_active,
                enable_fallback: formData.enable_fallback,
                notification_channels: channelPreferences,
                whatsapp_template_codes: whatsappCodes
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
                is_active: true,
                enable_fallback: true
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

    const handleSaveChannelPreferences = async () => {
        setSaving(true);
        try {
            // Update the active setting with new channel preferences
            const activeSetting = settings.find(s => s.is_active);
            if (!activeSetting) {
                alert('No active configuration found');
                return;
            }

            const { error } = await supabase
                .from('kudisms_settings')
                .update({ notification_channels: channelPreferences })
                .eq('id', activeSetting.id);

            if (error) throw error;
            alert('Channel preferences saved successfully');
            fetchData();
        } catch (error: any) {
            console.error('Error saving channel preferences:', error);
            alert(`Failed to save: ${mapSupabaseError(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveWhatsAppCodes = async () => {
        setSaving(true);
        try {
            const activeSetting = settings.find(s => s.is_active);
            if (!activeSetting) {
                alert('No active configuration found');
                return;
            }

            const { error } = await supabase
                .from('kudisms_settings')
                .update({ whatsapp_template_codes: whatsappCodes })
                .eq('id', activeSetting.id);

            if (error) throw error;
            alert('WhatsApp template codes saved successfully');
            fetchData();
        } catch (error: any) {
            console.error('Error saving WhatsApp codes:', error);
            alert(`Failed to save: ${mapSupabaseError(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const handleRefreshBalance = async () => {
        setBalanceLoading(true);
        try {
            const result = await getKudiSmsBalance(schoolId);
            if (result.success) {
                setBalance(`${result.currency}${result.balance}`);
            } else {
                setBalance('Error: ' + result.error);
            }
        } catch (error: any) {
            setBalance('Error: ' + error.message);
        } finally {
            setBalanceLoading(false);
        }
    };

    const handleTestSend = async () => {
        if (!testPhone || !testTemplate) {
            alert('Please provide phone number and template');
            return;
        }

        setTesting(true);
        setTestResult('');
        try {
            // Parse parameters (comma-separated)
            const params: Record<string, string> = {};
            if (testParameters) {
                const paramArray = testParameters.split(',').map(p => p.trim());
                paramArray.forEach((value, index) => {
                    params[`param${index + 1}`] = value;
                });
            }

            const result = await testSendMessage({
                schoolId,
                recipientPhone: testPhone,
                messageType: testMessageType,
                templateName: testTemplate,
                variables: params
            });

            if (result.success) {
                setTestResult(`✅ Success! Message sent via ${result.channel}${result.fallback ? ' (fallback)' : ''}`);
            } else {
                setTestResult(`❌ Failed: ${result.error}`);
            }

            // Refresh balance after send
            handleRefreshBalance();
        } catch (error: any) {
            setTestResult(`❌ Error: ${error.message}`);
        } finally {
            setTesting(false);
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
                    Kudi SMS Messaging Gateway
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Configure multi-channel messaging (SMS & WhatsApp) via Kudi SMS API.
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-slate-200 dark:border-slate-700">
                <div className="flex gap-2 overflow-x-auto">
                    {[
                        { key: 'configuration', label: 'Configuration' },
                        { key: 'channels', label: 'Channels' },
                        { key: 'sms_templates', label: 'SMS Templates' },
                        { key: 'whatsapp_templates', label: 'WhatsApp' },
                        { key: 'test_panel', label: 'Test Panel' }
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as TabType)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === tab.key
                                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === 'configuration' && (
                    <ConfigurationTab
                        settings={settings}
                        campuses={campuses}
                        formData={formData}
                        setFormData={setFormData}
                        showToken={showToken}
                        setShowToken={setShowToken}
                        editingCampus={editingCampus}
                        setEditingCampus={setEditingCampus}
                        saving={saving}
                        handleSave={handleSave}
                        handleEdit={handleEdit}
                        handleDelete={handleDelete}
                    />
                )}

                {activeTab === 'channels' && (
                    <ChannelsTab
                        channelPreferences={channelPreferences}
                        setChannelPreferences={setChannelPreferences}
                        saving={saving}
                        handleSave={handleSaveChannelPreferences}
                    />
                )}

                {activeTab === 'sms_templates' && (
                    <SmsTemplatesTab
                        templates={templates}
                        fetchTemplates={fetchTemplates}
                        schoolId={schoolId}
                    />
                )}

                {activeTab === 'whatsapp_templates' && (
                    <WhatsAppTemplatesTab
                        whatsappCodes={whatsappCodes}
                        setWhatsappCodes={setWhatsappCodes}
                        saving={saving}
                        handleSave={handleSaveWhatsAppCodes}
                    />
                )}

                {activeTab === 'test_panel' && (
                    <TestPanelTab
                        balance={balance}
                        balanceLoading={balanceLoading}
                        testPhone={testPhone}
                        setTestPhone={setTestPhone}
                        testMessageType={testMessageType}
                        setTestMessageType={setTestMessageType}
                        testTemplate={testTemplate}
                        setTestTemplate={setTestTemplate}
                        testParameters={testParameters}
                        setTestParameters={setTestParameters}
                        testResult={testResult}
                        testing={testing}
                        templates={templates}
                        handleRefreshBalance={handleRefreshBalance}
                        handleTestSend={handleTestSend}
                    />
                )}
            </div>
        </div>
    );
};

export default KudiSmsSettingsComponent;
