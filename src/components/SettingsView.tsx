
import React, { useState, useEffect } from 'react';
import type { SchoolSettings, SchoolConfig } from '../types';
import SchoolBranding from './SchoolBranding';
import BrandingSettings from './BrandingSettings';
import PaymentGatewaySettings from './PaymentGatewaySettings';
import TermiiSettings from './TermiiSettings';
import OpenRouterSettings from './OpenRouterSettings';
import Spinner from './common/Spinner';
import DATABASE_SCHEMA, { DICTIONARY_FIX_SQL, RESEED_DATA_SQL, ATTENDANCE_FIX_SQL } from '../databaseSchema';

interface SettingsViewProps {
    settings: SchoolSettings | null;
    schoolConfig: SchoolConfig | null; // Added prop
    onSaveSettings: (data: Partial<SchoolSettings>) => Promise<boolean>;
    onSaveSchoolConfig?: (config: Partial<SchoolConfig>) => Promise<boolean>; // Added prop
}

type SettingsTab = 'School Identity' | 'System Appearance' | 'Payment Gateway' | 'Messaging Gateway' | 'AI Configuration' | 'Data' | 'Maintenance';

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; }> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            isActive 
            ? 'bg-white/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 border-t border-x relative -bottom-px' 
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-500/10'
        }`}
    >
        {label}
    </button>
);


const SettingsView: React.FC<SettingsViewProps> = ({ settings, schoolConfig, onSaveSettings, onSaveSchoolConfig }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('School Identity');
    const [isSaving, setIsSaving] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    if (!settings && !schoolConfig) {
        return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;
    }
    
    const handleSaveBrandingColor = async (branding: { primary_color: string }) => {
        setIsSaving(true);
        await onSaveSettings({ branding });
        setIsSaving(false);
    };
    
    const handleSaveSchoolConfig = async (config: Partial<SchoolConfig>): Promise<boolean> => {
        if (onSaveSchoolConfig) {
            return await onSaveSchoolConfig(config);
        }
        return false;
    };

    const copySecretCode = () => {
        if (settings?.secret_code) {
            navigator.clipboard.writeText(settings.secret_code);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            alert("SQL Script copied to clipboard!");
        } catch (err) {
            console.error("Failed to copy", err);
        }
    }

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
                return settings ? <TermiiSettings schoolId={settings.id} /> : null;
            case 'AI Configuration':
                return settings ? <OpenRouterSettings schoolId={settings.id} /> : null;
            case 'Data':
                return (
                    <div className="space-y-6">
                         <h3 className="font-semibold text-lg text-slate-800 dark:text-white">Data Management</h3>
                         <div className="p-4 border border-slate-200/60 dark:border-slate-700/60 rounded-lg">
                            <h4 className="font-semibold">Export Data</h4>
                            <p className="text-sm text-slate-500 mt-1 mb-2">Download a CSV of key school data.</p>
                            <button className="px-3 py-2 bg-slate-500/20 text-slate-700 dark:text-slate-200 rounded-md text-sm font-semibold opacity-50 cursor-not-allowed">Export Student Data</button>
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
                                    <button onClick={copySecretCode} className={`px-3 py-2 rounded-md font-semibold text-sm transition-colors ${copySuccess ? 'bg-green-600 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>
                                        {copySuccess ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Use this code to register new staff accounts.</p>
                            </div>
                         )}

                         <div className="p-4 border border-red-500/50 rounded-lg bg-red-500/5">
                            <h4 className="font-bold text-red-700 dark:text-red-300">Danger Zone</h4>
                             <p className="text-sm text-red-600 dark:text-red-400 mt-1 mb-2">These actions are permanent and cannot be undone.</p>
                            <button className="px-3 py-2 bg-red-600 text-white rounded-md text-sm font-semibold opacity-50 cursor-not-allowed">Archive Reports Older Than 1 Year</button>
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
                                <button onClick={() => copyToClipboard(ATTENDANCE_FIX_SQL)} className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">Copy SQL</button>
                            </div>
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
                                <button onClick={() => copyToClipboard(DICTIONARY_FIX_SQL)} className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">Copy SQL</button>
                            </div>
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
                                <button onClick={() => copyToClipboard(RESEED_DATA_SQL)} className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">Copy SQL</button>
                            </div>
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
                                <button onClick={() => copyToClipboard(DATABASE_SCHEMA)} className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">Copy SQL</button>
                            </div>
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
                    <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                        <TabButton label="School Identity" isActive={activeTab === 'School Identity'} onClick={() => setActiveTab('School Identity')} />
                        <TabButton label="System Appearance" isActive={activeTab === 'System Appearance'} onClick={() => setActiveTab('System Appearance')} />
                        <TabButton label="Payment Gateway" isActive={activeTab === 'Payment Gateway'} onClick={() => setActiveTab('Payment Gateway')} />
                        <TabButton label="Messaging Gateway" isActive={activeTab === 'Messaging Gateway'} onClick={() => setActiveTab('Messaging Gateway')} />
                        <TabButton label="AI Configuration" isActive={activeTab === 'AI Configuration'} onClick={() => setActiveTab('AI Configuration')} />
                        <TabButton label="Data" isActive={activeTab === 'Data'} onClick={() => setActiveTab('Data')} />
                        <TabButton label="Maintenance" isActive={activeTab === 'Maintenance'} onClick={() => setActiveTab('Maintenance')} />
                    </nav>
                </div>

                <div className="rounded-b-2xl rounded-tr-2xl border-x border-b border-slate-200/60 bg-white/60 p-6 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
                    {renderTabContent()}
                </div>
            </div>

        </div>
    );
};

export default SettingsView;
