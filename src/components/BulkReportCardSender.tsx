import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { Student } from '../types';
import Spinner from './common/Spinner';
import { CloseIcon, CheckCircleIcon, AlertCircleIcon, PaperAirplaneIcon, SearchIcon } from './common/icons';
import { bulkSendReportCards } from '../services/reportCardService';

interface BulkReportCardSenderProps {
    termId: number;
    academicClassId: number;
    schoolId: number;
    userId: string;
    onClose: () => void;
    addToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface StudentWithReport extends Student {
    hasReport: boolean;
    hasParentPhone: boolean;
    parentPhone: string;
    hasDebt: boolean;
    outstandingAmount: number;
    className: string;
}

const BulkReportCardSender: React.FC<BulkReportCardSenderProps> = ({
    termId,
    academicClassId,
    schoolId,
    userId,
    onClose,
    addToast
}) => {
    const [students, setStudents] = useState<StudentWithReport[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [excludeDebtors, setExcludeDebtors] = useState(false);
    const [sendComplete, setSendComplete] = useState(false);
    const [sendResults, setSendResults] = useState<{
        sent: number;
        failed: number;
        errors: Array<{ studentId: number; studentName: string; error: string }>;
    } | null>(null);
    const [termName, setTermName] = useState('');
    const [className, setClassName] = useState('');

    useEffect(() => {
        loadStudents();
    }, [termId, academicClassId, schoolId]);

    const loadStudents = async () => {
        setIsLoading(true);
        try {
            // Get term details
            const { data: term } = await supabase
                .from('terms')
                .select('name')
                .eq('id', termId)
                .single();

            if (term) {
                setTermName(term.name);
            }

            // Get class details
            const { data: classData } = await supabase
                .from('academic_classes')
                .select('name')
                .eq('id', academicClassId)
                .single();

            if (classData) {
                setClassName(classData.name);
            }

            // Get all students in the class
            const { data: classStudents, error: studentsError } = await supabase
                .from('academic_class_students')
                .select(`
                    student_id,
                    students!inner (
                        id,
                        name,
                        admission_number,
                        parent_phone_number_1,
                        school_id
                    )
                `)
                .eq('academic_class_id', academicClassId);

            if (studentsError) {
                console.error('Error fetching students:', studentsError);
                addToast?.('Failed to load students', 'error');
                return;
            }

            // Get published reports for this term
            const { data: reports } = await supabase
                .from('student_term_reports')
                .select('student_id, is_published')
                .eq('term_id', termId)
                .eq('is_published', true);

            const publishedStudentIds = new Set(reports?.map(r => r.student_id) || []);

            // Get fee balances
            const studentIds = classStudents?.map(cs => (cs.students as any).id) || [];
            const { data: balances } = await supabase
                .from('student_fee_balances')
                .select('student_id, balance')
                .in('student_id', studentIds);

            const balanceMap = new Map(balances?.map(b => [b.student_id, b.balance]) || []);

            // Build student list with all required info
            const studentsWithInfo: StudentWithReport[] = (classStudents || [])
                .map(cs => {
                    const student = cs.students as any;
                    const balance = balanceMap.get(student.id) || 0;
                    const parentPhone = student.parent_phone_number_1 || '';
                    return {
                        id: student.id,
                        school_id: student.school_id,
                        name: student.name,
                        admission_number: student.admission_number || '',
                        parentPhone: parentPhone,
                        hasReport: publishedStudentIds.has(student.id),
                        hasParentPhone: !!parentPhone && parentPhone.trim() !== '',
                        hasDebt: balance > 0,
                        outstandingAmount: balance,
                        className: classData?.name || '',
                        reward_points: 0
                    } as StudentWithReport;
                })
                .filter(s => s.hasReport && s.hasParentPhone) // Only show students with reports and phone numbers
                .sort((a, b) => a.name.localeCompare(b.name));

            setStudents(studentsWithInfo);

            // Auto-select all eligible students (excluding debtors if flag is set)
            const eligibleIds = studentsWithInfo
                .filter(s => !excludeDebtors || !s.hasDebt)
                .map(s => s.id);
            setSelectedStudentIds(new Set(eligibleIds));

        } catch (error) {
            console.error('Error loading students:', error);
            addToast?.('Failed to load student data', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectAll = () => {
        const eligibleStudents = students.filter(s => !excludeDebtors || !s.hasDebt);
        setSelectedStudentIds(new Set(eligibleStudents.map(s => s.id)));
    };

    const handleDeselectAll = () => {
        setSelectedStudentIds(new Set());
    };

    const handleToggleStudent = (studentId: number) => {
        const newSet = new Set(selectedStudentIds);
        if (newSet.has(studentId)) {
            newSet.delete(studentId);
        } else {
            newSet.add(studentId);
        }
        setSelectedStudentIds(newSet);
    };

    const handleSend = async () => {
        if (selectedStudentIds.size === 0) {
            addToast?.('Please select at least one student', 'error');
            return;
        }

        const confirmed = window.confirm(
            `Send report card links to ${selectedStudentIds.size} parent${selectedStudentIds.size > 1 ? 's' : ''} via SMS?`
        );

        if (!confirmed) return;

        setIsSending(true);
        setSendProgress({ current: 0, total: selectedStudentIds.size });

        try {
            const selectedStudents = students
                .filter(s => selectedStudentIds.has(s.id))
                .map(s => ({
                    studentId: s.id,
                    studentName: s.name,
                    parentPhone: s.parentPhone,
                    className: s.className
                }));

            // Use bulk send
            const results = await bulkSendReportCards({
                students: selectedStudents,
                termId,
                termName,
                schoolId,
                userId
            });

            setSendResults(results);
            setSendComplete(true);

            if (results.sent > 0) {
                addToast?.(
                    `Successfully sent ${results.sent} report card link${results.sent > 1 ? 's' : ''}`,
                    'success'
                );
            }

            if (results.failed > 0) {
                addToast?.(
                    `Failed to send ${results.failed} message${results.failed > 1 ? 's' : ''}`,
                    'error'
                );
            }
        } catch (error) {
            console.error('Error sending report cards:', error);
            addToast?.('An error occurred while sending report cards', 'error');
        } finally {
            setIsSending(false);
            setSendProgress(null);
        }
    };

    const filteredStudents = students.filter(s => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = searchQuery === '' ||
            s.name.toLowerCase().includes(searchLower) ||
            (s.admission_number && s.admission_number.toLowerCase().includes(searchLower));

        const matchesDebtFilter = !excludeDebtors || !s.hasDebt;

        return matchesSearch && matchesDebtFilter;
    });

    const eligibleCount = filteredStudents.length;
    const selectedCount = filteredStudents.filter(s => selectedStudentIds.has(s.id)).length;

    if (sendComplete && sendResults) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <CheckCircleIcon className="w-8 h-8 text-green-600" />
                                    Bulk Send Complete!
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                    <p className="text-sm text-slate-600 dark:text-slate-400">Successfully Sent</p>
                                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                                        {sendResults.sent}
                                    </p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                                    <p className="text-sm text-slate-600 dark:text-slate-400">Failed</p>
                                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                                        {sendResults.failed}
                                    </p>
                                </div>
                            </div>

                            {sendResults.errors.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                                        <AlertCircleIcon className="w-5 h-5 text-red-500" />
                                        Failed Students:
                                    </h3>
                                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 max-h-64 overflow-y-auto">
                                        <ul className="space-y-2 text-sm">
                                            {sendResults.errors.map((err, idx) => (
                                                <li key={idx} className="flex justify-between items-start">
                                                    <span className="font-medium">{err.studentName}</span>
                                                    <span className="text-red-600 dark:text-red-400 text-xs ml-2">
                                                        {err.error}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <p className="text-sm text-blue-800 dark:text-blue-300">
                                    📱 All successful links are valid for 30 days from today.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold">📤 Send Reports to Parents (SMS)</h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                {className} • {termName}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isSending}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
                        >
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Spinner size="lg" />
                        </div>
                    ) : (
                        <>
                            {/* Filters and Actions */}
                            <div className="mb-6 space-y-4">
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="flex-1 relative">
                                        <SearchIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by name or admission number..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={excludeDebtors}
                                            onChange={(e) => {
                                                setExcludeDebtors(e.target.checked);
                                                if (e.target.checked) {
                                                    // Remove debtors from selection
                                                    const newSet = new Set(selectedStudentIds);
                                                    students.forEach(s => {
                                                        if (s.hasDebt) newSet.delete(s.id);
                                                    });
                                                    setSelectedStudentIds(newSet);
                                                }
                                            }}
                                            className="rounded"
                                        />
                                        <span className="text-sm font-medium">
                                            Exclude students with outstanding fees
                                        </span>
                                    </label>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSelectAll}
                                            disabled={isSending}
                                            className="px-4 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
                                        >
                                            Select All ({eligibleCount})
                                        </button>
                                        <button
                                            onClick={handleDeselectAll}
                                            disabled={isSending}
                                            className="px-4 py-2 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
                                        >
                                            Deselect All
                                        </button>
                                    </div>
                                </div>

                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                    Selected: <span className="font-semibold">{selectedCount}</span> of{' '}
                                    <span className="font-semibold">{eligibleCount}</span> students
                                </div>
                            </div>

                            {/* Progress Bar */}
                            {isSending && sendProgress && (
                                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium">Sending...</span>
                                        <span className="text-sm font-medium">
                                            {sendProgress.current} / {sendProgress.total}
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{
                                                width: `${(sendProgress.current / sendProgress.total) * 100}%`
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Student List */}
                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mb-6">
                                <div className="max-h-96 overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                                            <tr>
                                                <th className="p-3 text-left font-semibold w-12">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCount === eligibleCount && eligibleCount > 0}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                handleSelectAll();
                                                            } else {
                                                                handleDeselectAll();
                                                            }
                                                        }}
                                                        disabled={isSending}
                                                        className="rounded"
                                                    />
                                                </th>
                                                <th className="p-3 text-left font-semibold">Adm. No.</th>
                                                <th className="p-3 text-left font-semibold">Student Name</th>
                                                <th className="p-3 text-left font-semibold">Parent Phone</th>
                                                <th className="p-3 text-left font-semibold">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {filteredStudents.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                                        {students.length === 0
                                                            ? 'No students with published reports and phone numbers found'
                                                            : 'No students match the current filters'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredStudents.map(student => (
                                                    <tr
                                                        key={student.id}
                                                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                                    >
                                                        <td className="p-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedStudentIds.has(student.id)}
                                                                onChange={() => handleToggleStudent(student.id)}
                                                                disabled={isSending}
                                                                className="rounded"
                                                            />
                                                        </td>
                                                        <td className="p-3 font-mono text-xs">
                                                            {student.admission_number || 'N/A'}
                                                        </td>
                                                        <td className="p-3 font-medium">
                                                            {student.name}
                                                        </td>
                                                        <td className="p-3 font-mono text-xs">
                                                            {student.parentPhone}
                                                        </td>
                                                        <td className="p-3">
                                                            {student.hasDebt && (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                                                                    ₦{student.outstandingAmount.toLocaleString()} debt
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-4">
                                <button
                                    onClick={onClose}
                                    disabled={isSending}
                                    className="px-6 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={isSending || selectedStudentIds.size === 0}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center gap-2"
                                >
                                    {isSending ? (
                                        <>
                                            <Spinner size="sm" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <PaperAirplaneIcon className="w-5 h-5" />
                                            Send to {selectedStudentIds.size} Parent{selectedStudentIds.size !== 1 ? 's' : ''}
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkReportCardSender;
