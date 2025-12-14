/**
 * PublicReportView Component
 * Displays a student's report card via a public token link
 * No authentication required - validates via token and expiry
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Spinner from './common/Spinner';
import { DownloadIcon } from './common/icons';

interface PublicReportData {
    id: number;
    student_id: number;
    term_id: number;
    academic_class_id: number;
    average_score: number;
    total_score: number;
    position_in_class: number;
    teacher_comment?: string;
    principal_comment?: string;
    is_published: boolean;
    public_token: string;
    token_expires_at: string;
    created_at: string;
    student?: {
        id: number;
        name: string;
        admission_number?: string;
    };
    term?: {
        id: number;
        name: string;
        session_label?: string;
        start_date: string;
        end_date: string;
    };
    academic_class?: {
        id: number;
        name: string;
    };
    subjects?: Array<{
        id: number;
        subject_name: string;
        score: number;
        grade: string;
        position?: number;
        teacher_comment?: string;
    }>;
}

const PublicReportView: React.FC = () => {
    // Get token from URL pathname
    const token = window.location.pathname.split('/report/')[1] || '';
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reportData, setReportData] = useState<PublicReportData | null>(null);
    const [expired, setExpired] = useState(false);

    useEffect(() => {
        fetchReport();
    }, [token]);

    const fetchReport = async () => {
        if (!token) {
            setError('Invalid link');
            setLoading(false);
            return;
        }

        try {
            // Fetch report by token
            const { data: report, error: reportError } = await supabase
                .from('student_term_reports')
                .select(`
                    *,
                    student:students!student_id (
                        id,
                        name,
                        admission_number
                    ),
                    term:terms!term_id (
                        id,
                        name,
                        session_label,
                        start_date,
                        end_date
                    ),
                    academic_class:academic_classes!academic_class_id (
                        id,
                        name
                    )
                `)
                .eq('public_token', token)
                .maybeSingle();

            if (reportError) throw reportError;

            if (!report) {
                setError('Report not found');
                setLoading(false);
                return;
            }

            // Check if token is expired
            if (report.token_expires_at) {
                const expiryDate = new Date(report.token_expires_at);
                if (expiryDate < new Date()) {
                    setExpired(true);
                    setLoading(false);
                    return;
                }
            }

            // Fetch subjects for this report
            const { data: subjects, error: subjectsError } = await supabase
                .from('student_term_report_subjects')
                .select('*')
                .eq('report_id', report.id)
                .order('subject_name');

            if (subjectsError) throw subjectsError;

            setReportData({
                ...report,
                student: Array.isArray(report.student) ? report.student[0] : report.student,
                term: Array.isArray(report.term) ? report.term[0] : report.term,
                academic_class: Array.isArray(report.academic_class) ? report.academic_class[0] : report.academic_class,
                subjects: subjects || []
            });
        } catch (err: any) {
            console.error('Error fetching report:', err);
            setError(err.message || 'Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Spinner size="lg" />
            </div>
        );
    }

    if (expired) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
                    <div className="text-6xl mb-4">⏱️</div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Link Expired</h1>
                    <p className="text-slate-600 mb-4">
                        This report link has expired. Report links are valid for 30 days.
                    </p>
                    <p className="text-sm text-slate-500">
                        Please contact the school to request a new link.
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Error</h1>
                    <p className="text-slate-600">{error}</p>
                </div>
            </div>
        );
    }

    if (!reportData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
                    <div className="text-6xl mb-4">📄</div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Report Not Found</h1>
                    <p className="text-slate-600">The requested report could not be found.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header with actions - hidden when printing */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6 print:hidden">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Student Report Card</h1>
                            <p className="text-sm text-slate-600 mt-1">
                                {reportData.student?.name} - {reportData.term?.name} {reportData.term?.session_label}
                            </p>
                        </div>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            Print / Save PDF
                        </button>
                    </div>
                </div>

                {/* Report Card */}
                <div className="bg-white rounded-lg shadow-lg p-8 print:shadow-none">
                    {/* School Header */}
                    <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
                        <h1 className="text-3xl font-bold text-slate-800">UPSS</h1>
                        <p className="text-sm text-slate-600 mt-2">Student Report Card</p>
                        <p className="text-xs text-slate-500 mt-1">
                            {reportData.term?.name} - {reportData.term?.session_label}
                        </p>
                    </div>

                    {/* Student Info */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div>
                            <p className="text-sm text-slate-600">Student Name:</p>
                            <p className="text-lg font-semibold text-slate-800">{reportData.student?.name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-600">Admission Number:</p>
                            <p className="text-lg font-semibold text-slate-800">{reportData.student?.admission_number || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-600">Class:</p>
                            <p className="text-lg font-semibold text-slate-800">{reportData.academic_class?.name || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-600">Position in Class:</p>
                            <p className="text-lg font-semibold text-slate-800">{reportData.position_in_class}</p>
                        </div>
                    </div>

                    {/* Subjects Table */}
                    {reportData.subjects && reportData.subjects.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Subject Performance</h3>
                            <table className="w-full border-collapse border border-slate-300">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th className="border border-slate-300 px-4 py-2 text-left">Subject</th>
                                        <th className="border border-slate-300 px-4 py-2 text-center">Score</th>
                                        <th className="border border-slate-300 px-4 py-2 text-center">Grade</th>
                                        <th className="border border-slate-300 px-4 py-2 text-center">Position</th>
                                        <th className="border border-slate-300 px-4 py-2 text-left">Remark</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.subjects.map((subject) => (
                                        <tr key={subject.id}>
                                            <td className="border border-slate-300 px-4 py-2">{subject.subject_name}</td>
                                            <td className="border border-slate-300 px-4 py-2 text-center font-semibold">
                                                {subject.score}
                                            </td>
                                            <td className="border border-slate-300 px-4 py-2 text-center font-semibold">
                                                {subject.grade}
                                            </td>
                                            <td className="border border-slate-300 px-4 py-2 text-center">
                                                {subject.position || '-'}
                                            </td>
                                            <td className="border border-slate-300 px-4 py-2 text-sm">
                                                {subject.teacher_comment || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Overall Performance */}
                    <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-slate-50 rounded-lg">
                        <div>
                            <p className="text-sm text-slate-600">Total Score:</p>
                            <p className="text-2xl font-bold text-slate-800">{reportData.total_score}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-600">Average Score:</p>
                            <p className="text-2xl font-bold text-slate-800">{reportData.average_score.toFixed(2)}%</p>
                        </div>
                    </div>

                    {/* Comments */}
                    {(reportData.teacher_comment || reportData.principal_comment) && (
                        <div className="space-y-4 mb-8">
                            {reportData.teacher_comment && (
                                <div className="p-4 bg-blue-50 rounded-lg">
                                    <p className="text-sm font-semibold text-slate-700 mb-1">Class Teacher's Comment:</p>
                                    <p className="text-slate-800">{reportData.teacher_comment}</p>
                                </div>
                            )}
                            {reportData.principal_comment && (
                                <div className="p-4 bg-green-50 rounded-lg">
                                    <p className="text-sm font-semibold text-slate-700 mb-1">Principal's Comment:</p>
                                    <p className="text-slate-800">{reportData.principal_comment}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="text-center text-sm text-slate-500 mt-8 pt-4 border-t border-slate-200">
                        <p>Generated by UPSS</p>
                        <p className="mt-1">
                            This report is valid until: {new Date(reportData.token_expires_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                {/* Info note - hidden when printing */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 print:hidden">
                    <p className="font-semibold mb-1">📌 Note:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>This is a secure link that expires in 30 days from generation</li>
                        <li>To save this report as PDF, click the "Print / Save PDF" button and choose "Save as PDF"</li>
                        <li>For questions about this report, please contact the school directly</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default PublicReportView;
