/**
 * PublicReportView Component
 * Displays a student's report card via a public token link
 * No authentication required - validates via token and expiry
 */

import React, { useState, useEffect, useMemo } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import Spinner from './common/Spinner';
import { DownloadIcon } from './common/icons';
import { createStudentSlug, parsePublicReportTokenFromLocation } from '../utils/reportUrlHelpers';
import { matchComponentScore } from '../utils/reportCardHelpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ReportCardAnnouncement } from '../types';
import { AnnouncementDisplay } from './ResultSheetDesigns';

// RPC response types
interface RPCSubject {
    id?: number;
    subjectName?: string;
    subject_name?: string;
    totalScore?: number;
    total_score?: number;
    gradeLabel?: string;
    grade_label?: string;
    grade?: string;
    subjectPosition?: number;
    subject_position?: number;
    remark?: string;
    componentScores?: Record<string, number>;
    component_scores?: Record<string, number>;
}

// Grade legend item interface
interface GradeLegendItem {
    label: string;
    range: string;
    color: string;
}

// Grading scheme interfaces
interface GradingSchemeRule {
    min_score: number;
    max_score: number;
    grade_label: string;
    remark?: string;
}

interface GradingScheme {
    id: number;
    school_id: number;
    scheme_name: string;
    rules: GradingSchemeRule[];
}

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
        id: number | string; // Allow string for generated IDs based on subject name
        subject_name: string;
        total_score: number;
        grade_label: string;
        subject_position?: number;
        remark?: string;
        component_scores?: Record<string, number>;
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

// Helper function to get ordinal suffix
const getOrdinalSuffix = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
};

