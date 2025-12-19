import React, { useState, useEffect } from 'react';
import type { Homework, HomeworkSubmission, StudentProfile } from '../types';
import { requireSupabaseClient } from '../services/supabaseClient';
import Spinner from './common/Spinner';
import { CheckCircleIcon, ClockIcon, UploadCloudIcon, FileTextIcon } from './common/icons';

interface StudentHomeworkViewProps {
    studentProfile: StudentProfile;
}

const StudentHomeworkView: React.FC<StudentHomeworkViewProps> = ({ studentProfile }) => {
    const [homework, setHomework] = useState<(Homework & { submission?: HomeworkSubmission })[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);
    const [submissionText, setSubmissionText] = useState('');

    useEffect(() => {
        loadHomework();
    }, [studentProfile.student_record_id]);

    const loadHomework = async () => {
        setLoading(true);
        try {
            // Get student's academic class
            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('*, academic_class:academic_classes(*)')
                .eq('id', studentProfile.student_record_id)
                .single();

            if (studentError) throw studentError;

            // Load homework for student's classes
            const { data: homeworkData, error: homeworkError } = await supabase
                .from('homework')
                .select(`
                    *,
                    teaching_assignment:teaching_assignments(*),
                    academic_class:academic_classes(*)
                `)
                .eq('status', 'active')
                .order('due_date', { ascending: true });

            if (homeworkError) throw homeworkError;

            // Load submissions
            const { data: submissions, error: submissionsError } = await supabase
                .from('homework_submissions')
                .select('*')
                .eq('student_id', studentProfile.student_record_id);

            if (submissionsError) throw submissionsError;

            // Combine homework with submissions
            const combined = (homeworkData || []).map(hw => ({
                ...hw,
                submission: submissions?.find(s => s.homework_id === hw.id)
            }));

            setHomework(combined);
        } catch (error) {
            console.error('Error loading homework:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (homeworkId: number) => {
        if (!submissionText.trim()) {
            alert('Please enter your submission');
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('homework_submissions')
                .insert({
                    homework_id: homeworkId,
                    student_id: studentProfile.student_record_id,
                    submission_status: 'submitted',
                    submission_text: submissionText,
                    submitted_at: new Date().toISOString()
                });

            if (error) throw error;

            setSelectedHomework(null);
            setSubmissionText('');
            loadHomework();
            alert('Homework submitted successfully!');
        } catch (error) {
            console.error('Error submitting homework:', error);
            alert('Failed to submit homework');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (hw: Homework & { submission?: HomeworkSubmission }) => {
        if (hw.submission) {
            if (hw.submission.score !== undefined && hw.submission.score !== null) {
                return (
                    <span className="px-2 py-1 text-xs font-medium rounded-md bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 flex items-center gap-1">
                        <CheckCircleIcon className="h-4 w-4" />
                        Graded: {hw.submission.score}/{hw.max_score}
                    </span>
                );
            }
            return (
                <span className="px-2 py-1 text-xs font-medium rounded-md bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 flex items-center gap-1">
                    <CheckCircleIcon className="h-4 w-4" />
                    Submitted
                </span>
            );
        }

        const dueDate = new Date(hw.due_date);
        const now = new Date();
        const isOverdue = dueDate < now;

        if (isOverdue) {
            return (
                <span className="px-2 py-1 text-xs font-medium rounded-md bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" />
                    Overdue
                </span>
            );
        }

        return (
            <span className="px-2 py-1 text-xs font-medium rounded-md bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 flex items-center gap-1">
                <ClockIcon className="h-4 w-4" />
                Pending
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
                My Homework
            </h1>

            {homework.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    No homework assigned yet.
                </div>
            ) : (
                <div className="space-y-4">
                    {homework.map(hw => (
                        <div
                            key={hw.id}
                            className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-semibold text-slate-800 dark:text-white">
                                        {hw.title}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        {hw.teaching_assignment?.subject_name}
                                    </p>
                                </div>
                                {getStatusBadge(hw)}
                            </div>

                            {hw.description && (
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                                    {hw.description}
                                </p>
                            )}

                            <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 mb-3">
                                <span>Due: {new Date(hw.due_date).toLocaleDateString()}</span>
                                {hw.due_time && <span>{hw.due_time}</span>}
                                {hw.is_graded && <span>Max Score: {hw.max_score}</span>}
                            </div>

                            {hw.submission ? (
                                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                                        Your Submission:
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        {hw.submission.submission_text}
                                    </p>
                                    {hw.submission.feedback && (
                                        <div className="mt-2">
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                Teacher Feedback:
                                            </p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                {hw.submission.feedback}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <button
                                    onClick={() => setSelectedHomework(hw)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium"
                                >
                                    <UploadCloudIcon className="h-4 w-4" />
                                    Submit Homework
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {selectedHomework && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6">
                        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">
                            Submit: {selectedHomework.title}
                        </h2>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                                Your Answer
                            </label>
                            <textarea
                                value={submissionText}
                                onChange={(e) => setSubmissionText(e.target.value)}
                                className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                rows={10}
                                placeholder="Type your homework answer here..."
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => handleSubmit(selectedHomework.id)}
                                disabled={submitting}
                                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <Spinner size="xs" />
                                        Submitting...
                                    </>
                                ) : (
                                    'Submit'
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedHomework(null);
                                    setSubmissionText('');
                                }}
                                className="px-6 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 py-2 rounded-lg font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentHomeworkView;
