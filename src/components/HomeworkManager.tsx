import React, { useState, useEffect } from 'react';
import type { Homework, AcademicTeachingAssignment, AcademicClass, UserProfile, HomeworkSubmission, Student } from '../types';
import { supabase } from '../services/supabaseClient';
import Spinner from './common/Spinner';
import { PlusCircleIcon, TrashIcon, EditIcon, EyeIcon, CheckCircleIcon, ClockIcon, XCircleIcon } from './common/icons';
import NotifyParentButton from './NotifyParentButton';
import BulkNotifyButton from './BulkNotifyButton';

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
    const [expandedHomeworkId, setExpandedHomeworkId] = useState<number | null>(null);
    const [submissions, setSubmissions] = useState<Record<number, (HomeworkSubmission & { student?: Student })[]>>({});
    const [students, setStudents] = useState<Record<number, Student[]>>({});
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
            
            // Load submission counts for all homework
            if (data && data.length > 0) {
                for (const hw of data) {
                    await loadSubmissionsForHomework(hw.id);
                }
            }
        } catch (error) {
            console.error('Error loading homework:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSubmissionsForHomework = async (homeworkId: number) => {
        try {
            const { data: submissionsData, error: submissionsError } = await supabase
                .from('homework_submissions')
                .select('*, student:students(*)')
                .eq('homework_id', homeworkId);

            if (submissionsError) throw submissionsError;
            
            setSubmissions(prev => ({
                ...prev,
                [homeworkId]: submissionsData || []
            }));
        } catch (error) {
            console.error('Error loading submissions:', error);
        }
    };

    const loadStudentsForClass = async (homeworkId: number, academicClassId: number) => {
        try {
            // Load students enrolled in this class
            const { data: classStudents, error: studentsError } = await supabase
                .from('academic_class_students')
                .select('student_id')
                .eq('academic_class_id', academicClassId);

            if (studentsError) throw studentsError;

            const studentIds = classStudents?.map(cs => cs.student_id) || [];
            
            if (studentIds.length > 0) {
                const { data: studentsData, error: studentsDataError } = await supabase
                    .from('students')
                    .select('*')
                    .in('id', studentIds)
                    .order('name');

                if (studentsDataError) throw studentsDataError;

                setStudents(prev => ({
                    ...prev,
                    [homeworkId]: studentsData || []
                }));
            }
        } catch (error) {
            console.error('Error loading students:', error);
        }
    };

    const createPendingSubmissions = async (homeworkId: number, academicClassId: number) => {
        try {
            // Get students enrolled in this class
            const { data: classStudents, error: studentsError } = await supabase
                .from('academic_class_students')
                .select('student_id')
                .eq('academic_class_id', academicClassId);

            if (studentsError) throw studentsError;

            const studentIds = classStudents?.map(cs => cs.student_id) || [];
            
            if (studentIds.length > 0) {
                // Create pending submissions for all students
                const pendingSubmissions = studentIds.map(studentId => ({
                    homework_id: homeworkId,
                    student_id: studentId,
                    submission_status: 'pending' as const
                }));

                const { error: insertError } = await supabase
                    .from('homework_submissions')
                    .insert(pendingSubmissions);

                if (insertError && insertError.code !== '23505') { // Ignore duplicate key errors
                    throw insertError;
                }
            }
        } catch (error) {
            console.error('Error creating pending submissions:', error);
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
                const { data: newHomework, error } = await supabase
                    .from('homework')
                    .insert({
                        ...formData,
                        school_id: userProfile.school_id,
                        created_by: userProfile.id
                    })
                    .select()
                    .single();

                if (error) throw error;

                // Auto-create pending submissions for all students in the class
                if (newHomework && formData.academic_class_id) {
                    await createPendingSubmissions(newHomework.id, formData.academic_class_id);
                }
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

    const toggleExpanded = async (hw: Homework) => {
        if (expandedHomeworkId === hw.id) {
            setExpandedHomeworkId(null);
        } else {
            setExpandedHomeworkId(hw.id);
            // Load students and submissions if not already loaded
            if (!students[hw.id]) {
                await loadStudentsForClass(hw.id, hw.academic_class_id);
            }
            if (!submissions[hw.id]) {
                await loadSubmissionsForHomework(hw.id);
            }
        }
    };

    const markSubmission = async (homeworkId: number, studentId: number, status: 'submitted' | 'late' | 'missing') => {
        try {
            const existing = submissions[homeworkId]?.find(s => s.student_id === studentId);

            if (existing) {
                const { error } = await supabase
                    .from('homework_submissions')
                    .update({
                        submission_status: status,
                        submitted_at: (status === 'submitted' || status === 'late') ? new Date().toISOString() : null
                    })
                    .eq('id', existing.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('homework_submissions')
                    .insert({
                        homework_id: homeworkId,
                        student_id: studentId,
                        submission_status: status,
                        submitted_at: (status === 'submitted' || status === 'late') ? new Date().toISOString() : null
                    });

                if (error) throw error;
            }

            await loadSubmissionsForHomework(homeworkId);
        } catch (error) {
            console.error('Error marking submission:', error);
        }
    };

    const markAllAsSubmitted = async (homeworkId: number) => {
        if (!confirm('Mark all students as submitted?')) return;

        const classStudents = students[homeworkId] || [];
        
        try {
            for (const student of classStudents) {
                await markSubmission(homeworkId, student.id, 'submitted');
            }
            await loadSubmissionsForHomework(homeworkId);
        } catch (error) {
            console.error('Error marking all as submitted:', error);
            alert('Failed to mark all submissions');
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'submitted':
                return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
            case 'late':
                return <ClockIcon className="h-5 w-5 text-yellow-500" />;
            case 'missing':
                return <XCircleIcon className="h-5 w-5 text-red-500" />;
            default:
                return <ClockIcon className="h-5 w-5 text-slate-400" />;
        }
    };

    const getSubmissionForStudent = (homeworkId: number, studentId: number) => {
        return submissions[homeworkId]?.find(s => s.student_id === studentId);
    };

    const getSubmissionStats = (homeworkId: number) => {
        const hwSubmissions = submissions[homeworkId] || [];
        return {
            submitted: hwSubmissions.filter(s => s.submission_status === 'submitted').length,
            late: hwSubmissions.filter(s => s.submission_status === 'late').length,
            missing: hwSubmissions.filter(s => s.submission_status === 'missing').length,
            pending: hwSubmissions.filter(s => s.submission_status === 'pending').length
        };
    };

    const getMissingStudents = (homeworkId: number) => {
        const classStudents = students[homeworkId] || [];
        return classStudents.filter(student => {
            const submission = getSubmissionForStudent(homeworkId, student.id);
            return submission?.submission_status === 'missing' || !submission;
        });
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
                    homework.map(hw => {
                        const stats = getSubmissionStats(hw.id);
                        const isExpanded = expandedHomeworkId === hw.id;
                        const classStudents = students[hw.id] || [];
                        const missingStudents = getMissingStudents(hw.id);
                        const teachingAssignment = teachingAssignments.find(ta => ta.id === hw.teaching_assignment_id);

                        return (
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
                                        
                                        {/* Summary Statistics */}
                                        <div className="flex gap-4 text-xs mt-3">
                                            <div className="flex items-center gap-1">
                                                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                                                <span className="text-slate-700 dark:text-slate-200">
                                                    Submitted: {stats.submitted}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <ClockIcon className="h-4 w-4 text-yellow-500" />
                                                <span className="text-slate-700 dark:text-slate-200">
                                                    Late: {stats.late}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <XCircleIcon className="h-4 w-4 text-red-500" />
                                                <span className="text-slate-700 dark:text-slate-200">
                                                    Missing: {stats.missing}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <ClockIcon className="h-4 w-4 text-slate-400" />
                                                <span className="text-slate-700 dark:text-slate-200">
                                                    Pending: {stats.pending}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => toggleExpanded(hw)}
                                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                            title="Track submissions"
                                        >
                                            <EyeIcon className={`h-5 w-5 ${isExpanded ? 'text-blue-600' : 'text-blue-500'}`} />
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

                                {/* Inline Compliance Grid */}
                                {isExpanded && (
                                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                        {/* Bulk Actions */}
                                        <div className="flex gap-2 mb-4">
                                            <button
                                                onClick={() => markAllAsSubmitted(hw.id)}
                                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg font-medium"
                                            >
                                                Mark All as Submitted
                                            </button>
                                            {missingStudents.length > 0 && (
                                                <BulkNotifyButton
                                                    students={missingStudents}
                                                    templateName="homework_missing"
                                                    notificationType="homework_missing"
                                                    getVariables={(student) => ({
                                                        subject: teachingAssignment?.subject_name || '',
                                                        homework_title: hw.title,
                                                        due_date: new Date(hw.due_date).toLocaleDateString()
                                                    })}
                                                    referenceId={hw.id}
                                                    schoolId={userProfile.school_id}
                                                    userId={userProfile.id}
                                                />
                                            )}
                                        </div>

                                        {/* Student Rows */}
                                        <div className="space-y-2">
                                            {classStudents.length === 0 ? (
                                                <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-sm">
                                                    No students enrolled in this class
                                                </div>
                                            ) : (
                                                classStudents.map(student => {
                                                    const submission = getSubmissionForStudent(hw.id, student.id);
                                                    const status = submission?.submission_status || 'pending';

                                                    return (
                                                        <div
                                                            key={student.id}
                                                            className="bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-3"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    {getStatusIcon(status)}
                                                                    <span className="font-medium text-slate-800 dark:text-white">
                                                                        {student.name}
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex gap-1">
                                                                        <button
                                                                            onClick={() => markSubmission(hw.id, student.id, 'submitted')}
                                                                            className="px-2 py-1 text-xs rounded bg-green-500 hover:bg-green-600 text-white"
                                                                        >
                                                                            ✓ Submitted
                                                                        </button>
                                                                        <button
                                                                            onClick={() => markSubmission(hw.id, student.id, 'late')}
                                                                            className="px-2 py-1 text-xs rounded bg-yellow-500 hover:bg-yellow-600 text-white"
                                                                        >
                                                                            ⏰ Late
                                                                        </button>
                                                                        <button
                                                                            onClick={() => markSubmission(hw.id, student.id, 'missing')}
                                                                            className="px-2 py-1 text-xs rounded bg-red-500 hover:bg-red-600 text-white"
                                                                        >
                                                                            ✗ Missing
                                                                        </button>
                                                                    </div>

                                                                    {status === 'missing' && student.parent_phone_number_1 && (
                                                                        <NotifyParentButton
                                                                            studentId={student.id}
                                                                            studentName={student.name}
                                                                            parentPhone={student.parent_phone_number_1}
                                                                            templateName="homework_missing"
                                                                            notificationType="homework_missing"
                                                                            variables={{
                                                                                subject: teachingAssignment?.subject_name || '',
                                                                                homework_title: hw.title,
                                                                                due_date: new Date(hw.due_date).toLocaleDateString()
                                                                            }}
                                                                            referenceId={hw.id}
                                                                            schoolId={userProfile.school_id}
                                                                            userId={userProfile.id}
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default HomeworkManager;
