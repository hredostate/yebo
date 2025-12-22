/**
 * PublicReportView Component
 * Displays a student's report card via a public token link
 * No authentication required - validates via token and expiry
 */

import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
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
        term_label: string;
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

// Helper function to get grade color classes
const getGradeColorClasses = (grade: string): string => {
    const upperGrade = grade.toUpperCase();
    if (upperGrade === 'A') return 'bg-green-100 text-green-800 border-green-300';
    if (upperGrade === 'B') return 'bg-blue-100 text-blue-800 border-blue-300';
    if (upperGrade === 'C') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (upperGrade === 'D') return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-red-100 text-red-800 border-red-300'; // F or lower
};

const PublicReportView: React.FC = () => {
    // Get token from URL pathname and sanitize it
    // Remove any trailing characters like `:1`, query params, or other artifacts
    const rawToken = window.location.pathname.split('/report/')[1] || '';
    const token = rawToken.split(/[?:#]/)[0].trim(); // Split on ?, :, or # and take first part
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reportData, setReportData] = useState<PublicReportData | null>(null);
    const [expired, setExpired] = useState(false);
    const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
    const [schoolName, setSchoolName] = useState<string>('School Report Card');

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
            const supabase = requireSupabaseClient();
            // Fetch report by token
            const { data: report, error: reportError } = await supabase
                .from('student_term_reports')
                .select(`
                    *,
                    student:students!student_id (
                        id,
                        name,
                        admission_number,
                        school_id
                    ),
                    term:terms!term_id (
                        id,
                        term_label,
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

            // Fetch school logo and name if student data is available
            const studentData = Array.isArray(report.student) ? report.student[0] : report.student;
            if (studentData?.school_id) {
                const { data: schoolConfig } = await supabase
                    .from('school_config')
                    .select('logo_url, display_name')
                    .eq('school_id', studentData.school_id)
                    .maybeSingle();
                
                if (schoolConfig?.logo_url) {
                    setSchoolLogo(schoolConfig.logo_url);
                }
                if (schoolConfig?.display_name) {
                    setSchoolName(schoolConfig.display_name);
                }
            }

            setReportData({
                ...report,
                student: studentData,
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

    const subjectCount = reportData.subjects?.length || 0;
    const bestSubject =
        reportData.subjects && reportData.subjects.length > 0
            ? reportData.subjects.reduce((top, current) => {
                  const topScore = top?.score ?? -Infinity;
                  return current.score > topScore ? current : top;
              }, null as (typeof reportData.subjects[number] | null))
            : null;

    const formatDate = (value?: string) =>
        value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

    const gradeLegend = [
        { label: 'A · Excellent', range: '90 - 100', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
        { label: 'B · Very Good', range: '80 - 89', color: 'bg-sky-100 text-sky-800 border-sky-300' },
        { label: 'C · Good', range: '70 - 79', color: 'bg-amber-100 text-amber-900 border-amber-300' },
        { label: 'D · Fair', range: '60 - 69', color: 'bg-orange-100 text-orange-800 border-orange-300' },
        { label: 'E/F · Needs Support', range: '0 - 59', color: 'bg-rose-100 text-rose-800 border-rose-300' }
    ];

    return (
        <div className="report-print-root min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:p-0">
            <style>
{`
    @media print {
        @page {
            size: A4 portrait;
            margin: 10mm;
        }
        
        .a4-print-page {
            width: 210mm;
            min-height: 297mm;
            padding: 0;
            margin: 0 auto;
        }
        
        .a4-print-safe-area {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
        }
        
        .page-break-inside-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        
        .report-card-hero {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        table thead {
            display: table-header-group;
        }
        
        table tr {
            page-break-inside: avoid;
        }
    }
`}
            </style>
            <div className="max-w-5xl mx-auto">
                {/* Header with actions - hidden when printing */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 print:hidden border border-slate-100">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Official student report</p>
                            <h1 className="text-2xl font-black text-slate-800">Report Card • {reportData.term?.session_label}</h1>
                            <p className="text-sm text-slate-600 mt-1">
                                {reportData.student?.name} · {reportData.term?.term_label}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 border border-emerald-200">
                                Secure link · Expires {formatDate(reportData.token_expires_at)}
                            </span>
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-600 text-white rounded-lg shadow-lg shadow-blue-200 hover:shadow-xl transition-all"
                            >
                                <DownloadIcon className="w-5 h-5" />
                                Print / Save PDF
                            </button>
                        </div>
                    </div>
                </div>

                {/* Report Card */}
                <div className="a4-print-page">
                    <div className="a4-print-safe-area report-card relative bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 print:rounded-none print:shadow-none print:border-none">
                    {/* Watermark */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none rotate-[-45deg] text-8xl font-black text-slate-900 whitespace-nowrap z-0 print:opacity-[0.03]">
                        OFFICIAL REPORT
                    </div>
                    
                    {/* Hero Header */}
                    <div className="report-card-hero relative bg-gradient-to-r from-slate-900 via-indigo-800 to-blue-700 text-white px-8 py-10 z-10">
                        <div
                            className="absolute inset-0 opacity-20"
                            style={{
                                backgroundImage:
                                    'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15) 0, rgba(255,255,255,0) 35%), radial-gradient(circle at 80% 10%, rgba(255,255,255,0.12) 0, rgba(255,255,255,0) 30%)'
                            }}
                        />
                        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <img 
                                  src={schoolLogo || "https://tyvufbldcucgmmlattct.supabase.co/storage/v1/object/public/Images/imageedit_1_5058819643%20(1).png"}
                                  alt="School Logo"
                                  className="h-16 w-16 rounded-2xl object-contain bg-white/95 p-2 shadow-xl border border-white/30"
                                />
                                <div>
                                    <p className="text-xs uppercase tracking-[0.25em] text-white/70">{schoolName}</p>
                                    <h1 className="text-3xl font-black leading-tight">Student Report Card</h1>
                                    <p className="text-sm text-white/80 mt-1">
                                        {reportData.term?.term_label} • {reportData.term?.session_label}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 text-sm md:text-right">
                                <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 font-semibold">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                                    Published & ready to print
                                </span>
                                <p className="text-white/80">Issued: {formatDate(reportData.created_at)}</p>
                                <p className="text-white/80">Valid until: {formatDate(reportData.token_expires_at)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="px-8 py-10 md:px-10 md:py-12 space-y-10 relative z-10">
                        {/* Student Info */}
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-inner shadow-slate-100">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Student</p>
                                        <p className="text-xl font-bold text-slate-900">{reportData.student?.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Admission No.</p>
                                        <p className="text-lg font-semibold text-slate-800">{reportData.student?.admission_number || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Class</p>
                                        <p className="text-lg font-semibold text-slate-800">{reportData.academic_class?.name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Position</p>
                                        <p className="text-lg font-semibold text-slate-800">{reportData.position_in_class || '—'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-900 text-white rounded-xl p-6 shadow-lg">
                                <p className="text-xs uppercase tracking-[0.2em] text-white/70">Performance snapshot</p>
                                <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                                    <div className="report-card-stat rounded-lg bg-white/10 p-3 border border-white/10">
                                        <p className="text-4xl font-black leading-tight">{reportData.average_score?.toFixed(1)}%</p>
                                        <p className="text-xs text-white/80 mt-1">Average</p>
                                    </div>
                                    <div className="report-card-stat rounded-lg bg-white/10 p-3 border border-white/10">
                                        <p className="text-4xl font-black leading-tight">{reportData.total_score}</p>
                                        <p className="text-xs text-white/80 mt-1">Total Score</p>
                                    </div>
                                    <div className="report-card-stat rounded-lg bg-white/10 p-3 border border-white/10">
                                        <p className="text-2xl font-black leading-tight">{subjectCount}</p>
                                        <p className="text-xs text-white/80 mt-1">Subjects</p>
                                    </div>
                                    <div className="report-card-stat rounded-lg bg-white/10 p-3 border border-white/10">
                                        <p className="text-xl font-black leading-tight">{bestSubject ? bestSubject.subject_name : '—'}</p>
                                        <p className="text-xs text-white/80 mt-1">Top strength</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Subjects Table */}
                        {reportData.subjects && reportData.subjects.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Academic breakdown</p>
                                        <h3 className="text-xl font-bold text-slate-900">Subject performance</h3>
                                    </div>
                                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                                        Consistent reporting layout
                                    </span>
                                </div>

                                {/* Performance Visualization Chart */}
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 print:page-break-inside-avoid">
                                    <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Performance Overview</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                        {reportData.subjects.slice(0, 12).map((subject, idx) => (
                                            <div key={idx} className="bg-white rounded-lg p-2 border border-slate-200">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-medium text-slate-700 truncate">{subject.subject_name}</span>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${getGradeColorClasses(subject.grade)}`}>
                                                        {subject.grade}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-2">
                                                    <div 
                                                        className={`h-2 rounded-full ${
                                                            subject.score >= 90 ? 'bg-green-500' :
                                                            subject.score >= 80 ? 'bg-blue-500' :
                                                            subject.score >= 70 ? 'bg-yellow-500' :
                                                            subject.score >= 60 ? 'bg-orange-500' : 'bg-red-500'
                                                        }`}
                                                        style={{ width: `${Math.min(subject.score, 100)}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">{subject.score}%</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm page-break-inside-avoid">
                                    <table className="min-w-full">
                                        <thead className="bg-slate-900 text-white" style={{ display: 'table-header-group' }}>
                                            <tr>
                                                <th className="px-4 py-3 text-left text-sm font-semibold">Subject</th>
                                                <th className="px-4 py-3 text-center text-sm font-semibold">Score</th>
                                                <th className="px-4 py-3 text-center text-sm font-semibold">Grade</th>
                                                <th className="px-4 py-3 text-center text-sm font-semibold">Position</th>
                                                <th className="px-4 py-3 text-left text-sm font-semibold">Teacher remark</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-200">
                                            {reportData.subjects.map((subject) => (
                                                <tr key={subject.id} className="hover:bg-slate-50 page-break-inside-avoid">
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{subject.subject_name}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="inline-flex items-center justify-center w-14 rounded-full bg-slate-100 text-slate-900 font-semibold border border-slate-200">
                                                            {subject.score}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-bold border ${getGradeColorClasses(subject.grade)}`}>
                                                            {subject.grade}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-sm text-slate-700">{subject.position || '—'}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-700">{subject.teacher_comment || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">Grade legend</p>
                                        <div className="grid sm:grid-cols-2 gap-2">
                                            {gradeLegend.map((grade) => (
                                                <div key={grade.label} className={`text-sm font-semibold px-3 py-2 rounded-md border ${grade.color}`}>
                                                    <div>{grade.label}</div>
                                                    <p className="text-xs font-normal opacity-80">{grade.range}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-r from-emerald-50 to-white border border-emerald-100 rounded-lg p-4">
                                        <p className="text-xs uppercase tracking-[0.18em] text-emerald-600 mb-2">Highlights</p>
                                        <ul className="space-y-2 text-sm text-emerald-900">
                                            <li>✓ Holistic breakdown of subject strengths</li>
                                            <li>✓ Clear teacher feedback to support growth</li>
                                            <li>✓ Ready for printing and PDF export</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Comments */}
                        {(reportData.teacher_comment || reportData.principal_comment) && (
                            <div className="grid md:grid-cols-2 gap-6">
                                {reportData.teacher_comment && (
                                    <div className="relative bg-blue-50 border border-blue-200 rounded-xl p-6 overflow-hidden">
                                        <div className="absolute -top-10 -right-6 text-7xl text-blue-100" aria-hidden>
                                            “
                                        </div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-blue-700 mb-2">Class teacher</p>
                                        <p className="text-lg font-semibold text-slate-900">{reportData.teacher_comment}</p>
                                    </div>
                                )}
                                {reportData.principal_comment && (
                                    <div className="relative bg-emerald-50 border border-emerald-200 rounded-xl p-6 overflow-hidden">
                                        <div className="absolute -top-10 -right-6 text-7xl text-emerald-100" aria-hidden>
                                            “
                                        </div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-emerald-700 mb-2">Principal</p>
                                        <p className="text-lg font-semibold text-slate-900">{reportData.principal_comment}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="pt-6 border-t border-dashed border-slate-200 flex flex-col gap-6 md:flex-row md:items-center md:justify-between print:page-break-inside-avoid">
                            <div className="space-y-2 text-sm text-slate-600">
                                <p>
                                    Issued for <span className="font-semibold text-slate-900">{reportData.student?.name}</span> · {reportData.academic_class?.name}
                                </p>
                                <p className="text-slate-500">For verification, contact the school administration.</p>
                                <p className="text-xs font-mono text-slate-400">Ref: {reportData.public_token.substring(0, 16)}...</p>
                            </div>
                            <div className="flex items-center gap-6 text-sm text-slate-700">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="h-10 w-32 border-b border-slate-400" />
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Class teacher</p>
                                    <p className="text-[10px] text-slate-400">Signature & Date</p>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <div className="h-10 w-32 border-b border-slate-400" />
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Principal</p>
                                    <p className="text-[10px] text-slate-400">Signature & Date</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                </div>

                {/* Info note - hidden when printing */}
                <div className="mt-6 p-5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 shadow-sm print:hidden">
                    <div className="flex items-start gap-3">
                        <div className="text-xl">📌</div>
                        <div>
                            <p className="font-semibold text-slate-900">Helpful tips</p>
                            <ul className="list-disc list-inside space-y-1 text-slate-600 mt-1">
                                <li>This secure link expires in 30 days from generation.</li>
                                <li>Use the “Print / Save PDF” button above for the best layout.</li>
                                <li>Contact the school directly if you have any questions.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicReportView;
