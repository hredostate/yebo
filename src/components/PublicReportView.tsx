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
        <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100 py-10 px-4">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header with actions - hidden when printing */}
                <div className="bg-white/80 backdrop-blur rounded-xl shadow-lg p-6 border border-slate-200 print:hidden">
                    <div className="flex flex-wrap justify-between gap-4 items-center">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Official academic record</p>
                            <h1 className="text-2xl font-black text-slate-800 mt-1">Student Report Card</h1>
                            <p className="text-sm text-slate-600 mt-1">
                                {reportData.student?.name} • {reportData.term?.name} {reportData.term?.session_label}
                            </p>
                        </div>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg shadow-md hover:from-indigo-700 hover:to-blue-700 transition-all"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            Print / Save PDF
                        </button>
                    </div>
                </div>

                {/* Report Card */}
                <div className="report-card bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden print:shadow-none">
                    <div className="h-1 w-full bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-400 print:bg-slate-800" />

                    {/* School Header */}
                    <div className="px-8 pt-8 pb-6 border-b border-slate-200 flex items-start justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-600 to-sky-500 text-white flex items-center justify-center font-black text-xl shadow-md">
                                UP
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Uptodate Private Schools</p>
                                <h1 className="text-3xl font-black text-slate-900">Student Report Card</h1>
                                <p className="text-sm text-slate-600">
                                    {reportData.term?.name} • {reportData.term?.session_label}
                                </p>
                            </div>
                        </div>
                        <div className="text-right text-xs text-slate-500 leading-5">
                            <p className="font-semibold text-slate-700">Issued</p>
                            <p>{new Date(reportData.created_at).toLocaleDateString()}</p>
                            <p className="mt-2 text-emerald-600 font-semibold">Status: Published</p>
                        </div>
                    </div>

                    {/* Student Info */}
                    <div className="px-8 py-6 bg-slate-50/70 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-200">
                        {[{
                            label: 'Student Name',
                            value: reportData.student?.name || '—',
                        }, {
                            label: 'Admission Number',
                            value: reportData.student?.admission_number || 'N/A',
                        }, {
                            label: 'Class',
                            value: reportData.academic_class?.name || 'N/A',
                        }, {
                            label: 'Position in Class',
                            value: reportData.position_in_class ? `${reportData.position_in_class}${
                                reportData.position_in_class === 1 ? 'st' : reportData.position_in_class === 2 ? 'nd' : reportData.position_in_class === 3 ? 'rd' : 'th'
                            }` : '—',
                        }].map((item) => (
                            <div key={item.label} className="p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
                                <p className="text-xs tracking-wide text-slate-500 uppercase">{item.label}</p>
                                <p className="text-lg font-semibold text-slate-900 mt-1">{item.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Performance Summary */}
                    <div className="px-8 py-6 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
                        <div className="flex flex-wrap gap-4 items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-slate-300">Performance snapshot</p>
                                <p className="text-2xl font-black leading-tight">Overall Achievement</p>
                                <p className="text-sm text-slate-200 mt-1">A modern, print-ready report for guardians</p>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto">
                                {[{
                                    label: 'Average Score',
                                    value: `${reportData.average_score.toFixed(2)}%`,
                                    accent: 'bg-emerald-500/10 text-emerald-200 border border-emerald-400/40',
                                }, {
                                    label: 'Total Score',
                                    value: reportData.total_score,
                                    accent: 'bg-sky-500/10 text-sky-100 border border-sky-400/50',
                                }, {
                                    label: 'Class Position',
                                    value: reportData.position_in_class || '—',
                                    accent: 'bg-indigo-500/10 text-indigo-100 border border-indigo-400/50',
                                }, {
                                    label: 'Report Valid Until',
                                    value: new Date(reportData.token_expires_at).toLocaleDateString(),
                                    accent: 'bg-amber-500/10 text-amber-100 border border-amber-400/40',
                                }].map((metric) => (
                                    <div key={metric.label} className={`min-w-[140px] rounded-xl px-4 py-3 ${metric.accent}`}>
                                        <p className="text-[11px] uppercase tracking-wide">{metric.label}</p>
                                        <p className="text-xl font-bold leading-tight">{metric.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Subjects Table */}
                    {reportData.subjects && reportData.subjects.length > 0 && (
                        <div className="px-8 py-6 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Subjects</p>
                                    <h3 className="text-xl font-bold text-slate-900">Academic Performance Breakdown</h3>
                                </div>
                                <div className="text-xs text-slate-500 text-right">
                                    <p className="font-semibold text-slate-700">Grading Scale</p>
                                    <p>A: 70-100 • B: 60-69 • C: 50-59 • D: 45-49 • F: 0-44</p>
                                </div>
                            </div>
                            <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                                <table className="w-full border-collapse">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Subject</th>
                                            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Score</th>
                                            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Grade</th>
                                            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Position</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Teacher Remark</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {reportData.subjects.map((subject, index) => (
                                            <tr key={subject.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                                <td className="px-4 py-3 text-slate-900 font-medium">{subject.subject_name}</td>
                                                <td className="px-4 py-3 text-center text-slate-900 font-semibold">{subject.score}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-slate-900 text-white">
                                                        {subject.grade}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center text-slate-800">{subject.position || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-700">{subject.teacher_comment || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Comments */}
                    {(reportData.teacher_comment || reportData.principal_comment) && (
                        <div className="px-8 py-6 space-y-4 border-t border-slate-200 bg-slate-50/60">
                            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Mentor feedback</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {reportData.teacher_comment && (
                                    <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Class Teacher</p>
                                        <p className="text-slate-900 font-semibold mt-1">Teacher's Reflection</p>
                                        <p className="text-slate-700 mt-2 leading-relaxed">{reportData.teacher_comment}</p>
                                    </div>
                                )}
                                {reportData.principal_comment && (
                                    <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                                        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Principal</p>
                                        <p className="text-slate-900 font-semibold mt-1">Principal's Note</p>
                                        <p className="text-slate-700 mt-2 leading-relaxed">{reportData.principal_comment}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="px-8 py-6 bg-white border-t border-slate-200 text-sm text-slate-600 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <p className="font-semibold text-slate-800">Generated by UPSS</p>
                            <p className="text-slate-500">This document remains valid until {new Date(reportData.token_expires_at).toLocaleDateString()}.</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="h-3 w-3 rounded-full bg-emerald-500" />
                            <span>Digitally issued &amp; secured</span>
                        </div>
                    </div>
                </div>

                {/* Info note - hidden when printing */}
                <div className="mt-2 p-5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-900 print:hidden shadow-sm">
                    <p className="font-semibold mb-1">📌 How to use this report</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>This secure link expires in 30 days from generation.</li>
                        <li>To save this report as PDF, click "Print / Save PDF" and choose "Save as PDF".</li>
                        <li>Share responsibly—this report contains sensitive academic information.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default PublicReportView;
