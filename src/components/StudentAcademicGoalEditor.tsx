import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { StudentAcademicGoal } from '../types';
import Spinner from './common/Spinner';
import { CheckCircleIcon, PencilIcon, TrashIcon } from './common/icons';

interface StudentAcademicGoalEditorProps {
    studentId: number;
    termId: number;
    schoolId: number;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const StudentAcademicGoalEditor: React.FC<StudentAcademicGoalEditorProps> = ({
    studentId,
    termId,
    schoolId,
    addToast,
}) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [existingGoal, setExistingGoal] = useState<StudentAcademicGoal | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    
    // Form state
    const [goalText, setGoalText] = useState('');
    const [targetAverage, setTargetAverage] = useState<string>('');
    const [targetPosition, setTargetPosition] = useState<string>('');
    const [targetSubjects, setTargetSubjects] = useState<{ subject: string; score: string }[]>([]);
    
    // Term end check
    const [termHasEnded, setTermHasEnded] = useState(false);

    useEffect(() => {
        fetchGoalAndCheckTerm();
    }, [studentId, termId]);

    const fetchGoalAndCheckTerm = async () => {
        const supabase = requireSupabaseClient();
        setLoading(true);
        try {
            // Fetch existing goal
            const { data: goal, error: goalError } = await supabase
                .from('student_academic_goals')
                .select('*')
                .eq('student_id', studentId)
                .eq('term_id', termId)
                .maybeSingle();

            if (goalError && goalError.code !== 'PGRST116') {
                console.error('Error fetching goal:', goalError);
                addToast('Error loading your goal', 'error');
            } else if (goal) {
                setExistingGoal(goal);
                setGoalText(goal.goal_text);
                setTargetAverage(goal.target_average?.toString() || '');
                setTargetPosition(goal.target_position?.toString() || '');
                
                // Parse target subjects from JSONB
                if (goal.target_subjects && typeof goal.target_subjects === 'object') {
                    const subjects = Object.entries(goal.target_subjects).map(([subject, score]) => ({
                        subject,
                        score: score.toString(),
                    }));
                    setTargetSubjects(subjects);
                }
                
                setIsEditing(false);
            } else {
                setIsEditing(true); // No goal yet, start in edit mode
            }

            // Check if term has ended
            const { data: term } = await supabase
                .from('terms')
                .select('end_date')
                .eq('id', termId)
                .single();

            if (term) {
                const endDate = new Date(term.end_date);
                const now = new Date();
                setTermHasEnded(now > endDate);
            }
        } catch (error) {
            console.error('Error in fetchGoalAndCheckTerm:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddSubject = () => {
        setTargetSubjects([...targetSubjects, { subject: '', score: '' }]);
    };

    const handleRemoveSubject = (index: number) => {
        setTargetSubjects(targetSubjects.filter((_, i) => i !== index));
    };

    const handleSubjectChange = (index: number, field: 'subject' | 'score', value: string) => {
        const updated = [...targetSubjects];
        updated[index][field] = value;
        setTargetSubjects(updated);
    };

    const handleSave = async () => {
        const supabase = requireSupabaseClient();
        if (!goalText.trim()) {
            addToast('Please enter your goal description', 'error');
            return;
        }

        setSaving(true);
        try {
            // Parse optional numeric fields with validation
            let parsedTargetAverage: number | null = null;
            if (targetAverage) {
                const avg = parseFloat(targetAverage);
                if (isNaN(avg) || avg < 0 || avg > 100) {
                    addToast('Target average must be a valid number between 0 and 100', 'error');
                    setSaving(false);
                    return;
                }
                parsedTargetAverage = avg;
            }

            let parsedTargetPosition: number | null = null;
            if (targetPosition) {
                const pos = parseInt(targetPosition, 10);
                if (isNaN(pos) || pos < 1) {
                    addToast('Target position must be a valid number greater than 0', 'error');
                    setSaving(false);
                    return;
                }
                parsedTargetPosition = pos;
            }

            // Build target subjects object with validation
            const targetSubjectsObj: Record<string, number> = {};
            for (const { subject, score } of targetSubjects) {
                if (subject.trim() && score) {
                    const numScore = parseFloat(score);
                    if (isNaN(numScore) || numScore < 0 || numScore > 100) {
                        addToast(`Invalid score for ${subject}. Must be between 0 and 100.`, 'error');
                        setSaving(false);
                        return;
                    }
                    targetSubjectsObj[subject.trim()] = numScore;
                }
            }

            const goalData = {
                student_id: studentId,
                term_id: termId,
                school_id: schoolId,
                goal_text: goalText.trim(),
                target_average: parsedTargetAverage,
                target_position: parsedTargetPosition,
                target_subjects: Object.keys(targetSubjectsObj).length > 0 ? targetSubjectsObj : null,
            };

            if (existingGoal) {
                // Update existing goal
                const { error } = await supabase
                    .from('student_academic_goals')
                    .update(goalData)
                    .eq('id', existingGoal.id);

                if (error) {
                    console.error('Error updating goal:', error);
                    addToast('Failed to update goal', 'error');
                } else {
                    addToast('Goal updated successfully!', 'success');
                    await fetchGoalAndCheckTerm(); // Refresh
                }
            } else {
                // Insert new goal
                const { error } = await supabase
                    .from('student_academic_goals')
                    .insert([goalData]);

                if (error) {
                    console.error('Error creating goal:', error);
                    addToast('Failed to save goal', 'error');
                } else {
                    addToast('Goal saved successfully!', 'success');
                    await fetchGoalAndCheckTerm(); // Refresh
                }
            }
        } catch (error) {
            console.error('Error saving goal:', error);
            addToast('An error occurred while saving', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        if (existingGoal) {
            // Restore from existing goal
            setGoalText(existingGoal.goal_text);
            setTargetAverage(existingGoal.target_average?.toString() || '');
            setTargetPosition(existingGoal.target_position?.toString() || '');
            
            if (existingGoal.target_subjects && typeof existingGoal.target_subjects === 'object') {
                const subjects = Object.entries(existingGoal.target_subjects).map(([subject, score]) => ({
                    subject,
                    score: score.toString(),
                }));
                setTargetSubjects(subjects);
            } else {
                setTargetSubjects([]);
            }
            
            setIsEditing(false);
        } else {
            // Clear form
            setGoalText('');
            setTargetAverage('');
            setTargetPosition('');
            setTargetSubjects([]);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {termHasEnded && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-amber-800 dark:text-amber-100 font-semibold">
                        Term has ended. Goal editing is disabled.
                    </p>
                </div>
            )}

            {!isEditing && existingGoal ? (
                // Display mode
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                            My Academic Goal
                        </h3>
                        {!termHasEnded && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                            >
                                <PencilIcon className="w-4 h-4" />
                                Edit
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Goal Description
                            </label>
                            <p className="text-slate-900 dark:text-white">{existingGoal.goal_text}</p>
                        </div>

                        {existingGoal.target_average !== null && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Target Average
                                </label>
                                <p className="text-slate-900 dark:text-white">{existingGoal.target_average}%</p>
                            </div>
                        )}

                        {existingGoal.target_position !== null && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Target Position
                                </label>
                                <p className="text-slate-900 dark:text-white">Top {existingGoal.target_position}</p>
                            </div>
                        )}

                        {existingGoal.target_subjects && Object.keys(existingGoal.target_subjects).length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Subject Targets
                                </label>
                                <div className="space-y-2">
                                    {Object.entries(existingGoal.target_subjects).map(([subject, score]) => (
                                        <div key={subject} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700 rounded">
                                            <span className="text-slate-900 dark:text-white">{subject}</span>
                                            <span className="font-semibold text-blue-600 dark:text-blue-400">{score}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                // Edit mode
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                        {existingGoal ? 'Edit Academic Goal' : 'Set Academic Goal'}
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Goal Description <span className="text-red-600">*</span>
                            </label>
                            <textarea
                                value={goalText}
                                onChange={(e) => setGoalText(e.target.value)}
                                placeholder="e.g., I want to improve my Mathematics grade and be in the top 10"
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                disabled={termHasEnded}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Target Average (%)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={targetAverage}
                                    onChange={(e) => setTargetAverage(e.target.value)}
                                    placeholder="e.g., 75"
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    disabled={termHasEnded}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Target Position
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={targetPosition}
                                    onChange={(e) => setTargetPosition(e.target.value)}
                                    placeholder="e.g., 10"
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    disabled={termHasEnded}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Subject-Specific Targets
                                </label>
                                {!termHasEnded && (
                                    <button
                                        onClick={handleAddSubject}
                                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                                    >
                                        + Add Subject
                                    </button>
                                )}
                            </div>

                            {targetSubjects.length > 0 && (
                                <div className="space-y-2">
                                    {targetSubjects.map((item, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={item.subject}
                                                onChange={(e) => handleSubjectChange(index, 'subject', e.target.value)}
                                                placeholder="Subject name"
                                                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                                disabled={termHasEnded}
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={item.score}
                                                onChange={(e) => handleSubjectChange(index, 'score', e.target.value)}
                                                placeholder="Score"
                                                className="w-24 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                                disabled={termHasEnded}
                                            />
                                            {!termHasEnded && (
                                                <button
                                                    onClick={() => handleRemoveSubject(index)}
                                                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {!termHasEnded && (
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg font-semibold flex items-center gap-2"
                                >
                                    {saving ? <Spinner size="sm" /> : <CheckCircleIcon className="w-5 h-5" />}
                                    {saving ? 'Saving...' : 'Save Goal'}
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={saving}
                                    className="px-6 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg font-semibold"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentAcademicGoalEditor;
