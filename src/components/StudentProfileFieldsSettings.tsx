import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { ProfileFieldConfig, ProfileFieldType } from '../types';
import Spinner from './common/Spinner';
import { PlusIcon, TrashIcon, SaveIcon, PencilIcon } from './common/icons';

interface StudentProfileFieldsSettingsProps {
    schoolId: number;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const FIELD_TYPE_OPTIONS: { value: ProfileFieldType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'date', label: 'Date' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'select', label: 'Dropdown Select' },
    { value: 'photo', label: 'Photo' }
];

const StudentProfileFieldsSettings: React.FC<StudentProfileFieldsSettingsProps> = ({
    schoolId,
    addToast
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [fields, setFields] = useState<ProfileFieldConfig[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingField, setEditingField] = useState<ProfileFieldConfig | null>(null);
    
    // New field form state
    const [newField, setNewField] = useState({
        field_label: '',
        field_type: 'text' as ProfileFieldType,
        is_editable_by_student: true,
        is_required: false,
        placeholder_text: '',
        field_options: [] as string[]
    });

    useEffect(() => {
        fetchFields();
    }, [schoolId]);

    const fetchFields = async () => {
        try {
            setIsLoading(true);
            const supabase = requireSupabaseClient();
            
            // First, ensure defaults are seeded
            await supabase.rpc('seed_default_profile_field_configs', {
                p_school_id: schoolId
            });

            // Fetch all field configurations
            const { data, error } = await supabase
                .from('student_profile_field_configs')
                .select('*')
                .eq('school_id', schoolId)
                .order('display_order', { ascending: true });

            if (error) throw error;
            setFields(data || []);
        } catch (error: any) {
            console.error('Error fetching profile field configs:', error);
            addToast(`Error loading field configurations: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleEditable = async (fieldId: number, currentValue: boolean) => {
        try {
            const supabase = requireSupabaseClient();
            const { error } = await supabase
                .from('student_profile_field_configs')
                .update({ is_editable_by_student: !currentValue })
                .eq('id', fieldId);

            if (error) throw error;

            setFields(prev => prev.map(f => 
                f.id === fieldId ? { ...f, is_editable_by_student: !currentValue } : f
            ));
            
            addToast('Field editability updated', 'success');
        } catch (error: any) {
            console.error('Error updating field:', error);
            addToast(`Error updating field: ${error.message}`, 'error');
        }
    };

    const handleAddCustomField = async () => {
        if (!newField.field_label.trim()) {
            addToast('Please enter a field label', 'error');
            return;
        }

        try {
            setIsSaving(true);
            const supabase = requireSupabaseClient();
            
            // Generate field_name from label (lowercase, underscores)
            const fieldName = `custom_${newField.field_label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
            
            // Get the highest display order
            const maxOrder = Math.max(...fields.map(f => f.display_order), 0);
            
            const fieldData: any = {
                school_id: schoolId,
                field_name: fieldName,
                field_label: newField.field_label,
                field_type: newField.field_type,
                is_custom: true,
                is_editable_by_student: newField.is_editable_by_student,
                is_required: newField.is_required,
                display_order: maxOrder + 10,
                placeholder_text: newField.placeholder_text || null
            };

            // Add options for select type
            if (newField.field_type === 'select' && newField.field_options.length > 0) {
                // Filter out empty options
                const validOptions = newField.field_options.filter(opt => opt.trim() !== '');
                if (validOptions.length > 0) {
                    fieldData.field_options = { options: validOptions };
                } else {
                    addToast('Please provide at least one valid option for the dropdown', 'error');
                    setIsSaving(false);
                    return;
                }
            }

            const { data, error } = await supabase
                .from('student_profile_field_configs')
                .insert([fieldData])
                .select()
                .single();

            if (error) throw error;

            setFields(prev => [...prev, data]);
            addToast('Custom field added successfully', 'success');
            
            // Reset form
            setNewField({
                field_label: '',
                field_type: 'text',
                is_editable_by_student: true,
                is_required: false,
                placeholder_text: '',
                field_options: []
            });
            setShowAddModal(false);
        } catch (error: any) {
            console.error('Error adding custom field:', error);
            addToast(`Error adding field: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCustomField = async (fieldId: number, fieldLabel: string) => {
        if (!window.confirm(`Are you sure you want to delete the custom field "${fieldLabel}"? This will also delete all student data for this field.`)) {
            return;
        }

        try {
            const supabase = requireSupabaseClient();
            const { error } = await supabase
                .from('student_profile_field_configs')
                .delete()
                .eq('id', fieldId);

            if (error) throw error;

            setFields(prev => prev.filter(f => f.id !== fieldId));
            addToast('Custom field deleted', 'success');
        } catch (error: any) {
            console.error('Error deleting field:', error);
            addToast(`Error deleting field: ${error.message}`, 'error');
        }
    };

    const handleAddOption = () => {
        setNewField(prev => ({
            ...prev,
            field_options: [...prev.field_options, '']
        }));
    };

    const handleUpdateOption = (index: number, value: string) => {
        setNewField(prev => ({
            ...prev,
            field_options: prev.field_options.map((opt, i) => i === index ? value : opt)
        }));
    };

    const handleRemoveOption = (index: number) => {
        setNewField(prev => ({
            ...prev,
            field_options: prev.field_options.filter((_, i) => i !== index)
        }));
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center p-8">
                <Spinner size="lg" />
            </div>
        );
    }

    const builtInFields = fields.filter(f => !f.is_custom);
    const customFields = fields.filter(f => f.is_custom);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Student Profile Fields</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Control which profile fields students can edit and add custom fields
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <PlusIcon className="h-5 w-5" />
                    Add Custom Field
                </button>
            </div>

            {/* Built-in Fields */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Built-in Fields</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Standard student profile fields. Toggle to allow or prevent student editing.
                    </p>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {builtInFields.map(field => (
                        <div key={field.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <div className="flex-1">
                                <div className="font-medium text-slate-900 dark:text-white">{field.field_label}</div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    Type: {field.field_type} • Field: {field.field_name}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                        Students can edit
                                    </span>
                                    <button
                                        onClick={() => handleToggleEditable(field.id, field.is_editable_by_student)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            field.is_editable_by_student 
                                                ? 'bg-blue-600' 
                                                : 'bg-slate-300 dark:bg-slate-600'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                field.is_editable_by_student ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Custom Fields */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Custom Fields</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Custom fields you've added to student profiles
                    </p>
                </div>
                {customFields.length > 0 ? (
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        {customFields.map(field => (
                            <div key={field.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <div className="flex-1">
                                    <div className="font-medium text-slate-900 dark:text-white">{field.field_label}</div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400">
                                        Type: {field.field_type} • Field: {field.field_name}
                                        {field.field_options?.options && field.field_options.options.length > 0 && 
                                            ` • ${field.field_options.options.length} options`}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <span className="text-sm text-slate-700 dark:text-slate-300">
                                            Students can edit
                                        </span>
                                        <button
                                            onClick={() => handleToggleEditable(field.id, field.is_editable_by_student)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                field.is_editable_by_student 
                                                    ? 'bg-blue-600' 
                                                    : 'bg-slate-300 dark:bg-slate-600'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    field.is_editable_by_student ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                    </label>
                                    <button
                                        onClick={() => handleDeleteCustomField(field.id, field.field_label)}
                                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Delete custom field"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                        No custom fields yet. Click "Add Custom Field" to create one.
                    </div>
                )}
            </div>

            {/* Add Custom Field Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add Custom Field</h3>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            {/* Field Label */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Field Label *
                                </label>
                                <input
                                    type="text"
                                    value={newField.field_label}
                                    onChange={e => setNewField(prev => ({ ...prev, field_label: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., Blood Type, Allergies, etc."
                                />
                            </div>

                            {/* Field Type */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Field Type *
                                </label>
                                <select
                                    value={newField.field_type}
                                    onChange={e => setNewField(prev => ({ ...prev, field_type: e.target.value as ProfileFieldType }))}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                >
                                    {FIELD_TYPE_OPTIONS.filter(opt => opt.value !== 'photo').map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Placeholder Text */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Placeholder Text
                                </label>
                                <input
                                    type="text"
                                    value={newField.placeholder_text}
                                    onChange={e => setNewField(prev => ({ ...prev, placeholder_text: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    placeholder="Hint text for the field"
                                />
                            </div>

                            {/* Options for Select type */}
                            {newField.field_type === 'select' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Dropdown Options
                                    </label>
                                    <div className="space-y-2">
                                        {newField.field_options.map((option, index) => (
                                            <div key={index} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={option}
                                                    onChange={e => handleUpdateOption(index, e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                                    placeholder={`Option ${index + 1}`}
                                                />
                                                <button
                                                    onClick={() => handleRemoveOption(index)}
                                                    className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={handleAddOption}
                                            className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                                        >
                                            <PlusIcon className="h-4 w-4" />
                                            Add Option
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Checkboxes */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newField.is_editable_by_student}
                                        onChange={e => setNewField(prev => ({ ...prev, is_editable_by_student: e.target.checked }))}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                        Students can edit this field
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newField.is_required}
                                        onChange={e => setNewField(prev => ({ ...prev, is_required: e.target.checked }))}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                        This field is required
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end">
                            <button
                                onClick={() => setShowAddModal(false)}
                                disabled={isSaving}
                                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddCustomField}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSaving ? (
                                    <>
                                        <Spinner size="sm" />
                                        Adding...
                                    </>
                                ) : (
                                    <>
                                        <SaveIcon className="h-5 w-5" />
                                        Add Field
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentProfileFieldsSettings;
