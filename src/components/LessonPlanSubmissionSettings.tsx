import React, { useState, useEffect } from 'react';
import { 
    SettingsIcon, 
    ClockIcon, 
    CalendarIcon, 
    BellIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon
} from './common/icons';
import type { LessonPlanSubmissionConfig } from '../types';
import { requireSupabaseClient } from '../services/supabaseClient';

interface LessonPlanSubmissionSettingsProps {
    schoolId: number;
    addToast: (message: { type: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

const DAYS_OF_WEEK = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' },
];

const DEFAULT_DEADLINE_TIME = '17:00';

const LessonPlanSubmissionSettings: React.FC<LessonPlanSubmissionSettingsProps> = ({
    schoolId,
    addToast
}) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<Partial<LessonPlanSubmissionConfig>>({
        submission_deadline_day: 'friday',
        submission_deadline_time: '17:00:00',
        grace_period_hours: 24,
        auto_mark_late_after_grace: true,
        require_coverage_before_new_plan: false,
        min_coverage_percentage_required: 80,
        enable_auto_reminders: true,
        reminder_days_before: [3, 1, 0],
    });

    useEffect(() => {
        loadSettings();
    }, [schoolId]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const supabase = requireSupabaseClient();
            
            const { data, error } = await supabase
                .from('lesson_plan_submission_config')
                .select('*')
                .eq('school_id', schoolId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                throw error;
            }

            if (data) {
                setConfig(data);
            }
        } catch (error) {
            console.error('Error loading submission settings:', error);
            addToast({
                type: 'error',
                message: 'Failed to load submission settings'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const supabase = requireSupabaseClient();

            const payload = {
                school_id: schoolId,
                submission_deadline_day: config.submission_deadline_day,
                submission_deadline_time: config.submission_deadline_time,
                grace_period_hours: config.grace_period_hours,
                auto_mark_late_after_grace: config.auto_mark_late_after_grace,
                require_coverage_before_new_plan: config.require_coverage_before_new_plan,
                min_coverage_percentage_required: config.min_coverage_percentage_required,
                enable_auto_reminders: config.enable_auto_reminders,
                reminder_days_before: config.reminder_days_before,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('lesson_plan_submission_config')
                .upsert(payload, { onConflict: 'school_id' });

            if (error) throw error;

            addToast({
                type: 'success',
                message: 'Submission settings saved successfully'
            });
            
            await loadSettings(); // Reload to get the updated data
        } catch (error) {
            console.error('Error saving submission settings:', error);
            addToast({
                type: 'error',
                message: 'Failed to save submission settings'
            });
        } finally {
            setSaving(false);
        }
    };

    const updateReminderDay = (index: number, value: number) => {
        const newReminders = [...(config.reminder_days_before || [])];
        newReminders[index] = value;
        setConfig({ ...config, reminder_days_before: newReminders });
    };

    const addReminderDay = () => {
        const newReminders = [...(config.reminder_days_before || []), 1];
        setConfig({ ...config, reminder_days_before: newReminders });
    };

    const removeReminderDay = (index: number) => {
        const newReminders = [...(config.reminder_days_before || [])];
        newReminders.splice(index, 1);
        setConfig({ ...config, reminder_days_before: newReminders });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <SettingsIcon className="w-6 h-6" />
                    Lesson Plan Submission Settings
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Configure submission deadlines, grace periods, and automated reminders for lesson plans
                </p>
            </div>

            <div className="space-y-6">
                {/* Submission Deadline */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5" />
                        Submission Deadline
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Day of Week
                            </label>
                            <select
                                value={config.submission_deadline_day}
                                onChange={(e) => setConfig({ ...config, submission_deadline_day: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {DAYS_OF_WEEK.map(day => (
                                    <option key={day.value} value={day.value}>
                                        {day.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Deadline Time
                            </label>
                            <input
                                type="time"
                                value={config.submission_deadline_time?.substring(0, 5) || DEFAULT_DEADLINE_TIME}
                                onChange={(e) => setConfig({ ...config, submission_deadline_time: e.target.value + ':00' })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Grace Period */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <ClockIcon className="w-5 h-5" />
                        Grace Period
                    </h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Grace Period (Hours)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="168"
                                value={config.grace_period_hours}
                                onChange={(e) => setConfig({ ...config, grace_period_hours: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Number of hours after the deadline before marking submissions as late
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="auto_mark_late"
                                checked={config.auto_mark_late_after_grace}
                                onChange={(e) => setConfig({ ...config, auto_mark_late_after_grace: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="auto_mark_late" className="text-sm text-gray-700 dark:text-gray-300">
                                Automatically mark as late after grace period expires
                            </label>
                        </div>
                    </div>
                </div>

                {/* Coverage Requirements */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <CheckCircleIcon className="w-5 h-5" />
                        Coverage Requirements
                    </h2>
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="require_coverage"
                                checked={config.require_coverage_before_new_plan}
                                onChange={(e) => setConfig({ ...config, require_coverage_before_new_plan: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="require_coverage" className="text-sm text-gray-700 dark:text-gray-300">
                                Require coverage reporting before submitting new lesson plan
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Minimum Coverage Percentage Required
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={config.min_coverage_percentage_required}
                                    onChange={(e) => setConfig({ ...config, min_coverage_percentage_required: parseInt(e.target.value) || 0 })}
                                    disabled={!config.require_coverage_before_new_plan}
                                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                                />
                                <span className="text-gray-700 dark:text-gray-300">%</span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Teachers must achieve this coverage percentage before submitting new plans
                            </p>
                        </div>
                    </div>
                </div>

                {/* Automated Reminders */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <BellIcon className="w-5 h-5" />
                        Automated Reminders
                    </h2>
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="enable_reminders"
                                checked={config.enable_auto_reminders}
                                onChange={(e) => setConfig({ ...config, enable_auto_reminders: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="enable_reminders" className="text-sm text-gray-700 dark:text-gray-300">
                                Enable automated reminder notifications
                            </label>
                        </div>

                        {config.enable_auto_reminders && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Send Reminders (Days Before Deadline)
                                </label>
                                <div className="space-y-2">
                                    {(config.reminder_days_before || []).map((days, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max="30"
                                                value={days}
                                                onChange={(e) => updateReminderDay(index, parseInt(e.target.value) || 0)}
                                                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                            <span className="text-gray-700 dark:text-gray-300">
                                                {days === 0 ? 'day(s) - on deadline day' : days === 1 ? 'day before' : `days before`}
                                            </span>
                                            <button
                                                onClick={() => removeReminderDay(index)}
                                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={addReminderDay}
                                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                                    >
                                        + Add Reminder
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Warning Box */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex gap-2">
                        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                        <div>
                            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                Important Note
                            </h3>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                These settings affect all teachers in your school. Changes will apply to all future lesson plan submissions.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LessonPlanSubmissionSettings;
