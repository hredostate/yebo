import React from 'react';
import Spinner from './common/Spinner';
import { UserCircleIcon, XCircleIcon } from './common/icons';
import type { ZeroScoreStudent } from '../types';

interface ZeroScoreConfirmationModalProps {
    students: ZeroScoreStudent[];
    subjectName: string;
    className: string;
    isProcessing: boolean;
    onUnenrollAndLock: () => void;
    onKeepAndLock: () => void;
    onCancel: () => void;
}

const ZeroScoreConfirmationModal: React.FC<ZeroScoreConfirmationModalProps> = ({
    students,
    subjectName,
    className,
    isProcessing,
    onUnenrollAndLock,
    onKeepAndLock,
    onCancel
}) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                            <XCircleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-300" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Zero Total Scores Detected
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {subjectName} • {className}
                            </p>
                        </div>
                    </div>
                    {!isProcessing && (
                        <button
                            onClick={onCancel}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="px-6 py-4 flex-1 overflow-y-auto">
                    <div className="mb-4">
                        <p className="text-gray-700 dark:text-gray-300">
                            The following {students.length} student{students.length !== 1 ? 's have' : ' has'} a <strong>total score of 0</strong> for <strong>{subjectName}</strong>. 
                            This typically means {students.length !== 1 ? 'they are' : 'the student is'} not taking this subject.
                        </p>
                    </div>

                    {/* Student List */}
                    <div className="space-y-2 mb-6">
                        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                            Affected Students
                        </h3>
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-60 overflow-y-auto">
                            {students.map((student) => (
                                <div
                                    key={student.student_id}
                                    className="px-4 py-3 flex items-center gap-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
                                >
                                    <UserCircleIcon className="h-8 w-8 text-gray-400" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {student.student_name}
                                        </p>
                                        {student.admission_number && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Admission #: {student.admission_number}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                                            Total: {student.total_score ?? 0}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Explanation */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                            What happens next?
                        </h4>
                        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                            <li className="flex gap-2">
                                <span className="font-semibold">•</span>
                                <span><strong>Unenroll & Lock:</strong> Removes these students from the subject, deletes their score entries, and recalculates class rankings. They will NOT appear on report cards for this subject.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-semibold">•</span>
                                <span><strong>Keep Zeros & Lock:</strong> Locks the assignment without changes. Zero scores will remain in the system and appear on report cards and statistics.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-semibold">•</span>
                                <span><strong>Cancel:</strong> Aborts the lock operation so you can review manually.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onKeepAndLock}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Keep Zeros & Lock
                    </button>
                    <button
                        onClick={onUnenrollAndLock}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Spinner className="h-4 w-4" />
                                Processing...
                            </>
                        ) : (
                            'Unenroll & Lock'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ZeroScoreConfirmationModal;