// Helper function to convert hex color to rgba
const hexToRgba = (hex: string, alpha: number): string => {
    // Ensure hex starts with #
    const cleanHex = hex.startsWith('#') ? hex : `#${hex}`;
    
    // Handle both 3-digit and 6-digit hex codes
    let r: number, g: number, b: number;
    
    if (cleanHex.length === 4) {
        // 3-digit hex: #RGB -> #RRGGBB
        r = parseInt(cleanHex[1] + cleanHex[1], 16);
        g = parseInt(cleanHex[2] + cleanHex[2], 16);
        b = parseInt(cleanHex[3] + cleanHex[3], 16);
    } else {
        // 6-digit hex: #RRGGBB
        r = parseInt(cleanHex.slice(1, 3), 16);
        g = parseInt(cleanHex.slice(3, 5), 16);
        b = parseInt(cleanHex.slice(5, 7), 16);
    }
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Helper function to fetch grading scheme
const fetchGradingSchemeById = async (supabase: ReturnType<typeof requireSupabaseClient>, schemeId: number): Promise<GradingScheme | null> => {
    const { data: scheme } = await supabase
        .from('grading_schemes')
        .select('*, rules:grading_scheme_rules(*)')
        .eq('id', schemeId)
        .maybeSingle();
    
    return scheme || null;
};

// PerformanceChart component for displaying subject performance graph
const PerformanceChart: React.FC<{ data: { name: string, score: number }[], themeColor: string }> = ({ data, themeColor }) => {
    return (
        <div className="mt-6 mb-6 border rounded-lg p-4 bg-slate-50 page-break-inside-avoid">
            <h4 className="text-center font-bold mb-2 text-slate-700 uppercase text-xs">Academic Performance Overview</h4>
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{fontSize: 10}} interval={0} />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="score" fill={themeColor} radius={[4, 4, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.score < 50 ? '#ef4444' : themeColor} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

const PublicReportView: React.FC = () => {
    // Use centralized token parsing that handles all edge cases
    const token = parsePublicReportTokenFromLocation();
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reportData, setReportData] = useState<PublicReportData | null>(null);
    const [expired, setExpired] = useState(false);
    const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
    const [schoolName, setSchoolName] = useState<string>('School Report Card');
    const [classReportConfig, setClassReportConfig] = useState<any>(null);
    const [positionInArm, setPositionInArm] = useState<number | null>(null);
    const [totalInArm, setTotalInArm] = useState<number | null>(null);
    const [positionInLevel, setPositionInLevel] = useState<number | null>(null);
    const [totalInLevel, setTotalInLevel] = useState<number | null>(null);
    const [armName, setArmName] = useState<string | null>(null);
    const [levelName, setLevelName] = useState<string | null>(null);
    const [attendance, setAttendance] = useState<{
        present: number;
        absent: number;
        late: number;
        excused: number;
        unexcused: number;
        total: number;
        rate: number;
    } | null>(null);
    const [gradingScheme, setGradingScheme] = useState<GradingScheme | null>(null);
    const [announcements, setAnnouncements] = useState<ReportCardAnnouncement[]>([]);

    // Calculate component score columns using useMemo for performance
    // This hook must be called before any conditional returns to satisfy React's Rules of Hooks
    const componentScoreData = useMemo(() => {
        if (!reportData?.subjects || reportData.subjects.length === 0) {
            return { hasComponentScores: false, componentNames: [] as string[] };
        }
        
        const hasComponentScores = reportData.subjects.some(s => s.component_scores && Object.keys(s.component_scores).length > 0);
        const componentNames = hasComponentScores ? 
            Array.from(new Set(
                reportData.subjects.flatMap(s => Object.keys(s.component_scores || {}))
            )).sort() : [];
        
        return { hasComponentScores, componentNames };
    }, [reportData?.subjects]);

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

            // Fetch subjects and additional data using RPC (same as internal view)
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_student_term_report_details', {
                p_student_id: report.student_id,
                p_term_id: report.term_id,
            });

            if (rpcError) throw rpcError;

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

            // Fetch academic class report_config for customizations
            if (report.student_id && report.term_id) {
                const { data: enrollment } = await supabase
                    .from('academic_class_students')
                    .select('academic_class_id')
                    .eq('student_id', report.student_id)
                    .eq('enrolled_term_id', report.term_id)
                    .maybeSingle();

                if (enrollment?.academic_class_id) {
                    const { data: classData } = await supabase
                        .from('academic_classes')
                        .select('report_config, grading_scheme_id')
                        .eq('id', enrollment.academic_class_id)
                        .maybeSingle();
                    
                    if (classData?.report_config) {
                        setClassReportConfig(classData.report_config);
                        
                        // Apply customizations
                        if (classData.report_config.customLogoUrl) {
                            setSchoolLogo(classData.report_config.customLogoUrl);
                        }
                        if (classData.report_config.schoolNameOverride) {
                            setSchoolName(classData.report_config.schoolNameOverride);
                        }
                    }
                    
                    // Fetch grading scheme if available
                    if (classData?.grading_scheme_id) {
                        const scheme = await fetchGradingSchemeById(supabase, classData.grading_scheme_id);
                        if (scheme) {
                            setGradingScheme(scheme);
                        }
                    }
                    
                    // If no class grading scheme, try to get school's active grading scheme
                    if (!classData?.grading_scheme_id && studentData?.school_id) {
                        const { data: schoolConfig } = await supabase
                            .from('school_config')
                            .select('active_grading_scheme_id')
                            .eq('school_id', studentData.school_id)
                            .maybeSingle();
                        
                        if (schoolConfig?.active_grading_scheme_id) {
                            const scheme = await fetchGradingSchemeById(supabase, schoolConfig.active_grading_scheme_id);
                            if (scheme) {
                                setGradingScheme(scheme);
                            }
                        }
                    }
                }
            }

            // Fetch announcements for this term (including global ones)
            const { data: announcementsData, error: announcementsError } = await supabase
                .from('report_card_announcements')
                .select('*')
                .eq('is_active', true)
                .or(`term_id.eq.${report.term_id},term_id.is.null`)
                .order('display_order', { ascending: true });

            if (announcementsError) {
                console.warn('Error fetching announcements:', announcementsError);
            } else {
                setAnnouncements(announcementsData || []);
            }

            // Update URL to canonical format with student slug (preserving hash)
            if (studentData?.name) {
                const studentSlug = createStudentSlug(studentData.name);
                const currentPath = window.location.pathname;
                const canonicalPath = `/report/${token}/${studentSlug}`;
                const hash = window.location.hash;
                
                // Only update if current path doesn't match canonical (normalize trailing slashes)
                const normalizedCurrent = currentPath.replace(/\/$/, '');
                const normalizedCanonical = canonicalPath.replace(/\/$/, '');
                
                if (normalizedCurrent !== normalizedCanonical) {
                    // Use replaceState to update URL without triggering navigation
                    window.history.replaceState(null, '', canonicalPath + hash);
                }
            }

            // Transform RPC subjects data to match the existing interface
            const transformedSubjects = rpcData?.subjects ? rpcData.subjects.map((sub: RPCSubject) => {
                const subjectName = sub.subjectName || sub.subject_name || '';
                // Generate stable ID for React keys - use subject ID if available,
                // otherwise create stable ID from student_id + sanitized subject name
                // Sanitize subject name: remove special chars, convert to lowercase, replace spaces
                const sanitizedName = subjectName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                const stableId = sub.id ?? `${report.student_id}_${sanitizedName}`;
                
                return {
                    id: stableId,
                    subject_name: subjectName,
                    // Use nullish coalescing to preserve 0 scores
                    total_score: sub.totalScore ?? sub.total_score ?? 0,
                    // Use nullish coalescing consistently
                    grade_label: sub.gradeLabel ?? sub.grade_label ?? sub.grade ?? '',
                    subject_position: sub.subjectPosition ?? sub.subject_position,
                    remark: sub.remark ?? '',
                    component_scores: sub.componentScores || sub.component_scores || {},
                };
            }) : [];

            // Extract additional data from RPC response
            // Always use RPC computed values - they are the source of truth
            // Note: RPC returns both camelCase and snake_case for backward compatibility
            // with different parts of the application that may expect either format
            // Use nullish coalescing (??) to preserve legitimate 0 values
            const averageScore = rpcData?.summary?.average ?? rpcData?.summary?.averageScore ?? 0;
            const totalScore = rpcData?.summary?.totalScore ?? rpcData?.summary?.total_score ?? 0;
            
            // Use different names for the extracted values to avoid shadowing state setters
            const extractedPositionInArm = rpcData?.summary?.positionInArm ?? rpcData?.summary?.position_in_arm ?? report.position_in_class;
            const extractedTotalInArm = rpcData?.summary?.cohortSize ?? rpcData?.summary?.totalStudentsInArm ?? rpcData?.summary?.total_students_in_arm;
            const extractedPositionInLevel = rpcData?.summary?.positionInLevel ?? rpcData?.summary?.position_in_level;
            const extractedTotalInLevel = rpcData?.summary?.levelSize ?? rpcData?.summary?.totalStudentsInLevel ?? rpcData?.summary?.total_students_in_level;
            const extractedArmName = rpcData?.student?.armName ?? rpcData?.student?.arm_name;
            const extractedLevelName = rpcData?.student?.levelName ?? rpcData?.student?.level_name ?? rpcData?.student?.level;
            
            const teacherComment = rpcData?.comments?.teacher ?? rpcData?.comments?.teacher_comment ?? report.teacher_comment;
            const principalComment = rpcData?.comments?.principal ?? rpcData?.comments?.principal_comment ?? report.principal_comment;

            // Extract attendance data from RPC response
            const extractedAttendance = rpcData?.attendance ? {
                present: rpcData.attendance.present ?? 0,
                absent: rpcData.attendance.absent ?? 0,
                late: rpcData.attendance.late ?? 0,
                excused: rpcData.attendance.excused ?? 0,
                unexcused: rpcData.attendance.unexcused ?? 0,
                total: rpcData.attendance.total ?? 0,
                rate: rpcData.attendance.rate ?? 0,
            } : null;

            setReportData({
                ...report,
                student: studentData,
                term: Array.isArray(report.term) ? report.term[0] : report.term,
                academic_class: Array.isArray(report.academic_class) ? report.academic_class[0] : report.academic_class,
                subjects: transformedSubjects,
                average_score: averageScore,
                total_score: totalScore,
                position_in_class: extractedPositionInArm,
                teacher_comment: teacherComment,
                principal_comment: principalComment
            });
            
            // Now the state setters work correctly with the extracted values
            setPositionInArm(extractedPositionInArm);
            setTotalInArm(extractedTotalInArm);
            setPositionInLevel(extractedPositionInLevel);
            setTotalInLevel(extractedTotalInLevel);
            setArmName(extractedArmName);
            setLevelName(extractedLevelName);
            setAttendance(extractedAttendance);
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
                  const topScore = top?.total_score ?? -Infinity;
                  return current.total_score > topScore ? current : top;
              }, null as (typeof reportData.subjects[number] | null))
            : null;

    const formatDate = (value?: string) =>
        value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

    // Apply customization settings
    const themeColor = classReportConfig?.colorTheme || '#4F46E5'; // Default to indigo-600
    const showGraph = classReportConfig?.showGraph || false;
    const showSubjectPosition = classReportConfig?.showSubjectPosition !== false;
    const showArmPosition = classReportConfig?.showArmPosition !== false;
    const showLevelPosition = classReportConfig?.showLevelPosition !== false;
    const orientation = classReportConfig?.orientation || 'portrait';

    // Build grading legend from actual grading scheme or use hardcoded default
    const gradeLegend: GradeLegendItem[] = gradingScheme?.rules 
        ? gradingScheme.rules
            .sort((a: GradingSchemeRule, b: GradingSchemeRule) => b.min_score - a.min_score) // Sort by score descending
            .map((rule: GradingSchemeRule) => ({
                label: `${rule.grade_label}${rule.remark ? ' · ' + rule.remark : ''}`,
                range: `${rule.min_score} - ${rule.max_score}`,
                color: getGradeColorClasses(rule.grade_label)
            }))
        : [
            { label: 'A · Excellent', range: '90 - 100', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
            { label: 'B · Very Good', range: '80 - 89', color: 'bg-sky-100 text-sky-800 border-sky-300' },
            { label: 'C · Good', range: '70 - 79', color: 'bg-amber-100 text-amber-900 border-amber-300' },
            { label: 'D · Fair', range: '60 - 69', color: 'bg-orange-100 text-orange-800 border-orange-300' },
            { label: 'E/F · Needs Support', range: '0 - 59', color: 'bg-rose-100 text-rose-800 border-rose-300' }
        ];

    return (
        <div className="report-print-root min-h-screen bg-slate-50 py-8 px-4 print:bg-white print:p-0">
            <style>
{`
    @media print {
        @page {
            size: A4 ${orientation};
            margin: 15mm;
        }
        
        html, body {
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
        }
        
        body {
            margin: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
        }
        
        .report-print-root {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
        }
        
        .report-card-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        
        .report-card {
            width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
        }
        
        .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        
        .page-break-before {
            page-break-before: always !important;
            break-before: always !important;
        }
        
        /* Ensure gradients print correctly */
        .report-header-accent,
        .grade-badge {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
        }
        
        /* Better table handling */
        .subjects-table-container {
            page-break-inside: auto !important;
        }
        
        table {
            width: 100% !important;
            page-break-inside: auto !important;
        }
        
        table thead {
            display: table-header-group !important;
        }
        
        table tfoot {
            display: table-footer-group !important;
        }
        
        table tbody {
            display: table-row-group !important;
        }
        
        table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        
        table td, table th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        
        /* Keep comment sections together */
        .comments-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-before: auto;
        }
        
        /* Keep signature block on same page */
        .signature-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-before: auto;
        }
        
        /* Ensure grade legend stays with table */
        .grade-legend {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        
        /* Remove horizontal scroll container overflow for print */
        .overflow-x-auto {
            overflow: visible !important;
            overflow-x: visible !important;
        }
        
        /* Ensure inline-block doesn't cause issues */
        .inline-block {
            display: block !important;
        }
        
        /* Remove screen-only shadows and effects */
        * {
            box-shadow: none !important;
            text-shadow: none !important;
        }
        
        /* Hide screen-only elements */
        .print\\:hidden {
            display: none !important;
        }
    }
`}
            </style>
            <div className="report-card-container max-w-4xl mx-auto">
                {/* Screen-only toolbar */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6 print:hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Official Academic Document</p>
                            <h1 className="text-2xl font-bold text-slate-900 mt-1">
                                {reportData.term?.session_label} • {reportData.term?.term_label}
                            </h1>
                            <p className="text-sm text-slate-600 mt-1">
                                {reportData.student?.name}
                            </p>
                        </div>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-5 py-2.5 text-white rounded-lg hover:opacity-90 transition-colors font-medium shadow-sm"
                            style={{ backgroundColor: themeColor }}
                        >
                            <DownloadIcon className="w-5 h-5" />
                            Print / Save PDF
                        </button>
                    </div>
                </div>

                {/* Report Card Document */}
                <div className="report-card bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden print:rounded-none print:shadow-none print:border-none">
                    {/* Watermark */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none rotate-[-45deg] select-none z-0">
                        <div className="text-[120px] font-black text-slate-900 whitespace-nowrap tracking-wider">
                            OFFICIAL DOCUMENT
                        </div>
                    </div>
                    
                    {/* Header Section */}
                    <div className="report-header-accent relative bg-white border-b-4 px-8 py-8 page-break-avoid" style={{ borderColor: themeColor }}>
                        <div className="relative z-10 flex items-start gap-6">
                            {/* School Logo */}
                            <div className="flex-shrink-0">
                                <div className="w-20 h-20 rounded-lg bg-white border-2 border-slate-200 p-2 shadow-sm">
                                    <img 
                                        src={schoolLogo || "https://tyvufbldcucgmmlattct.supabase.co/storage/v1/object/public/Images/imageedit_1_5058819643%20(1).png"}
                                        alt="School Logo"
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            </div>
                            
                            {/* School & Report Info */}
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wide mb-1">
                                    {schoolName}
                                </h2>
                                <div className="h-0.5 w-16 mb-3" style={{ backgroundColor: themeColor }}></div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                                    Student Academic Report Card
                                </h3>
                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                                    <span><strong>Term:</strong> {reportData.term?.term_label}</span>
                                    <span><strong>Session:</strong> {reportData.term?.session_label}</span>
                                    <span><strong>Class:</strong> {reportData.academic_class?.name}</span>
                                </div>
                            </div>
                            
                            {/* Issue Date */}
                            <div className="flex-shrink-0 text-right">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Issued</p>
                                <p className="text-sm font-medium text-slate-700">{formatDate(reportData.created_at)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Header Announcements */}
                    <AnnouncementDisplay announcements={announcements} position="header" />

                    <div className="px-8 py-8 space-y-8 relative z-10">
                        {/* Student Identity Section */}
                        <div className="page-break-avoid">
                            <h4 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3 border-b border-slate-200 pb-2">
                                Student Information
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Full Name</p>
                                    <p className="text-base font-semibold text-slate-900">{reportData.student?.name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Admission No.</p>
                                    <p className="text-base font-semibold text-slate-900">{reportData.student?.admission_number || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Class</p>
                                    <p className="text-base font-semibold text-slate-900">{reportData.academic_class?.name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Arm</p>
                                    <p className="text-base font-semibold text-slate-900">{armName || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Level</p>
                                    <p className="text-base font-semibold text-slate-900">{levelName || 'N/A'}</p>
                                </div>
                                {showArmPosition && (
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Position in Class</p>
                                        <p className="text-base font-semibold text-slate-900">
                                            {positionInArm ? `${positionInArm}${getOrdinalSuffix(positionInArm)}${totalInArm ? ` of ${totalInArm}` : ''}` : '—'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Performance Summary Section */}
                        <div className="page-break-avoid">
                            <h4 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3 border-b border-slate-200 pb-2">
                                Overall Performance Summary
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold" style={{ color: themeColor }}>{reportData.average_score?.toFixed(1)}%</p>
                                    <p className="text-xs text-slate-600 uppercase tracking-wider mt-1">Average Score</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold" style={{ color: themeColor }}>{reportData.total_score}</p>
                                    <p className="text-xs text-slate-600 uppercase tracking-wider mt-1">Total Points</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold" style={{ color: themeColor }}>{subjectCount}</p>
                                    <p className="text-xs text-slate-600 uppercase tracking-wider mt-1">Subjects</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                                    <p className="text-lg font-bold truncate" style={{ color: themeColor }}>
                                        {bestSubject ? bestSubject.subject_name : '—'}
                                    </p>
                                    <p className="text-xs text-slate-600 uppercase tracking-wider mt-1">Best Subject</p>
                                </div>
                                {showLevelPosition && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                                        <p className="text-lg font-bold" style={{ color: themeColor }}>
                                            {positionInLevel ? `${positionInLevel}${getOrdinalSuffix(positionInLevel)}${totalInLevel ? ` / ${totalInLevel}` : ''}` : '—'}
                                        </p>
                                        <p className="text-xs text-slate-600 uppercase tracking-wider mt-1">Position in Level</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Attendance Section */}
                        {attendance && attendance.total > 0 && (
                            <div className="page-break-avoid">
                                <h4 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3 border-b border-slate-200 pb-2">
                                    Attendance Record
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-emerald-600">{attendance.present}</p>
                                        <p className="text-xs text-emerald-700 uppercase tracking-wider mt-1">Present</p>
                                    </div>
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-red-600">{attendance.absent}</p>
                                        <p className="text-xs text-red-700 uppercase tracking-wider mt-1">Absent</p>
                                    </div>
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-amber-600">{attendance.late}</p>
                                        <p className="text-xs text-amber-700 uppercase tracking-wider mt-1">Late</p>
                                    </div>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-blue-600">{attendance.excused}</p>
                                        <p className="text-xs text-blue-700 uppercase tracking-wider mt-1">Excused</p>
                                    </div>
                                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-orange-600">{attendance.unexcused}</p>
                                        <p className="text-xs text-orange-700 uppercase tracking-wider mt-1">Unexcused</p>
                                    </div>
                                    <div className="bg-slate-100 border border-slate-300 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-slate-700">{attendance.total}</p>
                                        <p className="text-xs text-slate-600 uppercase tracking-wider mt-1">Total Days</p>
                                    </div>
                                    <div className="rounded-lg p-3 text-center" style={{ backgroundColor: hexToRgba(themeColor, 0.1), borderColor: hexToRgba(themeColor, 0.2), borderWidth: '1px' }}>
                                        <p className="text-2xl font-bold" style={{ color: themeColor }}>{attendance.rate.toFixed(1)}%</p>
                                        <p className="text-xs uppercase tracking-wider mt-1" style={{ color: themeColor }}>Attendance Rate</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Performance Chart */}
                        {showGraph && reportData.subjects && reportData.subjects.length > 0 && (
                            <div className="page-break-avoid">
                                <PerformanceChart 
                                    data={reportData.subjects.map(s => ({ 
                                        name: s.subject_name, 
                                        score: s.total_score 
                                    }))} 
                                    themeColor={themeColor} 
                                />
                            </div>
                        )}

                        {/* Subject Performance Table */}
                        {reportData.subjects && reportData.subjects.length > 0 && (
                            <div className="subjects-table-container page-break-avoid">
                                <h4 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3 border-b border-slate-200 pb-2">
                                    Subject Performance
                                </h4>
                                <div className="overflow-x-auto -mx-4 sm:mx-0">
                                    <div className="inline-block min-w-full align-middle">
                                        <div className="overflow-hidden rounded-lg border border-slate-200 sm:mx-0 mx-4">
                                            <table className="min-w-full divide-y divide-slate-200">
                                                <thead className="bg-slate-800" style={{ display: 'table-header-group' }}>
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Subject</th>
                                                        {componentScoreData.componentNames.map(componentName => (
                                                            <th key={componentName} className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">{componentName}</th>
                                                        ))}
                                                        <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Score</th>
                                                        <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Grade</th>
                                                        {showSubjectPosition && (
                                                            <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">Position</th>
                                                        )}
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Remark</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-slate-200">
                                                    {reportData.subjects.map((subject, index) => (
                                                        <tr key={subject.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} style={{ pageBreakInside: 'avoid' }}>
                                                            <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                                                                {subject.subject_name}
                                                            </td>
                                                            {componentScoreData.componentNames.map((componentName) => {
                                                                // Use semantic matching utility to find the component score
                                                                const value = matchComponentScore(componentName, subject.component_scores) ?? '—';
                                                                
                                                                return (
                                                                    <td key={componentName} className="px-4 py-3 text-center text-sm text-slate-700">
                                                                        {value}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="px-4 py-3 text-center text-sm font-semibold text-slate-900">
                                                                {subject.total_score}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={`grade-badge inline-flex items-center justify-center px-3 py-1 rounded-md text-xs font-bold ${getGradeColorClasses(subject.grade_label)}`}>
                                                                    {subject.grade_label}
                                                                </span>
                                                            </td>
                                                            {showSubjectPosition && (
                                                                <td className="px-4 py-3 text-center text-sm text-slate-700">
                                                                    {subject.subject_position || '—'}
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-3 text-sm text-slate-700">
                                                                {subject.remark || '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Grade Legend */}
                                <div className="grade-legend mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4 page-break-avoid">
                                    <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Grading Scale</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                                        {gradeLegend.map((grade: GradeLegendItem) => (
                                            <div key={grade.label} className={`px-2 py-1 rounded border ${grade.color} font-medium text-center`}>
                                                <div className="font-bold">{grade.label.split('·')[0]}</div>
                                                <div className="text-[10px] opacity-80">{grade.range}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Comments Section */}
                        {(reportData.teacher_comment || reportData.principal_comment) && (
                            <div className="comments-section space-y-4 page-break-avoid">
                                <h4 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3 border-b border-slate-200 pb-2">
                                    Teacher Comments
                                </h4>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {reportData.teacher_comment && (
                                        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                            <p className="text-xs uppercase tracking-wider font-bold text-slate-600 mb-2">
                                                {classReportConfig?.teacherLabel || 'Class Teacher'}'s Remark
                                            </p>
                                            <p className="text-sm text-slate-800 leading-relaxed">{reportData.teacher_comment}</p>
                                        </div>
                                    )}
                                    {reportData.principal_comment && (
                                        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                            <p className="text-xs uppercase tracking-wider font-bold text-slate-600 mb-2">
                                                {classReportConfig?.principalLabel || 'Principal'}'s Remark
                                            </p>
                                            <p className="text-sm text-slate-800 leading-relaxed">{reportData.principal_comment}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Above Signatures Announcements */}
                        <AnnouncementDisplay announcements={announcements} position="above_signatures" />

                        {/* Signature Block */}
                        <div className="signature-block pt-6 border-t border-slate-200 page-break-avoid">
                            <div className="grid md:grid-cols-2 gap-8">
                                <div>
                                    <div className="mb-1">
                                        <div className="h-12 border-b-2 border-slate-300"></div>
                                    </div>
                                    <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                        {classReportConfig?.teacherLabel || 'Class Teacher'} Signature & Date
                                    </p>
                                    {classReportConfig?.teacherNameOverride && (
                                        <p className="text-sm text-slate-700 mt-1">{classReportConfig.teacherNameOverride}</p>
                                    )}
                                </div>
                                <div>
                                    <div className="mb-1">
                                        <div className="h-12 border-b-2 border-slate-300"></div>
                                    </div>
                                    <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                        {classReportConfig?.principalLabel || 'Principal'} Signature & Date
                                    </p>
                                    {classReportConfig?.principalNameOverride && (
                                        <p className="text-sm text-slate-700 mt-1">{classReportConfig.principalNameOverride}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Announcements */}
                        <AnnouncementDisplay announcements={announcements} position="footer" />

                        {/* Footer */}
                        <div className="pt-4 text-center page-break-avoid">
                            <div className="text-xs text-slate-500 space-y-1">
                                <p className="font-medium">This is an official document issued by {schoolName}</p>
                                <p>For verification, please contact the school administration</p>
                                <p className="font-mono text-[10px] text-slate-400">Ref: {reportData.public_token.substring(0, 20)}...</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Screen-only help text */}
                <div className="mt-6 p-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 print:hidden">
                    <div className="flex items-start gap-3">
                        <div className="text-lg">ℹ️</div>
                        <div>
                            <p className="font-semibold text-slate-900 mb-1">Important Information</p>
                            <ul className="space-y-1 text-xs">
                                <li>• This secure link is valid for 30 days from issuance</li>
                                <li>• Use the "Print / Save PDF" button for the best print quality</li>
                                <li>• Contact {schoolName} for any questions or concerns</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicReportView;
