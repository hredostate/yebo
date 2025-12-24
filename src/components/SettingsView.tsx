import React, { useState } from 'react';
import type { SchoolSettings, SchoolConfig } from '../types';
import SchoolBranding from './SchoolBranding';
import BrandingSettings from './BrandingSettings';
import PaymentGatewaySettings from './PaymentGatewaySettings';
import KudiSmsSettings from './KudiSmsSettings';
import GroqSettings from './GroqSettings';
import StudentProfileFieldsSettings from './StudentProfileFieldsSettings';
import Spinner from './common/Spinner';
import DATABASE_SCHEMA, { DICTIONARY_FIX_SQL, RESEED_DATA_SQL, ATTENDANCE_FIX_SQL } from '../databaseSchema';

interface SettingsViewProps {
    settings: SchoolSettings | null;
    schoolConfig: SchoolConfig | null; // Added prop
    onSaveSettings: (data: Partial<SchoolSettings>) => Promise<boolean>;
    onSaveSchoolConfig?: (config: Partial<SchoolConfig>) => Promise<boolean>; // Added prop
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type SettingsTab = 'School Identity' | 'System Appearance' | 'Payment Gateway' | 'Messaging Gateway' | 'AI Configuration' | 'Student Profile' | 'Data' | 'Maintenance';

const TabButton: React.FC<{ label: string; tabId: SettingsTab; isActive: boolean; onClick: (tab: SettingsTab) => void; }> = ({ label, tabId, isActive, onClick }) => {
    const tabKey = tabId.toLowerCase().replace(/\s+/g, '-');

    return (
        <button
            role="tab"
            aria-selected={isActive}
            aria-controls={`settings-panel-${tabKey}`}
            id={`settings-tab-${tabKey}`}
            onClick={() => onClick(tabId)}
            className={`inline-flex items-center gap-2 rounded-t-xl px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                ? 'bg-white/80 text-indigo-700 shadow-sm ring-1 ring-indigo-100 dark:bg-slate-900/60 dark:text-indigo-200 dark:ring-slate-700'
                : 'text-slate-600 hover:text-indigo-700 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800/60'
            }`}
        >
            {label}
            {isActive && <span className="h-1 w-6 rounded-full bg-indigo-500" aria-hidden="true" />}
        </button>
    );
};


const SettingsView: React.FC<SettingsViewProps> = ({ settings, schoolConfig, onSaveSettings, onSaveSchoolConfig, addToast }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('School Identity');
    const [copyStatuses, setCopyStatuses] = useState<Record<string, 'idle' | 'copied' | 'error'>>({});

    if (!settings && !schoolConfig) {
        return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;
    }

    const handleSaveBrandingColor = async (branding: { primary_color: string }) => {
        await onSaveSettings({ branding });
    };
    
    const handleSaveSchoolConfig = async (config: Partial<SchoolConfig>): Promise<boolean> => {
        if (onSaveSchoolConfig) {
            return await onSaveSchoolConfig(config);
        }
        return false;
    };

    const handleCopy = async (key: string, text?: string) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopyStatuses(prev => ({ ...prev, [key]: 'copied' }));
            setTimeout(() => setCopyStatuses(prev => ({ ...prev, [key]: 'idle' })), 2500);
        } catch (err) {
            console.error("Failed to copy", err);
            setCopyStatuses(prev => ({ ...prev, [key]: 'error' }));
            setTimeout(() => setCopyStatuses(prev => ({ ...prev, [key]: 'idle' })), 3000);
        }
    };

    const getCopyLabel = (key: string, fallback: string) => {
        if (copyStatuses[key] === 'copied') return 'Copied!';
        if (copyStatuses[key] === 'error') return 'Copy failed';
        return fallback;
    };

    const renderCopyStatus = (key: string, successMessage: string) => {
        const status = copyStatuses[key];
        if (!status || status === 'idle') return null;

        const isError = status === 'error';
        return (
            <p
                className={`mt-2 text-xs ${isError ? 'text-red-500 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}`}
                aria-live="polite"
            >
                {isError ? 'Copy failed. Please try again.' : successMessage}
            </p>
        );
    };

    const activeTabKey = activeTab.toLowerCase().replace(/\s+/g, '-');

    const renderTabContent = () => {
        switch (activeTab) {
            case 'School Identity':
                // Reusing the component from Super Admin for consistency
                return <BrandingSettings schoolConfig={schoolConfig} onSave={handleSaveSchoolConfig} />;
            case 'System Appearance':
                return <SchoolBranding settings={settings} onSave={handleSaveBrandingColor} />;
            case 'Payment Gateway':
                return settings ? <PaymentGatewaySettings schoolId={settings.id} /> : null;
            case 'Messaging Gateway':
                return settings ? <KudiSmsSettings schoolId={settings.id} /> : null;
            case 'AI Configuration':
                return settings ? <GroqSettings schoolId={settings.id} /> : null;
            case 'Student Profile':
                return settings ? (
                    <StudentProfileFieldsSettings 
                        schoolId={settings.id} 
                        addToast={addToast}
                    />
                ) : null;
            case 'Data':
                return (
                    <div className="space-y-6">
                         <h3 className="font-semibold text-lg text-slate-800 dark:text-white">Data Management</h3>
                         <div className="p-4 border border-slate-200/60 dark:border-slate-700/60 rounded-lg">
                            <h4 className="font-semibold">Export Data</h4>
                            <p className="text-sm text-slate-500 mt-1 mb-2">Download a CSV of key school data.</p>
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                                <button
                                    type="button"
                                    disabled
                                    aria-disabled
                                    className="px-3 py-2 bg-slate-500/20 text-slate-700 dark:text-slate-200 rounded-md text-sm font-semibold opacity-60 cursor-not-allowed"
                                >
                                    Export Student Data
                                </button>
                                <span className="text-xs text-slate-500 dark:text-slate-400">Coming soon — exports will follow the unified CSV format used across dashboards.</span>
                            </div>
                         </div>
                         
                         {settings?.secret_code && (
                            <div className="p-4 border border-slate-200/60 dark:border-slate-700/60 rounded-lg">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Secret Sign-up Code</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <input
                                        type="text"
                                        readOnly
                                        value={settings.secret_code}
                                        className="w-full p-2 border rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCopy('secret-code', settings.secret_code)}
                                        className={`px-3 py-2 rounded-md font-semibold text-sm transition-colors ${copyStatuses['secret-code'] === 'copied'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                                    >
                                        {getCopyLabel('secret-code', 'Copy')}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-1" aria-live="polite">
                                    {copyStatuses['secret-code'] === 'copied' ? 'Secret code copied to clipboard.' : 'Use this code to register new staff accounts.'}
                                </p>
                            </div>
                         )}

                         <div className="p-4 border border-red-500/50 rounded-lg bg-red-500/5">
                            <h4 className="font-bold text-red-700 dark:text-red-300">Danger Zone</h4>
                             <p className="text-sm text-red-600 dark:text-red-400 mt-1 mb-2">These actions are permanent and cannot be undone.</p>
                            <button
                                type="button"
                                disabled
                                aria-disabled
                                className="px-3 py-2 bg-red-600 text-white rounded-md text-sm font-semibold opacity-60 cursor-not-allowed"
                            >
                                Archive Reports Older Than 1 Year
                            </button>
                            <p className="mt-2 text-xs text-red-500 dark:text-red-300">Restricted until retention approvals are finalized to keep destructive actions consistent with compliance standards.</p>
                         </div>
                    </div>
                );
             case 'Maintenance':
                return (
                    <div className="space-y-6">
                         <h3 className="font-semibold text-lg text-slate-800 dark:text-white">System Maintenance & Repair</h3>
                         
                         <div className="p-4 border border-purple-300/60 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg">
                            <h4 className="font-bold text-purple-800 dark:text-purple-200 flex items-center gap-2">
                                🔧 Fix Attendance Dashboard
                            </h4>
                            <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                                If the <strong>Teacher Attendance</strong> page is not loading or shows blank data, use this script to restore the necessary database functions.
                            </p>
                                <div className="mt-3 relative">
                                    <pre className="bg-slate-900 text-slate-200 p-3 rounded-md text-xs overflow-auto max-h-40">
                                        {ATTENDANCE_FIX_SQL}
                                    </pre>
                                <button
                                    type="button"
                                    onClick={() => handleCopy('attendance-fix', ATTENDANCE_FIX_SQL)}
                                    className={`absolute top-2 right-2 px-2 py-1 text-xs rounded transition-colors ${copyStatuses['attendance-fix'] === 'copied'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                >
                                    {getCopyLabel('attendance-fix', 'Copy SQL')}
                                </button>
                                </div>
                            {renderCopyStatus('attendance-fix', 'Attendance fix SQL copied to clipboard.')}
                         </div>

                         <div className="p-4 border border-amber-300/60 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg">
                            <h4 className="font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                ⚠️ Fix Missing Data Visibility
                            </h4>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                If dropdowns for <strong>Classes, Subjects, or Arms</strong> are empty, it likely means the database permissions (RLS) for these shared tables are missing or the API cache is stale.
                            </p>
                            <div className="mt-3 relative">
                                <pre className="bg-slate-900 text-slate-200 p-3 rounded-md text-xs overflow-auto max-h-40">
                                    {DICTIONARY_FIX_SQL}
                                </pre>
                                <button
                                    type="button"
                                    onClick={() => handleCopy('dictionary-fix', DICTIONARY_FIX_SQL)}
                                    className={`absolute top-2 right-2 px-2 py-1 text-xs rounded transition-colors ${copyStatuses['dictionary-fix'] === 'copied'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                >
                                    {getCopyLabel('dictionary-fix', 'Copy SQL')}
                                </button>
                            </div>
                            {renderCopyStatus('dictionary-fix', 'Dictionary repair SQL copied to clipboard.')}
                         </div>

                        <div className="p-4 border border-blue-300/60 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg">
                            <h4 className="font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                                🔄 Restore Default Data (Seed)
                            </h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                Use this if the Classes, Arms, or Subjects lists are completely empty. This script re-inserts the default values without deleting existing data.
                            </p>
                            <div className="mt-3 relative">
                                <pre className="bg-slate-900 text-slate-200 p-3 rounded-md text-xs overflow-auto max-h-40">
                                    {RESEED_DATA_SQL}
                                </pre>
                                <button
                                    type="button"
                                    onClick={() => handleCopy('reseed-data', RESEED_DATA_SQL)}
                                    className={`absolute top-2 right-2 px-2 py-1 text-xs rounded transition-colors ${copyStatuses['reseed-data'] === 'copied'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                >
                                    {getCopyLabel('reseed-data', 'Copy SQL')}
                                </button>
                            </div>
                            {renderCopyStatus('reseed-data', 'Data reseed SQL copied to clipboard.')}
                         </div>

                         <div className="p-4 border border-slate-200/60 dark:border-slate-700/60 rounded-lg">
                            <h4 className="font-semibold text-slate-800 dark:text-white">Full Schema Reset Script</h4>
                            <p className="text-sm text-slate-500 mt-1">
                                This is the complete setup script. It is safe to run again to apply any missing updates or tables.
                            </p>
                            <div className="mt-3 relative">
                                <pre className="bg-slate-900 text-slate-200 p-3 rounded-md text-xs overflow-auto max-h-40">
                                    {DATABASE_SCHEMA}
                                </pre>
                                <button
                                    type="button"
                                    onClick={() => handleCopy('full-schema', DATABASE_SCHEMA)}
                                    className={`absolute top-2 right-2 px-2 py-1 text-xs rounded transition-colors ${copyStatuses['full-schema'] === 'copied'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                >
                                    {getCopyLabel('full-schema', 'Copy SQL')}
                                </button>
                            </div>
                            {renderCopyStatus('full-schema', 'Full schema SQL copied to clipboard.')}
                         </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">Manage school-wide settings and appearance.</p>
            </div>
            
            <div>
                 <div className="border-b border-slate-200/60 dark:border-slate-800/60">
                    <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Settings tabs" role="tablist">
                        <TabButton label="School Identity" tabId="School Identity" isActive={activeTab === 'School Identity'} onClick={setActiveTab} />
                        <TabButton label="System Appearance" tabId="System Appearance" isActive={activeTab === 'System Appearance'} onClick={setActiveTab} />
                        <TabButton label="Payment Gateway" tabId="Payment Gateway" isActive={activeTab === 'Payment Gateway'} onClick={setActiveTab} />
                        <TabButton label="Messaging Gateway" tabId="Messaging Gateway" isActive={activeTab === 'Messaging Gateway'} onClick={setActiveTab} />
                        <TabButton label="AI Configuration" tabId="AI Configuration" isActive={activeTab === 'AI Configuration'} onClick={setActiveTab} />
                        <TabButton label="Student Profile" tabId="Student Profile" isActive={activeTab === 'Student Profile'} onClick={setActiveTab} />
                        <TabButton label="Data" tabId="Data" isActive={activeTab === 'Data'} onClick={setActiveTab} />
                        <TabButton label="Maintenance" tabId="Maintenance" isActive={activeTab === 'Maintenance'} onClick={setActiveTab} />
                    </nav>
                </div>

                <div
                    className="rounded-b-2xl rounded-tr-2xl border-x border-b border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40"
                    id={`settings-panel-${activeTabKey}`}
                    role="tabpanel"
                    aria-labelledby={`settings-tab-${activeTabKey}`}
                >
                    {renderTabContent()}
                </div>
            </div>

        </div>
    );
};

export default SettingsView;
