import React, { useState, useEffect } from 'react';
import type { NotesCheck, NotesCompliance, Student, AcademicTeachingAssignment, UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';
import Spinner from './common/Spinner';
import NotifyParentButton from './NotifyParentButton';
import BulkNotifyButton from './BulkNotifyButton';
import { CheckCircleIcon, XCircleIcon, ClockIcon, PlusCircleIcon } from './common/icons';

interface NotesComplianceTrackerProps {
    userProfile: UserProfile;
    teachingAssignments: AcademicTeachingAssignment[];
}

const NotesComplianceTracker: React.FC<NotesComplianceTrackerProps> = ({
    userProfile,
    teachingAssignments
}) => {
    const [checks, setChecks] = useState<NotesCheck[]>([]);
    const [selectedCheck, setSelectedCheck] = useState<NotesCheck | null>(null);
    const [compliance, setCompliance] = useState<(NotesCompliance & { student?: Student })[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewCheckForm, setShowNewCheckForm] = useState(false);
    const [newCheck, setNewCheck] = useState({
        teaching_assignment_id: '',
        academic_class_id: '',
        topic: '',
        check_date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        loadChecks();
    }, [userProfile.id]);

    const loadChecks = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('notes_checks')
                .select(`
                    *,
                    teaching_assignment:teaching_assignments(*),
                    academic_class:academic_classes(*)
                `)
                .eq('checked_by', userProfile.id)
                .order('check_date', { ascending: false });

            if (error) throw error;
            setChecks(data || []);

            if (data && data.length > 0) {
                selectCheck(data[0]);
            }
        } catch (error) {
            console.error('Error loading notes checks:', error);
        } finally {
            setLoading(false);
        }
    };

    const selectCheck = async (check: NotesCheck) => {
        setSelectedCheck(check);
        try {
            // Load compliance records
            const { data: complianceData, error: complianceError } = await supabase
                .from('notes_compliance')
                .select('*, student:students(*)')
                .eq('notes_check_id', check.id);

            if (complianceError) throw complianceError;

            // Load students in the class
            const { data: studentsData, error: studentsError } = await supabase
                .from('students')
                .select('*')
                .eq('school_id', userProfile.school_id)
                .order('name');

            if (studentsError) throw studentsError;

            setCompliance(complianceData || []);
            setStudents(studentsData || []);
        } catch (error) {
            console.error('Error loading compliance data:', error);
        }
    };

    const createCheck = async () => {
        if (!newCheck.teaching_assignment_id || !newCheck.topic) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            const assignment = (teachingAssignments || []).find(a => a.id === parseInt(newCheck.teaching_assignment_id));
            
            const { data, error } = await supabase
                .from('notes_checks')
                .insert({
                    school_id: userProfile.school_id,
                    teaching_assignment_id: parseInt(newCheck.teaching_assignment_id),
                    academic_class_id: assignment?.academic_class_id,
                    topic: newCheck.topic,
                    check_date: newCheck.check_date,
                    checked_by: userProfile.id
                })
                .select()
                .single();

            if (error) throw error;

            setShowNewCheckForm(false);
            setNewCheck({
                teaching_assignment_id: '',
                academic_class_id: '',
                topic: '',
                check_date: new Date().toISOString().split('T')[0]
            });
            loadChecks();
        } catch (error) {
            console.error('Error creating check:', error);
            alert('Failed to create notes check');
        }
    };

    const markCompliance = async (studentId: number, status: 'complete' | 'incomplete' | 'partial') => {
        if (!selectedCheck) return;

        try {
            const existing = compliance.find(c => c.student_id === studentId);

            if (existing) {
                const { error } = await supabase
                    .from('notes_compliance')
                    .update({ status })
                    .eq('id', existing.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('notes_compliance')
                    .insert({
                        notes_check_id: selectedCheck.id,
                        student_id: studentId,
                        status
                    });

                if (error) throw error;
            }

            selectCheck(selectedCheck);
        } catch (error) {
            console.error('Error marking compliance:', error);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'complete':
                return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
            case 'partial':
                return <ClockIcon className="h-5 w-5 text-yellow-500" />;
            case 'incomplete':
                return <XCircleIcon className="h-5 w-5 text-red-500" />;
            default:
                return <ClockIcon className="h-5 w-5 text-slate-400" />;
        }
    };

    const getComplianceForStudent = (studentId: number) => {
        return compliance.find(c => c.student_id === studentId);
    };

    const summary = {
        complete: compliance.filter(c => c.status === 'complete').length,
        incomplete: compliance.filter(c => c.status === 'incomplete').length,
        partial: compliance.filter(c => c.status === 'partial').length
    };

    const nonCompliantStudents = students.filter(s => {
        const comp = getComplianceForStudent(s.id);
        return comp?.status === 'incomplete' || !comp;
    });

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
                    Notes Compliance Tracker
                </h1>
                <button
                    onClick={() => setShowNewCheckForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                >
                    <PlusCircleIcon className="h-5 w-5" />
                    New Notes Check
                </button>
            </div>

            {showNewCheckForm && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">
                            Create Notes Check
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                                    Class
                                </label>
                                <select
                                    value={newCheck.teaching_assignment_id}
                                    onChange={(e) => setNewCheck({ ...newCheck, teaching_assignment_id: e.target.value })}
                                    className="w-full p-2 border rounded-md bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
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
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                                    Topic
                                </label>
                                <input
                                    type="text"
                                    value={newCheck.topic}
                                    onChange={(e) => setNewCheck({ ...newCheck, topic: e.target.value })}
                                    className="w-full p-2 border rounded-md bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                                    placeholder="e.g., Chapter 5: Photosynthesis"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    value={newCheck.check_date}
                                    onChange={(e) => setNewCheck({ ...newCheck, check_date: e.target.value })}
                                    className="w-full p-2 border rounded-md bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                                />
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button
                                    onClick={createCheck}
                                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium"
                                >
                                    Create
                                </button>
                                <button
                                    onClick={() => setShowNewCheckForm(false)}
                                    className="px-6 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 py-2 rounded-lg font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Checks List */}
                <div className="space-y-2">
                    <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-2">
                        Recent Checks
                    </h2>
                    {checks.map(check => (
                        <button
                            key={check.id}
                            onClick={() => selectCheck(check)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                selectedCheck?.id === check.id
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            <div className="font-medium text-sm text-slate-800 dark:text-white">
                                {check.topic}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {new Date(check.check_date).toLocaleDateString()}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Compliance Grid */}
                <div className="lg:col-span-3">
                    {selectedCheck ? (
                        <>
                            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-4">
                                <h2 className="font-semibold text-slate-800 dark:text-white mb-2">
                                    {selectedCheck.topic}
                                </h2>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                    {new Date(selectedCheck.check_date).toLocaleDateString()}
                                </p>

                                <div className="flex gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <CheckCircleIcon className="h-4 w-4 text-green-500" />
                                        <span className="text-slate-700 dark:text-slate-200">
                                            Complete: {summary.complete}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-yellow-500" />
                                        <span className="text-slate-700 dark:text-slate-200">
                                            Partial: {summary.partial}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <XCircleIcon className="h-4 w-4 text-red-500" />
                                        <span className="text-slate-700 dark:text-slate-200">
                                            Incomplete: {summary.incomplete}
                                        </span>
                                    </div>
                                </div>

                                {nonCompliantStudents.length > 0 && (
                                    <div className="mt-4">
                                        <BulkNotifyButton
                                            students={nonCompliantStudents}
                                            templateName="notes_incomplete"
                                            notificationType="notes_incomplete"
                                            getVariables={(student) => ({
                                                subject: selectedCheck.teaching_assignment?.subject_name || '',
                                                status: 'incomplete',
                                                topic: selectedCheck.topic
                                            })}
                                            referenceId={selectedCheck.id}
                                            schoolId={userProfile.school_id}
                                            userId={userProfile.id}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                {students.map(student => {
                                    const comp = getComplianceForStudent(student.id);
                                    const status = comp?.status || 'pending';

                                    return (
                                        <div
                                            key={student.id}
                                            className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3"
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
                                                            onClick={() => markCompliance(student.id, 'complete')}
                                                            className="px-2 py-1 text-xs rounded bg-green-500 hover:bg-green-600 text-white"
                                                        >
                                                            Complete
                                                        </button>
                                                        <button
                                                            onClick={() => markCompliance(student.id, 'partial')}
                                                            className="px-2 py-1 text-xs rounded bg-yellow-500 hover:bg-yellow-600 text-white"
                                                        >
                                                            Partial
                                                        </button>
                                                        <button
                                                            onClick={() => markCompliance(student.id, 'incomplete')}
                                                            className="px-2 py-1 text-xs rounded bg-red-500 hover:bg-red-600 text-white"
                                                        >
                                                            Incomplete
                                                        </button>
                                                    </div>

                                                    {status === 'incomplete' && student.parent_phone_number_1 && (
                                                        <NotifyParentButton
                                                            studentId={student.id}
                                                            studentName={student.name}
                                                            parentPhone={student.parent_phone_number_1}
                                                            templateName="notes_incomplete"
                                                            notificationType="notes_incomplete"
                                                            variables={{
                                                                subject: selectedCheck.teaching_assignment?.subject_name || '',
                                                                status: 'incomplete',
                                                                topic: selectedCheck.topic
                                                            }}
                                                            referenceId={selectedCheck.id}
                                                            schoolId={userProfile.school_id}
                                                            userId={userProfile.id}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                            No notes check selected. Create one to get started.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotesComplianceTracker;
