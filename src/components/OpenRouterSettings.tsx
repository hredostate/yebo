import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { AISettings } from '../types';
import Spinner from './common/Spinner';
import { initializeAIClient, getAIClient } from '../services/aiClient';

interface OpenRouterSettingsProps {
    schoolId: number;
}

// Available AI models
const AVAILABLE_MODELS = [
    { value: 'openai/gpt-4o', label: 'OpenAI GPT-4o (Recommended)', description: 'Latest GPT-4 model, best for complex tasks' },
    { value: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o Mini', description: 'Faster and cheaper alternative' },
    { value: 'anthropic/claude-3.5-sonnet', label: 'Anthropic Claude 3.5 Sonnet', description: 'Advanced reasoning and analysis' },
    { value: 'google/gemini-2.0-flash-exp', label: 'Google Gemini 2.0 Flash', description: 'Fast and efficient' },
    { value: 'meta-llama/llama-3.1-70b-instruct', label: 'Meta Llama 3.1 70B', description: 'Open source model' },
];

const OpenRouterSettings: React.FC<OpenRouterSettingsProps> = ({ schoolId }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    
    const [formData, setFormData] = useState<AISettings>({
        openrouter_api_key: '',
        default_model: 'openai/gpt-4o',
        is_configured: false
    });

    useEffect(() => {
        fetchSettings();
    }, [schoolId]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('schools')
                .select('ai_settings')
                .eq('id', schoolId)
                .single();

            // Handle case where table doesn't exist or row not found
            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching AI settings:', error);
                // Continue with default settings instead of throwing
            }
            
            if (data?.ai_settings) {
                setFormData({
                    openrouter_api_key: '', // Don't show the actual key for security
                    default_model: data.ai_settings.default_model || 'openai/gpt-4o',
                    is_configured: data.ai_settings.is_configured || false
                });
            } else {
                // No AI settings found, use defaults
                setFormData({
                    openrouter_api_key: '',
                    default_model: 'openai/gpt-4o',
                    is_configured: false
                });
            }
        } catch (error) {
            console.error('Error fetching AI settings:', error);
            // Set defaults even on error
            setFormData({
                openrouter_api_key: '',
                default_model: 'openai/gpt-4o',
                is_configured: false
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.openrouter_api_key && !formData.is_configured) {
            alert('Please enter your OpenRouter API key');
            return;
        }

        setSaving(true);
        setTestResult(null);
        
        try {
            // Prepare the AI settings object
            const aiSettings: AISettings = {
                default_model: formData.default_model,
                is_configured: true
            };

            // Only include the API key if it's provided (for new entries or updates)
            if (formData.openrouter_api_key) {
                aiSettings.openrouter_api_key = formData.openrouter_api_key;
            }

            const { error } = await supabase
                .from('schools')
                .update({ ai_settings: aiSettings })
                .eq('id', schoolId);

            if (error) throw error;

            // Initialize the AI client with the new settings
            if (formData.openrouter_api_key) {
                initializeAIClient(formData.openrouter_api_key, formData.default_model);
            }

            alert('AI Configuration saved successfully!');
            setFormData(prev => ({ ...prev, is_configured: true, openrouter_api_key: '' }));
            await fetchSettings();
        } catch (error: any) {
            console.error('Error saving AI settings:', error);
            alert(`Failed to save settings: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        if (!formData.openrouter_api_key && !formData.is_configured) {
            setTestResult({ success: false, message: 'Please enter an API key first' });
            return;
        }

        setTesting(true);
        setTestResult(null);

        try {
            // Initialize client with the current API key
            let apiKey = formData.openrouter_api_key;
            
            // If no API key in form but is_configured, fetch from database
            if (!apiKey && formData.is_configured) {
                const { data, error } = await supabase
                    .from('schools')
                    .select('ai_settings')
                    .eq('id', schoolId)
                    .single();
                
                if (error) throw error;
                apiKey = data?.ai_settings?.openrouter_api_key || '';
            }

            if (!apiKey) {
                setTestResult({ success: false, message: 'No API key available' });
                return;
            }

            initializeAIClient(apiKey, formData.default_model);
            const client = getAIClient();

            if (!client) {
                setTestResult({ success: false, message: 'Failed to initialize AI client' });
                return;
            }

            // Test the connection with a simple request
            const response = await client.chat.completions.create({
                model: formData.default_model || 'openai/gpt-4o',
                messages: [{ role: 'user', content: 'Say "Hello" if you can read this.' }],
                max_tokens: 10
            });

            if (response.choices?.[0]?.message?.content) {
                setTestResult({ 
                    success: true, 
                    message: `✓ Connection successful! Model: ${formData.default_model}` 
                });
            } else {
                setTestResult({ success: false, message: 'Unexpected response format' });
            }
        } catch (error: any) {
            console.error('Test connection error:', error);
            setTestResult({ 
                success: false, 
                message: `Connection failed: ${error.message || 'Unknown error'}` 
            });
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
                    AI Configuration
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Configure OpenRouter API for AI-powered features throughout the application.
                </p>
            </div>

            {/* Configuration Status */}
            <div className={`p-4 rounded-lg border ${
                formData.is_configured 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{formData.is_configured ? '✓' : '⚠️'}</span>
                    <div>
                        <p className={`font-semibold ${
                            formData.is_configured 
                                ? 'text-green-800 dark:text-green-200' 
                                : 'text-amber-800 dark:text-amber-200'
                        }`}>
                            {formData.is_configured ? 'AI is Configured' : 'AI Not Configured'}
                        </p>
                        <p className={`text-sm ${
                            formData.is_configured 
                                ? 'text-green-600 dark:text-green-300' 
                                : 'text-amber-600 dark:text-amber-300'
                        }`}>
                            {formData.is_configured 
                                ? 'AI features are active and ready to use' 
                                : 'Please configure your OpenRouter API key to enable AI features'}
                        </p>
                    </div>
                </div>
            </div>

            {/* API Key Input */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    OpenRouter API Key
                </label>
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <input
                            type={showApiKey ? 'text' : 'password'}
                            value={formData.openrouter_api_key}
                            onChange={(e) => setFormData({ ...formData, openrouter_api_key: e.target.value })}
                            placeholder={formData.is_configured ? '••••••••••••••••' : 'Enter your OpenRouter API key'}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                        {showApiKey ? '🙈 Hide' : '👁️ Show'}
                    </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formData.is_configured 
                        ? 'Leave blank to keep the existing API key' 
                        : 'Your API key will be stored securely'}
                </p>
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Default AI Model
                </label>
                <select
                    value={formData.default_model}
                    onChange={(e) => setFormData({ ...formData, default_model: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                    {AVAILABLE_MODELS.map((model) => (
                        <option key={model.value} value={model.value}>
                            {model.label}
                        </option>
                    ))}
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {AVAILABLE_MODELS.find(m => m.value === formData.default_model)?.description}
                </p>
            </div>

            {/* Test Result */}
            {testResult && (
                <div className={`p-4 rounded-lg border ${
                    testResult.success 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200' 
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                }`}>
                    {testResult.message}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {testing ? 'Testing...' : '🔌 Test Connection'}
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? 'Saving...' : '💾 Save Configuration'}
                </button>
            </div>

            {/* Help Section */}
            <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                    📚 How to Get Your OpenRouter API Key
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
                    <li>Visit <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">OpenRouter.ai</a></li>
                    <li>Sign up or log in to your account</li>
                    <li>Navigate to the API Keys section in your dashboard</li>
                    <li>Create a new API key</li>
                    <li>Copy the key and paste it above</li>
                    <li>Add credits to your OpenRouter account to use the models</li>
                </ol>
                <p className="mt-4 text-xs text-blue-700 dark:text-blue-300">
                    💡 <strong>Tip:</strong> OpenRouter provides access to multiple AI models from different providers with a single API key. 
                    You only pay for what you use, with transparent pricing.
                </p>
            </div>

            {/* Features Using AI */}
            <div className="mt-6 p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-3">
                    ✨ AI-Powered Features
                </h4>
                <ul className="grid grid-cols-2 gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <li>• Report Analysis</li>
                    <li>• Content Generation</li>
                    <li>• Predictive Analytics</li>
                    <li>• Risk Assessment</li>
                    <li>• Task Suggestions</li>
                    <li>• Smart Communication</li>
                    <li>• Lesson Planning</li>
                    <li>• Social Media Content</li>
                </ul>
            </div>
        </div>
    );
};

export default OpenRouterSettings;
