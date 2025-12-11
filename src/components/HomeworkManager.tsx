import React, { useState, useEffect } from 'react';
import type { Homework, AcademicTeachingAssignment, AcademicClass, UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';
import Spinner from './common/Spinner';
import { PlusCircleIcon, TrashIcon, EditIcon, EyeIcon } from './common/icons';

interface HomeworkManagerProps {
    userProfile: UserProfile;
    teachingAssignments: AcademicTeachingAssignment[];
    onNavigate: (view: string, data?: any) => void;
}

const HomeworkManager: React.FC<HomeworkManagerProps> = ({
    userProfile,
    teachingAssignments,
    onNavigate
}) => {
    const [homework, setHomework] = useState<Homework[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
    const [formData, setFormData] = useState<Partial<Homework>>({
        title: '',
        description: '',
        instructions: '',
        due_date: '',
        due_time: '',
        max_score: 100,
        is_graded: true,
        allow_late_submission: false,
        late_penalty_percent: 0,
        notify_parents: false
    });

    useEffect(() => {
        loadHomework();
    }, [userProfile.id]);

    const loadHomework = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('homework')
                .select(`
                    *,
                    teaching_assignment:teaching_assignments(*),
                    academic_class:academic_classes(*)
                `)
                .eq('created_by', userProfile.id)
                .order('due_date', { ascending: false });

            if (error) throw error;
            setHomework(data || []);
        } catch (error) {
            console.error('Error loading homework:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.teaching_assignment_id || !formData.academic_class_id) {
            alert('Please select a class and subject');
            return;
        }

        try {
            if (editingHomework) {
                // Update existing
                const { error } = await supabase
                    .from('homework')
                    .update({
                        ...formData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingHomework.id);

                if (error) throw error;
            } else {
                // Create new
                const { error } = await supabase
                    .from('homework')
                    .insert({
                        ...formData,
                        school_id: userProfile.school_id,
                        created_by: userProfile.id
                    });

                if (error) throw error;
            }

            setShowForm(false);
            setEditingHomework(null);
            setFormData({
                title: '',
                description: '',
                instructions: '',
                due_date: '',
                due_time: '',
                max_score: 100,
                is_graded: true,
                allow_late_submission: false,
                late_penalty_percent: 0,
                notify_parents: false
            });
            loadHomework();
        } catch (error) {
            console.error('Error saving homework:', error);
            alert('Failed to save homework');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this homework?')) return;

        try {
            const { error } = await supabase
                .from('homework')
                .delete()
                .eq('id', id);

            if (error) throw error;
            loadHomework();
        } catch (error) {
            console.error('Error deleting homework:', error);
            alert('Failed to delete homework');
        }
    };

    const inputClass = "w-full p-2 border rounded-md bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none";
    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1";

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                    Homework Manager
                </h1>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                >
                    <PlusCircleIcon className="h-5 w-5" />
                    New Homework
                </button>
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">
                            {editingHomework ? 'Edit Homework' : 'Create Homework'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className={labelClass}>Class</label>
                                <select
                                    value={formData.teaching_assignment_id || ''}
                                    onChange={(e) => {
                                        const assignment = (teachingAssignments || []).find(a => a.id === parseInt(e.target.value));
                                        setFormData({
                                            ...formData,
                                            teaching_assignment_id: parseInt(e.target.value),
                                            academic_class_id: assignment?.academic_class_id
                                        });
                                    }}
                                    className={inputClass}
                                    required
                                >
                                    <option value="">Select a class</option>
                                    {(teachingAssignments || []).map(assignment => (
                                        <option key={assignment.id} value={assignment.id}>
                                            {assignment.subject_name} - {assignment.academic_class?.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className={labelClass}>Title</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className={inputClass}
                                    required
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className={inputClass}
                                    rows={3}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Due Date</label>
                                    <input
                                        type="date"
                                        value={formData.due_date}
                                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                        className={inputClass}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Due Time</label>
                                    <input
                                        type="time"
                                        value={formData.due_time}
                                        onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_graded}
                                        onChange={(e) => setFormData({ ...formData, is_graded: e.target.checked })}
                                        className="rounded"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-200">Is Graded</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.notify_parents}
                                        onChange={(e) => setFormData({ ...formData, notify_parents: e.target.checked })}
                                        className="rounded"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-200">Notify Parents</span>
                                </label>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium"
                                >
                                    {editingHomework ? 'Update' : 'Create'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowForm(false);
                                        setEditingHomework(null);
                                    }}
                                    className="px-6 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 py-2 rounded-lg font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {homework.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        No homework assigned yet. Click "New Homework" to get started.
                    </div>
                ) : (
                    homework.map(hw => (
                        <div
                            key={hw.id}
                            className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-slate-800 dark:text-white">
                                        {hw.title}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                        {hw.academic_class?.name} • Due: {new Date(hw.due_date).toLocaleDateString()}
                                    </p>
                                    {hw.description && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                                            {hw.description}
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onNavigate('HOMEWORK_COMPLIANCE', { homeworkId: hw.id })}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                        title="View submissions"
                                    >
                                        <EyeIcon className="h-5 w-5 text-blue-500" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(hw.id)}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                        title="Delete"
                                    >
                                        <TrashIcon className="h-5 w-5 text-red-500" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default HomeworkManager;
